import { useState, useEffect, useRef, useCallback } from 'react';
import Header from './components/Header';
import ShapeAlert from './components/ShapeAlert';
import SensorCard from './components/SensorCard';
import DiagnosticFeed from './components/DiagnosticFeed';
import EnvironmentPanel from './components/EnvironmentPanel';
import Footer from './components/Footer';
import ConnectionOverlay from './components/ConnectionOverlay';

const ESP32_URL = 'http://192.168.4.1/sensordata';
const POLL_INTERVAL = 500;

function App() {
  const [sensorData, setSensorData] = useState({
    left_dist: 0,
    center_dist: 0,
    right_dist: 0,
    shape: 'WAITING FOR DATA...',
  });
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [logs, setLogs] = useState([]);
  const errorCountRef = useRef(0);

  const addLog = useCallback((message, level = 'info') => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour12: false });
    setLogs((prev) => [{ time: timeStr, message, level }, ...prev].slice(0, 50));
  }, []);

  const fetchSensorData = useCallback(async () => {
    setConnectionStatus('Polling...');
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const response = await fetch(ESP32_URL, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      setSensorData(data);
      setConnectionStatus('Connected');
      setLastUpdated(new Date());
      errorCountRef.current = 0;

      if (data.shape && data.shape.toUpperCase().includes('CONCAVE')) {
        addLog(`SHAPE: ${data.shape}`, 'success');
      }
    } catch (error) {
      errorCountRef.current += 1;
      if (errorCountRef.current >= 5) {
        setConnectionStatus('Disconnected');
      } else {
        setConnectionStatus('Polling...');
      }
    }
  }, [addLog]);

  useEffect(() => {
    addLog('Telemetry dashboard initialized', 'info');
    addLog('Attempting connection to ESP32...', 'info');

    fetchSensorData();
    const interval = setInterval(fetchSensorData, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchSensorData, addLog]);

  const isConcave = sensorData.shape?.toUpperCase().includes('CONCAVE');
  const isDisconnected = connectionStatus === 'Disconnected';

  return (
    <div className="min-h-screen relative" style={{ background: '#0C0E14' }}>
      <Header connectionStatus={connectionStatus} />

      <main className="max-w-[1440px] mx-auto p-6 md:p-8 space-y-8 pb-20">
        {/* Shape Detection Alert */}
        <ShapeAlert
          shape={sensorData.shape}
          isConcave={isConcave}
          lastUpdated={lastUpdated}
        />

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 md:gap-8">
          {/* Sensor Grid */}
          <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6">
            <SensorCard
              label="Left Sector"
              value={sensorData.left_dist}
              icon="sensors"
              accentColor="secondary"
              delay={0}
            />
            <SensorCard
              label="Axial Center"
              value={sensorData.center_dist}
              icon="center_focus_strong"
              iconFill={true}
              accentColor="primary"
              isCenter={true}
              delay={100}
            />
            <SensorCard
              label="Right Sector"
              value={sensorData.right_dist}
              icon="sensors"
              accentColor="secondary"
              delay={200}
            />

            {/* Visualizer Panel */}
            <div
              className="md:col-span-3 glass-panel rounded-xl overflow-hidden relative animate-fade-in-up"
              style={{
                height: '24rem',
                borderColor: 'rgba(59, 75, 61, 0.1)',
                borderWidth: '1px',
                animationDelay: '300ms',
              }}
            >
              <div
                className="absolute inset-0 pointer-events-none z-10"
                style={{ background: 'rgba(12, 14, 20, 0.4)' }}
              />
              {/* Scan line animation */}
              <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    height: '2px',
                    background: 'linear-gradient(90deg, transparent, rgba(0,255,136,0.3), transparent)',
                    animation: 'scan-line 3s linear infinite',
                  }}
                />
              </div>
              <div className="absolute top-6 left-6 z-20">
                <div
                  className="flex items-center gap-2 px-3 py-1 rounded-lg"
                  style={{
                    background: 'rgba(51, 52, 59, 0.8)',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid rgba(59, 75, 61, 0.2)',
                  }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: '14px', color: '#00D2FD' }}
                  >
                    location_on
                  </span>
                  <span
                    className="font-mono"
                    style={{ fontSize: '10px', letterSpacing: '0.1em', color: '#E2E2EB' }}
                  >
                    LOCATING: SHAPE_SCAN_ACTIVE
                  </span>
                </div>
              </div>
              <div className="absolute bottom-6 right-6 z-20 flex gap-2">
                {['3D WIREFRAME', 'POINT CLOUD'].map((btn) => (
                  <button
                    key={btn}
                    className="font-mono transition-colors"
                    style={{
                      background: 'rgba(55, 57, 64, 0.8)',
                      backdropFilter: 'blur(8px)',
                      border: '1px solid rgba(59, 75, 61, 0.2)',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '10px',
                      color: '#E2E2EB',
                      cursor: 'pointer',
                    }}
                  >
                    {btn}
                  </button>
                ))}
              </div>
              {/* Concave shape SVG visualization */}
              <div className="w-full h-full flex items-center justify-center">
                <ConcaveVisualization
                  left={sensorData.left_dist}
                  center={sensorData.center_dist}
                  right={sensorData.right_dist}
                  isConcave={isConcave}
                />
              </div>
            </div>
          </div>

          {/* Side Panel */}
          <div className="space-y-6">
            <EnvironmentPanel />
            <DiagnosticFeed logs={logs} />
          </div>
        </div>
      </main>

      <Footer />

      {/* Disconnection Overlay */}
      {isDisconnected && errorCountRef.current >= 5 && (
        <ConnectionOverlay onRetry={fetchSensorData} />
      )}
    </div>
  );
}

