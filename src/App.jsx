import { useState, useEffect, useRef, useCallback } from 'react';
import Header from './components/Header';
import ShapeAlert from './components/ShapeAlert';
import SensorCard from './components/SensorCard';
import DiagnosticFeed from './components/DiagnosticFeed';
import EnvironmentPanel from './components/EnvironmentPanel';
import Footer from './components/Footer';

// ── Config ────────────────────────────────────────────────────────────────────
// Port changed to 5001 — avoids macOS AirPlay conflict on port 5000.
// Set DEMO_MODE = true if you want to preview the UI without the bridge running.
const BRIDGE_URL    = 'http://localhost:5001/sensordata';
const RESET_URL     = 'http://localhost:5001/reset';
const POLL_INTERVAL = 500; // ms
const DEMO_MODE     = false; // ← set true to simulate data without bridge_server.py

// ── Demo path generation ──────────────────────────────────────────────────────
function buildDemoPath(tick, shape) {
  const pts = [];
  const steps = Math.min(tick * 2, 72);

  if (shape === 'CONCAVE SHAPE DETECTED') {
    for (let i = 0; i <= steps; i++) {
      const deg = (i / 72) * 360;
      const rad = (deg * Math.PI) / 180;
      const dent = deg > 100 && deg < 180;
      const r = dent ? 22 : 44;
      pts.push({ x: Math.round(50 + r * Math.cos(rad)), y: Math.round(50 + r * Math.sin(rad)) });
    }
  } else if (shape === 'CONVEX SHAPE DETECTED') {
    for (let i = 0; i <= steps; i++) {
      const rad = ((i / 72) * 360 * Math.PI) / 180;
      pts.push({ x: Math.round(50 + 44 * Math.cos(rad)), y: Math.round(50 + 32 * Math.sin(rad)) });
    }
  } else {
    const side = Math.min(steps, 18);
    const rect = [
      { x: 18, y: 18 }, { x: 82, y: 18 }, { x: 82, y: 82 }, { x: 18, y: 82 },
    ];
    for (let i = 0; i <= side; i++) {
      const seg = Math.floor((i / 18) * 4);
      const frac = ((i / 18) * 4) - seg;
      const a = rect[seg % 4];
      const b = rect[(seg + 1) % 4];
      pts.push({ x: Math.round(a.x + frac * (b.x - a.x)), y: Math.round(a.y + frac * (b.y - a.y)) });
    }
  }
  return pts;
}

const DEMO_STAGES = [
  { shape: 'CONCAVE SHAPE DETECTED', ticks: 40, frontDist: 14, sideDist: 7,  theta: 0   },
  { shape: 'CONVEX SHAPE DETECTED',  ticks: 40, frontDist: 22, sideDist: 9,  theta: 90  },
  { shape: 'FLAT SURFACE',           ticks: 20, frontDist: 30, sideDist: 11, theta: 180 },
];

