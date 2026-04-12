import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, { refresh_token: refreshToken });
          if (data.success && data.data?.session?.access_token) {
            const newToken = data.data.session.access_token;
            localStorage.setItem('token', newToken);
            if (data.data.session.refresh_token) {
              localStorage.setItem('refresh_token', data.data.session.refresh_token);
            }
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return api(originalRequest);
          }
        } catch { /* refresh échoué */ }
      }

      const currentPath = window.location.pathname;
      if (currentPath !== '/login' && currentPath !== '/signup') {
        localStorage.removeItem('token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        window.dispatchEvent(new CustomEvent('auth:session-expired'));
      }
    }

    return Promise.reject(error);
  }
);

// Auth

export const signup = async (email, password, nom) => {
  try {
    const response = await api.post('/auth/signup', { email, password, nom });
    if (response.data.data?.session?.access_token) {
      localStorage.setItem('token', response.data.data.session.access_token);
      localStorage.setItem('user', JSON.stringify(response.data.data.user));
    }
    return response.data;
  } catch (error) {
    console.error('Erreur signup:', error);
    throw error;
  }
};

export const signin = async (email, password) => {
  try {
    const response = await api.post('/auth/signin', { email, password });
    if (response.data.data?.session?.access_token) {
      localStorage.setItem('token', response.data.data.session.access_token);
      if (response.data.data.session.refresh_token) {
        localStorage.setItem('refresh_token', response.data.data.session.refresh_token);
      }
      localStorage.setItem('user', JSON.stringify(response.data.data.user));
    }
    return response.data;
  } catch (error) {
    console.error('Erreur signin:', error);
    throw error;
  }
};

export const getCurrentUser = async () => {
  try {
    const response = await api.get('/auth/user');
    return response.data;
  } catch (error) {
    console.error('Erreur getCurrentUser:', error);
    throw error;
  }
};

export const logout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');
  window.location.href = '/login';
};

export const forgotPassword = async (email) => {
  const response = await api.post('/auth/forgot-password', { email });
  return response.data;
};

export const resetPassword = async (access_token, password) => {
  const response = await api.post('/auth/reset-password', { access_token, password });
  return response.data;
};

export const isAuthenticated = () => {
  return !!localStorage.getItem('token');
};

// Articles

export const getAllArticles = async (params = {}) => {
  try {
    const response = await api.get('/articles', { params });
    return response.data;
  } catch (error) {
    console.error('Erreur getAllArticles:', error);
    throw error;
  }
};

export const getArticleBySlug = async (slug) => {
  try {
    const sessionKey = `viewed_${slug}`;
    const alreadySeen = sessionStorage.getItem(sessionKey);
    const url = alreadySeen
      ? `/articles/slug/${slug}`
      : `/articles/slug/${slug}?record_view=1`;
    if (!alreadySeen) sessionStorage.setItem(sessionKey, '1');
    const response = await api.get(url);
    return response.data;
  } catch (error) {
    console.error('Erreur getArticleBySlug:', error);
    throw error;
  }
};

export const getArticleById = async (id) => {
  try {
    const response = await api.get(`/articles/${id}`);
    return response.data;
  } catch (error) {
    console.error('Erreur getArticleById:', error);
    throw error;
  }
};

export const getArticlesByAuteur = async (auteurId) => {
  try {
    const response = await api.get(`/articles/auteur/${auteurId}`);
    return response.data;
  } catch (error) {
    console.error('Erreur getArticlesByAuteur:', error);
    throw error;
  }
};

export const createArticle = async (articleData) => {
  try {
    const response = await api.post('/articles', articleData);
    return response.data;
  } catch (error) {
    console.error('Erreur createArticle:', error);
    throw error;
  }
};

export const updateArticle = async (id, updateData) => {
  try {
    const response = await api.put(`/articles/${id}`, updateData);
    return response.data;
  } catch (error) {
    console.error('Erreur updateArticle:', error);
    throw error;
  }
};

export const deleteArticle = async (id) => {
  try {
    const response = await api.delete(`/articles/${id}`);
    return response.data;
  } catch (error) {
    console.error('Erreur deleteArticle:', error);
    throw error;
  }
};

export const togglePublishArticle = async (id, estPublie) => {
  try {
    const response = await api.put(`/articles/${id}`, {
      est_publie: estPublie,
      date_publication: estPublie ? new Date().toISOString() : null
    });
    return response.data;
  } catch (error) {
    console.error('Erreur togglePublishArticle:', error);
    throw error;
  }
};