/* Live concave shape visualization */
function ConcaveVisualization({ left, center, right, isConcave }) {
  const maxDist = 100;
  const clamp = (v) => Math.min(Math.max(v, 0), maxDist);
  const l = clamp(left);
  const c = clamp(center);
  const r = clamp(right);

  const mapY = (val) => 280 - (val / maxDist) * 200;

  const points = [
    { x: 120, y: mapY(l) },
    { x: 300, y: mapY(c) },
    { x: 480, y: mapY(r) },
  ];

  const path = `M ${points[0].x},${points[0].y} Q ${points[1].x},${points[1].y} ${points[2].x},${points[2].y}`;
  const glowColor = isConcave ? '#00FF88' : '#3CD7FF';
  const glowOpacity = isConcave ? 0.6 : 0.3;

  return (
    <svg
      viewBox="0 0 600 320"
      width="600"
      height="320"
      style={{ maxWidth: '100%', opacity: 0.9 }}
    >
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="4" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#00E479" />
          <stop offset="50%" stopColor={glowColor} />
          <stop offset="100%" stopColor="#00D2FD" />
        </linearGradient>
        <linearGradient id="fillGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={glowColor} stopOpacity={glowOpacity * 0.5} />
          <stop offset="100%" stopColor={glowColor} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {[0, 25, 50, 75, 100].map((val) => {
        const y = mapY(val);
        return (
          <g key={val}>
            <line
              x1="80" y1={y} x2="520" y2={y}
              stroke="#3B4B3D" strokeWidth="0.5"
              strokeDasharray="4,8" opacity="0.3"
            />
            <text
              x="70" y={y + 4}
              fill="#849585" fontSize="8"
              fontFamily="monospace" textAnchor="end"
            >
              {val}cm
            </text>
          </g>
        );
      })}

      {/* Fill area */}
      <path
        d={`${path} L ${points[2].x},280 L ${points[0].x},280 Z`}
        fill="url(#fillGrad)"
      />

      {/* Curve */}
      <path
        d={path} fill="none"
        stroke="url(#lineGrad)" strokeWidth="2.5"
        filter="url(#glow)"
      />

      {/* Data points */}
      {points.map((pt, i) => (
        <g key={i}>
          <circle cx={pt.x} cy={pt.y} r="8" fill={glowColor} opacity="0.15" />
          <circle cx={pt.x} cy={pt.y} r="4" fill={glowColor} filter="url(#glow)" />
          <circle cx={pt.x} cy={pt.y} r="1.5" fill="#FFFFFF" />
          <text
            x={pt.x} y={pt.y - 16}
            fill="#E2E2EB" fontSize="11"
            fontFamily="monospace" textAnchor="middle" fontWeight="600"
          >
            {[l, c, r][i]}cm
          </text>
        </g>
      ))}

      {/* Labels */}
      {['LEFT', 'CENTER', 'RIGHT'].map((lbl, i) => (
        <text
          key={lbl}
          x={[120, 300, 480][i]} y="305"
          fill="#849585" fontSize="9"
          fontFamily="'Space Grotesk'" textAnchor="middle"
          letterSpacing="0.1em"
        >
          {lbl}
        </text>
      ))}
    </svg>
  );
}

export default App;
