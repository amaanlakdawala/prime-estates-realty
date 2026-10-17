// Shows a listing photo, or a neutral placeholder when there is none.
export default function PropertyImage({ src, alt, className = '' }) {
  if (src) {
    return <img src={src} alt={alt} loading="lazy" className={`h-full w-full object-cover ${className}`} />;
  }
  return (
    <div className={`flex h-full w-full items-center justify-center bg-mist ${className}`} role="img" aria-label="No photo yet">
      <svg width="56" height="56" viewBox="0 0 34 34" aria-hidden="true">
        <path d="M8 24V15l9-7 9 7v9h-6v-6h-6v6z" fill="#C5CCC6" />
      </svg>
    </div>
  );
}
