import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

// Protection contre les abus — limite globale sur toutes les routes
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  message: { success: false, error: 'Trop de requêtes. Réessayez dans quelques minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Import des routes
import authRoutes from './routes/auth.js';
import articlesRoutes from './routes/articles.js';
import commentairesRoutes from './routes/commentaires.js';
import likesRoutes from './routes/likes.js';
import categoriesRoutes from './routes/categories.js';
import profilsRoutes from './routes/profils.js';
import demandesRoutes from './routes/demandes.js';
import auteursRoutes from './routes/auteurs.js';
import statsRoutes from './routes/stats.js';
import demandesCategoriesRoutes from './routes/demandes-categorie.js';
import signalementsRoutes from './routes/signalements.js';
import restrictionsRoutes from './routes/restrictions.js';
import notificationsRoutes from './routes/notifications.js';
import reexaminationRoutes from './routes/reexamination.js';
import moderationClaimsRoutes from './routes/moderationClaims.js';
import adminActivityRoutes from './routes/adminActivity.js';
import searchRoutes from './routes/search.js';
import suivisRoutes from './routes/suivis.js';


const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Route de test
app.get('/', (req, res) => {
  res.json({ 
    message: 'API Blog Backend - Fonctionne correctement !',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      articles: '/api/articles',
      commentaires: '/api/commentaires',
      likes: '/api/likes',
      categories: '/api/categories',
      profils: '/api/profils',
      demandes: '/api/demandes-auteur',
      auteurs: '/api/auteurs',
      stats: '/api/stats',
      demandesCategorie: '/api/demandes-categorie'
    }
  });
});

// Appliquer le limiteur sur toutes les routes API
app.use('/api', limiter);

// Utilisation des routes
app.use('/api/auth',               authRoutes);
app.use('/api/articles',           articlesRoutes);
app.use('/api/commentaires',       commentairesRoutes);
app.use('/api/likes',              likesRoutes);
app.use('/api/signalements',       signalementsRoutes);
app.use('/api/suivis',             suivisRoutes);
app.use('/api/demandes-auteur',    demandesRoutes);
app.use('/api/demandes-categorie', demandesCategoriesRoutes);
app.use('/api/reexamination',      reexaminationRoutes);
app.use('/api/categories',         categoriesRoutes);
app.use('/api/profils',            profilsRoutes);
app.use('/api/auteurs',            auteursRoutes);
app.use('/api/stats',              statsRoutes);
app.use('/api/search',             searchRoutes);
app.use('/api/notifications',      notificationsRoutes);
app.use('/api/restrictions',       restrictionsRoutes);
app.use('/api/moderation-claims',  moderationClaimsRoutes);
app.use('/api/admin-activity',     adminActivityRoutes);

// Gestionnaire d'erreurs global
app.use((err, req, res, next) => {
  console.error('Erreur globale :', err);

  // Payload trop volumineux
  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      error: 'Payload trop volumineux. Réduisez la taille des images ou du contenu.'
    });
  }

  // Erreur de parsing JSON
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      error: 'JSON invalide dans la requête'
    });
  }

  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Erreur serveur interne'
  });
});

// Gestion des erreurs 404
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    error: 'Route non trouvée' 
  });
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`Serveur lancé sur http://localhost:${PORT}`);
  console.log(`API disponible sur http://localhost:${PORT}/api`);
});