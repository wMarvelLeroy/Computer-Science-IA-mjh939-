import React from 'react';
import DOMPurify from 'dompurify';
import { useNavigate, useParams, Link } from 'react-router-dom';
import './Article.css';
import { getArticleBySlug, getSimilarArticles } from '../../Services/articlesService.js';
import SimilarArticlesSection from '../../components/ArticleCard/SimilarArticleCard.jsx';
import Loader from '../../components/Loader/Loader.jsx';
import {
  checkSignalement, createSignalement, isAuthenticated,
  restrictArticleAdmin, deleteArticleAdmin,
  getCommentaires, addCommentaire, updateCommentaire, deleteCommentaire,
  modererCommentaire, signalerCommentaire,
  getLikes, likeArticle, unlikeArticle,
  checkIsFollowing, followUser, unfollowUser, getFollowers,
} from '../../api/api.js';
import UserAvatar from '../../components/UserAvatar/UserAvatar.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';
import Portal from '../../components/Modal/Portal.jsx';
import ConfirmModal from '../../components/Modal/ConfirmModal.jsx';
import PageMeta from '../../components/PageMeta/PageMeta.jsx';

const Article = () => {
  const navigate = useNavigate();
  const { slug } = useParams();
  const { user } = useAuth();
  const [article, setArticle] = React.useState(null);
  const [similarArticles, setSimilarArticles] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState(false);
  const [retryCount, setRetryCount] = React.useState(0);
  const [copied, setCopied] = React.useState(false);


  // Modération admin
  const [modConfirm, setModConfirm]     = React.useState(null); // { action: 'restrict'|'delete' }
  const [modLoading, setModLoading]     = React.useState(false);
  const [modDone, setModDone]           = React.useState(null); // 'restricted'|'deleted'

  // Signalement
  const [signalModal, setSignalModal]   = React.useState(false);
  const [dejaSignale, setDejaSignale]   = React.useState(false);
  const [signalRaison, setSignalRaison] = React.useState('contenu_inapproprie');
  const [signalDesc, setSignalDesc]     = React.useState('');
  const [signalLoading, setSignalLoading] = React.useState(false);
  const [signalSuccess, setSignalSuccess] = React.useState(false);

  // Likes
  const [likesCount,  setLikesCount]  = React.useState(0);
  const [isLiked,     setIsLiked]     = React.useState(false);
  const [likeLoading, setLikeLoading] = React.useState(false);
  const cachedLikesRef = React.useRef([]);

  // Commentaires
  const [commentaires,    setCommentaires]    = React.useState([]);
  const [commentInput,    setCommentInput]    = React.useState('');
  const [commentLoading,  setCommentLoading]  = React.useState(false);
  const [commentError,    setCommentError]    = React.useState('');
  const [editingId,       setEditingId]       = React.useState(null);
  const [editingContenu,  setEditingContenu]  = React.useState('');
  const [replyingTo,      setReplyingTo]      = React.useState(null); // id du parent
  const [replyInput,      setReplyInput]      = React.useState('');
  const [replyLoading,    setReplyLoading]    = React.useState(false);
  const [replyError,      setReplyError]      = React.useState('');
  const [expandedReplies, setExpandedReplies] = React.useState({}); // { parentId: count affiché }

  // Modération commentaire (admin)
  const [commentModerModal,   setCommentModerModal]   = React.useState(null); // { comment }
  const [commentModerAction,  setCommentModerAction]  = React.useState('supprimer');
  const [commentModerMotif,   setCommentModerMotif]   = React.useState('');
  const [commentModerLoading, setCommentModerLoading] = React.useState(false);

  // Signalement commentaire
  const [signaledComments,     setSignaledComments]     = React.useState(new Set());
  const [signalCommentModal,   setSignalCommentModal]   = React.useState(null); // { comment }
  const [signalCommentRaison,  setSignalCommentRaison]  = React.useState('contenu_inapproprie');
  const [signalCommentLoading, setSignalCommentLoading] = React.useState(false);
  const [signalCommentSuccess, setSignalCommentSuccess] = React.useState(false);

  // Follow auteur
  const [isFollowingAuthor,  setIsFollowingAuthor]  = React.useState(false);
  const [followLoading,      setFollowLoading]      = React.useState(false);
  const [authorFollowers,    setAuthorFollowers]     = React.useState(0);
  const [showUnfollowModal,  setShowUnfollowModal]  = React.useState(false);

  // Overlay login
  const [loginOverlay, setLoginOverlay] = React.useState(false);

  const currentUser = React.useMemo(() => {
    try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; }
  }, []);

  const role = user?.profil?.role;
  const isAdminRole = ['admin', 'super_admin'].includes(role);
  const isSuperAdminRole = role === 'super_admin';

  React.useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setLoadError(false);
      try {
        const fetchedArticle = await getArticleBySlug(slug);
        setArticle(fetchedArticle);

        if (fetchedArticle) {
          const similar = await getSimilarArticles(fetchedArticle.id, fetchedArticle.category);
          setSimilarArticles(similar);

          // Vérifier si l'user a déjà signalé cet article
          if (isAuthenticated()) {
            const { data: signal } = await checkSignalement(fetchedArticle.id);
            if (signal) setDejaSignale(true);
          }

          // Charger likes, commentaires, abonnés en parallèle
          const [commentsRes, likesRes, followersRes] = await Promise.allSettled([
            getCommentaires(fetchedArticle.id),
            getLikes(fetchedArticle.id),
            getFollowers(fetchedArticle.authorId),
          ]);

          if (commentsRes.status === 'fulfilled') setCommentaires(commentsRes.value?.data || []);
          if (likesRes.status === 'fulfilled') {
            const likesData = likesRes.value?.data || [];
            cachedLikesRef.current = likesData;
            setLikesCount(likesData.length);
            if (user?.id) setIsLiked(likesData.some(l => l.user_id === user.id));
          }
          if (followersRes.status === 'fulfilled') setAuthorFollowers((followersRes.value?.data || []).length);

          // Vérifier si l'utilisateur connecté suit l'auteur
          if (user?.id && fetchedArticle.authorId && user.id !== fetchedArticle.authorId) {
            try {
              const res = await checkIsFollowing(user.id, fetchedArticle.authorId);
              setIsFollowingAuthor(res?.data?.isFollowing ?? false);
            } catch { /* ignore */ }
          }
        }
      } catch (error) {
        console.error("Erreur chargement article:", error);
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    };

    if (slug) {
      loadData();
    }
  }, [slug, retryCount, user?.id]);

  // Si l'utilisateur arrive après le chargement de l'article (auth async),
  // recompute isLiked sans refaire d'appel API
  React.useEffect(() => {
    if (!user?.id) return;
    setIsLiked(cachedLikesRef.current.some(l => l.user_id === user.id));
  }, [user?.id]);

  React.useEffect(() => {
    if (loading || !article) return;

    const handleImageClick = (e) => {
        const src = e.target.src;
        if (src) {
            openLightbox(src);
        }
    };

    const timer = setTimeout(() => {
        const images = document.querySelectorAll('.article-content img');
        images.forEach(img => {
            img.style.cursor = 'zoom-in';
            img.addEventListener('click', handleImageClick);
        });
    }, 500);

    return () => {
        clearTimeout(timer);
        const images = document.querySelectorAll('.article-content img');
        images.forEach(img => img.removeEventListener('click', handleImageClick));
    };
  }, [article, loading]);

  const openLightbox = (url) => {
      const lightbox = document.createElement('div');
      lightbox.className = 'reader-lightbox';
      lightbox.style.cssText = `
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.95);
          z-index: 10000;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: zoom-out;
          opacity: 0;
          transition: opacity 0.3s ease;
      `;
      
      const img = document.createElement('img');
      img.src = url;
      img.style.cssText = `
          max-width: 95%;
          max-height: 95%;
          border-radius: 4px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.5);
          transform: scale(0.95);
          transition: transform 0.3s ease;
      `;
      
      lightbox.appendChild(img);
      document.body.appendChild(lightbox);
      
      requestAnimationFrame(() => {
          lightbox.style.opacity = '1';
          img.style.transform = 'scale(1)';
      });

      const close = () => {
          lightbox.style.opacity = '0';
          img.style.transform = 'scale(0.95)';
          setTimeout(() => lightbox.remove(), 300);
      };

      lightbox.addEventListener('click', close);
  };

  if (loading || loadError) {
    return (
      <Loader
        error={loadError ? "Impossible de charger l'article." : null}
        onRetry={() => { setLoading(true); setLoadError(false); setRetryCount(c => c + 1); }}
      />
    );
  }

  if (!article) {
    return (
      <div style={{ padding: "60px 20px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
        <span className="material-icons" translate="no" style={{ fontSize: "4rem", color: "var(--color-text-placeholder)" }}>article</span>
        <h2 style={{ color: "var(--color-text-primary)" }}>Article introuvable</h2>
        <p style={{ color: "var(--color-text-placeholder)" }}>Cet article n'existe pas ou a été supprimé.</p>
        <button onClick={() => navigate('/Catalog')} style={{ marginTop: "8px", background: "var(--color-accent)", color: "#fff", border: "none", borderRadius: "8px", padding: "10px 24px", cursor: "pointer", fontWeight: 600 }}>
          Retour aux articles
        </button>
      </div>
    );
  }

  // const similarArticles = getSimilarArticles(id, article.category); // Deplaced to effect

  const handleShare = (platform) => {
    const url = encodeURIComponent(window.location.href);
    const title = encodeURIComponent(article.title);
    const links = {
      twitter: `https://twitter.com/intent/tweet?url=${url}&text=${title}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${url}`,
    };
    if (links[platform]) {
      window.open(links[platform], '_blank', 'noopener,noreferrer,width=600,height=400');
    }
  };

  const handleSignaler = async () => {
    if (!article) return;
    setSignalLoading(true);
    try {
      await createSignalement(article.id, signalRaison, signalDesc || null);
      setDejaSignale(true);
      setSignalSuccess(true);
      setTimeout(() => { setSignalModal(false); setSignalSuccess(false); }, 2000);
    } catch (err) {
      if (err.response?.status === 409) setDejaSignale(true);
    } finally {
      setSignalLoading(false);
    }
  };

  const handleModAction = async () => {
    if (!modConfirm || !article) return;
    setModLoading(true);
    try {
      if (modConfirm.action === 'restrict') {
        await restrictArticleAdmin(article.id);
        setModDone('restricted');
        setArticle(prev => ({ ...prev, published: false }));
      } else if (modConfirm.action === 'delete') {
        await deleteArticleAdmin(article.id);
        setModDone('deleted');
      }
    } catch {
      // ignore — le toast global n'est pas disponible ici, l'action sera visible visuellement
    } finally {
      setModLoading(false);
      setModConfirm(null);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleLike = async () => {
    if (!user) { setLoginOverlay(true); return; }
    if (likeLoading) return;
    setLikeLoading(true);
    try {
      if (isLiked) {
        await unlikeArticle(article.id, user.id);
        setIsLiked(false);
        setLikesCount(c => c - 1);
      } else {
        await likeArticle(article.id, user.id);
        setIsLiked(true);
        setLikesCount(c => c + 1);
      }
    } catch { /* ignore */ } finally { setLikeLoading(false); }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!commentInput.trim() || !user || commentLoading) return;
    setCommentLoading(true);
    setCommentError('');
    try {
      const res = await addCommentaire(article.id, commentInput.trim(), null);
      if (res.success) {
        setCommentaires(prev => [...prev, res.data]);
        setCommentInput('');
      }
    } catch (err) {
      setCommentError(err.response?.data?.error || 'Erreur lors de l\'envoi.');
    } finally { setCommentLoading(false); }
  };

  const handleAddReply = async (e, parentId) => {
    e.preventDefault();
    if (!replyInput.trim() || !user || replyLoading) return;
    setReplyLoading(true);
    setReplyError('');
    try {
      const res = await addCommentaire(article.id, replyInput.trim(), parentId);
      if (res.success) {
        setCommentaires(prev => [...prev, res.data]);
        setReplyInput('');
        setReplyingTo(null);
        // Auto-expand pour voir la nouvelle réponse
        setExpandedReplies(prev => ({ ...prev, [parentId]: (prev[parentId] || 10) + 1 }));
      }
    } catch (err) {
      setReplyError(err.response?.data?.error || 'Erreur lors de l\'envoi.');
    } finally { setReplyLoading(false); }
  };

  const handleDeleteComment = async (id) => {
    try {
      await deleteCommentaire(id);
      setCommentaires(prev => prev.filter(c => c.id !== id && c.parent_id !== id));
    } catch { /* ignore */ }
  };

  const handleEditSave = async (id) => {
    if (!editingContenu.trim()) return;
    try {
      const res = await updateCommentaire(id, editingContenu.trim());
      if (res.success) {
        setCommentaires(prev => prev.map(c => c.id === id ? { ...c, contenu: editingContenu.trim(), modifie: true } : c));
      }
      setEditingId(null);
      setEditingContenu('');
    } catch { /* ignore */ }
  };

  const handleCommentModer = async () => {
    if (!commentModerModal) return;
    setCommentModerLoading(true);
    try {
      await modererCommentaire(commentModerModal.comment.id, commentModerAction, commentModerMotif);
      if (commentModerAction === 'supprimer') {
        setCommentaires(prev => prev.filter(c => c.id !== commentModerModal.comment.id && c.parent_id !== commentModerModal.comment.id));
      } else if (commentModerAction === 'restreindre') {
        setCommentaires(prev => prev.map(c => c.id === commentModerModal.comment.id ? { ...c, restreint: true } : c));
      }
      setCommentModerModal(null);
      setCommentModerMotif('');
    } catch { /* ignore */ } finally { setCommentModerLoading(false); }
  };

  const handleSignalerComment = async () => {
    if (!signalCommentModal) return;
    setSignalCommentLoading(true);
    try {
      await signalerCommentaire(signalCommentModal.id, signalCommentRaison);
      setSignaledComments(prev => new Set([...prev, signalCommentModal.id]));
      setSignalCommentSuccess(true);
      setTimeout(() => {
        setSignalCommentModal(null);
        setSignalCommentSuccess(false);
        setSignalCommentRaison('contenu_inapproprie');
      }, 1500);
    } catch { /* ignore */ } finally { setSignalCommentLoading(false); }
  };

  const handleFollowAuthor = async () => {
    if (!user) { setLoginOverlay(true); return; }
    if (followLoading) return;
    if (isFollowingAuthor) { setShowUnfollowModal(true); return; }
    setFollowLoading(true);
    try {
      await followUser(article.authorId);
      setIsFollowingAuthor(true);
      setAuthorFollowers(c => c + 1);
    } catch { /* ignore */ } finally { setFollowLoading(false); }
  };

  const handleUnfollowAuthor = async () => {
    setFollowLoading(true);
    try {
      await unfollowUser(article.authorId);
      setIsFollowingAuthor(false);
      setAuthorFollowers(c => c - 1);
    } catch { /* ignore */ } finally { setFollowLoading(false); }
  };

  const metaDesc = article.description
    ? article.description.replace(/<[^>]+>/g, '').slice(0, 160)
    : '';
  const metaImage = article.image && !article.image.startsWith('#') ? article.image : undefined;

  return (
    <>
    <PageMeta
      title={article.title}
      description={metaDesc}
      image={metaImage}
      url={`${window.location.origin}/article/${article.slug}`}
      type="article"
      author={article.author?.name}
      publishedAt={article.date}
    />
    <div className="article-page fadeInContainer">

      <button className="back-button" onClick={() => navigate('/Catalog')}>
        <span className="material-icons" translate="no">arrow_back</span>
        Retour aux articles
      </button>

      {/* BARRE MODÉRATION — visible admins uniquement */}
      {isAdminRole && (
        <div className="article-mod-bar">
          <div className="article-mod-bar-left">
            <span className="material-icons">admin_panel_settings</span>
            <span>Mode modération</span>
            {modDone === 'restricted' && <span className="mod-status-tag restricted">Article dépublié</span>}
            {modDone === 'deleted'    && <span className="mod-status-tag deleted">Article supprimé</span>}
          </div>
          <div className="article-mod-bar-actions">
            {!modDone && article.published !== false && (
              <button
                className="mod-btn restrict"
                onClick={() => setModConfirm({ action: 'restrict' })}
                title="Dépublier l'article"
              >
                <span className="material-icons">visibility_off</span>
                Dépublier
              </button>
            )}
            {!modDone && isSuperAdminRole && (
              <button
                className="mod-btn delete"
                onClick={() => setModConfirm({ action: 'delete' })}
                title="Supprimer l'article"
              >
                <span className="material-icons">delete</span>
                Supprimer
              </button>
            )}
            {modDone === 'deleted' && (
              <button className="mod-btn" onClick={() => navigate('/dashboard/admin/articles')}>
                <span className="material-icons">arrow_back</span>
                Retour aux articles
              </button>
            )}
          </div>
        </div>
      )}

      <article className="article-container">

        {/* HEADER */}
        <header className="article-header">

          {article.category && (
            <Link
              to={article.categorySlug ? `/Catalog?categorie=${article.categorySlug}` : '/Catalog'}
              className="article-category-badge"
            >
              <span className="material-icons" translate="no">label</span>
              {article.category}
            </Link>
          )}

          <h1 className="article-title">{article.title}</h1>

          <div className="article-meta">
            <button
              className="author-info author-info-clickable"
              onClick={() => article.authorId && navigate(`/profil/${article.authorId}`)}
              title="Voir le profil de l'auteur"
            >
              {article.author?.avatar ? (
                <img src={article.author.avatar} alt={article.author.name} className="author-avatar" />
              ) : (
                <div className="author-avatar-placeholder">
                  <span className="material-icons" translate="no">person</span>
                </div>
              )}
              <div className="author-details">
                <span className="author-name">{article.author?.name || 'Auteur inconnu'}</span>
                {article.author?.bio && <span className="author-bio">{article.author.bio}</span>}
              </div>
            </button>

            {/* Bouton suivre l'auteur — si ce n'est pas son propre article */}
            {article.authorId && (!user || user.id !== article.authorId) && (
              <button
                className={`article-follow-btn ${isFollowingAuthor ? 'following' : ''}`}
                onClick={handleFollowAuthor}
                disabled={followLoading}
              >
                <span className="material-icons">
                  {isFollowingAuthor ? 'how_to_reg' : 'person_add'}
                </span>
                {isFollowingAuthor ? 'Abonné' : 'Suivre'}
              </button>
            )}

            <div className="article-date-info">
              <span className="publish-date">
                <span className="material-icons" translate="no">calendar_today</span>
                {new Date(article.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
              {article.updatedDate && (new Date(article.updatedDate) - new Date(article.date) > 60000) && (
                <span className="publish-date" style={{ fontStyle: 'italic', opacity: 0.8 }}>
                  <span className="material-icons" translate="no">edit</span>
                  Modifié le {new Date(article.updatedDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
              )}
              <span className="read-time">
                <span className="material-icons" translate="no">schedule</span>
                {(() => {
                  if (article.readTime) return `${article.readTime} min de lecture`;
                  // Fallback : calcule le temps à la volée si absent de la base de données
                  const text = (article.content || '').replace(/<[^>]+>/g, ' ');
                  const words = text.split(/\s+/).filter(Boolean).length;
                  return `${Math.max(1, Math.ceil(words / 238))} min de lecture`; // 238 mots/min
                })()}
              </span>
            </div>
          </div>
        </header>

        {/* IMAGE PRINCIPALE */}
        {article.image && (
        <div className="article-image-container">
          {article.image.startsWith('#') ? (
              <div className="article-main-image" style={{ backgroundColor: article.image, minHeight: '400px', width: '100%', borderRadius: '12px' }}></div>
          ) : (
              <img src={article.image} alt={article.title} className="article-main-image" />
          )}
        </div>
        )}

        {/* CONTENU HTML */}
        <div className="article-content" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(article.content) }} />

        {/* TAGS */}
        {article.tags && article.tags.length > 0 && (
          <div className="article-tags">
            <span className="article-tags-label">
              <span className="material-icons" translate="no">local_offer</span>
              Tags :
            </span>
            {article.tags.map((tag, index) => (
              <span key={index} className="article-tag">#{tag}</span>
            ))}
          </div>
        )}

        {/* LIKES */}
        <div className="article-likes">
          <button
            className={`article-like-btn ${isLiked ? 'liked' : ''}`}
            onClick={handleLike}
            disabled={likeLoading}
          >
            <span className="material-icons">{isLiked ? 'favorite' : 'favorite_border'}</span>
            {isLiked ? 'Vous aimez cet article' : "J'aime cet article"}
          </button>
          {likesCount > 0 && (
            <p className="article-likes-count">
              {likesCount} personne{likesCount > 1 ? 's aiment' : ' aime'} cet article
            </p>
          )}
        </div>

        {/* PARTAGE */}
        <div className="article-share">
          <div className="article-share-header">
            <span className="material-icons" translate="no">share</span>
            <h3>Partager cet article</h3>
          </div>
          <div className="share-buttons">
            <button className="share-btn twitter" onClick={() => handleShare('twitter')}>
              <span className="material-icons" translate="no">alternate_email</span>
              Twitter
            </button>
            <button className="share-btn facebook" onClick={() => handleShare('facebook')}>
              <span className="material-icons" translate="no">thumb_up</span>
              Facebook
            </button>
            <button className="share-btn linkedin" onClick={() => handleShare('linkedin')}>
              <span className="material-icons" translate="no">work</span>
              LinkedIn
            </button>
            <button className={`share-btn copy${copied ? ' copied' : ''}`} onClick={handleCopyLink}>
              <span className="material-icons" translate="no">{copied ? 'check' : 'link'}</span>
              {copied ? 'Lien copié !' : 'Copier le lien'}
            </button>
          </div>
        </div>

      </article>

      {/* BOUTON SIGNALER — visible pour les lecteurs connectés (pas l'auteur) */}
      {isAuthenticated() && currentUser && currentUser.id !== article.authorId && (
        <div className="article-report-wrap">
          {dejaSignale ? (
            <span className="article-report-done">
              <span className="material-icons" translate="no">check_circle</span>
              Article déjà signalé — merci pour votre vigilance
            </span>
          ) : (
            <button className="article-report-btn" onClick={() => setSignalModal(true)}>
              <span className="material-icons" translate="no">flag</span>
              Signaler cet article
            </button>
          )}
        </div>
      )}

      {/* CARTE AUTEUR */}
      {article.authorId && (
        <div className="article-author-card">
          <div className="aac-left">
            <button
              className="aac-avatar"
              onClick={() => navigate(`/profil/${article.authorId}`)}
              title="Voir le profil"
            >
              {article.author?.avatar
                ? <img src={article.author.avatar} alt={article.author.name} />
                : <span className="material-icons">person</span>
              }
            </button>
            <div className="aac-info">
              <button className="aac-name" onClick={() => navigate(`/profil/${article.authorId}`)}>
                {article.author?.name || 'Auteur inconnu'}
              </button>
              {article.author?.bio && (
                <p className="aac-bio">
                  {article.author.bio.length > 120
                    ? article.author.bio.slice(0, 120) + '…'
                    : article.author.bio}
                </p>
              )}
              <span className="aac-followers">
                <span className="material-icons">people</span>
                {authorFollowers} abonné{authorFollowers !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {(!user || user.id !== article.authorId) && (
            <button
              className={`aac-follow-btn ${isFollowingAuthor ? 'following' : ''}`}
              onClick={handleFollowAuthor}
              disabled={followLoading}
            >
              <span className="material-icons">
                {isFollowingAuthor ? 'how_to_reg' : 'person_add'}
              </span>
              {isFollowingAuthor ? 'Abonné' : 'Suivre'}
            </button>
          )}
        </div>
      )}

      {/* COMMENTAIRES */}
      {(() => {
        const REPLIES_PAGE = 10;

        const hasAuthorReply = (parentId) =>
          commentaires.some(c => c.parent_id === parentId && c.user_id === article.authorId);

        // réponse auteur en premier
        const parentComments = commentaires
          .filter(c => !c.parent_id)
          .sort((a, b) => {
            const aHas = hasAuthorReply(a.id);
            const bHas = hasAuthorReply(b.id);
            if (aHas && !bHas) return -1;
            if (!aHas && bHas) return 1;
            return new Date(b.created_at) - new Date(a.created_at); // décroissant dans chaque groupe
          });

        const getReplies = (parentId) => {
          const all = commentaires.filter(c => c.parent_id === parentId);
          // Réponse de l'auteur en premier, puis ordre croissant (plus ancien au plus nouveau)
          return all.sort((a, b) => {
            const aIsAuthor = a.user_id === article.authorId;
            const bIsAuthor = b.user_id === article.authorId;
            if (aIsAuthor && !bIsAuthor) return -1;
            if (!aIsAuthor && bIsAuthor) return 1;
            return new Date(a.created_at) - new Date(b.created_at);
          });
        };

        const AvatarBubble = ({ profil, size = 36 }) => (
          <UserAvatar profil={profil} size={size} className="aci-avatar" />
        );

        const CommentActions = ({ c, isEditing }) => (
          <>
            {!isEditing && user && !c.restreint && (
              <div className="aci-actions">
                {/* Répondre — tout le monde connecté, sauf sur les réponses */}
                {!c.parent_id && (
                  <button className="aci-btn" onClick={() => {
                    setReplyingTo(replyingTo === c.id ? null : c.id);
                    setReplyInput('');
                    setReplyError('');
                  }}>
                    <span className="material-icons">reply</span> Répondre
                  </button>
                )}
                {/* Modifier — propriétaire uniquement */}
                {user.id === c.user_id && (
                  <button className="aci-btn" onClick={() => { setEditingId(c.id); setEditingContenu(c.contenu); }}>
                    <span className="material-icons">edit</span> Modifier
                  </button>
                )}
                {/* Supprimer — propriétaire uniquement */}
                {user.id === c.user_id && (
                  <button className="aci-btn aci-btn-delete" onClick={() => handleDeleteComment(c.id)}>
                    <span className="material-icons">delete</span> Supprimer
                  </button>
                )}
                {/* Modérer — admin/super_admin, pas le propriétaire */}
                {isAdminRole && user.id !== c.user_id && (
                  <button className="aci-btn aci-btn-mod" onClick={() => {
                    setCommentModerModal({ comment: c });
                    setCommentModerAction('supprimer');
                    setCommentModerMotif('');
                  }}>
                    <span className="material-icons">admin_panel_settings</span> Modérer
                  </button>
                )}
                {/* Signaler — connecté, pas propriétaire, pas admin : icône seule */}
                {!isAdminRole && user.id !== c.user_id && (
                  signaledComments.has(c.id) ? (
                    <span className="aci-signaled" title="Commentaire signalé">
                      <span className="material-icons">flag</span>
                    </span>
                  ) : (
                    <button
                      className="aci-btn-icon aci-btn-signal"
                      title="Signaler ce commentaire"
                      onClick={() => {
                        setSignalCommentModal(c);
                        setSignalCommentRaison('contenu_inapproprie');
                        setSignalCommentSuccess(false);
                      }}
                    >
                      <span className="material-icons">flag</span>
                    </button>
                  )
                )}
              </div>
            )}
          </>
        );

        const CommentBody = ({ c }) => {
          const isEditing = editingId === c.id;
          const isArticleAuthor = c.user_id === article.authorId;

          if (c.restreint && !isAdminRole) {
            return (
              <div className="aci-body aci-restricted">
                <p className="aci-restricted-text">
                  <span className="material-icons">gavel</span>
                  Commentaire modéré par l'administration
                </p>
              </div>
            );
          }

          return (
            <div className={`aci-body${c.restreint ? ' aci-restricted-admin' : ''}`}>
              <div className="aci-header">
                <span className="aci-name">{c.profils?.nom || 'Utilisateur'}</span>
                {isArticleAuthor && (
                  <span className="aci-author-badge">
                    <span className="material-icons">edit_note</span> Auteur
                  </span>
                )}
                {c.restreint && isAdminRole && (
                  <span className="aci-restricted-badge">
                    <span className="material-icons">gavel</span> Modéré par l'administration
                  </span>
                )}
                <span className="aci-date">
                  {new Date(c.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
                {c.modifie && <span className="aci-modified">modifié</span>}
              </div>

              {isEditing ? (
                <div className="aci-edit">
                  <textarea className="acf-input" value={editingContenu}
                    onChange={e => setEditingContenu(e.target.value)} rows={2} autoFocus />
                  <div className="aci-edit-actions">
                    <button className="aci-btn aci-btn-save" onClick={() => handleEditSave(c.id)}>Sauvegarder</button>
                    <button className="aci-btn aci-btn-cancel" onClick={() => { setEditingId(null); setEditingContenu(''); }}>Annuler</button>
                  </div>
                </div>
              ) : (
                <p className="aci-content">{c.contenu}</p>
              )}

              <CommentActions c={c} isEditing={isEditing} />
            </div>
          );
        };

        return (
          <div className="article-comments">
            <h3 className="article-comments-title">
              <span className="material-icons">chat_bubble_outline</span>
              Commentaires
              {parentComments.length > 0 && <span className="article-comments-count">{parentComments.length}</span>}
            </h3>

            {/* Formulaire principal */}
            {user ? (
              <form className="article-comment-form" onSubmit={handleAddComment}>
                <AvatarBubble profil={user.profil} size={38} />
                <div className="acf-right">
                  <textarea className="acf-input" placeholder="Écrire un commentaire…"
                    value={commentInput} onChange={e => setCommentInput(e.target.value)}
                    rows={2} disabled={commentLoading} />
                  {commentError && <p className="acf-error">{commentError}</p>}
                  <button type="submit" className="acf-submit" disabled={commentLoading || !commentInput.trim()}>
                    <span className="material-icons">send</span>
                    {commentLoading ? 'Envoi…' : 'Publier'}
                  </button>
                </div>
              </form>
            ) : (
              <button className="article-comment-login" onClick={() => setLoginOverlay(true)}>
                <span className="material-icons">lock</span>
                Connectez-vous pour commenter
              </button>
            )}

            {/* Liste */}
            {parentComments.length === 0 ? (
              <p className="article-comments-empty">Aucun commentaire pour l'instant. Soyez le premier !</p>
            ) : (
              <div className="article-comments-list">
                {parentComments.map(c => {
                  const replies = getReplies(c.id);
                  // Si l'auteur a répondu et que l'utilisateur n'a pas encore interagi,
                  // on auto-affiche 1 réponse (la réponse de l'auteur, triée en premier)
                  const shownRaw = expandedReplies[c.id];
                  const shown = shownRaw !== undefined
                    ? shownRaw
                    : (hasAuthorReply(c.id) ? 1 : 0);
                  const hasMore = shown < replies.length;

                  return (
                    <div key={c.id} className="article-comment-item">
                      <AvatarBubble profil={c.profils} size={36} />
                      <div className="aci-thread">
                        <CommentBody c={c} />

                        {/* Bouton "Afficher les réponses" — uniquement quand tout est masqué */}
                        {replies.length > 0 && shown === 0 && (
                          <button className="aci-toggle-replies" onClick={() =>
                            setExpandedReplies(prev => ({ ...prev, [c.id]: REPLIES_PAGE }))}>
                            <span className="material-icons">expand_more</span>
                            Afficher {replies.length} réponse{replies.length > 1 ? 's' : ''}
                          </button>
                        )}

                        {shown > 0 && (
                          <div className="aci-replies">
                            {replies.slice(0, shown).map(r => (
                              <div key={r.id} className="article-comment-item aci-reply">
                                <AvatarBubble profil={r.profils} size={30} />
                                <div className="aci-thread">
                                  <CommentBody c={r} />
                                </div>
                              </div>
                            ))}

                            <div className="aci-replies-controls">
                              {hasMore && (
                                <button className="aci-toggle-replies" onClick={() =>
                                  setExpandedReplies(prev => ({ ...prev, [c.id]: shown + REPLIES_PAGE }))}>
                                  <span className="material-icons">expand_more</span>
                                  Afficher plus ({replies.length - shown} restantes)
                                </button>
                              )}
                              <button className="aci-toggle-replies aci-toggle-hide" onClick={() =>
                                setExpandedReplies(prev => ({ ...prev, [c.id]: 0 }))}>
                                <span className="material-icons">expand_less</span>
                                Masquer les réponses
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Formulaire de réponse inline */}
                        {replyingTo === c.id && user && (
                          <form className="article-comment-form aci-reply-form"
                            onSubmit={e => handleAddReply(e, c.id)}>
                            <AvatarBubble profil={user.profil} size={30} />
                            <div className="acf-right">
                              <textarea className="acf-input" placeholder={`Répondre à ${c.profils?.nom || 'ce commentaire'}…`}
                                value={replyInput} onChange={e => setReplyInput(e.target.value)}
                                rows={2} disabled={replyLoading} autoFocus />
                              {replyError && <p className="acf-error">{replyError}</p>}
                              <div className="aci-edit-actions">
                                <button type="submit" className="acf-submit" disabled={replyLoading || !replyInput.trim()}>
                                  <span className="material-icons">send</span>
                                  {replyLoading ? 'Envoi…' : 'Répondre'}
                                </button>
                                <button type="button" className="aci-btn aci-btn-cancel"
                                  onClick={() => { setReplyingTo(null); setReplyInput(''); setReplyError(''); }}>
                                  Annuler
                                </button>
                              </div>
                            </div>
                          </form>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* SECTION ARTICLES SIMILAIRES (Avec le look Card) */}
      <SimilarArticlesSection articles={similarArticles} />

      {/* PRÉVISUALISATION AUTEUR */}
      {/* MODALE CONFIRMATION DÉSABONNEMENT */}
      <ConfirmModal
        isOpen={showUnfollowModal}
        onClose={() => setShowUnfollowModal(false)}
        onConfirm={() => { setShowUnfollowModal(false); handleUnfollowAuthor(); }}
        title="Se désabonner"
        message={`Voulez-vous vous désabonner de ${article?.author?.name} ?`}
        confirmText="Se désabonner"
        isDanger={true}
      />

      {/* MODALE CONFIRMATION MODÉRATION */}
      {modConfirm && (
        <Portal>
        <div className="signal-overlay" onClick={() => !modLoading && setModConfirm(null)}>
          <div className="signal-modal" onClick={e => e.stopPropagation()}>
            <div className="signal-modal-header">
              <span className="material-icons" translate="no">
                {modConfirm.action === 'delete' ? 'delete_forever' : 'visibility_off'}
              </span>
              <h3>{modConfirm.action === 'delete' ? 'Supprimer l\'article ?' : 'Dépublier l\'article ?'}</h3>
            </div>
            <p className="signal-modal-sub">
              {modConfirm.action === 'delete'
                ? 'Cette action est irréversible. L\'article sera définitivement supprimé et l\'auteur sera notifié.'
                : 'L\'article sera dépublié et ne sera plus visible par les lecteurs. L\'auteur sera notifié.'}
            </p>
            <div className="signal-modal-actions">
              <button className="signal-btn-cancel" disabled={modLoading} onClick={() => setModConfirm(null)}>
                Annuler
              </button>
              <button className="signal-btn-submit" style={{ background: modConfirm.action === 'delete' ? '#ef4444' : '#f59e0b' }} disabled={modLoading} onClick={handleModAction}>
                <span className="material-icons" translate="no">
                  {modConfirm.action === 'delete' ? 'delete' : 'visibility_off'}
                </span>
                {modLoading ? 'En cours…' : modConfirm.action === 'delete' ? 'Confirmer la suppression' : 'Confirmer la dépublication'}
              </button>
            </div>
          </div>
        </div>
        </Portal>
      )}

      {/* MODALE SIGNALEMENT */}
      {signalModal && (
        <Portal>
        <div className="signal-overlay" onClick={() => !signalLoading && setSignalModal(false)}>
          <div className="signal-modal" onClick={e => e.stopPropagation()}>
            {signalSuccess ? (
              <div className="signal-success">
                <span className="material-icons" translate="no">check_circle</span>
                <p>Signalement envoyé. Merci !</p>
              </div>
            ) : (
              <>
                <div className="signal-modal-header">
                  <span className="material-icons" translate="no">flag</span>
                  <h3>Signaler cet article</h3>
                </div>
                <p className="signal-modal-sub">
                  Votre signalement sera examiné par notre équipe de modération.
                </p>

                <div className="signal-form-group">
                  <label>Raison du signalement</label>
                  <div className="signal-raisons">
                    {[
                      { value: 'contenu_inapproprie', label: 'Contenu inapproprié' },
                      { value: 'spam',                label: 'Spam' },
                      { value: 'desinformation',      label: 'Désinformation' },
                      { value: 'droits_auteur',       label: "Droits d'auteur" },
                      { value: 'autre',               label: 'Autre' },
                    ].map(r => (
                      <button
                        key={r.value}
                        className={`signal-raison-btn${signalRaison === r.value ? ' active' : ''}`}
                        onClick={() => setSignalRaison(r.value)}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="signal-form-group">
                  <label>Détails <span>(optionnel)</span></label>
                  <textarea
                    className="signal-textarea"
                    placeholder="Décrivez brièvement le problème…"
                    value={signalDesc}
                    onChange={e => setSignalDesc(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="signal-modal-actions">
                  <button className="signal-btn-cancel" disabled={signalLoading} onClick={() => setSignalModal(false)}>
                    Annuler
                  </button>
                  <button className="signal-btn-submit" disabled={signalLoading} onClick={handleSignaler}>
                    <span className="material-icons" translate="no">send</span>
                    {signalLoading ? 'Envoi…' : 'Envoyer le signalement'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
        </Portal>
      )}

      {/* MODALE MODÉRATION COMMENTAIRE (admin) */}
      {commentModerModal && (
        <Portal>
          <div className="signal-overlay" onClick={() => !commentModerLoading && setCommentModerModal(null)}>
            <div className="signal-modal" onClick={e => e.stopPropagation()}>
              <div className="signal-modal-header">
                <span className="material-icons" translate="no">admin_panel_settings</span>
                <h3>Modérer ce commentaire</h3>
              </div>

              <p className="signal-modal-sub" style={{ fontStyle: 'italic', opacity: 0.8, marginBottom: 12 }}>
                "{commentModerModal.comment.contenu.slice(0, 100)}{commentModerModal.comment.contenu.length > 100 ? '…' : ''}"
              </p>

              {/* Choix de l'action */}
              <div className="signal-form-group">
                <label>Action de modération</label>
                <div className="signal-raisons">
                  {[
                    { value: 'supprimer',              label: 'Supprimer le commentaire',         icon: 'delete' },
                    { value: 'restreindre',             label: 'Restreindre ce commentaire',       icon: 'block' },
                    { value: 'restreindre_user_article', label: 'Restreindre l\'utilisateur sur cette publication', icon: 'person_off' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      className={`signal-raison-btn${commentModerAction === opt.value ? ' active' : ''}`}
                      onClick={() => setCommentModerAction(opt.value)}
                    >
                      <span className="material-icons" style={{ fontSize: 16, verticalAlign: 'middle', marginRight: 4 }}>{opt.icon}</span>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Motif */}
              <div className="signal-form-group">
                <label>Motif <span>(optionnel)</span></label>
                <textarea
                  className="signal-textarea"
                  placeholder="Expliquez brièvement la raison de cette modération…"
                  value={commentModerMotif}
                  onChange={e => setCommentModerMotif(e.target.value)}
                  rows={2}
                  disabled={commentModerLoading}
                />
              </div>

              <div className="signal-modal-actions">
                <button className="signal-btn-cancel" disabled={commentModerLoading} onClick={() => setCommentModerModal(null)}>
                  Annuler
                </button>
                <button
                  className="signal-btn-submit"
                  style={{ background: commentModerAction === 'supprimer' ? '#ef4444' : '#f59e0b' }}
                  disabled={commentModerLoading}
                  onClick={handleCommentModer}
                >
                  <span className="material-icons" translate="no">
                    {commentModerAction === 'supprimer' ? 'delete' : commentModerAction === 'restreindre' ? 'block' : 'person_off'}
                  </span>
                  {commentModerLoading ? 'En cours…' : 'Confirmer la modération'}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* MODALE SIGNALEMENT COMMENTAIRE */}
      {signalCommentModal && (
        <Portal>
          <div className="signal-overlay" onClick={() => !signalCommentLoading && setSignalCommentModal(null)}>
            <div className="signal-modal" onClick={e => e.stopPropagation()}>
              {signalCommentSuccess ? (
                <div className="signal-success">
                  <span className="material-icons" translate="no">check_circle</span>
                  <p>Signalement envoyé. Merci !</p>
                </div>
              ) : (
                <>
                  <div className="signal-modal-header">
                    <span className="material-icons" translate="no">flag</span>
                    <h3>Signaler ce commentaire</h3>
                  </div>
                  <p className="signal-modal-sub" style={{ fontStyle: 'italic', opacity: 0.75, marginBottom: 12 }}>
                    "{signalCommentModal.contenu?.slice(0, 80)}{signalCommentModal.contenu?.length > 80 ? '…' : ''}"
                  </p>
                  <p className="signal-modal-sub">
                    Votre signalement sera examiné par notre équipe de modération.
                  </p>

                  <div className="signal-form-group">
                    <label>Raison du signalement</label>
                    <div className="signal-raisons">
                      {[
                        { value: 'contenu_inapproprie', label: 'Contenu inapproprié' },
                        { value: 'spam',                label: 'Spam' },
                        { value: 'harcelement',         label: 'Harcèlement' },
                        { value: 'desinformation',      label: 'Désinformation' },
                        { value: 'autre',               label: 'Autre' },
                      ].map(r => (
                        <button
                          key={r.value}
                          className={`signal-raison-btn${signalCommentRaison === r.value ? ' active' : ''}`}
                          onClick={() => setSignalCommentRaison(r.value)}
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="signal-modal-actions">
                    <button className="signal-btn-cancel" disabled={signalCommentLoading} onClick={() => setSignalCommentModal(null)}>
                      Annuler
                    </button>
                    <button className="signal-btn-submit" disabled={signalCommentLoading} onClick={handleSignalerComment}>
                      <span className="material-icons" translate="no">send</span>
                      {signalCommentLoading ? 'Envoi…' : 'Envoyer le signalement'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </Portal>
      )}

      {/* OVERLAY CONNEXION REQUISE */}
      {loginOverlay && (
        <Portal>
          <div className="article-login-overlay" onClick={() => setLoginOverlay(false)}>
            <div className="article-login-card" onClick={e => e.stopPropagation()}>
              <button className="article-login-close" onClick={() => setLoginOverlay(false)}>✕</button>
              <div className="article-login-icon">
                <span className="material-icons">lock</span>
              </div>
              <h3>Connectez-vous pour continuer</h3>
              <p>Créez un compte ou connectez-vous pour liker et commenter les articles.</p>
              <div className="article-login-actions">
                <Link to="/login" className="article-login-btn article-login-btn--primary">
                  <span className="material-icons">login</span>
                  Se connecter
                </Link>
                <button className="article-login-btn article-login-btn--secondary" onClick={() => setLoginOverlay(false)}>
                  Continuer sans liker
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}

    </div>
    </>
  );
};

export default Article;