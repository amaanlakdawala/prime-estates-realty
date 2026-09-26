import { STORAGE_BUCKET } from './site';

// Turns a public image URL back into its path inside the storage bucket.
export function storagePathFromUrl(url) {
  if (!url) return null;
  const marker = `/object/public/${STORAGE_BUCKET}/`;
  const i = url.indexOf(marker);
  return i === -1 ? null : decodeURIComponent(url.slice(i + marker.length));
}

export async function removeImages(supabase, urls) {
  const paths = urls.map(storagePathFromUrl).filter(Boolean);
  if (paths.length) await supabase.storage.from(STORAGE_BUCKET).remove(paths);
}
