import React from 'react';
import { createPortal } from 'react-dom';
import './ValidationBanner.css';

const ValidationBanner = ({ errors, onClose }) => {
    if (!errors || errors.length === 0) return null;

    const bannerContent = (
        <div className="validation-banner">
            <div className="validation-content">
                <div className="validation-icon">
                    <i className="fa-solid fa-triangle-exclamation"></i>
                </div>
                <div className="validation-message">
                    <h4>Action requise avant publication</h4>
                    <ul>
                        {errors.map((error, index) => (
                            <li key={index}>{error}</li>
                        ))}
                    </ul>
                </div>
            </div>
            <button className="validation-close" onClick={onClose}>
                <i className="fa-solid fa-xmark"></i>
            </button>
        </div>
    );

    // Render in a portal attached to document.body to bypass parent CSS transforms
    return createPortal(bannerContent, document.body);
};

export default ValidationBanner;
