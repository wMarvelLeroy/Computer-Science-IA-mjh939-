import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  getCurrentUser,
  getAllArticlesAdmin,
  getAllCategories,
  deleteArticleAdmin,
  restrictArticleAdmin,
  republierArticleAdmin
} from '../../../api/api';
import Loader from '../../../components/Loader/Loader.jsx';
import Portal from '../../../components/Modal/Portal.jsx';
import './AdminPages.css';

export default function ArticlesManagement() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [articles, setArticles]       = useState([]);
  const [categories, setCategories]   = useState([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');
  const [catFilter, setCatFilter]     = useState('all');
  const [modal, setModal]             = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast]             = useState(null);

  useEffect(() => {
    const init = async () => {
      try {
        const { data } = await getCurrentUser();
        if (!data) return navigate('/login');
        if (!['admin','super_admin'].includes(data.profil?.role)) return navigate('/dashboard/lecteur');
        setCurrentUser(data);
      } catch {
        return navigate('/login');
      }

      try {
        const [artRes, catRes] = await Promise.all([
          getAllArticlesAdmin(),
          getAllCategories()
        ]);
        setArticles(artRes.data || []);
        setCategories(catRes.data || []);
      } catch (err) {
        console.error('Erreur chargement articles:', err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [navigate]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const filtered = articles.filter(a => {
    const q = search.toLowerCase();
    const matchSearch = !q
      || a.titre?.toLowerCase().includes(q)
      || a.auteurs?.nom?.toLowerCase().includes(q);
    const matchCat = catFilter === 'all' || a.categorie === catFilter;
    return matchSearch && matchCat;
  });

  const handleDelete = async () => {
    if (!modal) return;
    setActionLoading(true);
    try {
      await deleteArticleAdmin(modal.article.id);
      setArticles(prev => prev.filter(a => a.id !== modal.article.id));
      showToast('Article supprimé');
    } catch {
      showToast('Erreur lors de la suppression', 'error');
    } finally {
      setActionLoading(false);
      setModal(null);
    }
  };

  const handleRestrict = async (article) => {
    setActionLoading(true);
    try {
      await restrictArticleAdmin(article.id);
      setArticles(prev => prev.map(a => a.id === article.id ? { ...a, est_publie: false } : a));
      showToast('Article restreint (dépublié)');
    } catch {
      showToast('Erreur lors de la restriction', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRepublier = async (article) => {
    setActionLoading(true);
    try {
      await republierArticleAdmin(article.id);
      setArticles(prev => prev.map(a => a.id === article.id ? { ...a, est_publie: true } : a));
      showToast('Article republié');
    } catch {
      showToast('Erreur lors de la republication', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (d) =>
    d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

  if (loading) return <Loader />;

  return (
    <div className="admin-page">
      {/* En-tête */}
      <div className="admin-page-header">
        <div>
          <h2>Gestion des articles</h2>
          <p>{articles.length} article{articles.length > 1 ? 's' : ''} au total</p>
        </div>
      </div>

      {/* Filtres */}
      <div className="admin-filters">
        <div className="admin-search-wrap">
          <span className="material-icons">search</span>
          <input
            type="text"
            className="admin-search"
            placeholder="Rechercher par titre ou auteur…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="admin-select"
          value={catFilter}
          onChange={e => setCatFilter(e.target.value)}
        >
          <option value="all">Toutes les catégories</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.nom}</option>
          ))}
        </select>
        <span className="admin-count">{filtered.length} résultat{filtered.length > 1 ? 's' : ''}</span>
      </div>

      {/* Tableau */}
      <div className="admin-table-wrap">
        {filtered.length === 0 ? (
          <div className="admin-empty">
            <span className="material-icons">article</span>
            <p>Aucun article trouvé</p>
          </div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Titre</th>
                <th>Auteur</th>
                <th>Catégorie</th>
                <th>Statut</th>
                <th>Vues</th>
                <th>Date</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(article => (
                <tr key={article.id}>
                  <td data-label="Titre">
                    <span style={{ fontWeight: 600 }}>
                      {article.titre?.length > 55
                        ? article.titre.slice(0, 55) + '…'
                        : article.titre || 'Sans titre'}
                    </span>
                  </td>

                  <td data-label="Auteur">
                    <div className="admin-user-cell">
                      <div className="admin-avatar">
                        {article.auteurs?.avatar_url
                          ? <img src={article.auteurs.avatar_url} alt="" />
                          : (article.auteurs?.nom?.[0]?.toUpperCase() || '?')
                        }
                      </div>
                      <span>{article.auteurs?.nom || 'Inconnu'}</span>
                    </div>
                  </td>

                  <td data-label="Catégorie">
                    {article.categories?.nom
                      ? <span className="badge badge-lecteur">{article.categories.nom}</span>
                      : <span style={{ color: 'var(--color-text-placeholder)' }}>—</span>
                    }
                  </td>

                  <td data-label="Statut">
                    {article.est_publie
                      ? <span className="badge badge-publie">Publié</span>
                      : <span className="badge badge-brouillon">Restreint</span>
                    }
                  </td>

                  <td data-label="Vues">
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span className="material-icons" style={{ fontSize: 15, color: 'var(--color-text-placeholder)' }}>visibility</span>
                      {article.vues ?? 0}
                    </span>
                  </td>

                  <td data-label="Date">
                    {formatDate(article.date_publication || article.created_at)}
                  </td>

                  <td className="no-label" style={{ textAlign: 'right' }}>
                    <div className="admin-actions">
                      {article.est_publie && article.slug && (
                        <Link
                          to={`/article/${article.slug}`}
                          target="_blank"
                          className="admin-btn"
                          title="Voir l'article"
                        >
                          <span className="material-icons">open_in_new</span>
                          <span className="btn-label">Voir</span>
                        </Link>
                      )}
                      {['admin','super_admin'].includes(currentUser?.profil?.role) && article.est_publie && (
                        <button
                          className="admin-btn"
                          disabled={actionLoading}
                          onClick={() => handleRestrict(article)}
                          title="Dépublier l'article"
                        >
                          <span className="material-icons">visibility_off</span>
                          <span className="btn-label">Dépublier</span>
                        </button>
                      )}
                      {['admin','super_admin'].includes(currentUser?.profil?.role) && !article.est_publie && (
                        <button
                          className="admin-btn warning"
                          disabled={actionLoading}
                          onClick={() => handleRepublier(article)}
                          title="Republier l'article"
                        >
                          <span className="material-icons">visibility</span>
                          <span className="btn-label">Republier</span>
                        </button>
                      )}
                      {currentUser?.profil?.role === 'super_admin' && (
                        <button
                          className="admin-btn danger"
                          disabled={actionLoading}
                          onClick={() => setModal({ article })}
                          title="Supprimer l'article"
                        >
                          <span className="material-icons">delete</span>
                          <span className="btn-label">Supprimer</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal confirmation suppression */}
      {modal && (
        <Portal>
        <div className="admin-modal-overlay" onClick={() => !actionLoading && setModal(null)}>
          <div className="admin-modal" onClick={e => e.stopPropagation()}>
            <h3>Supprimer l'article ?</h3>
            <p>
              Vous êtes sur le point de supprimer{' '}
              <strong>"{modal.article.titre}"</strong>.
              Cette action est irréversible.
            </p>
            <div className="admin-modal-actions">
              <button className="admin-btn" disabled={actionLoading} onClick={() => setModal(null)}>
                Annuler
              </button>
              <button className="admin-btn danger" disabled={actionLoading} onClick={handleDelete}>
                {actionLoading ? 'Suppression…' : 'Confirmer la suppression'}
              </button>
            </div>
          </div>
        </div>
        </Portal>
      )}

      {/* Toast */}
      {toast && (
        <div className={`admin-toast ${toast.type}`}>
          <span className="material-icons">
            {toast.type === 'success' ? 'check_circle' : 'error'}
          </span>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
