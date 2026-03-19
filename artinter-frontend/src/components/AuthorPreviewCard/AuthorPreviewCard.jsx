import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProfilById, getFollowers, checkIsFollowing, followUser, unfollowUser } from '../../api/api.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import Portal from '../Modal/Portal.jsx';
import UserAvatar from '../UserAvatar/UserAvatar.jsx';
import './AuthorPreviewCard.css';

const ROLE_BADGE = {
  super_admin: { label: 'Administrateur', color: '#3b82f6' }, // masqué publiquement
  admin:       { label: 'Administrateur', color: '#3b82f6' },
  auteur:      { label: 'Auteur',         color: '#10b981' },
  lecteur:     { label: 'Lecteur',        color: '#64748b' },
};

const AuthorPreviewCard = ({ authorId, onClose }) => {
  const navigate    = useNavigate();
  const { user }    = useAuth();

  const [profil,      setProfil]      = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [followers,   setFollowers]   = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  useEffect(() => {
    if (!authorId) { setProfil(null); return; }
    setLoading(true);

    const fetchAll = async () => {
      try {
        const [profilRes, followersRes] = await Promise.allSettled([
          getProfilById(authorId),
          getFollowers(authorId),
        ]);
        if (profilRes.status === 'fulfilled') setProfil(profilRes.value?.data || null);
        if (followersRes.status === 'fulfilled') setFollowers((followersRes.value?.data || []).length);

        if (user?.id && user.id !== authorId) {
          try {
            const res = await checkIsFollowing(user.id, authorId);
            setIsFollowing(res?.data?.isFollowing ?? false);
          } catch { /* ignore */ }
        }
      } catch {
        setProfil(null);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [authorId, user?.id]);

  const handleFollow = async () => {
    if (followLoading) return;
    setFollowLoading(true);
    try {
      if (isFollowing) {
        await unfollowUser(authorId);
        setIsFollowing(false);
        setFollowers(c => c - 1);
      } else {
        await followUser(authorId);
        setIsFollowing(true);
        setFollowers(c => c + 1);
      }
    } catch { /* ignore */ } finally { setFollowLoading(false); }
  };

  if (!authorId) return null;

  const badge = ROLE_BADGE[profil?.role] || ROLE_BADGE.lecteur;
  const isOwnProfile = user?.id === authorId;

  return (
    <Portal>
      <div className="author-preview-overlay" onClick={onClose}>
        <div className="author-preview-card" onClick={e => e.stopPropagation()}>
          <button className="author-preview-close" onClick={onClose}>
            <span className="material-icons">close</span>
          </button>

          {loading ? (
            <div className="author-preview-loading">
              <span className="material-icons author-preview-spin">autorenew</span>
            </div>
          ) : profil ? (
            <>
              <div className="author-preview-header">
                <UserAvatar profil={profil} size={72} className="author-preview-avatar" />
                <div className="author-preview-info">
                  <h3>{profil.nom}</h3>
                  <span className="author-preview-role" style={{ background: `${badge.color}18`, color: badge.color }}>
                    {badge.label}
                  </span>
                  <span className="author-preview-followers">
                    <span className="material-icons">people</span>
                    {followers} abonné{followers !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>

              {profil.bio && (
                <p className="author-preview-bio">
                  {profil.bio.length > 160 ? profil.bio.slice(0, 160) + '…' : profil.bio}
                </p>
              )}

              <div className="author-preview-actions">
                {/* Bouton suivre — seulement si ce n'est pas son propre profil */}
                {user && !isOwnProfile && (
                  <button
                    className={`author-preview-follow-btn ${isFollowing ? 'following' : ''}`}
                    onClick={handleFollow}
                    disabled={followLoading}
                  >
                    <span className="material-icons">
                      {isFollowing ? 'how_to_reg' : 'person_add'}
                    </span>
                    {isFollowing ? 'Abonné' : 'Suivre'}
                  </button>
                )}

                <button
                  className="author-preview-btn"
                  onClick={() => { onClose(); navigate(`/profil/${authorId}`); }}
                >
                  <span className="material-icons">person</span>
                  Voir le profil
                </button>
              </div>
            </>
          ) : (
            <div className="author-preview-loading">
              <span className="material-icons">person_off</span>
              <p>Profil introuvable</p>
            </div>
          )}
        </div>
      </div>
    </Portal>
  );
};

export default AuthorPreviewCard;
