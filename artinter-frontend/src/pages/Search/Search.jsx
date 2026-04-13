import React from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { searchAll } from '../../api/api.js';
import Loader from '../../components/Loader/Loader.jsx';
import './Search.css';

function formatDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getFirstImage(images) {
  if (Array.isArray(images)) return images[0] || null;
  return null;
}

function Avatar({ src, name, size = 44, cls = 'srp-avatar' }) {
  const initials = (name || '?')[0].toUpperCase();
  return src ? (
    <img src={src} alt={name} className={cls} style={{ width: size, height: size }} />
  ) : (
    <div className={`${cls} ${cls}-fallback`} style={{ width: size, height: size }}>{initials}</div>
  );
}

function EmptyTab({ icon, label }) {
  return (
    <div className="srp-empty">
      <span className="material-icons" translate="no">{icon}</span>
      <p>{label}</p>
    </div>
  );
}

// ── Sub-views ─────────────────────────────────────────────────────────────────

function ArticleCard({ article }) {
  const navigate = useNavigate();
  const img = getFirstImage(article.images);
  const date = formatDate(article.date_publication);

  return (
    <div className="srp-article-card" onClick={() => navigate(`/article/${article.slug}`)}>
      {/* Image + badge catégorie */}
      <div className="srp-article-img">
        {img
          ? <img src={img} alt={article.titre} />
          : <span className="material-icons" translate="no">article</span>}
        {article.categories?.nom && (
          <Link
            to={`/Catalog?categorie=${article.categories.slug}`}
            className="srp-article-cat-badge"
            onClick={e => e.stopPropagation()}
          >
            {article.categories.nom}
          </Link>
        )}
      </div>

      {/* Corps */}
      <div className="srp-article-body">
        <h3 className="srp-article-title">{article.titre}</h3>
        {article.excerpt && <p className="srp-article-excerpt">{article.excerpt}</p>}

        {/* Meta : auteur + date */}
        <div className="srp-article-meta">
          {article.auteurs && (
            <Link
              to={`/profil/${article.auteurs.id}`}
              className="srp-article-author-link"
              onClick={e => e.stopPropagation()}
            >
              <Avatar src={article.auteurs.avatar_url} name={article.auteurs.nom} size={22} cls="srp-mini-avatar" />
              <span className="srp-article-author-name">{article.auteurs.nom}</span>
            </Link>
          )}
          {date && <span className="srp-article-date">{date}</span>}
        </div>
      </div>
    </div>
  );
}

function AuteurCard({ profil }) {
  return (
    <Link to={`/profil/${profil.id}`} className="srp-person-card">
      <Avatar src={profil.avatar_url} name={profil.nom} size={52} />
      <div className="srp-person-info">
        <span className="srp-person-name">{profil.nom}</span>
        <span className="srp-person-role">{profil.role}</span>
        {profil.bio && <p className="srp-person-bio">{profil.bio.substring(0, 80)}…</p>}
      </div>
    </Link>
  );
}

function CategorieCard({ cat }) {
  return (
    <Link to={`/Catalog?categorie=${cat.slug}`} className="srp-cat-card">
      <div className="srp-cat-icon">
        <span className="material-icons" translate="no">folder</span>
      </div>
      <div className="srp-cat-info">
        <span className="srp-cat-name">{cat.nom}</span>
        {cat.description && <p className="srp-cat-desc">{cat.description}</p>}
      </div>
    </Link>
  );
}

