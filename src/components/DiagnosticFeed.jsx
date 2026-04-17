export default function DiagnosticFeed({ logs }) {
  const levelStyle = (level) => {
    switch (level) {
      case 'success': return { border: '#00FF88', time: '#00FF88' };
      case 'warning': return { border: '#FFBA20', time: '#FFBA20' };
      case 'error':   return { border: '#FFB4AB', time: '#FFB4AB' };
      default:        return { border: '#3B4B3D', time: '#849585' };
    }
  };

  const errorCount = logs.filter((l) => l.level === 'error').length;

  return (
    <div className="rounded-xl animate-fade-in-up flex flex-col"
      style={{ background: '#282A30', border: '1px solid rgba(59,75,61,0.12)', padding: '1.25rem', animationDelay: '500ms', flex: 1 }}>

      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <h3 className="font-headline uppercase font-semibold"
          style={{ fontSize: '9px', letterSpacing: '0.2em', color: '#849585' }}>
          Diagnostic Feed
        </h3>
        <div className="flex items-center gap-2">
          {errorCount > 0 && (
            <span className="font-mono px-1.5 py-0.5 rounded"
              style={{ fontSize: '8px', color: '#FFB4AB', background: 'rgba(255,180,171,0.12)' }}>
              {errorCount} ERR
            </span>
          )}
          <span className="font-mono" style={{ fontSize: '8px', color: '#3B4B3D' }}>
            {logs.length} entries
          </span>
        </div>
      </div>

      <div className="space-y-2.5 overflow-y-auto pr-1" style={{ maxHeight: '320px' }}>
        {logs.map((log, i) => {
          const s = levelStyle(log.level);
          const opacity = i === 0 ? 1 : i < 3 ? 0.85 : i < 6 ? 0.6 : 0.3;
          return (
            <div key={i} className="pl-3 py-1 font-mono leading-relaxed"
              style={{ fontSize: '8.5px', borderLeft: `2px solid ${s.border}`, opacity }}>
              <div className="mb-0.5" style={{ color: s.time }}>{log.time}</div>
              <div style={{ color: '#C8C8D4', lineHeight: 1.45 }}>{log.message}</div>
            </div>
          );
        })}
        {logs.length === 0 && (
          <div className="font-mono text-center py-6" style={{ fontSize: '9px', color: '#3B4B3D' }}>
            No entries yet...
          </div>
        )}
      </div>
    </div>
  );
}