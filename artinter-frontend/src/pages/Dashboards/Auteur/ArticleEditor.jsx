import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useBlocker } from 'react-router-dom';
import EditorJS from '@editorjs/editorjs';
import Header from '@editorjs/header';
import List from '@editorjs/list';
import Quote from '@editorjs/quote';
import Marker from '@editorjs/marker';
import InlineCode from '@editorjs/inline-code';
import Underline from '@editorjs/underline';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';
import { getCurrentUser, getArticleById, createArticle, updateArticle, getAllCategories, uploadArticleImage, getArticlesByAuteur } from '../../../api/api';
import imageCompression from 'browser-image-compression';
import SupabaseImageTool from '../../../components/Editor/SupabaseImageTool';
import SupabaseGalleryTool from '../../../components/Editor/SupabaseGalleryTool';
import Loader from '../../../components/Loader/Loader';
import NotFound from '../../NotFound/NotFound';
import PreviewModal from './components/PreviewModal';
import ValidationBanner from './components/ValidationBanner';
import ConfirmModal from '../../../components/Modal/ConfirmModal';
import { generateHTML } from '../../../utils/htmlGenerator';
import './ArticleEditor.css';

const ArticleEditor = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const ejInstance = useRef(null);
    const coverInputRef = useRef(null);
    const editorDataRef = useRef({});
    
    const [loading, setLoading] = useState(true);
    const [notAllowed, setNotAllowed] = useState(false);
    const [saving, setSaving] = useState(false);
    const [categories, setCategories] = useState([]);
    
    // Form State
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');
    const [coverUrl, setCoverUrl] = useState('');
    const [status, setStatus] = useState('brouillon');
    const [tags, setTags] = useState('');
    const [userId, setUserId] = useState(null);
    
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [autoSaveStatus, setAutoSaveStatus] = useState(null); // null | 'saving' | 'saved' | 'error'
    const [autoSavedAt, setAutoSavedAt] = useState(null);
    const autoSaveRef = useRef(null); // garde l'id de l'article créé par auto-save
    
    // UI State
    const [showSettings, setShowSettings] = useState(false);
    const [showQuickMenu, setShowQuickMenu] = useState(false);
    const [showAllCategories, setShowAllCategories] = useState(false);
    const [wordCount, setWordCount] = useState(0);
    const [charCount, setCharCount] = useState(0);

    // New UI State for Preview/Validation
    const [showPreview, setShowPreview] = useState(false);
    const [validationErrors, setValidationErrors] = useState([]);
    const [feedbackModal, setFeedbackModal] = useState({ isOpen: false, title: '', message: '', isError: false });
    const [previewData, setPreviewData] = useState(null);

    // Prompt before closing/refreshing if unsaved
    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (hasUnsavedChanges) {
                e.preventDefault();
                e.returnValue = ''; // Typical way to trigger browser prompt
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [hasUnsavedChanges]);

    // React Router navigation blocker
    const blocker = useBlocker(
        ({ currentLocation, nextLocation }) =>
            hasUnsavedChanges && currentLocation.pathname !== nextLocation.pathname
    );

    useEffect(() => {
        if (blocker.state === "blocked") {
            const confirm = window.confirm("Vous avez des modifications non enregistrées. Voulez-vous vraiment quitter ?");
            if (confirm) {
                blocker.proceed();
            } else {
                blocker.reset();
            }
        }
    }, [blocker]);

    // ── Auto-save ────────────────────────────────────────────────────────────
    useEffect(() => {
        const AUTO_SAVE_INTERVAL = 30_000; // 30 secondes

        const runAutoSave = async () => {
            if (!hasUnsavedChanges || saving || !userId || !ejInstance.current) return;
            if (!title?.trim()) return; // Pas de titre = pas de sauvegarde silencieuse

            setAutoSaveStatus('saving');
            try {
                const outputData  = await ejInstance.current.save();
                const htmlContent = generateHTML(outputData);
                const contentImages = outputData.blocks
                    .filter(b => b.type === 'image')
                    .map(b => b.data.url);
                const allImages = coverUrl
                    ? [coverUrl, ...contentImages.filter(u => u !== coverUrl)]
                    : contentImages;

                const articleData = {
                    titre:        title,
                    categorie:    selectedCategory || null,
                    est_publie:   false,
                    contenu_json: outputData,
                    contenu_html: htmlContent || '<p></p>',
                    images:       allImages,
                    tags:         tags.split(',').map(t => t.trim()).filter(Boolean),
                    id_auteur:    userId,
                    temps_lecture: Math.max(1, Math.ceil(wordCount / 238)),
                };

                const currentId = autoSaveRef.current || id;
                let result;
                if (currentId) {
                    result = await updateArticle(currentId, articleData);
                } else {
                    result = await createArticle(articleData);
                    if (result.success && result.data?.id) {
                        autoSaveRef.current = result.data.id;
                    }
                }

                if (result.success) {
                    setHasUnsavedChanges(false);
                    setAutoSavedAt(new Date());
                    setAutoSaveStatus('saved');
                } else {
                    setAutoSaveStatus('error');
                }
            } catch {
                setAutoSaveStatus('error');
            }
        };

        const interval = setInterval(runAutoSave, AUTO_SAVE_INTERVAL);
        return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasUnsavedChanges, saving, userId, title, selectedCategory, coverUrl, tags, wordCount, id]);

    // Load initial data
    useEffect(() => {
        const init = async () => {
            try {
                // 1. Check Auth
                const { data: user } = await getCurrentUser();
                if (!user) {
                    navigate('/login');
                    return;
                }
                setUserId(user.id);

                // 2. Load Categories
                const { data: cats } = await getAllCategories();
                setCategories(cats || []);

                let initialData = {};
                if (id) {
                    const { data: article } = await getArticleById(id);
                    if (!article || article.id_auteur !== user.id) {
                        setNotAllowed(true);
                        return;
                    }
                    setTitle(article.titre);
                    setDescription(article.description || '');
                    setSelectedCategory(article.categorie);
                    setCoverUrl(article.image_url || ((article.images && article.images.length > 0) ? article.images[0] : ''));
                    setStatus(article.est_publie ? 'publie' : 'brouillon');
                    setTags(article.tags ? article.tags.join(', ') : '');

                    if (article.contenu_json) {
                        initialData = article.contenu_json;
                    } else {
                        console.warn("No JSON content found, starting fresh.");
                    }
                } else {
                    // Pre-fill cover with last published/saved article's cover
                    try {
                        const res = await getArticlesByAuteur(user.id);
                        if (res.success && res.data && res.data.length > 0) {
                            const lastArt = res.data[0];
                            const lastCover = lastArt.image_url || (lastArt.images && lastArt.images.length > 0 ? lastArt.images[0] : '');
                            if (lastCover) {
                                setCoverUrl(lastCover);
                            }
                        }
                    } catch (e) {
                        console.error('Failed to get default cover', e);
                    }
                }
                
                // Store data for editor init
                editorDataRef.current = initialData;

            } catch (error) {
                console.error('Error init:', error);
            } finally {
                setLoading(false);
                // Reset dirty state after initial load
                setTimeout(() => setHasUnsavedChanges(false), 500); 
            }
        };

        init();

        // Cleanup function stays here or moves to the new effect? 
        // Better to move cleanup to the effect that initializes it.
    }, [id, navigate]);

    // Separate effect for EditorJS initialization
    useEffect(() => {
        if (!loading && !ejInstance.current) {
            initEditor(editorDataRef.current);
        }

        return () => {
            if (ejInstance.current && ejInstance.current.destroy && !loading) {
                // Only destroy if we are unmounting or re-initializing
                // But typically we don't want to destroy on every re-render unless necessary
               ejInstance.current.destroy();
               ejInstance.current = null;
            }
        };
    }, [loading]); // Run when loading completes

    const initEditor = (data) => {
        const editor = new EditorJS({
            holder: 'editorjs',
            logLevel: 'ERROR',
            data: data,
            onReady: () => {
                ejInstance.current = editor;
            },
            onChange: async () => {
                setHasUnsavedChanges(true); // Mark as dirty
                // Update word count — extract text from all block types
                const outputData = await ejInstance.current.save();
                const extractText = (block) => {
                    const d = block.data || {};
                    const parts = [];
                    if (d.text)    parts.push(d.text);
                    if (d.caption) parts.push(d.caption);
                    if (d.code)    parts.push(d.code);
                    if (Array.isArray(d.items)) {
                        d.items.forEach(item => {
                            if (typeof item === 'string') parts.push(item);
                            else if (item?.content)       parts.push(item.content);
                        });
                    }
                    return parts.join(' ');
                };
                const fullText = outputData.blocks.map(extractText).join(' ').replace(/<[^>]+>/g, ' ');
                const words = fullText.split(/\s+/).filter(Boolean);
                setWordCount(words.length);
                setCharCount(fullText.replace(/\s/g, '').length);
            },
            autofocus: true,
            tools: {
                header: Header,
                list: List,
                quote: {
                  class: Quote,
                  inlineToolbar: true,
                  config: {
                    quotePlaceholder: 'Saisissez une citation...',
                    captionPlaceholder: 'Légende de la citation (optionnelle)'
                  }
                },
                marker: Marker,
                inlineCode: InlineCode,
                underline: Underline,
                image: {
                    class: SupabaseImageTool,
                    config: {}
                },
                gallery: {
                    class: SupabaseGalleryTool,
                    config: {}
                }
            },
            i18n: {
                messages: {
                    ui: {
                        "blockTunes": {
                            "toggler": {
                                "Click to tune": "Cliquez pour régler",
                                "or drag to move": "ou glisser pour déplacer"
                            },
                        },
                        "inlineToolbar": {
                            "converter": {
                                "Convert to": "Convertir en"
                            }
                        },
                        "toolbar": {
                            "toolbox": {
                                "Add": "Ajouter"
                            }
                        }
                    },
                    toolNames: {
                        "Text": "Texte",
                        "Heading": "Titre",
                        "List": "Liste",
                        "Quote": "Citation",
                        "Marker": "Surligneur",
                        "Bold": "Gras",
                        "Italic": "Italique",
                        "InlineCode": "Code en ligne",
                        "Image": "Image",
                        "Gallery": "Galerie"
                    },
                }
            }
        });
    };

    // Refactored Save Logic to accept published override
    const saveInternal = async (forcePublish = false) => {
        setSaving(true);
        try {
            // CRITICAL: Validate userId first
            if (!userId) {
                setFeedbackModal({
                    isOpen: true,
                    title: 'Erreur d\'authentification',
                    message: 'Impossible de sauvegarder: utilisateur non identifié. Veuillez vous reconnecter.',
                    isError: true,
                    isDanger: true
                });
                setSaving(false);
                return;
            }

            const outputData = await ejInstance.current.save();
            const htmlContent = generateHTML(outputData);
            
            // If not forcing publish (Save clicked), then it is NOT published (Draft mode)
            // Even if it was previously published, saving an edit reverts to draft (User requirement)
            const isPublished = forcePublish; 
            
            if (!forcePublish) {
                 // Explicitly set status to draft in UI
                 setStatus('brouillon');
            }

            const contentImages = outputData.blocks
                .filter(block => block.type === 'image')
                .map(block => block.data.url);
            
            // Combine cover image/color with content images, avoiding duplicates
            const allImages = coverUrl 
                ? [coverUrl, ...contentImages.filter(url => url !== coverUrl)] 
                : contentImages;

            // Build article data without undefined values
            const articleData = {
                titre: title,
                categorie: selectedCategory || null,
                est_publie: isPublished,
                contenu_json: outputData,
                contenu_html: htmlContent || '<p></p>', // Ensure non-empty
                images: allImages,
                tags: tags.split(',').map(t => t.trim()).filter(Boolean),
                id_auteur: userId,
                temps_lecture: Math.max(1, Math.ceil(wordCount / 238)), // ~238 mots/min en français
            };

            
            let result;
            try {
                if (id) {
                    result = await updateArticle(id, articleData);
                } else {
                    result = await createArticle(articleData);
                }
            } catch (apiError) {
                // Handle axios errors - extract message from response
                console.error('[ArticleEditor] API Error:', apiError);
                const errorMessage = apiError.response?.data?.error 
                    || apiError.response?.data?.message 
                    || apiError.message 
                    || 'Erreur inconnue';
                
                setFeedbackModal({
                    isOpen: true,
                    title: 'Erreur de sauvegarde',
                    message: errorMessage,
                    isError: true,
                    isDanger: true
                });
                return; // Exit early
            }


            if (result.success) {
                setHasUnsavedChanges(false);
                if (forcePublish) setStatus('publie');
                
                // If new article, redirect to edit with the new ID
                if (!id && result.data?.id) {
                    window.history.replaceState(null, '', `/dashboard/auteur/edit/${result.data.id}`);
                }
                
                setFeedbackModal({
                    isOpen: true,
                    title: isPublished ? 'Publication réussie !' : 'Brouillon sauvegardé',
                    message: isPublished ? 'Votre article a été publié et est maintenant visible.' : 'Votre brouillon a été mis à jour.',
                    isError: false,
                    isDanger: false
                });
            } else {
                setFeedbackModal({
                    isOpen: true,
                    title: 'Erreur',
                    message: 'Erreur lors de la sauvegarde: ' + (result.error || 'Inconnue'),
                    isError: true,
                    isDanger: true
                });
            }
        } catch (error) {
            console.error('[ArticleEditor] Critical error:', error);
            setFeedbackModal({
                isOpen: true,
                title: 'Erreur critique',
                message: error.message || 'Une erreur inattendue est survenue',
                isError: true,
                isDanger: true
            });
        } finally {
            setSaving(false);
        }
    };    



