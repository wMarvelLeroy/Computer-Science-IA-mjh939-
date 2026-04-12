import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { getDemandeAuteurByUser, createDemandeAuteur } from '../../api/api.js';
import Loader from '../../components/Loader/Loader.jsx';
import StatusBadge from '../../components/Dashboard/StatusBadge.jsx';
import ConfirmModal from '../../components/Modal/ConfirmModal.jsx';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faUsers, 
  faAward, 
  faFileLines, 
  faCommentDots, 
  faHeart, 
  faArrowTrendUp, 
  faChartSimple, 
  faComment, 
  faClock,
  faSpinner,
  faExclamationTriangle
} from '@fortawesome/free-solid-svg-icons';

import './Lecteur.css';

function DashboardLecteur() {
  const { user, loading: authLoading, logout } = useAuth();
  const [demande, setDemande] = useState(null);
  const [motivation, setMotivation] = useState('');
  const [loading, setLoading] = useState(true);
  const [showDemandeForm, setShowDemandeForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const navigate = useNavigate();

  const loadDemande = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const demandeResponse = await getDemandeAuteurByUser(user.id);
      setDemande(demandeResponse.data);
    } catch {
      // Pas de demande, c'est normal
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate('/login');
        return;
      }
      loadDemande();
    }
  }, [authLoading, user, loadDemande, navigate]);

  const handleDemandeAuteur = async (e) => {
    e.preventDefault();

    if (!motivation.trim()) {
      alert('Veuillez remplir votre motivation');
      return;
    }

    try {
      setSubmitting(true);
      await createDemandeAuteur(user.id, motivation);
      alert('✅ Demande envoyée avec succès !');

      const demandeResponse = await getDemandeAuteurByUser(user.id);
      setDemande(demandeResponse.data);

      setShowDemandeForm(false);
      setMotivation('');
    } catch (err) {
      alert('❌ Erreur : ' + (err.response?.data?.error || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogoutClick = () => {
    setIsLogoutModalOpen(true);
  };

  if (loading) {
    return <Loader />;
  }

  // révoqué = approuvée mais rôle lecteur
  const isRevoked = demande?.statut === 'approuvee' && user?.profil?.role !== 'auteur';
  const canMakeRequest = !demande || isRevoked || demande.statut === 'refusee';

  return (
      <div className="lecteur-profile">
        
        {/* Profile Card */}
        <div className="profile-card">
          <div className="profile-banner"></div>
          
          <div className="profile-content">
            <div className="profile-avatar">
              <div className="avatar-circle">
                {user?.profil?.avatar_url ? (
                  <img src={user.profil.avatar_url} alt="Avatar" />
                ) : (
                  <span className="avatar-placeholder">
                    {(user?.user_metadata?.nom || user?.profil?.nom || user?.email || '?').charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
            </div>

            <div className="profile-info">
              <h2>{user?.user_metadata?.nom || user?.profil?.nom || 'Utilisateur'}</h2>
              <p className="profile-email">{user?.email}</p>
              <p className="profile-date">
                Membre depuis {new Date(user?.created_at || Date.now()).toLocaleDateString('fr-FR', {
                  month: 'long',
                  year: 'numeric'
                })}
              </p>
            </div>
            <button className="btn-deconnexion" onClick={handleLogoutClick}>
              Se déconnecter
            </button>
          </div>

          
        </div>

        {/* Main Grid */}
        <div className="main-grid">
          
          {/* Statistiques Section */}
          <div className="section-card">
            <h3><FontAwesomeIcon icon={faChartSimple} /> Mes statistiques</h3>
            <div className="mini-stats">
              <div className="mini-stat">
                <span className="stat-icon" style={{color: '#3b82f6'}}>
                  <FontAwesomeIcon icon={faFileLines} style={{fontSize: '28px'}} />
                </span>
                <div>
                  <p className="stat-value">0</p>
                  <p className="stat-label">Articles lus</p>
                </div>
              </div>

              <div className="mini-stat">
                <span className="stat-icon" style={{color: '#10b981'}}>
                  <FontAwesomeIcon icon={faCommentDots} style={{fontSize: '28px'}} />
                </span>
                <div>
                  <p className="stat-value">0</p>
                  <p className="stat-label">Commentaires</p>
                </div>
              </div>

              <div className="mini-stat">
                <span className="stat-icon" style={{color: '#ef4444'}}>
                  <FontAwesomeIcon icon={faHeart} style={{fontSize: '28px'}} />
                </span>
                <div>
                  <p className="stat-value">0</p>
                  <p className="stat-label">Likes donnés</p>
                </div>
              </div>

              <div className="mini-stat">
                <span className="stat-icon" style={{color: '#f59e0b'}}>
                  <FontAwesomeIcon icon={faAward} style={{fontSize: '28px'}} />
                </span>
                <div>
                  <p className="stat-value">0</p>
                  <p className="stat-label">Achievements</p>
                </div>
              </div>

              <div className="mini-stat">
                <span className="stat-icon" style={{color: '#8b5cf6'}}>
                  <FontAwesomeIcon icon={faUsers} style={{fontSize: '28px'}} />
                </span>
                <div>
                  <p className="stat-value">0</p>
                  <p className="stat-label">Abonnements</p>
                </div>
              </div>

              <div className="mini-stat">
                <span className="stat-icon" style={{color: '#ec4899'}}>
                  <FontAwesomeIcon icon={faArrowTrendUp} style={{fontSize: '28px'}} />
                </span>
                <div>
                  <p className="stat-value">0</p>
                  <p className="stat-label">Activité</p>
                </div>
              </div>
            </div>
            <p className="info-text small">
              <FontAwesomeIcon icon={faComment} /> Les statistiques détaillées seront bientôt disponibles
            </p>
          </div>

          {/* Devenir Auteur Section */}
          <div className="section-card">
            <h3><FontAwesomeIcon icon={faFileLines} /> Devenir Auteur</h3>

            {canMakeRequest ? (
              <>
                {!showDemandeForm ? (
                  <div className="no-demande">
                    
                    {/* Message si accès révoqué */}
                    {isRevoked && (
                      <div className="status-message warning" style={{marginBottom: '1rem'}}>
                        <p><FontAwesomeIcon icon={faExclamationTriangle} /> <strong>Attention :</strong> Votre statut d'auteur a été révoqué.</p>
                        <p className="small">Vous pouvez soumettre une nouvelle demande si vous souhaitez redevenir auteur.</p>
                      </div>
                    )}
                    
                    {/* Message si demande refusée (on permet de refaire) */}
                    {demande?.statut === 'refusee' && (
                       <div className="status-message error" style={{marginBottom: '1rem'}}>
                         <p>❌ Votre précédente demande a été refusée.</p>
                         {demande.raison_refus && (
                           <p className="small"><strong>Raison :</strong> {demande.raison_refus}</p>
                         )}
                         <p className="small">Vous pouvez retenter votre chance en améliorant votre motivation.</p>
                       </div>
                    )}

                    <p>Vous souhaitez partager vos articles sur ArtInter ?</p>
                    <p className="info-text">
                      Devenez auteur et commencez à publier vos créations visuelles !
                    </p>
                    <button
                      onClick={() => setShowDemandeForm(true)}
                      className="btn btn-primary"
                    >
                      {demande?.statut === 'refusee' ? '📝 Refaire une demande' : '📝 Faire une demande'}
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleDemandeAuteur} className="demande-form">
                    <label>
                      <strong>Pourquoi voulez-vous devenir auteur ?</strong>
                      <textarea
                        value={motivation}
                        onChange={(e) => setMotivation(e.target.value)}
                        placeholder="Expliquez votre motivation, vos domaines d'expertise, vos projets..."
                        required
                        rows="6"
                        disabled={submitting}
                      />
                    </label>
                    <div className="form-actions">
                      <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={submitting}
                      >
                        {submitting ? <><FontAwesomeIcon icon={faSpinner} spin /> Envoi...</> : '✅ Envoyer la demande'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowDemandeForm(false);
                          setMotivation('');
                        }}
                        className="btn btn-secondary"
                        disabled={submitting}
                      >
                        Annuler
                      </button>
                    </div>
                  </form>
                )}
              </>
            ) : (
              <div className="demande-status">
                <div className="status-header">
                  <StatusBadge status={demande.statut} />
                  <span className="demande-date">
                    Demandé le {new Date(demande.created_at).toLocaleDateString('fr-FR')}
                  </span>
                </div>

                {demande.statut === 'en_attente' && (
                  <div className="status-message info">
                    <p><FontAwesomeIcon icon={faClock} /> Votre demande est en cours d'examen par notre équipe.</p>
                    <p className="small">Vous recevrez une notification dès qu'elle sera traitée.</p>
                  </div>
                )}

                {demande.statut === 'approuvee' && (
                  <div className="status-message success">
                    <p>🎉 Félicitations ! Votre demande a été approuvée !</p>
                    <p className="small">Vous pouvez maintenant accéder à votre espace auteur.</p>
                    <button
                      onClick={() => navigate('/dashboard/auteur')}
                      className="btn btn-primary"
                    >
                      Accéder à mon espace auteur →
                    </button>
                  </div>
                )}

                <div className="motivation-display">
                  <strong>Votre motivation :</strong>
                  <p>{demande.motivation}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modale de déconnexion */}
        <ConfirmModal
          isOpen={isLogoutModalOpen}
          onClose={() => setIsLogoutModalOpen(false)}
          onConfirm={logout}
          title="Déconnexion"
          message="Êtes-vous sûr de vouloir vous déconnecter ?"
          confirmText="Se déconnecter"
          isDanger={true}
        />

      </div>
  );
}

export default DashboardLecteur;