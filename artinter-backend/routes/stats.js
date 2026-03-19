import express from 'express';
import { supabase } from '../config/supabase.js';

const router = express.Router();

// GET /api/stats - Statistiques globales
router.get('/', async (req, res) => {
  try {
    // Compter les articles
    const { count: totalArticles } = await supabase
      .from('articles')
      .select('*', { count: 'exact', head: true });
    
    // Compter les articles publiés
    const { count: articlesPublies } = await supabase
      .from('articles')
      .select('*', { count: 'exact', head: true })
      .eq('est_publie', true);
    
    // Compter les utilisateurs
    const { count: totalUsers } = await supabase
      .from('profils')
      .select('*', { count: 'exact', head: true });
    
    // Compter les auteurs
    const { count: totalAuteurs } = await supabase
      .from('profils')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'auteur');
    
    // Compter les admins
    const { count: totalAdmins } = await supabase
      .from('profils')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'admin');
    
    // Compter les commentaires
    const { count: totalCommentaires } = await supabase
      .from('commentaires')
      .select('*', { count: 'exact', head: true });
    
    // Compter les likes
    const { count: totalLikes } = await supabase
      .from('likes')
      .select('*', { count: 'exact', head: true });
    
    // Compter les demandes en attente
    const { count: demandesEnAttente } = await supabase
      .from('demandes_auteur')
      .select('*', { count: 'exact', head: true })
      .eq('statut', 'en_attente');
    
    // Compter les catégories
    const { count: totalCategories } = await supabase
      .from('categories')
      .select('*', { count: 'exact', head: true });

    // Somme des vues sur articles publiés
    const { data: vuesTotalesData } = await supabase
      .from('articles')
      .select('vues')
      .eq('est_publie', true);
    const totalVues = (vuesTotalesData || []).reduce((s, a) => s + (a.vues || 0), 0);

    // Top 5 articles par vues
    const { data: topRaw } = await supabase
      .from('articles')
      .select('id, titre, slug, vues, id_auteur')
      .eq('est_publie', true)
      .order('vues', { ascending: false })
      .limit(5);

    let topArticles = [];
    if (topRaw && topRaw.length > 0) {
      const authorIds = [...new Set(topRaw.map(a => a.id_auteur))];
      const { data: profilsData } = await supabase
        .from('profils')
        .select('id, nom')
        .in('id', authorIds);
      const profilsMap = Object.fromEntries((profilsData || []).map(p => [p.id, p.nom]));

      const articleIds = topRaw.map(a => a.id);
      const { data: likesData } = await supabase
        .from('likes')
        .select('article_id')
        .in('article_id', articleIds);
      const likesCount = {};
      (likesData || []).forEach(l => {
        likesCount[l.article_id] = (likesCount[l.article_id] || 0) + 1;
      });

      topArticles = topRaw.map(a => ({
        id:         a.id,
        titre:      a.titre,
        slug:       a.slug,
        vues:       a.vues || 0,
        likes:      likesCount[a.id] || 0,
        auteur_nom: profilsMap[a.id_auteur] || 'Inconnu',
      }));
    }

    res.json({
      success: true,
      data: {
        total_articles:   totalArticles   || 0,
        articles_publies: articlesPublies || 0,
        total_users:      totalUsers      || 0,
        total_auteurs:    totalAuteurs    || 0,
        total_admins:     totalAdmins     || 0,
        total_categories: totalCategories || 0,
        total_vues:       totalVues,
        total_commentaires: totalCommentaires || 0,
        total_likes:      totalLikes      || 0,
        demandes_en_attente: demandesEnAttente || 0,
        top_articles:     topArticles,
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/stats/article/:articleId - Statistiques d'un article
router.get('/article/:articleId', async (req, res) => {
  try {
    const { articleId } = req.params;
    
    // Compter les likes
    const { count: likes } = await supabase
      .from('likes')
      .select('*', { count: 'exact', head: true })
      .eq('article_id', articleId);
    
    // Compter les commentaires
    const { count: commentaires } = await supabase
      .from('commentaires')
      .select('*', { count: 'exact', head: true })
      .eq('article_id', articleId);
    
    // Récupérer les vues
    const { data: article } = await supabase
      .from('articles')
      .select('vues, created_at, date_publication')
      .eq('id', articleId)
      .single();
    
    res.json({
      success: true,
      data: {
        likes: likes || 0,
        commentaires: commentaires || 0,
        vues: article?.vues || 0,
        dateCreation: article?.created_at,
        datePublication: article?.date_publication
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/stats/auteur/:auteurId - Statistiques complètes d'un auteur
router.get('/auteur/:auteurId', async (req, res) => {
  try {
    const { auteurId } = req.params;

    // Articles publiés et brouillons
    const [{ data: allArticles }, { count: totalArticles }] = await Promise.all([
      supabase
        .from('articles')
        .select('id, titre, slug, vues, est_publie, date_publication, categories(nom, slug)')
        .eq('id_auteur', auteurId)
        .order('vues', { ascending: false }),
      supabase
        .from('articles')
        .select('*', { count: 'exact', head: true })
        .eq('id_auteur', auteurId),
    ]);

    const articles     = allArticles || [];
    const pubArticles  = articles.filter(a => a.est_publie);
    const articleIds   = articles.map(a => a.id);
    const pubIds       = pubArticles.map(a => a.id);

    let totalLikes = 0, totalCommentaires = 0, totalVues = 0;
    let likesPerArticle = {};

    if (articleIds.length > 0) {
      const [{ count: likes }, { count: commentaires }, { data: likesRows }] = await Promise.all([
        supabase.from('likes').select('*', { count: 'exact', head: true }).in('article_id', pubIds),
        supabase.from('commentaires').select('*', { count: 'exact', head: true }).in('article_id', pubIds),
        supabase.from('likes').select('article_id').in('article_id', pubIds),
      ]);

      totalLikes        = likes || 0;
      totalCommentaires = commentaires || 0;
      totalVues         = pubArticles.reduce((s, a) => s + (a.vues || 0), 0);

      (likesRows || []).forEach(l => {
        likesPerArticle[l.article_id] = (likesPerArticle[l.article_id] || 0) + 1;
      });
    }

    const nbPublies = pubArticles.length;

    // Top articles enrichis
    const enriched = pubArticles.map(a => ({
      id:         a.id,
      titre:      a.titre,
      slug:       a.slug,
      vues:       a.vues || 0,
      nb_likes:   likesPerArticle[a.id] || 0,
      categorie:  a.categories?.nom   || null,
      cat_slug:   a.categories?.slug  || null,
      date:       a.date_publication,
    }));

    const topParVues  = [...enriched].sort((a, b) => b.vues - a.vues).slice(0, 5);
    const topParLikes = [...enriched].sort((a, b) => b.nb_likes - a.nb_likes).slice(0, 5);

    res.json({
      success: true,
      data: {
        articles: {
          total:     totalArticles || 0,
          publies:   nbPublies,
          brouillons: (totalArticles || 0) - nbPublies,
        },
        interactions: {
          likes:        totalLikes,
          commentaires: totalCommentaires,
          vues:         totalVues,
          moy_vues:     nbPublies > 0 ? Math.round(totalVues / nbPublies) : 0,
          moy_likes:    nbPublies > 0 ? Math.round(totalLikes / nbPublies * 10) / 10 : 0,
        },
        top: {
          par_vues:  topParVues,
          par_likes: topParLikes,
        },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/stats/populaires - Articles les plus populaires
router.get('/populaires', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    const { data, error } = await supabase
      .from('article_stats')
      .select('*')
      .eq('est_publie', true)
      .order('nombre_likes', { ascending: false })
      .limit(limit);
    
    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
    
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/stats/recents - Articles les plus récents
router.get('/recents', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    const { data, error } = await supabase
      .from('articles')
      .select(`
        *,
        auteurs(nom, avatar_url),
        categories(nom, slug)
      `)
      .eq('est_publie', true)
      .order('date_publication', { ascending: false })
      .limit(limit);
    
    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
    
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;