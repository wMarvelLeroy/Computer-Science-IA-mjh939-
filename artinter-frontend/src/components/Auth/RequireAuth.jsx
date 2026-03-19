import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';
import Loader from '../Loader/Loader.jsx';
import './RequireAuth.css';

const RequireAuth = ({ children }) => {
  const { user, loading, checkAuth } = useAuth();
  const navigate = useNavigate();

  if (loading) return <Loader />;

  if (!user) {
    const handleLogin = () => {
      sessionStorage.setItem('auth_return_to', window.location.pathname + window.location.search);
      navigate('/login');
    };

    return (
      <div className="ra-page">
        <div className="ra-card">
          <div className="ra-icon-wrap">
            <span className="material-icons">lock</span>
          </div>
          <h2 className="ra-title">Connexion requise</h2>
          <p className="ra-desc">
            Cette page est réservée aux membres connectés.<br />
            Connectez-vous pour continuer.
          </p>
          <div className="ra-actions">
            <button className="ra-btn-login" onClick={handleLogin}>
              <span className="material-icons">login</span>
              Se connecter
            </button>
            <button className="ra-btn-retry" onClick={checkAuth}>
              <span className="material-icons">refresh</span>
              Réessayer
            </button>
          </div>
        </div>
      </div>
    );
  }

  return children;
};

export default RequireAuth;
