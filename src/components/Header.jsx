import { useMemo } from 'react';

export default function Header({ connectionStatus }) {
  const statusConfig = useMemo(() => {
    switch (connectionStatus) {
      case 'Connected':
        return { color: '#00FF88', dot: 'bg-green-400', text: 'CONNECTED', pulse: true };
      case 'Polling...':
        return { color: '#3CD7FF', dot: 'bg-cyan-400', text: 'POLLING...', pulse: true };
      case 'Disconnected':
      default:
        return { color: '#FFB4AB', dot: 'bg-red-400', text: 'DISCONNECTED', pulse: false };
    }
  }, [connectionStatus]);

  return (
    <header
      className="w-full sticky top-0 z-50"
      style={{
        background: '#111319',
        borderBottom: '1px solid rgba(55, 57, 64, 0.2)',
        boxShadow: '0 0 20px rgba(0, 255, 136, 0.1)',
      }}
    >
      <div className="flex justify-between items-center px-4 md:px-8 py-4 w-full">
        {/* Left side: Title + Nav */}
        <div className="flex items-center gap-4 md:gap-8">
          <h1
            className="text-lg md:text-2xl font-bold tracking-tighter uppercase font-headline"
            style={{ color: '#00FF88' }}
          >
            KINETIC SENTINEL
          </h1>
          <nav className="hidden md:flex gap-6 items-center">
            {['TELEMETRY', 'ANALYSIS', 'SENSORS', 'LOGS'].map((item, i) => (
              <a
                key={item}
                href="#"
                className="font-headline uppercase transition-colors"
                style={{
                  fontSize: '0.8rem',
                  letterSpacing: '0.1em',
                  color: i === 0 ? '#00FF88' : 'rgba(226, 226, 235, 0.6)',
                  borderBottom: i === 0 ? '2px solid #00FF88' : 'none',
                  paddingBottom: i === 0 ? '4px' : '0',
                }}
              >
                {item}
              </a>
            ))}
          </nav>
        </div>

        {/* Right side: Status + Actions */}
        <div className="flex items-center gap-4 md:gap-6">
          {/* Connection Status Pill */}
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-full"
            style={{
              background: '#1E1F26',
              border: '1px solid rgba(59, 75, 61, 0.2)',
            }}
          >
            <span
              className={`w-2 h-2 rounded-full ${statusConfig.dot} ${statusConfig.pulse ? 'animate-pulse-dot' : ''}`}
              style={{ backgroundColor: statusConfig.color }}
            />
            <span
              className="font-mono uppercase tracking-widest"
              style={{ fontSize: '10px', color: statusConfig.color }}
            >
              {statusConfig.text}
            </span>
            {connectionStatus === 'Polling...' && (
              <span
                className="font-mono uppercase ml-1 animate-text-pulse"
                style={{ fontSize: '10px', color: 'rgba(185, 203, 185, 0.5)' }}
              >
                ...
              </span>
            )}
          </div>

          {/* Action buttons */}
          <div className="hidden md:flex items-center gap-3">
            <button
              className="material-symbols-outlined transition-all"
              style={{ color: 'rgba(226, 226, 235, 0.6)', fontSize: '20px' }}
              onMouseEnter={(e) => (e.target.style.color = '#00FF88')}
              onMouseLeave={(e) => (e.target.style.color = 'rgba(226, 226, 235, 0.6)')}
            >
              settings
            </button>
            <button
              className="material-symbols-outlined transition-all"
              style={{ color: 'rgba(226, 226, 235, 0.6)', fontSize: '20px' }}
              onMouseEnter={(e) => (e.target.style.color = '#00FF88')}
              onMouseLeave={(e) => (e.target.style.color = 'rgba(226, 226, 235, 0.6)')}
            >
              power_settings_new
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
