import express from 'express';
import { supabase } from '../config/supabase.js';
import { requireAuth, isAdmin } from '../middleware/auth.js';

const router = express.Router();

const TABLE_LABELS = {
  signalements:            'signalement',
  demandes_reexamination:  'demande de réexamination',
  demandes_auteur:         'demande auteur',
  demandes_categorie:      'demande de catégorie',
};

// ─── GET / ── Claims actives pour une table ───────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, error: 'Accès refusé' });

    const { table_name } = req.query;
    if (!table_name) return res.status(400).json({ success: false, error: 'table_name requis' });

    const { data, error } = await supabase
      .from('moderations_claims')
      .select('*, profils!moderations_claims_claimed_by_fkey(id, nom, avatar_url)')
      .eq('table_name', table_name)
      .gt('expires_at', new Date().toISOString());

    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST / ── Prendre en charge ──────────────────────────────────────────────
router.post('/', requireAuth, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, error: 'Accès refusé' });

    const { table_name, item_id } = req.body;
    if (!table_name || !item_id) {
      return res.status(400).json({ success: false, error: 'table_name et item_id requis' });
    }

    // Chercher une claim existante (active ou expirée)
    const { data: existing } = await supabase
      .from('moderations_claims')
      .select('*, profils!moderations_claims_claimed_by_fkey(id, nom)')
      .eq('table_name', table_name)
      .eq('item_id', item_id)
      .maybeSingle();

    if (existing) {
      const active = new Date(existing.expires_at) > new Date();
      // Si active et prise par quelqu'un d'autre → refus
      if (active && existing.claimed_by !== req.user.id) {
        return res.status(409).json({
          success: false,
          error: `Déjà pris en charge par ${existing.profils?.nom || 'un admin'}`,
          claim: existing,
        });
      }
      // Sinon (prise par moi ou expirée) → supprimer l'ancienne
      await supabase.from('moderations_claims').delete().eq('id', existing.id);
    }

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('moderations_claims')
      .insert([{ table_name, item_id, claimed_by: req.user.id, expires_at: expiresAt }])
      .select('*, profils!moderations_claims_claimed_by_fkey(id, nom, avatar_url)')
      .single();

    if (error) throw error;
    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── DELETE /:table_name/:item_id ── Libérer ──────────────────────────────────
router.delete('/:table_name/:item_id', requireAuth, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, error: 'Accès refusé' });

    const { table_name, item_id } = req.params;

    const { data: existing } = await supabase
      .from('moderations_claims')
      .select('claimed_by')
      .eq('table_name', table_name)
      .eq('item_id', item_id)
      .maybeSingle();

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Aucune prise en charge trouvée' });
    }

    // Seul le responsable ou un super_admin peut libérer
    const isSuperAdmin = req.profil?.role === 'super_admin';
    if (existing.claimed_by !== req.user.id && !isSuperAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Seul le responsable ou un super administrateur peut libérer cette prise en charge',
      });
    }

    await supabase.from('moderations_claims')
      .delete()
      .eq('table_name', table_name)
      .eq('item_id', item_id);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /:table_name/:item_id/contester ── Notifier le responsable ──────────
router.post('/:table_name/:item_id/contester', requireAuth, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, error: 'Accès refusé' });

    const { table_name, item_id } = req.params;

    const { data: existing } = await supabase
      .from('moderations_claims')
      .select('claimed_by, expires_at')
      .eq('table_name', table_name)
      .eq('item_id', item_id)
      .maybeSingle();

    if (!existing || new Date(existing.expires_at) <= new Date()) {
      return res.status(404).json({ success: false, error: 'Aucune prise en charge active' });
    }
    if (existing.claimed_by === req.user.id) {
      return res.status(400).json({ success: false, error: 'Vous êtes déjà responsable de cet élément' });
    }

    // Nom du contestataire
    const { data: contesterProfil } = await supabase
      .from('profils')
      .select('nom')
      .eq('id', req.user.id)
      .single();

    const tableLabel = TABLE_LABELS[table_name] || table_name;

    await supabase.from('notifications').insert([{
      user_id: existing.claimed_by,
      type: 'claim_contested',
      titre: 'Contestation de prise en charge',
      message: `${contesterProfil?.nom || 'Un administrateur'} souhaite prendre en charge le ${tableLabel} que vous avez réclamé. Si vous ne pouvez pas le traiter, libérez la prise en charge depuis le panneau de gestion.`,
    }]);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
