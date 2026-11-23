import { createRoot } from 'react-dom/client';
import '../../../index.css';
import { BACKGROUNDS } from './index.js';

function Gallery() {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, 320px)',
        gap: 12,
        padding: 12,
        background: '#222',
        minHeight: '100vh',
      }}
    >
      {Object.entries(BACKGROUNDS).map(([name, Bg]) => (
        <div key={name} style={{ width: 320, height: 200, position: 'relative', background: '#000', overflow: 'hidden' }}>
          <Bg />
          <span
            style={{
              position: 'absolute',
              left: 6,
              top: 4,
              zIndex: 2,
              color: '#fff',
              font: '12px monospace',
              textShadow: '0 0 3px #000',
              pointerEvents: 'none',
            }}
          >
            {name}
          </span>
        </div>
      ))}
    </div>
  );
}

createRoot(document.getElementById('root')).render(<Gallery />);
