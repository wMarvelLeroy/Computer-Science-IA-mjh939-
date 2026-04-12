import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser, getAllDemandesReexamination, traiterDemandeReexamination, getClaimsForTable } from '../../../api/api';
import { useAuth } from '../../../contexts/AuthContext.jsx';
import Loader from '../../../components/Loader/Loader.jsx';
import Portal from '../../../components/Modal/Portal.jsx';
import ClaimSection, { ClaimBadge } from '../../../components/ClaimSection/ClaimSection.jsx';
import './AdminPages.css';
import './Signalements.css';
import './Reexamination.css';

const TYPE_META = {
  restriction:       { label: 'Restriction',      icon: 'gavel',          color: '#ef4444' },
  auteur_banni:      { label: 'Bannissement',      icon: 'block',          color: '#ef4444' },
  article_restreint: { label: 'Article restreint', icon: 'visibility_off', color: '#f59e0b' },
  role_retire:       { label: 'Rôle retiré',       icon: 'person_remove',  color: '#f59e0b' },
};
const defaultMeta = { label: 'Sanction', icon: 'policy', color: '#64748b' };

const COOLDOWN_OPTIONS = [
  { value: null,  label: 'Pas de restriction (re-soumission libre)' },
  { value: 1,     label: '1 jour' },
  { value: 7,     label: '7 jours' },
  { value: 14,    label: '2 semaines' },
  { value: 30,    label: '1 mois' },
  { value: -1,    label: 'Indéfini (jamais)' },
];

const STATUT_COLORS  = { en_attente: 'rgba(245,158,11,0.12)',  approuvee: 'rgba(16,185,129,0.12)',  refusee: 'rgba(148,163,184,0.12)' };
const STATUT_TEXT    = { en_attente: '#d97706',                 approuvee: '#059669',                refusee: '#64748b' };
const STATUT_LABELS  = { en_attente: 'En attente',              approuvee: 'Approuvée',              refusee: 'Refusée' };

const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

// Auto-lift badge
const AUTO_LIFT = ['restriction', 'auteur_banni'];

