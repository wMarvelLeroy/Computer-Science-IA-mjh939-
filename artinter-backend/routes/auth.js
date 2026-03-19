import express from 'express';
import { supabase } from '../config/supabase.js';

const router = express.Router();

// POST /api/auth/signup - Inscription
router.post('/signup', async (req, res) => {
  try {
    const { email, password, nom } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email et password requis'
      });
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nom: nom || email }
    });

    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }

    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/auth/signin - Connexion
router.post('/signin', async (req, res) => {
  try {
    const { email, password } = req.body;

    // ⚠️ IMPORTANT: Créer un client temporaire pour l'authentification
    // Si on utilise le client global 'supabase' (admin), signInWithPassword va modifier son état
    // et les requêtes suivantes se feront avec le token de l'utilisateur (déclenchant les RLS)
    // au lieu d'utiliser la clé Service Role (qui contourne les RLS).
    const { createClient } = await import('@supabase/supabase-js');
    const tempClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false, // Ne pas garder la session en mémoire
        autoRefreshToken: false,
      }
    });

    const { data: authData, error: authError } = await tempClient.auth.signInWithPassword({
      email,
      password
    });

    if (authError) {
      return res.status(401).json({ success: false, error: authError.message });
    }

    // Récupérer le profil utilisateur avec le client ADMIN (bypasses RLS)
    const { data: profil, error: profilError } = await supabase
      .from('profils')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (profilError) {
      console.error('Erreur récupération profil:', profilError);
    }

    const userWithProfile = {
      ...authData.user,
      profil: profil || { role: 'lecteur' }
    };

    res.json({
      success: true,
      data: {
        session: authData.session,
        user: userWithProfile
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/auth/refresh - Renouveler le token via refresh_token
router.post('/refresh', async (req, res) => {
  try {
    const { refresh_token } = req.body;
    if (!refresh_token) {
      return res.status(400).json({ success: false, error: 'Refresh token manquant' });
    }

    const { createClient } = await import('@supabase/supabase-js');
    const tempClient = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    const { data, error } = await tempClient.auth.refreshSession({ refresh_token });
    if (error) {
      return res.status(401).json({ success: false, error: error.message });
    }

    res.json({ success: true, data: { session: data.session } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/auth/forgot-password - Envoyer un email de réinitialisation
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, error: 'Email requis' });

    const { createClient } = await import('@supabase/supabase-js');
    const tempClient = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    const redirectTo = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password`;
    const { error } = await tempClient.auth.resetPasswordForEmail(email, { redirectTo });

    // On retourne toujours succès pour ne pas révéler si l'email existe
    if (error) console.error('Forgot password error:', error.message);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/auth/reset-password - Réinitialiser le mot de passe avec le token de récupération
router.post('/reset-password', async (req, res) => {
  try {
    const { access_token, password } = req.body;
    if (!access_token || !password) {
      return res.status(400).json({ success: false, error: 'Token et mot de passe requis' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, error: 'Le mot de passe doit contenir au moins 6 caractères' });
    }

    // Vérifier le token et récupérer l'utilisateur
    const { data: { user }, error: userError } = await supabase.auth.getUser(access_token);
    if (userError || !user) {
      return res.status(401).json({ success: false, error: 'Lien expiré ou invalide. Recommencez la procédure.' });
    }

    // Mettre à jour le mot de passe
    const { error } = await supabase.auth.admin.updateUserById(user.id, { password });
    if (error) return res.status(400).json({ success: false, error: error.message });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/auth/user - Récupérer l'utilisateur
router.get('/user', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ success: false, error: 'Token manquant' });
    }

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error) {
      return res.status(401).json({ success: false, error: error.message });
    }

    const { data: profil } = await supabase
      .from('profils')
      .select('*')
      .eq('id', user.id)
      .single();

    res.json({ success: true, data: { ...user, profil } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;