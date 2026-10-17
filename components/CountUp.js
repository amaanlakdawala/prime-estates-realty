'use client';

import { useEffect, useRef, useState } from 'react';

// A number that counts up from 0 when it scrolls into view. The real number is in the HTML from the start,
// so it reads correctly without JavaScript and for screen readers.
export default function CountUp({ to, suffix = '', duration = 1400 }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(to);
  useEffect(() => {
    const el = ref.current;
    if (!el || !('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    setShown(0);
    let frame;
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      io.disconnect();
      const start = performance.now();
      const tick = (now) => {
        const t = Math.min(1, (now - start) / duration);
        setShown(Math.round(to * (1 - (1 - t) ** 3))); // eases out
        if (t < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(frame); };
  }, [to, duration]);
  return <span ref={ref} aria-label={`${to}${suffix}`}>{shown}{suffix}</span>;
}
