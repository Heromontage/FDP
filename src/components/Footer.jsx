export default function Footer() {
  return (
    <footer
      className="w-full fixed bottom-0 z-50"
      style={{
        background: '#0C0E14',
        borderTop: '1px solid rgba(55, 57, 64, 0.1)',
      }}
    >
      <div className="flex flex-col md:flex-row justify-between items-center px-4 md:px-8 py-2 w-full gap-1">
        <div className="flex items-center gap-3">
          <span
            className="material-symbols-outlined"
            style={{ fontSize: '14px', color: '#00FF88' }}
          >
            smart_toy
          </span>
          <span
            className="font-mono uppercase"
            style={{ fontSize: '10px', letterSpacing: '0.1em', color: '#00FF88' }}
          >
            SYSTEM NODE: ALPHA-7 // SHAPE ANALYSIS ENGINE
          </span>
        </div>
        <div className="flex gap-4 md:gap-8">
          <span
            className="font-mono uppercase transition-colors cursor-default"
            style={{ fontSize: '10px', letterSpacing: '0.1em', color: '#373940' }}
          >
            LATENCY: 12ms
          </span>
          <span
            className="font-mono uppercase transition-colors cursor-default"
            style={{ fontSize: '10px', letterSpacing: '0.1em', color: '#373940' }}
          >
            UPTIME: 99.9%
          </span>
          <a
            href="#"
            className="font-mono uppercase transition-colors"
            style={{
              fontSize: '10px',
              letterSpacing: '0.1em',
              color: '#373940',
              textDecoration: 'underline',
              textUnderlineOffset: '4px',
            }}
            onMouseEnter={(e) => (e.target.style.color = '#00FF88')}
            onMouseLeave={(e) => (e.target.style.color = '#373940')}
          >
            DOCS
          </a>
        </div>
      </div>
    </footer>
  );
}
