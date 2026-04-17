import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileLines } from '@fortawesome/free-solid-svg-icons';
import './CatalogArticleCard.css';

function formatDate(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function MiniAvatar({ src, name }) {
  const initial = (name || '?')[0].toUpperCase();
  return src ? (
    <img src={src} alt={name} className="ac2-mini-avatar" />
  ) : (
    <div className="ac2-mini-avatar ac2-mini-avatar-fallback">{initial}</div>
  );
}

const CatalogArticleCard = ({ article }) => {
  const navigate = useNavigate();
  const date = formatDate(article.date);

  return (
    <div className="ac2-card" onClick={() => navigate(`/article/${article.slug}`)}>

      <div className="ac2-img">
        {article.image
          ? article.image.startsWith('#')
            ? <div style={{ width: '100%', height: '100%', backgroundColor: article.image }} />
            : <img src={article.image} alt={article.title} loading="lazy" />
          : <FontAwesomeIcon icon={faFileLines} />
        }
        {article.image && article.category && (
          <Link
            to={article.categorySlug ? `/Catalog?categorie=${article.categorySlug}` : '/Catalog'}
            className="ac2-cat-badge"
            onClick={e => e.stopPropagation()}
          >
            {article.category}
          </Link>
        )}
      </div>

      <div className="ac2-body">
        {!article.image && article.category && (
          <Link
            to={article.categorySlug ? `/Catalog?categorie=${article.categorySlug}` : '/Catalog'}
            className="ac2-cat-badge ac2-cat-badge--inline"
            onClick={e => e.stopPropagation()}
          >
            {article.category}
          </Link>
        )}
        <h3 className="ac2-title">{article.title}</h3>
        {article.description && (
          <p className="ac2-excerpt">{article.description}</p>
        )}

        <div className="ac2-meta">
          {article.authorId && (
            <Link
              to={`/profil/${article.authorId}`}
              className="ac2-author-link"
              onClick={e => e.stopPropagation()}
            >
              <MiniAvatar src={article.author?.avatar} name={article.author?.name} />
              <span className="ac2-author-name">{article.author?.name || 'Auteur inconnu'}</span>
            </Link>
          )}
          {date && <span className="ac2-date">{date}</span>}
        </div>
      </div>

    </div>
  );
};

export default CatalogArticleCard;