function TagView({ tag, articles }) {
  return (
    <div className="srp-tag-view">
      <div className="srp-tag-header">
        <span className="srp-tag-badge">#{tag}</span>
        <span className="srp-tag-count">{articles.length} article{articles.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="srp-articles-grid">
        {articles.map(a => <ArticleCard key={a.id} article={a} />)}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'tout',       label: 'Tout',       icon: 'apps' },
  { key: 'articles',   label: 'Articles',   icon: 'article' },
  { key: 'auteurs',    label: 'Auteurs',    icon: 'draw' },
  { key: 'categories', label: 'Catégories', icon: 'category' },
  { key: 'tags',       label: '#Tags',      icon: 'tag' },
  { key: 'profils',    label: 'Profils',    icon: 'group' },
];

function Search() {
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get('q') || '';
  const isHashtag = q.startsWith('#');
  const rawTag = isHashtag ? q.slice(1) : '';

  const [activeTab, setActiveTab] = React.useState(() => isHashtag ? 'tags' : 'tout');
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [inputVal, setInputVal] = React.useState(q);

  // When q changes, update input and reset tab
  React.useEffect(() => {
    setInputVal(q);
    setActiveTab(q.startsWith('#') ? 'tags' : 'tout');
  }, [q]);

  // Fetch results
  React.useEffect(() => {
    if (!q || q.trim().length < 2) { setData(null); return; }
    setLoading(true);
    searchAll(q.trim(), 20)
      .then(res => setData(res.data))
      .catch(() => {/* silencieux */})
      .finally(() => setLoading(false));
  }, [q]);

  const handleSearch = (e) => {
    e.preventDefault();
    const val = inputVal.trim();
    if (!val) return;
    setSearchParams({ q: val });
  };

  const counts = data ? {
    tout:       (data.articles?.length || 0) + (data.auteurs?.length || 0) + (data.categories?.length || 0) + (data.profils?.length || 0) + (data.tags?.length || 0),
    articles:   data.articles?.length || 0,
    auteurs:    data.auteurs?.length || 0,
    categories: data.categories?.length || 0,
    tags:       (data.tags?.length || 0) + (data.tagArticles?.length || 0),
    profils:    data.profils?.length || 0,
  } : {};

  // ── Tab content ─────────────────────────────────────────────────────────────

  const renderTab = () => {
    if (loading) return <Loader />;
    if (!data) return null;

    switch (activeTab) {
      case 'tout':
        return (
          <div className="srp-tout">
            {/* Tags */}
            {data.tags?.length > 0 && (
              <section className="srp-section">
                <h3 className="srp-section-title"><span className="material-icons" translate="no">tag</span> Tags</h3>
                <div className="srp-tags-grid">
                  {data.tags.map(tag => (
                    <button key={tag} className="srp-tag-pill" onClick={() => setSearchParams({ q: '#' + tag })}>
                      #{tag}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Articles */}
            {data.articles?.length > 0 && (
              <section className="srp-section">
                <div className="srp-section-head">
                  <h3 className="srp-section-title"><span className="material-icons" translate="no">article</span> Articles</h3>
                  {data.articles.length >= 4 && <button className="srp-see-more" onClick={() => setActiveTab('articles')}>Voir tout →</button>}
                </div>
                <div className="srp-articles-grid">
                  {data.articles.slice(0, 4).map(a => <ArticleCard key={a.id} article={a} />)}
                </div>
              </section>
            )}

            {/* Auteurs */}
            {data.auteurs?.length > 0 && (
              <section className="srp-section">
                <div className="srp-section-head">
                  <h3 className="srp-section-title"><span className="material-icons" translate="no">draw</span> Auteurs</h3>
                  {data.auteurs.length >= 4 && <button className="srp-see-more" onClick={() => setActiveTab('auteurs')}>Voir tout →</button>}
                </div>
                <div className="srp-persons-grid">
                  {data.auteurs.slice(0, 4).map(p => <AuteurCard key={p.id} profil={p} />)}
                </div>
              </section>
            )}

            {/* Catégories */}
            {data.categories?.length > 0 && (
              <section className="srp-section">
                <div className="srp-section-head">
                  <h3 className="srp-section-title"><span className="material-icons" translate="no">category</span> Catégories</h3>
                </div>
                <div className="srp-cats-grid">
                  {data.categories.slice(0, 6).map(c => <CategorieCard key={c.id} cat={c} />)}
                </div>
              </section>
            )}

            {/* Profils */}
            {data.profils?.length > 0 && (
              <section className="srp-section">
                <div className="srp-section-head">
                  <h3 className="srp-section-title"><span className="material-icons" translate="no">group</span> Profils</h3>
                </div>
                <div className="srp-persons-grid">
                  {data.profils.slice(0, 4).map(p => <AuteurCard key={p.id} profil={p} />)}
                </div>
              </section>
            )}

            {counts.tout === 0 && (
              <EmptyTab icon="search_off" label={`Aucun résultat pour "${q}"`} />
            )}
          </div>
        );

      case 'articles':
        return data.articles?.length > 0
          ? <div className="srp-articles-grid">{data.articles.map(a => <ArticleCard key={a.id} article={a} />)}</div>
          : <EmptyTab icon="article" label="Aucun article trouvé" />;

      case 'auteurs':
        return data.auteurs?.length > 0
          ? <div className="srp-persons-grid">{data.auteurs.map(p => <AuteurCard key={p.id} profil={p} />)}</div>
          : <EmptyTab icon="draw" label="Aucun auteur trouvé" />;

      case 'categories':
        return data.categories?.length > 0
          ? <div className="srp-cats-grid">{data.categories.map(c => <CategorieCard key={c.id} cat={c} />)}</div>
          : <EmptyTab icon="category" label="Aucune catégorie trouvée" />;

      case 'tags': {
        const tagArticles = isHashtag ? (data.tagArticles || []) : [];
        const tagList = data.tags || [];
        if (tagList.length === 0 && tagArticles.length === 0)
          return <EmptyTab icon="tag" label="Aucun tag trouvé" />;
        return (
          <div className="srp-tags-tab">
            {tagList.length > 0 && !isHashtag && (
              <div className="srp-tags-grid" style={{ marginBottom: 24 }}>
                {tagList.map(tag => (
                  <button key={tag} className="srp-tag-pill" onClick={() => setSearchParams({ q: '#' + tag })}>
                    #{tag}
                  </button>
                ))}
              </div>
            )}
            {isHashtag && tagArticles.length > 0 && (
              <TagView tag={rawTag} articles={tagArticles} />
            )}
          </div>
        );
      }

      case 'profils':
        return data.profils?.length > 0
          ? <div className="srp-persons-grid">{data.profils.map(p => <AuteurCard key={p.id} profil={p} />)}</div>
          : <EmptyTab icon="group" label="Aucun profil trouvé" />;

      default: return null;
    }
  };

  return (
    <div className="srp-page fadeInContainer">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="srp-header">
        <form className="srp-search-bar" onSubmit={handleSearch}>
          <span className="material-icons" translate="no">search</span>
          <input
            type="text"
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            placeholder="Rechercher…"
            autoFocus
            autoComplete="off"
          />
          {inputVal && (
            <button type="button" onClick={() => { setInputVal(''); setSearchParams({}); }} aria-label="Effacer">
              <span className="material-icons" translate="no">close</span>
            </button>
          )}
        </form>

        {q && !loading && (
          <p className="srp-subtitle">
            Résultats pour <strong>"{q}"</strong>
            {data && ` — ${counts.tout} résultat${counts.tout !== 1 ? 's' : ''}`}
          </p>
        )}
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      {q.trim().length >= 2 && (
        <div className="srp-tabs" role="tablist">
          {TABS.map(tab => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={activeTab === tab.key}
              className={`srp-tab ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              <span className="material-icons" translate="no">{tab.icon}</span>
              <span className="srp-tab-label">{tab.label}</span>
              {data && counts[tab.key] > 0 && (
                <span className="srp-tab-count">{counts[tab.key]}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <div className="srp-content">
        {!q.trim() ? (
          <EmptyTab icon="search" label="Tapez quelque chose pour lancer une recherche" />
        ) : q.trim().length < 2 ? (
          <EmptyTab icon="search" label="Entrez au moins 2 caractères" />
        ) : renderTab()}
      </div>
    </div>
  );
}

export default Search;
