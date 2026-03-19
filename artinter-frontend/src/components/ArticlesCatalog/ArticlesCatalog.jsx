import React from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import './ArticlesCatalog.css';
import { getAllArticles } from '../../Services/articlesService.js';
import { getAllCategories, getPublicAuteurs } from '../../api/api.js';
import CatalogArticleCard from '../ArticleCard/CatalogArticleCard.jsx';
import Loader from '../Loader/Loader.jsx';
import PageMeta from '../PageMeta/PageMeta.jsx';

// ── Helpers ───────────────────────────────────────────────────────────────────

function useDebounce(value, delay) {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function Avatar({ src, name, size = 52 }) {
  const initial = (name || '?')[0].toUpperCase();
  if (src) return <img src={src} alt={name} className="cat-avatar" style={{ width: size, height: size }} />;
  return <div className="cat-avatar cat-avatar-fallback" style={{ width: size, height: size }}>{initial}</div>;
}

function EmptyState({ icon, label }) {
  return (
    <div className="cat-empty">
      <span className="material-icons" translate="no">{icon}</span>
      <p>{label}</p>
    </div>
  );
}

function parseList(str) {
  return (str || '').split(',').filter(Boolean);
}

function serializeList(arr) {
  return arr.join(',');
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'articles',   label: 'Articles',   icon: 'article' },
  { key: 'auteurs',    label: 'Auteurs',    icon: 'draw' },
  { key: 'categories', label: 'Catégories', icon: 'category' },
  { key: 'tags',       label: 'Tags',       icon: 'tag' },
];

const MAX_CAT_PILLS = 4;
const PAGE_SIZE     = 12;

// ── Pagination controls ────────────────────────────────────────────────────────

