import { TREND_LABEL_COLORS } from '../api.js';

export default function TrendBadge({ label, pct }) {
  const color = TREND_LABEL_COLORS[label] || '#9aa0a6';
  const arrow = label === 'Improving' ? '▲' : label === 'Declining' ? '▼' : label === 'Stable' ? '▬' : '–';
  return (
    <span className="badge" style={{ background: color }} title={label}>
      <span>{arrow}</span>
      {label}
      {pct !== null && pct !== undefined && <span>({pct > 0 ? '+' : ''}{pct}%)</span>}
    </span>
  );
}
