import React from 'react';
// import { generateHTML } from '../../../utils/htmlGenerator';
import { generateHTML } from '../../../../utils/htmlGenerator';
import './PreviewModal.css';

const PreviewModal = ({ isOpen, onClose, onConfirm, articleData, isPublishing }) => {
    if (!isOpen) return null;

    // Generate HTML if not present (or regenerate to be safe with latest blocks)
    // Assuming articleData.contenu_json is available
    const contentHtml = articleData.contenu_html || generateHTML(articleData.contenu_json);

    return (
        <div className="preview-modal-overlay">
            <div className="preview-modal-container">
                {/* Header */}
                <div className="preview-header">
                    <div className="preview-title">
                        <h2>Aperçu de l'article</h2>
                        <span className="preview-subtitle">Voici comment votre article apparaîtra aux lecteurs</span>
                    </div>
                    <div className="preview-actions">
                         <button className="btn-cancel" onClick={onClose}>
                            <i className="fa-solid fa-pen"></i> Modifier encore
                         </button>
                         {isPublishing && (
                             <button className="btn-confirm-publish" onClick={onConfirm}>
                                <i className="fa-solid fa-paper-plane"></i> Confirmer la publication
                             </button>
                         )}
                    </div>
                </div>

                {/* Content similar to Article.jsx structure */}
                <div className="preview-content-scroll">
                    <article className="article-container preview-mode">
                         {/* Header Article */}
                        <header className="article-header">
                             {articleData.titre ? (
                                <h1 className="article-title">{articleData.titre}</h1>
                             ) : (
                                <h1 className="article-title placeholder">Titre de l'article</h1>
                             )}

                            <div className="article-meta">
                                <div className="author-info">
                                     {/* Mock Author or passed data */}
                                     <div className="author-details">
                                         <span className="author-name">Votre Nom</span>
                                     </div>
                                </div>
                                <div className="article-date-info">
                                    <span className="publish-date">
                                        <i className="fa-regular fa-calendar"></i>
                                        {new Date().toLocaleDateString('fr-FR')}
                                    </span>
                                </div>
                            </div>
                        </header>

                        {/* Cover Image */}
                        {articleData.image_url ? (
                            <div className="article-image-container">
                                {articleData.image_url.startsWith('#') ? (
                                    <div className="article-main-image" style={{ backgroundColor: articleData.image_url, minHeight: '300px', width: '100%', borderRadius: '8px' }}></div>
                                ) : (
                                    <img src={articleData.image_url} alt={articleData.titre} className="article-main-image" />
                                )}
                            </div>
                        ) : (
                            <div className="preview-placeholder-image">Pas d'image ou de couleur de couverture</div>
                        )}

                        {/* Content */}
                        <div className="article-content" dangerouslySetInnerHTML={{ __html: contentHtml }} />
                        
                        {/* Tags */}
                        {articleData.tags && articleData.tags.length > 0 && (
                            <div className="article-tags">
                                {articleData.tags.map((tag, index) => (
                                    <span key={index} className="article-tag">#{tag}</span>
                                ))}
                            </div>
                        )}
                    </article>
                </div>
            </div>
        </div>
    );
};

export default PreviewModal;
