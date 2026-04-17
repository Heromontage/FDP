import { useState, useEffect, useRef, useCallback } from 'react';
import Header from './components/Header';
import ShapeAlert from './components/ShapeAlert';
import SensorCard from './components/SensorCard';
import DiagnosticFeed from './components/DiagnosticFeed';
import EnvironmentPanel from './components/EnvironmentPanel';
import Footer from './components/Footer';

const ESP32_URL = 'http://192.168.4.1/sensordata';
const POLL_INTERVAL = 500;
const DEMO_MODE = true; // Set to false when ESP32 is connected

const DEMO_SEQUENCES = [
  { left: 72, center: 38, right: 68, shape: 'CONCAVE SHAPE DETECTED' },
  { left: 74, center: 35, right: 71, shape: 'CONCAVE SHAPE DETECTED' },
  { left: 70, center: 40, right: 73, shape: 'CONCAVE SHAPE DETECTED' },
  { left: 55, center: 52, right: 58, shape: 'FLAT SURFACE' },
  { left: 50, center: 51, right: 49, shape: 'FLAT SURFACE' },
  { left: 42, center: 68, right: 44, shape: 'CONVEX SHAPE DETECTED' },
  { left: 38, center: 72, right: 40, shape: 'CONVEX SHAPE DETECTED' },
  { left: 60, center: 38, right: 62, shape: 'CONCAVE SHAPE DETECTED' },
];

const DEMO_LOG_ENTRIES = [
  { message: 'LIDAR: Surface curvature threshold exceeded (0.82)', level: 'success' },
  { message: 'DRIVE: Velocity adjusted to 0.4 m/s', level: 'info' },
  { message: 'SHAPE: Concave geometry confirmed — depth 33cm', level: 'success' },
  { message: 'IMU: Gyro offset corrected (+0.02 rad/s)', level: 'info' },
  { message: 'SENSOR: Right ultrasonic ping nominal', level: 'info' },
  { message: 'SYSTEM: Proximity Alert Zone Alpha triggered', level: 'error' },
  { message: 'CALIBRATION: IMU baseline recalibrated', level: 'info' },
  { message: 'DRIVE: Halting — concave shape lock acquired', level: 'warning' },
  { message: 'LIDAR: Re-scan initiated — 360° sweep', level: 'info' },
  { message: 'SHAPE: Classification confidence 94.7%', level: 'success' },
  { message: 'SENSOR: Left channel SNR within bounds', level: 'info' },
  { message: 'MOTOR: Torque limited to 60% — terrain analysis mode', level: 'warning' },
];

function generateDemoData(seq, noise = 3) {
  const rand = (v) => v + (Math.random() - 0.5) * noise;
  return {
    left_dist: Math.round(rand(seq.left)),
    center_dist: Math.round(rand(seq.center)),
    right_dist: Math.round(rand(seq.right)),
    shape: seq.shape,
  };
}

