import React from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useNavigate } from 'react-router-dom'
import './Sidebar.css'
import './Navbar.css'
import logo from '../../assets/ArtInter Logo.png'
import SearchForm from '../SearchForm/SearchForm.jsx'
import MobileSearchBtn from '../MobileSearchBtn/MobileSearchBtn.jsx'
import { useAuth } from '../../contexts/AuthContext.jsx'
import ConfirmModal from '../Modal/ConfirmModal.jsx'
import UserAvatar from '../UserAvatar/UserAvatar.jsx'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faWebAwesome } from '@fortawesome/free-brands-svg-icons'




const Layout = ({ theme, setTheme }) => {
    const { user, isAuthenticated, logout, roleNotif, dismissRoleNotif } = useAuth();
    const role = user?.profil?.role || 'lecteur';

    // State pour la modale de déconnexion
    const [isLogoutModalOpen, setIsLogoutModalOpen] = React.useState(false);

    const handleLogoutClick = () => {
        setIsLogoutModalOpen(true);
    };

    // Dark/Light mode toggle
    const toggle_mode = () => {
        const newTheme = theme === 'light' ? 'dark' : 'light';
        setTheme(newTheme);
        localStorage.setItem('theme', newTheme);
    }

    const [isCollapsed, setIsCollapsed] = React.useState(() => {
        const savedSidebarState = localStorage.getItem("sidebar-collapsed");
        return savedSidebarState ? JSON.parse(savedSidebarState) : false;
    });

    const toggleSidebar = React.useCallback(() => {
        setIsCollapsed(prev => !prev);
    }, []);

    // Auto saved
    React.useEffect(() => {
        localStorage.setItem("sidebar-collapsed", JSON.stringify(isCollapsed));
    }, [isCollapsed]);

    //   // Search icon click
    const searchInputRef = React.useRef(null);
    const searchIconClick = () => {
        if (isCollapsed) toggleSidebar();
        searchInputRef.current?.focus();
    };


    //Sidebar modification 750px
    const sidebarRef = React.useRef(null);

    React.useEffect(() => {
        const handleOutsideClick = (event) => {
            const isTabletOrSmaller = window.innerWidth <= 750;
            if (
                !isCollapsed &&
                sidebarRef.current &&
                !sidebarRef.current.contains(event.target) &&
                isTabletOrSmaller
            ) {
                toggleSidebar();
            }
        };
        document.addEventListener('mousedown', handleOutsideClick);


        return () => {
            document.removeEventListener('mousedown', handleOutsideClick);
        };
    }, [isCollapsed, toggleSidebar]);

    const navigate = useNavigate();
    const handleSidebarSearch = (e) => {
        e.preventDefault();
        const searchValue = searchInputRef.current?.value.trim();

        if (searchValue) {
            const encodedValue = encodeURIComponent(searchValue);
            if (searchValue.startsWith('#')) {
                navigate(`/Catalog?tab=articles&tag=${encodeURIComponent(searchValue.slice(1))}`);
            } else {
                navigate(`/Catalog?tab=articles&q=${encodedValue}`);
            }
        }

        if (window.innerWidth <= 750) {
            setIsCollapsed(true);
        }
    }



    // Notifications
    const [notifCount, setNotifCount] = React.useState(0);
    const [notifOpen, setNotifOpen] = React.useState(false);
    const [notifs, setNotifs] = React.useState([]);
    const notifRef = React.useRef(null);

    React.useEffect(() => {
        if (!isAuthenticated) return;
        const loadNotifs = async () => {
            try {
                const { getMesNotifications } = await import('../../api/api.js');
                const { data } = await getMesNotifications();
                setNotifs(data || []);
                setNotifCount((data || []).filter(n => !n.lu).length);
            } catch {}
        };
        loadNotifs();
    }, [isAuthenticated]);

    React.useEffect(() => {
        if (!notifOpen) return;
        const handleOutside = (e) => {
            if (notifRef.current && !notifRef.current.contains(e.target)) {
                setNotifOpen(false);
            }
        };
        document.addEventListener('mousedown', handleOutside);
        return () => document.removeEventListener('mousedown', handleOutside);
    }, [notifOpen]);

    // Mobile search modal
    const [isSearchOpen, setIsSearchOpen] = React.useState(false);
    const toggleSearch = () => {
        setIsSearchOpen(!isSearchOpen);
    };

    return (
        <>
            <nav className="top-navbar">
                <button className="mobile-menu-btn" onClick={toggleSidebar}>
                    <span className="material-icons" translate="no">menu</span>
                </button>

                <Link to="/" className={`navbar-logo ${isCollapsed ? 'visible' : ''}`}>
                    <img src={logo} alt="ArtInter" />
                    <span className="navbar-brand">ArtInter</span>
                </Link>

                <div className="navbar-search">
                    <SearchForm />
                </div>

                <div className="navbar-actions">
                    <button className="navbar-btn search-mobile-btn" title="Rechercher" onClick={toggleSearch}>
                        <span className="material-icons" translate="no">search</span>
                    </button>

                    {isAuthenticated && (
                        <div ref={notifRef} style={{ position: 'relative' }}>
                            <button className="navbar-btn" title="Notifications" onClick={() => setNotifOpen(p => !p)}>
                                <span className="material-icons" translate="no">notifications</span>
                                {notifCount > 0 && (
                                    <span style={{
                                        position: 'absolute', top: 2, right: 2,
                                        background: '#ef4444', color: '#fff',
                                        fontSize: 10, fontWeight: 700, borderRadius: '50%',
                                        width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        pointerEvents: 'none'
                                    }}>{notifCount > 9 ? '9+' : notifCount}</span>
                                )}
                            </button>
                            {notifOpen && (
                                <div style={{
                                    position: 'absolute', top: '110%', right: 0,
                                    background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                                    borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
                                    width: 320, maxHeight: 400, overflowY: 'auto', zIndex: 500,
                                }}>
                                    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <strong style={{ fontSize: 14 }}>Notifications</strong>
                                        {notifCount > 0 && (
                                            <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--color-accent)' }}
                                                onClick={async () => {
                                                    try { const { toutMarquerLu } = await import('../../api/api.js'); await toutMarquerLu(); setNotifCount(0); setNotifs(p => p.map(n => ({ ...n, lu: true }))); } catch {}
                                                }}>Tout marquer lu</button>
                                        )}
                                    </div>
                                    {notifs.length === 0 ? (
                                        <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-placeholder)', fontSize: 13 }}>Aucune notification</div>
                                    ) : notifs.slice(0, 5).map(n => (
                                        <div key={n.id} style={{
                                            padding: '12px 16px', borderBottom: '1px solid var(--color-border)',
                                            background: n.lu ? 'transparent' : 'rgba(16,185,129,0.05)',
                                            cursor: 'pointer'
                                        }} onClick={async () => {
                                            if (!n.lu) {
                                                try { const { marquerNotifLue } = await import('../../api/api.js'); await marquerNotifLue(n.id); setNotifCount(p => Math.max(0, p - 1)); setNotifs(p => p.map(x => x.id === n.id ? { ...x, lu: true } : x)); } catch {}
                                            }
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                                                <span className="material-icons" style={{ fontSize: 18, marginTop: 1, flexShrink: 0, color: ['restriction','demande_refusee','auteur_banni','article_supprime'].includes(n.type) ? '#ef4444' : ['restriction_levee','demande_approuvee','auteur_debanni'].includes(n.type) ? '#10b981' : n.type === 'role_promu' ? '#7c3aed' : ['article_restreint','role_retire'].includes(n.type) ? '#f59e0b' : '#64748b' }}>
                                                    { n.type === 'role_promu' ? 'verified' : n.type === 'restriction' ? 'gavel' : n.type === 'restriction_levee' ? 'lock_open' : n.type === 'demande_approuvee' ? 'how_to_reg' : n.type === 'demande_refusee' ? 'cancel' : n.type === 'auteur_banni' ? 'block' : n.type === 'auteur_debanni' ? 'check_circle' : n.type === 'article_restreint' ? 'visibility_off' : n.type === 'article_supprime' ? 'delete_forever' : 'notifications' }
                                                </span>
                                                <div>
                                                    <div style={{ fontSize: 13, fontWeight: n.lu ? 500 : 700, color: 'var(--color-text)' }}>{n.titre}</div>
                                                    <div style={{ fontSize: 12, color: 'var(--color-text-placeholder)', marginTop: 2, whiteSpace: 'pre-line', lineHeight: 1.4 }}>{n.message}</div>
                                                    <div style={{ fontSize: 11, color: 'var(--color-text-placeholder)', marginTop: 4 }}>{new Date(n.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</div>
                                                </div>
                                                {!n.lu && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', flexShrink: 0, marginTop: 4 }} />}
                                            </div>
                                        </div>
                                    ))}
                                    <Link
                                        to="/notifications"
                                        onClick={() => setNotifOpen(false)}
                                        style={{
                                            display: 'block', padding: '10px 16px',
                                            textAlign: 'center', fontSize: 13,
                                            color: 'var(--color-accent)', fontWeight: 500,
                                            borderTop: '1px solid var(--color-border)',
                                            textDecoration: 'none'
                                        }}
                                    >
                                        Voir toutes les notifications →
                                    </Link>
                                </div>
                            )}
                        </div>
                    )}

                    {isAuthenticated ? (
                        <>
                            {/* Avatar / Profile Link */}
                            <Link to="/profile">
                                <button className="navbar-btn navbar-btn--avatar" title="Mon Profil">
                                    <UserAvatar profil={user?.profil} size={32} />
                                </button>
                            </Link>
                            {/* Logout Button */}
                            <button className="navbar-btn" title="Déconnexion" onClick={handleLogoutClick}>
                                <span className="material-icons" translate="no" style={{ color: 'var(--color-accent)' }}>logout</span>
                            </button>
                        </>
                    ) : (
                        <Link to="/login">
                            <button className="navbar-btn" title="Connexion">
                                <span className="material-icons" translate="no">account_circle</span>
                            </button>
                        </Link>
                    )}

                </div>


                <MobileSearchBtn isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
            </nav>

            {roleNotif && (
                <div style={{
                    position: 'fixed', top: 56, left: 0, right: 0, zIndex: 1000,
                    background: roleNotif === 'super_admin' ? 'linear-gradient(90deg,#7c3aed,#4f46e5)' : roleNotif === 'admin' ? 'linear-gradient(90deg,#0ea5e9,#10b981)' : 'linear-gradient(90deg,#10b981,#059669)',
                    color: '#fff', padding: '10px 20px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                    fontSize: 14, fontWeight: 500,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span className="material-icons" style={{ fontSize: 20 }}>
                            {roleNotif === 'super_admin' ? 'verified' : roleNotif === 'admin' ? 'admin_panel_settings' : 'edit'}
                        </span>
                        <span>
                            {roleNotif === 'super_admin' && 'Félicitations ! Vous êtes désormais Super Administrateur de la plateforme.'}
                            {roleNotif === 'admin' && 'Félicitations ! Vous avez été promu Administrateur de la plateforme.'}
                            {roleNotif === 'auteur' && 'Félicitations ! Votre compte Auteur a été validé. Vous pouvez maintenant publier des articles.'}
                        </span>
                    </div>
                    <button onClick={dismissRoleNotif} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', padding: 4 }}>
                        <span className="material-icons" style={{ fontSize: 18 }}>close</span>
                    </button>
                </div>
            )}

            <aside ref={sidebarRef} className={`sidebar ${isCollapsed ? "collapsed" : ""}`}>

                <header className="sidebar-header">
                    <Link to="/" className='sidebar-header-logo'>
                        <img src={logo} alt="ArtInter" className="header-logo" />
                        <span className="header-logo-text">ArtInter</span>
                    </Link>

                    <button className={`sidebar-toggle ${isCollapsed ? "collapsed" : ""}`} onClick={toggleSidebar}>
                        <span className="material-icons" translate="no">chevron_left</span>
                    </button>
                </header>

                {/* Menu list */}
                <div className="sidebar-content">

                    {/* Search form */}
                    <form action="#" className="search-form" onClick={searchIconClick} onSubmit={handleSidebarSearch} >
                        <span className="material-icons" translate="no">search</span>
                        <input ref={searchInputRef} type="search" placeholder="Rechercher..." required />
                    </form>

                    {/* Menu list */}
                    <ul className="menu-list">
                        <li className="menu-item ">
                            <NavLink to="/" className="menu-link" onClick={() => { if (window.innerWidth <= 750) { setIsCollapsed(true); } }}>
                                <span className="material-icons" translate="no">home</span>
                                <span className="menu-label">Page d'accueil</span>
                            </NavLink>
                        </li>
                        <li className="menu-item">
                            <NavLink to="/Catalog" className="menu-link" onClick={() => { if (window.innerWidth <= 750) { setIsCollapsed(true); } }}>
                                <span className="material-icons" translate="no">article</span>
                                <span className="menu-label">Articles</span>
                            </NavLink>
                        </li>
                        {isAuthenticated && (
                            <li className="menu-item">
                                <NavLink to="/profile" className="menu-link" onClick={() => { if (window.innerWidth <= 750) { setIsCollapsed(true); } }}>
                                    <span className="material-icons" translate="no">person</span>
                                    <span className="menu-label">Mon Profil</span>
                                </NavLink>
                            </li>
                        )}
                        {isAuthenticated && (
                            <li className="menu-item">
                                <NavLink to="/notifications" className="menu-link" onClick={() => { if (window.innerWidth <= 750) { setIsCollapsed(true); } }}>
                                    <span className="material-icons" translate="no">notifications</span>
                                    <span className="menu-label">
                                        Notifications
                                        {notifCount > 0 && (
                                            <span style={{
                                                marginLeft: 6, background: '#ef4444', color: '#fff',
                                                fontSize: 10, fontWeight: 700, borderRadius: 20,
                                                padding: '1px 6px', display: 'inline-block', lineHeight: '16px'
                                            }}>{notifCount > 9 ? '9+' : notifCount}</span>
                                        )}
                                    </span>
                                </NavLink>
                            </li>
                        )}
                        {isAuthenticated && (role === 'auteur' || role === 'admin' || role === 'super_admin') && (
                            <li className="menu-item">
                                <NavLink to={role === 'super_admin' ? '/dashboard/admin' : `/dashboard/${role}`} className={`menu-link ${(role === 'admin' || role === 'super_admin') ? 'admin' : ''}`} onClick={() => { if (window.innerWidth <= 750) { setIsCollapsed(true); } }}>
                                    {(role === 'admin' || role === 'super_admin') ? <span><FontAwesomeIcon icon={faWebAwesome} /></span> : <span className="material-icons" translate="no">dashboard</span>}
                                    <span className="menu-label">{(role === 'admin' || role === 'super_admin') ? 'Admin' : 'Mon Espace'}</span>
                                </NavLink>
                            </li>
                        )}
                        {isAuthenticated && (role === 'admin' || role === 'super_admin') && (
                            <li className="menu-item">
                                <NavLink to={`/dashboard/auteur`} className="menu-link" onClick={() => { if (window.innerWidth <= 750) { setIsCollapsed(true); } }}>
                                    <span className="material-icons" translate="no">dashboard</span>
                                    <span className="menu-label">Mon Espace</span>
                                </NavLink>
                            </li>
                        )}

                        <li className="menu-item">
                            <NavLink to="/#aboutUs" className="menu-link" onClick={() => { if (window.innerWidth <= 750) { setIsCollapsed(true); } }}>
                                <span className="material-icons" translate="no">info</span>
                                <span className="menu-label">À propos</span>
                            </NavLink>
                        </li>

                    </ul>
                </div>

                {/* Sidebar footer */}
                <div className="sidebar-footer">
                    <button onClick={() => { toggle_mode() }} className="theme-toggle">
                        <div className="theme-label">
                            <span className="theme-icon material-icons" translate="no">{isCollapsed ? (theme === "light" ? "light_mode" : "dark_mode") : "dark_mode"}</span>
                            <span className="theme-text">Dark Mode</span>
                        </div>
                        <div className="theme-toggle-track">
                            <div className="theme-toggle-indicator">

                            </div>
                        </div>
                    </button>
                </div>

            </aside>

            {/* Modale de déconnexion */}
            <ConfirmModal
                isOpen={isLogoutModalOpen}
                onClose={() => setIsLogoutModalOpen(false)}
                onConfirm={logout}
                title="Déconnexion"
                message="Êtes-vous sûr de vouloir vous déconnecter ?"
                confirmText="Se déconnecter"
                isDanger={true}
            />
        </>
    )
}

export default Layout
