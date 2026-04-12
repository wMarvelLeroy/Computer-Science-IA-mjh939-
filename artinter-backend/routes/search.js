import express from 'express';
import { supabase } from '../config/supabase.js';

const router = express.Router();

// GET /api/search?q=<query>
// Recherche multi-types : articles, categories, auteurs, profils, tags
router.get('/', async (req, res) => {
  try {
    const { q, limit = 6 } = req.query;
    const n = Math.min(Number(limit), 20);

    if (!q || q.trim().length < 2) {
      return res.json({ success: true, data: { articles: [], categories: [], auteurs: [], profils: [], tags: [] } });
    }

    const term = q.trim();
    const isHashtag = term.startsWith('#');
    const rawTerm = isHashtag ? term.slice(1) : term;

    const [articlesRes, categoriesRes, profilsRes, tagsRes] = await Promise.allSettled([
      supabase
        .from('articles')
        .select('id, titre, slug, images, tags, contenu_html, date_publication, categories(nom, slug), auteurs(id, profils(nom, avatar_url))')
        .eq('est_publie', true)
        .ilike('titre', `%${rawTerm}%`)
        .order('date_publication', { ascending: false })
        .limit(n),

      supabase
        .from('categories')
        .select('id, nom, slug, description')
        .ilike('nom', `%${rawTerm}%`)
        .order('nom')
        .limit(n),

      supabase
        .from('profils')
        .select('id, nom, avatar_url, role, bio, visible_dans_recherche')
        .ilike('nom', `%${rawTerm}%`)
        .neq('role', 'lecteur')
        .order('nom')
        .limit(n),

      // tags
      supabase
        .from('articles')
        .select('id, titre, slug, images, tags, contenu_html, date_publication, categories(nom, slug), auteurs(id, profils(nom, avatar_url))')
        .eq('est_publie', true)
        .filter('tags', 'cs', JSON.stringify([rawTerm]))
        .order('date_publication', { ascending: false })
        .limit(n),
    ]);

    const articles    = articlesRes.status   === 'fulfilled' ? (articlesRes.value.data   || []) : [];
    const categories  = categoriesRes.status === 'fulfilled' ? (categoriesRes.value.data || []) : [];
    const rawProfils  = profilsRes.status    === 'fulfilled' ? (profilsRes.value.data    || []) : [];
    const tagArticles = tagsRes.status       === 'fulfilled' ? (tagsRes.value.data       || []) : [];

    // admins sans visibilité explicite → visible si a des articles publiés
    const adminsNullVis = rawProfils.filter(p =>
      ['admin', 'super_admin'].includes(p.role) && p.visible_dans_recherche === null
    );
    let adminIdsWithArticles = new Set();
    if (adminsNullVis.length > 0) {
      const adminIds = adminsNullVis.map(p => p.id);
      const { data: adminArticles } = await supabase
        .from('articles')
        .select('id_auteur')
        .eq('est_publie', true)
        .in('id_auteur', adminIds);
      adminIdsWithArticles = new Set((adminArticles || []).map(a => a.id_auteur));
    }

    const profils = rawProfils.filter(p => {
      if (p.visible_dans_recherche === false) return false;
      if (p.role === 'auteur') return true;
      if (['admin', 'super_admin'].includes(p.role)) {
        if (p.visible_dans_recherche === true) return true;
        return adminIdsWithArticles.has(p.id);
      }
      return false;
    });

    const auteurs = profils;

    const tagSet = new Set();
    [...articles, ...tagArticles].forEach(a => {
      (a.tags || []).forEach(t => {
        if (t.toLowerCase().includes(rawTerm.toLowerCase())) tagSet.add(t);
      });
    });
    const tags = [...tagSet].slice(0, n);

    const stripHtml = (html) => (html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

    const normalizeArticle = (a) => {
      const profil = Array.isArray(a.auteurs?.profils) ? a.auteurs.profils[0] : a.auteurs?.profils;
      const raw = stripHtml(a.contenu_html);
      return {
        ...a,
        contenu_html: undefined, // ne pas renvoyer le HTML brut
        excerpt: raw.length > 0 ? raw.substring(0, 160) + (raw.length > 160 ? '…' : '') : null,
        auteurs: a.auteurs ? {
          id:         a.auteurs.id,
          nom:        profil?.nom || 'Auteur inconnu',
          avatar_url: profil?.avatar_url || null,
        } : null,
      };
    };

    res.json({
      success: true,
      data: {
        articles:    articles.map(normalizeArticle),
        tagArticles: tagArticles.map(normalizeArticle),
        categories,
        auteurs,
        profils:     [],
        tags,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
