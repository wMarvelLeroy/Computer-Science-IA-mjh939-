import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  getProfilById, getArticlesByAuteur,
  getFollowers, checkIsFollowing, followUser, unfollowUser,
} from '../../../api/api.js';
import { useAuth } from '../../../contexts/AuthContext.jsx';
import Loader from '../../../components/Loader/Loader.jsx';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faUserPlus, faUserMinus, faRightToBracket,
  faCalendarDays, faFire, faEye, faHeart,
  faGlobe, faPenNib, faShieldHalved, faUserShield,
  faUser, faFileLines, faUsers, faArrowLeft,
} from '@fortawesome/free-solid-svg-icons';
import {
  faTwitter, faLinkedin, faGithub,
  faFacebook, faInstagram, faYoutube,
} from '@fortawesome/free-brands-svg-icons';
import './OtherProfil.css';

const ARTICLES_PER_PAGE = 6;

// ── Utilitaires couleur ───────────────────────────────────────────────────────

function lighten(hex, amount = 50) {
  const n = parseInt((hex || '#10b981').replace('#', ''), 16);
  const r = Math.min(255, (n >> 16) + amount);
  const g = Math.min(255, ((n >> 8) & 0xff) + amount);
  const b = Math.min(255, (n & 0xff) + amount);
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function bannerStyle(couleur) {
  const base = couleur || '#10b981';
  return { background: `linear-gradient(135deg, ${base}, ${lighten(base, 50)})` };
}

function avatarBg(couleur) {
  if (!couleur) return 'linear-gradient(135deg, var(--color-accent), #a78bfa)';
  return `linear-gradient(135deg, ${couleur}, ${couleur}cc)`;
}

// ── Config rôles ──────────────────────────────────────────────────────────────

const ROLE_CONFIG = {
  lecteur:     { label: 'Lecteur',        icon: faUser,         color: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
  auteur:      { label: 'Auteur',         icon: faPenNib,       color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)'  },
  admin:       { label: 'Administrateur', icon: faShieldHalved, color: '#3b82f6', bg: 'rgba(59,130,246,0.12)'  },
  super_admin: { label: 'Administrateur', icon: faShieldHalved, color: '#3b82f6', bg: 'rgba(59,130,246,0.12)'  },
};

const SOCIAL_LINKS = [
  { key: 'twitter',   icon: faTwitter,   label: 'Twitter',   css: 'twitter'   },
  { key: 'linkedin',  icon: faLinkedin,  label: 'LinkedIn',  css: 'linkedin'  },
  { key: 'github',    icon: faGithub,    label: 'GitHub',    css: 'github'    },
  { key: 'facebook',  icon: faFacebook,  label: 'Facebook',  css: 'facebook'  },
  { key: 'instagram', icon: faInstagram, label: 'Instagram', css: 'instagram' },
  { key: 'youtube',   icon: faYoutube,   label: 'YouTube',   css: 'youtube'   },
  { key: 'website',   icon: faGlobe,     label: 'Site web',  css: 'website'   },
];

// ── Composant principal ───────────────────────────────────────────────────────

const OtherProfil = () => {
  const { userId }  = useParams();
  const navigate    = useNavigate();
  const { user }    = useAuth();

  const [profil,      setProfil]      = useState(null);
  const [articles,    setArticles]    = useState([]);
  const [followers,   setFollowers]   = useState([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [showLoginHint, setShowLoginHint] = useState(false);
  const [loading,     setLoading]     = useState(true);
  const [notFound,    setNotFound]    = useState(false);
  const [page,        setPage]        = useState(1);

  // Rediriger vers le profil personnel si c'est le sien
  useEffect(() => {
    if (user?.id && userId && user.id === userId) {
      navigate('/profile', { replace: true });
    }
  }, [user, userId, navigate]);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [profilRes, artRes, followersRes] = await Promise.allSettled([
        getProfilById(userId),
        getArticlesByAuteur(userId),
        getFollowers(userId),
      ]);

      if (profilRes.status === 'rejected' || !profilRes.value?.data) {
        setNotFound(true);
        return;
      }
      setProfil(profilRes.value.data);

      const published = (artRes.value?.data || []).filter(a => a.est_publie);
      setArticles(published);

      setFollowers(followersRes.value?.data || []);

      // Vérifier si l'utilisateur connecté suit ce profil
      if (user?.id) {
        try {
          const res = await checkIsFollowing(user.id, userId);
          setIsFollowing(res?.data?.isFollowing ?? false);
        } catch { /* ignore */ }
      }
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [userId, user?.id]);

  useEffect(() => { load(); }, [load]);

  const handleFollow = async () => {
    if (!user) { setShowLoginHint(true); return; }
    setFollowLoading(true);
    try {
      await followUser(userId);
      setIsFollowing(true);
      setFollowers(prev => [...prev, { follower_id: user.id }]);
    } catch { /* ignore */ } finally { setFollowLoading(false); }
  };

  const handleUnfollow = async () => {
    setFollowLoading(true);
    try {
      await unfollowUser(userId);
      setIsFollowing(false);
      setFollowers(prev => prev.filter(f => f.follower_id !== user.id));
    } catch { /* ignore */ } finally { setFollowLoading(false); }
  };

  // ── Rendu ─────────────────────────────────────────────────────────────────

  if (loading) return <Loader />;

  if (notFound) {
    return (
      <div className="op-notfound">
        <FontAwesomeIcon icon={faUser} className="op-notfound-icon" />
        <h2>Profil introuvable</h2>
        <p>Cet utilisateur n'existe pas ou a été supprimé.</p>
        <button onClick={() => navigate(-1)} className="op-back-btn">
          <FontAwesomeIcon icon={faArrowLeft} /> Retour
        </button>
      </div>
    );
  }

  const role       = profil.role || 'lecteur';
  const roleCfg    = ROLE_CONFIG[role] || ROLE_CONFIG.lecteur;
  const isAuteur   = ['auteur', 'admin', 'super_admin'].includes(role);
  const initials   = profil.nom
    ? profil.nom.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';
  const joinDate   = profil.created_at
    ? new Date(profil.created_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    : null;

  const topArticle = articles.length > 0
    ? articles.reduce((best, a) => (a.nb_vues || 0) > (best?.nb_vues || 0) ? a : best, articles[0])
    : null;

  const totalPages    = Math.ceil(articles.length / ARTICLES_PER_PAGE);
  const pagedArticles = articles.slice((page - 1) * ARTICLES_PER_PAGE, page * ARTICLES_PER_PAGE);

  const hasSocials = SOCIAL_LINKS.some(s => profil[s.key]);

  return (
    <div className="op-page fadeInContainer">

      <button className="op-back" onClick={() => navigate(-1)}>
        <FontAwesomeIcon icon={faArrowLeft} /> Retour
      </button>

      {/* ── Carte profil ── */}
      <div className="op-card">
        {/* Bannière */}
        <div className="op-banner" style={bannerStyle(profil.couleur_profil)} />

        <div className="op-content">
          {/* Avatar + bouton suivre */}
          <div className="op-top-row">
            <div className="op-avatar-wrap">
              <div className="op-avatar" style={{ background: avatarBg(profil.couleur_avatar) }}>
                {profil.avatar_url
                  ? <img src={profil.avatar_url} alt={profil.nom} />
                  : <span>{initials}</span>
                }
              </div>
            </div>

            <div className="op-actions">
              {/* Compteurs */}
              <div className="op-counters">
                {isAuteur && (
                  <div className="op-counter">
                    <strong>{articles.length}</strong>
                    <span>article{articles.length !== 1 ? 's' : ''}</span>
                  </div>
                )}
                <div className="op-counter">
                  <strong>{followers.length}</strong>
                  <span>abonné{followers.length !== 1 ? 's' : ''}</span>
                </div>
              </div>

              {/* Bouton suivre */}
              <div className="op-follow-area">
                {isFollowing ? (
                  <button
                    className="op-follow-btn op-follow-btn--following"
                    onClick={handleUnfollow}
                    disabled={followLoading}
                  >
                    <FontAwesomeIcon icon={faUserMinus} />
                    Ne plus suivre
                  </button>
                ) : (
                  <button
                    className="op-follow-btn"
                    onClick={handleFollow}
                    disabled={followLoading}
                  >
                    <FontAwesomeIcon icon={faUserPlus} />
                    Suivre
                  </button>
                )}

                </div>
            </div>
          </div>

          {/* Infos */}
          <div className="op-info">
            <div className="op-name-row">
              <h1>{profil.nom}</h1>
              <span className="op-role-badge" style={{ color: roleCfg.color, background: roleCfg.bg }}>
                <FontAwesomeIcon icon={roleCfg.icon} />
                {roleCfg.label}
              </span>
            </div>

            {joinDate && (
              <p className="op-join">
                <FontAwesomeIcon icon={faCalendarDays} />
                Membre depuis {joinDate}
              </p>
            )}

            {profil.bio && <p className="op-bio">{profil.bio}</p>}
          </div>

          {/* Liens sociaux */}
          {hasSocials && (
            <div className="op-socials">
              {SOCIAL_LINKS.filter(s => profil[s.key]).map(s => (
                <a
                  key={s.key}
                  href={profil[s.key]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`op-social-chip op-social-chip--${s.css}`}
                >
                  <FontAwesomeIcon icon={s.icon} />
                  {s.label}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Article mis en avant (auteurs/admins uniquement) ── */}
      {isAuteur && topArticle && articles.length > 1 && (
        <Link to={`/article/${topArticle.slug}`} className="op-featured">
          <div className="op-featured-badge">
            <FontAwesomeIcon icon={faFire} /> Article le plus populaire
          </div>
          <div className="op-featured-inner">
            {topArticle.images?.[0] && !topArticle.images[0].startsWith('#') && (
              <div className="op-featured-img">
                <img src={topArticle.images[0]} alt={topArticle.titre} />
              </div>
            )}
            <div className="op-featured-info">
              {topArticle.categories?.nom && (
                <span className="op-featured-cat">{topArticle.categories.nom}</span>
              )}
              <h3>{topArticle.titre}</h3>
              <div className="op-featured-stats">
                <span><FontAwesomeIcon icon={faEye} /> {(topArticle.nb_vues || 0).toLocaleString('fr-FR')}</span>
                <span><FontAwesomeIcon icon={faHeart} /> {topArticle.nb_likes || 0}</span>
              </div>
            </div>
          </div>
        </Link>
      )}

      {/* ── Articles publiés ── */}
      {isAuteur && (
        <div className="op-section">
          <h3 className="op-section-title">
            <FontAwesomeIcon icon={faFileLines} />
            Articles publiés
            {articles.length > 0 && <span className="op-count">{articles.length}</span>}
          </h3>

          {articles.length === 0 ? (
            <div className="op-empty">
              <FontAwesomeIcon icon={faFileLines} />
              <p>Aucun article publié pour le moment.</p>
            </div>
          ) : (
            <>
              <div className="op-articles-grid">
                {pagedArticles.map(article => {
                  const image = article.images?.[0];
                  return (
                    <Link key={article.id} to={`/article/${article.slug}`} className="op-article-card">
                      <div className="op-card-img">
                        {image && !image.startsWith('#')
                          ? <img src={image} alt={article.titre} />
                          : <div style={{ background: image || 'var(--color-bg-secondary)', width: '100%', height: '100%' }} />
                        }
                      </div>
                      <div className="op-card-body">
                        {article.categories?.nom && (
                          <span className="op-card-cat">{article.categories.nom}</span>
                        )}
                        <h4>{article.titre}</h4>
                        <div className="op-card-meta">
                          <span className="op-card-date">
                            {article.date_publication
                              ? new Date(article.date_publication).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
                              : ''}
                          </span>
                          <div className="op-card-stats">
                            <span><FontAwesomeIcon icon={faEye} /> {(article.nb_vues || 0).toLocaleString('fr-FR')}</span>
                            <span><FontAwesomeIcon icon={faHeart} /> {article.nb_likes || 0}</span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>

              {totalPages > 1 && (
                <div className="op-pagination">
                  <button className="op-page-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                    ‹
                  </button>
                  <span className="op-page-info">{page} / {totalPages}</span>
                  <button className="op-page-btn" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
                    ›
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Overlay connexion requise ── */}
      {showLoginHint && !user && (
        <div className="op-overlay" onClick={() => setShowLoginHint(false)}>
          <div className="op-overlay-card" onClick={e => e.stopPropagation()}>
            <button className="op-overlay-close" onClick={() => setShowLoginHint(false)}>✕</button>
            <div className="op-overlay-icon">
              <FontAwesomeIcon icon={faUserPlus} />
            </div>
            <h3>Connectez-vous pour suivre</h3>
            <p>Créez un compte ou connectez-vous pour suivre {profil.nom} et ne rien manquer de ses publications.</p>
            <div className="op-overlay-actions">
              <Link to="/login" className="op-overlay-btn op-overlay-btn--primary">
                <FontAwesomeIcon icon={faRightToBracket} /> Se connecter
              </Link>
              <button className="op-overlay-btn op-overlay-btn--secondary" onClick={() => setShowLoginHint(false)}>
                Continuer sans compte
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default OtherProfil;
