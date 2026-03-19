import { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';
import './Loader.css';

/**
 * Loader avec timeout automatique.
 * - Après `timeout` ms (défaut 10s) : propose de recharger
 * - prop `error`   : affiche directement l'état d'erreur
 * - prop `onRetry` : callback personnalisé au lieu du reload page
 */
const Loader = ({ scrollUp = false, timeout = 10000, error = null, onRetry = null }) => {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (error) return; // Pas de timer si on est déjà en erreur
    const timer = setTimeout(() => setSlow(true), timeout);
    return () => clearTimeout(timer);
  }, [timeout, error]);

  useEffect(() => {
    return () => {
      if (scrollUp) {
        document.body.style.overflow = 'unset';
        window.scrollTo(0, 0);
      }
    };
  }, [scrollUp]);

  const handleRetry = () => {
    if (onRetry) onRetry();
    else window.location.reload();
  };

  // ── État erreur ──────────────────────────────────────
  if (error) {
    return (
      <div className="loading-container">
        <div className="loader-feedback">
          <span className="loader-feedback-icon error-icon material-icons">error_outline</span>
          <p className="loader-feedback-title">Une erreur est survenue</p>
          <p className="loader-feedback-sub">{typeof error === 'string' ? error : 'Impossible de charger le contenu.'}</p>
          <button className="loader-retry-btn" onClick={handleRetry}>
            <span className="material-icons">refresh</span>
            {onRetry ? 'Réessayer' : 'Actualiser la page'}
          </button>
        </div>
      </div>
    );
  }

  // ── Chargement trop long ─────────────────────────────
  if (slow) {
    return (
      <div className="loading-container">
        <div className="loader-feedback">
          <FontAwesomeIcon icon={faSpinner} className="loader-icon" />
          <p className="loader-feedback-title">Ça prend plus de temps que prévu…</p>
          <p className="loader-feedback-sub">Vérifiez votre connexion ou rechargez la page.</p>
          <button className="loader-retry-btn" onClick={handleRetry}>
            <span className="material-icons">refresh</span>
            {onRetry ? 'Réessayer' : 'Actualiser la page'}
          </button>
        </div>
      </div>
    );
  }

  // ── Chargement normal ────────────────────────────────
  return (
    <div className="loading-container">
      <div className="loader">
        <FontAwesomeIcon icon={faSpinner} className="loader-icon" /> Chargement...
      </div>
    </div>
  );
};

export default Loader;
