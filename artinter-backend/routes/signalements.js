import express from 'express';
import { supabase } from '../config/supabase.js';
import { requireAuth, isAdmin } from '../middleware/auth.js';
import { logAdminAction } from '../utils/adminLog.js';

const router = express.Router();

const RAISONS_VALIDES = ['contenu_inapproprie', 'spam', 'desinformation', 'droits_auteur', 'autre'];

// GET /api/signalements - Tous les signalements (admin)
router.get('/', requireAuth, async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Accès refusé' });
    }
    const { statut } = req.query;

    let query = supabase
      .from('signalements')
      .select(`
        *,
        profils!signalements_user_id_fkey(id, nom, avatar_url, email),
        articles!signalements_article_id_fkey(id, titre, slug, est_publie)
      `)
      .order('created_at', { ascending: false });

    if (statut) query = query.eq('statut', statut);

    const { data, error } = await query;
    if (error) {
      console.error('Erreur query signalements:', error);
      throw error;
    }

    const userIds = [...new Set(data.map(s => s.user_id).filter(Boolean))];
    const emailMap = {};
    await Promise.all(
      userIds.map(async (uid) => {
        try {
          const { data: { user } } = await supabase.auth.admin.getUserById(uid);
          if (user) emailMap[uid] = user.email;
        } catch { /* silencieux */ }
      })
    );

    const enriched = data.map(s => ({
      ...s,
      profils: s.profils ? { ...s.profils, email: emailMap[s.user_id] || s.profils.email || null } : s.profils,
    }));

    res.json({ success: true, data: enriched });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/signalements/check/:articleId - L'user a-t-il déjà signalé cet article ?
router.get('/check/:articleId', requireAuth, async (req, res) => {
  try {
    const { articleId } = req.params;
    const userId = req.user.id;

    const { data } = await supabase
      .from('signalements')
      .select('id, statut')
      .eq('article_id', articleId)
      .eq('user_id', userId)
      .single();

    res.json({ success: true, data: data || null });
  } catch {
    res.json({ success: true, data: null });
  }
});

// POST /api/signalements - Créer un signalement
router.post('/', requireAuth, async (req, res) => {
  try {
    const { article_id, raison, description } = req.body;
    const user_id = req.user.id;

    if (!article_id || !raison) {
      return res.status(400).json({ success: false, error: 'article_id et raison requis' });
    }
    if (!RAISONS_VALIDES.includes(raison)) {
      return res.status(400).json({ success: false, error: 'Raison invalide' });
    }

    const { data, error } = await supabase
      .from('signalements')
      .insert([{ article_id, user_id, raison, description: description?.trim() || null }])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ success: false, error: 'Vous avez déjà signalé cet article' });
      }
      throw error;
    }

    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/signalements/:id/traiter - Marquer comme traité (admin)
router.put('/:id/traiter', requireAuth, async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Accès refusé' });
    }
    const note = req.body?.note?.trim() || null;

    const { data: sig } = await supabase
      .from('signalements')
      .select('user_id, articles!signalements_article_id_fkey(titre)')
      .eq('id', req.params.id)
      .single();

    const { data, error } = await supabase
      .from('signalements')
      .update({ statut: 'traite' })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    if (sig?.user_id) {
      const articleTitre = sig.articles?.titre || 'un article';
      await supabase.from('notifications').insert([{
        user_id: sig.user_id,
        type: 'signalement_traite',
        titre: 'Votre signalement a été traité',
        message: note
          ? `Votre signalement concernant "${articleTitre}" a été examiné et pris en compte.\n\nNote de l'administrateur : ${note}`
          : `Votre signalement concernant "${articleTitre}" a été examiné et pris en compte.`,
      }]);
    }

    await supabase.from('moderations_claims').delete()
      .eq('table_name', 'signalements').eq('item_id', req.params.id);

    await logAdminAction(req.user.id, 'signalement_traite', 'signalements', req.params.id, {
      article_titre: sig?.articles?.titre || null,
      note: note || null,
    });

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/signalements/:id/rejeter - Rejeter le signalement (admin)
router.put('/:id/rejeter', requireAuth, async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Accès refusé' });
    }
    const note = req.body?.note?.trim() || null;

    const { data: sig } = await supabase
      .from('signalements')
      .select('user_id, articles!signalements_article_id_fkey(titre)')
      .eq('id', req.params.id)
      .single();

    const { data, error } = await supabase
      .from('signalements')
      .update({ statut: 'rejete' })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    if (sig?.user_id) {
      const articleTitre = sig.articles?.titre || 'un article';
      await supabase.from('notifications').insert([{
        user_id: sig.user_id,
        type: 'signalement_rejete',
        titre: 'Votre signalement n\'a pas été retenu',
        message: note
          ? `Après examen, votre signalement concernant "${articleTitre}" n'a pas été retenu.\n\nNote de l'administrateur : ${note}`
          : `Après examen, votre signalement concernant "${articleTitre}" n'a pas été retenu.`,
      }]);
    }

    await supabase.from('moderations_claims').delete()
      .eq('table_name', 'signalements').eq('item_id', req.params.id);

    await logAdminAction(req.user.id, 'signalement_rejete', 'signalements', req.params.id, {
      article_titre: sig?.articles?.titre || null,
      note: note || null,
    });

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/signalements/:id - Supprimer (admin)
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Accès refusé' });
    }
    await supabase.from('moderations_claims').delete()
      .eq('table_name', 'signalements').eq('item_id', req.params.id);
    const { error } = await supabase.from('signalements').delete().eq('id', req.params.id);
    if (error) throw error;
    await logAdminAction(req.user.id, 'signalement_supprime', 'signalements', req.params.id, {});
    res.json({ success: true, message: 'Signalement supprimé' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
