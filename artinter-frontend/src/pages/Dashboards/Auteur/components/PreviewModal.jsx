import React from 'react';
import DOMPurify from 'dompurify';
import { generateHTML } from '../../../../utils/htmlGenerator';
import '../../../Article/Article.css';
import './PreviewModal.css';

const PreviewModal = ({ onClose, onConfirm, articleData, isPublishing }) => {
    if (!articleData) return null;

    const contentHtml = articleData.contenu_html || generateHTML(articleData.contenu_json);

    return (
        <>
            <div className="preview-bar">
                <div className="preview-bar-left">
                    <span className="preview-bar-label">Aperçu</span>
                    <span className="preview-bar-sub">Voici comment votre article apparaîtra aux lecteurs</span>
                </div>
                <div className="preview-bar-actions">
                    <button className="btn-preview-back" onClick={onClose}>
                        <i className="fa-solid fa-pen"></i> Modifier encore
                    </button>
                    {isPublishing && (
                        <button className="btn-preview-publish" onClick={onConfirm}>
                            <i className="fa-solid fa-paper-plane"></i> Confirmer la publication
                        </button>
                    )}
                </div>
            </div>

            <div className="article-page">
                <article className="article-container">

                    <header className="article-header">
                        <h1 className="article-title">
                            {articleData.titre || 'Titre de l\'article'}
                        </h1>
                        <div className="article-meta">
                            <div className="author-info">
                                <div className="author-avatar-placeholder">
                                    <span className="material-icons" translate="no">person</span>
                                </div>
                                <div className="author-details">
                                    <span className="author-name">Vous</span>
                                </div>
                            </div>
                            <div className="article-date-info">
                                <span className="publish-date">
                                    <span className="material-icons" translate="no">calendar_today</span>
                                    {new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                                </span>
                            </div>
                        </div>
                    </header>

                    {articleData.image_url && (
                        <div className="article-image-container">
                            {articleData.image_url.startsWith('#') ? (
                                <div className="article-main-image" style={{ backgroundColor: articleData.image_url, minHeight: '400px', width: '100%', borderRadius: '12px' }} />
                            ) : (
                                <img src={articleData.image_url} alt={articleData.titre} className="article-main-image" />
                            )}
                        </div>
                    )}

                    <div
                        className="article-content"
                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(contentHtml) }}
                    />

                    {articleData.tags && articleData.tags.length > 0 && (
                        <div className="article-tags">
                            <span className="article-tags-label">
                                <span className="material-icons" translate="no">local_offer</span>
                                Tags :
                            </span>
                            {articleData.tags.map((tag, index) => (
                                <span key={index} className="article-tag">#{tag}</span>
                            ))}
                        </div>
                    )}

                </article>
            </div>
        </>
    );
};

export default PreviewModal;
