import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';
import {
  getDemandeAuteurByUser, createDemandeAuteur,
  getStatsAuteur, getLikedByUser, getFollowers, getFollowing,
} from '../../api/api.js';
import Loader from '../../components/Loader/Loader.jsx';
import StatusBadge from '../../components/Dashboard/StatusBadge.jsx';
import ConfirmModal from '../../components/Modal/ConfirmModal.jsx';
import EditProfileModal from '../../components/Profile/EditProfileModal.jsx';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faFileLines, faHeart, faEye, faComment, faUsers, faChartSimple,
  faPenNib, faArrowTrendUp, faClock, faGlobe, faShieldHalved,
  faUserShield, faUser, faStar, faChevronRight, faFire,
} from '@fortawesome/free-solid-svg-icons';
import {
  faTwitter as faTwitterBrand, faLinkedin as faLinkedinBrand,
  faGithub as faGithubBrand, faFacebook as faFacebookBrand,
  faInstagram as faInstagramBrand, faYoutube as faYoutubeBrand,
} from '@fortawesome/free-brands-svg-icons';
import UserAvatar from '../../components/UserAvatar/UserAvatar.jsx';
import './Profile.css';

// ── Utilitaires couleur ───────────────────────────────────────────────────────

function lighten(hex, amount = 40) {
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

// ── Config rôles ──────────────────────────────────────────────────────────────

const ROLE_CONFIG = {
  lecteur:     { label: 'Lecteur',              icon: faUser,         color: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
  auteur:      { label: 'Auteur',               icon: faPenNib,       color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)'  },
  admin:       { label: 'Administrateur',        icon: faShieldHalved, color: '#3b82f6', bg: 'rgba(59,130,246,0.12)'  },
  super_admin: { label: 'Super Administrateur', icon: faUserShield,   color: '#f59e0b', bg: 'rgba(245,158,11,0.12)'  },
};

function StatCard({ icon, value, label, color, sub }) {
  return (
    <div className="prf-stat-card">
      <div className="prf-stat-icon" style={{ color, background: color + '18' }}>
        <FontAwesomeIcon icon={icon} />
      </div>
      <div>
        <p className="prf-stat-value">{value ?? '—'}</p>
        <p className="prf-stat-label">{label}</p>
        {sub && <p className="prf-stat-sub">{sub}</p>}
      </div>
    </div>
  );
}

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtNum(n) {
  if (n == null) return '0';
  if (n >= 1000) return (n / 1000).toFixed(1).replace('.0', '') + 'k';
  return String(n);
}

// ── Composant principal ───────────────────────────────────────────────────────

function Profile() {
  const { user, loading: authLoading, logout, checkAuth } = useAuth();
  const role = user?.profil?.role || 'lecteur';
  const isAuteur = ['auteur', 'admin', 'super_admin'].includes(role);
  const navigate = useNavigate();

  // State
  const [demande,       setDemande]       = useState(null);
  const [motivation,    setMotivation]    = useState('');
  const [authorStats,   setAuthorStats]   = useState(null);
  const [likedArticles, setLikedArticles] = useState([]);
  const [following,     setFollowing]     = useState([]);
  const [followers,     setFollowers]     = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [showDemandeForm,     setShowDemandeForm]     = useState(false);
  const [submitting,          setSubmitting]          = useState(false);
  const [isLogoutModalOpen,   setIsLogoutModalOpen]   = useState(false);
  const [isEditModalOpen,     setIsEditModalOpen]     = useState(false);
  const [interactionTab,      setInteractionTab]      = useState('likes');
  const [topTab,              setTopTab]              = useState('vues');

  const loadData = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    const tasks = [
      isAuteur ? getStatsAuteur(user.id) : null,
      getLikedByUser(user.id),
      getFollowing(user.id),
      getFollowers(user.id),
      role === 'lecteur' ? getDemandeAuteurByUser(user.id) : null,
    ].map(p => p ? p.catch(() => null) : Promise.resolve(null));

    const [statsRes, likesRes, followingRes, followersRes, demandeRes] = await Promise.all(tasks);
    if (statsRes)    setAuthorStats(statsRes.data);
    if (likesRes)    setLikedArticles(likesRes.data || []);
    if (followingRes) setFollowing(followingRes.data || []);
    if (followersRes) setFollowers(followersRes.data || []);
    if (demandeRes)  setDemande(demandeRes.data);
    setLoading(false);
  }, [user, isAuteur, role]);

  useEffect(() => {
    if (!authLoading) {
      if (!user) { navigate('/login'); return; }
      loadData();
    }
  }, [authLoading, user, loadData, navigate]);

  const handleDemandeAuteur = async (e) => {
    e.preventDefault();
    if (!motivation.trim()) { alert('Veuillez remplir votre motivation'); return; }
    try {
      setSubmitting(true);
      await createDemandeAuteur(user.id, motivation);
      const res = await getDemandeAuteurByUser(user.id);
      setDemande(res.data);
      setShowDemandeForm(false);
      setMotivation('');
    } catch (err) {
      alert('Erreur : ' + (err.response?.data?.error || err.message));
    } finally { setSubmitting(false); }
  };

  const handleProfileUpdated = async () => {
    await checkAuth();
    await loadData();
  };

  if (loading) return <Loader />;

  const roleCfg = ROLE_CONFIG[role] || ROLE_CONFIG.lecteur;
  const stats   = authorStats;
  const topArticles = topTab === 'vues' ? stats?.top?.par_vues : stats?.top?.par_likes;

  return (
    <div className="user-profile">

      {/* ── Profile Card ────────────────────────────────────────────────── */}
      <div className="profile-card">
        {/* Bannière — couleur personnalisable, jamais de texte dessus */}
        <div className="profile-banner" style={bannerStyle(user?.profil?.couleur_profil)} />

        <div className="profile-content">
          {/* Avatar : chevauche la bannière, l'image marche sur n'importe quelle couleur */}
          <div className="profile-avatar">
            <div className="avatar-circle">
              <UserAvatar profil={{ ...user?.profil, nom: user?.profil?.nom || user?.user_metadata?.nom || user?.email }} size={120} />
            </div>
          </div>

          {/* Tout le texte + badge sont ICI, sous la bannière, sur fond de carte */}
          <div className="profile-header-row">
            <div className="profile-info">
              <div className="prf-name-row">
                <h2 translate="no">{user?.user_metadata?.nom || user?.profil?.nom || 'Utilisateur'}</h2>
                <span className="prf-role-badge" style={{ color: roleCfg.color, background: roleCfg.bg, border: `1px solid ${roleCfg.color}40` }}>
                  <FontAwesomeIcon icon={roleCfg.icon} />
                  {roleCfg.label}
                </span>
              </div>
              <p className="profile-email">{user?.email}</p>
              <div className="prf-meta-row">
                <span className="profile-date">
                  <FontAwesomeIcon icon={faClock} />
                  Membre depuis {new Date(user?.created_at || Date.now()).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                </span>
                {isAuteur && stats && (
                  <>
                    <span className="prf-meta-dot" />
                    <span className="prf-meta-item">
                      <FontAwesomeIcon icon={faFileLines} />
                      {stats.articles.publies} article{stats.articles.publies !== 1 ? 's' : ''}
                    </span>
                    <span className="prf-meta-dot" />
                    <span className="prf-meta-item">
                      <FontAwesomeIcon icon={faUsers} />
                      {followers.length} abonné{followers.length !== 1 ? 's' : ''}
                    </span>
                  </>
                )}
              </div>
              {user?.profil?.bio && <p className="prf-bio">{user.profil.bio}</p>}
            </div>

            <div className="profile-actions">
              <button className="btn-edit-profile" onClick={() => setIsEditModalOpen(true)}>
                Modifier le profil
              </button>
              <button className="btn-deconnexion" onClick={() => setIsLogoutModalOpen(true)}>
                Se déconnecter
              </button>
            </div>
          </div>{/* fin profile-header-row */}
        </div>{/* fin profile-content */}

        {/* Social links inline */}
        {(user?.profil?.twitter || user?.profil?.linkedin || user?.profil?.github ||
          user?.profil?.facebook || user?.profil?.instagram || user?.profil?.youtube || user?.profil?.website) && (
          <div className="prf-social-bar">
            {[
              { key: 'twitter',   icon: faTwitterBrand,   label: 'Twitter',   cls: 'twitter'   },
              { key: 'linkedin',  icon: faLinkedinBrand,  label: 'LinkedIn',  cls: 'linkedin'  },
              { key: 'github',    icon: faGithubBrand,    label: 'GitHub',    cls: 'github'    },
              { key: 'facebook',  icon: faFacebookBrand,  label: 'Facebook',  cls: 'facebook'  },
              { key: 'instagram', icon: faInstagramBrand, label: 'Instagram', cls: 'instagram' },
              { key: 'youtube',   icon: faYoutubeBrand,   label: 'YouTube',   cls: 'youtube'   },
              { key: 'website',   icon: faGlobe,          label: 'Site web',  cls: 'website'   },
            ].filter(s => user.profil[s.key]).map(s => (
              <a key={s.key} href={user.profil[s.key]} target="_blank" rel="noopener noreferrer" className={`prf-social-chip ${s.cls}`}>
                <FontAwesomeIcon icon={s.icon} />
                <span>{s.label}</span>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* ── Quick links for roles ────────────────────────────────────────── */}
      {role === 'auteur' && (
        <div className="prf-quicklink-bar">
          <button className="prf-quicklink" onClick={() => navigate('/dashboard/auteur')}>
            <FontAwesomeIcon icon={faPenNib} />
            Mon espace auteur
            <FontAwesomeIcon icon={faChevronRight} />
          </button>
        </div>
      )}
      {['admin', 'super_admin'].includes(role) && (
        <div className="prf-quicklink-bar">
          <button className="prf-quicklink" onClick={() => navigate('/dashboard/admin')}>
            <FontAwesomeIcon icon={faShieldHalved} />
            Panneau d'administration
            <FontAwesomeIcon icon={faChevronRight} />
          </button>
        </div>
      )}

      <div className="main-grid">

        {/* ── LEFT COLUMN ──────────────────────────────────────────────── */}
        <div className="prf-left">

          {/* Author Stats Dashboard */}
          {isAuteur && stats && (
            <div className="section-card">
              <h3><FontAwesomeIcon icon={faChartSimple} /> Tableau de bord</h3>

              <div className="prf-stats-grid">
                <StatCard icon={faFileLines}    value={stats.articles.publies}           label="Articles publiés"     color="#8b5cf6" />
                <StatCard icon={faEye}          value={fmtNum(stats.interactions.vues)}  label="Vues totales"         color="#3b82f6" />
                <StatCard icon={faHeart}        value={fmtNum(stats.interactions.likes)} label="Likes reçus"          color="#ef4444" />
                <StatCard icon={faComment}      value={fmtNum(stats.interactions.commentaires)} label="Commentaires" color="#10b981" />
                <StatCard icon={faArrowTrendUp} value={fmtNum(stats.interactions.moy_vues)}     label="Vues moy./article"    color="#f59e0b" />
                <StatCard icon={faStar}         value={stats.interactions.moy_likes}     label="Likes moy./article"   color="#ec4899" />
                <StatCard icon={faUsers}        value={followers.length}                 label="Abonnés"              color="#06b6d4" />
                <StatCard icon={faFileLines}    value={stats.articles.brouillons}        label="Brouillons"           color="#94a3b8" />
              </div>

              {/* Top articles */}
              {topArticles && topArticles.length > 0 && (
                <div className="prf-top-articles">
                  <div className="prf-top-header">
                    <h4><FontAwesomeIcon icon={faFire} /> Top articles</h4>
                    <div className="prf-top-tabs">
                      <button className={topTab === 'vues'  ? 'active' : ''} onClick={() => setTopTab('vues')}>
                        <FontAwesomeIcon icon={faEye} /> Plus vus
                      </button>
                      <button className={topTab === 'likes' ? 'active' : ''} onClick={() => setTopTab('likes')}>
                        <FontAwesomeIcon icon={faHeart} /> Plus aimés
                      </button>
                    </div>
                  </div>

                  <div className="prf-top-list">
                    {topArticles.map((a, i) => (
                      <Link key={a.id} to={`/article/${a.slug}`} className="prf-top-item">
                        <span className="prf-top-rank">#{i + 1}</span>
                        <div className="prf-top-info">
                          <span className="prf-top-title">{a.titre}</span>
                          {a.categorie && <span className="prf-top-cat">{a.categorie}</span>}
                        </div>
                        <div className="prf-top-nums">
                          <span><FontAwesomeIcon icon={faEye} /> {fmtNum(a.vues)}</span>
                          <span><FontAwesomeIcon icon={faHeart} /> {fmtNum(a.nb_likes)}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {stats.articles.publies === 0 && (
                <p className="info-text small" style={{ marginTop: 12 }}>
                  Publiez votre premier article pour voir vos statistiques ici.
                </p>
              )}
            </div>
          )}

          {/* Lecteur → Devenir auteur */}
          {role === 'lecteur' && (
            <div className="section-card">
              <h3><FontAwesomeIcon icon={faPenNib} /> Devenir Auteur</h3>

              {!demande ? (
                <>
                  {!showDemandeForm ? (
                    <div className="no-demande">
                      <p>Vous souhaitez partager vos articles sur ArtInter ?</p>
                      <p className="info-text">Devenez auteur et commencez à publier vos créations visuelles !</p>
                      <button onClick={() => setShowDemandeForm(true)} className="btn btn-primary">
                        Faire une demande
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleDemandeAuteur} className="demande-form">
                      <label>
                        <strong>Pourquoi voulez-vous devenir auteur ?</strong>
                        <textarea
                          value={motivation}
                          onChange={e => setMotivation(e.target.value)}
                          placeholder="Expliquez votre motivation, vos domaines d'expertise, vos projets..."
                          required rows="6" disabled={submitting}
                        />
                      </label>
                      <div className="form-actions">
                        <button type="submit" className="btn btn-primary" disabled={submitting}>
                          {submitting ? 'Envoi...' : 'Envoyer la demande'}
                        </button>
                        <button type="button" onClick={() => { setShowDemandeForm(false); setMotivation(''); }} className="btn btn-secondary" disabled={submitting}>
                          Annuler
                        </button>
                      </div>
                    </form>
                  )}
                </>
              ) : (
                <div className="demande-status">
                  <div className="status-header">
                    <StatusBadge status={demande.statut} />
                    <span className="demande-date">Demandé le {new Date(demande.created_at).toLocaleDateString('fr-FR')}</span>
                  </div>
                  {demande.statut === 'en_attente' && (
                    <div className="status-message info">
                      <p><FontAwesomeIcon icon={faClock} /> Votre demande est en cours d'examen par notre équipe.</p>
                      <p className="small">Vous recevrez une notification dès qu'elle sera traitée.</p>
                    </div>
                  )}
                  {demande.statut === 'approuvee' && (
                    <div className="status-message success">
                      <p>Félicitations ! Votre demande a été approuvée !</p>
                      <p className="small">Vous pouvez maintenant accéder à votre espace auteur.</p>
                      <button onClick={() => navigate('/dashboard/auteur')} className="btn btn-primary">
                        Accéder à mon espace auteur →
                      </button>
                    </div>
                  )}
                  {demande.statut === 'refusee' && (
                    <div className="status-message error">
                      <p>Votre demande a été refusée.</p>
                      {demande.raison_refus && <p className="small"><strong>Raison :</strong> {demande.raison_refus}</p>}
                    </div>
                  )}
                  <div className="motivation-display">
                    <strong>Votre motivation :</strong>
                    <p>{demande.motivation}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── RIGHT COLUMN ─────────────────────────────────────────────── */}
        <div className="prf-right">

          {/* Interactions */}
          <div className="section-card">
            <h3><FontAwesomeIcon icon={faHeart} /> Mes interactions</h3>

            <div className="prf-interaction-tabs">
              <button className={interactionTab === 'likes' ? 'active' : ''} onClick={() => setInteractionTab('likes')}>
                <FontAwesomeIcon icon={faHeart} />
                J'aime
                <span className="prf-tab-count">{likedArticles.length}</span>
              </button>
              <button className={interactionTab === 'abonnements' ? 'active' : ''} onClick={() => setInteractionTab('abonnements')}>
                <FontAwesomeIcon icon={faUsers} />
                Abonnements
                <span className="prf-tab-count">{following.length}</span>
              </button>
              <button className={interactionTab === 'abonnes' ? 'active' : ''} onClick={() => setInteractionTab('abonnes')}>
                <FontAwesomeIcon icon={faUsers} />
                Abonnés
                <span className="prf-tab-count">{followers.length}</span>
              </button>
            </div>

            {/* Liked articles */}
            {interactionTab === 'likes' && (
              <div className="prf-interaction-list">
                {likedArticles.length === 0 ? (
                  <p className="prf-empty-interactions">Vous n'avez encore aimé aucun article.</p>
                ) : likedArticles.slice(0, 10).map(a => (
                  <Link key={a.article_id} to={`/article/${a.slug}`} className="prf-liked-item">
                    <div className="prf-liked-thumb">
                      {a.image
                        ? <img src={a.image} alt="" />
                        : <FontAwesomeIcon icon={faFileLines} />}
                    </div>
                    <div className="prf-liked-info">
                      <span className="prf-liked-title">{a.titre}</span>
                      <span className="prf-liked-meta">
                        {a.categorie && <span className="prf-liked-cat">{a.categorie}</span>}
                        {a.auteur_nom && <span>Par {a.auteur_nom}</span>}
                      </span>
                    </div>
                    <span className="prf-liked-date">{fmtDate(a.liked_at)}</span>
                  </Link>
                ))}
              </div>
            )}

            {/* Following */}
            {interactionTab === 'abonnements' && (
              <div className="prf-people-list">
                {following.length === 0 ? (
                  <p className="prf-empty-interactions">Vous ne suivez personne pour l'instant.</p>
                ) : following.map(p => (
                  <button key={p.id} className="prf-person-item" onClick={() => navigate(`/profil/${p.id}`)}>
                    <UserAvatar profil={p} size={36} />
                    <div className="prf-person-info">
                      <span className="prf-person-name">{p.nom}</span>
                      <span className="prf-person-role">{ROLE_CONFIG[p.role]?.label || p.role}</span>
                    </div>
                    <FontAwesomeIcon icon={faChevronRight} className="prf-person-arrow" />
                  </button>
                ))}
              </div>
            )}

            {/* Followers */}
            {interactionTab === 'abonnes' && (
              <div className="prf-people-list">
                {followers.length === 0 ? (
                  <p className="prf-empty-interactions">Personne ne vous suit encore.</p>
                ) : followers.map(p => (
                  <button key={p.id} className="prf-person-item" onClick={() => navigate(`/profil/${p.id}`)}>
                    <UserAvatar profil={p} size={36} />
                    <div className="prf-person-info">
                      <span className="prf-person-name">{p.nom}</span>
                      <span className="prf-person-role">{ROLE_CONFIG[p.role]?.label || p.role}</span>
                    </div>
                    <FontAwesomeIcon icon={faChevronRight} className="prf-person-arrow" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────── */}
      <ConfirmModal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        onConfirm={logout}
        title="Déconnexion"
        message="Êtes-vous sûr de vouloir vous déconnecter ?"
        confirmText="Se déconnecter"
        isDanger={true}
      />
      <EditProfileModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        user={user}
        onProfileUpdated={handleProfileUpdated}
      />
    </div>
  );
}

export default Profile;
