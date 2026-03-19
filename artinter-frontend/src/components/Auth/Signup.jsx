import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { signup, signin } from '../../api/api.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPen } from '@fortawesome/free-solid-svg-icons';
import logo from '../../assets/ArtInter Logo (no background).png';
import './Auth.css';

function getPasswordStrength(pwd) {
  if (!pwd)            return null;
  if (pwd.length < 6)  return 'faible';
  if (pwd.length < 10) return 'moyen';
  return 'fort';
}
const strengthLabels = { faible: 'Faible', moyen: 'Moyen', fort: 'Fort' };

function Signup() {
  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { login } = useAuth();
  const strength = getPasswordStrength(password);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) { setError('Les mots de passe ne correspondent pas'); return; }
    if (password.length < 6)          { setError('Le mot de passe doit contenir au moins 6 caractères'); return; }
    if (!nom.trim())                  { setError("Le nom d'utilisateur est requis"); return; }
    try {
      setLoading(true);
      const response = await signup(email, password, nom);
      if (response && response.success) {
        try {
          const sr = await signin(email, password);
          if (sr && sr.success) { login(sr.data.user); navigate('/'); }
          else navigate('/login');
        } catch { navigate('/login'); }
      } else {
        setError(response?.error || 'Erreur lors de la création du compte');
      }
    } catch (err) {
      let msg = "Une erreur est survenue lors de l'inscription";
      if (err.response) {
        msg = err.response.data?.error || msg;
        if (err.response.status === 409) msg = 'Cet email est déjà utilisé';
        if (err.response.status === 400) msg = 'Données invalides. Vérifiez vos informations.';
      } else if (err.request) {
        msg = 'Impossible de contacter le serveur.';
      } else { msg = err.message || msg; }
      setError(msg);
    } finally { setLoading(false); }
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
              Rejoignez<br />notre <em>communauté</em>
            </h2>
            <p className="auth-left-tagline">
              Créez votre espace, publiez et connectez-vous à des milliers de passionnés d'art.
            </p>
            <div className="auth-left-sep" />
          </div>

          <ul className="auth-left-features">
            <li>
              <div className="auth-feat-icon">
                <span className="material-icons" translate="no">edit_note</span>
              </div>
              Publiez vos propres articles
            </li>
            <li>
              <div className="auth-feat-icon">
                <span className="material-icons" translate="no">favorite</span>
              </div>
              Suivez vos artistes favoris
            </li>
            <li>
              <div className="auth-feat-icon">
                <span className="material-icons" translate="no">group</span>
              </div>
              Rejoignez une communauté créative
            </li>
          </ul>

        </div>{/* fin auth-left-top */}

        <div className="auth-left-bottom">
          <p className="auth-left-quote">
            "Créer, c'est donner une forme à son destin." — Albert Camus
          </p>
        </div>
      </div>

      {/* ══ PANNEAU DROIT ══ */}
      <div className="auth-art-right-panel">
        <div className="auth-form-inner">

          <div className="auth-form-header">
            <div className="auth-form-icon-wrap">
              <FontAwesomeIcon icon={faPen} color="#10b981" />
            </div>
            <h1 className="auth-form-title">Inscription</h1>
            <p className="auth-form-sub">Rejoignez notre communauté d'artistes</p>
          </div>

          {error && (
            <div className="auth-art-error">
              <span className="material-icons" translate="no">error_outline</span>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="auth-art-form-group">
              <label htmlFor="nom">Nom d'utilisateur</label>
              <div className="auth-art-input-wrapper">
                <span className="material-icons auth-art-input-icon" translate="no">person</span>
                <input id="nom" type="text" value={nom} onChange={(e) => setNom(e.target.value)}
                  placeholder="Ex: Peter Parker" required minLength="2" autoComplete="name" />
              </div>
            </div>

            <div className="auth-art-form-group">
              <label htmlFor="email">Email</label>
              <div className="auth-art-input-wrapper">
                <span className="material-icons auth-art-input-icon" translate="no">mail</span>
                <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="votre@email.com" required autoComplete="email" />
              </div>
            </div>

            <div className="auth-art-form-group">
              <label htmlFor="password">Mot de passe</label>
              <div className="auth-art-input-wrapper has-toggle">
                <span className="material-icons auth-art-input-icon" translate="no">lock</span>
                <input id="password" type={showPassword ? 'text' : 'password'} value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" required minLength="6" autoComplete="new-password" />
                <button type="button" className="auth-art-input-toggle"
                  onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
                  <span className="material-icons" translate="no">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
              {password && (
                <div className="auth-art-password-strength">
                  <div className="auth-art-strength-bars">
                    <div className={`auth-art-strength-bar ${strength ? `active-${strength}` : ''}`} />
                    <div className={`auth-art-strength-bar ${strength === 'moyen' || strength === 'fort' ? `active-${strength}` : ''}`} />
                    <div className={`auth-art-strength-bar ${strength === 'fort' ? 'active-fort' : ''}`} />
                  </div>
                  <span className={`auth-art-strength-label ${strength}`}>{strengthLabels[strength]}</span>
                </div>
              )}
            </div>

            <div className="auth-art-form-group">
              <label htmlFor="confirmPassword">Confirmer le mot de passe</label>
              <div className="auth-art-input-wrapper has-toggle">
                <span className="material-icons auth-art-input-icon" translate="no">lock_reset</span>
                <input id="confirmPassword" type={showConfirm ? 'text' : 'password'} value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••" required autoComplete="new-password" />
                <button type="button" className="auth-art-input-toggle"
                  onClick={() => setShowConfirm(!showConfirm)} tabIndex={-1}>
                  <span className="material-icons" translate="no">
                    {showConfirm ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
              {confirmPassword && (
                <small className="auth-art-hint" style={{
                  color: confirmPassword === password ? 'var(--color-accent)' : 'var(--color-accent-red)'
                }}>
                  {confirmPassword === password ? '✓ Les mots de passe correspondent' : '✗ Ne correspondent pas'}
                </small>
              )}
            </div>

            <button type="submit" className="auth-art-btn-submit" disabled={loading}>
              {loading
                ? <><span className="material-icons" translate="no">hourglass_top</span>Création...</>
                : <><span className="material-icons" translate="no">how_to_reg</span>Créer mon compte</>}
            </button>
          </form>

          <div className="auth-art-footer">
            Déjà un compte ? <Link to="/login">Se connecter</Link>
          </div>

        </div>
      </div>

    </div>
  );
}

export default Signup;
