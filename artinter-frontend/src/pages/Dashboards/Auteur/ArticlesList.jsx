import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser, getArticlesByAuteur, deleteArticle } from '../../../api/api.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlus, faPen, faEye, faTrash, faMagnifyingGlass,
  faHeart, faCircle, faCheckCircle, faFileAlt, faExclamationTriangle
} from '@fortawesome/free-solid-svg-icons';
import StatusBadge from '../../../components/Dashboard/StatusBadge.jsx';
import Loader from '../../../components/Loader/Loader.jsx';
import './ArticlesList.css';

const FILTER_OPTIONS = [
  { value: 'all',       label: 'Tous' },
  { value: 'published', label: 'Publiés' },
  { value: 'draft',     label: 'Brouillons' },
];

function ArticlesList() {
  const navigate = useNavigate();

  const [articles,  setArticles]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [filter,    setFilter]    = useState('all');
  const [deleting,  setDeleting]  = useState(null);   // id de l'article en cours de suppression
  const [confirmId, setConfirmId] = useState(null);   // id affiché dans la modale

  const loadArticles = useCallback(async () => {
    try {
      const { data: user } = await getCurrentUser();
      if (!user) { navigate('/login'); return; }
      if (!['auteur', 'admin', 'super_admin'].includes(user.profil?.role)) {
        navigate('/dashboard/lecteur'); return;
      }
      const res = await getArticlesByAuteur(user.id);
      // Trier par date décroissante
      const sorted = (res.data || []).sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
      );
      setArticles(sorted);
    } catch {
      setArticles([]);
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => { loadArticles(); }, [loadArticles]);

  const handleDelete = async () => {
    if (!confirmId) return;
    setDeleting(confirmId);
    setConfirmId(null);
    try {
      await deleteArticle(confirmId);
      setArticles(prev => prev.filter(a => a.id !== confirmId));
    } catch { /* ignore */ } finally {
      setDeleting(null);
    }
  };

  const filtered = articles.filter(a => {
    const matchesSearch = a.titre?.toLowerCase().includes(search.toLowerCase());
    const matchesFilter =
      filter === 'all' ||
      (filter === 'published' && a.est_publie) ||
      (filter === 'draft'     && !a.est_publie);
    return matchesSearch && matchesFilter;
  });

  const totalPublies  = articles.filter(a => a.est_publie).length;
  const totalBrouillons = articles.length - totalPublies;

  if (loading) return <Loader />;

  return (
    <div className="al-page fadeInContainer">

      {/* HEADER */}
      <div className="al-header">
        <div className="al-header-left">
          <h2 className="al-title">Mes Articles</h2>
          <p className="al-subtitle">{articles.length} article{articles.length !== 1 ? 's' : ''} au total</p>
        </div>
        <button className="al-new-btn" onClick={() => navigate('/dashboard/auteur/new')}>
          <FontAwesomeIcon icon={faPlus} />
          Nouvel article
        </button>
      </div>

      {/* STATS RAPIDES */}
      <div className="al-stats">
        <div className="al-stat" onClick={() => setFilter('all')} style={{ cursor: 'pointer' }}>
          <FontAwesomeIcon icon={faFileAlt} className="al-stat-icon all" />
          <span className="al-stat-val">{articles.length}</span>
          <span className="al-stat-label">Total</span>
        </div>
        <div className="al-stat" onClick={() => setFilter('published')} style={{ cursor: 'pointer' }}>
          <FontAwesomeIcon icon={faCheckCircle} className="al-stat-icon published" />
          <span className="al-stat-val">{totalPublies}</span>
          <span className="al-stat-label">Publiés</span>
        </div>
        <div className="al-stat" onClick={() => setFilter('draft')} style={{ cursor: 'pointer' }}>
          <FontAwesomeIcon icon={faCircle} className="al-stat-icon draft" />
          <span className="al-stat-val">{totalBrouillons}</span>
          <span className="al-stat-label">Brouillons</span>
        </div>
      </div>

      {/* RECHERCHE + FILTRES */}
      <div className="al-toolbar">
        <div className="al-search">
          <FontAwesomeIcon icon={faMagnifyingGlass} className="al-search-icon" />
          <input
            type="text"
            placeholder="Rechercher un article…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="al-search-input"
          />
        </div>
        <div className="al-filters">
          {FILTER_OPTIONS.map(opt => (
            <button
              key={opt.value}
              className={`al-filter-btn${filter === opt.value ? ' active' : ''}`}
              onClick={() => setFilter(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* LISTE */}
      {filtered.length === 0 ? (
        <div className="al-empty">
          <FontAwesomeIcon icon={faFileAlt} className="al-empty-icon" />
          {search || filter !== 'all'
            ? <p>Aucun article ne correspond à votre recherche.</p>
            : <p>Vous n'avez pas encore d'articles. Commencez à écrire !</p>
          }
          {!search && filter === 'all' && (
            <button className="al-new-btn" onClick={() => navigate('/dashboard/auteur/new')}>
              <FontAwesomeIcon icon={faPlus} />
              Créer mon premier article
            </button>
          )}
        </div>
      ) : (
        <div className="al-list">
          {filtered.map(article => (
            <div key={article.id} className={`al-item${deleting === article.id ? ' al-item--deleting' : ''}`}>

              {/* COUVERTURE */}
              <div
                className="al-cover"
                style={
                  article.images?.[0]?.startsWith('#')
                    ? { background: article.images[0] }
                    : {}
                }
              >
                {article.images?.[0] && !article.images[0].startsWith('#') ? (
                  <img src={article.images[0]} alt="" />
                ) : !article.images?.[0] ? (
                  <FontAwesomeIcon icon={faFileAlt} />
                ) : null}
              </div>

              {/* INFOS */}
              <div className="al-info">
                <h4 className="al-item-title">{article.titre}</h4>
                <div className="al-item-meta">
                  <StatusBadge status={article.est_publie ? 'publié' : 'brouillon'} />
                  {article.categorie && (
                    <span className="al-meta-chip">{article.categorie}</span>
                  )}
                  <span className="al-meta-item">
                    <FontAwesomeIcon icon={faEye} />
                    {article.vues || 0}
                  </span>
                  <span className="al-meta-item">
                    <FontAwesomeIcon icon={faHeart} />
                    {article.likes_count || 0}
                  </span>
                  <span className="al-meta-item">
                    {new Date(article.created_at).toLocaleDateString('fr-FR', {
                      day: 'numeric', month: 'short', year: 'numeric'
                    })}
                  </span>
                </div>
              </div>

              {/* ACTIONS */}
              <div className="al-actions">
                <button
                  className="al-action-btn al-action-btn--edit"
                  onClick={() => navigate(`/dashboard/auteur/edit/${article.id}`)}
                  title="Modifier"
                >
                  <FontAwesomeIcon icon={faPen} />
                </button>
                {article.est_publie && article.slug && (
                  <button
                    className="al-action-btn al-action-btn--view"
                    onClick={() => navigate(`/Article/${article.slug}`)}
                    title="Voir l'article"
                  >
                    <FontAwesomeIcon icon={faEye} />
                  </button>
                )}
                <button
                  className="al-action-btn al-action-btn--delete"
                  onClick={() => setConfirmId(article.id)}
                  title="Supprimer"
                  disabled={deleting === article.id}
                >
                  <FontAwesomeIcon icon={faTrash} />
                </button>
              </div>

            </div>
          ))}
        </div>
      )}

      {/* MODALE CONFIRMATION SUPPRESSION */}
      {confirmId && (
        <div className="al-overlay" onClick={() => setConfirmId(null)}>
          <div className="al-confirm" onClick={e => e.stopPropagation()}>
            <div className="al-confirm-icon">
              <FontAwesomeIcon icon={faExclamationTriangle} />
            </div>
            <h3>Supprimer cet article ?</h3>
            <p>Cette action est irréversible. L'article sera définitivement supprimé.</p>
            <div className="al-confirm-actions">
              <button className="al-confirm-cancel" onClick={() => setConfirmId(null)}>
                Annuler
              </button>
              <button className="al-confirm-delete" onClick={handleDelete}>
                <FontAwesomeIcon icon={faTrash} />
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default ArticlesList;
