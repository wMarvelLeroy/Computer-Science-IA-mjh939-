import { useState } from 'react';
import { Link } from 'react-router-dom';
import { forgotPassword } from '../../api/api.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faWandMagicSparkles } from '@fortawesome/free-solid-svg-icons';
import logo from '../../assets/ArtInter Logo (no background).png';
import './Auth.css';

function ForgotPassword() {
  const [email, setEmail]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [sent, setSent]         = useState(false);
  const [error, setError]       = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await forgotPassword(email);
      setSent(true);
    } catch {
      setError('Une erreur est survenue. Veuillez réessayer.');
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
              Retrouvez<br />votre <em>accès</em>
            </h2>
            <p className="auth-left-tagline">
              Un lien de réinitialisation vous sera envoyé par email en quelques secondes.
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
            <h1 className="auth-form-title">Mot de passe oublié</h1>
            <p className="auth-form-sub">
              {sent ? 'Email envoyé !' : 'Entrez votre adresse email'}
            </p>
          </div>

          {error && (
            <div className="auth-art-error">
              <span className="material-icons" translate="no">error_outline</span>
              {error}
            </div>
          )}

          {sent ? (
            <div className="auth-art-success">
              <span className="material-icons" translate="no">mark_email_read</span>
              Si un compte existe pour <strong>{email}</strong>, vous recevrez un lien de réinitialisation dans quelques minutes. Vérifiez aussi vos spams.
            </div>
          ) : (
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

              <button type="submit" className="auth-art-btn-submit" disabled={loading}>
                {loading
                  ? <><span className="material-icons" translate="no">hourglass_top</span>Envoi...</>
                  : <><span className="material-icons" translate="no">send</span>Envoyer le lien</>}
              </button>
            </form>
          )}

          <div className="auth-art-footer">
            <Link to="/login">← Retour à la connexion</Link>
          </div>

        </div>
      </div>

    </div>
  );
}

export default ForgotPassword;