const DEMO_LOGS = [
  { message: 'ESP32: Position update received (x=34, y=18)', level: 'info'    },
  { message: 'SHAPE: Concave geometry confirmed via path analysis', level: 'success' },
  { message: 'DRIVE: Velocity adjusted — side wall detected', level: 'info'   },
  { message: 'PATH: 24 waypoints accumulated', level: 'info'                  },
  { message: 'IMU: Gyro offset corrected (+0.02 rad/s)', level: 'info'        },
  { message: 'SYSTEM: Proximity alert — front obstacle 14 cm', level: 'error' },
  { message: 'DRIVE: Turning right — side > 10 cm', level: 'warning'          },
  { message: 'SHAPE: Classification confidence 94.7 %', level: 'success'      },
  { message: 'SENSOR: Front ultrasonic nominal', level: 'info'                },
  { message: 'MOTOR: Torque limited — terrain analysis mode', level: 'warning'},
];

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [sensorData, setSensorData] = useState({
    x: 0, y: 0, theta: 0,
    front_dist: 0, side_dist: 0,
    shape: 'INITIALIZING...',
    path: [],
    is_complete: false,
    connected: false,
  });
  const [connectionStatus, setConnectionStatus] = useState(DEMO_MODE ? 'Demo' : 'Disconnected');
  const [lastUpdated, setLastUpdated]           = useState(null);
  const [logs, setLogs]                         = useState([]);
  const [bridgeError, setBridgeError]           = useState(null);

  const demoTickRef  = useRef(0);
  const demoStageRef = useRef(0);

  const addLog = useCallback((message, level = 'info') => {
    const t = new Date().toLocaleTimeString('en-US', { hour12: false });
    setLogs((prev) => [{ time: t, message, level }, ...prev].slice(0, 80));
  }, []);

  // ── Demo mode ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!DEMO_MODE) return;
    addLog('SYSTEM: Demo mode active — run bridge_server.py to go live', 'info');
    addLog('SYSTEM: Simulating ESP32 path-trace telemetry', 'info');
    setTimeout(() => addLog('SENSOR: Front & side ultrasonics online', 'success'), 700);
    setTimeout(() => addLog(`BRIDGE: Polling http://172.20.10.6/ every ${POLL_INTERVAL} ms`, 'info'), 1400);

    const interval = setInterval(() => {
      demoTickRef.current += 1;
      const stage = DEMO_STAGES[demoStageRef.current];

      if (demoTickRef.current > stage.ticks) {
        demoTickRef.current = 0;
        demoStageRef.current = (demoStageRef.current + 1) % DEMO_STAGES.length;
      }

      const tick       = demoTickRef.current;
      const path       = buildDemoPath(tick, stage.shape);
      const theta      = (tick / stage.ticks) * 360;
      const frontNoise = stage.frontDist + (Math.random() - 0.5) * 2;
      const sideNoise  = stage.sideDist  + (Math.random() - 0.5) * 1.5;
      const xPos       = path.length ? path[path.length - 1].x : 50;
      const yPos       = path.length ? path[path.length - 1].y : 50;

      setSensorData({
        x:          Math.round(xPos),
        y:          Math.round(yPos),
        theta:      +theta.toFixed(1),
        front_dist: +frontNoise.toFixed(1),
        side_dist:  +sideNoise.toFixed(1),
        shape:      tick > 5 ? stage.shape : 'SCANNING...',
        path,
        is_complete: theta >= 355,
        connected:  true,
      });
      setConnectionStatus('Demo');
      setLastUpdated(new Date());

      if (demoTickRef.current % 7 === 0) {
        const entry = DEMO_LOGS[Math.floor(Math.random() * DEMO_LOGS.length)];
        addLog(entry.message, entry.level);
      }
    }, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [addLog]);

  // ── Live mode ───────────────────────────────────────────────────────────────
  const fetchLive = useCallback(async () => {
    if (DEMO_MODE) return;
    try {
      const ctrl = new AbortController();
      const tid  = setTimeout(() => ctrl.abort(), 2500);
      const res  = await fetch(BRIDGE_URL, { signal: ctrl.signal });
      clearTimeout(tid);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      setSensorData(data);
      setBridgeError(null);
      setConnectionStatus(data.connected ? 'Connected' : 'Polling...');
      setLastUpdated(new Date());

      if (data.shape?.includes('CONCAVE'))
        addLog(`SHAPE: ${data.shape}`, 'success');
      if (data.error && data.error !== 'ESP32 unreachable')
        addLog(`ESP32 ERROR: ${data.error}`, 'error');

    } catch (err) {
      const msg = err.name === 'AbortError'
        ? 'Bridge request timed out'
        : `Cannot reach bridge: ${err.message}`;
      setConnectionStatus('Disconnected');
      setBridgeError(msg);
    }
  }, [addLog]);

  useEffect(() => {
    if (DEMO_MODE) return;
    addLog('Telemetry dashboard initialised', 'info');
    addLog(`Connecting to bridge at ${BRIDGE_URL}`, 'info');
    fetchLive();
    const id = setInterval(fetchLive, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [fetchLive, addLog]);

  // ── Reset handler ────────────────────────────────────────────────────────────
  const handleReset = useCallback(async () => {
    if (!DEMO_MODE) {
      try { await fetch(RESET_URL); } catch { /* ignore */ }
    }
    demoTickRef.current  = 0;
    demoStageRef.current = 0;
    setSensorData(s => ({ ...s, path: [], shape: 'INITIALIZING...', is_complete: false }));
    addLog('SYSTEM: Path reset — new scan started', 'warning');
  }, [addLog]);

  const isConcave = sensorData.shape?.toUpperCase().includes('CONCAVE');

  return (
    <div className="min-h-screen" style={{ background: '#0C0E14' }}>
      <Header connectionStatus={connectionStatus} />

      {/* Bridge-not-running banner */}
      {!DEMO_MODE && bridgeError && (
        <div
          className="mx-4 md:mx-8 mt-4 px-4 py-3 rounded-lg font-mono flex items-start gap-3"
          style={{ background: 'rgba(147,0,10,0.18)', border: '1px solid rgba(255,180,171,0.25)', fontSize: '0.72rem', color: '#FFB4AB', maxWidth: '1440px', marginInline: 'auto', marginTop: '1rem' }}
        >
          <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: '16px', marginTop: '1px' }}>wifi_off</span>
          <div>
            <span style={{ fontWeight: 700 }}>Bridge server unreachable — </span>
            {bridgeError}
            <span style={{ color: '#849585' }}>
              {' '}· Run: <code style={{ color: '#FFBA20' }}>pip install flask flask-cors numpy requests</code>
              {' '}then <code style={{ color: '#FFBA20' }}>python bridge_server.py</code>
            </span>
          </div>
        </div>
      )}

      <main className="max-w-[1440px] mx-auto px-4 md:px-8 pt-6 md:pt-8 pb-24 space-y-6 md:space-y-8">
        <ShapeAlert shape={sensorData.shape} isConcave={isConcave} lastUpdated={lastUpdated} />

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 md:gap-6 xl:gap-8">
          {/* Left: sensor cards + path visualizer */}
          <div className="lg:col-span-3 flex flex-col gap-4 md:gap-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
              <SensorCard
                label="Front Sensor"
                value={sensorData.front_dist}
                unit="cm"
                max={50}
                icon="sensors"
                accentColor="secondary"
                sublabel="FRONT DIST"
                delay={0}
              />
              <SensorCard
                label="Heading"
                value={sensorData.theta}
                unit="°"
                max={360}
                icon="explore"
                iconFill
                accentColor="primary"
                isCenter
                sublabel="θ ROTATION"
                delay={100}
              />
              <SensorCard
                label="Side Sensor"
                value={sensorData.side_dist}
                unit="cm"
                max={30}
                icon="sensors"
                accentColor="secondary"
                sublabel="SIDE DIST"
                delay={200}
              />
            </div>

            <PathVisualizerPanel
              path={sensorData.path}
              theta={sensorData.theta}
              isConcave={isConcave}
              isComplete={sensorData.is_complete}
              onReset={handleReset}
            />
          </div>

          {/* Right: env + logs */}
          <div className="flex flex-col gap-4 md:gap-6">
            <RobotPositionPanel x={sensorData.x} y={sensorData.y} theta={sensorData.theta} />
            <EnvironmentPanel />
            <DiagnosticFeed logs={logs} />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

// ── Robot Position mini-panel ─────────────────────────────────────────────────
function RobotPositionPanel({ x, y, theta }) {
  const items = [
    { label: 'X POS',  value: x,     unit: 'u', color: '#00FF88' },
    { label: 'Y POS',  value: y,     unit: 'u', color: '#00D2FD' },
    { label: 'θ HEAD', value: theta, unit: '°', color: '#FFBA20' },
  ];
  return (
    <div className="rounded-xl animate-fade-in-up"
      style={{ background: '#1E1F26', border: '1px solid rgba(59,75,61,0.12)', padding: '1.25rem' }}>
      <h3 className="font-headline uppercase font-semibold mb-3"
        style={{ fontSize: '9px', letterSpacing: '0.2em', color: '#849585' }}>
        Robot Position
      </h3>
      <div className="space-y-2.5">
        {items.map(({ label, value, unit, color }) => (
          <div key={label} className="flex justify-between items-center">
            <span className="font-mono uppercase" style={{ fontSize: '9px', color: '#849585', letterSpacing: '0.06em' }}>
              {label}
            </span>
            <span className="font-mono transition-all duration-300" style={{ fontSize: '0.85rem', color, fontWeight: 600 }}>
              {typeof value === 'number' ? value.toFixed(value % 1 === 0 ? 0 : 1) : value}
              <span style={{ fontSize: '0.6rem', color: '#849585', marginLeft: '2px' }}>{unit}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Path Visualizer Panel ─────────────────────────────────────────────────────
function PathVisualizerPanel({ path, theta, isConcave, isComplete, onReset }) {
  const glowColor = isConcave ? '#00FF88' : '#3CD7FF';

  return (
    <div className="glass-panel rounded-xl overflow-hidden relative animate-fade-in-up"
      style={{ minHeight: '22rem', border: '1px solid rgba(59,75,61,0.12)', animationDelay: '300ms' }}>
      <div className="absolute inset-0 pointer-events-none z-10"
        style={{ background: 'rgba(12,14,20,0.35)' }} />
      <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
        <div className="scan-line" />
      </div>

      <div className="absolute top-4 left-4 md:top-6 md:left-6 z-20">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
          style={{ background: 'rgba(51,52,59,0.85)', backdropFilter: 'blur(8px)', border: '1px solid rgba(59,75,61,0.2)' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '13px', color: glowColor }}>route</span>
          <span className="font-mono" style={{ fontSize: '9px', letterSpacing: '0.12em', color: '#E2E2EB' }}>
            PATH_TRACE_{isComplete ? 'COMPLETE' : 'ACTIVE'}
          </span>
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isComplete ? '' : 'animate-pulse-dot'}`}
            style={{ background: glowColor }} />
        </div>
      </div>

      <div className="absolute bottom-4 right-4 md:bottom-6 md:right-6 z-20 flex gap-2">
        <span className="font-mono" style={{ fontSize: '9px', color: '#849585', alignSelf: 'center' }}>
          {path.length} pts
        </span>
        <button onClick={onReset}
          className="font-mono transition-all hover:scale-105 active:scale-95"
          style={{ background: 'rgba(55,57,64,0.8)', backdropFilter: 'blur(8px)', border: '1px solid rgba(59,75,61,0.2)', padding: '5px 11px', borderRadius: '6px', fontSize: '9px', color: '#B9CBB9', cursor: 'pointer' }}>
          ↺ RESET
        </button>
        <button
          className="font-mono transition-all hover:scale-105 active:scale-95"
          style={{ background: 'rgba(55,57,64,0.8)', backdropFilter: 'blur(8px)', border: '1px solid rgba(59,75,61,0.2)', padding: '5px 11px', borderRadius: '6px', fontSize: '9px', color: '#B9CBB9', cursor: 'pointer' }}>
          EXPORT CSV
        </button>
      </div>

      <div className="w-full h-full flex items-center justify-center p-4 md:p-6" style={{ minHeight: '22rem' }}>
        <PathVisualization path={path} theta={theta} isConcave={isConcave} isComplete={isComplete} />
      </div>
    </div>
  );
}

// ── Path Visualization SVG ────────────────────────────────────────────────────
function PathVisualization({ path, theta, isConcave, isComplete }) {
  const W = 600, H = 300;
  const PAD = 40;
  const glowColor = isConcave ? '#00FF88' : '#3CD7FF';

  let scaledPoints = [];
  let robotX = W / 2, robotY = H / 2;

  if (path && path.length > 1) {
    const xs = path.map(p => p.x);
    const ys = path.map(p => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;
    const scaleX = (W - PAD * 2) / rangeX;
    const scaleY = (H - PAD * 2) / rangeY;
    const scale  = Math.min(scaleX, scaleY);

    scaledPoints = path.map(p => ({
      x: PAD + (p.x - minX) * scale + (W - PAD * 2 - rangeX * scale) / 2,
      y: PAD + (p.y - minY) * scale + (H - PAD * 2 - rangeY * scale) / 2,
    }));

    if (scaledPoints.length > 0) {
      const last = scaledPoints[scaledPoints.length - 1];
      robotX = last.x;
      robotY = last.y;
    }
  }

  const polyline = scaledPoints.map(p => `${p.x},${p.y}`).join(' ');
  const progress = Math.min((theta / 360) * 100, 100);
  const robotAngle = (theta * Math.PI) / 180;
  const arrowDx = 12 * Math.cos(robotAngle);
  const arrowDy = 12 * Math.sin(robotAngle);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" style={{ maxHeight: '320px' }}>
      <defs>
        <filter id="pathGlow">
          <feGaussianBlur stdDeviation="4" result="coloredBlur" />
          <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <linearGradient id="pathGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#00E479" />
          <stop offset="50%" stopColor={glowColor} />
          <stop offset="100%" stopColor="#00D2FD" />
        </linearGradient>
        <marker id="arrow" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill={glowColor} opacity="0.7" />
        </marker>
      </defs>

      {[0, 1, 2, 3, 4].map(i => (
        <g key={i}>
          <line x1={PAD + i * (W - PAD * 2) / 4} y1={PAD} x2={PAD + i * (W - PAD * 2) / 4} y2={H - PAD}
            stroke="#3B4B3D" strokeWidth="0.5" strokeDasharray="4,8" opacity="0.3" />
          <line x1={PAD} y1={PAD + i * (H - PAD * 2) / 4} x2={W - PAD} y2={PAD + i * (H - PAD * 2) / 4}
            stroke="#3B4B3D" strokeWidth="0.5" strokeDasharray="4,8" opacity="0.3" />
        </g>
      ))}

      {path.length === 0 && (
        <>
          <text x={W / 2} y={H / 2 - 12} fill="#3B4B3D" fontSize="13" fontFamily="monospace"
            textAnchor="middle">AWAITING ROBOT PATH DATA</text>
          <text x={W / 2} y={H / 2 + 10} fill="#2A2C33" fontSize="9" fontFamily="monospace"
            textAnchor="middle">Start bridge_server.py and power on the ESP32</text>
        </>
      )}

      {scaledPoints.length > 2 && (
        <polyline points={polyline} fill="none"
          stroke={glowColor} strokeWidth="1" opacity="0.2" strokeLinejoin="round" />
      )}
      {scaledPoints.length > 2 && (
        <polyline points={polyline} fill="none"
          stroke="url(#pathGrad)" strokeWidth="2.5"
          filter="url(#pathGlow)" strokeLinejoin="round"
          strokeLinecap="round"
          markerEnd="url(#arrow)" />
      )}

      {scaledPoints.filter((_, i) => i % 8 === 0 && i > 0).map((pt, i) => (
        <circle key={i} cx={pt.x} cy={pt.y} r="2" fill={glowColor} opacity="0.4" />
      ))}

      {scaledPoints.length > 0 && (
        <g>
          <circle cx={scaledPoints[0].x} cy={scaledPoints[0].y} r="7"
            fill="rgba(0,255,136,0.12)" stroke="#00FF88" strokeWidth="1.5" />
          <text x={scaledPoints[0].x} y={scaledPoints[0].y - 12}
            fill="#849585" fontSize="8" fontFamily="monospace" textAnchor="middle">START</text>
        </g>
      )}

      {scaledPoints.length > 0 && !isComplete && (
        <g>
          <circle cx={robotX} cy={robotY} r="14" fill={glowColor} opacity="0.08" />
          <circle cx={robotX} cy={robotY} r="6" fill={glowColor} filter="url(#pathGlow)" />
          <circle cx={robotX} cy={robotY} r="3" fill="#FFFFFF" />
          <line x1={robotX} y1={robotY} x2={robotX + arrowDx} y2={robotY + arrowDy}
            stroke={glowColor} strokeWidth="2" opacity="0.8" />
        </g>
      )}

      {isComplete && scaledPoints.length > 2 && (
        <>
          <polyline
            points={[...scaledPoints, scaledPoints[0]].map(p => `${p.x},${p.y}`).join(' ')}
            fill={isConcave ? 'rgba(0,255,136,0.06)' : 'rgba(0,210,253,0.06)'}
            stroke="none" />
          <text x={W / 2} y={H - 10} fill={glowColor} fontSize="10" fontFamily="'Space Grotesk', sans-serif"
            textAnchor="middle" letterSpacing="0.15em" opacity="0.7">
            SCAN COMPLETE
          </text>
        </>
      )}

      {(() => {
        const cx = W - 50, cy = 42, r = 22;
        const angle = Math.min((theta / 360) * 2 * Math.PI, 2 * Math.PI * 0.999);
        const ex = cx + r * Math.cos(-Math.PI / 2 + angle);
        const ey = cy + r * Math.sin(-Math.PI / 2 + angle);
        const large = angle > Math.PI ? 1 : 0;
        return (
          <g>
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1E1F26" strokeWidth="4" />
            {theta > 1 && (
              <path
                d={`M ${cx} ${cy - r} A ${r} ${r} 0 ${large} 1 ${ex} ${ey}`}
                fill="none" stroke={glowColor} strokeWidth="4" strokeLinecap="round"
                filter="url(#pathGlow)" />
            )}
            <text x={cx} y={cy + 4} fill={glowColor} fontSize="9" fontFamily="monospace"
              textAnchor="middle" fontWeight="700">{Math.round(progress)}%</text>
            <text x={cx} y={cy + 18} fill="#849585" fontSize="7" fontFamily="monospace"
              textAnchor="middle">SWEEP</text>
          </g>
        );
      })()}
    </svg>
  );
}