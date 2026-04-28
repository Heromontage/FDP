import { useState, useEffect, useRef, useCallback } from 'react';
import Header from './components/Header';
import ShapeAlert from './components/ShapeAlert';
import SensorCard from './components/SensorCard';
import DiagnosticFeed from './components/DiagnosticFeed';
import EnvironmentPanel from './components/EnvironmentPanel';
import Footer from './components/Footer';

// ── Config ────────────────────────────────────────────────────────────────────
const BRIDGE_URL    = 'http://localhost:5001/sensordata';
const RESET_URL     = 'http://localhost:5001/reset';
const POLL_INTERVAL = 500;
const DEMO_MODE     = false;

// ── Demo path generation ──────────────────────────────────────────────────────
function buildDemoPath(tick, shape) {
  const pts   = [];
  const steps = Math.min(tick * 2, 72);
  if (shape === 'CONCAVE SHAPE DETECTED') {
    for (let i = 0; i <= steps; i++) {
      const deg  = (i / 72) * 360;
      const rad  = (deg * Math.PI) / 180;
      const dent = deg > 100 && deg < 180;
      const r    = dent ? 22 : 44;
      pts.push({ x: Math.round(50 + r * Math.cos(rad)), y: Math.round(50 + r * Math.sin(rad)) });
    }
  } else if (shape === 'CONVEX SHAPE DETECTED') {
    for (let i = 0; i <= steps; i++) {
      const rad = ((i / 72) * 360 * Math.PI) / 180;
      pts.push({ x: Math.round(50 + 44 * Math.cos(rad)), y: Math.round(50 + 32 * Math.sin(rad)) });
    }
  } else {
    const side = Math.min(steps, 18);
    const rect = [{ x: 18, y: 18 }, { x: 82, y: 18 }, { x: 82, y: 82 }, { x: 18, y: 82 }];
    for (let i = 0; i <= side; i++) {
      const seg  = Math.floor((i / 18) * 4);
      const frac = ((i / 18) * 4) - seg;
      const a    = rect[seg % 4];
      const b    = rect[(seg + 1) % 4];
      pts.push({ x: Math.round(a.x + frac * (b.x - a.x)), y: Math.round(a.y + frac * (b.y - a.y)) });
    }
  }
  return pts;
}

const DEMO_STAGES = [
  { shape: 'CONCAVE SHAPE DETECTED', ticks: 40, frontDist: 14, sideFront: 7,  sideBack: 8,  theta: 0  },
  { shape: 'CONVEX SHAPE DETECTED',  ticks: 40, frontDist: 22, sideFront: 9,  sideBack: 10, theta: 90 },
  { shape: 'SCANNING...',            ticks: 20, frontDist: 30, sideFront: 11, sideBack: 12, theta: 180},
];

