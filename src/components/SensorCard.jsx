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
  const clampedValue = Math.min(Math.max(value || 0, 0), 100);
  const percentage = clampedValue;

  const colors = useMemo(() => {
    if (accentColor === 'primary') {
      return { accent: '#00FF88', text: '#00FF88', icon: '#00FF88' };
    }
    return { accent: '#00D2FD', text: '#00FF88', icon: '#00D2FD' };
  }, [accentColor]);

  return (
    <div
      className="glass-panel p-5 md:p-6 rounded-xl relative group animate-fade-in-up transition-all duration-300"
      style={{
        animationDelay: `${delay}ms`,
        ...(isCenter
          ? {
              borderColor: 'rgba(0, 255, 136, 0.3)',
              borderWidth: '1px',
              boxShadow: '0 0 10px 1px rgba(0, 255, 136, 0.1)',
            }
          : {}),
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = `0 0 20px 2px ${colors.accent}33`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = isCenter
          ? '0 0 10px 1px rgba(0, 255, 136, 0.1)'
          : 'none';
      }}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-6 md:mb-8">
        <span
          className="material-symbols-outlined"
          style={{
            color: colors.icon,
            fontVariationSettings: iconFill ? "'FILL' 1" : "'FILL' 0",
          }}
        >
          {icon}
        </span>
        <span
          className="font-headline uppercase font-bold"
          style={{
            fontSize: '10px',
            letterSpacing: '0.2em',
            color: isCenter ? '#00FF88' : '#B9CBB9',
          }}
        >
          {label}
        </span>
      </div>

      {/* Value Display */}
      <div className="flex flex-col items-center">
        <div className="flex items-baseline mb-4">
          <span
            className="font-mono font-light tracking-tighter"
            style={{ fontSize: '3.5rem', color: colors.text }}
          >
            {clampedValue}
          </span>
          <span
            className="font-body uppercase ml-1"
            style={{
              fontSize: '1.1rem',
              letterSpacing: '0.1em',
              color: '#B9CBB9',
            }}
          >
            cm
          </span>
        </div>

        {/* Progress Bar */}
        <div
          className="w-full overflow-hidden rounded-full"
          style={{ height: '4px', background: '#0C0E14' }}
        >
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${percentage}%`,
              background: `linear-gradient(90deg, #00FF88, #00D2FD)`,
            }}
          />
        </div>

        {/* Range Labels */}
        <div
          className="flex justify-between w-full mt-2 font-mono uppercase"
          style={{ fontSize: '8px', color: 'rgba(185, 203, 185, 0.4)' }}
        >
          <span>0cm</span>
          <span>{isCenter ? 'Precision Scan' : 'Range'}</span>
          <span>100cm</span>
        </div>
      </div>

      {/* Vertical gauge on the right edge */}
      <div
        className="absolute right-0 top-0 bottom-0 overflow-hidden rounded-r-xl"
        style={{ width: '3px' }}
      >
        <div
          className="absolute bottom-0 left-0 right-0 transition-all duration-500 ease-out"
          style={{
            height: `${percentage}%`,
            background: `linear-gradient(to top, #00FF88, #00D2FD)`,
            boxShadow: `0 0 6px ${colors.accent}66`,
          }}
        />
      </div>
    </div>
  );
}
