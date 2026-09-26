'use client';

import { useState } from 'react';
import PropertyImage from './PropertyImage';

export default function Gallery({ photos = [], title }) {
  const [active, setActive] = useState(0);
  if (!photos.length) {
    return <div className="aspect-[16/10] overflow-hidden rounded-xl"><PropertyImage alt={title} /></div>;
  }
  return (
    <div>
      <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-stone">
        <img src={photos[active]} alt={`${title}, photo ${active + 1} of ${photos.length}`} className="h-full w-full object-cover" />
        {photos.length > 1 && (
          <>
            <button type="button" onClick={() => setActive((active - 1 + photos.length) % photos.length)} className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-basalt hover:bg-white" aria-label="Previous photo">‹</button>
            <button type="button" onClick={() => setActive((active + 1) % photos.length)} className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-basalt hover:bg-white" aria-label="Next photo">›</button>
            <span className="absolute bottom-3 right-3 rounded-full bg-basalt/80 px-3 py-1 text-xs font-medium text-white">{active + 1} / {photos.length}</span>
          </>
        )}
      </div>
      {photos.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {photos.map((src, i) => (
            <button key={src} type="button" onClick={() => setActive(i)} className={`h-16 w-24 flex-none overflow-hidden rounded-md border-2 ${i === active ? 'border-teal' : 'border-transparent opacity-70 hover:opacity-100'}`} aria-label={`Show photo ${i + 1}`} aria-current={i === active}>
              <img src={src} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
