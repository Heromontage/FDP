import { useState, useEffect } from 'react';

export default function EnvironmentPanel() {
  const [env, setEnv] = useState({ coreTemp: 34.2, battery: 82, incline: 2.4, signal: 87 });

  useEffect(() => {
    const interval = setInterval(() => {
      setEnv((p) => ({
        coreTemp: +(p.coreTemp + (Math.random() - 0.5) * 0.3).toFixed(1),
        battery:  +(Math.max(0, p.battery - (Math.random() > 0.85 ? 0.05 : 0))).toFixed(1),
        incline:  +(p.incline  + (Math.random() - 0.5) * 0.15).toFixed(1),
        signal:   Math.max(40, Math.min(100, Math.round(p.signal + (Math.random() - 0.5) * 3))),
      }));
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const metrics = [
    { label: 'CORE TEMP', value: `${env.coreTemp.toFixed(1)}°C`, icon: 'thermostat', bar: (env.coreTemp / 60) * 100,
      color: env.coreTemp > 45 ? '#FFB4AB' : env.coreTemp > 38 ? '#FFBA20' : '#00FF88' },
    { label: 'BATTERY',   value: `${Math.round(env.battery)}%`,  icon: 'battery_4_bar', bar: env.battery,
      color: env.battery < 20 ? '#FFB4AB' : env.battery < 40 ? '#FFBA20' : '#00D2FD' },
    { label: 'INCLINE',   value: `${Math.abs(env.incline).toFixed(1)}°`, icon: 'terrain', bar: Math.abs(env.incline) * 5,
      color: '#FFBA20' },
    { label: 'SIGNAL',    value: `${env.signal}%`, icon: 'wifi', bar: env.signal,
      color: env.signal < 50 ? '#FFB4AB' : '#00FF88' },
  ];

  return (
    <div className="rounded-xl animate-fade-in-up"
      style={{ background: '#1E1F26', border: '1px solid rgba(59,75,61,0.12)', padding: '1.25rem', animationDelay: '400ms' }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-headline uppercase font-semibold"
          style={{ fontSize: '9px', letterSpacing: '0.2em', color: '#849585' }}>
          Environmental
        </h3>
        <span className="material-symbols-outlined" style={{ fontSize: '14px', color: '#3B4B3D' }}>monitor_heart</span>
      </div>

      <div className="space-y-3.5">
        {metrics.map((m) => (
          <div key={m.label}>
            <div className="flex justify-between items-center mb-1">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined" style={{ fontSize: '12px', color: m.color, opacity: 0.7 }}>{m.icon}</span>
                <span className="font-mono uppercase" style={{ fontSize: '9px', color: '#849585', letterSpacing: '0.06em' }}>{m.label}</span>
              </div>
              <span className="font-mono transition-all duration-500" style={{ fontSize: '0.8rem', color: m.color, fontWeight: 600 }}>
                {m.value}
              </span>
            </div>
            <div className="w-full rounded-full overflow-hidden" style={{ height: '2px', background: '#0C0E14' }}>
              <div className="h-full rounded-full transition-all duration-700 ease-out"
                style={{ width: `${Math.min(100, m.bar)}%`, background: m.color, opacity: 0.6 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}