import express from 'express';
import { supabase } from '../config/supabase.js';
import { requireAuth, isSuperAdmin } from '../middleware/auth.js';

const router = express.Router();

// GET /api/auteurs - Tous les auteurs validés
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('auteurs')
      .select('*')
      .eq('est_valide', true)
      .order('nom');
    
    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
    
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/auteurs/:id - Un auteur
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data, error } = await supabase
      .from('auteurs')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      return res.status(404).json({ success: false, error: 'Auteur non trouvé' });
    }
    
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/auteurs/:id/articles - Articles d'un auteur
router.get('/:id/articles', async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data, error } = await supabase
      .from('articles')
      .select(`
        *,
        categories(nom, slug)
      `)
      .eq('id_auteur', id)
      .eq('est_publie', true)
      .order('date_publication', { ascending: false });
    
    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
    
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/auteurs - Créer un auteur (admin)
router.post('/', async (req, res) => {
  try {
    const { nom, email, bio, avatar_url, est_valide } = req.body;
    
    if (!nom || !email) {
      return res.status(400).json({
        success: false,
        error: 'nom et email requis'
      });
    }
    
    const { data, error } = await supabase
      .from('auteurs')
      .insert([{ nom, email, bio, avatar_url, est_valide: est_valide || false }])
      .select()
      .single();
    
    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
    
    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/auteurs/:id/ban - Bannir/débannir un auteur (super_admin)
router.put('/:id/ban', requireAuth, async (req, res) => {
  try {
    if (!isSuperAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Réservé aux super administrateurs' });
    }
    const { id } = req.params;
    const { est_banni } = req.body;

    const { data, error } = await supabase
      .from('auteurs')
      .update({ est_banni })
      .eq('id', id)
      .select()
      .single();

    if (error) return res.status(500).json({ success: false, error: error.message });

    await supabase.from('notifications').insert([{
      user_id: id,
      type: est_banni ? 'auteur_banni' : 'auteur_debanni',
      titre: est_banni ? 'Compte auteur banni' : 'Bannissement levé',
      message: est_banni
        ? 'Votre compte auteur a été banni par un administrateur. Vous ne pouvez plus publier de nouveaux articles.'
        : 'Votre bannissement a été levé. Vous pouvez à nouveau publier des articles sur la plateforme.'
    }]);

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/auteurs/:id - Modifier un auteur
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const { data, error } = await supabase
      .from('auteurs')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
    
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/auteurs/:id - Supprimer un auteur (admin)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const { error } = await supabase
      .from('auteurs')
      .delete()
      .eq('id', id);
    
    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
    
    res.json({ success: true, message: 'Auteur supprimé' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;