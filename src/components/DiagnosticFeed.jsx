export default function DiagnosticFeed({ logs }) {
  const getLevelStyle = (level) => {
    switch (level) {
      case 'success':
        return { borderColor: '#00FF88', timeColor: '#00FF88' };
      case 'warning':
        return { borderColor: '#FFB800', timeColor: '#FFB800' };
      case 'error':
        return { borderColor: '#FFB4AB', timeColor: '#FFB4AB' };
      default:
        return { borderColor: '#3B4B3D', timeColor: '#B9CBB9' };
    }
  };

  return (
    <div
      className="p-5 md:p-6 rounded-xl animate-fade-in-up"
      style={{
        background: '#282A30',
        border: '1px solid rgba(59, 75, 61, 0.1)',
        animationDelay: '500ms',
      }}
    >
      <h3
        className="font-headline uppercase font-bold mb-4"
        style={{ fontSize: '10px', letterSpacing: '0.2em', color: '#B9CBB9' }}
      >
        Diagnostic Feed
      </h3>
      <div
        className="space-y-3 overflow-y-auto pr-2"
        style={{ maxHeight: '400px' }}
      >
        {logs.map((log, i) => {
          const style = getLevelStyle(log.level);
          return (
            <div
              key={i}
              className="font-mono leading-relaxed py-1 pl-3"
              style={{
                fontSize: '9px',
                borderLeft: `2px solid ${style.borderColor}`,
                opacity: i > 5 ? 0.4 : 1 - i * 0.08,
              }}
            >
              <div style={{ color: style.timeColor }}>{log.time}</div>
              <div style={{ color: '#E2E2EB' }}>{log.message}</div>
            </div>
          );
        })}
        {logs.length === 0 && (
          <div
            className="font-mono text-center py-4"
            style={{ fontSize: '10px', color: '#849585' }}
          >
            No entries yet...
          </div>
        )}
      </div>
    </div>
  );
}
