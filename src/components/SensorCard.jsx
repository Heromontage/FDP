import { useMemo } from 'react';

export default function SensorCard({
  label,
  value,
  icon,
  iconFill = false,
  accentColor = 'primary',
  isCenter = false,
  delay = 0,
}) {
  const clamped = Math.min(Math.max(value || 0, 0), 100);

  const colors = useMemo(() => (
    accentColor === 'primary'
      ? { accent: '#00FF88', bar: 'linear-gradient(90deg, #00E479, #00FF88)', icon: '#00FF88' }
      : { accent: '#00D2FD', bar: 'linear-gradient(90deg, #00E479, #00D2FD)', icon: '#00D2FD' }
  ), [accentColor]);

  const distLabel      = clamped < 20 ? 'CLOSE' : clamped < 60 ? 'MID' : 'FAR';
  const distLabelColor = clamped < 20 ? '#FFB4AB' : clamped < 60 ? '#FFBA20' : '#00D2FD';

  return (
    <div
      className="glass-panel rounded-xl relative animate-fade-in-up transition-all duration-300 cursor-default"
      style={{
        padding: '1.25rem',
        animationDelay: `${delay}ms`,
        ...(isCenter ? {
          borderColor: 'rgba(0,255,136,0.25)',
          borderWidth: '1px',
          borderStyle: 'solid',
          boxShadow: '0 0 16px 2px rgba(0,255,136,0.08)',
        } : {}),
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform  = 'translateY(-3px)';
        e.currentTarget.style.boxShadow  = `0 8px 32px rgba(0,0,0,0.3), 0 0 16px 1px ${colors.accent}22`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform  = 'translateY(0)';
        e.currentTarget.style.boxShadow  = isCenter ? '0 0 16px 2px rgba(0,255,136,0.08)' : 'none';
      }}
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-5 md:mb-6">
        <span className="material-symbols-outlined"
          style={{ color: colors.icon, fontSize: '20px', fontVariationSettings: iconFill ? "'FILL' 1" : "'FILL' 0" }}>
          {icon}
        </span>
        <div className="flex items-center gap-2">
          <span className="font-mono uppercase px-1.5 py-0.5 rounded"
            style={{ fontSize: '8px', color: distLabelColor, background: `${distLabelColor}18`, letterSpacing: '0.05em' }}>
            {distLabel}
          </span>
          <span className="font-headline uppercase font-semibold"
            style={{ fontSize: '9px', letterSpacing: '0.18em', color: isCenter ? '#00FF88' : '#B9CBB9' }}>
            {label}
          </span>
        </div>
      </div>

      {/* Value */}
      <div className="flex flex-col items-center gap-3.5">
        <div className="flex items-baseline">
          <span className="font-mono font-light tracking-tighter"
            style={{ fontSize: '3.2rem', lineHeight: 1, color: colors.icon }}>
            {clamped}
          </span>
          <span className="font-mono uppercase ml-1.5"
            style={{ fontSize: '0.85rem', letterSpacing: '0.08em', color: '#849585' }}>
            cm
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full overflow-hidden rounded-full" style={{ height: '3px', background: '#0C0E14' }}>
          <div className="h-full rounded-full transition-all duration-500 ease-out"
            style={{ width: `${clamped}%`, background: colors.bar }} />
        </div>

        {/* Range labels */}
        <div className="flex justify-between w-full font-mono uppercase"
          style={{ fontSize: '7.5px', color: 'rgba(132,149,133,0.35)' }}>
          <span>0cm</span>
          <span>{isCenter ? 'PRECISION SCAN' : 'RANGE'}</span>
          <span>100cm</span>
        </div>
      </div>

      {/* Right-edge vertical gauge */}
      <div className="absolute right-0 top-0 bottom-0 overflow-hidden rounded-r-xl"
        style={{ width: '3px', background: 'rgba(12,14,20,0.5)' }}>
        <div className="absolute bottom-0 left-0 right-0 transition-all duration-500 ease-out"
          style={{ height: `${clamped}%`, background: 'linear-gradient(to top, #00FF88, #00D2FD)', boxShadow: `0 0 6px ${colors.accent}55` }} />
      </div>
    </div>
  );
}