export const uploadArticleImage = async (file) => {
  try {
    const formData = new FormData();
    formData.append('image', file);
    const response = await api.post('/articles/upload-image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  } catch (error) {
    console.error('Erreur uploadArticleImage:', error);
    throw error;
  }
};

// Commentaires

export const getCommentaires = async (articleId) => {
  try {
    const response = await api.get(`/commentaires/article/${articleId}`);
    return response.data;
  } catch (error) {
    console.error('Erreur getCommentaires:', error);
    throw error;
  }
};

export const addCommentaire = async (articleId, contenu, parentId = null) => {
  try {
    const response = await api.post('/commentaires', {
      article_id: articleId,
      contenu,
      parent_id: parentId || null,
    });
    return response.data;
  } catch (error) {
    console.error('Erreur addCommentaire:', error);
    throw error;
  }
};

export const restrictUserComments = async (userId, peutCommenter) => {
  try {
    const response = await api.patch(`/commentaires/restrict/${userId}`, { peut_commenter: peutCommenter });
    return response.data;
  } catch (error) {
    console.error('Erreur restrictUserComments:', error);
    throw error;
  }
};

export const updateCommentaire = async (commentaireId, contenu) => {
  try {
    const response = await api.put(`/commentaires/${commentaireId}`, { contenu });
    return response.data;
  } catch (error) {
    console.error('Erreur updateCommentaire:', error);
    throw error;
  }
};

export const deleteCommentaire = async (commentaireId) => {
  try {
    const response = await api.delete(`/commentaires/${commentaireId}`);
    return response.data;
  } catch (error) {
    console.error('Erreur deleteCommentaire:', error);
    throw error;
  }
};

export const modererCommentaire = async (commentaireId, action, motif = '') => {
  try {
    const response = await api.post(`/commentaires/${commentaireId}/moderer`, { action, motif });
    return response.data;
  } catch (error) {
    console.error('Erreur modererCommentaire:', error);
    throw error;
  }
};

export const signalerCommentaire = async (commentaireId, raison = 'contenu_inapproprie') => {
  try {
    const response = await api.post(`/commentaires/${commentaireId}/signaler`, { raison });
    return response.data;
  } catch (error) {
    console.error('Erreur signalerCommentaire:', error);
    throw error;
  }
};

export const getAllSignalementsCommentaires = (statut = null) =>
  api.get('/commentaires/signalements', { params: statut ? { statut } : {} }).then(r => r.data);

export const traiterSignalementCommentaire = (id, note = null) =>
  api.put(`/commentaires/signalements/${id}/traiter`, { note }).then(r => r.data);

export const rejeterSignalementCommentaire = (id, note = null) =>
  api.put(`/commentaires/signalements/${id}/rejeter`, { note }).then(r => r.data);

export const deleteSignalementCommentaire = (id) =>
  api.delete(`/commentaires/signalements/${id}`).then(r => r.data);

// Likes

export const getLikes = async (articleId) => {
  try {
    const response = await api.get(`/likes/article/${articleId}`);
    return response.data;
  } catch (error) {
    console.error('Erreur getLikes:', error);
    throw error;
  }
};

export const likeArticle = async (articleId, userId) => {
  try {
    const response = await api.post('/likes', {
      article_id: articleId,
      user_id: userId
    });
    return response.data;
  } catch (error) {
    console.error('Erreur likeArticle:', error);
    throw error;
  }
};

export const unlikeArticle = async (articleId, userId) => {
  try {
    const response = await api.delete('/likes', {
      data: { article_id: articleId, user_id: userId }
    });
    return response.data;
  } catch (error) {
    console.error('Erreur unlikeArticle:', error);
    throw error;
  }
};

export const toggleLike = async (articleId, userId) => {
  try {
    await likeArticle(articleId, userId);
    return { liked: true };
  } catch (error) {
    if (error.response?.data?.error?.includes('Déjà liké')) {
      await unlikeArticle(articleId, userId);
      return { liked: false };
    }
    throw error;
  }
};

// Catégories

export const getAllCategories = async () => {
  try {
    const response = await api.get('/categories');
    return response.data;
  } catch (error) {
    console.error('Erreur getAllCategories:', error);
    throw error;
  }
};

export const getCategorieById = async (id) => {
  try {
    const response = await api.get(`/categories/${id}`);
    return response.data;
  } catch (error) {
    console.error('Erreur getCategorieById:', error);
    throw error;
  }
};

export const createCategorie = async (categorieData) => {
  try {
    const response = await api.post('/categories', categorieData);
    return response.data;
  } catch (error) {
    console.error('Erreur createCategorie:', error);
    throw error;
  }
};

export const updateCategorie = async (id, updateData) => {
  try {
    const response = await api.put(`/categories/${id}`, updateData);
    return response.data;
  } catch (error) {
    console.error('Erreur updateCategorie:', error);
    throw error;
  }
};

export const deleteCategorie = async (id) => {
  try {
    const response = await api.delete(`/categories/${id}`);
    return response.data;
  } catch (error) {
    console.error('Erreur deleteCategorie:', error);
    throw error;
  }
};

// Demandes de catégorie

export const getAllDemandesCategorie = async (statut = null) => {
  try {
    const params = statut ? { statut } : {};
    const response = await api.get('/demandes-categorie', { params });
    return response.data;
  } catch (error) {
    console.error('Erreur getAllDemandesCategorie:', error);
    throw error;
  }
};

export const getDemandesCategorieByUser = async (userId) => {
  try {
    const response = await api.get(`/demandes-categorie/user/${userId}`);
    return response.data;
  } catch (error) {
    console.error('Erreur getDemandesCategorieByUser:', error);
    throw error;
  }
};

export const createDemandeCategorie = async (userId, nom, slug, description, justification) => {
  try {
    const response = await api.post('/demandes-categorie', {
      user_id: userId,
      nom,
      slug,
      description,
      justification
    });
    return response.data;
  } catch (error) {
    console.error('Erreur createDemandeCategorie:', error);
    throw error;
  }
};

export const approuverDemandeCategorie = async (demandeId) => {
  try {
    const response = await api.post(`/demandes-categorie/${demandeId}/approuver`);
    return response.data;
  } catch (error) {
    console.error('Erreur approuverDemandeCategorie:', error);
    throw error;
  }
};

export const refuserDemandeCategorie = async (demandeId, raison = null) => {
  try {
    const response = await api.post(`/demandes-categorie/${demandeId}/refuser`, { raison });
    return response.data;
  } catch (error) {
    console.error('Erreur refuserDemandeCategorie:', error);
    throw error;
  }
};

export const deleteDemandeCategorie = async (demandeId) => {
  try {
    const response = await api.delete(`/demandes-categorie/${demandeId}`);
    return response.data;
  } catch (error) {
    console.error('Erreur deleteDemandeCategorie:', error);
    throw error;
  }
};

// Profils

export const getAllProfils = async () => {
  try {
    const response = await api.get('/profils');
    return response.data;
  } catch (error) {
    console.error('Erreur getAllProfils:', error);
    throw error;
  }
};

export const getProfilById = async (userId) => {
  try {
    const response = await api.get(`/profils/${userId}`);
    return response.data;
  } catch (error) {
    console.error('Erreur getProfilById:', error);
    throw error;
  }
};

export const getPublicAuteurs = async () => {
  try {
    const response = await api.get('/profils/public/auteurs');
    return response.data;
  } catch (error) {
    console.error('Erreur getPublicAuteurs:', error);
    throw error;
  }
};

export const updateProfil = async (userId, updateData) => {
  try {
    const response = await api.put(`/profils/${userId}`, updateData);
    return response.data;
  } catch (error) {
    console.error('Erreur updateProfil:', error);
    throw error;
  }
};

export const deleteProfil = async (userId) => {
  try {
    const response = await api.delete(`/profils/${userId}`);
    return response.data;
  } catch (error) {
    console.error('Erreur deleteProfil:', error);
    throw error;
  }
};

export const uploadAvatar = async (userId, avatarUrl) => {
  try {
    const response = await api.post(`/profils/${userId}/avatar`, { avatar_url: avatarUrl });
    return response.data;
  } catch (error) {
    console.error('Erreur uploadAvatar:', error);
    throw error;
  }
};

export const uploadAvatarFile = async (userId, file) => {
  try {
    const formData = new FormData();
    formData.append('avatar', file);
    const response = await api.post(`/profils/${userId}/upload-avatar`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  } catch (error) {
    console.error('Erreur uploadAvatarFile:', error);
    throw error;
  }
};

// Demandes d'auteur

export const getAllDemandesAuteur = async (statut = null) => {
  try {
    const params = statut ? { statut } : {};
    const response = await api.get('/demandes-auteur', { params });
    return response.data;
  } catch (error) {
    console.error('Erreur getAllDemandesAuteur:', error);
    throw error;
  }
};

export const getDemandeAuteurByUser = async (userId) => {
  try {
    const response = await api.get(`/demandes-auteur/user/${userId}`);
    return response.data;
  } catch (error) {
    console.error('Erreur getDemandeAuteurByUser:', error);
    throw error;
  }
};

export const createDemandeAuteur = async (userId, motivation) => {
  try {
    const response = await api.post('/demandes-auteur', {
      user_id: userId,
      motivation
    });
    return response.data;
  } catch (error) {
    console.error('Erreur createDemandeAuteur:', error);
    throw error;
  }
};

export const approuverDemandeAuteur = async (demandeId) => {
  try {
    const response = await api.post(`/demandes-auteur/${demandeId}/approuver`);
    return response.data;
  } catch (error) {
    console.error('Erreur approuverDemandeAuteur:', error);
    throw error;
  }
};

export const refuserDemandeAuteur = async (demandeId) => {
  try {
    const response = await api.post(`/demandes-auteur/${demandeId}/refuser`);
    return response.data;
  } catch (error) {
    console.error('Erreur refuserDemandeAuteur:', error);
    throw error;
  }
};

// Auteurs

export const getAllAuteurs = async () => {
  try {
    const response = await api.get('/auteurs');
    return response.data;
  } catch (error) {
    console.error('Erreur getAllAuteurs:', error);
    throw error;
  }
};

export const getAuteurById = async (id) => {
  try {
    const response = await api.get(`/auteurs/${id}`);
    return response.data;
  } catch (error) {
    console.error('Erreur getAuteurById:', error);
    throw error;
  }
};

export const getArticlesAuteur = async (auteurId) => {
  try {
    const response = await api.get(`/auteurs/${auteurId}/articles`);
    return response.data;
  } catch (error) {
    console.error('Erreur getArticlesAuteur:', error);
    throw error;
  }
};

export const createAuteur = async (auteurData) => {
  try {
    const response = await api.post('/auteurs', auteurData);
    return response.data;
  } catch (error) {
    console.error('Erreur createAuteur:', error);
    throw error;
  }
};

// Stats

export const getStatsGlobal = async () => {
  try {
    const response = await api.get('/stats');
    return response.data;
  } catch (error) {
    console.error('Erreur getStatsGlobal:', error);
    throw error;
  }
};

export const getStatsArticle = async (articleId) => {
  try {
    const response = await api.get(`/stats/article/${articleId}`);
    return response.data;
  } catch (error) {
    console.error('Erreur getStatsArticle:', error);
    throw error;
  }
};

export const getStatsAuteur = async (auteurId) => {
  try {
    const response = await api.get(`/stats/auteur/${auteurId}`);
    return response.data;
  } catch (error) {
    console.error('Erreur getStatsAuteur:', error);
    throw error;
  }
};

export const getArticlesPopulaires = async (limit = 5) => {
  try {
    const response = await api.get(`/stats/populaires?limit=${limit}`);
    return response.data;
  } catch (error) {
    console.error('Erreur getArticlesPopulaires:', error);
    throw error;
  }
};

export const getArticlesRecents = async (limit = 5) => {
  try {
    const response = await api.get(`/stats/recents?limit=${limit}`);
    return response.data;
  } catch (error) {
    console.error('Erreur getArticlesRecents:', error);
    throw error;
  }
};

// Admin

export const getAllArticlesAdmin = async (params = {}) => {
  try {
    const response = await api.get('/articles/admin/all', { params });
    return response.data;
  } catch (error) {
    console.error('Erreur getAllArticlesAdmin:', error);
    throw error;
  }
};

export const deleteArticleAdmin = async (id) => {
  try {
    const response = await api.delete(`/articles/admin/${id}`);
    return response.data;
  } catch (error) {
    console.error('Erreur deleteArticleAdmin:', error);
    throw error;
  }
};

export const restrictArticleAdmin = (id) =>
  api.put(`/articles/admin/${id}/restreindre`).then(r => r.data);

export const republierArticleAdmin = (id) =>
  api.put(`/articles/admin/${id}/republier`).then(r => r.data);

export const clearRoleNotif = (userId) =>
  api.put(`/profils/${userId}`, { role_notif: null }).then(r => r.data);

export const toggleBanAuteur = async (auteurId, estBanni) => {
  try {
    const response = await api.put(`/auteurs/${auteurId}/ban`, { est_banni: estBanni });
    return response.data;
  } catch (error) {
    console.error('Erreur toggleBanAuteur:', error);
    throw error;
  }
};

// Signalements

export const getAllSignalements = async (statut = null) => {
  try {
    const params = statut ? { statut } : {};
    const response = await api.get('/signalements', { params });
    return response.data;
  } catch (error) {
    console.error('Erreur getAllSignalements:', error);
    throw error;
  }
};

export const checkSignalement = async (articleId) => {
  try {
    const response = await api.get(`/signalements/check/${articleId}`);
    return response.data;
  } catch (error) {
    console.error('Erreur checkSignalement:', error);
    return { success: true, data: null };
  }
};

export const createSignalement = async (articleId, raison, description = null) => {
  try {
    const response = await api.post('/signalements', {
      article_id: articleId,
      raison,
      description
    });
    return response.data;
  } catch (error) {
    console.error('Erreur createSignalement:', error);
    throw error;
  }
};

export const traiterSignalement = async (id, note = null) => {
  try {
    const response = await api.put(`/signalements/${id}/traiter`, { note });
    return response.data;
  } catch (error) {
    console.error('Erreur traiterSignalement:', error);
    throw error;
  }
};

export const rejeterSignalement = async (id, note = null) => {
  try {
    const response = await api.put(`/signalements/${id}/rejeter`, { note });
    return response.data;
  } catch (error) {
    console.error('Erreur rejeterSignalement:', error);
    throw error;
  }
};

export const deleteSignalement = async (id) => {
  try {
    const response = await api.delete(`/signalements/${id}`);
    return response.data;
  } catch (error) {
    console.error('Erreur deleteSignalement:', error);
    throw error;
  }
};

// Restrictions

export const creerRestriction = (userId, motif, details, duree_jours) =>
  api.post('/restrictions', { user_id: userId, motif, details, duree_jours }).then(r => r.data);

export const getRestrictionsUser = (userId) =>
  api.get(`/restrictions/user/${userId}`).then(r => r.data);

export const leverRestriction = (restrictionId) =>
  api.put(`/restrictions/${restrictionId}/lever`).then(r => r.data);

export const retirerStatutAuteur = (userId) =>
  api.delete(`/profils/${userId}/retirer-auteur`).then(r => r.data);

// Notifications

export const getMesNotifications = () =>
  api.get('/notifications').then(r => r.data);

export const getNotifsCount = () =>
  api.get('/notifications/count').then(r => r.data);

export const marquerNotifLue = (id) =>
  api.put(`/notifications/${id}/lu`).then(r => r.data);

export const toutMarquerLu = () =>
  api.put('/notifications/tout-lire').then(r => r.data);

// Réexamination

export const soumettreReexamination = (notification_id, motif) =>
  api.post('/reexamination', { notification_id, motif }).then(r => r.data);

export const getMesDemandesReexamination = () =>
  api.get('/reexamination/mes-demandes').then(r => r.data);

export const getAllDemandesReexamination = (statut = null) =>
  api.get('/reexamination', { params: statut ? { statut } : {} }).then(r => r.data);

export const traiterDemandeReexamination = (id, decision, reponse, cooldown_jours) =>
  api.put(`/reexamination/${id}/traiter`, { decision, reponse, cooldown_jours }).then(r => r.data);

// Modération claims

export const getClaimsForTable = (table_name) =>
  api.get('/moderation-claims', { params: { table_name } });

export const claimItem = (table_name, item_id) =>
  api.post('/moderation-claims', { table_name, item_id });

export const releaseClaim = (table_name, item_id) =>
  api.delete(`/moderation-claims/${table_name}/${item_id}`);

export const contesterClaim = (table_name, item_id) =>
  api.post(`/moderation-claims/${table_name}/${item_id}/contester`);

// Recherche

export const searchAll = (q, limit = 6) =>
  api.get('/search', { params: { q, limit } }).then(r => r.data);

export const getAdminActivity = (params = {}) =>
  api.get('/admin-activity', { params }).then(r => r.data);

export const getLikedByUser = (userId) =>
  api.get(`/likes/user/${userId}`).then(r => r.data);

// Suivis

export const getFollowers = (userId) =>
  api.get(`/suivis/followers/${userId}`).then(r => r.data);

export const getFollowing = (userId) =>
  api.get(`/suivis/following/${userId}`).then(r => r.data);

export const checkIsFollowing = (followerId, suiviId) =>
  api.get('/suivis/check', { params: { follower_id: followerId, suivi_id: suiviId } }).then(r => r.data);

export const followUser = (suiviId) =>
  api.post('/suivis', { suivi_id: suiviId }).then(r => r.data);

export const unfollowUser = (suiviId) =>
  api.delete('/suivis', { data: { suivi_id: suiviId } }).then(r => r.data);

export default api;
