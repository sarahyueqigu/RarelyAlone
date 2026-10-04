const OUTER: [number, number][] = [
  [22, 26],
  [68, 18],
  [86, 58],
  [44, 88],
  [14, 70],
];

export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true" focusable="false">
      <g className="stroke-primary" strokeWidth={5} strokeLinecap="round">
        {OUTER.map(([x, y]) => (
          <line key={`l${x}`} x1={50} y1={52} x2={x} y2={y} />
        ))}
      </g>
      {OUTER.map(([x, y]) => (
        <circle key={`c${x}`} cx={x} cy={y} r={8} className="fill-primary" />
      ))}
      <circle cx={50} cy={52} r={13} className="fill-accent" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark />
      <span className="font-heading text-xl font-[650] text-foreground">Rarely Alone</span>
    </span>
  );
}
