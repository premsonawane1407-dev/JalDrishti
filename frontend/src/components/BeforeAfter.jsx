import { useRef, useState } from 'react';

// Draggable before/after image comparison (swipe the divider).
export default function BeforeAfter({ before, after, beforeLabel = 'Before', afterLabel = 'After' }) {
  const [pos, setPos] = useState(50);
  const ref = useRef(null);
  const dragging = useRef(false);

  const move = (clientX) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    setPos(Math.max(2, Math.min(98, ((clientX - r.left) / r.width) * 100)));
  };

  return (
    <div
      className="ba"
      ref={ref}
      onPointerDown={(e) => { dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId); move(e.clientX); }}
      onPointerMove={(e) => { if (dragging.current) move(e.clientX); }}
      onPointerUp={() => { dragging.current = false; }}
      onPointerCancel={() => { dragging.current = false; }}
    >
      {/* after (bottom layer, full width) */}
      <img className="ba-img" src={after} alt={afterLabel} draggable="false" />
      <span className="ba-tag right">{afterLabel}</span>

      {/* before (top layer, clipped to pos%) */}
      <div className="ba-clip" style={{ width: `${pos}%` }}>
        <img className="ba-img" src={before} alt={beforeLabel} draggable="false" style={{ width: `${(100 / pos) * 100}%` }} />
        <span className="ba-tag left">{beforeLabel}</span>
      </div>

      {/* handle */}
      <div className="ba-handle" style={{ left: `${pos}%` }}>
        <div className="ba-knob">⟺</div>
      </div>
    </div>
  );
}
