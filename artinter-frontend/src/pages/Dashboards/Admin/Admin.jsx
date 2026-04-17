import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getCurrentUser, getStatsGlobal, getAllDemandesAuteur, getAllDemandesCategorie, getAllSignalements, getAllDemandesReexamination } from '../../../api/api.js';
import StatsCard from '../../../components/Dashboard/StatsCard.jsx';
import Loader from '../../../components/Loader/Loader.jsx';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {  faWebAwesome, faUsers, faTags, faEye, faPen, faExclamationTriangle, faFire, faHeart, faArrowRight, faNewspaper, faFilePen, faFlag, faScaleBalanced, faClockRotateLeft } from '@fortawesome/free-solid-svg-icons';
import './Admin.css';

function DashboardAdmin() {
    const [user, setUser] = useState(null);
    const [stats, setStats] = useState(null);
    const [demandesAuteur, setDemandesAuteur] = useState([]);
    const [demandesCategorie, setDemandesCategorie] = useState([]);
    const [signalements, setSignalements] = useState([]);
    const [reexaminations, setReexaminations] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    const loadData = useCallback(async () => {
        try {
            const userResponse = await getCurrentUser();
            const currentUser = userResponse.data;

            if (!currentUser) {
                navigate('/login');
                return;
            }

            // Vérifier si l'utilisateur est bien admin
            if (!['admin','super_admin'].includes(currentUser.profil?.role)) {
                navigate('/dashboard/lecteur');
                return;
            }

            setUser(currentUser);

            try {
                const statsResponse = await getStatsGlobal();
                setStats(statsResponse.data);
            } catch (err) {
                console.error('Erreur stats:', err);
            }

            try {
                const demandesAuteurResponse = await getAllDemandesAuteur('en_attente');
                setDemandesAuteur(demandesAuteurResponse.data || []);
            } catch (err) {
                console.error('Erreur demandes auteur:', err);
            }

            try {
                const demandesCategorieResponse = await getAllDemandesCategorie('en_attente');
                setDemandesCategorie(demandesCategorieResponse.data || []);
            } catch (err) {
                console.error('Erreur demandes catégorie:', err);
            }

            try {
                const signalementsResponse = await getAllSignalements('en_attente');
                setSignalements(signalementsResponse.data || []);
            } catch (err) {
                console.error('Erreur signalements:', err);
            }

            try {
                const reexRes = await getAllDemandesReexamination('en_attente');
                setReexaminations(reexRes.data || []);
            } catch (err) {
                console.error('Erreur réexaminations:', err);
            }

        } catch (err) {
            console.error('Erreur:', err);
            navigate('/login');
        } finally {
            setLoading(false);
        }
    }, [navigate]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    if (loading) {
        return <Loader />;
    }

    return (
            <div className="admin-dashboard fadeInContainer">

                <div className="dashboard-welcome">
                    <h2><FontAwesomeIcon icon={faWebAwesome} color='#ffc23d'/> Administration ArtInter</h2>
                    <p>Vue d'ensemble de la plateforme</p>
                </div>

                {/* Stats Globales */}
                <div className="stats-grid">
                    <StatsCard
                        icon={<FontAwesomeIcon icon={faUsers} />}
                        title="Utilisateurs"
                        value={stats?.total_users || 0}
                        change={`${stats?.total_auteurs || 0} auteur${(stats?.total_auteurs || 0) > 1 ? 's' : ''}`}
                        color="blue"
                    />
                    <StatsCard
                        icon={<FontAwesomeIcon icon={faPen} />}
                        title="Articles"
                        value={stats?.total_articles || 0}
                        change={`${stats?.articles_publies || 0} publiés`}
                        color="green"
                    />
                    <StatsCard
                        icon={<FontAwesomeIcon icon={faTags} />}
                        title="Catégories"
                        value={stats?.total_categories || 0}
                        color="purple"
                    />
                    <StatsCard
                        icon={<FontAwesomeIcon icon={faEye} />}
                        title="Vues Totales"
                        value={stats?.total_vues || 0}
                        color="orange"
                    />
                </div>

                {/* Demandes en attente */}
                <div className="alerts-section">
                    {signalements.length > 0 && (
                        <div className="alert-card" style={{ background: 'rgba(239,68,68,0.07)', borderColor: '#ef4444' }}>
                            <div className="alert-icon">🚨</div>
                            <div className="alert-content">
                                <h4>Signalements en attente</h4>
                                <p>{signalements.length} signalement{signalements.length > 1 ? 's' : ''} à examiner</p>
                            </div>
                            <div className="alert-actions">
                                <button className="btn btn-sm" onClick={() => navigate('/dashboard/admin/signalements')}>
                                    Voir les signalements
                                </button>
                            </div>
                        </div>
                    )}
                    {reexaminations.length > 0 && (
                        <div className="alert-card" style={{ background: 'rgba(124,58,237,0.07)', borderColor: '#7c3aed' }}>
                            <div className="alert-icon">⚖️</div>
                            <div className="alert-content">
                                <h4>Demandes de réexamination</h4>
                                <p>{reexaminations.length} demande{reexaminations.length > 1 ? 's' : ''} en attente</p>
                            </div>
                            <div className="alert-actions">
                                <button className="btn btn-sm" onClick={() => navigate('/dashboard/admin/reexamination')}>
                                    Voir les demandes
                                </button>
                            </div>
                        </div>
                    )}
                    {(demandesAuteur.length > 0 || demandesCategorie.length > 0) && (
                        <div className="alert-card warning">
                            <div className="alert-icon"><FontAwesomeIcon icon={faExclamationTriangle} /></div>
                            <div className="alert-content">
                                <h4>Demandes en attente</h4>
                                <p>
                                    {demandesAuteur.length > 0 && `${demandesAuteur.length} demande(s) auteur`}
                                    {demandesAuteur.length > 0 && demandesCategorie.length > 0 && ' • '}
                                    {demandesCategorie.length > 0 && `${demandesCategorie.length} demande(s) catégorie`}
                                </p>
                            </div>
                            <div className="alert-actions">
                                {demandesAuteur.length > 0 && (
                                    <button
                                        className="btn btn-sm"
                                        onClick={() => navigate('/dashboard/admin/author-requests')}
                                    >
                                        Voir les demandes auteur
                                    </button>
                                )}
                                {demandesCategorie.length > 0 && (
                                    <button
                                        className="btn btn-sm"
                                        onClick={() => navigate('/dashboard/admin/category-requests')}
                                    >
                                        Voir les demandes catégorie
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Quick Actions */}
                <div className="quick-actions-admin">
                    <button
                        className="admin-action-card"
                        onClick={() => navigate('/dashboard/admin/users')}
                    >
                        <span className="action-icon"><FontAwesomeIcon icon={faUsers} color='var(--color-text-primary)'/></span>
                        <div className="action-content">
                            <strong>Gestion Utilisateurs</strong>
                            <p>Gérer les rôles et permissions</p>
                        </div>
                        <span className="action-arrow"><FontAwesomeIcon icon={faArrowRight} /></span>
                    </button>

                    <button
                        className="admin-action-card"
                        onClick={() => navigate('/dashboard/admin/author-requests')}
                    >
                        <span className="action-icon"><FontAwesomeIcon icon={faFilePen} color='var(--color-text-primary)'/></span>
                        <div className="action-content">
                            <strong>Demandes Auteur</strong>
                            <p>{demandesAuteur.length} en attente</p>
                        </div>
                        <span className="action-arrow"><FontAwesomeIcon icon={faArrowRight} /></span>
                    </button>

                    <button
                        className="admin-action-card"
                        onClick={() => navigate('/dashboard/admin/category-requests')}
                    >
                        <span className="action-icon"><FontAwesomeIcon icon={faTags} color='var(--color-text-primary)'/></span>
                        <div className="action-content">
                            <strong>Demandes Catégorie</strong>
                            <p>{demandesCategorie.length} en attente</p>
                        </div>
                        <span className="action-arrow"><FontAwesomeIcon icon={faArrowRight} /></span>
                    </button>

                    <button
                        className="admin-action-card"
                        onClick={() => navigate('/dashboard/admin/articles')}
                    >
                        <span className="action-icon"><FontAwesomeIcon icon={faNewspaper} color='var(--color-text-primary)'/></span>
                        <div className="action-content">
                            <strong>Tous les Articles</strong>
                            <p>Modération et gestion</p>
                        </div>
                        <span className="action-arrow"><FontAwesomeIcon icon={faArrowRight} /></span>
                    </button>

                    <button
                        className="admin-action-card"
                        onClick={() => navigate('/dashboard/admin/categories')}
                    >
                        <span className="action-icon"><FontAwesomeIcon icon={faTags} color='var(--color-text-primary)'/></span>
                        <div className="action-content">
                            <strong>Catégories</strong>
                            <p>Gérer les catégories</p>
                        </div>
                        <span className="action-arrow"><FontAwesomeIcon icon={faArrowRight} /></span>
                    </button>

                    <button
                        className="admin-action-card"
                        onClick={() => navigate('/dashboard/admin/signalements')}
                    >
                        <span className="action-icon"><FontAwesomeIcon icon={faFlag} color='#ef4444'/></span>
                        <div className="action-content">
                            <strong>Signalements</strong>
                            <p>{signalements.length} en attente</p>
                        </div>
                        <span className="action-arrow"><FontAwesomeIcon icon={faArrowRight} /></span>
                    </button>

                    <button
                        className="admin-action-card"
                        onClick={() => navigate('/dashboard/admin/reexamination')}
                    >
                        <span className="action-icon"><FontAwesomeIcon icon={faScaleBalanced} color='#7c3aed'/></span>
                        <div className="action-content">
                            <strong>Réexaminations</strong>
                            <p>{reexaminations.length} en attente</p>
                        </div>
                        <span className="action-arrow"><FontAwesomeIcon icon={faArrowRight} /></span>
                    </button>

                    {['super_admin'].includes(user?.profil?.role) && (
                        <button
                            className="admin-action-card"
                            onClick={() => navigate('/dashboard/admin/activity')}
                        >
                            <span className="action-icon"><FontAwesomeIcon icon={faClockRotateLeft} color='var(--color-text-primary)'/></span>
                            <div className="action-content">
                                <strong>Journal d'activité</strong>
                                <p>Historique des actions admin</p>
                            </div>
                            <span className="action-arrow"><FontAwesomeIcon icon={faArrowRight} /></span>
                        </button>
                    )}
                </div>

                <div className="section-card adminToSpace" onClick={() => navigate('/dashboard/auteur')}>
                    <h2>Accéder à votre espace auteur</h2>
                    <p>Vous pouvez accéder à votre espace auteur en cliquant ici</p>
                </div>

                {/* Top Articles */}
                {stats?.top_articles && stats.top_articles.length > 0 && (
                    <div className="section-card">
                        <h3><FontAwesomeIcon icon={faFire} color= "#fa7000"/> Articles les plus populaires</h3>
                        <div className="top-articles-list">
                            {stats.top_articles.slice(0, 5).map((article, index) => (
                                <Link
                                    key={article.id}
                                    to={article.slug ? `/article/${article.slug}` : `/dashboard/admin/articles`}
                                    target={article.slug ? '_blank' : undefined}
                                    className="top-article-item"
                                    style={{ textDecoration: 'none', color: 'inherit', display: 'flex', cursor: 'pointer' }}
                                >
                                    <span className="article-rank">#{index + 1}</span>
                                    <div className="article-details">
                                        <h4>{article.titre}</h4>
                                        <p className="article-author">Par {article.auteur_nom}</p>
                                    </div>
                                    <div className="article-stats-mini">
                                        <span><FontAwesomeIcon icon={faEye} color='var(--color-text-primary)'/>{article.vues || 0}</span>
                                        <span><FontAwesomeIcon icon={faHeart} color='red'/>{article.likes || 0}</span>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}

            </div>
    );
}

export default DashboardAdmin;
