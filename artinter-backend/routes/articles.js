import express from 'express';
import { supabase } from '../config/supabase.js';
import multer from 'multer';
import { requireAuth, isAdmin, isSuperAdmin } from '../middleware/auth.js';

async function notifyFollowers(authorId, articleTitre, articleSlug) {
  try {
    const { data: auteur } = await supabase
      .from('profils')
      .select('nom')
      .eq('id', authorId)
      .single();

    const nomAuteur = auteur?.nom || 'Un auteur';

    const { data: suivis } = await supabase
      .from('suivis')
      .select('follower_id')
      .eq('suivi_id', authorId);

    if (!suivis || suivis.length === 0) return;

    const notifications = suivis.map(s => ({
      user_id: s.follower_id,
      type:    'nouvel_article',
      titre:   `Nouvel article de ${nomAuteur}`,
      message: `${nomAuteur} vient de publier un nouvel article : "${articleTitre}"`,
      lien:    `/article/${articleSlug}`,
    }));

    await supabase.from('notifications').insert(notifications);
  } catch (err) {
    // Ne pas bloquer la publication si les notifs échouent
    console.error('Erreur notifyFollowers:', err.message);
  }
}

// Configuration multer pour l'upload en mémoire
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB max
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

// GET /api/articles - Articles PUBLIÉS uniquement (Public)
router.get('/', async (req, res) => {
  try {
    const { categorie, limit = 50 } = req.query;

    let query = supabase
      .from('articles')
      .select(`
        *,
        auteurs(
          id,
          profils(nom, email_public, avatar_url)
        ),
        categories(id, nom, slug)
      `)
      .eq('est_publie', true)
      .order('date_publication', { ascending: false })
      .limit(limit);

    if (categorie) {
      query = query.eq('categorie', categorie);
    }

    const { data, error } = await query;

    if (error) throw error;

    const formattedData = data.map(article => {
      const auteur = article.auteurs;
      const rawProfil = auteur?.profils;
      const profil = Array.isArray(rawProfil) ? rawProfil[0] : rawProfil;
      
      return {
        ...article,
        auteurs: auteur ? {
          id: auteur.id,
          nom: profil?.nom || 'Auteur inconnu',
          email: profil?.email_public,
          avatar_url: profil?.avatar_url
        } : null
      };
    });

    res.json({ success: true, data: formattedData });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/articles/brouillons - MES Brouillons (Auth requise)
router.get('/brouillons', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // VISIBLE UNIQUEMENT PAR L'AUTEUR PROPRIÉTAIRE
    let query = supabase
      .from('articles')
      .select(`
        *,
        categories(id, nom, slug)
      `)
      .eq('est_publie', false)
      .eq('id_auteur', userId)
      .order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) throw error;

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Récupère l'utilisateur depuis un token optionnel (pas d'erreur si absent)
const getOptionalUser = async (req) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;
  const { data: { user } } = await supabase.auth.getUser(token);
  return user;
};

// GET /api/articles/admin/all - TOUS les articles (admin uniquement)
router.get('/admin/all', requireAuth, async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Accès refusé' });
    }
    const { statut, categorie, limit = 200 } = req.query;

    let query = supabase
      .from('articles')
      .select(`
        *,
        auteurs(id, est_banni, profils(nom, avatar_url)),
        categories(id, nom, slug)
      `)
      .eq('est_publie', true)
      .order('created_at', { ascending: false })
      .limit(Number(limit));

    if (categorie) query = query.eq('categorie', categorie);

    const { data, error } = await query;
    if (error) throw error;

    const formattedData = data.map(article => {
      const auteur = article.auteurs;
      const rawProfil = auteur?.profils;
      const profil = Array.isArray(rawProfil) ? rawProfil[0] : rawProfil;
      return {
        ...article,
        auteurs: auteur ? {
          id: auteur.id,
          est_banni: auteur.est_banni,
          nom: profil?.nom || 'Auteur inconnu',
          avatar_url: profil?.avatar_url
        } : null
      };
    });

    res.json({ success: true, data: formattedData });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/articles/admin/:id/restreindre - Dépublier un article (super_admin)
router.put('/admin/:id/restreindre', requireAuth, async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Accès refusé' });
    }
    const { data: article } = await supabase
      .from('articles').select('titre, id_auteur').eq('id', req.params.id).single();
    const { data, error } = await supabase
      .from('articles')
      .update({ est_publie: false })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    if (article?.id_auteur) {
      await supabase.from('notifications').insert([{
        user_id: article.id_auteur,
        type: 'article_restreint',
        titre: 'Article dépublié',
        message: `Votre article "${article.titre}" a été dépublié par un administrateur. Contactez le support pour plus d'informations.`
      }]);
    }
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/articles/admin/:id/republier - Republier un article dépublié (admin)
router.put('/admin/:id/republier', requireAuth, async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Accès refusé' });
    }
    const { data, error } = await supabase
      .from('articles')
      .update({ est_publie: true, date_publication: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;

    // Appel sans await : les notifications ne doivent pas bloquer la réponse à l'auteur
    notifyFollowers(data.id_auteur, data.titre, data.slug);

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/articles/admin/:id - Supprimer n'importe quel article (super_admin)
router.delete('/admin/:id', requireAuth, async (req, res) => {
  try {
    if (!isSuperAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Accès refusé' });
    }
    const { id } = req.params;
    const { data: article } = await supabase
      .from('articles').select('titre, id_auteur').eq('id', id).single();
    const { error } = await supabase.from('articles').delete().eq('id', id);
    if (error) throw error;
    if (article?.id_auteur) {
      await supabase.from('notifications').insert([{
        user_id: article.id_auteur,
        type: 'article_supprime',
        titre: 'Article supprimé',
        message: `Votre article "${article.titre}" a été supprimé par un administrateur.`
      }]);
    }
    res.json({ success: true, message: 'Article supprimé' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/articles/slug/:slug - Public (Publié uniquement)
router.get('/slug/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const user = await getOptionalUser(req);

    const { data, error } = await supabase
      .from('articles')
      .select(`
        *,
        auteurs(
          id,
          profils(nom, email_public, avatar_url, bio)
        ),
        categories(id, nom, slug)
      `)
      .eq('slug', slug)
      .single();

    if (error) return res.status(404).json({ success: false, error: 'Article non trouvé' });

    const isAuteur = user && user.id === data.id_auteur;

    if (!data.est_publie && !isAuteur) {
        return res.status(404).json({ success: false, error: 'Article non trouvé ou non publié' });
    }

    if (!isAuteur && req.query.record_view === '1') {
        await supabase.rpc('increment_vues', { article_id: data.id });
    }

    const auteur = data.auteurs;
    const rawProfil = auteur?.profils;
    const profil = Array.isArray(rawProfil) ? rawProfil[0] : rawProfil;

    const formattedData = {
      ...data,
      auteurs: auteur ? {
        id: auteur.id,
        nom: profil?.nom || 'Auteur inconnu',
        email: profil?.email_public,
        avatar_url: profil?.avatar_url,
        bio: profil?.bio
      } : null
    };

    res.json({ success: true, data: formattedData });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/articles/:id - Public
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const user = await getOptionalUser(req);

    const { data, error } = await supabase
      .from('articles')
      .select(`
        *,
        auteurs(
          id,
          profils(nom, email_public, avatar_url, bio)
        ),
        categories(id, nom, slug)
      `)
      .eq('id', id)
      .single();

    if (error) return res.status(404).json({ success: false, error: 'Article non trouvé' });

    const isAuteur = user && user.id === data.id_auteur;

    if (!data.est_publie && !isAuteur) {
        return res.status(404).json({ success: false, error: 'Article non trouvé ou non publié' });
    }

    if (!isAuteur && req.query.record_view === '1') {
        await supabase.rpc('increment_vues', { article_id: id });
    }

    const auteur = data.auteurs;
    const rawProfil = auteur?.profils;
    const profil = Array.isArray(rawProfil) ? rawProfil[0] : rawProfil;
    
    const formattedData = {
      ...data,
      auteurs: auteur ? {
        id: auteur.id,
        nom: profil?.nom || 'Auteur inconnu',
        email: profil?.email_public,
        avatar_url: profil?.avatar_url,
        bio: profil?.bio
      } : null
    };

    res.json({ success: true, data: formattedData });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/articles/auteur/:auteurId - Public (Publiés uniquement)
router.get('/auteur/:auteurId', async (req, res) => {
  try {
    const { auteurId } = req.params;
    const user = await getOptionalUser(req);
    const isOwnProfile = user && user.id === auteurId;

    let query = supabase
      .from('articles')
      .select(`*, categories(id, nom, slug)`)
      .eq('id_auteur', auteurId)
      .order('created_at', { ascending: false });

    if (!isOwnProfile) {
         query = query.eq('est_publie', true);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/articles - Créer (Auth requise)
router.post('/', requireAuth, async (req, res) => {
  try {
    const {
      slug, titre, contenu_html, contenu_json,
      images, categorie, temps_lecture, tags, est_publie
    } = req.body;
    
    const userId = req.user.id;
    const role   = req.profil?.role;

    if (role !== 'auteur' && role !== 'admin' && role !== 'super_admin') {
      return res.status(403).json({ success: false, error: 'Non autorisé' });
    }

    if (!titre || !titre.trim()) return res.status(400).json({ success: false, error: 'Titre requis' });

    // S'assurer que l'utilisateur a bien une entrée dans auteurs (nécessaire pour la FK)
    let id_auteur = req.profil?.auteur_id || userId;
    if (!req.profil?.auteur_id) {
      await supabase.from('auteurs').upsert([{ id: userId, est_valide: true }], { onConflict: 'id' });
      await supabase.from('profils').update({ auteur_id: userId }).eq('id', userId);
      id_auteur = userId;
    }

    let finalSlug = slug;
    if (!finalSlug && titre) {
      const { generateSlug } = await import('../utils/slugGenerator.js');
      finalSlug = generateSlug(titre);
      const { data: existing } = await supabase.from('articles').select('slug').eq('slug', finalSlug).single();
      if (existing) finalSlug = `${finalSlug}-${Date.now()}`;
    }

    const insertData = {
      slug: finalSlug,
      titre: titre.trim(),
      contenu_html: contenu_html || '<p></p>',
      contenu_json: contenu_json || null,
      images: images || [],
      id_auteur,
      est_publie: est_publie || false,
      date_publication: est_publie ? new Date().toISOString() : null,
      ...(categorie && { categorie }),
      ...(temps_lecture && { temps_lecture }),
      ...(tags && { tags })
    };

    const { data, error } = await supabase
      .from('articles')
      .insert([insertData])
      .select()
      .single();

    if (error) throw error;

    if (est_publie) notifyFollowers(id_auteur, data.titre, data.slug);

    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/articles/:id - Update (Auth)
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const userId = req.user.id;

    const { data: article } = await supabase.from('articles').select('id_auteur').eq('id', id).single();
    if (!article) return res.status(404).json({ success: false, error: 'Article non trouvé' });

    if (article.id_auteur !== userId) {
        return res.status(403).json({ success: false, error: 'Non autorisé' });
    }

    const cleanData = {};
    for (const [key, value] of Object.entries(updateData)) {
      if (value !== undefined && key !== 'id' && key !== 'id_auteur' && key !== 'created_at' && key !== 'description' && key !== 'image_url') {
        cleanData[key] = value;
      }
    }

    cleanData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('articles')
      .update(cleanData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/articles/:id/publier - Publier (Auth)
router.put('/:id/publier', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const { data: article } = await supabase.from('articles').select('id_auteur').eq('id', id).single();
    if (!article) return res.status(404).json({ success: false, error: 'Article non trouvé' });

    if (article.id_auteur !== userId) {
        return res.status(403).json({ success: false, error: 'Non autorisé : Seul l\'auteur peut publier cet article' });
    }

    const { data, error } = await supabase
      .from('articles')
      .update({
          est_publie: true,
          date_publication: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    notifyFollowers(userId, data.titre, data.slug);

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/articles/:id - Delete (Auth)
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const { data: article } = await supabase.from('articles').select('id_auteur').eq('id', id).single();
    if (!article) return res.status(404).json({ success: false, error: 'Article non trouvé' });
    
    if (article.id_auteur !== userId) {
        return res.status(403).json({ success: false, error: 'Non autorisé : Seul l\'auteur peut supprimer cet article' });
    }

    const { error } = await supabase.from('articles').delete().eq('id', id);

    if (error) throw error;
    res.json({ success: true, message: 'Article supprimé' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/articles/upload-image - Upload
router.post('/upload-image', requireAuth, upload.single('image'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ success: false, error: 'Fichier manquant' });
    
    const fileExt = file.originalname.split('.').pop();
    const fileName = `article-images/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    
    const { error: uploadError } = await supabase.storage
      .from('articles')
      .upload(fileName, file.buffer, { contentType: file.mimetype, upsert: false });
    
    if (uploadError) throw uploadError;
    
    const { data: { publicUrl } } = supabase.storage.from('articles').getPublicUrl(fileName);
    
    res.json({ success: true, file: { url: publicUrl }, url: publicUrl });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;