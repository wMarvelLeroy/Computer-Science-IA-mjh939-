import './StatsCard.css';

function StatsCard({ icon, title, value, change, color = 'blue', trend = 'up' }) {
    return (
        <div className={`stats-card stats-card-${color}`}>
            <div className="stats-icon">{icon}</div>
            <div className="stats-content">
                <h3 className="stats-title">{title}</h3>
                <p className="stats-value">{value}</p>
                {change && (
                    <span className={`stats-change ${trend === 'up' ? 'positive' : 'negative'}`}>
                        {trend === 'up' ? '↗' : '↘'} {change}
                    </span>
                )}
            </div>
        </div>
    );
}

export default StatsCard;
