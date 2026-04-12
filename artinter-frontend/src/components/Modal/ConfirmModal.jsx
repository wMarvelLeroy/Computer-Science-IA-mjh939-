import React from 'react';
import './ConfirmModal.css';
import Portal from './Portal.jsx';

const ConfirmModal = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = "Confirmer",
    cancelText = "Annuler",
    isDanger = false,
    showCancel = true
}) => {
    if (!isOpen) return null;

    return (
        <Portal>
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content2" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    {isDanger && <span className="modal-icon-danger">⚠️</span>}
                    <h3>{title}</h3>
                </div>

                <div className="modal-body">
                    <p>{message}</p>
                </div>

                <div className="modal-actions">
                    {showCancel && (
                        <button className="btn-modal-cancel" onClick={onClose}>
                            {cancelText}
                        </button>
                    )}
                    <button
                        className={`btn-modal-confirm ${isDanger ? 'danger' : 'primary'}`}
                        onClick={() => {
                            onConfirm();
                            onClose();
                        }}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
        </Portal>
    );
};

export default ConfirmModal;