export default function App() {
  const [sensorData, setSensorData] = useState({
    left_dist: 0, center_dist: 0, right_dist: 0, shape: 'INITIALIZING...',
  });
  const [connectionStatus, setConnectionStatus] = useState(DEMO_MODE ? 'Demo' : 'Disconnected');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [logs, setLogs] = useState([]);
  const demoSeqRef = useRef(0);
  const demoTickRef = useRef(0);

  const addLog = useCallback((message, level = 'info') => {
    const timeStr = new Date().toLocaleTimeString('en-US', { hour12: false });
    setLogs((prev) => [{ time: timeStr, message, level }, ...prev].slice(0, 60));
  }, []);

  // ── Demo mode ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!DEMO_MODE) return;
    addLog('SYSTEM: Demo mode active — ESP32 not required', 'info');
    addLog('SYSTEM: Telemetry simulation initialized', 'info');
    setTimeout(() => addLog('SENSOR: All three ultrasonic channels online', 'success'), 600);
    setTimeout(() => addLog('LIDAR: Baseline scan complete', 'info'), 1200);
    setTimeout(() => addLog('DRIVE: Standby — awaiting shape lock', 'info'), 1800);

    const interval = setInterval(() => {
      demoTickRef.current += 1;
      if (demoTickRef.current % 8 === 0)
        demoSeqRef.current = (demoSeqRef.current + 1) % DEMO_SEQUENCES.length;

      const data = generateDemoData(DEMO_SEQUENCES[demoSeqRef.current]);
      setSensorData(data);
      setConnectionStatus('Demo');
      setLastUpdated(new Date());

      if (demoTickRef.current % 6 === 0) {
        const entry = DEMO_LOG_ENTRIES[Math.floor(Math.random() * DEMO_LOG_ENTRIES.length)];
        addLog(entry.message, entry.level);
      }
    }, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [addLog]);

  // ── Live mode ──────────────────────────────────────────────────────────────
  const fetchSensorData = useCallback(async () => {
    if (DEMO_MODE) return;
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
      if (data.shape?.toUpperCase().includes('CONCAVE'))
        addLog(`SHAPE: ${data.shape}`, 'success');
    } catch {
      setConnectionStatus('Disconnected');
    }
  }, [addLog]);

  useEffect(() => {
    if (DEMO_MODE) return;
    addLog('Telemetry dashboard initialized', 'info');
    addLog('Attempting connection to ESP32...', 'info');
    fetchSensorData();
    const interval = setInterval(fetchSensorData, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchSensorData, addLog]);

  const isConcave = sensorData.shape?.toUpperCase().includes('CONCAVE');

  return (
    <div className="min-h-screen" style={{ background: '#0C0E14' }}>
      <Header connectionStatus={connectionStatus} />

      <main className="max-w-[1440px] mx-auto px-4 md:px-8 pt-6 md:pt-8 pb-24 space-y-6 md:space-y-8">
        <ShapeAlert shape={sensorData.shape} isConcave={isConcave} lastUpdated={lastUpdated} />

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 md:gap-6 xl:gap-8">
          {/* Left: sensors + visualizer */}
          <div className="lg:col-span-3 flex flex-col gap-4 md:gap-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
              <SensorCard label="Left Sector" value={sensorData.left_dist} icon="sensors" accentColor="secondary" delay={0} />
              <SensorCard label="Axial Center" value={sensorData.center_dist} icon="center_focus_strong" iconFill accentColor="primary" isCenter delay={100} />
              <SensorCard label="Right Sector" value={sensorData.right_dist} icon="sensors" accentColor="secondary" delay={200} />
            </div>
            <VisualizerPanel
              left={sensorData.left_dist}
              center={sensorData.center_dist}
              right={sensorData.right_dist}
              isConcave={isConcave}
            />
          </div>

          {/* Right: env + logs */}
          <div className="flex flex-col gap-4 md:gap-6">
            <EnvironmentPanel />
            <DiagnosticFeed logs={logs} />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

// ── Visualizer Panel ──────────────────────────────────────────────────────────
function VisualizerPanel({ left, center, right, isConcave }) {
  return (
    <div
      className="glass-panel rounded-xl overflow-hidden relative animate-fade-in-up"
      style={{ minHeight: '22rem', border: '1px solid rgba(59,75,61,0.12)', animationDelay: '300ms' }}
    >
      <div className="absolute inset-0 pointer-events-none z-10" style={{ background: 'rgba(12,14,20,0.35)' }} />
      <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
        <div className="scan-line" />
      </div>

      {/* Top-left badge */}
      <div className="absolute top-4 left-4 md:top-6 md:left-6 z-20">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
          style={{ background: 'rgba(51,52,59,0.85)', backdropFilter: 'blur(8px)', border: '1px solid rgba(59,75,61,0.2)' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '13px', color: '#00D2FD' }}>radar</span>
          <span className="font-mono" style={{ fontSize: '9px', letterSpacing: '0.12em', color: '#E2E2EB' }}>
            SHAPE_SCAN_ACTIVE
          </span>
          <span className="w-1.5 h-1.5 rounded-full animate-pulse-dot flex-shrink-0"
            style={{ background: isConcave ? '#00FF88' : '#3CD7FF' }} />
        </div>
      </div>

      {/* Bottom-right buttons */}
      <div className="absolute bottom-4 right-4 md:bottom-6 md:right-6 z-20 flex gap-2">
        {['3D WIREFRAME', 'POINT CLOUD'].map((btn) => (
          <button key={btn} className="font-mono transition-all hover:scale-105 active:scale-95"
            style={{ background: 'rgba(55,57,64,0.8)', backdropFilter: 'blur(8px)', border: '1px solid rgba(59,75,61,0.2)', padding: '5px 11px', borderRadius: '6px', fontSize: '9px', color: '#B9CBB9', cursor: 'pointer' }}>
            {btn}
          </button>
        ))}
      </div>

      <div className="w-full h-full flex items-center justify-center p-4 md:p-6" style={{ minHeight: '22rem' }}>
        <ConcaveVisualization left={left} center={center} right={right} isConcave={isConcave} />
      </div>
    </div>
  );
}

// ── Concave Visualization SVG ─────────────────────────────────────────────────
function ConcaveVisualization({ left, center, right, isConcave }) {
  const clamp = (v) => Math.min(Math.max(v || 0, 0), 100);
  const l = clamp(left), c = clamp(center), r = clamp(right);
  const mapY = (val) => 270 - (val / 100) * 200;

  const pts = [
    { x: 110, y: mapY(l) },
    { x: 300, y: mapY(c) },
    { x: 490, y: mapY(r) },
  ];
  const glowColor = isConcave ? '#00FF88' : '#3CD7FF';
  const path = `M ${pts[0].x},${pts[0].y} Q ${pts[1].x},${pts[1].y} ${pts[2].x},${pts[2].y}`;

  return (
    <svg viewBox="0 0 600 300" width="100%" height="100%" style={{ maxHeight: '320px' }}>
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="5" result="coloredBlur" />
          <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#00E479" />
          <stop offset="50%" stopColor={glowColor} />
          <stop offset="100%" stopColor="#00D2FD" />
        </linearGradient>
        <linearGradient id="fillGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={glowColor} stopOpacity="0.18" />
          <stop offset="100%" stopColor={glowColor} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Grid */}
      {[0, 25, 50, 75, 100].map((val) => (
        <g key={val}>
          <line x1="80" y1={mapY(val)} x2="520" y2={mapY(val)} stroke="#3B4B3D" strokeWidth="0.6" strokeDasharray="5,10" opacity="0.4" />
          <text x="68" y={mapY(val) + 4} fill="#849585" fontSize="8.5" fontFamily="monospace" textAnchor="end">{val}</text>
        </g>
      ))}

      {/* Vertical guides */}
      {pts.map((pt, i) => (
        <line key={i} x1={pt.x} y1={pt.y} x2={pt.x} y2={mapY(0)} stroke={glowColor} strokeWidth="0.5" strokeDasharray="3,6" opacity="0.2" />
      ))}

      {/* Fill + curve */}
      <path d={`${path} L ${pts[2].x},${mapY(0)} L ${pts[0].x},${mapY(0)} Z`} fill="url(#fillGrad)" />
      <path d={path} fill="none" stroke="url(#lineGrad)" strokeWidth="2.5" filter="url(#glow)" />
      <path d={path} fill="none" stroke="url(#lineGrad)" strokeWidth="0.8" opacity="0.4" />

      {/* Data points */}
      {pts.map((pt, i) => (
        <g key={i}>
          <circle cx={pt.x} cy={pt.y} r="12" fill={glowColor} opacity="0.08" />
          <circle cx={pt.x} cy={pt.y} r="5" fill={glowColor} filter="url(#glow)" />
          <circle cx={pt.x} cy={pt.y} r="2" fill="#FFFFFF" />
          <text x={pt.x} y={pt.y - 18} fill="#E2E2EB" fontSize="12" fontFamily="monospace" textAnchor="middle" fontWeight="700">
            {[l, c, r][i]}<tspan fontSize="8" fill="#849585">cm</tspan>
          </text>
        </g>
      ))}

      {/* Labels */}
      {['LEFT', 'CENTER', 'RIGHT'].map((lbl, i) => (
        <text key={lbl} x={[110, 300, 490][i]} y="293" fill="#849585" fontSize="8.5"
          fontFamily="'Space Grotesk', sans-serif" textAnchor="middle" letterSpacing="0.12em">
          {lbl}
        </text>
      ))}
      <text x="22" y="170" fill="#3B4B3D" fontSize="8" fontFamily="monospace"
        textAnchor="middle" transform="rotate(-90, 22, 170)">DIST (cm)</text>
    </svg>
  );
}