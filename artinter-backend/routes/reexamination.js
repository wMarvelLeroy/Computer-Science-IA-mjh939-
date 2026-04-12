import express from 'express';
import { supabase } from '../config/supabase.js';
import { requireAuth, isAdmin } from '../middleware/auth.js';
import { logAdminAction } from '../utils/adminLog.js';

const router = express.Router();

const TYPES_ACTIONNABLES = ['restriction', 'auteur_banni', 'article_restreint', 'role_retire'];

// POST /api/reexamination
router.post('/', requireAuth, async (req, res) => {
  try {
    const { notification_id, motif } = req.body;
    const user_id = req.user.id;

    if (!notification_id || !motif?.trim()) {
      return res.status(400).json({ success: false, error: 'notification_id et motif requis' });
    }

    const { data: notif, error: notifErr } = await supabase
      .from('notifications')
      .select('id, type, user_id')
      .eq('id', notification_id)
      .eq('user_id', user_id)
      .single();

    if (notifErr || !notif) {
      return res.status(404).json({ success: false, error: 'Notification introuvable' });
    }
    if (!TYPES_ACTIONNABLES.includes(notif.type)) {
      return res.status(400).json({ success: false, error: 'Ce type de notification ne permet pas de réexamination' });
    }

    const { data: pending } = await supabase
      .from('demandes_reexamination')
      .select('id')
      .eq('notification_id', notification_id)
      .eq('statut', 'en_attente')
      .maybeSingle();

    if (pending) {
      return res.status(409).json({ success: false, error: 'Une demande est déjà en attente pour cette notification' });
    }

    // cooldown
    const { data: lastRefus } = await supabase
      .from('demandes_reexamination')
      .select('cooldown_jours, traitee_le')
      .eq('notification_id', notification_id)
      .eq('statut', 'refusee')
      .order('traitee_le', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastRefus) {
      if (lastRefus.cooldown_jours === -1) {
        return res.status(403).json({ success: false, error: 'Demande définitivement refusée pour cette notification' });
      }
      if (lastRefus.cooldown_jours && lastRefus.traitee_le) {
        const expireAt = new Date(lastRefus.traitee_le).getTime() + lastRefus.cooldown_jours * 86400000;
        if (Date.now() < expireAt) {
          return res.status(403).json({
            success: false,
            error: 'Cooldown actif',
            expire_at: new Date(expireAt).toISOString()
          });
        }
      }
    }

    const { data, error } = await supabase
      .from('demandes_reexamination')
      .insert([{ user_id, notification_id, type_sanction: notif.type, motif: motif.trim() }])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/reexamination/mes-demandes
router.get('/mes-demandes', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('demandes_reexamination')
      .select('*, notifications(type, titre, message, created_at)')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/reexamination (admin)
router.get('/', requireAuth, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, error: 'Accès refusé' });

    const { statut } = req.query;
    let query = supabase
      .from('demandes_reexamination')
      .select(`
        *,
        profils!demandes_reexamination_user_id_fkey(id, nom, avatar_url),
        notifications(type, titre, message, created_at)
      `)
      .order('created_at', { ascending: false });

    if (statut) query = query.eq('statut', statut);

    const { data, error } = await query;
    if (error) throw error;

    const userIds = [...new Set((data || []).map(d => d.user_id).filter(Boolean))];
    const emailMap = {};
    await Promise.all(userIds.map(async (uid) => {
      try {
        const { data: { user } } = await supabase.auth.admin.getUserById(uid);
        if (user) emailMap[uid] = user.email;
      } catch {}
    }));

    const enriched = (data || []).map(d => ({
      ...d,
      profils: d.profils ? { ...d.profils, email: emailMap[d.user_id] || null } : d.profils
    }));

    res.json({ success: true, data: enriched });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/reexamination/:id/traiter
router.put('/:id/traiter', requireAuth, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, error: 'Accès refusé' });

    const { decision, reponse, cooldown_jours } = req.body;
    if (!['approuvee', 'refusee'].includes(decision)) {
      return res.status(400).json({ success: false, error: 'decision doit être approuvee ou refusee' });
    }

    const { data: demande, error: fetchErr } = await supabase
      .from('demandes_reexamination')
      .select('*')
      .eq('id', req.params.id)
      .eq('statut', 'en_attente')
      .single();

    if (fetchErr || !demande) {
      return res.status(404).json({ success: false, error: 'Demande introuvable ou déjà traitée' });
    }

    const updateData = {
      statut: decision,
      reponse_admin: reponse?.trim() || null,
      traitee_par: req.user.id,
      traitee_le: new Date().toISOString(),
    };
    if (decision === 'refusee') {
      updateData.cooldown_jours = cooldown_jours ?? null;
    }

    const { data: updated, error: updateErr } = await supabase
      .from('demandes_reexamination')
      .update(updateData)
      .eq('id', req.params.id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    if (decision === 'approuvee') {
      const msgAdmin = reponse?.trim() || null;

      if (demande.type_sanction === 'restriction') {
        // lever restriction
        const { data: restr } = await supabase
          .from('restrictions')
          .select('id')
          .eq('user_id', demande.user_id)
          .eq('actif', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (restr) {
          await supabase.from('restrictions').update({ actif: false }).eq('id', restr.id);
        }

        await supabase.from('notifications').insert([{
          user_id: demande.user_id,
          type: 'restriction_levee',
          titre: 'Réexamination approuvée — Restriction levée',
          message: msgAdmin || 'Votre demande de réexamination a été acceptée. Votre restriction a été levée.'
        }]);

      } else if (demande.type_sanction === 'auteur_banni') {
        await supabase.from('auteurs').update({ est_banni: false }).eq('id', demande.user_id);

        await supabase.from('notifications').insert([{
          user_id: demande.user_id,
          type: 'auteur_debanni',
          titre: 'Réexamination approuvée — Bannissement levé',
          message: msgAdmin || 'Votre demande de réexamination a été acceptée. Votre bannissement a été levé.'
        }]);

      } else {
        // action manuelle
        await supabase.from('notifications').insert([{
          user_id: demande.user_id,
          type: 'demande_approuvee',
          titre: 'Réexamination approuvée',
          message: msgAdmin || 'Votre demande a été acceptée. Un administrateur va traiter votre cas manuellement.'
        }]);
      }

    } else {
      let cooldownMsg = '';
      if (cooldown_jours === -1) {
        cooldownMsg = ' Vous ne pouvez plus soumettre de nouvelle demande pour cette sanction.';
      } else if (cooldown_jours) {
        cooldownMsg = ` Vous pourrez soumettre une nouvelle demande dans ${cooldown_jours} jour(s).`;
      }

      await supabase.from('notifications').insert([{
        user_id: demande.user_id,
        type: 'demande_refusee',
        titre: 'Réexamination refusée',
        message: (reponse?.trim() || 'Votre demande de réexamination a été refusée.') + cooldownMsg
      }]);
    }

    await supabase.from('moderations_claims').delete()
      .eq('table_name', 'demandes_reexamination').eq('item_id', req.params.id);

    await logAdminAction(req.user.id, `reexamination_${decision}`, 'demandes_reexamination', req.params.id, {
      type_sanction: demande.type_sanction,
      decision,
      reponse: reponse?.trim() || null,
      cooldown_jours: decision === 'refusee' ? (cooldown_jours ?? null) : undefined,
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