const DEMO_LOGS = [
  { message: 'ESP32: Position update received',           level: 'info'    },
  { message: 'SHAPE: Concave geometry confirmed',         level: 'success' },
  { message: 'DRIVE: Velocity adjusted — wall detected',  level: 'info'    },
  { message: 'IMU: Gyro offset corrected (+0.02 rad/s)',  level: 'info'    },
  { message: 'SYSTEM: Proximity alert — 14 cm ahead',     level: 'error'   },
  { message: 'DRIVE: Turning right — side > 10 cm',       level: 'warning' },
  { message: 'SHAPE: Classification confidence 94.7%',    level: 'success' },
  { message: 'SENSOR: Front ultrasonic nominal',          level: 'info'    },
  { message: 'MOTOR: Torque limited — terrain mode',      level: 'warning' },
];

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [sensorData, setSensorData] = useState({
    x: 0, y: 0, theta: 0,
    front_dist:      0,
    side_front_dist: 0,
    side_back_dist:  0,
    shape:    'INITIALIZING...',
    esp_msg:  '',           // raw ESP statusMsg (FOLLOW / TURN / CONCAVE etc.)
    path:         [],
    is_complete:  false,
    connected:    false,
  });
  const [connectionStatus, setConnectionStatus] = useState(DEMO_MODE ? 'Demo' : 'Disconnected');
  const [lastUpdated, setLastUpdated]           = useState(null);
  const [logs, setLogs]                         = useState([]);
  const [bridgeError, setBridgeError]           = useState(null);

  const demoTickRef   = useRef(0);
  const demoStageRef  = useRef(0);
  const lastErrorRef  = useRef(null);
  const lastShapeRef  = useRef(null);
  const lastEspMsgRef = useRef(null);   // track ESP msg changes for log dedup

  const addLog = useCallback((message, level = 'info') => {
    const t = new Date().toLocaleTimeString('en-US', { hour12: false });
    setLogs(prev => [{ time: t, message, level }, ...prev].slice(0, 80));
  }, []);

  // ── Demo mode ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!DEMO_MODE) return;
    addLog('SYSTEM: Demo mode active — run bridge_server.py to go live', 'info');
    setTimeout(() => addLog('SENSOR: All ultrasonics online', 'success'), 700);

    const interval = setInterval(() => {
      demoTickRef.current += 1;
      const stage = DEMO_STAGES[demoStageRef.current];
      if (demoTickRef.current > stage.ticks) {
        demoTickRef.current = 0;
        demoStageRef.current = (demoStageRef.current + 1) % DEMO_STAGES.length;
      }
      const tick   = demoTickRef.current;
      const path   = buildDemoPath(tick, stage.shape);
      const theta  = (tick / stage.ticks) * 360;
      const noise  = () => (Math.random() - 0.5) * 2;

      setSensorData({
        x:               path.length ? path[path.length - 1].x : 50,
        y:               path.length ? path[path.length - 1].y : 50,
        theta:           +theta.toFixed(1),
        front_dist:      +(stage.frontDist + noise()).toFixed(1),
        side_front_dist: +(stage.sideFront + noise()).toFixed(1),
        side_back_dist:  +(stage.sideBack  + noise()).toFixed(1),
        shape:           tick > 5 ? stage.shape : 'SCANNING...',
        esp_msg:         'DEMO',
        path,
        is_complete:     theta >= 355,
        connected:       true,
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

  // ── Live mode ──────────────────────────────────────────────────────────────
  const fetchLive = useCallback(async () => {
    if (DEMO_MODE) return;
    try {
      const ctrl = new AbortController();
      const tid  = setTimeout(() => ctrl.abort(), 2500);
      const res  = await fetch(BRIDGE_URL, { signal: ctrl.signal });
      clearTimeout(tid);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();

      // Safe defaults for fields the bridge may not always populate
      data.front_dist      = data.front_dist      ?? 0;
      data.side_front_dist = data.side_front_dist ?? 0;
      data.side_back_dist  = data.side_back_dist  ?? 0;
      data.esp_msg         = data.esp_msg         ?? '';

      setSensorData(data);
      setBridgeError(null);
      setConnectionStatus(data.connected ? 'Connected' : 'Polling...');
      setLastUpdated(new Date());

      // ── Shape log: fire once per shape transition (CONCAVE and CONVEX) ──
      const shapeUpper = (data.shape ?? '').toUpperCase();
      const shapeIsResult = shapeUpper.includes('CONCAVE') || shapeUpper.includes('CONVEX');
      if (shapeIsResult && data.shape !== lastShapeRef.current) {
        const lvl = shapeUpper.includes('CONCAVE') ? 'success' : 'warning';
        addLog(`SHAPE DETECTED: ${data.shape}`, lvl);
        lastShapeRef.current = data.shape;
      }
      // Reset tracker when back to scanning so the next result fires again
      if (!shapeIsResult) lastShapeRef.current = null;

      // ── ESP status-change log (deduplicated) ────────────────────────────
      if (data.esp_msg && data.esp_msg !== lastEspMsgRef.current) {
        const msgUpper = data.esp_msg.toUpperCase();
        const lvl =
          msgUpper.includes('CONCAVE') ? 'success' :
          msgUpper.includes('CONVEX')  ? 'warning' :
          msgUpper === 'TOO CLOSE'     ? 'error'   : 'info';
        addLog(`ESP32 STATUS: ${data.esp_msg}`, lvl);
        lastEspMsgRef.current = data.esp_msg;
      }

      // ── Connection-error log (deduplicated) ─────────────────────────────
      if (data.error) {
        if (data.error !== lastErrorRef.current) {
          addLog(`ESP32 ERROR: ${data.error}`, 'error');
          lastErrorRef.current = data.error;
        }
      } else {
        if (lastErrorRef.current !== null) {
          addLog('ESP32: Connection restored', 'success');
          lastErrorRef.current = null;
        }
      }

      // ── Sensor-range warnings ───────────────────────────────────────────
      // ESP getDist() returns 400 when no echo received (timeout)
      if (data.side_front_dist >= 390)
        addLog('SENSOR: Side-front out of range — check FR/echoFR wiring (GPIO 17)', 'warning');
      if (data.side_back_dist >= 390)
        addLog('SENSOR: Side-back out of range — check MR/echoMR wiring (GPIO 19)', 'warning');
      if (data.front_dist >= 390)
        addLog('SENSOR: Front out of range — check F/echoF wiring (GPIO 4)', 'warning');

    } catch (err) {
      const msg = err.name === 'AbortError'
        ? 'Bridge request timed out'
        : `Cannot reach bridge: ${err.message}`;
      setConnectionStatus('Disconnected');
      if (msg !== lastErrorRef.current) {
        setBridgeError(msg);
        lastErrorRef.current = msg;
      }
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

  // ── Reset ──────────────────────────────────────────────────────────────────
  const handleReset = useCallback(async () => {
    if (!DEMO_MODE) {
      try { await fetch(RESET_URL); } catch { /* ignore */ }
    }
    demoTickRef.current   = 0;
    demoStageRef.current  = 0;
    lastShapeRef.current  = null;
    lastEspMsgRef.current = null;
    setSensorData(s => ({
      ...s,
      path: [], shape: 'INITIALIZING...', is_complete: false, esp_msg: '',
      front_dist: 0, side_front_dist: 0, side_back_dist: 0, theta: 0,
    }));
    addLog('SYSTEM: State reset — new scan started', 'warning');
  }, [addLog]);

  const isConcave = sensorData.shape?.toUpperCase().includes('CONCAVE');

  return (
    <div className="min-h-screen" style={{ background: '#0C0E14' }}>
      <Header connectionStatus={connectionStatus} />

      {!DEMO_MODE && bridgeError && (
        <div
          className="mx-4 md:mx-8 mt-4 px-4 py-3 rounded-lg font-mono flex items-start gap-3"
          style={{
            background: 'rgba(147,0,10,0.18)', border: '1px solid rgba(255,180,171,0.25)',
            fontSize: '0.72rem', color: '#FFB4AB',
            maxWidth: '1440px', marginInline: 'auto', marginTop: '1rem',
          }}
        >
          <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: '16px', marginTop: '1px' }}>wifi_off</span>
          <div>
            <span style={{ fontWeight: 700 }}>Bridge server unreachable — </span>
            {bridgeError}
            <span style={{ color: '#849585' }}>
              {' '}· Run:{' '}
              <code style={{ color: '#FFBA20' }}>pip install flask flask-cors numpy requests</code>
              {' '}then{' '}
              <code style={{ color: '#FFBA20' }}>python bridge_server.py 172.20.10.6</code>
            </span>
          </div>
        </div>
      )}

      <main className="max-w-[1440px] mx-auto px-4 md:px-8 pt-6 md:pt-8 pb-24 space-y-6 md:space-y-8">
        <ShapeAlert shape={sensorData.shape} isConcave={isConcave} lastUpdated={lastUpdated} />

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 md:gap-6 xl:gap-8">
          <div className="lg:col-span-3 flex flex-col gap-4 md:gap-6">

            {/* Row 1 — three ultrasonic sensors (the only real data from ESP) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
              <SensorCard
                label="Side Front"
                value={sensorData.side_front_dist}
                unit="cm"
                max={80}
                icon="sensors"
                accentColor="secondary"
                sublabel="FR SENSOR"
                delay={0}
              />
              <SensorCard
                label="Front"
                value={sensorData.front_dist}
                unit="cm"
                max={100}
                icon="radar"
                iconFill
                accentColor="primary"
                isCenter
                sublabel="FRONT SENSOR"
                delay={100}
              />
              <SensorCard
                label="Side Back"
                value={sensorData.side_back_dist}
                unit="cm"
                max={80}
                icon="sensors"
                accentColor="secondary"
                sublabel="BR SENSOR"
                delay={200}
              />
            </div>

            {/* Row 2 — theta + two computed metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
              {/* Proximity gap between side-front and side-back */}
              <SensorCard
                label="SF Gap"
                value={Math.max(0, sensorData.side_back_dist - sensorData.side_front_dist)}
                unit="cm"
                max={60}
                icon="compare_arrows"
                accentColor="secondary"
                sublabel="FRONT-BACK Δ"
                delay={300}
              />
              {/* Heading / cumulative rotation from ESP */}
              <SensorCard
                label="Rotation θ"
                value={sensorData.theta % 360}           // display as 0-360 slice
                unit="°"
                max={360}
                icon="360"
                iconFill
                accentColor="primary"
                isCenter
                sublabel="CUM. SWEEP"
                delay={400}
              />
              {/* Minimum of the two side sensors — indicates wall proximity */}
              <SensorCard
                label="Wall Dist"
                value={Math.min(
                  sensorData.side_front_dist > 0 ? sensorData.side_front_dist : 999,
                  sensorData.side_back_dist  > 0 ? sensorData.side_back_dist  : 999
                ) === 999 ? 0 :
                  Math.min(
                    sensorData.side_front_dist > 0 ? sensorData.side_front_dist : 999,
                    sensorData.side_back_dist  > 0 ? sensorData.side_back_dist  : 999
                  )
                }
                unit="cm"
                max={80}
                icon="square_foot"
                accentColor="secondary"
                sublabel="NEAREST SIDE"
                delay={500}
              />
            </div>

            <PathVisualizerPanel
              path={sensorData.path}
              theta={sensorData.theta}
              espMsg={sensorData.esp_msg}
              isConcave={isConcave}
              isComplete={sensorData.is_complete}
              onReset={handleReset}
            />
          </div>

          <div className="flex flex-col gap-4 md:gap-6">
            <EspStatusPanel
              espMsg={sensorData.esp_msg}
              theta={sensorData.theta}
              frontDist={sensorData.front_dist}
              sideFront={sensorData.side_front_dist}
              sideBack={sensorData.side_back_dist}
              connected={sensorData.connected}
            />
            <EnvironmentPanel />
            <DiagnosticFeed logs={logs} />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

// ── ESP Status Panel (replaces RobotPositionPanel) ───────────────────────────
function EspStatusPanel({ espMsg, theta, frontDist, sideFront, sideBack, connected }) {
  // Interpret the ESP's raw statusMsg into a readable state
  const msgUpper = (espMsg || '').toUpperCase();
  const stateColor =
    msgUpper.includes('CONCAVE') ? '#00FF88' :
    msgUpper.includes('CONVEX')  ? '#FFBA20' :
    msgUpper === 'FOLLOW'        ? '#00D2FD' :
    msgUpper === 'TURN'          ? '#FFBA20' :
    msgUpper === 'TOO CLOSE'     ? '#FFB4AB' :
    msgUpper === 'STOPPED'       ? '#FFB4AB' :
    '#849585';

  const items = [
    { label: 'ESP STATUS',   value: espMsg || '—',                  unit: '',   color: stateColor        },
    { label: 'ROTATION',     value: `${theta.toFixed(0)}`,          unit: '°',  color: '#00FF88'         },
    { label: 'FRONT DIST',   value: frontDist >= 390 ? '—' : frontDist.toFixed(1), unit: 'cm', color: frontDist < 15 ? '#FFB4AB' : '#00FF88' },
    { label: 'SIDE FRONT',   value: sideFront >= 390 ? '—' : sideFront.toFixed(1), unit: 'cm', color: '#00D2FD' },
    { label: 'SIDE BACK',    value: sideBack  >= 390 ? '—' : sideBack.toFixed(1),  unit: 'cm', color: '#00D2FD' },
  ];

  return (
    <div className="rounded-xl animate-fade-in-up"
      style={{ background: '#1E1F26', border: '1px solid rgba(59,75,61,0.12)', padding: '1.25rem' }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-headline uppercase font-semibold"
          style={{ fontSize: '9px', letterSpacing: '0.2em', color: '#849585' }}>
          ESP32 State
        </h3>
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${connected ? 'animate-pulse-dot' : ''}`}
          style={{ background: connected ? '#00FF88' : '#FFB4AB' }} />
      </div>

      <div className="space-y-2.5">
        {items.map(({ label, value, unit, color }) => (
          <div key={label} className="flex justify-between items-center">
            <span className="font-mono uppercase" style={{ fontSize: '9px', color: '#849585', letterSpacing: '0.06em' }}>
              {label}
            </span>
            <span className="font-mono transition-all duration-300" style={{ fontSize: '0.85rem', color, fontWeight: 600 }}>
              {value}
              {unit && <span style={{ fontSize: '0.6rem', color: '#849585', marginLeft: '2px' }}>{unit}</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Path Visualizer Panel ─────────────────────────────────────────────────────
function PathVisualizerPanel({ path, theta, espMsg, isConcave, isComplete, onReset }) {
  const glowColor = isConcave ? '#00FF88' : '#3CD7FF';
  return (
    <div className="glass-panel rounded-xl overflow-hidden relative animate-fade-in-up"
      style={{ minHeight: '22rem', border: '1px solid rgba(59,75,61,0.12)', animationDelay: '600ms' }}>
      <div className="absolute inset-0 pointer-events-none z-10" style={{ background: 'rgba(12,14,20,0.35)' }} />
      <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden"><div className="scan-line" /></div>

      <div className="absolute top-4 left-4 md:top-6 md:left-6 z-20">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
          style={{ background: 'rgba(51,52,59,0.85)', backdropFilter: 'blur(8px)', border: '1px solid rgba(59,75,61,0.2)' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '13px', color: glowColor }}>route</span>
          <span className="font-mono" style={{ fontSize: '9px', letterSpacing: '0.12em', color: '#E2E2EB' }}>
            SWEEP_{isComplete ? 'COMPLETE' : 'ACTIVE'}
          </span>
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isComplete ? '' : 'animate-pulse-dot'}`}
            style={{ background: glowColor }} />
        </div>
      </div>

      {/* ESP raw msg badge */}
      {espMsg && (
        <div className="absolute top-4 right-16 md:top-6 z-20">
          <span className="font-mono px-2 py-1 rounded"
            style={{ fontSize: '8px', letterSpacing: '0.08em',
              background: 'rgba(51,52,59,0.85)', color: glowColor,
              border: '1px solid rgba(59,75,61,0.2)' }}>
            {espMsg}
          </span>
        </div>
      )}

      <div className="absolute bottom-4 right-4 md:bottom-6 md:right-6 z-20 flex gap-2">
        <button onClick={onReset}
          className="font-mono transition-all hover:scale-105 active:scale-95"
          style={{ background: 'rgba(55,57,64,0.8)', backdropFilter: 'blur(8px)',
            border: '1px solid rgba(59,75,61,0.2)', padding: '5px 11px',
            borderRadius: '6px', fontSize: '9px', color: '#B9CBB5', letterSpacing: '0.08em' }}>
          ↺ RESET
        </button>
      </div>

      <div className="w-full h-full flex items-center justify-center p-4 md:p-6" style={{ minHeight: '22rem' }}>
        <SweepVisualization path={path} theta={theta} isConcave={isConcave} isComplete={isComplete} />
      </div>
    </div>
  );
}

// ── Sweep Visualization — works with or without path data ─────────────────────
// The ESP32 has no odometry so path will always be [].
// We show an arc-based sweep diagram driven purely by theta (cumulative rotation).
function SweepVisualization({ path, theta, isConcave, isComplete }) {
  const W = 600, H = 300;
  const glowColor  = isConcave ? '#00FF88' : '#3CD7FF';
  const haspath    = path && path.length > 1;

  // Sweep arc centred in the right portion of the canvas
  const cx = W * 0.72, cy = H * 0.5, R = 100;
  // Clamp degrees to full circles (robot can rotate >360°)
  const totalDeg   = Math.min(theta, 1500);            // ESP targetAngle = 1500
  const arcDeg     = Math.min(totalDeg, 360);
  const arcRad     = (arcDeg * Math.PI) / 180;
  const progress   = Math.min((totalDeg / 1500) * 100, 100);  // 0-100%

  // Arc end-point
  const ex = cx + R * Math.cos(-Math.PI / 2 + arcRad);
  const ey = cy + R * Math.sin(-Math.PI / 2 + arcRad);
  const largeArc = arcDeg > 180 ? 1 : 0;

  // Robot arrow direction (current heading)
  const headRad  = (((theta % 360) * Math.PI) / 180) - Math.PI / 2;
  const arrowLen = 18;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" style={{ maxHeight: '320px' }}>
      <defs>
        <filter id="glow2">
          <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
          <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <linearGradient id="arcGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#00E479"/>
          <stop offset="100%" stopColor={glowColor}/>
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {[0,1,2,3,4].map(i => (
        <g key={i}>
          <line x1={40+i*104} y1={20} x2={40+i*104} y2={H-20} stroke="#3B4B3D" strokeWidth="0.5" strokeDasharray="4,8" opacity="0.25"/>
          <line x1={40} y1={20+i*52} x2={W-40} y2={20+i*52} stroke="#3B4B3D" strokeWidth="0.5" strokeDasharray="4,8" opacity="0.25"/>
        </g>
      ))}

      {/* ── Left panel: sensor bar chart ─────────────────────────────── */}
      {/* Placeholder label */}
      <text x="160" y="40" fill="#3B4B3D" fontSize="9" fontFamily="monospace" textAnchor="middle" letterSpacing="0.15em">
        SENSOR OVERVIEW
      </text>

      {/* Status label */}
      {!haspath && theta === 0 && (
        <>
          <text x="160" y="155" fill="#3B4B3D" fontSize="11" fontFamily="monospace" textAnchor="middle">AWAITING SCAN</text>
          <text x="160" y="175" fill="#2A2C33" fontSize="9"  fontFamily="monospace" textAnchor="middle">Power on ESP32 and press START</text>
        </>
      )}

      {/* Rotation count badge (shows laps) */}
      {theta > 360 && (
        <text x="160" y="270" fill={glowColor} fontSize="9" fontFamily="monospace" textAnchor="middle" opacity="0.6">
          {Math.floor(theta / 360)}× full rotation
        </text>
      )}

      {/* ── Right panel: sweep arc ───────────────────────────────────── */}
      {/* Background circle */}
      <circle cx={cx} cy={cy} r={R} fill="none" stroke="#1E1F26" strokeWidth="10"/>
      <circle cx={cx} cy={cy} r={R} fill="none" stroke="#3B4B3D" strokeWidth="1" strokeDasharray="6,10" opacity="0.4"/>

      {/* Swept arc */}
      {arcDeg > 0.5 && (
        <path
          d={`M ${cx} ${cy - R} A ${R} ${R} 0 ${largeArc} 1 ${ex} ${ey}`}
          fill="none"
          stroke={`url(#arcGrad)`}
          strokeWidth="10"
          strokeLinecap="round"
          filter="url(#glow2)"
          opacity="0.85"
        />
      )}

      {/* Full-circle highlight when complete */}
      {isComplete && (
        <circle cx={cx} cy={cy} r={R} fill="none"
          stroke={glowColor} strokeWidth="2"
          strokeDasharray="6,6"
          opacity="0.4"/>
      )}

      {/* Centre — robot icon */}
      <circle cx={cx} cy={cy} r={22} fill="rgba(30,31,38,0.9)" stroke={glowColor} strokeWidth="1.5"/>
      <text x={cx} y={cy - 4} fill={glowColor} fontSize="10" fontFamily="monospace" textAnchor="middle" fontWeight="700">
        {Math.round(theta % 360)}°
      </text>
      <text x={cx} y={cy + 10} fill="#849585" fontSize="7" fontFamily="monospace" textAnchor="middle">θ</text>

      {/* Heading arrow */}
      {theta > 0 && !isComplete && (
        <line
          x1={cx} y1={cy}
          x2={cx + arrowLen * Math.cos(headRad)}
          y2={cy + arrowLen * Math.sin(headRad)}
          stroke={glowColor} strokeWidth="2.5" strokeLinecap="round"
        />
      )}

      {/* Progress ring label */}
      <text x={cx} y={cy + R + 22} fill={glowColor} fontSize="9" fontFamily="monospace" textAnchor="middle" letterSpacing="0.12em">
        {Math.round(progress)}% SWEEP
      </text>

      {/* COMPLETE badge */}
      {isComplete && (
        <text x={cx} y={cy - R - 14} fill={glowColor} fontSize="10" fontFamily="'Space Grotesk', sans-serif" textAnchor="middle" letterSpacing="0.15em" opacity="0.8">
          SCAN COMPLETE
        </text>
      )}
    </svg>
  );
}