import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../config/supabase.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import Loader from '../../components/Loader/Loader.jsx';

function AuthCallback() {
  const navigate   = useNavigate();
  const { login }  = useAuth();

  useEffect(() => {
    const handleCallback = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (error || !data?.session) {
        navigate('/login');
        return;
      }

      const session = data.session;

      localStorage.setItem('token', session.access_token);
      localStorage.setItem('refresh_token', session.refresh_token);

      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/auth/user`, {
          headers: { Authorization: `Bearer ${session.access_token}` }
        });
        const json = await res.json();
        if (json.success) {
          login(json.data);
          const params   = new URLSearchParams(window.location.search);
          const returnTo = params.get('returnTo') || sessionStorage.getItem('auth_return_to') || '/';
          sessionStorage.removeItem('auth_return_to');
          navigate(returnTo);
          return;
        }
      } catch { /* fallback ci-dessous */ }

      navigate('/');
    };

    handleCallback();
  }, [navigate, login]);

  return <Loader />;
}

export default AuthCallback;
