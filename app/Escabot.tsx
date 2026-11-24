import { useId } from 'react';

export type Mood = 'neutral' | 'thinking' | 'happy' | 'surprised' | 'offtopic' | 'error';

// Escabot: aluminum step ladder with eyes and a red cap. Every mood is the same drawing;
// CSS in globals.css swaps the mouth/brows and the animation by data-state.
export function Escabot({ mood, className }: { mood: Mood; className?: string }) {
  const alu = `alu${useId().replace(/:/g, '')}`;
  return (
    <svg className={`bot ${className ?? ''}`} data-state={mood} viewBox="0 -20 200 290" aria-hidden="true">
      <defs>
        <linearGradient id={alu} x1="0" x2="1">
          <stop offset="0" stopColor="#8a94a1" />
          <stop offset=".45" stopColor="#f4f6f8" />
          <stop offset="1" stopColor="#aab3be" />
        </linearGradient>
      </defs>
      <g className="body-g">
        <line className="rail-o" x1="72" y1="52" x2="48" y2="252" />
        <line className="rail-o" x1="128" y1="52" x2="152" y2="252" />
        <line className="rail" stroke={`url(#${alu})`} x1="72" y1="52" x2="48" y2="252" />
        <line className="rail" stroke={`url(#${alu})`} x1="128" y1="52" x2="152" y2="252" />
        {[
          [61, 142, 139, 'r1'],
          [57, 176, 143, 'r2'],
          [53, 210, 147, 'r3'],
          [49, 244, 151, 'r4'],
        ].map(([x1, y, x2, r]) => (
          <g key={r}>
            <line className="rung-o" x1={x1} y1={y} x2={x2} y2={y} />
            <line className={`rung ${r}`} x1={x1} y1={y} x2={x2} y2={y} />
          </g>
        ))}
        <rect className="ink" x="36" y="250" width="24" height="10" rx="3" />
        <rect className="ink" x="140" y="250" width="24" height="10" rx="3" />
        <rect x="60" y="42" width="80" height="20" rx="6" fill={`url(#${alu})`} stroke="var(--ink)" strokeWidth="3" />
        <line className="brow brow-l" x1="76" y1="68" x2="94" y2="66" />
        <line className="brow brow-r" x1="106" y1="66" x2="124" y2="68" />
        <g className="eyes">
          <ellipse className="eye-w" cx="84" cy="90" rx="11" ry="12" />
          <ellipse className="eye-w" cx="116" cy="90" rx="11" ry="12" />
          <g className="pupils">
            <circle fill="#16181c" cx="86" cy="92" r="5.5" />
            <circle fill="#16181c" cx="114" cy="92" r="5.5" />
            <circle cx="88" cy="89.5" r="1.8" fill="#fff" />
            <circle cx="116" cy="89.5" r="1.8" fill="#fff" />
          </g>
        </g>
        {/* Thick glasses, a nod to Alex. Outside .eyes so they don't blink. */}
        {/* Wayfarer-style: trapezoid lenses, heavy top bar. */}
        <g className="glasses">
          {['frame-o', 'frame'].map((c) => (
            <g key={c} className={c}>
              <path d="M67 77 L98 77 L95 98 Q94 103 88 103 L76 103 Q71 103 70 98 Z" />
              <path d="M133 77 L102 77 L105 98 Q106 103 112 103 L124 103 Q129 103 130 98 Z" />
              <path className="topbar" d="M66 77 H99 M101 77 H134 M98 81 H102" />
            </g>
          ))}
          <path className="glare" d="M88 81 l4 5 M120 81 l4 5" />
        </g>
        <path className="m mouth m-neutral" d="M90 116 Q100 123 110 116" />
        <path className="m mouth m-thinking" d="M92 119 L108 116" />
        <path className="m mouth fill m-happy" d="M84 113 Q100 134 116 113 Z" />
        <ellipse className="m mouth m-surprised" cx="100" cy="120" rx="6" ry="8" />
        <path className="m mouth m-offtopic" d="M86 120 q4 -5 7 0 t7 0 t7 0 t7 0" />
        <path className="m mouth m-error" d="M89 123 Q100 113 111 123" />
        <path className="sweat" d="M132 72 q6 9 0 13 q-6 -4 0 -13 Z" fill="#7cc4ff" stroke="var(--ink)" strokeWidth="2" />
        <g className="cap">
          <path d="M56 46 Q60 4 100 2 Q140 4 144 46 Z" fill="var(--red)" stroke="var(--ink)" strokeWidth="3" strokeLinejoin="round" />
          <path d="M138 42 Q168 36 182 48 Q160 54 136 50 Z" fill="var(--red)" stroke="var(--ink)" strokeWidth="3" strokeLinejoin="round" />
          <circle cx="100" cy="4" r="4" fill="var(--red)" stroke="var(--ink)" strokeWidth="2.5" />
          <rect x="88" y="16" width="24" height="20" rx="3" fill="var(--yellow)" stroke="var(--ink)" strokeWidth="2.5" />
          <text x="100" y="32" textAnchor="middle" fontFamily="var(--display)" fontSize="17" fill="#16181c">E</text>
        </g>
      </g>
      <g className="think" fill="var(--ink)">
        <circle cx="160" cy="20" r="4" />
        <circle cx="172" cy="6" r="5" />
        <circle cx="186" cy="-10" r="6" />
      </g>
    </svg>
  );
}
