// src/services/articlesService.js
import * as api from '../api/api.js';

const stripHtml = (html) => {
  if (!html) return '';
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
};

// Helper pour transformer les données backend (snake_case) vers frontend (camelCase/structure)
const transformArticleData = (backendArticle) => {
  const plainText = stripHtml(backendArticle.contenu_html);
  return {
    id:           backendArticle.id,
    authorId:     backendArticle.id_auteur,
    title:        backendArticle.titre,
    description:  plainText.length > 150 ? plainText.substring(0, 150) + '…' : plainText,
    category:     backendArticle.categories?.nom  || 'Non classé',
    categorySlug: backendArticle.categories?.slug || null,
    image:        backendArticle.images?.length > 0 ? backendArticle.images[0] : null,
    date:         backendArticle.date_publication || backendArticle.created_at,
    updatedDate:  backendArticle.updated_at,
    author: {
      name:   backendArticle.auteurs?.nom       || 'Inconnu',
      avatar: backendArticle.auteurs?.avatar_url,
      bio:    backendArticle.auteurs?.bio,
    },
    readTime: backendArticle.temps_lecture,
    tags:     backendArticle.tags || [],
    content:  backendArticle.contenu_html,
    slug:     backendArticle.slug,
  };
};

export const getAllArticles = async () => {
  try {
    const response = await api.getAllArticles();
    if (response.success) return response.data.map(transformArticleData);
    return [];
  } catch (error) {
    console.error('Erreur service getAllArticles:', error);
    return [];
  }
};

export const getArticleBySlug = async (slug) => {
  try {
    const response = await api.getArticleBySlug(slug);
    if (response.success) return transformArticleData(response.data);
    return null;
  } catch (error) {
    console.error('Erreur service getArticleBySlug:', error);
    return null;
  }
};

export const getArticleById = async (id) => {
  try {
    const response = await api.getArticleById(id);
    if (response.success) return transformArticleData(response.data);
    return null;
  } catch (error) {
    console.error('Erreur service getArticleById:', error);
    return null;
  }
};

export const getSimilarArticles = async (currentId, category) => {
  try {
    const all = await getAllArticles();
    return all.filter(a => a.category === category && a.id !== parseInt(currentId)).slice(0, 3);
  } catch {
    return [];
  }
};
