import React from 'react';
import { useNavigate } from 'react-router-dom';
import { searchAll } from '../../api/api.js';
import './SearchForm.css';

function Avatar({ src, name, size = 28 }) {
  const initials = (name || '?')[0].toUpperCase();
  return src ? (
    <img src={src} alt={name} className="srch-avatar" style={{ width: size, height: size }} />
  ) : (
    <div className="srch-avatar srch-avatar-fallback" style={{ width: size, height: size }}>{initials}</div>
  );
}

function getFirstImage(images) {
  if (Array.isArray(images)) return images[0] || null;
  return null;
}

const SearchForm = ({ placeholder = 'Rechercher…', onNavigate }) => {
  const navigate = useNavigate();
  const [value, setValue] = React.useState('');
  const [focused, setFocused] = React.useState(false);
  const [results, setResults] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const inputRef = React.useRef(null);
  const wrapRef  = React.useRef(null);
  const timerRef = React.useRef(null);

  // Close dropdown on click outside
  React.useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setFocused(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Debounced live search
  React.useEffect(() => {
    clearTimeout(timerRef.current);
    if (value.trim().length < 2) { setResults(null); setLoading(false); return; }
    setLoading(true);
    timerRef.current = setTimeout(async () => {
      try {
        const res = await searchAll(value.trim());
        setResults(res.data);
      } catch { /* silencieux */ }
      finally { setLoading(false); }
    }, 320);
    return () => clearTimeout(timerRef.current);
  }, [value]);

  const go = (path) => {
    navigate(path);
    setValue('');
    setResults(null);
    setFocused(false);
    onNavigate?.();
  };

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    const q = value.trim();
    if (!q) return;
    if (q.startsWith('#')) {
      go(`/Catalog?tab=articles&tag=${encodeURIComponent(q.slice(1))}`);
    } else {
      go(`/Catalog?tab=articles&q=${encodeURIComponent(q)}`);
    }
  };

  const isHashtag = value.startsWith('#');
  const showDropdown = focused && value.trim().length >= 2;

  const hasResults = results && (
    results.articles?.length > 0 || results.auteurs?.length > 0 ||
    results.categories?.length > 0 || results.profils?.length > 0 ||
    results.tags?.length > 0 || results.tagArticles?.length > 0
  );

  return (
    <div ref={wrapRef} className="srch-wrap">
      <form className={`search-bar ${focused ? 'focused' : ''}`} onSubmit={handleSubmit}>
        <button type="submit" className="search-icon-btn" aria-label="Rechercher">
          {loading
            ? <span className="srch-spinner" />
            : <span className="material-icons" translate="no">search</span>
          }
        </button>

        <input
          ref={inputRef}
          type="text"
          className="search-input"
          placeholder={placeholder}
          value={value}
          onChange={e => setValue(e.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={e => e.key === 'Escape' && (setFocused(false))}
          autoComplete="off"
        />

        {value && (
          <button type="button" className="search-clear-btn" onClick={() => { setValue(''); setResults(null); inputRef.current?.focus(); }} aria-label="Effacer">
            <span className="material-icons" translate="no">close</span>
          </button>
        )}
      </form>

      {showDropdown && (
        <div className="srch-dropdown">
          {loading && !results && (
            <div className="srch-empty">Recherche en cours…</div>
          )}

          {!loading && results && !hasResults && (
            <div className="srch-empty">Aucun résultat pour <strong>{value}</strong></div>
          )}

          {results && hasResults && (
            <>
              {/* Tags (priorité si #hashtag) */}
              {results.tags?.length > 0 && (
                <section className="srch-section">
                  <div className="srch-section-label">
                    <span className="material-icons" translate="no">tag</span> Tags
                  </div>
                  <div className="srch-tags-row">
                    {results.tags.slice(0, 5).map(tag => (
                      <button key={tag} className="srch-tag-pill" onClick={() => go(`/Catalog?tab=articles&tag=${encodeURIComponent(tag)}`)}>
                        #{tag}
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {/* Articles avec ce tag (mode #hashtag) */}
              {isHashtag && results.tagArticles?.length > 0 && (
                <section className="srch-section">
                  <div className="srch-section-label">
                    <span className="material-icons" translate="no">article</span> Articles avec ce tag
                  </div>
                  {results.tagArticles.slice(0, 3).map(a => (
                    <button key={a.id} className="srch-item" onClick={() => go(`/article/${a.slug}`)}>
                      <div className="srch-thumb">
                        {getFirstImage(a.images)
                          ? <img src={getFirstImage(a.images)} alt="" />
                          : <span className="material-icons" translate="no">article</span>}
                      </div>
                      <div className="srch-info">
                        <span className="srch-title">{a.titre}</span>
                        {a.categories?.nom && <span className="srch-sub">{a.categories.nom}</span>}
                      </div>
                    </button>
                  ))}
                </section>
              )}

              {/* Articles (mode normal) */}
              {!isHashtag && results.articles?.length > 0 && (
                <section className="srch-section">
                  <div className="srch-section-label">
                    <span className="material-icons" translate="no">article</span> Articles
                  </div>
                  {results.articles.slice(0, 3).map(a => (
                    <button key={a.id} className="srch-item" onClick={() => go(`/article/${a.slug}`)}>
                      <div className="srch-thumb">
                        {getFirstImage(a.images)
                          ? <img src={getFirstImage(a.images)} alt="" />
                          : <span className="material-icons" translate="no">article</span>}
                      </div>
                      <div className="srch-info">
                        <span className="srch-title">{a.titre}</span>
                        {a.auteurs?.nom && <span className="srch-sub">Par {a.auteurs.nom}</span>}
                      </div>
                    </button>
                  ))}
                </section>
              )}

              {/* Auteurs */}
              {results.auteurs?.length > 0 && (
                <section className="srch-section">
                  <div className="srch-section-label">
                    <span className="material-icons" translate="no">draw</span> Auteurs
                  </div>
                  {results.auteurs.slice(0, 3).map(p => (
                    <button key={p.id} className="srch-item" onClick={() => go(`/profil/${p.id}`)}>
                      <Avatar src={p.avatar_url} name={p.nom} />
                      <div className="srch-info">
                        <span className="srch-title">{p.nom}</span>
                        <span className="srch-sub srch-role">{p.role}</span>
                      </div>
                    </button>
                  ))}
                </section>
              )}

              {/* Catégories */}
              {results.categories?.length > 0 && (
                <section className="srch-section">
                  <div className="srch-section-label">
                    <span className="material-icons" translate="no">category</span> Catégories
                  </div>
                  {results.categories.slice(0, 3).map(c => (
                    <button key={c.id} className="srch-item" onClick={() => go(`/Catalog?tab=articles&categorie=${c.slug}`)}>
                      <div className="srch-cat-icon">
                        <span className="material-icons" translate="no">folder</span>
                      </div>
                      <div className="srch-info">
                        <span className="srch-title">{c.nom}</span>
                        {c.description && <span className="srch-sub">{c.description.substring(0, 55)}…</span>}
                      </div>
                    </button>
                  ))}
                </section>
              )}

              {/* Profils */}
              {results.profils?.length > 0 && (
                <section className="srch-section">
                  <div className="srch-section-label">
                    <span className="material-icons" translate="no">group</span> Profils
                  </div>
                  {results.profils.slice(0, 2).map(p => (
                    <button key={p.id} className="srch-item" onClick={() => go(`/profil/${p.id}`)}>
                      <Avatar src={p.avatar_url} name={p.nom} />
                      <div className="srch-info">
                        <span className="srch-title">{p.nom}</span>
                      </div>
                    </button>
                  ))}
                </section>
              )}
            </>
          )}

          {/* Pied "Voir tous les résultats" */}
          <button className="srch-see-all" onMouseDown={handleSubmit}>
            <span className="material-icons" translate="no">search</span>
            Voir tous les résultats pour&nbsp;<strong>"{value}"</strong>
          </button>
        </div>
      )}
    </div>
  );
};

export default SearchForm;
