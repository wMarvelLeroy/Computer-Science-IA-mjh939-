import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  getMesNotifications,
  marquerNotifLue,
  toutMarquerLu,
  getMesDemandesReexamination,
  soumettreReexamination,
  getAllSignalements,
  getAllDemandesAuteur,
  getAllDemandesCategorie,
  getAllDemandesReexamination,
} from '../../api/api.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import Loader from '../../components/Loader/Loader.jsx';
import './Notifications.css';

// ─── Éléments admin à gérer (résumés) ────────────────────────────────────────
const ADMIN_ITEMS_META = [
  { key: 'signalements',    icon: 'flag',           color: '#ef4444', label: 'signalement',             plural: 'signalements',            path: '/dashboard/admin/signalements' },
  { key: 'reexaminations',  icon: 'policy',         color: '#7c3aed', label: 'demande de réexamination', plural: 'demandes de réexamination', path: '/dashboard/admin/reexamination' },
  { key: 'demandesAuteur',  icon: 'person_add',     color: '#f59e0b', label: 'demande auteur',           plural: 'demandes auteur',           path: '/dashboard/admin/author-requests' },
  { key: 'demandesCateg',   icon: 'label',          color: '#0ea5e9', label: 'demande catégorie',        plural: 'demandes catégorie',        path: '/dashboard/admin/category-requests' },
];

// ─── Méta par type ────────────────────────────────────────────────────────────
const TYPE_META = {
  nouvel_article:    { icon: 'article',            color: '#10b981' },
  role_promu:        { icon: 'verified',           color: '#7c3aed' },
  role_retire:       { icon: 'person_remove',      color: '#f59e0b' },
  restriction:       { icon: 'gavel',              color: '#ef4444' },
  restriction_levee: { icon: 'lock_open',          color: '#10b981' },
  demande_approuvee: { icon: 'how_to_reg',         color: '#10b981' },
  demande_refusee:   { icon: 'cancel',             color: '#ef4444' },
  auteur_banni:      { icon: 'block',              color: '#ef4444' },
  auteur_debanni:    { icon: 'check_circle',       color: '#10b981' },
  article_restreint: { icon: 'visibility_off',     color: '#f59e0b' },
  article_supprime:  { icon: 'delete_forever',     color: '#ef4444' },
  claim_contested:   { icon: 'back_hand',          color: '#f59e0b' },
  signalement_traite:{ icon: 'check_circle',       color: '#10b981' },
  signalement_rejete:{ icon: 'do_not_disturb',     color: '#94a3b8' },
};
const defaultMeta = { icon: 'notifications', color: '#64748b' };
const getMeta = (type) => TYPE_META[type] || defaultMeta;

// Types pour lesquels l'utilisateur peut demander une réexamination
const TYPES_ACTIONNABLES = ['restriction', 'auteur_banni', 'article_restreint', 'role_retire'];
const TYPE_LABELS = {
  restriction:       'Restriction de compte',
  auteur_banni:      'Bannissement auteur',
  article_restreint: 'Article restreint',
  role_retire:       'Rôle retiré',
};

const formatDate = (d) =>
  new Date(d).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

const formatDateShort = (d) =>
  new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

// ─── Composant principal ──────────────────────────────────────────────────────
const isAdmin = (role) => ['admin', 'super_admin'].includes(role);

