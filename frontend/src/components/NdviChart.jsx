import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';

export default function NdviChart({ observations }) {
  const data = observations.map((o) => ({
    date: o.observation_date,
    NDVI: o.ndvi,
    NDWI: o.ndwi,
  }));

  if (data.length === 0) {
    return <div className="empty">No satellite observations yet.</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: -8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef2f5" />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#5b6b78' }} tickFormatter={(d) => d.slice(0, 7)} />
        <YAxis domain={[-0.4, 0.9]} tick={{ fontSize: 11, fill: '#5b6b78' }} />
        <Tooltip contentStyle={{ fontSize: 13, borderRadius: 8, border: '1px solid #e2e8ee' }} />
        <Legend wrapperStyle={{ fontSize: 13 }} />
        <ReferenceLine y={0} stroke="#c8d2da" />
        <Line type="monotone" dataKey="NDVI" stroke="#1a9850" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
        <Line type="monotone" dataKey="NDWI" stroke="#2c7fb8" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="5 4" />
      </LineChart>
    </ResponsiveContainer>
  );
}
