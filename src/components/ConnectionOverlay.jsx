import { useState } from 'react';

export default function ConnectionOverlay({ onRetry }) {
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    setRetrying(true);
    await onRetry();
    setTimeout(() => setRetrying(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[100] connection-overlay flex items-center justify-center">
      <div
        className="text-center p-8 md:p-12 rounded-2xl max-w-md mx-4 animate-fade-in-up"
        style={{
          background: 'rgba(30, 31, 38, 0.9)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 180, 171, 0.2)',
          boxShadow: '0 0 40px rgba(255, 68, 68, 0.1)',
        }}
      >
        {/* Warning icon with pulse */}
        <div
          className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center"
          style={{
            background: 'rgba(147, 0, 10, 0.2)',
            border: '2px solid rgba(255, 180, 171, 0.3)',
          }}
        >
          <span
            className="material-symbols-outlined animate-text-pulse"
            style={{
              fontSize: '2.5rem',
              color: '#FFB4AB',
              fontVariationSettings: "'FILL' 1",
            }}
          >
            wifi_off
          </span>
        </div>

        <h2
          className="font-headline text-2xl font-bold mb-2"
          style={{ color: '#FFB4AB' }}
        >
          CONNECTION LOST
        </h2>
        <p
          className="font-mono mb-1"
          style={{ fontSize: '0.75rem', color: '#B9CBB9', letterSpacing: '0.05em' }}
        >
          Lost connection to ESP32 robot controller
        </p>
        <p
          className="font-mono mb-8"
          style={{ fontSize: '0.65rem', color: '#849585' }}
        >
          http://192.168.4.1/sensordata unreachable
        </p>

        <button
          onClick={handleRetry}
          disabled={retrying}
          className="font-headline uppercase tracking-widest transition-all"
          style={{
            background: retrying
              ? 'rgba(55, 57, 64, 0.5)'
              : 'linear-gradient(135deg, #00E479, #00FF88)',
            color: retrying ? '#849585' : '#007139',
            padding: '12px 32px',
            borderRadius: '8px',
            border: 'none',
            fontSize: '0.8rem',
            fontWeight: 600,
            cursor: retrying ? 'wait' : 'pointer',
            transform: retrying ? 'scale(0.98)' : 'scale(1)',
          }}
        >
          {retrying ? 'RECONNECTING...' : 'RETRY CONNECTION'}
        </button>

        <div
          className="mt-6 flex items-center justify-center gap-2"
          style={{ color: '#849585' }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
            info
          </span>
          <span className="font-mono" style={{ fontSize: '9px' }}>
            Ensure the robot is powered on and in Wi-Fi range
          </span>
        </div>
      </div>
    </div>
  );
}
