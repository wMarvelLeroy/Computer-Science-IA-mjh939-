import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    getCurrentUser,
    getAllDemandesAuteur,
    getAllDemandesCategorie,
    approuverDemandeAuteur,
    refuserDemandeAuteur,
    approuverDemandeCategorie,
    refuserDemandeCategorie,
    getClaimsForTable,
} from '../../../api/api.js';
import { useAuth } from '../../../contexts/AuthContext.jsx';
import Loader from '../../../components/Loader/Loader.jsx';
import ConfirmModal from '../../../components/Modal/ConfirmModal.jsx';
import StatusBadge from '../../../components/Dashboard/StatusBadge.jsx';
import ClaimSection, { ClaimBadge } from '../../../components/ClaimSection/ClaimSection.jsx';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faUserPen, faTags, faCheck, faTimes, faFilter,
    faArrowLeft, faSpinner, faInbox, faCalendarAlt, faUser
} from '@fortawesome/free-solid-svg-icons';
import './Requests.css';

function Requests() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const currentAdminId = user?.id;

    const getInitialTab = () => {
        if (location.pathname.includes('category')) return 'category';
        return 'author';
    };

    const [activeTab, setActiveTab] = useState(getInitialTab());
    const [statusFilter, setStatusFilter] = useState('en_attente');
    const [demandesAuteur, setDemandesAuteur] = useState([]);
    const [demandesCategorie, setDemandesCategorie] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(null);
    const [toast, setToast] = useState(null);
    const [sortBy, setSortBy] = useState('date_desc');
    const [search, setSearch] = useState('');
    const [claimsAuteur, setClaimsAuteur] = useState({});
    const [claimsCateg, setClaimsCateg] = useState({});

    // Modal states
    const [confirmModal, setConfirmModal] = useState({
        isOpen: false,
        type: '',
        requestId: null,
        requestType: '',
        title: '',
        message: ''
    });
    const [rejectReason, setRejectReason] = useState('');

    const currentClaims = activeTab === 'author' ? claimsAuteur : claimsCateg;
    const tableName = activeTab === 'author' ? 'demandes_auteur' : 'demandes_categorie';

    const isClaimedByMe = (id) => {
        const c = currentClaims[id];
        return c && new Date(c.expires_at) > new Date() && c.claimed_by === currentAdminId;
    };

    const updateClaim = (table, itemId, claim) => {
        const setter = table === 'demandes_auteur' ? setClaimsAuteur : setClaimsCateg;
        setter(prev => ({ ...prev, [itemId]: claim || undefined }));
    };

    const loadData = useCallback(async () => {
        try {
            const userResponse = await getCurrentUser();
            if (!userResponse.data || !['admin', 'super_admin'].includes(userResponse.data.profil?.role)) {
                navigate('/dashboard/lecteur');
                return;
            }

            const [auteurRes, categorieRes, claimsAuteurRes, claimsCategRes] = await Promise.allSettled([
                getAllDemandesAuteur(statusFilter === 'all' ? null : statusFilter),
                getAllDemandesCategorie(statusFilter === 'all' ? null : statusFilter),
                getClaimsForTable('demandes_auteur'),
                getClaimsForTable('demandes_categorie'),
            ]);

            setDemandesAuteur(auteurRes.status === 'fulfilled' ? auteurRes.value?.data || [] : []);
            setDemandesCategorie(categorieRes.status === 'fulfilled' ? categorieRes.value?.data || [] : []);

            if (claimsAuteurRes.status === 'fulfilled') {
                const map = {};
                (claimsAuteurRes.value?.data?.data || []).forEach(c => { map[c.item_id] = c; });
                setClaimsAuteur(map);
            }
            if (claimsCategRes.status === 'fulfilled') {
                const map = {};
                (claimsCategRes.value?.data?.data || []).forEach(c => { map[c.item_id] = c; });
                setClaimsCateg(map);
            }
        } catch (err) {
            console.error('Erreur chargement demandes:', err);
        } finally {
            setLoading(false);
        }
    }, [navigate, statusFilter]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // ── Polling + Page Visibility ────────────────────────────────────────────
    useEffect(() => {
        const interval = setInterval(loadData, 60_000);
        const onVisible = () => { if (!document.hidden) loadData(); };
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            clearInterval(interval);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, [loadData]);

    // Handle approve/reject actions
    const handleApprove = (requestId, requestType) => {
        setConfirmModal({
            isOpen: true,
            type: 'approve',
            requestId,
            requestType,
            title: 'Approuver la demande',
            message: requestType === 'author' 
                ? 'Êtes-vous sûr de vouloir approuver cette demande ? L\'utilisateur deviendra auteur.'
                : 'Êtes-vous sûr de vouloir approuver cette catégorie ?'
        });
    };

    const handleReject = (requestId, requestType) => {
        setConfirmModal({
            isOpen: true,
            type: 'reject',
            requestId,
            requestType,
            title: 'Refuser la demande',
            message: requestType === 'author'
                ? 'Êtes-vous sûr de vouloir refuser cette demande ?'
                : 'Êtes-vous sûr de vouloir refuser cette catégorie ?'
        });
        setRejectReason('');
    };

    const confirmAction = async () => {
        const { type, requestId, requestType } = confirmModal;
        setProcessing(requestId);
        const tbl = requestType === 'author' ? 'demandes_auteur' : 'demandes_categorie';

        try {
            if (type === 'approve') {
                if (requestType === 'author') {
                    await approuverDemandeAuteur(requestId);
                } else {
                    await approuverDemandeCategorie(requestId);
                }
            } else {
                if (requestType === 'author') {
                    await refuserDemandeAuteur(requestId);
                } else {
                    await refuserDemandeCategorie(requestId, rejectReason);
                }
            }
            updateClaim(tbl, requestId, null);
            await loadData();
        } catch (err) {
            console.error('Erreur action:', err);
            setToast({ msg: err.response?.data?.error || 'Erreur lors de l\'action', type: 'error' });
            setTimeout(() => setToast(null), 3000);
        } finally {
            setProcessing(null);
            setConfirmModal({ ...confirmModal, isOpen: false });
        }
    };

    const q = search.toLowerCase().trim();
    const currentRequests = (activeTab === 'author' ? demandesAuteur : demandesCategorie)
        .filter(d => !q || (
            d.user_nom?.toLowerCase().includes(q) ||
            d.user_email?.toLowerCase().includes(q) ||
            d.motivation?.toLowerCase().includes(q) ||
            d.description?.toLowerCase().includes(q) ||
            d.nom_categorie?.toLowerCase().includes(q)
        ))
        .slice()
        .sort((a, b) => sortBy === 'date_asc'
            ? new Date(a.created_at) - new Date(b.created_at)
            : new Date(b.created_at) - new Date(a.created_at)
        );

    if (loading) {
        return <Loader />;
    }

    return (
        <div className="requests-portal fadeInContainer">
            {/* Header */}
            <div className="requests-header">
                <button className="btn-back" onClick={() => navigate('/dashboard/admin')}>
                    <FontAwesomeIcon icon={faArrowLeft} /> Retour
                </button>
                <div className="header-title">
                    <h2>Portail des Requêtes</h2>
                    <p>Gérez les demandes d'auteur et de catégorie</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="requests-tabs">
                <button 
                    className={`tab-btn ${activeTab === 'author' ? 'active' : ''}`}
                    onClick={() => setActiveTab('author')}
                >
                    <FontAwesomeIcon icon={faUserPen} />
                    <span>Demandes Auteur</span>
                    {demandesAuteur.length > 0 && statusFilter === 'en_attente' && (
                        <span className="tab-badge">{demandesAuteur.length}</span>
                    )}
                </button>
                <button 
                    className={`tab-btn ${activeTab === 'category' ? 'active' : ''}`}
                    onClick={() => setActiveTab('category')}
                >
                    <FontAwesomeIcon icon={faTags} />
                    <span>Demandes Catégorie</span>
                    {demandesCategorie.length > 0 && statusFilter === 'en_attente' && (
                        <span className="tab-badge">{demandesCategorie.length}</span>
                    )}
                </button>
            </div>

            {/* Filters */}
            <div className="requests-filters">
                <div className="admin-search-wrap" style={{ flex: 1, minWidth: 220 }}>
                    <span className="material-icons">search</span>
                    <input
                        className="admin-search"
                        type="text"
                        placeholder="Rechercher utilisateur, motivation…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <span className="filter-label">
                    <FontAwesomeIcon icon={faFilter} /> Statut:
                </span>
                <div className="filter-buttons">
                    {[
                        { value: 'en_attente', label: 'En attente' },
                        { value: 'approuvee', label: 'Approuvées' },
                        { value: 'refusee', label: 'Refusées' },
                        { value: 'all', label: 'Toutes' }
                    ].map(filter => (
                        <button
                            key={filter.value}
                            className={`filter-btn ${statusFilter === filter.value ? 'active' : ''}`}
                            onClick={() => setStatusFilter(filter.value)}
                        >
                            {filter.label}
                        </button>
                    ))}
                </div>
                <select
                    className="admin-select"
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value)}
                    style={{ marginLeft: 'auto' }}
                >
                    <option value="date_desc">Plus récent</option>
                    <option value="date_asc">Plus ancien</option>
                </select>
            </div>

            {/* Requests List */}
            <div className="requests-list">
                {currentRequests.length === 0 ? (
                    <div className="empty-state">
                        <FontAwesomeIcon icon={faInbox} className="empty-icon" />
                        <h3>Aucune demande</h3>
                        <p>
                            {statusFilter === 'en_attente' 
                                ? 'Aucune demande en attente pour le moment.' 
                                : 'Aucune demande avec ce statut.'}
                        </p>
                    </div>
                ) : (
                    currentRequests.map(demande => (
                        <div key={demande.id} className="request-card">
                            <div className="request-header">
                                <button
                                    className="request-user request-user-btn"
                                    onClick={() => demande.user_id && window.open(`/profil/${demande.user_id}`, '_blank')}
                                    title="Voir le profil"
                                >
                                    <div className="user-avatar">
                                        {demande.user_avatar ? (
                                            <img src={demande.user_avatar} alt="" />
                                        ) : (
                                            <FontAwesomeIcon icon={faUser} />
                                        )}
                                    </div>
                                    <div className="user-info">
                                        <strong>{demande.user_nom || demande.nom_categorie || 'Utilisateur'}</strong>
                                        <span className="user-email">{demande.user_email || ''}</span>
                                    </div>
                                </button>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                    <ClaimBadge claim={currentClaims[demande.id]} currentUserId={currentAdminId} />
                                    <StatusBadge status={demande.statut} />
                                </div>
                            </div>

                            {activeTab === 'category' && demande.nom_categorie && (
                                <div className="request-category-name">
                                    <span className="label">Catégorie demandée:</span>
                                    <span className="value">{demande.nom_categorie}</span>
                                </div>
                            )}

                            <div className="request-motivation">
                                <span className="label">
                                    {activeTab === 'author' ? 'Motivation:' : 'Description:'}
                                </span>
                                <p>{demande.motivation || demande.description || 'Aucune description fournie.'}</p>
                            </div>

                            {demande.statut === 'en_attente' && (
                                <div style={{ marginTop: 8 }}>
                                    <ClaimSection
                                        tableName={tableName}
                                        itemId={demande.id}
                                        claim={currentClaims[demande.id]}
                                        currentUserId={currentAdminId}
                                        onClaimChange={(c) => updateClaim(tableName, demande.id, c)}
                                    />
                                </div>
                            )}

                            <div className="request-footer">
                                <span className="request-date">
                                    <FontAwesomeIcon icon={faCalendarAlt} />
                                    {new Date(demande.created_at).toLocaleDateString('fr-FR', {
                                        day: 'numeric',
                                        month: 'long',
                                        year: 'numeric'
                                    })}
                                </span>

                                {demande.statut === 'en_attente' && isClaimedByMe(demande.id) && (
                                    <div className="request-actions">
                                        <button
                                            className="btn-approve"
                                            onClick={() => handleApprove(demande.id, activeTab === 'author' ? 'author' : 'category')}
                                            disabled={processing === demande.id}
                                        >
                                            {processing === demande.id ? (
                                                <FontAwesomeIcon icon={faSpinner} spin />
                                            ) : (
                                                <><FontAwesomeIcon icon={faCheck} /> Approuver</>
                                            )}
                                        </button>
                                        <button
                                            className="btn-reject"
                                            onClick={() => handleReject(demande.id, activeTab === 'author' ? 'author' : 'category')}
                                            disabled={processing === demande.id}
                                        >
                                            <FontAwesomeIcon icon={faTimes} /> Refuser
                                        </button>
                                    </div>
                                )}

                                {demande.statut === 'refusee' && demande.raison_refus && (
                                    <div className="reject-reason">
                                        <strong>Raison du refus:</strong> {demande.raison_refus}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Confirm Modal */}
            <ConfirmModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                onConfirm={confirmAction}
                title={confirmModal.title}
                message={confirmModal.message}
                confirmText={confirmModal.type === 'approve' ? 'Approuver' : 'Refuser'}
                isDanger={confirmModal.type === 'reject'}
            >
                {confirmModal.type === 'reject' && confirmModal.requestType === 'category' && (
                    <div className="reject-reason-input">
                        <label>Raison du refus (optionnel):</label>
                        <textarea
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="Expliquez pourquoi cette demande est refusée..."
                            rows={3}
                        />
                    </div>
                )}
            </ConfirmModal>

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

export default Requests;
