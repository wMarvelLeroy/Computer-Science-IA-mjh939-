import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getCurrentUser,
  getAllProfils,
  updateProfil,
  toggleBanAuteur,
  creerRestriction,
  leverRestriction,
  getRestrictionsUser,
  retirerStatutAuteur
} from '../../../api/api';
import Loader from '../../../components/Loader/Loader.jsx';
import Portal from '../../../components/Modal/Portal.jsx';
import './AdminPages.css';

export default function UsersManagement() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers]             = useState([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');
  const [roleFilter, setRoleFilter]   = useState('all');
  const [modal, setModal]             = useState(null); // { type, user }
  const [confirmRoleModal, setConfirmRoleModal]   = useState(null); // { user, newRole }
  const [restrictModal, setRestrictModal]         = useState(null); // { user, motif, details, duree }
  const [retirerAuteurModal, setRetirerAuteurModal] = useState(null); // { user }
  const [restrictions, setRestrictions]   = useState({}); // { [userId]: restriction | null }
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
        const { data: profils } = await getAllProfils();
        setUsers(profils || []);
        const map = {};
        await Promise.all((profils || []).map(async (u) => {
          try {
            const { data } = await getRestrictionsUser(u.id);
            map[u.id] = data?.length > 0 ? data[0] : null;
          } catch {
            map[u.id] = null;
          }
        }));
        setRestrictions(map);
      } catch (err) {
        console.error('Erreur chargement utilisateurs:', err);
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

  const filtered = users
    .filter(u => {
      const q = search.toLowerCase();
      const matchSearch = !q
        || u.nom?.toLowerCase().includes(q)
        || u.email?.toLowerCase().includes(q);
      const matchRole = roleFilter === 'all' || u.role === roleFilter;
      return matchSearch && matchRole;
    })
    .sort((a, b) => {
      if (a.id === currentUser?.id) return -1;
      if (b.id === currentUser?.id) return 1;
      return 0;
    });

  const handleRoleChange = (userId, newRole) => {
    const user = users.find(u => u.id === userId);
    setConfirmRoleModal({ user, newRole });
  };

  const confirmAndChangeRole = async () => {
    if (!confirmRoleModal) return;
    const { user, newRole } = confirmRoleModal;
    setActionLoading(true);
    try {
      await updateProfil(user.id, { role: newRole });
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, role: newRole } : u));
      showToast('Rôle mis à jour avec succès');
      setConfirmRoleModal(null);
    } catch {
      showToast('Erreur lors de la mise à jour du rôle', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleBan = async () => {
    if (!modal) return;
    const { user, newBanState } = modal;
    setActionLoading(true);
    try {
      await toggleBanAuteur(user.auteurs?.id || user.auteur_id, newBanState);
      setUsers(prev => prev.map(u => {
        if (u.id !== user.id) return u;
        return {
          ...u,
          auteurs: u.auteurs ? { ...u.auteurs, est_banni: newBanState } : u.auteurs
        };
      }));
      showToast(newBanState ? 'Auteur banni' : 'Bannissement levé');
    } catch {
      showToast('Erreur lors de la mise à jour', 'error');
    } finally {
      setActionLoading(false);
      setModal(null);
    }
  };

  const handleRestrict = async () => {
    if (!restrictModal) return;
    setActionLoading(true);
    try {
      const { data } = await creerRestriction(
        restrictModal.user.id,
        restrictModal.motif,
        restrictModal.details || null,
        restrictModal.duree ? Number(restrictModal.duree) : null
      );
      setRestrictions(prev => ({ ...prev, [restrictModal.user.id]: data }));
      showToast('Restriction appliquée');
      setRestrictModal(null);
    } catch {
      showToast('Erreur lors de la restriction', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleLeverRestriction = async (userId) => {
    const restriction = restrictions[userId];
    if (!restriction) return;
    setActionLoading(true);
    try {
      await leverRestriction(restriction.id);
      setRestrictions(prev => ({ ...prev, [userId]: null }));
      showToast('Restriction levée');
    } catch {
      showToast('Erreur lors de la levée de restriction', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRetirerAuteur = async () => {
    if (!retirerAuteurModal) return;
    setActionLoading(true);
    try {
      await retirerStatutAuteur(retirerAuteurModal.user.id);
      setUsers(prev => prev.map(u =>
        u.id === retirerAuteurModal.user.id ? { ...u, role: 'lecteur', auteurs: null } : u
      ));
      showToast('Statut Auteur retiré');
      setRetirerAuteurModal(null);
    } catch {
      showToast('Erreur lors du retrait du statut', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const getRoleBadge = (role) => {
    const map = {
      super_admin: <span className="badge" style={{ background: 'rgba(124,58,237,0.12)', color: '#7c3aed' }}>Super Admin</span>,
      admin:   <span className="badge badge-admin">Admin</span>,
      auteur:  <span className="badge badge-auteur">Auteur</span>,
      lecteur: <span className="badge badge-lecteur">Lecteur</span>,
    };
    return map[role] || <span className="badge badge-lecteur">{role}</span>;
  };

  const formatDate = (d) =>
    d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

  const isAdminUser = currentUser?.profil?.role === 'admin' || currentUser?.profil?.role === 'super_admin';
  const isSuperAdminUser = currentUser?.profil?.role === 'super_admin';

  if (loading) return <Loader />;

  return (
    <div className="admin-page">
      {/* En-tête */}
      <div className="admin-page-header">
        <div>
          <h2>Gestion des utilisateurs</h2>
          <p>{users.length} utilisateur{users.length > 1 ? 's' : ''} au total</p>
        </div>
      </div>

      {/* Filtres */}
      <div className="admin-filters">
        <div className="admin-search-wrap">
          <span className="material-icons">search</span>
          <input
            type="text"
            className="admin-search"
            placeholder="Rechercher par nom ou email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="admin-select"
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
        >
          <option value="all">Tous les rôles</option>
          <option value="lecteur">Lecteurs</option>
          <option value="auteur">Auteurs</option>
          <option value="admin">Admins</option>
          <option value="super_admin">Super Admins</option>
        </select>
        <span className="admin-count">{filtered.length} résultat{filtered.length > 1 ? 's' : ''}</span>
      </div>

      {/* Tableau */}
      <div className="admin-table-wrap">
        {filtered.length === 0 ? (
          <div className="admin-empty">
            <span className="material-icons">person_off</span>
            <p>Aucun utilisateur trouvé</p>
          </div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Utilisateur</th>
                <th>Rôle</th>
                <th>Statut</th>
                <th>Inscription</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(user => {
                const isSelf = user.id === currentUser?.id;
                const auteur = user.auteurs;
                const isBanni = auteur?.est_banni;
                const initials = user.nom
                  ? user.nom.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
                  : '?';

                return (
                  <tr className="user-row" key={user.id}>
                    <td data-label="Utilisateur">
                      <div className="admin-user-cell">
                        <div className="admin-avatar">
                          {user.avatar_url
                            ? <img src={user.avatar_url} alt="" />
                            : initials
                          }
                        </div>
                        <div className="admin-user-info">
                          <strong>
                            <button
                              className="admin-user-name-btn"
                              onClick={() => window.open(`/profil/${user.id}`, '_blank')}
                              title="Voir le profil (nouvel onglet)"
                            >
                              {user.nom || 'Sans nom'}
                              <span className="material-icons" style={{ fontSize: 13, marginLeft: 4, verticalAlign: 'middle', opacity: 0.6 }}>open_in_new</span>
                            </button>
                            {isSelf && <span className="badge-vous">Vous</span>}
                          </strong>
                          <span>{user.email || '—'}</span>
                        </div>
                      </div>
                    </td>

                    <td data-label="Rôle">
                      {isSelf ? (
                        getRoleBadge(currentUser?.profil?.role || user.role)
                      ) : !isSuperAdminUser ? (
                        getRoleBadge(user.role)
                      ) : (
                        <select
                          className="role-select"
                          value={user.role || 'lecteur'}
                          disabled={actionLoading}
                          onChange={e => handleRoleChange(user.id, e.target.value)}
                        >
                          <option value="lecteur">Lecteur</option>
                          <option value="auteur">Auteur</option>
                          <option value="admin">Admin</option>
                          <option value="super_admin">Super Admin</option>
                        </select>
                      )}
                    </td>

                    <td data-label="Statut">
                      {isBanni
                        ? <span className="badge badge-banni">Banni</span>
                        : <span className="badge badge-publie">Actif</span>
                      }
                    </td>

                    <td data-label="Inscription">{formatDate(user.created_at)}</td>

                    <td className="no-label" style={{ textAlign: 'right' }}>
                      <div className="admin-actions">
                        {user.role === 'auteur' && auteur && !isSelf && isSuperAdminUser && (
                          <button
                            className="admin-btn"
                            disabled={actionLoading}
                            title={isBanni ? 'Débannir' : 'Bannir'}
                            onClick={() => setModal({ type: 'ban', user, newBanState: !isBanni })}
                          >
                            <span className="material-icons">
                              {isBanni ? 'lock_open' : 'block'}
                            </span>
                            <span className="btn-label">{isBanni ? 'Débannir' : 'Bannir'}</span>
                          </button>
                        )}
                        {!isSelf && isAdminUser && (
                          restrictions[user.id] ? (
                            <button
                              className="admin-btn warning"
                              disabled={actionLoading}
                              title="Annuler la restriction"
                              onClick={() => handleLeverRestriction(user.id)}
                            >
                              <span className="material-icons">lock_open</span>
                              <span className="btn-label">Lever restriction</span>
                            </button>
                          ) : (
                            <button
                              className="admin-btn"
                              disabled={actionLoading}
                              title="Restreindre"
                              onClick={() => setRestrictModal({ user, motif: '', details: '', duree: '' })}
                            >
                              <span className="material-icons">gavel</span>
                              <span className="btn-label">Restreindre</span>
                            </button>
                          )
                        )}
                        {!isSelf && isSuperAdminUser && user.role === 'auteur' && (
                          <button
                            className="admin-btn danger"
                            disabled={actionLoading}
                            title="Retirer auteur"
                            onClick={() => setRetirerAuteurModal({ user })}
                          >
                            <span className="material-icons">person_remove</span>
                            <span className="btn-label">Retirer auteur</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal ban */}
      {modal && (
        <Portal>
        <div className="admin-modal-overlay" onClick={() => !actionLoading && setModal(null)}>
          <div className="admin-modal" onClick={e => e.stopPropagation()}>
            {modal.type === 'ban' && (
              <>
                <h3>{modal.newBanState ? 'Bannir l\'auteur ?' : 'Lever le bannissement ?'}</h3>
                <p>
                  {modal.newBanState
                    ? `${modal.user.nom} ne pourra plus publier de nouveaux articles.`
                    : `${modal.user.nom} pourra à nouveau publier des articles.`
                  }
                </p>
                <div className="admin-modal-actions">
                  <button className="admin-btn" disabled={actionLoading} onClick={() => setModal(null)}>
                    Annuler
                  </button>
                  <button className="admin-btn danger" disabled={actionLoading} onClick={handleBan}>
                    {actionLoading ? 'En cours…' : 'Confirmer'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
        </Portal>
      )}

      {/* Modal confirmation changement de rôle */}
      {confirmRoleModal && (
        <Portal>
        <div className="admin-modal-overlay" onClick={() => !actionLoading && setConfirmRoleModal(null)}>
          <div className="admin-modal" onClick={e => e.stopPropagation()}>
            <h3>Confirmer le changement de rôle ?</h3>
            <p>
              Vous êtes sur le point de changer le rôle de <strong>{confirmRoleModal.user.nom}</strong> en{' '}
              <strong>{confirmRoleModal.newRole === 'super_admin' ? 'Super Admin' : confirmRoleModal.newRole === 'admin' ? 'Admin' : confirmRoleModal.newRole === 'auteur' ? 'Auteur' : 'Lecteur'}</strong>.
              {confirmRoleModal.newRole === 'auteur' && ' Un compte auteur sera automatiquement créé.'}
              {(confirmRoleModal.user.role === 'auteur' && !['auteur', 'admin', 'super_admin'].includes(confirmRoleModal.newRole)) && ' Le compte auteur sera supprimé.'}
            </p>
            <div className="admin-modal-actions">
              <button className="admin-btn" disabled={actionLoading} onClick={() => setConfirmRoleModal(null)}>Annuler</button>
              <button className="admin-btn primary" disabled={actionLoading} onClick={confirmAndChangeRole}>
                {actionLoading ? 'En cours…' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
        </Portal>
      )}

      {/* Modal restriction */}
      {restrictModal && (
        <Portal>
        <div className="admin-modal-overlay" onClick={() => !actionLoading && setRestrictModal(null)}>
          <div className="admin-modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <h3>Restreindre l'utilisateur</h3>
            <p style={{ marginBottom: 16 }}>Utilisateur : <strong>{restrictModal.user.nom}</strong></p>
            <div className="admin-form">
              <div className="admin-form-group">
                <label>Motif *</label>
                <select className="admin-select" style={{ width: '100%' }}
                  value={restrictModal.motif}
                  onChange={e => setRestrictModal(p => ({ ...p, motif: e.target.value }))}>
                  <option value="">Choisir un motif…</option>
                  <option value="Comportement inapproprié">Comportement inapproprié</option>
                  <option value="Spam">Spam</option>
                  <option value="Violation des règles">Violation des règles</option>
                  <option value="Contenu offensant">Contenu offensant</option>
                  <option value="Autre">Autre</option>
                </select>
              </div>
              <div className="admin-form-group">
                <label>Détails (optionnel)</label>
                <textarea
                  placeholder="Expliquez la raison de la restriction…"
                  value={restrictModal.details}
                  onChange={e => setRestrictModal(p => ({ ...p, details: e.target.value }))}
                  rows={3}
                />
              </div>
              <div className="admin-form-group">
                <label>Durée (en jours, laisser vide = indéfinie)</label>
                <input type="number" min="1" max="365" placeholder="Ex: 7"
                  value={restrictModal.duree}
                  onChange={e => setRestrictModal(p => ({ ...p, duree: e.target.value }))}
                />
              </div>
            </div>
            <div className="admin-modal-actions">
              <button className="admin-btn" disabled={actionLoading} onClick={() => setRestrictModal(null)}>Annuler</button>
              <button className="admin-btn danger" disabled={actionLoading || !restrictModal.motif} onClick={handleRestrict}>
                {actionLoading ? 'En cours…' : 'Appliquer la restriction'}
              </button>
            </div>
          </div>
        </div>
        </Portal>
      )}

      {/* Modal retirer auteur */}
      {retirerAuteurModal && (
        <Portal>
        <div className="admin-modal-overlay" onClick={() => !actionLoading && setRetirerAuteurModal(null)}>
          <div className="admin-modal" onClick={e => e.stopPropagation()}>
            <h3>Retirer le statut Auteur ?</h3>
            <p>Le rôle de <strong>{retirerAuteurModal.user.nom}</strong> sera rétrogradé à Lecteur. Ses articles existants seront conservés.</p>
            <div className="admin-modal-actions">
              <button className="admin-btn" disabled={actionLoading} onClick={() => setRetirerAuteurModal(null)}>Annuler</button>
              <button className="admin-btn danger" disabled={actionLoading} onClick={handleRetirerAuteur}>
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
