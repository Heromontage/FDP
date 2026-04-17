import { useState, useEffect } from 'react';

export default function EnvironmentPanel() {
  const [envData, setEnvData] = useState({
    coreTemp: 34.2,
    battery: 82,
    incline: 2.4,
  });

  // Simulate subtle env data changes
  useEffect(() => {
    const interval = setInterval(() => {
      setEnvData((prev) => ({
        coreTemp: Math.round((prev.coreTemp + (Math.random() - 0.5) * 0.4) * 10) / 10,
        battery: Math.max(0, Math.min(100, prev.battery + (Math.random() > 0.7 ? -0.1 : 0))),
        incline: Math.round((prev.incline + (Math.random() - 0.5) * 0.2) * 10) / 10,
      }));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const metrics = [
    {
      label: 'CORE TEMP',
      value: `${envData.coreTemp.toFixed(1)}°C`,
      color: envData.coreTemp > 40 ? '#FFB4AB' : '#00FF88',
    },
    {
      label: 'BATTERY',
      value: `${Math.round(envData.battery)}%`,
      color: envData.battery < 20 ? '#FFB4AB' : '#00D2FD',
    },
    {
      label: 'INCLINE',
      value: `${envData.incline.toFixed(1)}°`,
      color: '#FFBA20',
    },
  ];

  return (
    <div
      className="p-5 md:p-6 rounded-xl animate-fade-in-up"
      style={{
        background: '#1E1F26',
        border: '1px solid rgba(59, 75, 61, 0.1)',
        animationDelay: '400ms',
      }}
    >
      <h3
        className="font-headline uppercase font-bold mb-4"
        style={{ fontSize: '10px', letterSpacing: '0.2em', color: '#B9CBB9' }}
      >
        Environmental
      </h3>
      <div className="space-y-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="flex justify-between items-center">
            <span
              className="font-mono"
              style={{ fontSize: '0.75rem', color: '#B9CBB9' }}
            >
              {metric.label}
            </span>
            <span
              className="font-mono transition-colors duration-300"
              style={{ fontSize: '0.875rem', color: metric.color }}
            >
              {metric.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
