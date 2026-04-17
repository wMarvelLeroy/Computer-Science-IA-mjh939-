import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getCurrentUser,
  getAllCategories,
  createCategorie,
  updateCategorie,
  deleteCategorie
} from '../../../api/api';
import Loader from '../../../components/Loader/Loader.jsx';
import Portal from '../../../components/Modal/Portal.jsx';
import './AdminPages.css';

const slugify = (str) =>
  str
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

const emptyForm = { nom: '', slug: '', description: '' };

export default function CategoriesManagement() {
  const navigate = useNavigate();
  const [categories, setCategories]   = useState([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');
  const [modal, setModal]             = useState(null); // 'create' | { type: 'edit'|'delete', cat }
  const [form, setForm]               = useState(emptyForm);
  const [formError, setFormError]     = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast]             = useState(null);

  useEffect(() => {
    const init = async () => {
      try {
        const { data } = await getCurrentUser();
        if (!data) return navigate('/login');
        if (!['admin','super_admin'].includes(data.profil?.role)) return navigate('/dashboard/lecteur');
      } catch {
        return navigate('/login');
      }

      try {
        const { data: cats } = await getAllCategories();
        setCategories(cats || []);
      } catch (err) {
        console.error('Erreur chargement catégories:', err);
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

  const filtered = categories.filter(c => {
    const q = search.toLowerCase();
    return !q || c.nom?.toLowerCase().includes(q) || c.slug?.toLowerCase().includes(q);
  });

  const openCreate = () => {
    setForm(emptyForm);
    setFormError('');
    setModal('create');
  };

  const openEdit = (cat) => {
    setForm({ nom: cat.nom || '', slug: cat.slug || '', description: cat.description || '' });
    setFormError('');
    setModal({ type: 'edit', cat });
  };

  const openDelete = (cat) => {
    setModal({ type: 'delete', cat });
  };

  const handleFormChange = (field, value) => {
    setForm(prev => {
      const next = { ...prev, [field]: value };
      if (field === 'nom') {
        next.slug = slugify(value);
      }
      return next;
    });
  };

  const handleCreate = async () => {
    if (!form.nom.trim()) { setFormError('Le nom est obligatoire.'); return; }
    setActionLoading(true);
    try {
      const { data } = await createCategorie({
        nom: form.nom.trim(),
        slug: form.slug.trim(),
        description: form.description.trim() || null
      });
      setCategories(prev => [...prev, data].sort((a, b) => a.nom.localeCompare(b.nom)));
      showToast('Catégorie créée avec succès');
      setModal(null);
    } catch (err) {
      setFormError(err.response?.data?.error || 'Erreur lors de la création');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEdit = async () => {
    if (!form.nom.trim()) { setFormError('Le nom est obligatoire.'); return; }
    setActionLoading(true);
    try {
      const { data } = await updateCategorie(modal.cat.id, {
        nom: form.nom.trim(),
        slug: form.slug.trim(),
        description: form.description.trim() || null
      });
      setCategories(prev =>
        prev.map(c => c.id === data.id ? data : c)
           .sort((a, b) => a.nom.localeCompare(b.nom))
      );
      showToast('Catégorie mise à jour');
      setModal(null);
    } catch (err) {
      setFormError(err.response?.data?.error || 'Erreur lors de la mise à jour');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    setActionLoading(true);
    try {
      await deleteCategorie(modal.cat.id);
      setCategories(prev => prev.filter(c => c.id !== modal.cat.id));
      showToast('Catégorie supprimée');
      setModal(null);
    } catch {
      showToast('Erreur lors de la suppression', 'error');
      setModal(null);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <Loader />;

  const isEditModal = modal && modal.type === 'edit';
  const isCreateModal = modal === 'create';
  const isDeleteModal = modal && modal.type === 'delete';

  return (
    <div className="admin-page">
      {/* En-tête */}
      <div className="admin-page-header">
        <div>
          <h2>Gestion des catégories</h2>
          <p>{categories.length} catégorie{categories.length > 1 ? 's' : ''}</p>
        </div>
        <button className="admin-btn primary" onClick={openCreate}>
          <span className="material-icons">add</span>
          Nouvelle catégorie
        </button>
      </div>

      {/* Recherche */}
      <div className="admin-filters">
        <div className="admin-search-wrap">
          <span className="material-icons">search</span>
          <input
            type="text"
            className="admin-search"
            placeholder="Rechercher une catégorie…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <span className="admin-count">{filtered.length} résultat{filtered.length > 1 ? 's' : ''}</span>
      </div>

      {/* Grille */}
      {filtered.length === 0 ? (
        <div className="admin-empty">
          <span className="material-icons">folder_off</span>
          <p>Aucune catégorie trouvée</p>
        </div>
      ) : (
        <div className="admin-categories-grid">
          {filtered.map(cat => (
            <div className="admin-category-card" key={cat.id}>
              <h4>{cat.nom}</h4>
              <span className="cat-slug">/{cat.slug}</span>
              {cat.description && (
                <p className="cat-desc">{cat.description}</p>
              )}
              <div className="admin-category-card-footer">
                <button className="admin-btn" onClick={() => openEdit(cat)}>
                  <span className="material-icons">edit</span>
                  Modifier
                </button>
                <button className="admin-btn danger" onClick={() => openDelete(cat)}>
                  <span className="material-icons">delete</span>
                  Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal créer / éditer */}
      {(isCreateModal || isEditModal) && (
        <Portal>
        <div className="admin-modal-overlay" onClick={() => !actionLoading && setModal(null)}>
          <div className="admin-modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <h3>{isCreateModal ? 'Nouvelle catégorie' : 'Modifier la catégorie'}</h3>

            <div className="admin-form" style={{ marginBottom: 24 }}>
              <div className="admin-form-group">
                <label>Nom *</label>
                <input
                  type="text"
                  placeholder="Ex: Peinture contemporaine"
                  value={form.nom}
                  onChange={e => handleFormChange('nom', e.target.value)}
                />
              </div>
              <div className="admin-form-group">
                <label>Description</label>
                <textarea
                  placeholder="Description courte de la catégorie…"
                  value={form.description}
                  onChange={e => handleFormChange('description', e.target.value)}
                />
              </div>
              {formError && (
                <p style={{ color: '#ef4444', fontSize: 13, margin: 0 }}>{formError}</p>
              )}
            </div>

            <div className="admin-modal-actions">
              <button className="admin-btn" disabled={actionLoading} onClick={() => setModal(null)}>
                Annuler
              </button>
              <button
                className="admin-btn primary"
                disabled={actionLoading}
                onClick={isCreateModal ? handleCreate : handleEdit}
              >
                {actionLoading ? 'Enregistrement…' : (isCreateModal ? 'Créer' : 'Enregistrer')}
              </button>
            </div>
          </div>
        </div>
        </Portal>
      )}

      {/* Modal suppression */}
      {isDeleteModal && (
        <Portal>
        <div className="admin-modal-overlay" onClick={() => !actionLoading && setModal(null)}>
          <div className="admin-modal" onClick={e => e.stopPropagation()}>
            <h3>Supprimer la catégorie ?</h3>
            <p>
              Vous êtes sur le point de supprimer <strong>"{modal.cat.nom}"</strong>.
              Les articles liés à cette catégorie ne seront pas supprimés.
            </p>
            <div className="admin-modal-actions">
              <button className="admin-btn" disabled={actionLoading} onClick={() => setModal(null)}>
                Annuler
              </button>
              <button className="admin-btn danger" disabled={actionLoading} onClick={handleDelete}>
                {actionLoading ? 'Suppression…' : 'Confirmer'}
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
