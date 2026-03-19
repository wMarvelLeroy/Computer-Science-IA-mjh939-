import React from 'react';
import './UserAvatar.css';

/**
 * Avatar utilisateur unifié
 *   - avatar_url présent → image
 *   - sinon → initiales sur fond couleur_avatar (ou dégradé par défaut)
 *
 * @param {Object} profil  - { nom, avatar_url, couleur_avatar }
 * @param {number} size    - diamètre en px (défaut 36)
 * @param {string} className - classe CSS additionnelle
 */
const UserAvatar = ({ profil, size = 36, className = '' }) => {
  const nom = profil?.nom || '';
  const initials = nom
    ? nom.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  const color   = profil?.couleur_avatar || '#10b981';
  const hasImg  = !!profil?.avatar_url;

  return (
    <div
      className={`user-avatar${className ? ` ${className}` : ''}`}
      style={{
        width:      size,
        height:     size,
        fontSize:   size * 0.38,
        background: hasImg
          ? undefined
          : `linear-gradient(135deg, ${color}, ${color}cc)`,
      }}
    >
      {hasImg
        ? <img src={profil.avatar_url} alt={nom} />
        : initials
      }
    </div>
  );
};

export default UserAvatar;
