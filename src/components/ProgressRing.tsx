type Props = {
  percent: number;
  size?: number;
  stroke?: number;
  label?: string;
  sublabel?: string;
};

export function ProgressRing({ percent, size = 180, stroke = 19, label, sublabel }: Props) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, Math.max(0, percent)) / 100) * c;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id="ring-gold" x1="0%" y1="0%" x2="100%" y2="100%">
  <stop offset="0%" stopColor="#e5de00" />
  <stop offset="100%" stopColor="#e6cc00" />
</linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="oklch(0.3 0.04 220)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="url(#ring-gold)"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 600ms cubic-bezier(.2,.8,.2,1)" }}
        />
      </svg>
      <div
        className="absolute inset-0 flex flex-col items-center justify-center rounded-full text-black"
        style={{ fontFamily: '"Roboto Mono", monospace' }}
      >
        {label && <div className="text-5xl font-bold leading-none">{label}</div>}
        {sublabel && (
          <div className="mt-3 text-xl font-bold uppercase tracking-[0.12em]">
            {sublabel}
          </div>
        )}
      </div>
    </div>
  );
} 