export default function Notifications() {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  const [notifs, setNotifs]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [filter, setFilter]         = useState('unread');
  const [actionLoading, setActionLoading] = useState(false);

  // Compteurs admin
  const [adminCounts, setAdminCounts] = useState(null); // null = pas encore chargé

  // Panel de détail
  const [selected, setSelected]     = useState(null); // notif sélectionnée

  // Réexamination
  const [demandesMap, setDemandesMap] = useState({}); // { [notification_id]: demande }
  const [motif, setMotif]           = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError]     = useState(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const loadNotifs = useCallback(async () => {
    try {
      const { data } = await getMesNotifications();
      setNotifs(data || []);
    } catch {
      setNotifs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDemandes = useCallback(async () => {
    try {
      const { data } = await getMesDemandesReexamination();
      const map = {};
      (data || []).forEach(d => { map[d.notification_id] = d; });
      setDemandesMap(map);
    } catch { /* silencieux */ }
  }, []);

  const loadAdminCounts = useCallback(async () => {
    try {
      const [sig, reex, auteur, categ] = await Promise.allSettled([
        getAllSignalements('en_attente'),
        getAllDemandesReexamination('en_attente'),
        getAllDemandesAuteur('en_attente'),
        getAllDemandesCategorie('en_attente'),
      ]);
      setAdminCounts({
        signalements:   sig.status    === 'fulfilled' ? (sig.value?.data    || []).length : 0,
        reexaminations: reex.status   === 'fulfilled' ? (reex.value?.data   || []).length : 0,
        demandesAuteur: auteur.status === 'fulfilled' ? (auteur.value?.data || []).length : 0,
        demandesCateg:  categ.status  === 'fulfilled' ? (categ.value?.data  || []).length : 0,
      });
    } catch {
      setAdminCounts({ signalements: 0, reexaminations: 0, demandesAuteur: 0, demandesCateg: 0 });
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) { navigate('/login'); return; }
    loadNotifs();
    loadDemandes();
    if (isAdmin(user?.profil?.role)) loadAdminCounts();
  }, [isAuthenticated, navigate, loadNotifs, loadDemandes, loadAdminCounts, user]);

  // ── Polling + Page Visibility ──────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) return;
    const refresh = () => {
      loadNotifs();
      if (isAdmin(user?.profil?.role)) loadAdminCounts();
    };
    const interval = setInterval(refresh, 60_000);
    const onVisible = () => { if (!document.hidden) refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [isAuthenticated, loadNotifs, loadAdminCounts, user]);

  const handleSelect = async (notif) => {
    setSelected(notif);
    setMotif('');
    setSubmitError(null);
    setSubmitSuccess(false);
    if (!notif.lu) {
      try {
        await marquerNotifLue(notif.id);
        setNotifs(prev => prev.map(n => n.id === notif.id ? { ...n, lu: true } : n));
      } catch { /* silencieux */ }
    }
  };

  const handleToutLire = async () => {
    setActionLoading(true);
    try {
      await toutMarquerLu();
      setNotifs(prev => prev.map(n => ({ ...n, lu: true })));
    } catch { /* silencieux */ }
    finally {
      setActionLoading(false);
    }
  };

  const handleSubmitReexamination = async () => {
    if (!motif.trim() || !selected) return;
    setSubmitLoading(true);
    setSubmitError(null);
    try {
      const { data } = await soumettreReexamination(selected.id, motif.trim());
      setDemandesMap(prev => ({ ...prev, [selected.id]: data }));
      setSubmitSuccess(true);
      setMotif('');
    } catch (err) {
      const msg = err?.response?.data?.error || 'Erreur lors de l\'envoi';
      const expireAt = err?.response?.data?.expire_at;
      if (expireAt) {
        setSubmitError(`Cooldown actif — vous pourrez re-soumettre le ${formatDateShort(expireAt)}.`);
      } else {
        setSubmitError(msg);
      }
    } finally {
      setSubmitLoading(false);
    }
  };

  const filtered = filter === 'unread' ? notifs.filter(n => !n.lu) : notifs;
  const unreadCount = notifs.filter(n => !n.lu).length;

  if (loading) return <Loader />;

  // ─── Bloc réexamination dans le panel de détail ──────────────────────────
  const renderReexamination = (notif) => {
    if (!TYPES_ACTIONNABLES.includes(notif.type)) return null;

    const demande = demandesMap[notif.id];

    if (demande) {
      // Demande existante
      if (demande.statut === 'en_attente') {
        return (
          <div className="notif-detail-reex">
            <div className="reex-status pending">
              <span className="material-icons">hourglass_empty</span>
              <div>
                <strong>Demande de réexamination en attente</strong>
                <span>Soumise le {formatDateShort(demande.created_at)}</span>
              </div>
            </div>
          </div>
        );
      }
      if (demande.statut === 'approuvee') {
        return (
          <div className="notif-detail-reex">
            <div className="reex-status approved">
              <span className="material-icons">check_circle</span>
              <div>
                <strong>Réexamination approuvée</strong>
                {demande.reponse_admin && <span>{demande.reponse_admin}</span>}
              </div>
            </div>
          </div>
        );
      }
      if (demande.statut === 'refusee') {
        // Vérifier si cooldown encore actif
        let canResubmit = true;
        let cooldownMsg = null;

        if (demande.cooldown_jours === -1) {
          canResubmit = false;
          cooldownMsg = 'Vous ne pouvez plus soumettre de nouvelle demande pour cette sanction.';
        } else if (demande.cooldown_jours && demande.traitee_le) {
          const expireAt = new Date(demande.traitee_le).getTime() + demande.cooldown_jours * 86400000;
          if (Date.now() < expireAt) {
            canResubmit = false;
            cooldownMsg = `Vous pourrez re-soumettre le ${formatDateShort(new Date(expireAt))}.`;
          }
        }

        return (
          <div className="notif-detail-reex">
            <div className="reex-status refused">
              <span className="material-icons">cancel</span>
              <div>
                <strong>Réexamination refusée</strong>
                {demande.reponse_admin && <span>{demande.reponse_admin}</span>}
                {cooldownMsg && <span className="reex-cooldown">{cooldownMsg}</span>}
              </div>
            </div>
            {canResubmit && !submitSuccess && (
              <div className="reex-form">
                <p className="reex-form-hint">Vous pouvez soumettre une nouvelle demande :</p>
                <textarea
                  className="reex-textarea"
                  placeholder="Expliquez votre situation…"
                  value={motif}
                  onChange={e => setMotif(e.target.value)}
                  rows={3}
                />
                {submitError && <p className="reex-error">{submitError}</p>}
                <button
                  className="reex-btn"
                  disabled={submitLoading || !motif.trim()}
                  onClick={handleSubmitReexamination}
                >
                  {submitLoading
                    ? <><span className="material-icons reex-spin">autorenew</span> Envoi…</>
                    : <><span className="material-icons">send</span> Soumettre</>
                  }
                </button>
              </div>
            )}
            {submitSuccess && (
              <div className="reex-status approved" style={{ marginTop: 12 }}>
                <span className="material-icons">check_circle</span>
                <strong>Demande envoyée avec succès !</strong>
              </div>
            )}
          </div>
        );
      }
    }

    // Pas encore de demande
    return (
      <div className="notif-detail-reex">
        <p className="reex-intro">
          <span className="material-icons">policy</span>
          Vous pouvez contester cette décision en soumettant une demande de réexamination.
        </p>
        {!submitSuccess ? (
          <div className="reex-form">
            <textarea
              className="reex-textarea"
              placeholder="Expliquez votre situation et pourquoi vous contestez cette décision…"
              value={motif}
              onChange={e => setMotif(e.target.value)}
              rows={4}
            />
            {submitError && <p className="reex-error">{submitError}</p>}
            <button
              className="reex-btn"
              disabled={submitLoading || !motif.trim()}
              onClick={handleSubmitReexamination}
            >
              {submitLoading
                ? <><span className="material-icons reex-spin">autorenew</span> Envoi en cours…</>
                : <><span className="material-icons">send</span> Demander une réexamination</>
              }
            </button>
          </div>
        ) : (
          <div className="reex-status approved">
            <span className="material-icons">check_circle</span>
            <div>
              <strong>Demande envoyée !</strong>
              <span>Un administrateur examinera votre demande prochainement.</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ─── Rendu ────────────────────────────────────────────────────────────────
  return (
    <div className={`notifs-page ${selected ? 'has-panel' : ''}`}>

      {/* ── Colonne liste ── */}
      <div className="notifs-main">
        <div className="notifs-header">
          <div>
            <h2>Notifications</h2>
            <p>
              {notifs.length} notification{notifs.length > 1 ? 's' : ''}
              {unreadCount > 0 && ` · ${unreadCount} non lue${unreadCount > 1 ? 's' : ''}`}
            </p>
          </div>
          {unreadCount > 0 && (
            <button className="notifs-mark-all" disabled={actionLoading} onClick={handleToutLire}>
              <span className="material-icons">done_all</span>
              Tout marquer lu
            </button>
          )}
        </div>

        <div className="notifs-filters">
          <button
            className={`notifs-filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            Toutes ({notifs.length})
          </button>
          <button
            className={`notifs-filter-btn ${filter === 'unread' ? 'active' : ''}`}
            onClick={() => setFilter('unread')}
          >
            Non lues ({unreadCount})
          </button>
        </div>

        {/* ── Résumés admin ── */}
        {isAdmin(user?.profil?.role) && adminCounts && (
          <div className="notifs-admin-summary">
            <div className="notifs-admin-summary-title">
              <span className="material-icons">admin_panel_settings</span>
              Espace administration
            </div>
            <div className="notifs-admin-items">
              {ADMIN_ITEMS_META.filter(({ key }) => adminCounts[key] > 0).length === 0 ? (
                <div className="notifs-admin-clear">
                  <span className="material-icons">check_circle</span>
                  Aucune tâche en attente
                </div>
              ) : (
                ADMIN_ITEMS_META.map(({ key, icon, color, label, plural, path }) => {
                  const count = adminCounts[key] || 0;
                  if (count === 0) return null;
                  return (
                    <button
                      key={key}
                      className="notif-admin-alert"
                      style={{ background: `${color}12`, borderColor: `${color}50` }}
                      onClick={() => navigate(path)}
                    >
                      <div className="notif-admin-alert-icon" style={{ background: `${color}20`, color }}>
                        <span className="material-icons">{icon}</span>
                      </div>
                      <div className="notif-admin-alert-body">
                        <span className="notif-admin-alert-count" style={{ color }}>{count}</span>
                        <span className="notif-admin-alert-label">
                          {count > 1 ? plural : label} en attente
                        </span>
                      </div>
                      <span className="material-icons notif-admin-alert-arrow">arrow_forward</span>
                    </button>
                  );
                })
              )}
            </div>
            <div className="notifs-admin-divider" />
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="notifs-empty">
            <span className="material-icons">notifications_off</span>
            {filter === 'unread' ? (
              <>
                <p>Tout est à jour !</p>
                <button className="notifs-show-all-btn" onClick={() => setFilter('all')}>
                  Voir toutes les notifications
                </button>
              </>
            ) : (
              <p>Aucune notification</p>
            )}
          </div>
        ) : (
          <div className="notifs-list">
            {filtered.map(notif => {
              const { icon, color } = getMeta(notif.type);
              const isActive = selected?.id === notif.id;
              const hasAction = TYPES_ACTIONNABLES.includes(notif.type);
              return (
                <button
                  key={notif.id}
                  className={`notif-item ${notif.lu ? '' : 'unread'} ${isActive ? 'active' : ''}`}
                  onClick={() => handleSelect(notif)}
                >
                  <div className="notif-icon" style={{ background: `${color}18`, color }}>
                    <span className="material-icons">{icon}</span>
                  </div>
                  <div className="notif-body">
                    <div className="notif-title">{notif.titre}</div>
                    <div className="notif-message">{notif.message.length > 80
                      ? notif.message.slice(0, 80) + '…'
                      : notif.message}
                    </div>
                    <div className="notif-date">{formatDate(notif.created_at)}</div>
                  </div>
                  <div className="notif-right">
                    {!notif.lu && <div className="notif-dot" />}
                    {hasAction && (
                      <span className="material-icons notif-action-hint" title="Réexamination possible">policy</span>
                    )}
                    <span className="material-icons notif-chevron">chevron_right</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Panel de détail ── */}
      {selected && (
        <>
          <div className="notif-detail-overlay" onClick={() => setSelected(null)} />
          <div className="notif-detail-panel">
            <button className="notif-detail-close" onClick={() => setSelected(null)}>
              <span className="material-icons">close</span>
            </button>

            {/* En-tête */}
            <div className="notif-detail-header">
              <div
                className="notif-detail-icon"
                style={{
                  background: `${getMeta(selected.type).color}18`,
                  color: getMeta(selected.type).color
                }}
              >
                <span className="material-icons">{getMeta(selected.type).icon}</span>
              </div>
              <div>
                <div className="notif-detail-type">
                  {TYPE_LABELS[selected.type] || selected.type}
                </div>
                <div className="notif-detail-date">{formatDate(selected.created_at)}</div>
              </div>
            </div>

            {/* Titre */}
            <h3 className="notif-detail-title">{selected.titre}</h3>

            {/* Message complet */}
            <div className="notif-detail-message">{selected.message}</div>

            {/* Lien vers l'article */}
            {selected.lien && (
              <Link to={selected.lien} className="notif-detail-link">
                <span className="material-icons">open_in_new</span>
                Voir l'article
              </Link>
            )}

            {/* Section réexamination */}
            {renderReexamination(selected)}
          </div>
        </>
      )}
    </div>
  );
}
