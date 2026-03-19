import React from 'react';
import SearchForm from '../SearchForm/SearchForm.jsx';
import './MobileSearchBtn.css';

const MobileSearchBtn = ({ isOpen, onClose }) => {
  React.useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  React.useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape' && isOpen) onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className={`mobile-search-modal ${isOpen ? 'open' : ''}`}>
      <div className="mobile-search-overlay" onClick={onClose} />

      <div className="mobile-search-content">
        <button className="mobile-search-close" onClick={onClose} aria-label="Fermer la recherche">
          <span className="material-icons" translate="no">close</span>
        </button>

        <div className="mobile-search-form-wrapper">
          {/* onNavigate ferme la modal quand un résultat est sélectionné */}
          <SearchForm
            placeholder="Rechercher articles, auteurs, #tags…"
            onNavigate={onClose}
          />
        </div>

        <p className="mobile-search-hint">
          Tapez pour rechercher des articles, des auteurs, des catégories ou des <strong>#tags</strong>.
        </p>
      </div>
    </div>
  );
};

export default MobileSearchBtn;
