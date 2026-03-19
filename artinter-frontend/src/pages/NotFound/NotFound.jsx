import React from 'react'
import { Link } from 'react-router-dom'
import './NotFound.css'

const NotFound = () => {
  return (
    <div className="notfound-container fadeInContainer">
      <div className="notfound-code">404</div>
      <h1 className="notfound-title">Page introuvable</h1>
      <p className="notfound-text">
        La page que vous cherchez n'existe pas ou a été déplacée.
      </p>
      <div className="notfound-actions">
        <Link to="/" className="notfound-btn-primary">
          <span className="material-icons" translate="no">home</span>
          Retour à l'accueil
        </Link>
        <Link to="/catalog" className="notfound-btn-secondary">
          <span className="material-icons" translate="no">article</span>
          Voir les articles
        </Link>
      </div>
    </div>
  )
}

export default NotFound
