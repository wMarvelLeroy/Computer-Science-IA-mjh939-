import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import Loader from './Loader/Loader.jsx';

function ProtectedRoute({ children, requiredRole }) {
    const { user, loading, isAuthenticated } = useAuth();

    if (loading) {
        return <Loader />;
    }
    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    if (requiredRole) {
        const userRole = user?.profil?.role || 'lecteur';

        if (userRole !== requiredRole && requiredRole !== 'any') {
            switch (userRole) {
                case 'admin':
                    return <Navigate to="/dashboard/admin" replace />;
                case 'auteur':
                    return <Navigate to="/dashboard/auteur" replace />;
                default:
                    return <Navigate to="/dashboard/lecteur" replace />;
            }
        }
    }

    // Tout est OK, afficher le contenu
    return children;
}

export default ProtectedRoute;
