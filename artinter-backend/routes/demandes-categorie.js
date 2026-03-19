import express from 'express';
import { supabase } from '../config/supabase.js';
import { logAdminAction } from '../utils/adminLog.js';

const router = express.Router();

// GET /api/demandes-categorie - Toutes les demandes (admin)
router.get('/', async (req, res) => {
  try {
    const { statut } = req.query;
    
    let query = supabase
      .from('demandes_categorie')
      .select(`
        *,
        profils(nom, avatar_url)
      `)
      .order('created_at', { ascending: false });
    
    if (statut) {
      query = query.eq('statut', statut);
    }
    
    const { data, error } = await query;
    
    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
    
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/demandes-categorie/user/:userId - Demandes d'un utilisateur
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const { data, error } = await supabase
      .from('demandes_categorie')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
    
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/demandes-categorie/:id - Une demande
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data, error } = await supabase
      .from('demandes_categorie')
      .select(`
        *,
        profils(nom, avatar_url)
      `)
      .eq('id', id)
      .single();
    
    if (error) {
      return res.status(404).json({ success: false, error: 'Demande non trouvée' });
    }
    
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/demandes-categorie - Créer une demande (auteur/admin)
router.post('/', async (req, res) => {
  try {
    const { user_id, nom, slug, description, justification } = req.body;
    
    if (!user_id || !nom || !slug || !justification) {
      return res.status(400).json({
        success: false,
        error: 'user_id, nom, slug et justification requis'
      });
    }
    
    // Vérifier si la catégorie existe déjà
    const { data: existing } = await supabase
      .from('categories')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    
    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'Cette catégorie existe déjà'
      });
    }
    
    // Vérifier si une demande existe déjà pour ce slug
    const { data: existingDemande } = await supabase
      .from('demandes_categorie')
      .select('id')
      .eq('slug', slug)
      .eq('statut', 'en_attente')
      .maybeSingle();
    
    if (existingDemande) {
      return res.status(409).json({
        success: false,
        error: 'Une demande existe déjà pour cette catégorie'
      });
    }
    
    const { data, error } = await supabase
      .from('demandes_categorie')
      .insert([{ user_id, nom, slug, description, justification }])
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

// POST /api/demandes-categorie/:id/approuver - Approuver une demande (admin)
router.post('/:id/approuver', async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data, error } = await supabase.rpc('approuver_demande_categorie', {
      demande_id: id
    });
    
    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
    
    await supabase.from('moderations_claims').delete()
      .eq('table_name', 'demandes_categorie').eq('item_id', id);
    await logAdminAction(null, 'demande_categorie_approuvee', 'demandes_categorie', id, {});
    res.json({ success: true, message: 'Demande approuvée et catégorie créée', data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/demandes-categorie/:id/refuser - Refuser une demande (admin)
router.post('/:id/refuser', async (req, res) => {
  try {
    const { id } = req.params;
    const { raison } = req.body; // Optionnel : raison du refus

    const { data, error } = await supabase.rpc('refuser_demande_categorie', {
      demande_id: id
    });

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    // Optionnel : enregistrer la raison du refus
    if (raison) {
      await supabase
        .from('demandes_categorie')
        .update({ raison_refus: raison })
        .eq('id', id);
    }

    await supabase.from('moderations_claims').delete()
      .eq('table_name', 'demandes_categorie').eq('item_id', id);
    await logAdminAction(null, 'demande_categorie_refusee', 'demandes_categorie', id, {
      raison: raison || null,
    });
    res.json({ success: true, message: 'Demande refusée', data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/demandes-categorie/:id - Supprimer une demande
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const { error } = await supabase
      .from('demandes_categorie')
      .delete()
      .eq('id', id);
    
    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
    
    res.json({ success: true, message: 'Demande supprimée' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;