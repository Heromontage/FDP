export default function ShapeAlert({ shape, isConcave, lastUpdated }) {
  const timeStr = lastUpdated
    ? lastUpdated.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }) + '.' + String(lastUpdated.getMilliseconds()).padStart(3, '0')
    : '--:--:--.---';

  const isIrregular =
    shape?.toUpperCase().includes('IRREGULAR') ||
    shape?.toUpperCase().includes('CONVEX');

  return (
    <section
      className={`relative overflow-hidden rounded-xl p-[2px] animate-fade-in-up ${isConcave ? 'animate-pulse-glow' : ''}`}
      style={{
        background: isConcave
          ? 'linear-gradient(135deg, #00E479, #00FF88)'
          : isIrregular
          ? 'linear-gradient(135deg, #FFB800, #FF8C00)'
          : 'linear-gradient(135deg, #33343B, #282A30)',
      }}
    >
      <div
        className="p-5 md:p-6 rounded-[calc(0.75rem-1px)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4 md:gap-6"
        style={{ background: '#111319' }}
      >
        <div className="flex items-center gap-4 md:gap-6">
          {/* Icon */}
          <div
            className="w-14 h-14 md:w-16 md:h-16 flex items-center justify-center rounded-lg flex-shrink-0"
            style={{
              background: isConcave
                ? 'rgba(0, 255, 136, 0.1)'
                : isIrregular
                ? 'rgba(255, 184, 0, 0.1)'
                : 'rgba(55, 57, 64, 0.4)',
              border: `1px solid ${isConcave ? 'rgba(0, 255, 136, 0.2)' : isIrregular ? 'rgba(255, 184, 0, 0.2)' : 'rgba(55, 57, 64, 0.3)'}`,
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{
                fontSize: '2rem',
                color: isConcave ? '#00FF88' : isIrregular ? '#FFB800' : '#849585',
                fontVariationSettings: "'FILL' 1",
              }}
            >
              radar
            </span>
          </div>

          {/* Text */}
          <div>
            <h2
              className={`font-headline text-xl md:text-3xl font-bold tracking-tight ${isConcave ? 'animate-text-pulse' : ''}`}
              style={{
                color: isConcave ? '#00FF88' : isIrregular ? '#FFB800' : '#849585',
              }}
            >
              {shape || 'WAITING FOR DATA...'}
            </h2>
            <p
              className="font-mono uppercase mt-1"
              style={{
                fontSize: '0.7rem',
                letterSpacing: '0.15em',
                color: '#B9CBB9',
              }}
            >
              {isConcave
                ? 'Autonomous Identification Sequence: Active'
                : isIrregular
                ? 'Surface Analysis: Irregular/Convex Geometry'
                : 'Standing By — Awaiting Sensor Data'}
            </p>
          </div>
        </div>

        {/* Timestamp */}
        <div className="text-right flex-shrink-0">
          <div
            className="font-mono uppercase"
            style={{ fontSize: '0.65rem', letterSpacing: '-0.02em', color: '#B9CBB9' }}
          >
            Last Updated
          </div>
          <div
            className="font-mono text-base md:text-lg"
            style={{ color: isConcave ? '#00FF88' : isIrregular ? '#FFB800' : '#849585' }}
          >
            {timeStr} MS
          </div>
        </div>
      </div>

      {/* Shimmer effect */}
      {isConcave && (
        <div
          className="absolute inset-0 pointer-events-none animate-shimmer rounded-xl"
          style={{ opacity: 0.3 }}
        />
      )}
    </section>
  );
}
