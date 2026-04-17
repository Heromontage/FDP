export default function ShapeAlert({ shape, isConcave, lastUpdated }) {
  const timeStr = lastUpdated
    ? lastUpdated.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
        + '.' + String(lastUpdated.getMilliseconds()).padStart(3, '0')
    : '--:--:--.---';

  const isConvex  = shape?.toUpperCase().includes('CONVEX') && !isConcave;
  const isFlat    = shape?.toUpperCase().includes('FLAT');

  const theme = isConcave
    ? { grad: 'linear-gradient(135deg, #00E479, #00D2FD)', color: '#00FF88', icon: 'radar',        bg: 'rgba(0,255,136,0.08)',  border: 'rgba(0,255,136,0.2)',  sub: 'Autonomous Identification Sequence: Active'   }
    : isConvex
    ? { grad: 'linear-gradient(135deg, #FFB800, #FF6B00)', color: '#FFBA20', icon: 'bubble_chart', bg: 'rgba(255,184,0,0.08)',  border: 'rgba(255,184,0,0.2)',  sub: 'Surface Analysis: Convex Geometry Detected'   }
    : isFlat
    ? { grad: 'linear-gradient(135deg, #3CD7FF, #0099CC)', color: '#3CD7FF', icon: 'straighten',   bg: 'rgba(60,215,255,0.08)', border: 'rgba(60,215,255,0.2)', sub: 'Surface Analysis: Flat Planar Surface'         }
    : { grad: 'linear-gradient(135deg, #373940, #282A30)', color: '#849585', icon: 'sensors',      bg: 'rgba(55,57,64,0.3)',    border: 'rgba(55,57,64,0.4)',   sub: 'Standing By — Awaiting Sensor Data'            };

  return (
    <section
      className={`relative overflow-hidden rounded-xl p-[1.5px] animate-fade-in-up ${isConcave ? 'animate-pulse-glow' : ''}`}
      style={{ background: theme.grad }}
    >
      <div
        className="rounded-[calc(0.75rem-1px)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-6"
        style={{ background: '#111319', padding: '1.25rem 1.5rem' }}
      >
        <div className="flex items-center gap-4 md:gap-5">
          {/* Icon */}
          <div className="w-12 h-12 md:w-14 md:h-14 flex items-center justify-center rounded-xl flex-shrink-0"
            style={{ background: theme.bg, border: `1px solid ${theme.border}` }}>
            <span className="material-symbols-outlined"
              style={{ fontSize: '1.75rem', color: theme.color, fontVariationSettings: "'FILL' 1" }}>
              {theme.icon}
            </span>
          </div>

          {/* Text */}
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap mb-0.5">
              <h2
                className={`font-headline text-lg md:text-2xl font-bold tracking-tight ${isConcave ? 'animate-text-pulse' : ''}`}
                style={{ color: theme.color, lineHeight: 1.1 }}
              >
                {shape || 'INITIALIZING...'}
              </h2>
              {isConcave && (
                <span className="font-mono px-2 py-0.5 rounded-full"
                  style={{ fontSize: '8px', letterSpacing: '0.1em', background: 'rgba(0,255,136,0.15)', color: '#00FF88', border: '1px solid rgba(0,255,136,0.25)' }}>
                  LOCKED
                </span>
              )}
            </div>
            <p className="font-mono uppercase" style={{ fontSize: '0.65rem', letterSpacing: '0.12em', color: '#849585' }}>
              {theme.sub}
            </p>
          </div>
        </div>

        {/* Timestamp */}
        <div className="flex-shrink-0 text-right sm:pl-4">
          <div className="font-mono uppercase mb-0.5" style={{ fontSize: '0.6rem', letterSpacing: '0.08em', color: '#849585' }}>
            Last Updated
          </div>
          <div className="font-mono" style={{ fontSize: '0.95rem', color: theme.color, letterSpacing: '-0.01em' }}>
            {timeStr}
          </div>
          <div className="font-mono" style={{ fontSize: '0.55rem', color: '#3B4B3D', letterSpacing: '0.1em', marginTop: '2px' }}>
            MS TIMESTAMP
          </div>
        </div>
      </div>

      {isConcave && (
        <div className="absolute inset-0 pointer-events-none animate-shimmer rounded-xl" style={{ opacity: 0.25 }} />
      )}
    </section>
  );
}