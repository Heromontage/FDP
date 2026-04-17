export default function Footer() {
  return (
    <footer
      className="w-full fixed bottom-0 z-50"
      style={{ background: 'rgba(12,14,20,0.97)', borderTop: '1px solid rgba(55,57,64,0.15)', backdropFilter: 'blur(10px)' }}
    >
      <div className="flex flex-col sm:flex-row justify-between items-center px-4 md:px-8 py-2 w-full max-w-[1440px] mx-auto gap-0.5">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full animate-pulse-dot flex-shrink-0" style={{ background: '#00FF88' }} />
            <span className="material-symbols-outlined" style={{ fontSize: '13px', color: '#00FF88' }}>smart_toy</span>
          </div>
          <span className="font-mono uppercase" style={{ fontSize: '9px', letterSpacing: '0.12em', color: '#00FF88' }}>
            SYSTEM NODE: ALPHA-7 // SHAPE ANALYSIS ENGINE
          </span>
          <span className="hidden sm:inline font-mono uppercase" style={{ fontSize: '8px', color: '#2A2C33', letterSpacing: '0.08em' }}>
            • DEMO MODE ACTIVE
          </span>
        </div>

        <div className="flex gap-4 md:gap-6 items-center">
          {[['LATENCY', '12ms'], ['UPTIME', '99.9%']].map(([k, v]) => (
            <div key={k} className="flex items-center gap-1.5">
              <span className="font-mono uppercase" style={{ fontSize: '8px', letterSpacing: '0.08em', color: '#2A2C33' }}>{k}:</span>
              <span className="font-mono" style={{ fontSize: '8px', color: '#3B4B3D' }}>{v}</span>
            </div>
          ))}
          <a href="#" className="font-mono uppercase transition-colors"
            style={{ fontSize: '8px', letterSpacing: '0.08em', color: '#3B4B3D', textDecoration: 'underline', textUnderlineOffset: '3px' }}
            onMouseEnter={(e) => (e.target.style.color = '#00FF88')}
            onMouseLeave={(e) => (e.target.style.color = '#3B4B3D')}>
            DOCS
          </a>
        </div>
      </div>
    </footer>
  );
}