import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser, updateProfil, uploadAvatarFile } from '../../../api/api';
import Loader from '../../../components/Loader/Loader.jsx';
import './AdminPages.css';

export default function AdminProfile() {
  const navigate    = useNavigate();
  const fileRef     = useRef(null);
  const [user, setUser]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast]       = useState(null);
  const [form, setForm]         = useState({
    nom: '', bio: '', email_public: '', site_web: '',
    twitter: '', instagram: '', linkedin: ''
  });

  useEffect(() => {
    const init = async () => {
      try {
        const { data } = await getCurrentUser();
        if (!data) return navigate('/login');
        if (!['admin','super_admin'].includes(data.profil?.role)) return navigate('/dashboard/lecteur');
        setUser(data);
        const p = data.profil;
        setForm({
          nom:          p?.nom            || '',
          bio:          p?.bio            || '',
          email_public: p?.email_public   || '',
          site_web:     p?.site_web       || '',
          twitter:      p?.reseaux_sociaux?.twitter   || '',
          instagram:    p?.reseaux_sociaux?.instagram  || '',
          linkedin:     p?.reseaux_sociaux?.linkedin   || '',
        });
      } catch {
        return navigate('/login');
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

  const handleSave = async () => {
    setSaving(true);
    try {
      const updateData = {
        nom:          form.nom.trim(),
        bio:          form.bio.trim() || null,
        email_public: form.email_public.trim() || null,
        site_web:     form.site_web.trim() || null,
        reseaux_sociaux: {
          twitter:   form.twitter.trim()   || null,
          instagram: form.instagram.trim() || null,
          linkedin:  form.linkedin.trim()  || null,
        }
      };
      const { data } = await updateProfil(user.id, updateData);
      setUser(prev => ({ ...prev, profil: data }));
      showToast('Profil mis à jour avec succès');
    } catch {
      showToast('Erreur lors de la sauvegarde', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { avatar_url } = await uploadAvatarFile(user.id, file);
      setUser(prev => ({ ...prev, profil: { ...prev.profil, avatar_url } }));
      showToast('Photo de profil mise à jour');
    } catch {
      showToast('Erreur lors de l\'upload', 'error');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const initials = user?.profil?.nom
    ? user.profil.nom.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : 'AD';

  if (loading) return <Loader />;

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h2>Mon profil</h2>
          <p>Gérez vos informations personnelles</p>
        </div>
        <button className="admin-btn primary" disabled={saving} onClick={handleSave}>
          <span className="material-icons">save</span>
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>

      <div className="admin-profile-layout">
        {/* Carte avatar */}
        <div className="admin-profile-avatar-card">
          <div
            className="admin-profile-avatar-big"
            onClick={() => fileRef.current?.click()}
            title="Changer la photo"
          >
            {user?.profil?.avatar_url
              ? <img src={user.profil.avatar_url} alt="avatar" />
              : initials
            }
            <div className="avatar-overlay">
              {uploading
                ? <span className="material-icons" style={{ animation: 'spin 1s linear infinite' }}>refresh</span>
                : <span className="material-icons">photo_camera</span>
              }
            </div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleAvatarChange}
          />
          <p className="admin-profile-name">{user?.profil?.nom || 'Administrateur'}</p>
          <p className="admin-profile-role">Administrateur</p>
          <p style={{ fontSize: 12, color: 'var(--color-text-placeholder)', margin: 0 }}>
            {user?.email}
          </p>
          <button
            className="admin-btn"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            <span className="material-icons">photo_camera</span>
            {uploading ? 'Upload…' : 'Changer la photo'}
          </button>
        </div>

        {/* Formulaire */}
        <div className="admin-profile-form-card">
          <h3>Informations générales</h3>
          <div className="admin-form">
            <div className="admin-form-group">
              <label>Nom affiché *</label>
              <input
                type="text"
                placeholder="Votre nom"
                value={form.nom}
                onChange={e => setForm(p => ({ ...p, nom: e.target.value }))}
              />
            </div>
            <div className="admin-form-group">
              <label>Bio</label>
              <textarea
                placeholder="Quelques mots sur vous…"
                value={form.bio}
                onChange={e => setForm(p => ({ ...p, bio: e.target.value }))}
              />
            </div>
            <div className="admin-form-row">
              <div className="admin-form-group">
                <label>Email public</label>
                <input
                  type="email"
                  placeholder="email@exemple.com"
                  value={form.email_public}
                  onChange={e => setForm(p => ({ ...p, email_public: e.target.value }))}
                />
              </div>
              <div className="admin-form-group">
                <label>Site web</label>
                <input
                  type="url"
                  placeholder="https://…"
                  value={form.site_web}
                  onChange={e => setForm(p => ({ ...p, site_web: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <h3 style={{ marginTop: 28 }}>Réseaux sociaux</h3>
          <div className="admin-form">
            <div className="admin-form-row">
              <div className="admin-form-group">
                <label>Twitter / X</label>
                <input
                  type="text"
                  placeholder="@pseudonyme"
                  value={form.twitter}
                  onChange={e => setForm(p => ({ ...p, twitter: e.target.value }))}
                />
              </div>
              <div className="admin-form-group">
                <label>Instagram</label>
                <input
                  type="text"
                  placeholder="@pseudonyme"
                  value={form.instagram}
                  onChange={e => setForm(p => ({ ...p, instagram: e.target.value }))}
                />
              </div>
            </div>
            <div className="admin-form-group" style={{ maxWidth: 320 }}>
              <label>LinkedIn</label>
              <input
                type="text"
                placeholder="URL ou pseudonyme"
                value={form.linkedin}
                onChange={e => setForm(p => ({ ...p, linkedin: e.target.value }))}
              />
            </div>
          </div>
        </div>
      </div>

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
