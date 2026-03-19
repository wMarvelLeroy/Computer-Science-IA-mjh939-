import express from 'express';
import { supabase } from '../config/supabase.js';
import { requireAuth, isAdmin, isSuperAdmin } from '../middleware/auth.js';
import { logAdminAction } from '../utils/adminLog.js';

const router = express.Router();

// POST /api/restrictions - Créer une restriction (admin ou super_admin)
router.post('/', requireAuth, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, error: 'Accès refusé' });
    const { user_id, motif, details, duree_jours } = req.body;
    if (!user_id || !motif) return res.status(400).json({ success: false, error: 'user_id et motif requis' });

    const expires_at = duree_jours ? new Date(Date.now() + duree_jours * 86400000).toISOString() : null;

    const { data, error } = await supabase
      .from('restrictions')
      .insert([{ user_id, admin_id: req.user.id, motif, details: details || null, expires_at, actif: true }])
      .select().single();
    if (error) throw error;

    // Créer une notification pour l'utilisateur restreint
    const dureeText = duree_jours ? `pour ${duree_jours} jour(s)` : 'pour une durée indéfinie';
    await supabase.from('notifications').insert([{
      user_id,
      type: 'restriction',
      titre: 'Votre compte a été restreint',
      message: `Motif : ${motif}${details ? `\n\nDétails : ${details}` : ''}\n\nDurée : ${dureeText}`
    }]);

    // Récupérer le nom de l'utilisateur pour le journal
    const { data: cible } = await supabase.from('profils').select('nom').eq('id', user_id).single();
    await logAdminAction(req.user.id, 'restriction_imposee', 'restrictions', data.id, {
      user_id,
      user_nom: cible?.nom || null,
      motif,
      duree_jours: duree_jours || null,
    });

    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/restrictions/user/:userId - Restrictions actives d'un utilisateur
router.get('/user/:userId', requireAuth, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, error: 'Accès refusé' });
    const { data, error } = await supabase
      .from('restrictions')
      .select('*')
      .eq('user_id', req.params.userId)
      .eq('actif', true)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/restrictions/:id/lever - Lever une restriction
router.put('/:id/lever', requireAuth, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, error: 'Accès refusé' });
    const { data, error } = await supabase
      .from('restrictions')
      .update({ actif: false })
      .eq('id', req.params.id)
      .select().single();
    if (error) throw error;

    // Notifier l'utilisateur
    await supabase.from('notifications').insert([{
      user_id: data.user_id,
      type: 'restriction_levee',
      titre: 'Votre restriction a été levée',
      message: 'Votre compte a été rétabli et vous pouvez à nouveau accéder à toutes les fonctionnalités.'
    }]);

    // Récupérer le nom de l'utilisateur pour le journal
    const { data: cible } = await supabase.from('profils').select('nom').eq('id', data.user_id).single();
    await logAdminAction(req.user.id, 'restriction_levee', 'restrictions', data.id, {
      user_id: data.user_id,
      user_nom: cible?.nom || null,
      motif: data.motif,
    });

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