const validateArticle = async () => {
    const errors = [];
    if (!title || title.trim().length < 5) errors.push("Le titre est trop court ou manquant.");
    if (!selectedCategory) errors.push("Veuillez sélectionner une catégorie.");
    if (wordCount < 10) errors.push("Le contenu de l'article est trop court.");

    // Optional: Check cover image
    // if (!coverUrl) errors.push("Une image de couverture est recommandée.");

    return errors;
};

const handlePreview = async () => {
    const outputData = await ejInstance.current.save();
    const html = generateHTML(outputData);
    
    setPreviewData({
        titre: title,
        contenu_html: html,
        contenu_json: outputData,
        image_url: coverUrl,
        tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        // Add fake author/date for preview
        est_publie: false
    });
    setShowPreview(true);
};

const handlePublishClick = async () => {
    // 1. Validation
    const errors = await validateArticle();
    if (errors.length > 0) {
        setValidationErrors(errors);
        return;
    }
    setValidationErrors([]); // Clear errors

    // 2. Open Preview with Publish intent
    await handlePreview(); 
    // The PreviewModal will have a "Confirm Publish" button if we pass a flag? 
    // Or we strictly use the Preview to confirm.
};

const handleConfirmPublish = async () => {
    setShowPreview(false);
    setStatus('publie'); // Optimistic update
    // Force save with published status
    // We need to ensure the state is updated or pass it directly.
    // Since setStatus is async, better to modify handleSave to accept status.
    // For now, let's wait a tick or modify handleSave.
    // Actually, handleSave reads 'status' from state. 
    // We can refactor handleSave to accept an argument.
    // OR we can just bypass handleSave and call API directly here, avoiding race conditions.
    // BUT handleSave does heavy lifting (save editor, logic).
    
    // Quick fix: Update state then save? No, closure.
    // Better: Helper function
    await saveInternal(true);
};





    const updateCategory = (slug) => {
        setSelectedCategory(slug);
        setHasUnsavedChanges(true);
    };

    const handleStatusChange = (newStatus) => {
        if (newStatus === 'publie' && status !== 'publie') {
            handlePublishClick();
            return;
        }
        setStatus(newStatus);
        setHasUnsavedChanges(true);
    };

    const updateTags = (newTags) => {
        setTags(newTags);
        setHasUnsavedChanges(true);
    };

    const updateTitle = (newTitle) => {
        setTitle(newTitle);
        setHasUnsavedChanges(true);
    };

    const handleCoverUpload = async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                // Compression
                const options = {
                    maxSizeMB: 1,
                    maxWidthOrHeight: 1920,
                    useWebWorker: true
                };
                
                const compressedFile = await imageCompression(file, options);
                
                // Upload immediately to get URL
                const response = await uploadArticleImage(compressedFile);
                
                if (response.success && response.url) {
                    setCoverUrl(response.url);
                    setHasUnsavedChanges(true);
                } else {
                    setFeedbackModal({
                        isOpen: true,
                        title: 'Erreur upload',
                        message: 'Erreur lors du téléchargement : ' + (response.error || 'Inconnue'),
                        isError: true,
                        isDanger: true
                    });
                }
            } catch (error) {
                console.error('Error uploading cover:', error);
                setFeedbackModal({
                    isOpen: true,
                    title: 'Erreur',
                    message: 'Impossible de traiter l\'image. Vérifiez le format et la taille (max 5MB).',
                    isError: true,
                    isDanger: true
                });
            }
        }
    };

    const selectedCategoryData = categories.find(c => c.slug === selectedCategory);

    if (loading) return <Loader />;

    if (notAllowed) return <NotFound />;

    return (
        <div className="article-editor-page fadeInContainer">
            <div className="editor-sticky-header">
                <div className="editor-header">
                    <div className="editor-header-left">
                        <button className="icon-btn" onClick={() => navigate('/dashboard/auteur')}>
                            <i className="fa-solid fa-arrow-left"></i>
                        </button>
                        
                        <div className="status-indicator">
                            <div className={`status-dot ${status === 'publie' ? 'published' : 'draft'}`}></div>
                            <span className="status-text">
                                {status === 'publie' ? 'Publié' : 'Brouillon'}
                            </span>
                        </div>
                    </div>

                    <div className="editor-actions">
                        <button 
                            onClick={() => setShowSettings(!showSettings)}
                            className="btn btn-secondary"
                        >
                            <i className="fa-solid fa-gear"></i>
                            <span>Paramètres</span>
                        </button>
                        
                        <button 
                             onClick={handlePreview}
                            className="btn btn-secondary"
                        >
                            <i className="fa-regular fa-eye"></i>
                            <span>Aperçu</span>
                        </button>
                        
                        <button 
                            className="btn btn-primary" 
                            onClick={(e) => {
                                // Default default is save draft
                                // But if user wants to publish?
                                saveInternal(false);
                            }}
                            disabled={saving}
                        >
                            {saving ? <span className="spinner"><FontAwesomeIcon icon={faSpinner}/></span> : <i className="fa-solid fa-floppy-disk"></i>}
                            <span>Sauvegarder</span>
                        </button>

                        {status !== 'publie' && (
                             <button 
                                className="btn btn-accent" 
                                onClick={handlePublishClick}
                                disabled={saving}
                            >
                                <i className="fa-solid fa-paper-plane"></i>
                                <span>Publier</span>
                            </button>
                        )}

                    </div>
                </div>
            </div>

            {/* Content Wrapper */}
            <div className="editor-content-wrapper">
                {/* Settings Panel */}
                <div className={`settings-panel ${showSettings ? 'expanded' : 'collapsed'}`}>
                    <div className="settings-card">
                        <h3 className="settings-title">
                            <i className="fa-solid fa-gear"></i>
                            Paramètres de l'article
                        </h3>
                        
                        <div className="settings-grid">
                                <div className="category-selector">
                                    {(showAllCategories ? categories : categories.slice(0, 6)).map(cat => (
                                        <div 
                                            key={cat.id} 
                                            className={`category-chip ${selectedCategory === cat.slug ? 'selected' : ''}`}
                                            onClick={() => updateCategory(cat.slug)}
                                        >
                                            {selectedCategory === cat.slug ? <i className="fa-solid fa-check"></i> : <i className="fa-regular fa-circle"></i>}
                                            {cat.nom}
                                        </div>
                                    ))}
                                    
                                    {categories.length > 6 && (
                                        <div 
                                            className="category-chip"
                                            onClick={() => setShowAllCategories(!showAllCategories)}
                                        >
                                            <i className={`fa-solid ${showAllCategories ? 'fa-minus' : 'fa-plus'}`}></i>
                                            {showAllCategories ? 'Voir moins' : 'Voir plus'}
                                        </div>
                                    )}

                                    <div
                                        className="category-chip request-btn"
                                        onClick={() => navigate('/dashboard/auteur/categories')}
                                        style={{ borderStyle: 'dashed', opacity: 0.8 }}
                                    >
                                        <i className="fa-regular fa-paper-plane"></i>
                                        Demander une catégorie
                                    </div>
                                </div>


                            <div className="form-group" style={{gridColumn: '1 / -1'}}>
                                <label className="form-label">
                                    <i className="fa-solid fa-tags"></i>
                                    Tags (séparés par des virgules)
                                </label>
                                <input
                                    type="text"
                                    value={tags}
                                    onChange={(e) => updateTags(e.target.value)}
                                    placeholder="Art, Peinture, Moderne, Culture..."
                                    className="form-input"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Layout principal */}
                <div className="editor-layout centered">
                    {/* Main Card */}
                    <div className="editor-main-card">
                        {/* Cover Image Zone */}
                        <div 
                            className={`cover-image-zone ${coverUrl ? 'has-image' : ''}`}
                            onClick={() => !coverUrl && coverInputRef.current?.click()}
                            style={coverUrl && coverUrl.startsWith('#') ? { backgroundColor: coverUrl, border: 'none' } : {}}
                        >
                            {coverUrl ? (
                                <>
                                    {!coverUrl.startsWith('#') && <img src={coverUrl} alt={title ? `Couverture de l'article : ${title}` : "Image de couverture de l'article"} />}
                                    <div className="cover-overlay">
                                        <div className="cover-actions">
                                            <button 
                                                className="cover-btn" 
                                                onClick={(e) => { 
                                                    e.stopPropagation(); 
                                                    coverInputRef.current?.click(); 
                                                }}
                                            >
                                                <i className="fa-regular fa-image"></i>
                                                Image
                                            </button>
                                            <label className="cover-btn" onClick={(e) => e.stopPropagation()} style={{ position: 'relative', cursor: 'pointer' }}>
                                                <i className="fa-solid fa-palette"></i> Couleur
                                                <input 
                                                    type="color" 
                                                    value={coverUrl.startsWith('#') ? coverUrl : '#808080'}
                                                    onChange={(e) => {
                                                        setCoverUrl(e.target.value);
                                                        setHasUnsavedChanges(true);
                                                    }}
                                                    style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', top: 0, left: 0, cursor: 'pointer' }}
                                                />
                                            </label>
                                            <button 
                                                className="cover-btn" 
                                                onClick={(e) => { 
                                                    e.stopPropagation(); 
                                                    setCoverUrl(''); 
                                                    setHasUnsavedChanges(true);
                                                }}
                                            >
                                                ✕ Retirer
                                            </button>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="cover-placeholder">
                                    <div className="cover-icon-wrapper">
                                        <i className="fa-regular fa-image fa-2x"></i>
                                    </div>
                                    <p className="cover-text-primary">Ajouter une image de couverture</p>
                                    <p className="cover-text-secondary">Cliquez ou glissez une image (JPG, PNG, max 5MB)</p>
                                    <div className="cover-color-picker" style={{ marginTop: '1rem', position: 'relative', display: 'inline-block' }}>
                                        <button className="btn btn-secondary" onClick={(e) => e.stopPropagation()}>
                                            <i className="fa-solid fa-palette"></i> Ou utiliser une couleur
                                        </button>
                                        <input 
                                            type="color" 
                                            onChange={(e) => {
                                                setCoverUrl(e.target.value);
                                                setHasUnsavedChanges(true);
                                            }}
                                            style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', top: 0, left: 0, cursor: 'pointer' }}
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    </div>
                                </div>
                            )}
                            <input
                                ref={coverInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleCoverUpload}
                                style={{ display: 'none' }}
                            />
                        </div>

                        <div className="title-section">
                            <textarea
                                rows={1}
                                value={title}
                                onChange={(e) => {
                                    updateTitle(e.target.value);
                                    e.target.style.height = 'auto';
                                    e.target.style.height = e.target.scrollHeight + 'px';
                                }}
                                onInput={(e) => {
                                    e.target.style.height = 'auto';
                                    e.target.style.height = e.target.scrollHeight + 'px';
                                }}
                                placeholder="Titre de votre article..."
                                className="editor-title-input"
                                style={{ overflow: 'hidden', resize: 'none' }}
                            />
                        </div>

                        {/* Divider */}
                        <div className="title-divider"></div>

                        {/* Editor */}
                        <div className="editor-container">
                            <div id="editorjs"></div>
                        </div>

                        {/* Stats Footer inside Card */}
                        <div className="editor-stats-footer">
                            <div className="stat-pill">
                                <span className="stat-label">Mots :</span>
                                <span className="stat-value">{wordCount}</span>
                            </div>
                            <div className="stat-div"></div>
                            <div className="stat-pill">
                                <span className="stat-label">Caractères :</span>
                                <span className="stat-value">{charCount}</span>
                            </div>
                            <div className="stat-div"></div>
                            <div className="stat-pill">
                                <span className="stat-label">Temps :</span>
                                <span className="stat-value">{Math.max(1, Math.ceil(wordCount / 238))} min</span>
                            </div>
                            {autoSaveStatus && (
                                <>
                                    <div className="stat-div"></div>
                                    <div className={`autosave-indicator autosave-${autoSaveStatus}`}>
                                        {autoSaveStatus === 'saving' && (
                                            <><span className="autosave-spinner"></span> Sauvegarde…</>
                                        )}
                                        {autoSaveStatus === 'saved' && autoSavedAt && (
                                            <><span className="material-icons autosave-icon" translate="no">cloud_done</span> Sauvegardé à {autoSavedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</>
                                        )}
                                        {autoSaveStatus === 'error' && (
                                            <><span className="material-icons autosave-icon" translate="no">cloud_off</span> Échec de la sauvegarde</>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
                
                {/* Modals & Banners */}
                <PreviewModal 
                    isOpen={showPreview} 
                    onClose={() => setShowPreview(false)}
                    articleData={previewData}
                    onConfirm={handleConfirmPublish}
                    isPublishing={true} // Triggers "Confirm Publish" button in modal
                />

                <ValidationBanner 
                    errors={validationErrors} 
                    onClose={() => setValidationErrors([])} 
                />

                <ConfirmModal 
                    isOpen={feedbackModal.isOpen}
                    onClose={() => setFeedbackModal({ ...feedbackModal, isOpen: false })}
                    onConfirm={() => setFeedbackModal({ ...feedbackModal, isOpen: false })}
                    title={feedbackModal.title}
                    message={feedbackModal.message}
                    isDanger={feedbackModal.isDanger}
                    showCancel={false} // Alert mode (only OK button)
                    confirmText="OK"
                />
            </div>
        </div>
    );
};

export default ArticleEditor;