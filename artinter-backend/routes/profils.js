import express from 'express';
import { supabase } from '../config/supabase.js';
import multer from 'multer';
import { requireAuth, isAdmin, isSuperAdmin } from '../middleware/auth.js';

// Configuration multer pour l'upload en mémoire
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 1 * 1024 * 1024, // 1 MB max (sécurité - le frontend compresse à 500KB)
  },
  fileFilter: (req, file, cb) => {
    // Accepter uniquement les images
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Seules les images sont acceptées'));
    }
  }
});

const router = express.Router();

// GET /api/profils - Tous les profils (admin) avec données auteur si applicable
router.get('/', requireAuth, async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Accès refusé' });
    }
    const { data, error } = await supabase
      .from('profils')
      .select('*, auteurs(id, est_banni, est_valide)')
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    // Enrichir chaque profil avec l'email de connexion depuis auth.users
    const enriched = await Promise.all(
      data.map(async (profil) => {
        try {
          const { data: { user } } = await supabase.auth.admin.getUserById(profil.id);
          return { ...profil, email: user?.email || null };
        } catch {
          return { ...profil, email: null };
        }
      })
    );

    res.json({ success: true, data: enriched });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/profils/public/auteurs - Auteurs visibles publiquement (pour le Catalog)
router.get('/public/auteurs', async (req, res) => {
  try {
    // Récupérer tous les non-lecteur qui ne se sont pas explicitement cachés
    const { data: candidates, error } = await supabase
      .from('profils')
      .select('id, nom, avatar_url, bio, role, visible_dans_recherche')
      .in('role', ['auteur', 'admin', 'super_admin'])
      .order('nom');

    if (error) return res.status(500).json({ success: false, error: error.message });

    // Filtrer côté JS si la colonne existe, sinon tout afficher
    const filtered = candidates.filter(p => p.visible_dans_recherche !== false);
    if (!filtered || filtered.length === 0) return res.json({ success: true, data: [] });

    // Compter les articles publiés par candidat
    const candidateIds = filtered.map(p => p.id);
    const { data: articleRows } = await supabase
      .from('articles')
      .select('id_auteur')
      .eq('est_publie', true)
      .in('id_auteur', candidateIds);

    const countMap = {};
    (articleRows || []).forEach(a => {
      countMap[a.id_auteur] = (countMap[a.id_auteur] || 0) + 1;
    });

    const result = filtered
      .filter(p => {
        if (p.role === 'auteur') return (countMap[p.id] || 0) > 0;
        if (['admin', 'super_admin'].includes(p.role)) {
          if (p.visible_dans_recherche === true) return true;
          if (p.visible_dans_recherche === null) return (countMap[p.id] || 0) > 0;
        }
        return false;
      })
      .map(p => ({
        id: p.id,
        nom: p.nom,
        avatar_url: p.avatar_url,
        bio: p.bio,
        role: p.role,
        article_count: countMap[p.id] || 0,
      }));

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/profils/:userId - Un profil
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const { data, error } = await supabase
      .from('profils')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error) {
      return res.status(404).json({ success: false, error: 'Profil non trouvé' });
    }
    
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/profils/:userId - Mettre à jour un profil
router.put('/:userId', requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const updates = req.body;
    // Only super_admin can assign elevated roles
    if (['admin', 'super_admin'].includes(updates.role) && !isSuperAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Seul un super administrateur peut attribuer ce rôle' });
    }

    // Get current profil to detect role change
    const { data: currentProfil } = await supabase.from('profils').select('role').eq('id', userId).single();
    const oldRole = currentProfil?.role;
    const newRole = updates.role;

    const { data, error } = await supabase
      .from('profils')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    // Auto-manage auteurs table and send notifications on role change
    if (newRole && newRole !== oldRole) {
      // Promote to auteur → create auteurs record (auteurs.id = userId)
      if (newRole === 'auteur') {
        await supabase.from('auteurs').upsert([{ id: userId, est_valide: true, est_banni: false }], { onConflict: 'id' });
        await supabase.from('profils').update({ auteur_id: userId }).eq('id', userId);
        await supabase.from('notifications').insert([{
          user_id: userId, type: 'role_promu',
          titre: 'Vous êtes maintenant Auteur !',
          message: 'Votre statut Auteur a été validé. Vous pouvez désormais créer et publier des articles sur la plateforme.'
        }]);
      }
      // Demoted from auteur → remove auteurs record
      if (oldRole === 'auteur' && newRole !== 'auteur') {
        await supabase.from('auteurs').delete().eq('id', userId);
        await supabase.from('profils').update({ auteur_id: null }).eq('id', userId);
        await supabase.from('notifications').insert([{
          user_id: userId, type: 'role_retire',
          titre: 'Statut Auteur retiré',
          message: 'Votre statut Auteur a été retiré par un administrateur. Vos articles existants sont conservés.'
        }]);
      }
      // Promote to admin
      if (newRole === 'admin') {
        await supabase.from('notifications').insert([{
          user_id: userId, type: 'role_promu',
          titre: 'Vous êtes maintenant Administrateur !',
          message: 'Vous avez été promu au rôle Administrateur de la plateforme ArtInter.'
        }]);
      }
      // Promote to super_admin
      if (newRole === 'super_admin') {
        await supabase.from('notifications').insert([{
          user_id: userId, type: 'role_promu',
          titre: 'Vous êtes maintenant Super Administrateur !',
          message: 'Vous avez été promu au rôle de Super Administrateur de la plateforme ArtInter.'
        }]);
      }
      // Demoted from admin/super_admin
      if ((oldRole === 'admin' || oldRole === 'super_admin') && !['admin', 'super_admin'].includes(newRole)) {
        await supabase.from('notifications').insert([{
          user_id: userId, type: 'role_retire',
          titre: 'Rôle administrateur retiré',
          message: 'Votre rôle administrateur a été retiré par un super administrateur.'
        }]);
      }
    }

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/profils/:userId - Supprimer un profil (admin)
router.delete('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const { error } = await supabase
      .from('profils')
      .delete()
      .eq('id', userId);
    
    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
    
    res.json({ success: true, message: 'Profil supprimé' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/profils/:userId/avatar - Upload avatar
router.post('/:userId/avatar', async (req, res) => {
  try {
    const { userId } = req.params;
    const { avatar_url } = req.body; // URL de l'image ou base64
    
    if (!avatar_url) {
      return res.status(400).json({ success: false, error: 'avatar_url requis' });
    }
    
    // Mettre à jour l'avatar_url dans le profil
    const { data, error } = await supabase
      .from('profils')
      .update({ avatar_url })
      .eq('id', userId)
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

// POST /api/profils/:userId/upload-avatar - Upload fichier avatar
router.post('/:userId/upload-avatar', upload.single('avatar'), async (req, res) => {
  try {
    const { userId } = req.params;
    const file = req.file;
    
    if (!file) {
      return res.status(400).json({ success: false, error: 'Aucun fichier fourni' });
    }
    
    //Générer un nom de fichier unique
    const fileExt = file.originalname.split('.').pop();
    const fileName = `${userId}-${Date.now()}.${fileExt}`;
    
    // Upload vers Supabase Storage bucket 'avatars'
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: true // Remplace si existe déjà
      });
    
    if (uploadError) {
      console.error('Erreur upload Supabase:', uploadError);
      return res.status(500).json({ success: false, error: uploadError.message });
    }
    
    // Obtenir l'URL publique
    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName);
    
    // Mettre à jour le profil avec la nouvelle URL
    const { data, error } = await supabase
      .from('profils')
      .update({ avatar_url: publicUrl })
      .eq('id', userId)
      .select()
      .single();
    
    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
    
    res.json({ 
      success: true, 
      data,
      avatar_url: publicUrl 
    });
  } catch (err) {
    console.error('Erreur upload avatar:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/profils/:userId/retirer-auteur - Retirer le statut auteur (super_admin seulement)
router.delete('/:userId/retirer-auteur', requireAuth, async (req, res) => {
  try {
    if (!isSuperAdmin(req)) return res.status(403).json({ success: false, error: 'Réservé aux super administrateurs' });
    const { userId } = req.params;
    // Downgrade role to lecteur + clear auteur_id
    await supabase.from('profils').update({ role: 'lecteur', auteur_id: null }).eq('id', userId);
    // Remove auteurs record (auteurs.id = userId)
    await supabase.from('auteurs').delete().eq('id', userId);
    // Notify user
    await supabase.from('notifications').insert([{
      user_id: userId, type: 'role_retire',
      titre: 'Statut Auteur retiré',
      message: 'Votre statut Auteur a été retiré par un super administrateur. Vos articles existants sont conservés mais ne seront plus modifiables.'
    }]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;