export default function ReexaminationManagement() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const currentAdminId = user?.id;

  const [demandes, setDemandes]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected]         = useState(null);
  const [confirm, setConfirm]           = useState(null);
  const [reponse, setReponse]           = useState('');
  const [cooldown, setCooldown]         = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast]               = useState(null);
  const [claimsMap, setClaimsMap]       = useState({});

  const isClaimedByMe = (id) => {
    const c = claimsMap[id];
    return c && new Date(c.expires_at) > new Date() && c.claimed_by === currentAdminId;
  };

  const updateClaim = (itemId, claim) => {
    setClaimsMap(prev => ({ ...prev, [itemId]: claim || undefined }));
  };

  useEffect(() => {
    const init = async () => {
      try {
        const { data } = await getCurrentUser();
        if (!data) return navigate('/login');
        if (!['admin', 'super_admin'].includes(data.profil?.role)) return navigate('/dashboard/lecteur');
      } catch {
        return navigate('/login');
      }
      try {
        const [demandesRes, claimsRes] = await Promise.allSettled([
          getAllDemandesReexamination(),
          getClaimsForTable('demandes_reexamination'),
        ]);
        setDemandes(demandesRes.status === 'fulfilled' ? demandesRes.value?.data || [] : []);
        if (claimsRes.status === 'fulfilled') {
          const map = {};
          (claimsRes.value?.data?.data || []).forEach(c => { map[c.item_id] = c; });
          setClaimsMap(map);
        }
      } catch (err) {
        console.error('Erreur chargement réexaminations:', err);
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

  const filtered = demandes.filter(d =>
    statusFilter === 'all' || d.statut === statusFilter
  );
  const enAttente = demandes.filter(d => d.statut === 'en_attente').length;

  const openConfirm = (decision) => {
    setReponse('');
    setCooldown(null);
    setConfirm({ decision });
  };

  const handleAction = async () => {
    if (!confirm || !selected) return;
    setActionLoading(true);
    try {
      const { data } = await traiterDemandeReexamination(
        selected.id,
        confirm.decision,
        reponse || null,
        confirm.decision === 'refusee' ? cooldown : undefined
      );
      setDemandes(prev => prev.map(d => d.id === selected.id ? { ...d, ...data } : d));
      setSelected(prev => ({ ...prev, ...data }));
      updateClaim(selected.id, null);
      showToast(confirm.decision === 'approuvee' ? 'Demande approuvée' : 'Demande refusée');
      setConfirm(null);
    } catch {
      showToast('Erreur lors du traitement', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const StatutBadge = ({ statut }) => (
    <span className="badge" style={{
      background: STATUT_COLORS[statut] || 'var(--color-border)',
      color: STATUT_TEXT[statut] || 'var(--color-text)',
    }}>
      {STATUT_LABELS[statut] || statut}
    </span>
  );

  if (loading) return <Loader />;

  return (
    <div className="admin-page">
      {/* En-tête */}
      <div className="admin-page-header">
        <div>
          <h2>Demandes de réexamination</h2>
          <p>
            {demandes.length} demande{demandes.length > 1 ? 's' : ''} au total
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
        <select className="admin-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="all">Tous les statuts</option>
          <option value="en_attente">En attente</option>
          <option value="approuvee">Approuvées</option>
          <option value="refusee">Refusées</option>
        </select>
        <span className="admin-count">{filtered.length} résultat{filtered.length > 1 ? 's' : ''}</span>
      </div>

      {/* Grille */}
      {filtered.length === 0 ? (
        <div className="admin-empty">
          <span className="material-icons">policy</span>
          <p>Aucune demande{statusFilter !== 'all' ? ' dans cette catégorie' : ''}</p>
        </div>
      ) : (
        <div className="reex-grid">
          {filtered.map(d => {
            const meta = TYPE_META[d.type_sanction] || defaultMeta;
            const initials = d.profils?.nom
              ? d.profils.nom.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
              : '?';
            return (
              <div
                key={d.id}
                className={`reex-card status-${d.statut}`}
                onClick={() => setSelected(d)}
              >
                <div className="reex-card-top">
                  <ClaimBadge claim={claimsMap[d.id]} currentUserId={currentAdminId} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span
                      className="badge"
                      style={{ background: `${meta.color}14`, color: meta.color }}
                    >
                      <span className="material-icons" style={{ fontSize: 13 }}>{meta.icon}</span>
                      {meta.label}
                    </span>
                    {AUTO_LIFT.includes(d.type_sanction) && d.statut === 'en_attente' && (
                      <span className="reex-auto-badge" title="Levée automatique si approuvée">
                        <span className="material-icons" style={{ fontSize: 13 }}>auto_fix_high</span>
                        Auto
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'block', minWidth: 0, width: '100%' }}>
                    <div className="reex-card-motif">"{d.motif.length > 100 ? d.motif.slice(0, 100) + '…' : d.motif}"</div>
                  </div>
                </div>

                <div className="reex-card-bottom">
                  <button
                    className="reex-card-user"
                    onClick={e => { e.stopPropagation(); window.open(`/profil/${d.user_id}`, '_blank'); }}
                    title="Voir le profil"
                  >
                    <div className="reex-card-avatar">
                      {d.profils?.avatar_url
                        ? <img src={d.profils.avatar_url} alt="" />
                        : initials}
                    </div>
                    <span>{d.profils?.nom || 'Utilisateur'}</span>
                  </button>
                  <span className="reex-card-date">{formatDate(d.created_at)}</span>
                </div>

                <div className="sig-card-hint">
                  <span className="material-icons">open_in_full</span>
                  Voir les détails
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Panel de détail */}
      {selected && (
        <div className="sig-detail-overlay" onClick={() => !actionLoading && setSelected(null)}>
          <div className="sig-detail-panel" onClick={e => e.stopPropagation()}>
            <button className="sig-detail-close" onClick={() => setSelected(null)} disabled={actionLoading}>
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
                {selected.statut === 'en_attente' ? 'hourglass_empty' : selected.statut === 'approuvee' ? 'check_circle' : 'cancel'}
              </span>
              Statut : {STATUT_LABELS[selected.statut]}
            </div>

            <div className="sig-detail-title">Détail de la demande</div>

            {/* Badges de contexte (sanction) */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: -10, marginBottom: 10 }}>
              {(() => {
                const meta = TYPE_META[selected.type_sanction] || defaultMeta;
                return (
                  <span className="badge" style={{ background: `${meta.color}14`, color: meta.color, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <span className="material-icons" style={{ fontSize: 13 }}>{meta.icon}</span>
                    {meta.label}
                  </span>
                );
              })()}
              {AUTO_LIFT.includes(selected.type_sanction) && selected.statut === 'en_attente' && (
                <span className="reex-auto-badge" title="Levée automatique si approuvée">
                  <span className="material-icons" style={{ fontSize: 13 }}>auto_fix_high</span>
                  Auto
                </span>
              )}
            </div>

            {/* Utilisateur */}
            <div className="sig-detail-section">
              <div className="sig-detail-section-title">Demandé par</div>
              <button
                className="sig-detail-user sig-detail-user-btn"
                onClick={() => selected.user_id && window.open(`/profil/${selected.user_id}`, '_blank')}
                title="Voir le profil"
              >
                <div className="sig-detail-user-avatar">
                  {selected.profils?.avatar_url
                    ? <img src={selected.profils.avatar_url} alt="" />
                    : (selected.profils?.nom?.[0]?.toUpperCase() || '?')}
                </div>
                <div className="sig-detail-user-info">
                  <strong>{selected.profils?.nom || 'Utilisateur inconnu'}</strong>
                  <span>{selected.profils?.email || 'Email non disponible'}</span>
                </div>
              </button>
            </div>

            {/* Notification d'origine */}
            {selected.notifications && (
              <div className="sig-detail-section">
                <div className="sig-detail-section-title">Notification d'origine</div>
                <div className="reex-notif-origin">
                  <strong>{selected.notifications.titre}</strong>
                  <p>{selected.notifications.message}</p>
                  <span className="reex-origin-date">{formatDate(selected.notifications.created_at)}</span>
                </div>
              </div>
            )}

            {/* Motif */}
            <div className="sig-detail-section">
              <div className="sig-detail-section-title">Motif de contestation</div>
              <div className="sig-detail-desc">{selected.motif}</div>
            </div>

            {/* Réponse admin si traitée */}
            {selected.statut !== 'en_attente' && (
              <div className="sig-detail-section">
                <div className="sig-detail-section-title">Réponse de l'administration</div>
                {selected.reponse_admin
                  ? <div className="sig-detail-desc">{selected.reponse_admin}</div>
                  : <span style={{ fontSize: 13, color: 'var(--color-text-placeholder)' }}>Aucune réponse fournie.</span>
                }
                {selected.statut === 'refusee' && selected.cooldown_jours !== undefined && (
                  <div className="reex-cooldown-info">
                    <span className="material-icons">timer</span>
                    {selected.cooldown_jours === null && 'Pas de restriction sur la re-soumission'}
                    {selected.cooldown_jours === -1 && 'Bloqué définitivement'}
                    {selected.cooldown_jours > 0 && `Cooldown : ${selected.cooldown_jours} jour(s)`}
                  </div>
                )}
              </div>
            )}

            {/* Date */}
            <div className="sig-detail-row">
              <span className="material-icons">calendar_today</span>
              <div className="sig-detail-row-content">
                <span className="sig-detail-row-label">Date de la demande</span>
                <span className="sig-detail-row-value">{formatDate(selected.created_at)}</span>
              </div>
            </div>

            {/* Prise en charge */}
            {selected.statut === 'en_attente' && (
              <ClaimSection
                tableName="demandes_reexamination"
                itemId={selected.id}
                claim={claimsMap[selected.id]}
                currentUserId={currentAdminId}
                onClaimChange={(c) => updateClaim(selected.id, c)}
              />
            )}

            {/* Actions */}
            {selected.statut === 'en_attente' && isClaimedByMe(selected.id) && (
              <div className="sig-detail-actions">
                <button
                  className="admin-btn primary"
                  disabled={actionLoading}
                  onClick={() => openConfirm('approuvee')}
                >
                  <span className="material-icons">check_circle</span>
                  Approuver
                </button>
                <button
                  className="admin-btn"
                  disabled={actionLoading}
                  onClick={() => openConfirm('refusee')}
                >
                  <span className="material-icons">cancel</span>
                  Refuser
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de confirmation */}
      {confirm && (
        <Portal>
          <div className="admin-modal-overlay" onClick={() => !actionLoading && setConfirm(null)}>
            <div className="admin-modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
              <h3>
                {confirm.decision === 'approuvee' ? 'Approuver la demande ?' : 'Refuser la demande ?'}
              </h3>

              {confirm.decision === 'approuvee' && AUTO_LIFT.includes(selected?.type_sanction) && (
                <p className="reex-auto-info">
                  <span className="material-icons">auto_fix_high</span>
                  La sanction sera levée automatiquement.
                </p>
              )}
              {confirm.decision === 'approuvee' && !AUTO_LIFT.includes(selected?.type_sanction) && (
                <p className="reex-auto-info" style={{ color: '#f59e0b' }}>
                  <span className="material-icons">warning</span>
                  Action manuelle requise après approbation (article restreint / rôle).
                </p>
              )}

              <div className="admin-form" style={{ marginTop: 16 }}>
                <div className="admin-form-group">
                  <label>Réponse à l'utilisateur (optionnel)</label>
                  <textarea
                    placeholder="Expliquez votre décision…"
                    value={reponse}
                    onChange={e => setReponse(e.target.value)}
                    rows={3}
                  />
                </div>

                {confirm.decision === 'refusee' && (
                  <div className="admin-form-group">
                    <label>Cooldown avant re-soumission</label>
                    <select
                      className="admin-select"
                      style={{ width: '100%' }}
                      value={cooldown ?? 'null'}
                      onChange={e => {
                        const v = e.target.value;
                        setCooldown(v === 'null' ? null : Number(v));
                      }}
                    >
                      {COOLDOWN_OPTIONS.map(opt => (
                        <option key={String(opt.value)} value={opt.value ?? 'null'}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="admin-modal-actions">
                <button className="admin-btn" disabled={actionLoading} onClick={() => setConfirm(null)}>
                  Annuler
                </button>
                <button
                  className={`admin-btn ${confirm.decision === 'approuvee' ? 'primary' : 'danger'}`}
                  disabled={actionLoading}
                  onClick={handleAction}
                >
                  {actionLoading ? 'En cours…' : confirm.decision === 'approuvee' ? 'Approuver' : 'Refuser'}
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
          <span className="material-icons">{toast.type === 'success' ? 'check_circle' : 'error'}</span>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
