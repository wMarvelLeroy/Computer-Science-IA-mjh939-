import express from 'express';
import { supabase } from '../config/supabase.js';

const router = express.Router();

// GET /api/likes/user/:userId - Articles likés par un utilisateur
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { data, error } = await supabase
      .from('likes')
      .select('article_id, created_at, articles(id, titre, slug, images, date_publication, categories(nom, slug), auteurs(profils(nom, avatar_url)))')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;

    const result = (data || [])
      .filter(l => l.articles)
      .map(l => ({
        article_id:  l.article_id,
        liked_at:    l.created_at,
        titre:       l.articles.titre,
        slug:        l.articles.slug,
        image:       Array.isArray(l.articles.images) ? l.articles.images[0] : null,
        date:        l.articles.date_publication,
        categorie:   l.articles.categories?.nom || null,
        cat_slug:    l.articles.categories?.slug || null,
        auteur_nom:  l.articles.auteurs?.profils?.nom || null,
      }));

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/likes/article/:articleId
router.get('/article/:articleId', async (req, res) => {
  try {
    const { articleId } = req.params;
    
    const { data, error } = await supabase
      .from('likes')
      .select(`
        *,
        profils(nom, avatar_url)
      `)
      .eq('article_id', articleId);
    
    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
    
    res.json({ success: true, data, count: data.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/likes
router.post('/', async (req, res) => {
  try {
    const { article_id, user_id } = req.body;
    
    if (!article_id || !user_id) {
      return res.status(400).json({
        success: false,
        error: 'article_id et user_id requis'
      });
    }
    
    const { data, error } = await supabase
      .from('likes')
      .insert([{ article_id, user_id }])
      .select()
      .single();
    
    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({
          success: false,
          error: 'Déjà liké'
        });
      }
      return res.status(500).json({ success: false, error: error.message });
    }
    
    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/likes
router.delete('/', async (req, res) => {
  try {
    const { article_id, user_id } = req.body;
    
    if (!article_id || !user_id) {
      return res.status(400).json({
        success: false,
        error: 'article_id et user_id requis'
      });
    }
    
    const { error } = await supabase
      .from('likes')
      .delete()
      .eq('article_id', article_id)
      .eq('user_id', user_id);
    
    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
    
    res.json({ success: true, message: 'Like retiré' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;