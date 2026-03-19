import './StatusBadge.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircle, faCircleExclamation, faClock, faCircleStop } from '@fortawesome/free-solid-svg-icons';

function StatusBadge({ status }) {
    const getStatusConfig = () => {
        switch (status) {
            case 'publie':
            case 'publié':
            case 'approuvee':
            case 'approuvée':
                return { icon: <FontAwesomeIcon icon={faCircle} />, label: 'Publié', className: 'success' };

            case 'brouillon':
                return { icon: <FontAwesomeIcon icon={faCircle}/>, label: 'Brouillon', className: 'warning' };

            case 'en_attente':
                return { icon: <FontAwesomeIcon icon={faClock} />, label: 'En attente', className: 'pending' };

            case 'refusee':
            case 'refusée':
                return { icon: <FontAwesomeIcon icon={faCircleExclamation} />, label: 'Refusé', className: 'error' };

            default:
                return { icon: <FontAwesomeIcon icon={faCircleStop} />, label: status, className: 'default' };
        }
    };

    const config = getStatusConfig();

    return (
        <span className={`status-badge status-${config.className}`}>
            <span className="status-icon">{config.icon}</span>
            <span className="status-label">{config.label}</span>
        </span>
    );
}

export default StatusBadge;
