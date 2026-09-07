import {
  ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ReferenceLine,
} from 'recharts';

const tooltipStyle = {
  fontSize: 13, borderRadius: 12, border: '1px solid #e7e1d4',
  background: 'rgba(255,253,248,.95)', boxShadow: '0 12px 34px -12px rgba(24,40,30,.25)',
};

export default function NdviChart({ observations }) {
  const data = observations.map((o) => ({ date: o.observation_date, NDVI: o.ndvi, NDWI: o.ndwi }));
  if (data.length === 0) return <div className="empty">No satellite observations yet.</div>;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={data} margin={{ top: 8, right: 14, left: -10, bottom: 4 }}>
        <defs>
          <linearGradient id="ndviFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2f8f5b" stopOpacity={0.32} />
            <stop offset="100%" stopColor="#2f8f5b" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="2 5" stroke="#e7e1d4" vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a097' }} tickFormatter={(d) => d.slice(0, 7)} axisLine={{ stroke: '#e7e1d4' }} tickLine={false} />
        <YAxis domain={[-0.4, 0.9]} tick={{ fontSize: 11, fill: '#94a097' }} axisLine={false} tickLine={false} width={34} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: '#cdc6b6', strokeDasharray: '3 3' }} />
        <Legend wrapperStyle={{ fontSize: 13, paddingTop: 6 }} iconType="plainline" />
        <ReferenceLine y={0} stroke="#d9d1bf" />
        <Area type="monotone" dataKey="NDVI" stroke="#2f8f5b" strokeWidth={2.6} fill="url(#ndviFill)" dot={{ r: 2.5, fill: '#2f8f5b', strokeWidth: 0 }} activeDot={{ r: 5 }} />
        <Line type="monotone" dataKey="NDWI" stroke="#0e7b84" strokeWidth={2} dot={{ r: 2.5 }} strokeDasharray="5 4" />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
