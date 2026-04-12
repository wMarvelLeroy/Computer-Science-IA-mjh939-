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
    const { data: candidates, error } = await supabase
      .from('profils')
      .select('id, nom, avatar_url, bio, role, visible_dans_recherche')
      .in('role', ['auteur', 'admin', 'super_admin'])
      .order('nom');

    if (error) return res.status(500).json({ success: false, error: error.message });

    const filtered = candidates.filter(p => p.visible_dans_recherche !== false);
    if (!filtered || filtered.length === 0) return res.json({ success: true, data: [] });

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

    if (req.user.id !== userId && !isAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Accès refusé' });
    }

    if (['admin', 'super_admin'].includes(updates.role) && !isSuperAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Seul un super administrateur peut attribuer ce rôle' });
    }

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

    if (newRole && newRole !== oldRole) {
      if (newRole === 'auteur') {
        await supabase.from('auteurs').upsert([{ id: userId, est_valide: true, est_banni: false }], { onConflict: 'id' });
        await supabase.from('profils').update({ auteur_id: userId }).eq('id', userId);
        await supabase.from('notifications').insert([{
          user_id: userId, type: 'role_promu',
          titre: 'Vous êtes maintenant Auteur !',
          message: 'Votre statut Auteur a été validé. Vous pouvez désormais créer et publier des articles sur la plateforme.'
        }]);
      }
      if (oldRole === 'auteur' && !['auteur', 'admin', 'super_admin'].includes(newRole)) {
        await supabase.from('auteurs').delete().eq('id', userId);
        await supabase.from('profils').update({ auteur_id: null }).eq('id', userId);
        await supabase.from('notifications').insert([{
          user_id: userId, type: 'role_retire',
          titre: 'Statut Auteur retiré',
          message: 'Votre statut Auteur a été retiré par un administrateur. Vos articles existants sont conservés.'
        }]);
      }
      if (newRole === 'admin') {
        await supabase.from('notifications').insert([{
          user_id: userId, type: 'role_promu',
          titre: 'Vous êtes maintenant Administrateur !',
          message: 'Vous avez été promu au rôle Administrateur de la plateforme ArtInter.'
        }]);
      }
      if (newRole === 'super_admin') {
        await supabase.from('notifications').insert([{
          user_id: userId, type: 'role_promu',
          titre: 'Vous êtes maintenant Super Administrateur !',
          message: 'Vous avez été promu au rôle de Super Administrateur de la plateforme ArtInter.'
        }]);
      }
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
router.delete('/:userId', requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;

    if (!isAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Accès refusé' });
    }
    
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
router.post('/:userId/avatar', requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { avatar_url } = req.body;

    if (req.user.id !== userId && !isAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Accès refusé' });
    }

    if (!avatar_url) {
      return res.status(400).json({ success: false, error: 'avatar_url requis' });
    }
    
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
router.post('/:userId/upload-avatar', requireAuth, upload.single('avatar'), async (req, res) => {
  try {
    const { userId } = req.params;
    const file = req.file;

    if (req.user.id !== userId && !isAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Accès refusé' });
    }
    
    if (!file) {
      return res.status(400).json({ success: false, error: 'Aucun fichier fourni' });
    }
    
    const fileExt = file.originalname.split('.').pop();
    const fileName = `${userId}-${Date.now()}.${fileExt}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: true
      });
    
    if (uploadError) {
      console.error('Erreur upload Supabase:', uploadError);
      return res.status(500).json({ success: false, error: uploadError.message });
    }
    
    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName);

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
    await supabase.from('profils').update({ role: 'lecteur', auteur_id: null }).eq('id', userId);
    await supabase.from('auteurs').delete().eq('id', userId);
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