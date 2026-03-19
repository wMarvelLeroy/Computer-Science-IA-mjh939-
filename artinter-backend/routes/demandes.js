import express from 'express';
import { supabase } from '../config/supabase.js';
import { logAdminAction } from '../utils/adminLog.js';

const router = express.Router();

// GET /api/demandes-auteur - Toutes les demandes (admin)
router.get('/', async (req, res) => {
  try {
    const { statut } = req.query;
    
    let query = supabase
      .from('demandes_auteur')
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

// GET /api/demandes-auteur/user/:userId - Demande d'un utilisateur
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const { data, error } = await supabase
      .from('demandes_auteur')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    
    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
    
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/demandes-auteur/:id - Une demande
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data, error } = await supabase
      .from('demandes_auteur')
      .select(`
        *,
        profils(nom, avatar_url, bio)
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

// POST /api/demandes-auteur - Créer ou renouveler une demande
router.post('/', async (req, res) => {
  try {
    const { user_id, motivation } = req.body;
    
    if (!user_id || !motivation) {
      return res.status(400).json({
        success: false,
        error: 'user_id et motivation requis'
      });
    }
    
    // Vérifier si une demande existe déjà
    const { data: existing } = await supabase
      .from('demandes_auteur')
      .select('id, statut')
      .eq('user_id', user_id)
      .maybeSingle();
    
    if (existing) {
      // Si une demande est déjà en attente, on bloque
      if (existing.statut === 'en_attente') {
        return res.status(409).json({
          success: false,
          error: 'Une demande est déjà en cours de traitement'
        });
      }
      
      // Si la demande existe mais n'est pas en attente (refusée ou approuvée mais utilisateur rétrogradé)
      // On met à jour la demande existante pour la remettre en attente
      const { data, error } = await supabase
        .from('demandes_auteur')
        .update({ 
          motivation, 
          statut: 'en_attente',
          created_at: new Date().toISOString(), // Mise à jour de la date
          raison_refus: null // Effacer l'ancienne raison de refus
        })
        .eq('id', existing.id)
        .select()
        .single();
        
      if (error) {
        return res.status(500).json({ success: false, error: error.message });
      }
      
      return res.status(200).json({ success: true, message: 'Demande mise à jour', data });
    }
    
    // Sinon, on crée une nouvelle demande
    const { data, error } = await supabase
      .from('demandes_auteur')
      .insert([{ user_id, motivation }])
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

// POST /api/demandes-auteur/:id/approuver - Approuver une demande (admin)
router.post('/:id/approuver', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 1. Get the demande first
    const { data: demande, error: fetchError } = await supabase
      .from('demandes_auteur')
      .select('*')
      .eq('id', id)
      .single();
    
    if (fetchError || !demande) {
      return res.status(404).json({ success: false, error: 'Demande non trouvée' });
    }
    
    // 2. Update demande status
    const { error: updateError } = await supabase
      .from('demandes_auteur')
      .update({ statut: 'approuvee' })
      .eq('id', id);
    
    if (updateError) {
      console.error('Erreur update demande:', updateError);
      return res.status(500).json({ success: false, error: updateError.message });
    }
    
    // 3. Create entry in auteurs table (new schema: only author-specific data)
    const { data: auteurData, error: auteurError } = await supabase
      .from('auteurs')
      .upsert([{
        id: demande.user_id,
        est_valide: true
      }], { onConflict: 'id' })
      .select()
      .single();
    
    if (auteurError) {
      console.error('Erreur création auteur:', auteurError);
      return res.status(500).json({ success: false, error: auteurError.message });
    }
    
    // 4. Update profils: set role='auteur' and link to auteur_id
    const { error: roleError } = await supabase
      .from('profils')
      .update({
        role: 'auteur',
        auteur_id: auteurData.id
      })
      .eq('id', demande.user_id);

    if (roleError) {
      console.error('Erreur update profil:', roleError);
      // Don't fail completely
    }

    // 5. Notify user
    await supabase.from('notifications').insert([{
      user_id: demande.user_id,
      type: 'demande_approuvee',
      titre: 'Demande auteur approuvée !',
      message: 'Félicitations ! Votre demande pour devenir auteur a été approuvée. Vous pouvez désormais créer et publier des articles sur la plateforme.'
    }]);

    // 6. Libérer la prise en charge
    await supabase.from('moderations_claims').delete()
      .eq('table_name', 'demandes_auteur').eq('item_id', id);

    await logAdminAction(null, 'demande_auteur_approuvee', 'demandes_auteur', id, {
      user_id: demande.user_id,
    });

    res.json({ success: true, message: 'Demande approuvée' });
  } catch (err) {
    console.error('Erreur approuver:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/demandes-auteur/:id/refuser - Refuser une demande (admin)
router.post('/:id/refuser', async (req, res) => {
  try {
    const { id } = req.params;
    const { raison } = req.body;
    
    const { data, error } = await supabase
      .from('demandes_auteur')
      .update({ 
        statut: 'refusee',
        raison_refus: raison || null
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('Erreur refuser:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
    
    // Notify user
    await supabase.from('notifications').insert([{
      user_id: data.user_id,
      type: 'demande_refusee',
      titre: 'Demande auteur refusée',
      message: `Votre demande pour devenir auteur a été refusée.${raison ? `\n\nMotif : ${raison}` : ''}\n\nVous pouvez soumettre une nouvelle demande ultérieurement.`
    }]);

    await supabase.from('moderations_claims').delete()
      .eq('table_name', 'demandes_auteur').eq('item_id', id);

    await logAdminAction(null, 'demande_auteur_refusee', 'demandes_auteur', id, {
      user_id: data.user_id,
      raison: raison || null,
    });

    res.json({ success: true, message: 'Demande refusée', data });
  } catch (err) {
    console.error('Erreur refuser:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/demandes-auteur/:id - Supprimer une demande
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const { error } = await supabase
      .from('demandes_auteur')
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