import express from 'express';
import { supabase } from '../config/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { logAdminAction } from '../utils/adminLog.js';

const router = express.Router();

const SPAM_LIMIT      = 10;  // max commentaires par fenêtre
const SPAM_WINDOW_MIN = 60;  // fenêtre en minutes

// Helper : enrichir une liste de commentaires avec les profils
async function attachProfils(comments) {
  if (!comments || comments.length === 0) return comments;
  const userIds = [...new Set(comments.map(c => c.user_id))];
  const { data: profils } = await supabase
    .from('profils')
    .select('id, nom, avatar_url, couleur_avatar')
    .in('id', userIds);
  const profilMap = Object.fromEntries((profils || []).map(p => [p.id, p]));
  return comments.map(c => ({ ...c, profils: profilMap[c.user_id] || null }));
}

// ─────────────────────────────────────────
// GET /api/commentaires/article/:articleId
// ─────────────────────────────────────────
router.get('/article/:articleId', async (req, res) => {
  try {
    const { articleId } = req.params;

    const { data, error } = await supabase
      .from('commentaires')
      .select('*')
      .eq('article_id', articleId)
      .order('created_at', { ascending: true });

    if (error) return res.status(500).json({ success: false, error: error.message });

    const enriched = await attachProfils(data);
    res.json({ success: true, data: enriched });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────
// POST /api/commentaires
// ─────────────────────────────────────────
router.post('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { article_id, contenu, parent_id } = req.body;

    if (!article_id || !contenu?.trim()) {
      return res.status(400).json({ success: false, error: 'article_id et contenu requis' });
    }

    // Vérifier que le compte peut commenter (restriction globale)
    const { data: profil } = await supabase
      .from('profils')
      .select('peut_commenter')
      .eq('id', userId)
      .single();

    if (profil && profil.peut_commenter === false) {
      return res.status(403).json({ success: false, error: 'Votre compte ne peut plus publier de commentaires.' });
    }

    // Vérifier restriction sur cet article spécifiquement
    const { data: articleBans } = await supabase
      .from('restrictions')
      .select('details')
      .eq('user_id', userId)
      .eq('motif', 'commentaire_article')
      .eq('actif', true);

    const isBannedForArticle = (articleBans || []).some(b => {
      try {
        const d = typeof b.details === 'string' ? JSON.parse(b.details) : b.details;
        return d?.article_id === article_id;
      } catch { return false; }
    });

    if (isBannedForArticle) {
      return res.status(403).json({ success: false, error: 'Vous êtes restreint de commenter sur cet article.' });
    }

    // Anti-spam : max SPAM_LIMIT commentaires par SPAM_WINDOW_MIN minutes
    const windowStart = new Date(Date.now() - SPAM_WINDOW_MIN * 60 * 1000).toISOString();
    const { count } = await supabase
      .from('commentaires')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', windowStart);

    if (count >= SPAM_LIMIT) {
      return res.status(429).json({
        success: false,
        error: `Vous avez atteint la limite de ${SPAM_LIMIT} commentaires par heure.`
      });
    }

    // Vérifier le parent si c'est une réponse
    if (parent_id) {
      const { data: parent } = await supabase
        .from('commentaires')
        .select('id, article_id, parent_id')
        .eq('id', parent_id)
        .single();

      if (!parent || parent.article_id !== article_id) {
        return res.status(400).json({ success: false, error: 'Commentaire parent invalide.' });
      }
      if (parent.parent_id) {
        return res.status(400).json({ success: false, error: 'Les réponses imbriquées ne sont pas supportées.' });
      }
    }

    const { data, error } = await supabase
      .from('commentaires')
      .insert([{ article_id, user_id: userId, contenu: contenu.trim(), parent_id: parent_id || null }])
      .select('*')
      .single();

    if (error) return res.status(500).json({ success: false, error: error.message });

    const [enriched] = await attachProfils([data]);
    res.status(201).json({ success: true, data: enriched });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────
// PUT /api/commentaires/:id
// Seul le propriétaire peut modifier
// ─────────────────────────────────────────
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { contenu } = req.body;
    const userId = req.user.id;

    if (!contenu?.trim()) {
      return res.status(400).json({ success: false, error: 'Contenu requis' });
    }

    const { data: existing } = await supabase
      .from('commentaires')
      .select('user_id')
      .eq('id', id)
      .single();

    if (!existing) return res.status(404).json({ success: false, error: 'Commentaire introuvable' });
    if (existing.user_id !== userId) return res.status(403).json({ success: false, error: 'Non autorisé' });

    const { data, error } = await supabase
      .from('commentaires')
      .update({ contenu: contenu.trim(), modifie: true })
      .eq('id', id)
      .select('*')
      .single();

    if (error) return res.status(500).json({ success: false, error: error.message });

    const [enriched] = await attachProfils([data]);
    res.json({ success: true, data: enriched });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────
// DELETE /api/commentaires/:id
// Propriétaire OU admin/super_admin uniquement
// ─────────────────────────────────────────
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const role   = req.profil?.role;

    const { data: comment } = await supabase
      .from('commentaires')
      .select('user_id')
      .eq('id', id)
      .single();

    if (!comment) return res.status(404).json({ success: false, error: 'Commentaire introuvable' });

    const isOwner = comment.user_id === userId;
    const isMod   = ['admin', 'super_admin'].includes(role);

    if (!isOwner && !isMod) {
      return res.status(403).json({ success: false, error: 'Non autorisé' });
    }

    const { error } = await supabase
      .from('commentaires')
      .delete()
      .eq('id', id);

    if (error) return res.status(500).json({ success: false, error: error.message });

    res.json({ success: true, message: 'Commentaire supprimé' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────
// POST /api/commentaires/:id/moderer
// Admin/super_admin uniquement — actions : supprimer | restreindre | restreindre_user_article
// ─────────────────────────────────────────
router.post('/:id/moderer', requireAuth, async (req, res) => {
  const role = req.profil?.role;
  if (!['admin', 'super_admin'].includes(role)) {
    return res.status(403).json({ success: false, error: 'Accès réservé aux administrateurs' });
  }

  try {
    const { id } = req.params;
    const { action, motif } = req.body;

    if (!['supprimer', 'restreindre', 'restreindre_user_article'].includes(action)) {
      return res.status(400).json({ success: false, error: 'Action invalide. Valeurs acceptées : supprimer, restreindre, restreindre_user_article' });
    }

    const { data: comment } = await supabase
      .from('commentaires')
      .select('id, user_id, article_id, contenu')
      .eq('id', id)
      .single();

    if (!comment) return res.status(404).json({ success: false, error: 'Commentaire introuvable' });

    // ── Supprimer le commentaire ──
    if (action === 'supprimer') {
      const { error } = await supabase.from('commentaires').delete().eq('id', id);
      if (error) return res.status(500).json({ success: false, error: error.message });

      await logAdminAction(req.user.id, 'supprimer_commentaire', 'commentaires', id, {
        article_id: comment.article_id,
        user_id: comment.user_id,
        motif: motif || null,
      });

      return res.json({ success: true, action, message: 'Commentaire supprimé' });
    }

    // ── Restreindre le commentaire (masquer) ──
    if (action === 'restreindre') {
      const { error } = await supabase
        .from('commentaires')
        .update({ restreint: true })
        .eq('id', id);

      if (error) return res.status(500).json({ success: false, error: error.message });

      await logAdminAction(req.user.id, 'restreindre_commentaire', 'commentaires', id, {
        article_id: comment.article_id,
        user_id: comment.user_id,
        motif: motif || null,
      });

      return res.json({ success: true, action, message: 'Commentaire restreint' });
    }

    // ── Restreindre l'utilisateur sur cet article ──
    if (action === 'restreindre_user_article') {
      const { data: article } = await supabase
        .from('articles')
        .select('titre')
        .eq('id', comment.article_id)
        .single();

      const details = JSON.stringify({
        article_id: comment.article_id,
        article_titre: article?.titre || null,
        raison: motif || null,
      });

      const { data: restriction, error } = await supabase
        .from('restrictions')
        .insert([{
          user_id: comment.user_id,
          admin_id: req.user.id,
          motif: 'commentaire_article',
          details,
          actif: true,
        }])
        .select()
        .single();

      if (error) return res.status(500).json({ success: false, error: error.message });

      // Notifier l'utilisateur
      await supabase.from('notifications').insert([{
        user_id: comment.user_id,
        type: 'restriction',
        titre: 'Restriction de commentaires',
        message: `Vous avez été restreint de commenter sur l'article "${article?.titre || 'cet article'}"${motif ? `\n\nMotif : ${motif}` : ''}.`,
      }]);

      await logAdminAction(req.user.id, 'restreindre_user_article_commentaires', 'restrictions', restriction.id, {
        user_id: comment.user_id,
        article_id: comment.article_id,
        commentaire_id: id,
        motif: motif || null,
      });

      return res.json({ success: true, action, message: 'Utilisateur restreint pour cet article' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────
// POST /api/commentaires/:id/signaler
// Tout membre connecté peut signaler
// ─────────────────────────────────────────
router.post('/:id/signaler', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { raison } = req.body;

    const { data: comment } = await supabase
      .from('commentaires')
      .select('id, user_id')
      .eq('id', id)
      .single();

    if (!comment) return res.status(404).json({ success: false, error: 'Commentaire introuvable' });
    if (comment.user_id === userId) {
      return res.status(400).json({ success: false, error: 'Vous ne pouvez pas signaler votre propre commentaire' });
    }

    // Vérifier si déjà signalé par cet utilisateur
    const { data: existing } = await supabase
      .from('signalements_commentaires')
      .select('id')
      .eq('commentaire_id', id)
      .eq('user_id', userId)
      .single();

    if (existing) {
      return res.status(409).json({ success: false, error: 'Vous avez déjà signalé ce commentaire' });
    }

    const { error } = await supabase
      .from('signalements_commentaires')
      .insert([{
        commentaire_id: id,
        user_id: userId,
        raison: raison || 'contenu_inapproprie',
      }]);

    if (error) return res.status(500).json({ success: false, error: error.message });

    res.status(201).json({ success: true, message: 'Commentaire signalé' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────
// GET /api/commentaires/signalements
// Admin uniquement — liste tous les signalements de commentaires
// ─────────────────────────────────────────
router.get('/signalements', requireAuth, async (req, res) => {
  const role = req.profil?.role;
  if (!['admin', 'super_admin'].includes(role)) {
    return res.status(403).json({ success: false, error: 'Accès refusé' });
  }
  try {
    const { statut } = req.query;
    let query = supabase
      .from('signalements_commentaires')
      .select('*')
      .order('created_at', { ascending: false });
    if (statut) query = query.eq('statut', statut);

    const { data: sigs, error } = await query;
    if (error) throw error;
    if (!sigs || sigs.length === 0) return res.json({ success: true, data: [] });

    // Enrichir profils (signalants)
    const userIds = [...new Set(sigs.map(s => s.user_id).filter(Boolean))];
    const { data: profils } = await supabase.from('profils').select('id, nom, avatar_url').in('id', userIds);
    const profilMap = Object.fromEntries((profils || []).map(p => [p.id, p]));

    // Enrichir commentaires
    const commentIds = [...new Set(sigs.map(s => s.commentaire_id).filter(Boolean))];
    const { data: comms } = await supabase.from('commentaires').select('id, contenu, user_id, article_id').in('id', commentIds);
    const commMap = Object.fromEntries((comms || []).map(c => [c.id, c]));

    // Enrichir auteurs des commentaires
    const commUserIds = [...new Set((comms || []).map(c => c.user_id).filter(Boolean))];
    const { data: commAuteurs } = commUserIds.length > 0
      ? await supabase.from('profils').select('id, nom').in('id', commUserIds)
      : { data: [] };
    const commAuteurMap = Object.fromEntries((commAuteurs || []).map(p => [p.id, p]));

    // Enrichir articles
    const articleIds = [...new Set((comms || []).map(c => c.article_id).filter(Boolean))];
    const { data: articles } = articleIds.length > 0
      ? await supabase.from('articles').select('id, titre, slug').in('id', articleIds)
      : { data: [] };
    const articleMap = Object.fromEntries((articles || []).map(a => [a.id, a]));

    const enriched = sigs.map(s => {
      const comm = commMap[s.commentaire_id] || null;
      return {
        ...s,
        profils: profilMap[s.user_id] || null,
        commentaires: comm ? {
          ...comm,
          auteur: commAuteurMap[comm.user_id] || null,
          articles: articleMap[comm.article_id] || null,
        } : null,
      };
    });

    res.json({ success: true, data: enriched });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────
// PUT /api/commentaires/signalements/:id/traiter
// ─────────────────────────────────────────
router.put('/signalements/:id/traiter', requireAuth, async (req, res) => {
  const role = req.profil?.role;
  if (!['admin', 'super_admin'].includes(role)) {
    return res.status(403).json({ success: false, error: 'Accès refusé' });
  }
  try {
    const note = req.body?.note?.trim() || null;
    const { data: sig } = await supabase
      .from('signalements_commentaires')
      .select('user_id, commentaire_id')
      .eq('id', req.params.id)
      .single();

    const { data, error } = await supabase
      .from('signalements_commentaires')
      .update({ statut: 'traite' })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;

    if (sig?.user_id) {
      await supabase.from('notifications').insert([{
        user_id: sig.user_id,
        type: 'signalement_traite',
        titre: 'Votre signalement a été traité',
        message: note
          ? `Votre signalement de commentaire a été examiné et pris en compte.\n\nNote : ${note}`
          : 'Votre signalement de commentaire a été examiné et pris en compte.',
      }]);
    }

    await logAdminAction(req.user.id, 'signalement_commentaire_traite', 'signalements_commentaires', req.params.id, {
      commentaire_id: sig?.commentaire_id,
      note: note || null,
    });

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────
// PUT /api/commentaires/signalements/:id/rejeter
// ─────────────────────────────────────────
router.put('/signalements/:id/rejeter', requireAuth, async (req, res) => {
  const role = req.profil?.role;
  if (!['admin', 'super_admin'].includes(role)) {
    return res.status(403).json({ success: false, error: 'Accès refusé' });
  }
  try {
    const note = req.body?.note?.trim() || null;
    const { data: sig } = await supabase
      .from('signalements_commentaires')
      .select('user_id')
      .eq('id', req.params.id)
      .single();

    const { data, error } = await supabase
      .from('signalements_commentaires')
      .update({ statut: 'rejete' })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;

    if (sig?.user_id) {
      await supabase.from('notifications').insert([{
        user_id: sig.user_id,
        type: 'signalement_rejete',
        titre: 'Votre signalement n\'a pas été retenu',
        message: note
          ? `Après examen, votre signalement de commentaire n'a pas été retenu.\n\nNote : ${note}`
          : 'Après examen, votre signalement de commentaire n\'a pas été retenu.',
      }]);
    }

    await logAdminAction(req.user.id, 'signalement_commentaire_rejete', 'signalements_commentaires', req.params.id, { note: note || null });

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────
// DELETE /api/commentaires/signalements/:id
// ─────────────────────────────────────────
router.delete('/signalements/:id', requireAuth, async (req, res) => {
  const role = req.profil?.role;
  if (!['admin', 'super_admin'].includes(role)) {
    return res.status(403).json({ success: false, error: 'Accès refusé' });
  }
  try {
    const { error } = await supabase.from('signalements_commentaires').delete().eq('id', req.params.id);
    if (error) throw error;
    await logAdminAction(req.user.id, 'signalement_commentaire_supprime', 'signalements_commentaires', req.params.id, {});
    res.json({ success: true, message: 'Signalement supprimé' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────
// PATCH /api/commentaires/restrict/:userId
// Admin uniquement — restreindre globalement les commentaires
// ─────────────────────────────────────────
router.patch('/restrict/:userId', requireAuth, async (req, res) => {
  if (!['admin', 'super_admin'].includes(req.profil?.role)) {
    return res.status(403).json({ success: false, error: 'Accès réservé aux administrateurs' });
  }
  try {
    const { userId } = req.params;
    const { peut_commenter } = req.body;

    if (typeof peut_commenter !== 'boolean') {
      return res.status(400).json({ success: false, error: 'peut_commenter (boolean) requis' });
    }

    const { data, error } = await supabase
      .from('profils')
      .update({ peut_commenter })
      .eq('id', userId)
      .select('id, nom, peut_commenter')
      .single();

    if (error) return res.status(500).json({ success: false, error: error.message });

    await logAdminAction(req.user.id, peut_commenter ? 'autoriser_commentaires' : 'restreindre_commentaires_global', 'profils', userId, {
      user_nom: data.nom,
      peut_commenter,
    });

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
