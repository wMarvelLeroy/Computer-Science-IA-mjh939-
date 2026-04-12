import { createContext, useContext, useState, useEffect } from 'react';
import { getCurrentUser, logout as apiLogout } from '../api/api.js';

const AuthContext = createContext(null);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [roleNotif, setRoleNotif] = useState(null);

    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
        const token = localStorage.getItem('token');

        if (!token) {
            setLoading(false);
            setIsAuthenticated(false);
            setUser(null);
            return;
        }

        try {
            const response = await getCurrentUser();

            if (response.success && response.data) {
                setUser(response.data);
                setIsAuthenticated(true);
                const newRole = response.data.profil?.role;
                const lastRole = localStorage.getItem('artinter_last_role');
                if (newRole && newRole !== lastRole && ['auteur', 'admin', 'super_admin'].includes(newRole)) {
                    setRoleNotif(newRole);
                }
                localStorage.setItem('artinter_last_role', newRole || 'lecteur');
            } else {
                logout();
            }
        } catch (error) {
            console.error('Erreur vérification auth:', error);
            if (error.response?.status === 401) {
                setUser(null);
                setIsAuthenticated(false);
                setRoleNotif(null);
                localStorage.removeItem('token');
                localStorage.removeItem('refresh_token');
            }
        } finally {
            setLoading(false);
        }
    };

    const login = (userData) => {
        setUser(userData);
        setIsAuthenticated(true);
    };

    const logout = () => {
        setUser(null);
        setIsAuthenticated(false);
        setRoleNotif(null);
        localStorage.removeItem('artinter_last_role');
        apiLogout();
    };

    const updateUser = (updatedData) => {
        setUser(prev => ({ ...prev, ...updatedData }));
    };

    const dismissRoleNotif = () => setRoleNotif(null);

    const getRole = () => {
        return user?.profil?.role || 'lecteur';
    };

    const value = {
        user,
        loading,
        isAuthenticated,
        login,
        logout,
        updateUser,
        checkAuth,
        getRole,
        roleNotif,
        dismissRoleNotif,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}
