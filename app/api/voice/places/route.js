// Thin route: the logic lives in features/knowledge-base/api.js.
import { placesHandler } from '@/features/knowledge-base/api';

export const dynamic = 'force-dynamic';
export const GET = placesHandler;
export const POST = placesHandler;
