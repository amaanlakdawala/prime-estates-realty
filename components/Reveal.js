'use client';

import { useEffect, useRef } from 'react';

// Fades its content up into view the first time it scrolls onto the screen.
// <Reveal delay={100}>…</Reveal>; effect="fade" (no movement) or "zoom". Styles in app/globals.css.
export default function Reveal({ children, as: Tag = 'div', delay = 0, effect = 'up', className = '', ...rest }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (!('IntersectionObserver' in window)) { el.classList.add('is-visible'); return undefined; }
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { el.classList.add('is-visible'); io.disconnect(); }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const variant = effect === 'fade' ? ' reveal-fade' : effect === 'zoom' ? ' reveal-zoom' : '';
  return (
    <Tag ref={ref} className={`reveal${variant} ${className}`} style={delay ? { '--reveal-delay': `${delay}ms` } : undefined} {...rest}>
      {children}
    </Tag>
  );
}
