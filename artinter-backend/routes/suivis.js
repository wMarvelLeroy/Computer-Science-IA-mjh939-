import express from 'express';
import { supabase } from '../config/supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// GET /api/suivis/followers/:userId - Abonnés d'un utilisateur
router.get('/followers/:userId', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('suivis')
      .select('follower_id, created_at, profils!suivis_follower_id_fkey(id, nom, avatar_url, role)')
      .eq('suivi_id', req.params.userId)
      .order('created_at', { ascending: false });
    if (error) throw error;

    const result = (data || []).map(s => ({
      id:         s.profils?.id,
      nom:        s.profils?.nom,
      avatar_url: s.profils?.avatar_url,
      role:       s.profils?.role,
      since:      s.created_at,
    }));

    res.json({ success: true, data: result, count: result.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/suivis/following/:userId - Personnes suivies par un utilisateur
router.get('/following/:userId', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('suivis')
      .select('suivi_id, created_at, profils!suivis_suivi_id_fkey(id, nom, avatar_url, role)')
      .eq('follower_id', req.params.userId)
      .order('created_at', { ascending: false });
    if (error) throw error;

    const result = (data || []).map(s => ({
      id:         s.profils?.id,
      nom:        s.profils?.nom,
      avatar_url: s.profils?.avatar_url,
      role:       s.profils?.role,
      since:      s.created_at,
    }));

    res.json({ success: true, data: result, count: result.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/suivis/check?follower_id=&suivi_id= - Vérifier si on suit quelqu'un
router.get('/check', async (req, res) => {
  try {
    const { follower_id, suivi_id } = req.query;
    if (!follower_id || !suivi_id) return res.json({ success: true, data: { isFollowing: false } });

    const { data, error } = await supabase
      .from('suivis')
      .select('follower_id')
      .eq('follower_id', follower_id)
      .eq('suivi_id', suivi_id)
      .maybeSingle();
    if (error) throw error;

    res.json({ success: true, data: { isFollowing: !!data } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/suivis - Suivre un utilisateur
router.post('/', requireAuth, async (req, res) => {
  try {
    const { suivi_id } = req.body;
    const follower_id  = req.user.id;

    if (!suivi_id) return res.status(400).json({ success: false, error: 'suivi_id requis' });
    if (follower_id === suivi_id) return res.status(400).json({ success: false, error: 'Vous ne pouvez pas vous suivre vous-même' });

    const { data, error } = await supabase
      .from('suivis')
      .insert([{ follower_id, suivi_id }])
      .select().single();

    if (error) {
      if (error.code === '23505') return res.status(409).json({ success: false, error: 'Déjà suivi' });
      throw error;
    }

    // Notifier la personne suivie
    const { data: followerProfil } = await supabase.from('profils').select('nom').eq('id', follower_id).single();
    await supabase.from('notifications').insert([{
      user_id: suivi_id,
      type:    'nouvel_abonne',
      titre:   'Nouvel abonné',
      message: `${followerProfil?.nom || 'Quelqu\'un'} a commencé à vous suivre.`,
    }]);

    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/suivis - Ne plus suivre un utilisateur
router.delete('/', requireAuth, async (req, res) => {
  try {
    const { suivi_id } = req.body;
    const follower_id  = req.user.id;

    if (!suivi_id) return res.status(400).json({ success: false, error: 'suivi_id requis' });

    const { error } = await supabase
      .from('suivis')
      .delete()
      .eq('follower_id', follower_id)
      .eq('suivi_id', suivi_id);
    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
