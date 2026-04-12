import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import './ValidationBanner.css';

const ValidationBanner = ({ errors, onClose }) => {
    const [isSmall, setIsSmall] = useState(() => window.matchMedia('(max-width: 600px)').matches);

    useEffect(() => {
        const mq = window.matchMedia('(max-width: 600px)');
        const handler = (e) => setIsSmall(e.matches);
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, []);

    useEffect(() => {
        if (!errors || errors.length === 0) return;
        const timer = setTimeout(onClose, 10000);
        return () => clearTimeout(timer);
    }, [errors, onClose]);

    if (!errors || errors.length === 0) return null;

    if (isSmall) {
        const overlayContent = (
            <div className="validation-overlay" onClick={onClose}>
                <div className="validation-modal" onClick={(e) => e.stopPropagation()}>
                    <div className="validation-modal-header">
                        <div className="validation-modal-title">
                            <div className="validation-icon">
                                <i className="fa-solid fa-triangle-exclamation"></i>
                            </div>
                            <h4>Action requise avant publication</h4>
                        </div>
                        <button className="validation-close" onClick={onClose}>
                            <i className="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                    <ul>
                        {errors.map((error, index) => (
                            <li key={index}>{error}</li>
                        ))}
                    </ul>
                </div>
            </div>
        );
        return createPortal(overlayContent, document.body);
    }

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

    return createPortal(bannerContent, document.body);
};

export default ValidationBanner;
