import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { logout } from '../../api/api.js';
import ConfirmModal from '../Modal/ConfirmModal.jsx';
import './DashboardLayout.css';

function DashboardLayout({ children, role = 'lecteur', user }) {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
    const navigate = useNavigate();

    const handleLogoutClick = () => {
        setIsLogoutModalOpen(true);
    };

    const confirmLogout = () => {
        logout();
    };

    // Menu items selon le rôle
    const getMenuItems = () => {
        if (role === 'lecteur') {
            return [
                { icon: '👤', label: 'Mon Profil', path: '/dashboard/lecteur' },
                { icon: '🏠', label: 'Retour au site', path: '/' },
            ];
        }

        if (role === 'auteur') {
            return [
                { icon: '📊', label: 'Vue d\'ensemble', path: '/dashboard/auteur' },
                { icon: '📝', label: 'Mes Articles', path: '/dashboard/auteur/articles' },
                { icon: '➕', label: 'Nouvel Article', path: '/dashboard/auteur/new' },
                { icon: '🏷️', label: 'Demandes Catégorie', path: '/dashboard/auteur/categories' },
                { icon: '🏠', label: 'Retour au site', path: '/' },
            ];
        }

        if (role === 'admin') {
            return [
                { icon: '📊', label: 'Statistiques', path: '/dashboard/admin' },
                { icon: '👥', label: 'Utilisateurs', path: '/dashboard/admin/users' },
                { icon: '✅', label: 'Demandes Auteur', path: '/dashboard/admin/author-requests' },
                { icon: '🏷️', label: 'Demandes Catégorie', path: '/dashboard/admin/category-requests' },
                { icon: '📰', label: 'Articles', path: '/dashboard/admin/articles' },
                { icon: '🗂️', label: 'Catégories', path: '/dashboard/admin/categories' },
                { icon: '👤', label: 'Mon Profil', path: '/dashboard/admin/profile' },
                { icon: '🏠', label: 'Retour au site', path: '/' },
            ];
        }

        return [];
    };

    const menuItems = getMenuItems();

    return (
        <div className="dashboard-container">
            {/* Sidebar - seulement pour auteur et admin */}
            {(role === 'auteur' || role === 'admin') && (
                <aside className={`dashboard-sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
                    <div className="sidebar-header">
                        <h2>{role === 'admin' ? '👑 Admin' : '✍️ Auteur'}</h2>
                        <button
                            className="sidebar-toggle"
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                        >
                            {sidebarOpen ? '◀' : '▶'}
                        </button>
                    </div>

                    <nav className="sidebar-nav">
                        {menuItems.map((item, index) => (
                            <Link
                                key={index}
                                to={item.path}
                                className="sidebar-item"
                            >
                                <span className="sidebar-icon">{item.icon}</span>
                                {sidebarOpen && <span className="sidebar-label">{item.label}</span>}
                            </Link>
                        ))}
                    </nav>

                    <div className="sidebar-footer">
                        <button onClick={handleLogoutClick} className="logout-btn">
                            <span className="sidebar-icon">🚪</span>
                            {sidebarOpen && <span>Déconnexion</span>}
                        </button>
                    </div>
                </aside>
            )}

            {/* Main Content */}
            <main className={`dashboard-main ${role === 'lecteur' ? 'no-sidebar' : ''}`}>
                {/* Header */}
                <header className="dashboard-header">
                    <div className="header-left">
                        <h1>
                            {role === 'lecteur' && '📖 Mon Profil'}
                            {role === 'auteur' && '✍️ Espace Auteur'}
                            {role === 'admin' && '👑 Administration'}
                        </h1>
                    </div>
                    <div className="header-right">
                        <div className="user-info">
                            <span className="user-name">
                                {user?.user_metadata?.nom || user?.profil?.nom || user?.email || 'Utilisateur'}
                            </span>
                            <span className="user-role">{role}</span>
                        </div>
                        {role === 'lecteur' && (
                            <button onClick={handleLogoutClick} className="btn-logout-header">
                                Déconnexion
                            </button>
                        )}
                    </div>
                </header>

                {/* Content */}
                <div className="dashboard-content">
                    {children}
                </div>
            </main>

            {/* Modale de déconnexion */}
            <ConfirmModal
                isOpen={isLogoutModalOpen}
                onClose={() => setIsLogoutModalOpen(false)}
                onConfirm={confirmLogout}
                title="Déconnexion"
                message="Êtes-vous sûr de vouloir vous déconnecter ?"
                confirmText="Se déconnecter"
                isDanger={true}
            />
        </div>
    );
}

export default DashboardLayout;
