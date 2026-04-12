import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  getCurrentUser,
  getAllSignalements,
  traiterSignalement,
  rejeterSignalement,
  deleteSignalement,
  getAllSignalementsCommentaires,
  traiterSignalementCommentaire,
  rejeterSignalementCommentaire,
  deleteSignalementCommentaire,
  getClaimsForTable,
} from '../../../api/api';
import { useAuth } from '../../../contexts/AuthContext.jsx';
import Loader from '../../../components/Loader/Loader.jsx';
import Portal from '../../../components/Modal/Portal.jsx';
import ClaimSection, { ClaimBadge } from '../../../components/ClaimSection/ClaimSection.jsx';
import './AdminPages.css';
import './Signalements.css';

const RAISON_LABELS = {
  contenu_inapproprie: 'Contenu inapproprié',
  spam:                'Spam',
  harcelement:         'Harcèlement',
  desinformation:      'Désinformation',
  droits_auteur:       "Droits d'auteur",
  autre:               'Autre',
};

const RAISON_ICONS = {
  contenu_inapproprie: 'block',
  spam:                'mark_email_unread',
  harcelement:         'report',
  desinformation:      'fact_check',
  droits_auteur:       'copyright',
  autre:               'flag',
};

const STATUT_COLORS = {
  en_attente: 'rgba(245,158,11,0.12)',
  traite:     'rgba(16,185,129,0.12)',
  rejete:     'rgba(148,163,184,0.12)',
};

const STATUT_TEXT = {
  en_attente: '#f59e0b',
  traite:     '#10b981',
  rejete:     '#94a3b8',
};

