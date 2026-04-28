import { useMemo } from 'react';

export default function Header({ connectionStatus }) {
  const statusConfig = useMemo(() => {
    switch (connectionStatus) {
      case 'Connected':   return { color: '#00FF88', text: 'CONNECTED',    pulse: true  };
      case 'Polling...':  return { color: '#3CD7FF', text: 'POLLING...',   pulse: true  };
      case 'Demo':        return { color: '#FFBA20', text: 'DEMO MODE',    pulse: true  };
      default:            return { color: '#FFB4AB', text: 'DISCONNECTED', pulse: false };
    }
  }, [connectionStatus]);

  const navItems = ['TELEMETRY', 'ANALYSIS', 'SENSORS', 'LOGS'];

  return (
    <header
      className="w-full sticky top-0 z-50"
      style={{
        background: 'rgba(17,19,25,0.97)',
        borderBottom: '1px solid rgba(55,57,64,0.25)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        boxShadow: '0 1px 24px rgba(0,255,136,0.06)',
      }}
    >
      <div className="flex justify-between items-center px-4 md:px-8 py-3.5 w-full max-w-[1440px] mx-auto">

        {/* Logo + Nav */}
        <div className="flex items-center gap-4 md:gap-10">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.2)' }}>
              <span className="material-symbols-outlined"
                style={{ fontSize: '16px', color: '#00FF88', fontVariationSettings: "'FILL' 1" }}>
                smart_toy
              </span>
            </div>
            <h1 className="text-base md:text-xl font-bold tracking-tighter uppercase font-headline"
              style={{ color: '#00FF88' }}>
              G26 | TELEMETRY ROBOT DASHBOARD
            </h1>
          </div>

          <nav className="hidden md:flex gap-1 items-center">
            {navItems.map((item, i) => (
              <a key={item} href="#"
                className="font-headline uppercase transition-all px-3 py-1.5 rounded-md"
                style={{
                  fontSize: '0.72rem',
                  letterSpacing: '0.1em',
                  color:      i === 0 ? '#00FF88' : 'rgba(185,203,185,0.55)',
                  background: i === 0 ? 'rgba(0,255,136,0.08)' : 'transparent',
                  fontWeight: i === 0 ? 600 : 400,
                }}
                onMouseEnter={(e) => {
                  if (i !== 0) {
                    e.currentTarget.style.color      = '#B9CBB9';
                    e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (i !== 0) {
                    e.currentTarget.style.color      = 'rgba(185,203,185,0.55)';
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                {item}
              </a>
            ))}
          </nav>
        </div>

        {/* Status + Actions */}
        <div className="flex items-center gap-3 md:gap-5">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full"
            style={{ background: '#1E1F26', border: '1px solid rgba(59,75,61,0.25)' }}>
            <span
              className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusConfig.pulse ? 'animate-pulse-dot' : ''}`}
              style={{ backgroundColor: statusConfig.color }}
            />
            <span className="font-mono uppercase tracking-widest"
              style={{ fontSize: '9px', color: statusConfig.color }}>
              {statusConfig.text}
            </span>
          </div>

          <div className="hidden md:flex items-center gap-1">
            {['settings', 'power_settings_new'].map((icon) => (
              <button key={icon}
                className="material-symbols-outlined p-2 rounded-lg transition-all"
                style={{ color: 'rgba(185,203,185,0.4)', fontSize: '18px', background: 'transparent', border: 'none', cursor: 'pointer' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#00FF88'; e.currentTarget.style.background = 'rgba(0,255,136,0.08)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(185,203,185,0.4)'; e.currentTarget.style.background = 'transparent'; }}
              >
                {icon}
              </button>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}