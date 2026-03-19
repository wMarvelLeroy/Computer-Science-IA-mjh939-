import { useState, useEffect, useRef } from 'react';
import { claimItem, releaseClaim, contesterClaim } from '../../api/api.js';
import './ClaimSection.css';

const isClaimActive = (claim) => claim && new Date(claim.expires_at) > new Date();

const getRemainingSeconds = (expiresAt) =>
  Math.max(0, Math.floor((new Date(expiresAt) - new Date()) / 1000));

const formatCountdown = (seconds) => {
  if (seconds <= 0) return 'Expiré';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m > 0) return `${m} min ${s.toString().padStart(2, '0')} s`;
  return `${s} s`;
};

// ─── Hook countdown ───────────────────────────────────────────────────────────
function useClaimCountdown(claim, onExpire) {
  const [remaining, setRemaining] = useState(
    claim && isClaimActive(claim) ? getRemainingSeconds(claim.expires_at) : 0
  );
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    if (!claim || !isClaimActive(claim)) { setRemaining(0); return; }
    setRemaining(getRemainingSeconds(claim.expires_at));
    const interval = setInterval(() => {
      const secs = getRemainingSeconds(claim.expires_at);
      setRemaining(secs);
      if (secs <= 0) {
        clearInterval(interval);
        onExpireRef.current();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [claim?.expires_at]); // eslint-disable-line react-hooks/exhaustive-deps

  return remaining;
}

// ─── Badge léger pour les cards dans la liste ────────────────────────────────
export function ClaimBadge({ claim, currentUserId }) {
  const active = isClaimActive(claim);
  if (!active) return null;

  const isMine = claim.claimed_by === currentUserId;
  return (
    <span className={`claim-badge ${isMine ? 'mine' : 'other'}`}>
      <span className="material-icons">{isMine ? 'how_to_reg' : 'lock'}</span>
      {isMine ? 'Pris par vous' : `Pris par ${claim.profils?.nom || 'un admin'}`}
    </span>
  );
}

// ─── Section complète dans le panneau de détail ───────────────────────────────
export default function ClaimSection({ tableName, itemId, claim, currentUserId, onClaimChange }) {
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [contested, setContested] = useState(false);

  const active = isClaimActive(claim);
  const isMine = active && claim.claimed_by === currentUserId;
  const isSomeoneElse = active && claim.claimed_by !== currentUserId;
  const isExpiredMine = !active && claim?.claimed_by === currentUserId;

  const remaining = useClaimCountdown(
    active ? claim : null,
    () => onClaimChange(null)
  );

  const isWarning = remaining > 0 && remaining <= 300; // < 5 min

  const handleClaim = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await claimItem(tableName, itemId);
      onClaimChange(data.data);
      setConfirmVisible(false);
    } catch (err) {
      setError(err?.response?.data?.error || 'Erreur lors de la prise en charge');
    } finally {
      setLoading(false);
    }
  };

  const handleRelease = async () => {
    setLoading(true);
    try {
      await releaseClaim(tableName, itemId);
      onClaimChange(null);
    } catch { /* silencieux */ }
    finally { setLoading(false); }
  };

  const handleContest = async () => {
    setLoading(true);
    try {
      await contesterClaim(tableName, itemId);
      setContested(true);
    } catch { /* silencieux */ }
    finally { setLoading(false); }
  };

  // ── Pris en charge par moi ──
  if (isMine) {
    return (
      <div className={`claim-section claim-mine ${isWarning ? 'claim-warning' : ''}`}>
        <div className="claim-info">
          <span className="material-icons">how_to_reg</span>
          <div>
            <strong>Pris en charge par vous</strong>
            <span className={isWarning ? 'claim-timer-warning' : ''}>
              {isWarning && <span className="material-icons claim-timer-icon">timer</span>}
              Expire dans {formatCountdown(remaining)}
            </span>
          </div>
        </div>
        <button className="claim-release-btn" onClick={handleRelease} disabled={loading}>
          <span className="material-icons">lock_open</span>
          Abandonner
        </button>
      </div>
    );
  }

  // ── Pris en charge par un autre admin ──
  if (isSomeoneElse) {
    return (
      <div className={`claim-section claim-other ${isWarning ? 'claim-warning' : ''}`}>
        <div className="claim-info">
          <div className="claim-avatar">
            {claim.profils?.avatar_url
              ? <img src={claim.profils.avatar_url} alt="" />
              : (claim.profils?.nom?.[0]?.toUpperCase() || '?')}
          </div>
          <div>
            <strong>Pris en charge par {claim.profils?.nom || 'un admin'}</strong>
            <span className={isWarning ? 'claim-timer-warning' : ''}>
              {isWarning && <span className="material-icons claim-timer-icon">timer</span>}
              Expire dans {formatCountdown(remaining)}
            </span>
          </div>
        </div>
        {!contested ? (
          <button className="claim-contest-btn" onClick={handleContest} disabled={loading}>
            <span className="material-icons">back_hand</span>
            Contester
          </button>
        ) : (
          <span className="claim-contested-msg">
            <span className="material-icons">check</span>
            Notification envoyée
          </span>
        )}
      </div>
    );
  }

  // ── Confirmation de prise en charge ──
  if (confirmVisible) {
    return (
      <div className="claim-section claim-pending">
        <p className="claim-confirm-text">
          <span className="material-icons">info</span>
          Les autres admins verront que vous êtes responsable de cet élément pendant 30 minutes.
          {isExpiredMine && ' (Votre précédente prise en charge a expiré)'}
        </p>
        {error && <span className="claim-error">{error}</span>}
        <div className="claim-confirm-actions">
          <button className="claim-cancel-btn" onClick={() => { setConfirmVisible(false); setError(null); }} disabled={loading}>
            Annuler
          </button>
          <button className="claim-confirm-btn" onClick={handleClaim} disabled={loading}>
            <span className="material-icons">lock</span>
            {loading ? 'En cours…' : 'Confirmer'}
          </button>
        </div>
      </div>
    );
  }

  // ── Non pris en charge (ou expiré) ──
  return (
    <div className="claim-section claim-free">
      <div className="claim-info">
        <span className="material-icons">lock_open</span>
        <span>
          {claim && !active
            ? `Prise en charge de ${claim.profils?.nom || "l'admin"} expirée`
            : 'Non pris en charge'}
        </span>
      </div>
      <button className="claim-take-btn" onClick={() => setConfirmVisible(true)}>
        <span className="material-icons">lock</span>
        Prendre en charge
      </button>
    </div>
  );
}
