import { supabase } from '../config/supabase.js';

// Vérifie le token Bearer JWT via Supabase et attache l'utilisateur + son profil à req
export const requireAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ success: false, error: 'Token manquant' });
    }

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ success: false, error: 'Token invalide ou expiré' });
    }

    // Récupérer le profil
    const { data: profil } = await supabase
      .from('profils')
      .select('*')
      .eq('id', user.id)
      .single();

    req.user = user;
    req.profil = profil;

    next();
  } catch (err) {
    console.error('Auth Middleware Error:', err);
    res.status(500).json({ success: false, error: 'Erreur authentification serveur' });
  }
};

export const isAdmin = (req) => ['admin', 'super_admin'].includes(req.profil?.role);
export const isSuperAdmin = (req) => req.profil?.role === 'super_admin';
