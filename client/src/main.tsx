import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './main.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <div className="h-full bg-[#0c0c0c] text-white flex items-center justify-center">
      agent-mux client
    </div>
  </StrictMode>,
);