export default function SignalementsManagement() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const currentAdminId = user?.id;

  const [signalements, setSignalements] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter]     = useState('all'); // 'all' | 'article' | 'commentaire'
  const [selected, setSelected]         = useState(null);
  const [confirm, setConfirm]           = useState(null);
  const [confirmNote, setConfirmNote]   = useState('');
  const [sortBy, setSortBy]             = useState('date_desc');
  const [search, setSearch]             = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast]               = useState(null);
  const [claimsMap, setClaimsMap]       = useState({}); // { [item_id]: claim }

  const isClaimedByMe = (id) => {
    const c = claimsMap[id];
    return c && new Date(c.expires_at) > new Date() && c.claimed_by === currentAdminId;
  };

  const updateClaim = (itemId, claim) => {
    setClaimsMap(prev => ({ ...prev, [itemId]: claim || undefined }));
  };

  const loadSignalements = useCallback(async () => {
    try {
      const [sigsRes, sigsCommRes, claimsRes] = await Promise.allSettled([
        getAllSignalements(),
        getAllSignalementsCommentaires(),
        getClaimsForTable('signalements'),
      ]);

      const articleSigs = (sigsRes.status === 'fulfilled' ? sigsRes.value?.data || [] : [])
        .map(s => ({ ...s, _type: 'article' }));

      const commSigs = (sigsCommRes.status === 'fulfilled' ? sigsCommRes.value?.data || [] : [])
        .map(s => ({ ...s, _type: 'commentaire' }));

      setSignalements([...articleSigs, ...commSigs]);

      if (claimsRes.status === 'fulfilled') {
        const map = {};
        (claimsRes.value?.data?.data || []).forEach(c => { map[c.item_id] = c; });
        setClaimsMap(map);
      }
    } catch (err) {
      console.error('Erreur chargement signalements:', err);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        const { data } = await getCurrentUser();
        if (!data) return navigate('/login');
        if (!['admin','super_admin'].includes(data.profil?.role)) return navigate('/dashboard/lecteur');
      } catch {
        return navigate('/login');
      }
      await loadSignalements();
      setLoading(false);
    };
    init();
  }, [navigate, loadSignalements]);

  // ── Polling + Page Visibility ──────────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(loadSignalements, 60_000);
    const onVisible = () => { if (!document.hidden) loadSignalements(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [loadSignalements]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const articleSignalCount = signalements.reduce((acc, s) => {
    if (s._type === 'article' && s.article_id) acc[s.article_id] = (acc[s.article_id] || 0) + 1;
    return acc;
  }, {});

  const q = search.toLowerCase().trim();
  const filtered = signalements
    .filter(s => statusFilter === 'all' || s.statut === statusFilter)
    .filter(s => typeFilter === 'all' || s._type === typeFilter)
    .filter(s => !q || (
      s.articles?.titre?.toLowerCase().includes(q) ||
      s.commentaires?.articles?.titre?.toLowerCase().includes(q) ||
      s.commentaires?.contenu?.toLowerCase().includes(q) ||
      s.profils?.nom?.toLowerCase().includes(q) ||
      (RAISON_LABELS[s.raison] || '').toLowerCase().includes(q) ||
      s.description?.toLowerCase().includes(q)
    ))
    .sort((a, b) => {
      if (sortBy === 'date_asc')  return new Date(a.created_at) - new Date(b.created_at);
      if (sortBy === 'raison')    return (RAISON_LABELS[a.raison] || '').localeCompare(RAISON_LABELS[b.raison] || '');
      return new Date(b.created_at) - new Date(a.created_at);
    });

  const enAttente = signalements.filter(s => s.statut === 'en_attente').length;

  const handleAction = async () => {
    if (!confirm) return;
    const { type, sig } = confirm;
    const isComm = sig._type === 'commentaire';
    setActionLoading(true);
    try {
      if (type === 'traiter') {
        const fn = isComm ? traiterSignalementCommentaire : traiterSignalement;
        const { data } = await fn(sig.id, confirmNote || null);
        setSignalements(prev => prev.map(s => s.id === sig.id ? { ...s, statut: data.statut } : s));
        if (selected?.id === sig.id) setSelected(prev => ({ ...prev, statut: data.statut }));
        if (!isComm) updateClaim(sig.id, null);
        showToast('Signalement marqué comme traité');
      } else if (type === 'rejeter') {
        const fn = isComm ? rejeterSignalementCommentaire : rejeterSignalement;
        const { data } = await fn(sig.id, confirmNote || null);
        setSignalements(prev => prev.map(s => s.id === sig.id ? { ...s, statut: data.statut } : s));
        if (selected?.id === sig.id) setSelected(prev => ({ ...prev, statut: data.statut }));
        if (!isComm) updateClaim(sig.id, null);
        showToast('Signalement rejeté');
      } else if (type === 'delete') {
        const fn = isComm ? deleteSignalementCommentaire : deleteSignalement;
        await fn(sig.id);
        setSignalements(prev => prev.filter(s => s.id !== sig.id));
        if (!isComm) updateClaim(sig.id, null);
        if (selected?.id === sig.id) setSelected(null);
        showToast('Signalement supprimé');
      }
    } catch {
      showToast('Erreur lors de l\'action', 'error');
    } finally {
      setActionLoading(false);
      setConfirm(null);
      setConfirmNote('');
    }
  };

  const formatDate = (d) =>
    d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

  const StatutBadge = ({ statut }) => (
    <span
      className="badge"
      style={{
        background: STATUT_COLORS[statut] || 'var(--color-border)',
        color: STATUT_TEXT[statut] || 'var(--color-text)',
      }}
    >
      {statut === 'en_attente' ? 'En attente' : statut === 'traite' ? 'Traité' : 'Rejeté'}
    </span>
  );

  if (loading) return <Loader />;

  return (
    <div className="admin-page">
      {/* En-tête */}
      <div className="admin-page-header">
        <div>
          <h2>Signalements</h2>
          <p>
            {signalements.length} signalement{signalements.length > 1 ? 's' : ''} au total
            {enAttente > 0 && (
              <span style={{ color: '#f59e0b', fontWeight: 700, marginLeft: 8 }}>
                • {enAttente} en attente
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Filtres */}
      <div className="admin-filters">
        <div className="admin-search-wrap">
          <span className="material-icons">search</span>
          <input
            className="admin-search"
            type="text"
            placeholder="Rechercher article, utilisateur, motif…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select className="admin-select" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="all">Tous les types</option>
          <option value="article">Articles</option>
          <option value="commentaire">Commentaires</option>
        </select>
        <select className="admin-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="all">Tous les statuts</option>
          <option value="en_attente">En attente</option>
          <option value="traite">Traités</option>
          <option value="rejete">Rejetés</option>
        </select>
        <select className="admin-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="date_desc">Plus récent</option>
          <option value="date_asc">Plus ancien</option>
          <option value="raison">Motif (A–Z)</option>
        </select>
        <span className="admin-count">{filtered.length} résultat{filtered.length > 1 ? 's' : ''}</span>
      </div>

      {/* Grille de cards */}
      {filtered.length === 0 ? (
        <div className="admin-empty">
          <span className="material-icons">flag</span>
          <p>Aucun signalement{statusFilter !== 'all' ? ' dans cette catégorie' : ''}</p>
        </div>
      ) : (
        <div className="sig-grid">
          {filtered.map(sig => (
            <div
              key={sig.id}
              className={`sig-card status-${sig.statut}`}
              onClick={() => setSelected(sig)}
            >
              {/* Top: type + occurrences + claim badge */}
              <div className="sig-card-top">
                <span
                  className="sig-type-badge"
                  style={{
                    background: sig._type === 'commentaire' ? 'rgba(99,102,241,0.1)' : 'rgba(16,185,129,0.1)',
                    color:      sig._type === 'commentaire' ? '#6366f1' : '#10b981',
                  }}
                >
                  <span className="material-icons" style={{ fontSize: 12 }}>
                    {sig._type === 'commentaire' ? 'chat_bubble' : 'article'}
                  </span>
                  {sig._type === 'commentaire' ? 'Commentaire' : 'Article'}
                </span>
                {sig._type === 'article' && articleSignalCount[sig.article_id] > 1 && (
                  <span
                    className="sig-repeat-badge"
                    title={`Cet article a été signalé ${articleSignalCount[sig.article_id]} fois`}
                    style={{
                      background: articleSignalCount[sig.article_id] >= 4 ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)',
                      color: articleSignalCount[sig.article_id] >= 4 ? '#ef4444' : '#d97706',
                    }}
                  >
                    <span className="material-icons">flag</span>
                    ×{articleSignalCount[sig.article_id]}
                  </span>
                )}
                {sig._type === 'article' && <ClaimBadge claim={claimsMap[sig.id]} currentUserId={currentAdminId} />}
              </div>

              {/* Titre / aperçu */}
              <div className="sig-card-article">
                {sig._type === 'commentaire'
                  ? (sig.commentaires?.contenu
                      ? `"${sig.commentaires.contenu.slice(0, 60)}${sig.commentaires.contenu.length > 60 ? '…' : ''}"`
                      : 'Commentaire supprimé')
                  : (sig.articles?.titre || 'Article supprimé')
                }
              </div>

              {/* Motif + description */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span
                  className="badge"
                  style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', display: 'inline-flex', alignItems: 'center', gap: 4, alignSelf: 'flex-start' }}
                >
                  <span className="material-icons" style={{ fontSize: 13 }}>
                    {RAISON_ICONS[sig.raison] || 'flag'}
                  </span>
                  {RAISON_LABELS[sig.raison] || sig.raison}
                </span>
                {sig.description && (
                  <div className="sig-card-desc">"{sig.description}"</div>
                )}
              </div>

              {/* Bottom: user + date */}
              <div className="sig-card-bottom">
                <div className="sig-card-user">
                  <div className="sig-card-avatar">
                    {sig.profils?.avatar_url
                      ? <img src={sig.profils.avatar_url} alt="" />
                      : (sig.profils?.nom?.[0]?.toUpperCase() || '?')
                    }
                  </div>
                  <span className="sig-card-user-name">
                    {sig.profils?.nom || 'Utilisateur'}
                  </span>
                </div>
                <span className="sig-card-date">{formatDate(sig.created_at)}</span>
              </div>

              <div className="sig-card-hint">
                <span className="material-icons">open_in_full</span>
                Voir les détails
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Panel de détail */}
      {selected && (
        <div
          className="sig-detail-overlay"
          onClick={() => !actionLoading && setSelected(null)}
        >
          <div className="sig-detail-panel" onClick={e => e.stopPropagation()}>
            <button
              className="sig-detail-close"
              onClick={() => setSelected(null)}
              disabled={actionLoading}
            >
              <span className="material-icons">close</span>
            </button>

            {/* Banner de statut en haut du drawer */}
            <div style={{ 
              margin: '-32px -28px 20px', 
              padding: '12px 28px', 
              background: `${STATUT_COLORS[selected.statut]}15`, 
              borderBottom: `1.5px solid ${STATUT_COLORS[selected.statut]}40`,
              color: STATUT_TEXT[selected.statut],
              fontWeight: 700,
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              borderRadius: '12px 12px 0 0'
            }}>
              <span className="material-icons" style={{ fontSize: 18 }}>
                {selected.statut === 'en_attente' ? 'hourglass_empty' : selected.statut === 'traite' ? 'check_circle' : 'cancel'}
              </span>
              Statut : {selected.statut === 'en_attente' ? 'En attente' : selected.statut === 'traite' ? 'Traité' : 'Rejeté'}
            </div>

            <div className="sig-detail-title">
              Détail du signalement
            </div>

            {/* Occurrences (articles uniquement) */}
            {selected._type === 'article' && articleSignalCount[selected.article_id] > 1 && (
              <div style={{ marginTop: -10, marginBottom: 10 }}>
                <span
                  className="sig-repeat-badge"
                  style={{
                    background: articleSignalCount[selected.article_id] >= 4 ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)',
                    color: articleSignalCount[selected.article_id] >= 4 ? '#ef4444' : '#d97706',
                  }}
                >
                  <span className="material-icons">flag</span>
                  Cet article a été signalé {articleSignalCount[selected.article_id]} fois
                </span>
              </div>
            )}

            {/* Contenu signalé */}
            {selected._type === 'commentaire' ? (
              <div className="sig-detail-section">
                <div className="sig-detail-section-title">Commentaire signalé</div>
                <div className="sig-detail-row">
                  <span className="material-icons">chat_bubble</span>
                  <div className="sig-detail-row-content">
                    <span className="sig-detail-row-label">Contenu</span>
                    <span className="sig-detail-row-value" style={{ fontStyle: 'italic' }}>
                      "{selected.commentaires?.contenu || 'Commentaire supprimé'}"
                    </span>
                  </div>
                </div>
                {selected.commentaires?.auteur && (
                  <div className="sig-detail-row" style={{ marginTop: 8 }}>
                    <span className="material-icons">person</span>
                    <div className="sig-detail-row-content">
                      <span className="sig-detail-row-label">Auteur du commentaire</span>
                      <span className="sig-detail-row-value">{selected.commentaires.auteur.nom}</span>
                    </div>
                  </div>
                )}
                {selected.commentaires?.articles && (
                  <div className="sig-detail-row" style={{ marginTop: 8 }}>
                    <span className="material-icons">article</span>
                    <div className="sig-detail-row-content">
                      <span className="sig-detail-row-label">Article concerné</span>
                      <span className="sig-detail-row-value">
                        {selected.commentaires.articles.titre}
                        {selected.commentaires.articles.slug && (
                          <> <Link to={`/article/${selected.commentaires.articles.slug}`} target="_blank">Voir ↗</Link></>
                        )}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="sig-detail-section">
                <div className="sig-detail-section-title">Article signalé</div>
                <div className="sig-detail-row">
                  <span className="material-icons">article</span>
                  <div className="sig-detail-row-content">
                    <span className="sig-detail-row-label">Titre</span>
                    <span className="sig-detail-row-value">
                      {selected.articles?.titre || 'Article supprimé'}
                      {selected.articles?.slug && selected.articles?.est_publie && (
                        <> <Link to={`/article/${selected.articles.slug}`} target="_blank">Voir l'article ↗</Link></>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Signalé par */}
            <div className="sig-detail-section">
              <div className="sig-detail-section-title">Signalé par</div>
              <button
                className="sig-detail-user sig-detail-user-btn"
                onClick={() => selected.user_id && window.open(`/profil/${selected.user_id}`, '_blank')}
                title="Voir le profil"
              >
                <div className="sig-detail-user-avatar">
                  {selected.profils?.avatar_url
                    ? <img src={selected.profils.avatar_url} alt="" />
                    : (selected.profils?.nom?.[0]?.toUpperCase() || '?')
                  }
                </div>
                <div className="sig-detail-user-info">
                  <strong>{selected.profils?.nom || 'Utilisateur inconnu'}</strong>
                  <span>{selected.profils?.email || 'Email non disponible'}</span>
                </div>
              </button>
            </div>

            {/* Description */}
            <div className="sig-detail-section">
              <div className="sig-detail-section-title">Détails du signalement</div>
              <span
                className="badge"
                style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >
                <span className="material-icons" style={{ fontSize: 13 }}>
                  {RAISON_ICONS[selected.raison] || 'flag'}
                </span>
                {RAISON_LABELS[selected.raison] || selected.raison}
              </span>
              {selected.description ? (
                <div className="sig-detail-desc">{selected.description}</div>
              ) : (
                <span style={{ fontSize: 13, color: 'var(--color-text-placeholder)' }}>
                  Aucune description fournie.
                </span>
              )}
            </div>

            {/* Date */}
            <div className="sig-detail-row">
              <span className="material-icons">calendar_today</span>
              <div className="sig-detail-row-content">
                <span className="sig-detail-row-label">Date du signalement</span>
                <span className="sig-detail-row-value">{formatDate(selected.created_at)}</span>
              </div>
            </div>

            {/* Prise en charge — articles uniquement (pas de claim sur commentaires) */}
            {selected._type === 'article' && selected.statut === 'en_attente' && (
              <ClaimSection
                tableName="signalements"
                itemId={selected.id}
                claim={claimsMap[selected.id]}
                currentUserId={currentAdminId}
                onClaimChange={(c) => updateClaim(selected.id, c)}
              />
            )}

            {/* Actions */}
            <div className="sig-detail-actions">
              {selected.statut === 'en_attente' && (selected._type === 'commentaire' || isClaimedByMe(selected.id)) && (
                <>
                  <button
                    className="admin-btn primary"
                    disabled={actionLoading}
                    onClick={() => setConfirm({ type: 'traiter', sig: selected })}
                  >
                    <span className="material-icons">check_circle</span>
                    Traiter
                  </button>
                  <button
                    className="admin-btn"
                    disabled={actionLoading}
                    onClick={() => setConfirm({ type: 'rejeter', sig: selected })}
                  >
                    <span className="material-icons">cancel</span>
                    Rejeter
                  </button>
                </>
              )}
              <button
                className="admin-btn danger"
                disabled={actionLoading}
                onClick={() => setConfirm({ type: 'delete', sig: selected })}
              >
                <span className="material-icons">delete</span>
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmation */}
      {confirm && (
        <Portal>
        <div
          className="admin-modal-overlay"
          onClick={() => !actionLoading && setConfirm(null)}
        >
          <div className="admin-modal" onClick={e => e.stopPropagation()}>
            {confirm.type === 'traiter' && (
              <>
                <h3>Marquer comme traité ?</h3>
                <p>Ce signalement sera archivé comme traité. L'article peut être supprimé séparément si nécessaire.</p>
              </>
            )}
            {confirm.type === 'rejeter' && (
              <>
                <h3>Rejeter le signalement ?</h3>
                <p>Ce signalement sera considéré comme non fondé et archivé.</p>
              </>
            )}
            {confirm.type === 'delete' && (
              <>
                <h3>Supprimer le signalement ?</h3>
                <p>Cette action supprime définitivement le signalement de la base de données.</p>
              </>
            )}
            {(confirm.type === 'traiter' || confirm.type === 'rejeter') && (
              <div className="admin-form-group" style={{ marginTop: 12 }}>
                <label style={{ fontSize: 12, color: 'var(--color-text-placeholder)', marginBottom: 6, display: 'block' }}>
                  Note pour le signalant <span style={{ opacity: 0.6 }}>(optionnel)</span>
                </label>
                <textarea
                  placeholder="Expliquez votre décision au signalant…"
                  value={confirmNote}
                  onChange={e => setConfirmNote(e.target.value)}
                  rows={3}
                />
              </div>
            )}
            <div className="admin-modal-actions">
              <button className="admin-btn" disabled={actionLoading} onClick={() => setConfirm(null)}>
                Annuler
              </button>
              <button
                className={`admin-btn ${confirm.type === 'traiter' ? 'primary' : 'danger'}`}
                disabled={actionLoading}
                onClick={handleAction}
              >
                {actionLoading ? 'En cours…' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
        </Portal>
      )}

      {/* Prévisualisation profil */}

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
