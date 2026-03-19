import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';

function BoutonRetour() {
  const navigate = useNavigate();

  return (
    <button className="back-button" onClick={() => navigate('/Catalog')}>
      <span><FontAwesomeIcon icon={faArrowLeft} /></span>
      Retour aux articles
    </button>
  );
}

export default BoutonRetour;