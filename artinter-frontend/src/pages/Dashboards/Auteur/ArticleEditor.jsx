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
    const titleRef = useRef(null);
    
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
    const statusRef = useRef('brouillon'); // ref pour accéder au status courant dans les closures
    const isPublishedRef = useRef(false); // état de publication au chargement, pour initEditor

    // Protection article publié
    const [editConfirmed, setEditConfirmed] = useState(false);
    const [showEditConfirmModal, setShowEditConfirmModal] = useState(false);

    // UI State
    const [showSettings, setShowSettings] = useState(false);
    const [showQuickMenu, setShowQuickMenu] = useState(false);
    const [showAllCategories, setShowAllCategories] = useState(false);
    const [wordCount, setWordCount] = useState(0);
    const [charCount, setCharCount] = useState(0);

    const [showPreview, setShowPreview] = useState(false);
    const [validationErrors, setValidationErrors] = useState([]);
    const [feedbackModal, setFeedbackModal] = useState({ isOpen: false, title: '', message: '', isError: false });
    const [previewData, setPreviewData] = useState(null);

    useEffect(() => { statusRef.current = status; }, [status]);

    useEffect(() => {
        if (titleRef.current) {
            titleRef.current.style.height = 'auto';
            titleRef.current.style.height = titleRef.current.scrollHeight + 'px';
        }
    }, [title]);

    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (hasUnsavedChanges) {
                e.preventDefault();
                e.returnValue = '';
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [hasUnsavedChanges]);

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
                if (!outputData?.blocks) { setAutoSaveStatus('error'); return; }
                const htmlContent = generateHTML(outputData);
                const contentImages = outputData.blocks
                    .filter(b => b.type === 'image')
                    .map(b => b.data.file?.url || b.data.url);
                const allImages = coverUrl
                    ? [coverUrl, ...contentImages.filter(u => u !== coverUrl)]
                    : contentImages;

                const articleData = {
                    titre:        title,
                    categorie:    selectedCategory || null,
                    est_publie:   statusRef.current === 'publie',
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
                const { data: user } = await getCurrentUser();
                if (!user) {
                    navigate('/login');
                    return;
                }
                setUserId(user.id);

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
                    isPublishedRef.current = !!article.est_publie;
                    setEditConfirmed(false);
                    setTags(article.tags ? article.tags.join(', ') : '');

                    if (article.contenu_json) {
                        initialData = article.contenu_json;
                    } else {
                        console.warn("No JSON content found, starting fresh.");
                    }
                } else {
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
                
                editorDataRef.current = initialData;

            } catch (error) {
                console.error('Error init:', error);
            } finally {
                setLoading(false);
                setTimeout(() => setHasUnsavedChanges(false), 500);
            }
        };

        init();

    }, [id, navigate]);

    useEffect(() => {
        if (!loading && !ejInstance.current) {
            initEditor(editorDataRef.current);
        }

        return () => {
            if (ejInstance.current && ejInstance.current.destroy && !loading) {
                ejInstance.current.destroy();
                ejInstance.current = null;
            }
        };
    }, [loading]);

    const initEditor = (data) => {
        const editor = new EditorJS({
            holder: 'editorjs',
            logLevel: 'ERROR',
            data: data,
            readOnly: isPublishedRef.current,
            onReady: () => {
                ejInstance.current = editor;
            },
            onChange: async () => {
                setHasUnsavedChanges(true);
                const outputData = await ejInstance.current.save();
                if (!outputData?.blocks) return;
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

    const saveInternal = async (forcePublish = false) => {
        setSaving(true);
        try {
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
            if (!outputData?.blocks) throw new Error('Éditeur non prêt, veuillez réessayer.');
            const htmlContent = generateHTML(outputData);

            const isPublished = forcePublish || status === 'publie';

            const contentImages = outputData.blocks
                .filter(block => block.type === 'image')
                .map(block => block.data.file?.url || block.data.url);

            const allImages = coverUrl
                ? [coverUrl, ...contentImages.filter(url => url !== coverUrl)]
                : contentImages;

            const articleData = {
                titre: title,
                categorie: selectedCategory || null,
                est_publie: isPublished,
                contenu_json: outputData,
                contenu_html: htmlContent || '<p></p>',
                images: allImages,
                tags: tags.split(',').map(t => t.trim()).filter(Boolean),
                id_auteur: userId,
                temps_lecture: Math.max(1, Math.ceil(wordCount / 238)),
            };

            
            let result;
            try {
                if (id) {
                    result = await updateArticle(id, articleData);
                } else {
                    result = await createArticle(articleData);
                }
            } catch (apiError) {
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
    if (!title || title.trim().length === 0) errors.push("Le titre est manquant.");
    if (!selectedCategory) errors.push("Veuillez sélectionner une catégorie.");
    if (wordCount < 1) errors.push("Le contenu de l'article est vide.");

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
    const errors = await validateArticle();
    if (errors.length > 0) {
        setValidationErrors(errors);
        return;
    }
    setValidationErrors([]);
    await handlePreview();
};

const handleConfirmPublish = async () => {
    setShowPreview(false);
    await saveInternal(true);
};





    const requestEdit = () => {
        if (status === 'publie' && !editConfirmed) {
            setShowEditConfirmModal(true);
            return false;
        }
        return true;
    };

    const handleConfirmEdit = async () => {
        setShowEditConfirmModal(false);
        setStatus('brouillon');
        setEditConfirmed(true);
        if (ejInstance.current) await ejInstance.current.readOnly.toggle();
        await saveInternal(false);
    };

    const handleUnpublish = async () => {
        setStatus('brouillon');
        setEditConfirmed(true);
        if (ejInstance.current) await ejInstance.current.readOnly.toggle();
        await saveInternal(false);
    };

    const updateCategory = (id) => {
        if (!requestEdit()) return;
        setSelectedCategory(id);
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
        if (!requestEdit()) return;
        setTags(newTags);
        setHasUnsavedChanges(true);
    };

    const updateTitle = (newTitle) => {
        if (!requestEdit()) return;
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

    const selectedCategoryData = categories.find(c => c.id === selectedCategory);

    if (loading) return <Loader />;

    if (notAllowed) return <NotFound />;

    return (
        <div className="article-editor-page fadeInContainer">

            {showPreview && previewData && (
                <PreviewModal
                    articleData={previewData}
                    onClose={() => setShowPreview(false)}
                    onConfirm={handleConfirmPublish}
                    isPublishing={true}
                />
            )}

            <div style={{ display: showPreview ? 'none' : undefined }}>
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
                            onClick={() => saveInternal(false)}
                            disabled={saving}
                        >
                            {saving ? <span className="spinner"><FontAwesomeIcon icon={faSpinner}/></span> : <i className="fa-solid fa-floppy-disk"></i>}
                            <span>Sauvegarder</span>
                        </button>

                        {status === 'publie' ? (
                            <button
                                className="btn btn-secondary"
                                onClick={handleUnpublish}
                                disabled={saving}
                            >
                                <i className="fa-solid fa-eye-slash"></i>
                                <span>Dépublier</span>
                            </button>
                        ) : (
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
                                            className={`category-chip ${selectedCategory === cat.id ? 'selected' : ''}`}
                                            onClick={() => updateCategory(cat.id)}
                                        >
                                            {selectedCategory === cat.id ? <i className="fa-solid fa-check"></i> : <i className="fa-regular fa-circle"></i>}
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
                            style={{ ...(coverUrl && coverUrl.startsWith('#') ? { backgroundColor: coverUrl, border: 'none' } : {}), position: 'relative' }}
                        >
                            {status === 'publie' && !editConfirmed && (
                                <div
                                    style={{ position: 'absolute', inset: 0, zIndex: 5, cursor: 'pointer' }}
                                    onClick={(e) => { e.stopPropagation(); setShowEditConfirmModal(true); }}
                                />
                            )}
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
                                ref={titleRef}
                                placeholder="Titre de votre article..."
                                className="editor-title-input"
                                readOnly={status === 'publie' && !editConfirmed}
                                onClick={() => { if (status === 'publie' && !editConfirmed) setShowEditConfirmModal(true); }}
                                style={{ overflow: 'hidden', resize: 'none' }}
                            />
                        </div>

                        {/* Divider */}
                        <div className="title-divider"></div>

                        {/* Editor */}
                        <div className="editor-container" style={{ position: 'relative' }}>
                            <div id="editorjs"></div>
                            {status === 'publie' && !editConfirmed && (
                                <div
                                    style={{ position: 'absolute', inset: 0, zIndex: 5, cursor: 'text' }}
                                    onClick={() => setShowEditConfirmModal(true)}
                                />
                            )}
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
                
                <ConfirmModal
                    isOpen={showEditConfirmModal}
                    onClose={() => setShowEditConfirmModal(false)}
                    onConfirm={handleConfirmEdit}
                    title="Modifier l'article publié ?"
                    message="Cet article est actuellement publié. Le modifier le repassera en brouillon jusqu'à ce que vous le republiiez."
                    confirmText="Modifier quand même"
                    isDanger={false}
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
        </div>
    );
};

export default ArticleEditor;