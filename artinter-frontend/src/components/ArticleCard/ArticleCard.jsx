import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import './ArticleCard.css'

const ArticleCard = ({ article }) => {
  const navigate = useNavigate();

  const authorName = article.author?.name || article.author || null;

  return (
    <article
      className="article-card"
      onClick={() => navigate(`/article/${article.slug}`)}
      style={{ cursor: 'pointer' }}
    >

      {/* Image + Badge Catégorie */}
      {article.image && (
        <div className="card-image-wrapper">
          {article.image.startsWith('#') ? (
              <div style={{ backgroundColor: article.image, width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}></div>
          ) : (
              <img src={article.image} alt={article.title} loading="lazy" />
          )}
          {article.category && (
            <Link
              to={article.categorySlug ? `/Catalog?categorie=${article.categorySlug}` : '/Catalog'}
              className="card-category"
              onClick={e => e.stopPropagation()}
            >
              {article.category}
            </Link>
          )}
        </div>
      )}

      {/* Contenu */}
      <div className="card-content">
        {!article.image && article.category && (
          <Link
            to={article.categorySlug ? `/Catalog?categorie=${article.categorySlug}` : '/Catalog'}
            className="card-category-text"
            onClick={e => e.stopPropagation()}
          >
            {article.category}
          </Link>
        )}
        <h3>{article.title}</h3>
        <p className="card-desc">
          {article.description.length > 100
            ? article.description.substring(0, 60) + '...'
            : article.description}
        </p>

        {authorName && (
          <button
            className="card-author-btn"
            onClick={(e) => { e.stopPropagation(); article.authorId && navigate(`/profil/${article.authorId}`); }}
            title="Voir le profil de l'auteur"
          >
            <span className="material-icons">person</span>
            {authorName}
          </button>
        )}

        <span className="card-link">
          Lire la suite <span className="material-icons" translate="no" style={{fontSize:'14px', verticalAlign:'middle'}}>arrow_forward</span>
        </span>
      </div>

    </article>
  )
}

export default ArticleCard