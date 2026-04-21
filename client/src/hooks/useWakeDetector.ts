import { useEffect } from 'react';

export const WAKE_EVENT = 'agent-mux:wake';

// If a 1s interval fires more than this late, the machine almost certainly slept.
const SLEEP_THRESHOLD_MS = 5000;
const TICK_INTERVAL_MS = 1000;

export function useWakeDetector() {
  useEffect(() => {
    let last = Date.now();
    const id = window.setInterval(() => {
      const now = Date.now();
      if (now - last > SLEEP_THRESHOLD_MS) {
        window.dispatchEvent(new Event(WAKE_EVENT));
      }
      last = now;
    }, TICK_INTERVAL_MS);

    const onlineHandler = () => {
      window.dispatchEvent(new Event(WAKE_EVENT));
    };
    window.addEventListener('online', onlineHandler);

    return () => {
      window.clearInterval(id);
      window.removeEventListener('online', onlineHandler);
    };
  }, []);
}
