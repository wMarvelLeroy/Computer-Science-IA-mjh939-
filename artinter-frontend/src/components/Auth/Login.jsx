import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { signin } from '../../api/api.js';
import { supabase } from '../../config/supabase.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faWandMagicSparkles } from '@fortawesome/free-solid-svg-icons';
import { faGoogle } from '@fortawesome/free-brands-svg-icons';
import logo from '../../assets/ArtInter Logo (no background).png';
import './Auth.css';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]       = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError]           = useState('');
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setError('');
    const returnTo = sessionStorage.getItem('auth_return_to') || '/';
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?returnTo=${encodeURIComponent(returnTo)}`
      }
    });
    if (error) {
      const msg = error.message?.includes('already registered')
        ? 'Un compte existe déjà avec cet email. Connectez-vous avec votre mot de passe.'
        : 'Erreur lors de la connexion avec Google.';
      setError(msg);
      setGoogleLoading(false);
    }
    // Si succès, Supabase redirige automatiquement vers Google
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      setLoading(true);
      setError('');
      const response = await signin(email, password);
      if (response && response.success) {
        login(response.data.user);
        const returnTo = sessionStorage.getItem('auth_return_to');
        if (returnTo) {
          sessionStorage.removeItem('auth_return_to');
          navigate(returnTo);
        } else {
          const role = response.data.user?.profil?.role || 'lecteur';
          switch (role) {
            case 'admin':  navigate('/dashboard/admin');  break;
            case 'auteur': navigate('/dashboard/auteur'); break;
            default:       navigate('/');
          }
        }
      } else {
        setError('Identifiants incorrects');
      }
    } catch (err) {
      let msg = 'Une erreur est survenue';
      if (err.response)     msg = err.response.data?.error || 'Identifiants incorrects';
      else if (err.request) msg = 'Impossible de contacter le serveur.';
      else                  msg = err.message || msg;
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-art-container fadeInContainer">

      {/* ══ PANNEAU GAUCHE ══ */}
      <div className="auth-art-left-panel">
        <div className="auth-deco-ring-sm" />
        <div className="auth-deco-ring-bl" />
        <span className="auth-deco-dot" />
        <span className="auth-deco-dot" />

        <div className="auth-left-top">
          <div className="auth-left-text">
            <div className="auth-left-brand-row">
              <img src={logo} alt="ArtInter" className="auth-left-logo" />
              <span className="auth-left-brand-name">ArtInter</span>
            </div>
            <h2 className="auth-left-headline">
              L'art à portée<br />de <em>tous</em>
            </h2>
            <p className="auth-left-tagline">
              Des centaines d'articles, des artistes passionnés et une communauté qui vous attend.
            </p>
            <div className="auth-left-sep" />
          </div>

          <ul className="auth-left-features">
            <li>
              <div className="auth-feat-icon">
                <span className="material-icons" translate="no">auto_stories</span>
              </div>
              Explorez des centaines d'articles
            </li>
            <li>
              <div className="auth-feat-icon">
                <span className="material-icons" translate="no">palette</span>
              </div>
              Découvrez des artistes passionnés
            </li>
            <li>
              <div className="auth-feat-icon">
                <span className="material-icons" translate="no">share</span>
              </div>
              Partagez vos créations
            </li>
          </ul>

        </div>{/* fin auth-left-top */}

        <div className="auth-left-bottom">
          <p className="auth-left-quote">
            "L'art est la manière dont l'âme parle à ceux qui savent l'écouter."
          </p>
        </div>
      </div>

      {/* ══ PANNEAU DROIT ══ */}
      <div className="auth-art-right-panel">
        <div className="auth-form-inner">

          <div className="auth-form-header">
            <div className="auth-form-icon-wrap">
              <FontAwesomeIcon icon={faWandMagicSparkles} color="#10b981" />
            </div>
            <h1 className="auth-form-title">Connexion</h1>
            <p className="auth-form-sub">Heureux de vous revoir !</p>
          </div>

          {error && (
            <div className="auth-art-error">
              <span className="material-icons" translate="no">error_outline</span>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="auth-art-form-group">
              <label htmlFor="email">Email</label>
              <div className="auth-art-input-wrapper">
                <span className="material-icons auth-art-input-icon" translate="no">mail</span>
                <input id="email" type="email" value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="votre@email.com" required autoComplete="email" />
              </div>
            </div>

            <div className="auth-art-form-group">
              <label htmlFor="password">Mot de passe</label>
              <div className="auth-art-input-wrapper has-toggle">
                <span className="material-icons auth-art-input-icon" translate="no">lock</span>
                <input id="password" type={showPassword ? 'text' : 'password'} value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" required autoComplete="current-password" />
                <button type="button" className="auth-art-input-toggle"
                  onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
                  <span className="material-icons" translate="no">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            <button type="submit" className="auth-art-btn-submit" disabled={loading}>
              {loading
                ? <><span className="material-icons" translate="no">hourglass_top</span>Connexion...</>
                : <><span className="material-icons" translate="no">login</span>Se connecter</>}
            </button>
          </form>

          <div className="auth-art-divider"><span>ou</span></div>

          <button
            type="button"
            className="auth-art-btn-google"
            onClick={handleGoogleLogin}
            disabled={googleLoading}
          >
            <FontAwesomeIcon icon={faGoogle} />
            {googleLoading ? 'Redirection…' : 'Continuer avec Google'}
          </button>

          <div className="auth-art-footer">
            <Link to="/forgot-password" style={{ display: 'block', marginBottom: '0.5rem' }}>
              Mot de passe oublié ?
            </Link>
            Pas encore de compte ? <Link to="/signup">Créer un compte</Link>
          </div>

        </div>
      </div>

    </div>
  );
}

export default Login;
