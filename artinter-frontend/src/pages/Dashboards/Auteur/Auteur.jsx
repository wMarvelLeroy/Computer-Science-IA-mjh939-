import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser, getArticlesByAuteur, getStatsAuteur, getDemandeAuteurByUser } from '../../../api/api.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHeart, faCircle, faPen, faEye, faPlus, faTags, faPenToSquare, faTrophy, faTimes } from '@fortawesome/free-solid-svg-icons';
import StatsCard from '../../../components/Dashboard/StatsCard.jsx';
import StatusBadge from '../../../components/Dashboard/StatusBadge.jsx';
import Loader from '../../../components/Loader/Loader.jsx'; 
import './Auteur.css';

function DashboardAuteur() {
    const [user, setUser] = useState(null);
    const [articles, setArticles] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showWelcome, setShowWelcome] = useState(false);
    const navigate = useNavigate();

    const loadData = useCallback(async () => {
        try {
            const userResponse = await getCurrentUser();
            const currentUser = userResponse.data;

            if (!currentUser) {
                navigate('/login');
                return;
            }

            if (!['auteur', 'admin', 'super_admin'].includes(currentUser.profil?.role)) {
                navigate('/dashboard/lecteur');
                return;
            }

            setUser(currentUser);

            // Vérifier si c'est un nouvel auteur (demande approuvée et bannière non fermée)
            try {
                const demandeResponse = await getDemandeAuteurByUser(currentUser.id);
                if (demandeResponse.data?.statut === 'approuvee') {
                     const key = `welcome_author_${currentUser.id}`;
                     const hasSeen = localStorage.getItem(key);
                     if (!hasSeen) {
                         setShowWelcome(true);
                     }
                }
            } catch (err) {
                // Ignore errors here
            }

            // Charger les articles de l'auteur
            try {
                const articlesResponse = await getArticlesByAuteur(currentUser.id);
                setArticles(articlesResponse.data || []);
            } catch (err) {
                console.error('Erreur chargement articles:', err);
                setArticles([]);
            }

            // Charger les stats (si disponible)
            try {
                const statsResponse = await getStatsAuteur(currentUser.id);
                setStats(statsResponse.data);
            } catch (err) {
                console.error('Erreur chargement stats:', err);
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

    const dismissWelcome = () => {
        if (user) {
            localStorage.setItem(`welcome_author_${user.id}`, 'true');
        }
        setShowWelcome(false);
    };

    if (loading) {
        return <Loader />;
    }

    // Calculer les stats basiques
    const totalArticles = articles.length;
    const articlesPublies = articles.filter(a => a.est_publie).length;
    const brouillons = totalArticles - articlesPublies;
    const totalVues = articles.reduce((sum, a) => sum + (a.vues || 0), 0);
    const totalLikes = articles.reduce((sum, a) => sum + (a.likes_count || 0), 0);

    // Les 3 derniers articles (triés par date décroissante)
    const recentArticles = [...articles]
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 3);

    return (

            <div className="auteur-dashboard fadeInContainer">

                <div className="dashboard-welcome">
                    <h2>Bienvenue, {user?.user_metadata?.nom || user?.profil?.nom || 'Auteur'} !</h2>
                    <p>Voici un aperçu de votre activité</p>
                </div>

                {showWelcome && (
                    <div className="welcome-banner-author">
                        <div className="welcome-content">
                            <h3><FontAwesomeIcon icon={faTrophy} /> Félicitations !</h3>
                            <p>Votre demande a été approuvée avec succès. Bienvenue dans l'espace auteur ! Commencez par créer votre premier article.</p>
                        </div>
                        <button className="btn-close-welcome" onClick={dismissWelcome} title="Fermer">
                            <FontAwesomeIcon icon={faTimes} />
                        </button>
                    </div>
                )}

                {/* Stats Cards */}
                <div className="stats-grid">
                    <StatsCard
                        icon={<FontAwesomeIcon icon={faPen} />}
                        title="Total Articles"
                        value={totalArticles}
                        change={`${articlesPublies} publiés`}
                        color="blue"
                    />
                    <StatsCard
                        icon={<FontAwesomeIcon icon={faEye} />}
                        title="Total Vues"
                        value={totalVues}
                        color="green"
                    />
                    <StatsCard
                        icon={<FontAwesomeIcon icon={faHeart} color='red'/>}
                        title="Total Likes"
                        value={totalLikes}
                        color="red"
                    />
                    <StatsCard
                        icon={<FontAwesomeIcon icon={faCircle} color='orange'/>}
                        title="Brouillons"
                        value={brouillons}
                        color="orange"
                    />
                </div>

                {/* Quick Actions */}
                <div className="section-card">
                    <div className="section-header">
                        <h2 className="section-title">Creativite</h2>
                    </div>

                    <div className="quick-actions">
                    <button
                        className="action-btn primary"
                        onClick={() => navigate('/dashboard/auteur/new')}
                    >
                        <span className="btn-icon"><FontAwesomeIcon icon={faPlus} color='#ffc23d' /></span>
                        <div>
                            <strong>Nouvel Article</strong>
                            <p>Créer un nouvel article</p>
                        </div>
                    </button>
                    <button
                        className="action-btn"
                        onClick={() => navigate('/dashboard/auteur/articles')}
                    >
                        <span className="btn-icon"><FontAwesomeIcon icon={faPen} color='var(--color-text-primary)' /></span>
                        <div>
                            <strong>Mes Articles</strong>
                            <p>Gérer mes {totalArticles} articles</p>
                        </div>
                    </button>
                    <button
                        className="action-btn"
                        onClick={() => navigate('/dashboard/auteur/categories')}
                    >
                        <span className="btn-icon"><FontAwesomeIcon icon={faTags} color='var(--color-text-primary)' /></span>
                        <div>
                            <strong>Catégories</strong>
                            <p>Proposer une catégorie</p>
                        </div>
                    </button>
                </div>
                </div>
                

                {/* Recent Articles */}
                <div className="section-card">
                    <div className="section-header">
                        <h3><FontAwesomeIcon icon={faPenToSquare} color='var(--color-text-primary)' /> Mes derniers articles</h3>
                        <button
                            className="link-btn"
                            onClick={() => navigate('/dashboard/auteur/articles')}
                        >
                            Voir tout →
                        </button>
                    </div>

                    {recentArticles.length === 0 ? (
                        <div className="empty-state">
                            <span className="empty-icon"><FontAwesomeIcon icon={faPenToSquare} color='var(--color-text-placeholder)' /></span>
                            <p>Vous n'avez pas encore d'articles</p>
                            <button
                                className="btn btn-primary"
                                onClick={() => navigate('/dashboard/auteur/new')}
                            >
                                Créer mon premier article
                            </button>
                        </div>
                    ) : (
                        <div className="articles-list">
                            {recentArticles.map(article => (
                                <div key={article.id} className="article-item">
                                    <div className="article-info">
                                        <h4>{article.titre}</h4>
                                        <div className="article-meta">
                                            <StatusBadge status={article.est_publie ? 'publié' : 'brouillon'} />
                                            <span className="meta-item"><FontAwesomeIcon icon={faEye} /> {article.vues || 0} vues</span>
                                            <span className="meta-item"><FontAwesomeIcon icon={faHeart} color='red' /> {article.likes_count || 0} likes</span>
                                            <span className="meta-item">
                                                {new Date(article.created_at).toLocaleDateString('fr-FR')}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="article-actions">
                                        <button
                                            className="btn-icon-action"
                                            onClick={() => navigate(`/dashboard/auteur/edit/${article.id}`)}
                                            title="Éditer"
                                        >
                                            <FontAwesomeIcon icon={faPen} color='var(--color-text-primary)' />
                                        </button>
                                        <button
                                            className="btn-icon-action"
                                            onClick={() => navigate(`/Article/${article.slug}`)}
                                            title="Voir"
                                        >
                                            <FontAwesomeIcon icon={faEye} color='var(--color-text-primary)' />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

            </div>
    );
}

export default DashboardAuteur;
