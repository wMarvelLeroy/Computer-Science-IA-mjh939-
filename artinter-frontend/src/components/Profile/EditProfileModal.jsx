import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faCamera, faUser, faEnvelope, faGlobe } from '@fortawesome/free-solid-svg-icons';
import { faTwitter, faLinkedin, faGithub, faFacebook, faInstagram, faYoutube } from '@fortawesome/free-brands-svg-icons';
import { updateProfil, uploadAvatarFile } from '../../api/api.js';
import imageCompression from 'browser-image-compression';
import './EditProfileModal.css';

function EditProfileModal({ isOpen, onClose, user, onProfileUpdated }) {
  const [formData, setFormData] = useState({
    nom: '',
    bio: '',
    email_public: '',
    avatar_url: '',
    twitter: '',
    linkedin: '',
    github: '',
    facebook: '',
    instagram: '',
    youtube: '',
    website: '',
    visible_dans_recherche: null,
    couleur_profil: null,
    couleur_avatar: null,
  });

  const COLOR_PRESETS = [
    { hex: '#10b981', label: 'Émeraude' },
    { hex: '#3b82f6', label: 'Bleu'     },
    { hex: '#8b5cf6', label: 'Violet'   },
    { hex: '#f43f5e', label: 'Rose'     },
    { hex: '#f97316', label: 'Orange'   },
    { hex: '#14b8a6', label: 'Teal'     },
    { hex: '#6366f1', label: 'Indigo'   },
    { hex: '#eab308', label: 'Jaune'    },
    { hex: '#ec4899', label: 'Fuchsia'  },
    { hex: '#64748b', label: 'Ardoise'  },
  ];
  
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Charger les données du profil quand le modal s'ouvre
  useEffect(() => {
    if (isOpen && user?.profil) {
      setFormData({
        nom: user.profil.nom || user.user_metadata?.nom || '',
        bio: user.profil.bio || '',
        email_public: user.profil.email_public || '',
        avatar_url: user.profil.avatar_url || '',
        twitter: user.profil.twitter || '',
        linkedin: user.profil.linkedin || '',
        github: user.profil.github || '',
        facebook: user.profil.facebook || '',
        instagram: user.profil.instagram || '',
        youtube: user.profil.youtube || '',
        website: user.profil.website || '',
        visible_dans_recherche: user.profil.visible_dans_recherche ?? null,
        couleur_profil: user.profil.couleur_profil || null,
        couleur_avatar: user.profil.couleur_avatar || null,
      });
      setAvatarPreview(user.profil.avatar_url);
    }
  }, [isOpen, user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleVisibilityChange = (e) => {
    const raw = e.target.value;
    const val = raw === 'true' ? true : raw === 'false' ? false : null;
    setFormData(prev => ({ ...prev, visible_dans_recherche: val }));
  };

  const handleAvatarChange = (e) => {
    const url = e.target.value;
    setFormData(prev => ({ ...prev, avatar_url: url }));
    setAvatarPreview(url);
    setSelectedFile(null); // Réinitialiser le fichier si URL est entrée
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Vérifier le type
    if (!file.type.startsWith('image/')) {
      setError('Veuillez sélectionner une image');
      return;
    }

    try {
      setUploading(true);
      setError('');

      // Options de compression
      const options = {
        maxSizeMB: 0.5, // 500 KB max
        maxWidthOrHeight: 400, // 400x400 px max
        useWebWorker: true,
        fileType: 'image/jpeg' // Convertir en JPEG pour meilleure compatibilité
      };

      // Compresser l'image
      const compressedFile = await imageCompression(file, options);
      console.log('Taille originale:', (file.size / 1024).toFixed(2), 'KB');
      console.log('Taille compressée:', (compressedFile.size / 1024).toFixed(2), 'KB');

      // Prévisualisation locale
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result);
      };
      reader.readAsDataURL(compressedFile);

      setSelectedFile(compressedFile);
      setFormData(prev => ({ ...prev, avatar_url: '' })); // Vider l'URL si fichier sélectionné
    } catch (err) {
      console.error('Erreur compression:', err);
      setError('Erreur lors de la compression de l\'image');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Upload du fichier si sélectionné
      if (selectedFile) {
        const uploadResponse = await uploadAvatarFile(user.id, selectedFile);
        formData.avatar_url = uploadResponse.avatar_url;
      }

      // Mise à jour du profil
      const response = await updateProfil(user.id, formData);
      
      if (response.success) {
        // Mettre à jour les données utilisateur
        onProfileUpdated(response.data);
        onClose();
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de la mise à jour du profil');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content edit-profile-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2><FontAwesomeIcon icon={faUser} /> Modifier mon profil</h2>
          <button className="close-btn" onClick={onClose}>
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="edit-profile-form">
          
          {/* Avatar Section */}
          <div className="form-section">
            <h3><FontAwesomeIcon icon={faCamera} /> Photo de profil</h3>
            <div className="avatar-upload-section">
              <div
                className="avatar-preview"
                style={!avatarPreview && formData.couleur_avatar
                  ? { background: `linear-gradient(135deg, ${formData.couleur_avatar}, ${formData.couleur_avatar}cc)` }
                  : undefined}
              >
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Avatar" />
                ) : (
                  <div className="avatar-placeholder-large">
                    {formData.nom?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                )}
              </div>
              <div className="avatar-input">
                <label>Choisir une image</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  disabled={uploading}
                />
                {uploading && <p className="input-hint">📦 Compression en cours...</p>}
                <p className="input-hint">Ou entrez une URL :</p>
                <input
                  type="url"
                  name="avatar_url"
                  value={formData.avatar_url}
                  onChange={handleAvatarChange}
                  placeholder="https://exemple.com/mon-avatar.jpg"
                  disabled={uploading}
                />
                <p className="input-hint">Image automatiquement compressée à 400x400px, ~500KB</p>
              </div>
            </div>
          </div>

          {/* Couleur de l'avatar (visible seulement sans photo) */}
          {!avatarPreview && (
            <div className="form-section">
              <h3><span className="material-icons" style={{ fontSize: '1rem', verticalAlign: 'middle', marginRight: 6 }}>palette</span> Couleur de l'avatar</h3>
              <div className="form-group">
                <label>Choisissez la couleur de fond de votre avatar (initiales)</label>
                <div className="color-presets">
                  {COLOR_PRESETS.map(c => (
                    <button
                      key={c.hex}
                      type="button"
                      className={`color-swatch ${formData.couleur_avatar === c.hex ? 'selected' : ''}`}
                      style={{ background: c.hex }}
                      title={c.label}
                      onClick={() => setFormData(prev => ({ ...prev, couleur_avatar: c.hex }))}
                    />
                  ))}
                  <label className="color-swatch color-swatch--custom" title="Couleur personnalisée"
                    style={{ background: (!COLOR_PRESETS.some(c => c.hex === formData.couleur_avatar) && formData.couleur_avatar) ? formData.couleur_avatar : '#ffffff' }}>
                    <span className="material-icons" style={{ fontSize: '1rem', color: '#888', mixBlendMode: 'difference' }}>colorize</span>
                    <input
                      type="color"
                      style={{ opacity: 0, position: 'absolute', width: 0, height: 0 }}
                      value={formData.couleur_avatar || '#10b981'}
                      onChange={e => setFormData(prev => ({ ...prev, couleur_avatar: e.target.value }))}
                    />
                  </label>
                </div>
                {formData.couleur_avatar && (
                  <button type="button" className="color-reset-btn" onClick={() => setFormData(prev => ({ ...prev, couleur_avatar: null }))}>
                    Réinitialiser (défaut vert)
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Personal Information */}
          <div className="form-section">
            <h3><FontAwesomeIcon icon={faUser} /> Informations personnelles</h3>
            <div className="form-group">
              <label>Nom *</label>
              <input
                type="text"
                name="nom"
                value={formData.nom}
                onChange={handleChange}
                required
                placeholder="Votre nom"
              />
            </div>
            <div className="form-group">
              <label>Bio</label>
              <textarea
                name="bio"
                value={formData.bio}
                onChange={handleChange}
                rows="4"
                placeholder="Parlez-nous de vous..."
              />
            </div>
            <div className="form-group">
              <label><FontAwesomeIcon icon={faEnvelope} /> Email public</label>
              <input
                type="email"
                name="email_public"
                value={formData.email_public}
                onChange={handleChange}
                placeholder="email@exemple.com"
              />
              <p className="input-hint">Cet email sera visible publiquement sur votre profil</p>
            </div>
          </div>

          {/* Couleur de bannière */}
          <div className="form-section">
            <h3><span className="material-icons" style={{ fontSize: '1rem', verticalAlign: 'middle', marginRight: 6 }}>palette</span> Couleur de bannière</h3>
            <div className="form-group">
              <label>Choisissez une couleur pour votre bannière de profil</label>
              <div className="color-presets">
                {COLOR_PRESETS.map(c => (
                  <button
                    key={c.hex}
                    type="button"
                    className={`color-swatch ${formData.couleur_profil === c.hex ? 'selected' : ''}`}
                    style={{ background: c.hex }}
                    title={c.label}
                    onClick={() => setFormData(prev => ({ ...prev, couleur_profil: c.hex }))}
                  />
                ))}
                <label className="color-swatch color-swatch--custom" title="Couleur personnalisée"
                  style={{ background: (!COLOR_PRESETS.some(c => c.hex === formData.couleur_profil) && formData.couleur_profil) ? formData.couleur_profil : '#ffffff' }}>
                  <span className="material-icons" style={{ fontSize: '1rem', color: '#888', mixBlendMode: 'difference' }}>colorize</span>
                  <input
                    type="color"
                    style={{ opacity: 0, position: 'absolute', width: 0, height: 0 }}
                    value={formData.couleur_profil || '#10b981'}
                    onChange={e => setFormData(prev => ({ ...prev, couleur_profil: e.target.value }))}
                  />
                </label>
              </div>
              {formData.couleur_profil && (
                <button type="button" className="color-reset-btn" onClick={() => setFormData(prev => ({ ...prev, couleur_profil: null }))}>
                  Réinitialiser (défaut)
                </button>
              )}
              {/* Aperçu */}
              <div className="color-preview-banner" style={{
                background: formData.couleur_profil
                  ? `linear-gradient(135deg, ${formData.couleur_profil}, ${formData.couleur_profil}99)`
                  : 'linear-gradient(135deg, #10b981, #4ade80)',
                height: 48,
                borderRadius: 8,
                marginTop: 10,
              }} />
            </div>
          </div>

          {/* Visibility (admin/super_admin only) */}
          {['admin', 'super_admin'].includes(user?.profil?.role) && (
            <div className="form-section">
              <h3><span className="material-icons" style={{ fontSize: '1rem', verticalAlign: 'middle', marginRight: 6 }}>manage_search</span> Visibilité dans la recherche</h3>
              <div className="form-group">
                <label>Apparaître dans les résultats de recherche</label>
                <select
                  value={formData.visible_dans_recherche === true ? 'true' : formData.visible_dans_recherche === false ? 'false' : 'null'}
                  onChange={handleVisibilityChange}
                >
                  <option value="null">Automatique (visible si j'ai des articles publiés)</option>
                  <option value="true">Toujours visible</option>
                  <option value="false">Toujours masqué</option>
                </select>
                <p className="input-hint">Les auteurs sont toujours visibles. Les lecteurs ne sont jamais visibles.</p>
              </div>
            </div>
          )}

          {/* Social Media */}
          <div className="form-section">
            <h3><FontAwesomeIcon icon={faGlobe} /> Réseaux sociaux</h3>
            <div className="social-inputs">
              <div className="form-group">
                <label><FontAwesomeIcon icon={faTwitter} /> Twitter</label>
                <input
                  type="url"
                  name="twitter"
                  value={formData.twitter}
                  onChange={handleChange}
                  placeholder="https://twitter.com/username"
                />
              </div>
              <div className="form-group">
                <label><FontAwesomeIcon icon={faLinkedin} /> LinkedIn</label>
                <input
                  type="url"
                  name="linkedin"
                  value={formData.linkedin}
                  onChange={handleChange}
                  placeholder="https://linkedin.com/in/username"
                />
              </div>
              <div className="form-group">
                <label><FontAwesomeIcon icon={faGithub} /> GitHub</label>
                <input
                  type="url"
                  name="github"
                  value={formData.github}
                  onChange={handleChange}
                  placeholder="https://github.com/username"
                />
              </div>
              <div className="form-group">
                <label><FontAwesomeIcon icon={faFacebook} /> Facebook</label>
                <input
                  type="url"
                  name="facebook"
                  value={formData.facebook}
                  onChange={handleChange}
                  placeholder="https://facebook.com/username"
                />
              </div>
              <div className="form-group">
                <label><FontAwesomeIcon icon={faInstagram} /> Instagram</label>
                <input
                  type="url"
                  name="instagram"
                  value={formData.instagram}
                  onChange={handleChange}
                  placeholder="https://instagram.com/username"
                />
              </div>
              <div className="form-group">
                <label><FontAwesomeIcon icon={faYoutube} /> YouTube</label>
                <input
                  type="url"
                  name="youtube"
                  value={formData.youtube}
                  onChange={handleChange}
                  placeholder="https://youtube.com/@username"
                />
              </div>
              <div className="form-group">
                <label><FontAwesomeIcon icon={faGlobe} /> Site web</label>
                <input
                  type="url"
                  name="website"
                  value={formData.website}
                  onChange={handleChange}
                  placeholder="https://monsite.com"
                />
              </div>
            </div>
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn btn-secondary" disabled={loading}>
              Annuler
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditProfileModal;
