import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { resetPassword } from '../../api/api.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faWandMagicSparkles } from '@fortawesome/free-solid-svg-icons';
import logo from '../../assets/ArtInter Logo (no background).png';
import './Auth.css';

function ResetPassword() {
  const [password, setPassword]           = useState('');
  const [confirm, setConfirm]             = useState('');
  const [showPassword, setShowPassword]   = useState(false);
  const [loading, setLoading]             = useState(false);
  const [done, setDone]                   = useState(false);
  const [error, setError]                 = useState('');
  const [accessToken, setAccessToken]     = useState(null);
  const navigate = useNavigate();

  // Supabase envoie le token dans le hash de l'URL : #access_token=xxx&type=recovery
  useEffect(() => {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const token = params.get('access_token');
    const type  = params.get('type');

    if (token && type === 'recovery') {
      setAccessToken(token);
      // Nettoyer le hash de l'URL sans recharger la page
      window.history.replaceState(null, '', window.location.pathname);
    } else {
      setError('Lien invalide ou expiré. Recommencez la procédure.');
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await resetPassword(accessToken, password);
      if (res.success) {
        setDone(true);
        setTimeout(() => navigate('/login'), 3000);
      } else {
        setError(res.error || 'Une erreur est survenue.');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Une erreur est survenue.');
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
              Nouveau<br /><em>mot de passe</em>
            </h2>
            <p className="auth-left-tagline">
              Choisissez un mot de passe sécurisé d'au moins 6 caractères.
            </p>
            <div className="auth-left-sep" />
          </div>
        </div>
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
            <h1 className="auth-form-title">Réinitialisation</h1>
            <p className="auth-form-sub">
              {done ? 'Mot de passe mis à jour !' : 'Choisissez un nouveau mot de passe'}
            </p>
          </div>

          {error && (
            <div className="auth-art-error">
              <span className="material-icons" translate="no">error_outline</span>
              {error}
            </div>
          )}

          {done ? (
            <div className="auth-art-success">
              <span className="material-icons" translate="no">check_circle</span>
              Votre mot de passe a été modifié. Vous allez être redirigé vers la connexion…
            </div>
          ) : accessToken ? (
            <form onSubmit={handleSubmit}>
              <div className="auth-art-form-group">
                <label htmlFor="password">Nouveau mot de passe</label>
                <div className="auth-art-input-wrapper has-toggle">
                  <span className="material-icons auth-art-input-icon" translate="no">lock</span>
                  <input id="password" type={showPassword ? 'text' : 'password'} value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••" required autoComplete="new-password" />
                  <button type="button" className="auth-art-input-toggle"
                    onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
                    <span className="material-icons" translate="no">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              <div className="auth-art-form-group">
                <label htmlFor="confirm">Confirmer le mot de passe</label>
                <div className="auth-art-input-wrapper">
                  <span className="material-icons auth-art-input-icon" translate="no">lock_reset</span>
                  <input id="confirm" type={showPassword ? 'text' : 'password'} value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="••••••••" required autoComplete="new-password" />
                </div>
              </div>

              <button type="submit" className="auth-art-btn-submit" disabled={loading}>
                {loading
                  ? <><span className="material-icons" translate="no">hourglass_top</span>Mise à jour...</>
                  : <><span className="material-icons" translate="no">lock_reset</span>Changer le mot de passe</>}
              </button>
            </form>
          ) : null}

          <div className="auth-art-footer">
            <Link to="/login">← Retour à la connexion</Link>
          </div>

        </div>
      </div>

    </div>
  );
}

export default ResetPassword;
