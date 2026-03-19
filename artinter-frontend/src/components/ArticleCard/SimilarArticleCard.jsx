// src/components/SimilarArticlesSection/SimilarArticlesSection.jsx
import React from 'react';
import ArticleCard from './ArticleCard.jsx';
import './ArticleCard.css'; 

const SimilarArticlesSection = ({ articles }) => {
  if (!articles || articles.length === 0) return null;

  return (
    <section className="similar-articles-section">
      <h2 className="section-title">Articles similaires</h2>
      <div className="articles-grid">
        {articles.map((article) => (
          <ArticleCard key={article.id} article={article} />
        ))}
      </div>
    </section>
  );
};

export default SimilarArticlesSection;