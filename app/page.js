import { redirect } from 'next/navigation';
import { DEFAULT_FIRM_SLUG } from '@/lib/site';

// The site root shows your demo firm. Each client firm's website is at /<their slug>.
export default function Root() {
  redirect(`/${DEFAULT_FIRM_SLUG}`);
}
