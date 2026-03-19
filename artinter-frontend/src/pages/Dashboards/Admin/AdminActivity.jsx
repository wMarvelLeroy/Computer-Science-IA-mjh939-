import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser, getAdminActivity } from '../../../api/api.js';
import Loader from '../../../components/Loader/Loader.jsx';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faClockRotateLeft, faFlag, faScaleBalanced, faFilePen, faTags,
  faTrash, faCheckCircle, faXmarkCircle, faChevronDown, faBan, faUnlock,
} from '@fortawesome/free-solid-svg-icons';
import './AdminActivity.css';

const PAGE_SIZE = 30;

const ACTION_META = {
  signalement_traite:          { label: 'Signalement traité',          icon: faCheckCircle,   color: '#22c55e' },
  signalement_rejete:          { label: 'Signalement rejeté',          icon: faXmarkCircle,   color: '#ef4444' },
  signalement_supprime:        { label: 'Signalement supprimé',        icon: faTrash,         color: '#94a3b8' },
  reexamination_approuvee:     { label: 'Réexamination approuvée',     icon: faScaleBalanced, color: '#22c55e' },
  reexamination_refusee:       { label: 'Réexamination refusée',       icon: faScaleBalanced, color: '#ef4444' },
  demande_auteur_approuvee:    { label: 'Demande auteur approuvée',    icon: faFilePen,       color: '#22c55e' },
  demande_auteur_refusee:      { label: 'Demande auteur refusée',      icon: faFilePen,       color: '#ef4444' },
  demande_categorie_approuvee: { label: 'Demande catégorie approuvée', icon: faTags,          color: '#22c55e' },
  demande_categorie_refusee:   { label: 'Demande catégorie refusée',   icon: faTags,          color: '#ef4444' },
  restriction_imposee:         { label: 'Restriction imposée',         icon: faBan,           color: '#ef4444' },
  restriction_levee:           { label: 'Restriction levée',           icon: faUnlock,        color: '#22c55e' },
};

const ALL_ACTION_TYPES = Object.keys(ACTION_META);

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
    + ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function groupByDay(entries) {
  const groups = {};
  for (const e of entries) {
    const day = new Date(e.created_at).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    if (!groups[day]) groups[day] = [];
    groups[day].push(e);
  }
  return groups;
}

function EntryCard({ entry }) {
  const meta = ACTION_META[entry.action_type] || { label: entry.action_type, icon: faFlag, color: '#94a3b8' };
  const adminName = entry.admin?.nom || entry.admin?.email || 'Admin inconnu';

  const detailLines = [];
  if (entry.details?.article_titre) detailLines.push(`Article : ${entry.details.article_titre}`);
  if (entry.details?.note)          detailLines.push(`Note : ${entry.details.note}`);
  if (entry.details?.reponse)       detailLines.push(`Réponse : ${entry.details.reponse}`);
  if (entry.details?.raison)        detailLines.push(`Raison : ${entry.details.raison}`);
  if (entry.details?.type_sanction) detailLines.push(`Sanction : ${entry.details.type_sanction}`);
  if (entry.details?.cooldown_jours != null) {
    const cd = entry.details.cooldown_jours;
    detailLines.push(`Cooldown : ${cd === -1 ? 'définitif' : `${cd} jour(s)`}`);
  }
  if (entry.details?.user_nom)   detailLines.push(`Utilisateur : ${entry.details.user_nom}`);
  if (entry.details?.motif)      detailLines.push(`Motif : ${entry.details.motif}`);
  if (entry.details?.duree_jours != null) {
    detailLines.push(`Durée : ${entry.details.duree_jours} jour(s)`);
  }

  return (
    <div className="act-entry">
      <div className="act-icon" style={{ background: `${meta.color}18`, color: meta.color }}>
        <FontAwesomeIcon icon={meta.icon} />
      </div>
      <div className="act-body">
        <div className="act-top">
          <span className="act-label" style={{ color: meta.color }}>{meta.label}</span>
          <span className="act-time">{formatDate(entry.created_at)}</span>
        </div>
        <div className="act-admin">{adminName}</div>
        {detailLines.length > 0 && (
          <div className="act-details">
            {detailLines.map((l, i) => <span key={i}>{l}</span>)}
          </div>
        )}
      </div>
    </div>
  );
}

function AdminActivity() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filterType, setFilterType] = useState('');

  // Auth check — super_admin uniquement
  useEffect(() => {
    getCurrentUser().then(({ data: u }) => {
      if (!u || u.profil?.role !== 'super_admin') navigate('/dashboard/admin');
    }).catch(() => navigate('/login'));
  }, [navigate]);

  const load = useCallback(async (newOffset = 0, typeFilter = '') => {
    try {
      const params = { limit: PAGE_SIZE, offset: newOffset };
      if (typeFilter) params.action_type = typeFilter;
      const res = await getAdminActivity(params);
      if (newOffset === 0) {
        setEntries(res.data || []);
      } else {
        setEntries(prev => [...prev, ...(res.data || [])]);
      }
      setTotal(res.total || 0);
      setOffset(newOffset + PAGE_SIZE);
    } catch { /* silencieux */ }
  }, []);

  useEffect(() => {
    setLoading(true);
    load(0, filterType).finally(() => setLoading(false));
  }, [load, filterType]);

  const handleLoadMore = async () => {
    setLoadingMore(true);
    await load(offset, filterType);
    setLoadingMore(false);
  };

  const groups = groupByDay(entries);
  const hasMore = entries.length < total;

  return (
    <div className="admin-page fadeInContainer">
      <div className="admin-page-header">
        <div>
          <h2><FontAwesomeIcon icon={faClockRotateLeft} /> Journal d'activité</h2>
          <p>{total} action{total !== 1 ? 's' : ''} enregistrée{total !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Filtre par type */}
      <div className="admin-filters">
        <select
          className="admin-select"
          value={filterType}
          onChange={e => { setFilterType(e.target.value); setOffset(0); }}
        >
          <option value="">Toutes les actions</option>
          {ALL_ACTION_TYPES.map(t => (
            <option key={t} value={t}>{ACTION_META[t].label}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <Loader />
      ) : entries.length === 0 ? (
        <div className="act-empty">
          <FontAwesomeIcon icon={faClockRotateLeft} />
          <p>Aucune action enregistrée pour le moment.</p>
        </div>
      ) : (
        <div className="act-timeline">
          {Object.entries(groups).map(([day, dayEntries]) => (
            <div key={day} className="act-day-group">
              <div className="act-day-label">{day}</div>
              <div className="act-day-entries">
                {dayEntries.map(e => <EntryCard key={e.id} entry={e} />)}
              </div>
            </div>
          ))}

          {hasMore && (
            <button className="act-load-more" onClick={handleLoadMore} disabled={loadingMore}>
              {loadingMore ? 'Chargement…' : (
                <><FontAwesomeIcon icon={faChevronDown} /> Charger plus ({total - entries.length} restant{total - entries.length > 1 ? 's' : ''})</>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default AdminActivity;
