import { useState, useEffect, useCallback } from 'react';
import { getCurrentUser, getAllCategories, getDemandesCategorieByUser, createDemandeCategorie, deleteDemandeCategorie } from '../../../api/api.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlus, faTags, faCheckCircle, faClock, faTimesCircle,
  faTrash, faChevronDown, faChevronUp, faInfoCircle
} from '@fortawesome/free-solid-svg-icons';
import Loader from '../../../components/Loader/Loader.jsx';
import './CategoryRequests.css';

const STATUS_META = {
  en_attente: { label: 'En attente',  icon: faClock,       color: '#f59e0b' },
  approuvee:  { label: 'Approuvée',   icon: faCheckCircle, color: '#10b981' },
  refusee:    { label: 'Refusée',     icon: faTimesCircle, color: '#ef4444' },
};

function slugify(str) {
  return str
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function CategoryRequests() {
  const [user,        setUser]        = useState(null);
  const [categories,  setCategories]  = useState([]);
  const [demandes,    setDemandes]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [showForm,    setShowForm]    = useState(false);
  const [submitting,  setSubmitting]  = useState(false);
  const [deletingId,  setDeletingId]  = useState(null);
  const [success,     setSuccess]     = useState(false);
  const [error,       setError]       = useState('');

  const [nom,           setNom]           = useState('');
  const [slug,          setSlug]          = useState('');
  const [description,   setDescription]   = useState('');
  const [justification, setJustification] = useState('');
  const [slugEdited,    setSlugEdited]    = useState(false);

  const load = useCallback(async () => {
    try {
      const { data: u } = await getCurrentUser();
      if (!u) return;
      setUser(u);
      const [catsRes, demandesRes] = await Promise.allSettled([
        getAllCategories(),
        getDemandesCategorieByUser(u.id),
      ]);
      if (catsRes.status === 'fulfilled') setCategories(catsRes.value?.data || []);
      if (demandesRes.status === 'fulfilled') setDemandes(demandesRes.value?.data || []);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-slug depuis le nom
  useEffect(() => {
    if (!slugEdited) setSlug(slugify(nom));
  }, [nom, slugEdited]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!nom.trim())           { setError('Le nom est requis.');           return; }
    if (!slug.trim())          { setError('Le slug est requis.');          return; }
    if (!justification.trim()) { setError('La justification est requise.'); return; }

    if (categories.some(c => c.slug === slug || c.nom.toLowerCase() === nom.toLowerCase())) {
      setError('Une catégorie avec ce nom ou ce slug existe déjà.');
      return;
    }
    if (demandes.some(d => d.statut === 'en_attente' && (d.slug === slug || d.nom.toLowerCase() === nom.toLowerCase()))) {
      setError('Vous avez déjà une demande en attente pour cette catégorie.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await createDemandeCategorie(user.id, nom.trim(), slug.trim(), description.trim(), justification.trim());
      if (res.success) {
        setDemandes(prev => [res.data, ...prev]);
        setNom(''); setSlug(''); setDescription(''); setJustification('');
        setSlugEdited(false);
        setShowForm(false);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 4000);
      } else {
        setError(res.error || 'Erreur lors de la soumission.');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de la soumission.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      await deleteDemandeCategorie(id);
      setDemandes(prev => prev.filter(d => d.id !== id));
    } catch { /* ignore */ } finally {
      setDeletingId(null);
    }
  };

  if (loading) return <Loader />;

  return (
    <div className="cr-page fadeInContainer">

      {/* HEADER */}
      <div className="cr-header">
        <div>
          <h2 className="cr-title">Demandes de catégorie</h2>
          <p className="cr-subtitle">Proposez de nouvelles catégories pour enrichir la plateforme</p>
        </div>
        <button className="cr-new-btn" onClick={() => setShowForm(v => !v)}>
          <FontAwesomeIcon icon={showForm ? faChevronUp : faPlus} />
          {showForm ? 'Masquer' : 'Nouvelle demande'}
        </button>
      </div>

      {/* TOAST SUCCÈS */}
      {success && (
        <div className="cr-toast cr-toast--success">
          <FontAwesomeIcon icon={faCheckCircle} />
          Demande envoyée ! Elle sera examinée par l'équipe de modération.
        </div>
      )}

      {/* FORMULAIRE */}
      {showForm && (
        <div className="cr-form-card">
          <h3 className="cr-form-title">
            <FontAwesomeIcon icon={faTags} />
            Proposer une catégorie
          </h3>

          <div className="cr-info-banner">
            <FontAwesomeIcon icon={faInfoCircle} />
            <span>Les catégories approuvées seront disponibles pour tous les auteurs. Votre demande sera examinée sous 48h.</span>
          </div>

          <form className="cr-form" onSubmit={handleSubmit}>
            <div className="cr-form-row">
              <div className="cr-field">
                <label className="cr-label">Nom de la catégorie <span>*</span></label>
                <input
                  type="text"
                  className="cr-input"
                  placeholder="ex: Photographie, Sculpture…"
                  value={nom}
                  onChange={e => setNom(e.target.value)}
                  maxLength={60}
                />
              </div>
              <div className="cr-field">
                <label className="cr-label">Slug <span>*</span></label>
                <input
                  type="text"
                  className="cr-input cr-input--mono"
                  placeholder="ex: photographie"
                  value={slug}
                  onChange={e => { setSlug(slugify(e.target.value)); setSlugEdited(true); }}
                  maxLength={60}
                />
                <span className="cr-field-hint">Identifiant unique, généré automatiquement</span>
              </div>
            </div>

            <div className="cr-field">
              <label className="cr-label">Description <span className="cr-optional">(optionnel)</span></label>
              <textarea
                className="cr-input cr-textarea"
                placeholder="Décrivez brièvement cette catégorie…"
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={2}
                maxLength={300}
              />
            </div>

            <div className="cr-field">
              <label className="cr-label">Justification <span>*</span></label>
              <textarea
                className="cr-input cr-textarea"
                placeholder="Pourquoi cette catégorie serait utile ? Quels types d'articles accueillerait-elle ?"
                value={justification}
                onChange={e => setJustification(e.target.value)}
                rows={3}
                maxLength={500}
              />
              <span className="cr-field-hint">{justification.length}/500</span>
            </div>

            {error && (
              <div className="cr-error">
                <FontAwesomeIcon icon={faTimesCircle} />
                {error}
              </div>
            )}

            <div className="cr-form-actions">
              <button type="button" className="cr-btn-cancel" onClick={() => { setShowForm(false); setError(''); }}>
                Annuler
              </button>
              <button type="submit" className="cr-btn-submit" disabled={submitting}>
                <FontAwesomeIcon icon={submitting ? faClock : faPlus} />
                {submitting ? 'Envoi…' : 'Soumettre la demande'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MES DEMANDES */}
      <div className="cr-section">
        <h3 className="cr-section-title">Mes demandes ({demandes.length})</h3>

        {demandes.length === 0 ? (
          <div className="cr-empty">
            <FontAwesomeIcon icon={faTags} className="cr-empty-icon" />
            <p>Aucune demande soumise pour l'instant.</p>
          </div>
        ) : (
          <div className="cr-list">
            {demandes.map(d => {
              const meta = STATUS_META[d.statut] || STATUS_META.en_attente;
              return (
                <div key={d.id} className="cr-item">
                  <div className="cr-item-left">
                    <span className="cr-item-nom">{d.nom}</span>
                    <span className="cr-item-slug">/{d.slug}</span>
                    {d.description && <p className="cr-item-desc">{d.description}</p>}
                    {d.statut === 'refusee' && d.raison_refus && (
                      <p className="cr-item-refus">
                        <FontAwesomeIcon icon={faTimesCircle} /> Motif : {d.raison_refus}
                      </p>
                    )}
                  </div>
                  <div className="cr-item-right">
                    <span className="cr-status-badge" style={{ color: meta.color, background: `${meta.color}18`, border: `1px solid ${meta.color}40` }}>
                      <FontAwesomeIcon icon={meta.icon} />
                      {meta.label}
                    </span>
                    <span className="cr-item-date">
                      {new Date(d.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                    {d.statut === 'en_attente' && (
                      <button
                        className="cr-delete-btn"
                        onClick={() => handleDelete(d.id)}
                        disabled={deletingId === d.id}
                        title="Annuler la demande"
                      >
                        <FontAwesomeIcon icon={faTrash} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CATÉGORIES EXISTANTES */}
      <div className="cr-section">
        <h3 className="cr-section-title">Catégories existantes ({categories.length})</h3>
        <div className="cr-cats-grid">
          {categories.map(c => (
            <span key={c.id} className="cr-cat-chip">{c.nom}</span>
          ))}
        </div>
      </div>

    </div>
  );
}

export default CategoryRequests;
