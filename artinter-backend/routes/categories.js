import express from 'express';
import { supabase } from '../config/supabase.js';

const router = express.Router();

// GET /api/categories - Toutes les catégories
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('nom');
    
    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
    
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/categories/:id - Une catégorie
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      return res.status(404).json({ success: false, error: 'Catégorie non trouvée' });
    }
    
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/categories/slug/:slug - Catégorie par slug
router.get('/slug/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('slug', slug)
      .single();
    
    if (error) {
      return res.status(404).json({ success: false, error: 'Catégorie non trouvée' });
    }
    
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/categories - Créer une catégorie
router.post('/', async (req, res) => {
  try {
    const { nom, slug, description } = req.body;
    
    if (!nom || !slug) {
      return res.status(400).json({
        success: false,
        error: 'nom et slug requis'
      });
    }
    
    const { data, error } = await supabase
      .from('categories')
      .insert([{ nom, slug, description }])
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

// PUT /api/categories/:id - Modifier une catégorie
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const { data, error } = await supabase
      .from('categories')
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

// DELETE /api/categories/:id - Supprimer une catégorie
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id);
    
    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
    
    res.json({ success: true, message: 'Catégorie supprimée' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;