import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './SessionExpiredModal.css';

const SessionExpiredModal = () => {
  const [visible, setVisible] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = () => setVisible(true);
    window.addEventListener('auth:session-expired', handler);
    return () => window.removeEventListener('auth:session-expired', handler);
  }, []);

  if (!visible) return null;

  const handleLogin = () => {
    const returnTo = window.location.pathname + window.location.search + window.location.hash;
    sessionStorage.setItem('auth_return_to', returnTo);
    setVisible(false);
    navigate('/login');
  };

  return (
    <div className="se-overlay">
      <div className="se-modal">
        <div className="se-icon-wrap">
          <span className="material-icons">lock_clock</span>
        </div>
        <h3 className="se-title">Session expirée</h3>
        <p className="se-desc">
          Vous avez été déconnecté automatiquement.<br />
          Souhaitez-vous vous reconnecter ?
        </p>
        <div className="se-actions">
          <button className="se-btn-login" onClick={handleLogin}>
            <span className="material-icons">login</span>
            Se reconnecter
          </button>
          <button className="se-btn-stay" onClick={() => setVisible(false)}>
            Rester sur cette page
          </button>
        </div>
      </div>
    </div>
  );
};

export default SessionExpiredModal;
