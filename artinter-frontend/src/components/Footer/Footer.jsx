import React from 'react'
import { Link } from 'react-router-dom'
import './Footer.css'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faInstagram, faTwitter, faFacebook, faLinkedin } from '@fortawesome/free-brands-svg-icons';

const Footer = () => {
  const [email, setEmail] = React.useState('');
  const [subscribed, setSubscribed] = React.useState(false);

  const handleNewsletter = (e) => {
    e.preventDefault();
    if (email.trim()) {
      setSubscribed(true);
      setEmail('');
    }
  };

  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-grid">

          <div className="footer-col">
            <h4>ArtInter</h4>
            <ul>
              <li><Link to="/">Accueil</Link></li>
              <li><Link to="/Catalog">Articles</Link></li>
              <li><Link to="/signup">Créer un compte</Link></li>
              <li><Link to="/login">Se connecter</Link></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>Informations légales</h4>
            <ul>
              <li><span className="footer-link-disabled">Mentions légales</span></li>
              <li><span className="footer-link-disabled">Politique de confidentialité</span></li>
              <li><span className="footer-link-disabled">Conditions d'utilisation</span></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>Newsletter</h4>
            <p>Recevez les dernières actualités artistiques directement dans votre boîte mail.</p>
            {subscribed ? (
              <p className="newsletter-success">
                <span className="material-icons" translate="no">check_circle</span>
                Merci pour votre inscription !
              </p>
            ) : (
              <form className="newsletter-form" onSubmit={handleNewsletter}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="votre@email.com"
                  className="email-input"
                  required
                />
                <button type="submit">S'inscrire</button>
              </form>
            )}
          </div>

          <div className="footer-col">
            <h4>Nous suivre</h4>
            <div className="social-links">
              <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" title="Instagram">
                <FontAwesomeIcon icon={faInstagram} />
              </a>
              <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" title="Twitter / X">
                <FontAwesomeIcon icon={faTwitter} />
              </a>
              <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" title="Facebook">
                <FontAwesomeIcon icon={faFacebook} />
              </a>
              <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" title="LinkedIn">
                <FontAwesomeIcon icon={faLinkedin} />
              </a>
            </div>
          </div>

        </div>

        <div className="copyright">
          <p>Copyright © 2026 ArtInter. Tous droits réservés.</p>
        </div>
      </div>
    </footer>
  )
}

export default Footer
