import React from 'react'
import { Link } from 'react-router-dom'
import './Home.css'
import Logo from '../../assets/ArtInter Logo.png'
import { getAllArticles } from '../../Services/articlesService.js'
import Loader from '../../components/Loader/Loader.jsx'
import PageMeta from '../../components/PageMeta/PageMeta.jsx'

const Home = () => {
  const [articles, setArticles] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [currentSlide, setCurrentSlide] = React.useState(0);
  const [timerKey, setTimerKey] = React.useState(0);
  const touchStartX = React.useRef(null);

  React.useEffect(() => {
    getAllArticles()
      .then(data => setArticles(data || []))
      .catch(() => setArticles([]))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => {
    if (window.location.hash === '#aboutUs') {
      const el = document.getElementById('aboutUs');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  const slides = articles.slice(0, 5);
  const gridArticles = articles.slice(0, 6);

  // auto uniquement, sans reset timer
  const nextSlide = React.useCallback(() => {
    setCurrentSlide(prev => (prev + 1) % Math.max(slides.length, 1));
  }, [slides.length]);

  const resetTimer = () => setTimerKey(k => k + 1);

  const goNext = () => {
    resetTimer();
    setCurrentSlide(prev => (prev + 1) % Math.max(slides.length, 1));
  };

  const goPrev = () => {
    resetTimer();
    setCurrentSlide(prev => (prev - 1 + Math.max(slides.length, 1)) % Math.max(slides.length, 1));
  };

  const goTo = (index) => {
    resetTimer();
    setCurrentSlide(index);
  };

  React.useEffect(() => {
    if (slides.length === 0) return;
    const timer = setInterval(nextSlide, 6000);
    return () => clearInterval(timer);
  }, [nextSlide, slides.length, timerKey]);

  if (loading) return <Loader />;

  return (
    <div>
      <PageMeta />
      <section className="hero-section">
        {slides.length > 0 ? (
          <div
            className="slider-wrapper"
            onTouchStart={e => { touchStartX.current = e.touches[0].clientX; }}
            onTouchEnd={e => {
              if (touchStartX.current === null) return;
              const diff = touchStartX.current - e.changedTouches[0].clientX;
              if (Math.abs(diff) > 50) diff > 0 ? goNext() : goPrev();
              touchStartX.current = null;
            }}
          >
            <div
              className="slider-image"
              style={
                slides[currentSlide].image?.startsWith('#')
                  ? { backgroundColor: slides[currentSlide].image, backgroundImage: 'none' }
                  : { backgroundImage: `url(${slides[currentSlide].image})` }
              }
            >
              <div className="slider-overlay">
                <div className="slide-content">
                  <Link
                    to={slides[currentSlide].categorySlug ? `/Catalog?categorie=${slides[currentSlide].categorySlug}` : '/Catalog'}
                    className="slide-category"
                    onClick={e => e.stopPropagation()}
                  >
                    {slides[currentSlide].category}
                  </Link>
                  <Link to={`/article/${slides[currentSlide].slug}`} className="slide-text-link">
                    <h2 className="slide-title">{slides[currentSlide].title}</h2>
                    <p className="slide-desc">{slides[currentSlide].description}</p>
                  </Link>
                  <Link to={`/article/${slides[currentSlide].slug}`} className="btn-primary-1">
                    Lire l'article
                  </Link>
                </div>
              </div>
            </div>

            <div className="slider-controls">
              <button className="control-btn prev material-icons" translate="no" onClick={goPrev}>chevron_left</button>
              <button className="control-btn next material-icons" translate="no" onClick={goNext}>chevron_right</button>
              <div className="slider-dots">
                {slides.map((_, index) => (
                  <button
                    key={currentSlide === index ? `dot-active-${currentSlide}-${timerKey}` : index}
                    className={`dot ${currentSlide === index ? 'active' : ''}`}
                    onClick={() => goTo(index)}
                  />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="slider-empty">
            <p>Aucun article disponible pour le moment.</p>
          </div>
        )}
      </section>

      <section className="articles-section">
        <div className="section-header">
          <h2 className="section-title">Derniers articles</h2>
          <Link to="/Catalog" className="link-see-all">
            Découvrez en plus! <span className="material-icons" translate="no">arrow_forward</span>
          </Link>
        </div>

        {gridArticles.length > 0 ? (
          <div className="articles-grid">
            {gridArticles.map((article) => (
              <Link key={article.id} to={`/article/${article.slug}`} className="article-card">
                {article.image ? (
                  <div className="card-image-wrapper">
                    {article.image.startsWith('#') ? (
                      <div style={{ backgroundColor: article.image, width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}></div>
                    ) : (
                      <img src={article.image} alt={article.title} loading="lazy" />
                    )}
                    <Link
                      to={article.categorySlug ? `/Catalog?categorie=${article.categorySlug}` : '/Catalog'}
                      className="card-category"
                      onClick={e => e.stopPropagation()}
                    >
                      {article.category}
                    </Link>
                  </div>
                ) : null}
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
                  <p>{article.description}</p>
                  <span className="card-link">
                    Lire la suite <span className="material-icons" translate="no" style={{fontSize:'14px', verticalAlign:'middle'}}>arrow_forward</span>
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p style={{ color: 'var(--color-text-placeholder)', textAlign: 'center', padding: '40px 0' }}>
            Aucun article publié pour le moment.
          </p>
        )}
      </section>

      <section id="aboutUs" className="home-section about-section">
          <div className="about-container">
            <div className="about-hero">
              <div className="about-hero-text">
                <span>À propos d'</span>
                <h1>ArtInter</h1>
                <p>— "L'actualité visuelle internationale."</p>
              </div>
              <div className="about-image">
                <img src={Logo} alt="ArtInter" />
              </div>
            </div>

            <div className="about-content">
              <p>
                "ArtInter" est une plateforme dédiée à l'actualité et à la promotion des arts visuels à l'échelle internationale.
              </p>
              <p>
                Notre mission est de mettre en lumière la créativité contemporaine, de valoriser les artistes émergents et confirmés, et de créer un pont entre les cultures à travers l'image, la couleur et la forme.
              </p>
              <p>Nous explorons les multiples facettes de la création visuelle :</p>
              
              <ul className="art-fields">
                <li>Peinture</li>
                <li>Photographie</li>
                <li>Sculpture</li>
                <li>Design</li>
                <li>Architecture</li>
                <li>Art numérique</li>
                <li>Performance visuelle</li>
              </ul>

              <p>
                Chaque article, interview ou reportage est conçu pour inspirer, informer et éveiller la curiosité de notre communauté artistique mondiale.
              </p>

              <blockquote>
                Parce que l'art ne connaît pas de frontières, "ArtInter — L'actualité visuelle internationale." célèbre la diversité et l'innovation au cœur de la création visuelle contemporaine.
              </blockquote>

              <h3>Notre vision</h3>
              <p>
                Faire des arts visuels un langage universel, accessible à tous, qui unit les regards et ouvre les esprits.
              </p>
            </div>
          </div>
      </section>

    </div>
  )
}

export default Home