function Pagination({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;

  const pages = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - page) <= 1) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== '…') {
      pages.push('…');
    }
  }

  return (
    <div className="cat-pagination">
      <button
        className="cat-page-btn cat-page-arrow"
        onClick={() => onPageChange(page - 1)}
        disabled={page === 1}
        aria-label="Page précédente"
      >
        <span className="material-icons">chevron_left</span>
      </button>

      {pages.map((p, i) =>
        p === '…' ? (
          <span key={`ellipsis-${i}`} className="cat-page-ellipsis">…</span>
        ) : (
          <button
            key={p}
            className={`cat-page-btn${p === page ? ' active' : ''}`}
            onClick={() => onPageChange(p)}
          >
            {p}
          </button>
        )
      )}

      <button
        className="cat-page-btn cat-page-arrow"
        onClick={() => onPageChange(page + 1)}
        disabled={page === totalPages}
        aria-label="Page suivante"
      >
        <span className="material-icons">chevron_right</span>
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const ArticlesCatalog = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // URL = source of truth
  const activeTab          = searchParams.get('tab')      || 'articles';
  const urlQ               = searchParams.get('q')        || '';
  const selectedCategories = parseList(searchParams.get('categorie'));
  const selectedTags       = parseList(searchParams.get('tag'));
  const sortBy             = searchParams.get('sort')     || 'recent';
  const urlView            = searchParams.get('view')     || 'grid';
  const currentPage        = Math.max(1, parseInt(searchParams.get('page') || '1', 10));

  const [searchInput, setSearchInput] = React.useState(urlQ);
  const [isMobile, setIsMobile]       = React.useState(window.innerWidth <= 768);
  const debouncedQ    = useDebounce(searchInput, 500);
  const effectiveView = isMobile ? 'grid' : urlView;

  React.useEffect(() => { setSearchInput(urlQ); }, [urlQ]);

  React.useEffect(() => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (debouncedQ) next.set('q', debouncedQ); else next.delete('q');
      return next;
    }, { replace: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ]);

  React.useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  // ── Data ──────────────────────────────────────────────────────────────────

  const [articles,   setArticles]   = React.useState([]);
  const [categories, setCategories] = React.useState([]);
  const [auteurs,    setAuteurs]    = React.useState([]);
  const [loading,    setLoading]    = React.useState(true);

  React.useEffect(() => {
    Promise.allSettled([getAllArticles(), getAllCategories(), getPublicAuteurs()])
      .then(([artsRes, catsRes, auteurRes]) => {
        setArticles(artsRes.status  === 'fulfilled' ? (artsRes.value  || []) : []);
        setCategories(catsRes.status === 'fulfilled' ? (catsRes.value?.data || []) : []);
        setAuteurs(auteurRes.status === 'fulfilled' ? (auteurRes.value?.data || []) : []);
      })
      .finally(() => setLoading(false));
  }, []);

  const allTags = React.useMemo(() => {
    const map = new Map();
    articles.forEach(a => (a.tags || []).forEach(t => map.set(t, (map.get(t) || 0) + 1)));
    return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([tag, count]) => ({ tag, count }));
  }, [articles]);

  const filteredArticles = React.useMemo(() => {
    let list = articles;
    const q = debouncedQ.toLowerCase();
    if (q) list = list.filter(a =>
      a.title?.toLowerCase().includes(q) ||
      a.description?.toLowerCase().includes(q) ||
      a.category?.toLowerCase().includes(q) ||
      (a.tags || []).some(t => t.toLowerCase().includes(q))
    );
    // Multiple categories → OR logic
    if (selectedCategories.length > 0)
      list = list.filter(a => selectedCategories.includes(a.categorySlug));
    // Multiple tags → OR logic (article must have at least one selected tag)
    if (selectedTags.length > 0)
      list = list.filter(a => (a.tags || []).some(t => selectedTags.includes(t)));
    // Sort
    if (sortBy === 'recent') return [...list].sort((a, b) => new Date(b.date) - new Date(a.date));
    if (sortBy === 'oldest') return [...list].sort((a, b) => new Date(a.date) - new Date(b.date));
    if (sortBy === 'title')  return [...list].sort((a, b) => a.title.localeCompare(b.title));
    return list;
  }, [articles, debouncedQ, selectedCategories, selectedTags, sortBy]);

  const filteredAuteurs = React.useMemo(() => {
    const q = debouncedQ.toLowerCase();
    if (!q) return auteurs;
    return auteurs.filter(a => a.nom.toLowerCase().includes(q));
  }, [auteurs, debouncedQ]);

  const filteredCategories = React.useMemo(() => {
    const q = debouncedQ.toLowerCase();
    if (!q) return categories;
    return categories.filter(c =>
      c.nom?.toLowerCase().includes(q) ||
      c.description?.toLowerCase().includes(q)
    );
  }, [categories, debouncedQ]);

  const filteredTags = React.useMemo(() => {
    const q = debouncedQ.toLowerCase();
    if (!q) return allTags;
    return allTags.filter(({ tag }) => tag.toLowerCase().includes(q));
  }, [allTags, debouncedQ]);

  // ── URL update helpers ────────────────────────────────────────────────────

  const setTab = (tab) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('tab', tab);
      if (tab !== 'articles') {
        next.delete('categorie');
        next.delete('tag');
        next.delete('sort');
        next.delete('view');
      }
      return next;
    }, { replace: true });
  };

  // Toggle one category in the multi-select list (stays on articles tab)
  const toggleCategory = (slug) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      const current = parseList(next.get('categorie'));
      const updated = current.includes(slug)
        ? current.filter(s => s !== slug)
        : [...current, slug];
      if (updated.length) next.set('categorie', serializeList(updated));
      else next.delete('categorie');
      return next;
    }, { replace: true });
  };

  // Click from Categories tab → add category + switch to articles tab
  const selectCategoryAndGo = (slug) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('tab', 'articles');
      const current = parseList(next.get('categorie'));
      if (!current.includes(slug)) {
        next.set('categorie', serializeList([...current, slug]));
      }
      return next;
    }, { replace: true });
  };

  // Toggle one tag in the multi-select list (stays on tags tab)
  const toggleTag = (tag) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      const current = parseList(next.get('tag'));
      const updated = current.includes(tag)
        ? current.filter(t => t !== tag)
        : [...current, tag];
      if (updated.length) next.set('tag', serializeList(updated));
      else next.delete('tag');
      return next;
    }, { replace: true });
  };

  const removeCategory = (slug) => toggleCategory(slug);

  const removeTag = (tag) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      const updated = parseList(next.get('tag')).filter(t => t !== tag);
      if (updated.length) next.set('tag', serializeList(updated));
      else next.delete('tag');
      return next;
    }, { replace: true });
  };

  const clearAllFilters = () => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.delete('categorie');
      next.delete('tag');
      return next;
    }, { replace: true });
  };

  const setSort = (val) => {
    setSearchParams(prev => { const n = new URLSearchParams(prev); n.set('sort', val); n.delete('page'); return n; }, { replace: true });
  };

  const setView = (val) => {
    setSearchParams(prev => { const n = new URLSearchParams(prev); n.set('view', val); return n; }, { replace: true });
  };

  const setPage = (p) => {
    setSearchParams(prev => { const n = new URLSearchParams(prev); n.set('page', p); return n; }, { replace: true });
  };

  // Reset page to 1 whenever filters / search / sort / tab change
  const prevFiltersRef = React.useRef(null);
  React.useEffect(() => {
    const key = `${activeTab}|${debouncedQ}|${selectedCategories.join(',')}|${selectedTags.join(',')}|${sortBy}`;
    if (prevFiltersRef.current !== null && prevFiltersRef.current !== key && currentPage !== 1) {
      setSearchParams(prev => { const n = new URLSearchParams(prev); n.delete('page'); return n; }, { replace: true });
    }
    prevFiltersRef.current = key;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, debouncedQ, selectedCategories.join(','), selectedTags.join(','), sortBy]);

  // ── Tab counts ────────────────────────────────────────────────────────────

  const counts = {
    articles:   filteredArticles.length,
    auteurs:    filteredAuteurs.length,
    categories: filteredCategories.length,
    tags:       filteredTags.length,
  };

  const hasActiveFilters = selectedCategories.length > 0 || selectedTags.length > 0;

  // ── Tab content ───────────────────────────────────────────────────────────

  const renderContent = () => {
    if (loading) return <Loader />;

    switch (activeTab) {

      case 'articles': {
        const visibleCats = categories.slice(0, MAX_CAT_PILLS);
        const hasMoreCats = categories.length > MAX_CAT_PILLS;
        const noFilter    = !hasActiveFilters && !debouncedQ;

        return (
          <>
            <div className="cat-filters-box">

              {/* ── Category pills ── */}
              <div className="cat-category-pills">
                <button
                  className={`cat-cat-pill ${selectedCategories.length === 0 && selectedTags.length === 0 ? 'active' : ''}`}
                  onClick={clearAllFilters}
                >
                  Toutes
                </button>

                {visibleCats.map(c => (
                  <button
                    key={c.id}
                    className={`cat-cat-pill ${selectedCategories.includes(c.slug) ? 'active' : ''}`}
                    onClick={() => toggleCategory(c.slug)}
                  >
                    {c.nom}
                  </button>
                ))}

                {hasMoreCats && (
                  <button className="cat-see-more-cats" onClick={() => setTab('categories')}>
                    Voir plus <span className="material-icons" translate="no">chevron_right</span>
                  </button>
                )}
              </div>

              {/* ── Active filters chips (extra categories + all tags) ── */}
              {hasActiveFilters && (
                <div className="cat-active-filters">
                  {/* Categories not visible in the pills row */}
                  {selectedCategories
                    .filter(slug => !visibleCats.some(c => c.slug === slug))
                    .map(slug => {
                      const cat = categories.find(c => c.slug === slug);
                      return (
                        <span key={slug} className="cat-active-chip">
                          {cat?.nom || slug}
                          <button onClick={() => removeCategory(slug)} aria-label="Retirer">
                            <span className="material-icons" translate="no">close</span>
                          </button>
                        </span>
                      );
                    })
                  }

                  {/* Active tags */}
                  {selectedTags.map(tag => (
                    <span key={tag} className="cat-active-chip cat-active-chip--tag">
                      #{tag}
                      <button onClick={() => removeTag(tag)} aria-label="Retirer">
                        <span className="material-icons" translate="no">close</span>
                      </button>
                    </span>
                  ))}

                  <button className="cat-clear-all" onClick={clearAllFilters}>
                    Tout effacer
                  </button>
                </div>
              )}

              {/* ── Sort + view ── */}
              <div className="cat-sort-view-row">
                <div className="cat-filter-group">
                  <label>Trier par :</label>
                  <select value={sortBy} onChange={e => setSort(e.target.value)}>
                    <option value="recent">Plus récent</option>
                    <option value="oldest">Plus ancien</option>
                    <option value="title">Titre (A-Z)</option>
                  </select>
                </div>

                <div className="cat-view-toggle">
                  <button className={effectiveView === 'grid' ? 'active' : ''} onClick={() => setView('grid')} title="Vue grille">
                    <span className="material-icons" translate="no">grid_view</span>
                  </button>
                  <button className={effectiveView === 'list' ? 'active' : ''} onClick={() => setView('list')} title="Vue liste" disabled={isMobile}>
                    <span className="material-icons" translate="no">view_list</span>
                  </button>
                </div>
              </div>

            </div>

            {filteredArticles.length > 0 ? (() => {
              const totalPages = Math.ceil(filteredArticles.length / PAGE_SIZE);
              const safePage   = Math.min(currentPage, totalPages);
              const paginated  = filteredArticles.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
              return (
                <>
                  <div className={`cat-articles-grid ${effectiveView}`}>
                    {paginated.map(a => <CatalogArticleCard key={a.id} article={a} />)}
                  </div>
                  <Pagination page={safePage} totalPages={totalPages} onPageChange={setPage} />
                </>
              );
            })() : (
              <EmptyState
                icon="search_off"
                label={noFilter ? 'Aucun article disponible' : 'Aucun article ne correspond à ces filtres'}
              />
            )}
          </>
        );
      }

      case 'auteurs':
        return filteredAuteurs.length > 0 ? (
          <div className="cat-persons-grid">
            {filteredAuteurs.map(a => (
              <button key={a.id} className="cat-person-card" onClick={() => navigate(`/profil/${a.id}`)}>
                <Avatar src={a.avatar_url} name={a.nom} />
                <div className="cat-person-info">
                  <span className="cat-person-name">{a.nom}</span>
                  <span className="cat-person-role">
                    {a.article_count > 0 ? `${a.article_count} article${a.article_count > 1 ? 's' : ''}` : 'Auteur'}
                  </span>
                  {a.bio && <p className="cat-person-bio">{a.bio.substring(0, 90)}…</p>}
                </div>
              </button>
            ))}
          </div>
        ) : <EmptyState icon="draw" label="Aucun auteur trouvé" />;

      case 'categories':
        return filteredCategories.length > 0 ? (
          <div className="cat-cats-grid">
            {filteredCategories.map(c => (
              <button
                key={c.id}
                className={`cat-cat-card ${selectedCategories.includes(c.slug) ? 'selected' : ''}`}
                onClick={() => selectCategoryAndGo(c.slug)}
              >
                <div className="cat-cat-icon">
                  <span className="material-icons" translate="no">folder</span>
                </div>
                <div className="cat-cat-info">
                  <span className="cat-cat-name">{c.nom}</span>
                  {c.description && <p className="cat-cat-desc">{c.description}</p>}
                </div>
              </button>
            ))}
          </div>
        ) : <EmptyState icon="category" label="Aucune catégorie trouvée" />;

      case 'tags': {
        // Count of articles matching current tag selection (for feedback)
        const previewCount = selectedTags.length > 0
          ? articles.filter(a => (a.tags || []).some(t => selectedTags.includes(t))).length
          : null;

        return (
          <>
            {selectedTags.length > 0 && (
              <div className="cat-tags-selection-bar">
                <span className="cat-tags-selection-info">
                  {selectedTags.length} tag{selectedTags.length > 1 ? 's' : ''} sélectionné{selectedTags.length > 1 ? 's' : ''} — {previewCount} article{previewCount !== 1 ? 's' : ''}
                </span>
                <div className="cat-tags-selection-actions">
                  <button className="cat-tags-clear" onClick={() => {
                    setSearchParams(prev => { const n = new URLSearchParams(prev); n.delete('tag'); return n; }, { replace: true });
                  }}>
                    Effacer
                  </button>
                  <button className="cat-tags-go" onClick={() => setTab('articles')}>
                    Voir les articles <span className="material-icons" translate="no">arrow_forward</span>
                  </button>
                </div>
              </div>
            )}

            {filteredTags.length > 0 ? (
              <div className="cat-tags-grid">
                {filteredTags.map(({ tag, count }) => (
                  <button
                    key={tag}
                    className={`cat-tag-pill ${selectedTags.includes(tag) ? 'active' : ''}`}
                    onClick={() => toggleTag(tag)}
                  >
                    #{tag}
                    <span className="cat-tag-count">{count}</span>
                  </button>
                ))}
              </div>
            ) : <EmptyState icon="tag" label="Aucun tag trouvé" />}
          </>
        );
      }

      default: return null;
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="catalog-page fadeInContainer">
      <PageMeta
        title="Catalogue"
        description="Explorez tous les articles ArtInter — art, culture, créations et actualité visuelle internationale."
        url={`${window.location.origin}/catalog`}
      />

      <div className="catalog-header">
        <h1>Découvrir</h1>
        <p className="catalog-subtitle">
          {loading
            ? 'Chargement…'
            : `${counts[activeTab]} résultat${counts[activeTab] !== 1 ? 's' : ''}`}
        </p>
      </div>

      <div className="cat-search-bar">
        <span className="material-icons" translate="no">search</span>
        <input
          type="text"
          placeholder="Rechercher…"
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          autoComplete="off"
        />
        {searchInput && (
          <button type="button" onClick={() => setSearchInput('')} aria-label="Effacer">
            <span className="material-icons" translate="no">close</span>
          </button>
        )}
      </div>

      <div className="cat-tabs" role="tablist">
        {TABS.map(tab => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={activeTab === tab.key}
            className={`cat-tab ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setTab(tab.key)}
          >
            <span className="material-icons" translate="no">{tab.icon}</span>
            <span className="cat-tab-label">{tab.label}</span>
            {!loading && <span className="cat-tab-count">{counts[tab.key]}</span>}
          </button>
        ))}
      </div>

      <div className="cat-content">
        {renderContent()}
      </div>

    </div>
  );
};

export default ArticlesCatalog;
