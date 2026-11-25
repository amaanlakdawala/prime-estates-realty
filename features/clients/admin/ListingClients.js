import { loadMatches } from './data';
import MatchCard from './MatchCard';

// On a listing's edit page: the clients this listing fits, to share it with in one tap.
export default async function ListingClients({ firm, listingId }) {
  const { matches, error } = await loadMatches(firm.id, (q) => q.eq('listing_id', listingId).neq('status', 'dismissed'), 30);
  if (error) return null; // clients system not set up yet
  return (
    <section className="mt-6 rounded-xl border border-line bg-white p-5 sm:p-6">
      <h2 className="text-xl font-semibold">Clients who want this <span className="text-base font-normal text-muted">({matches.length})</span></h2>
      {!matches.length
        ? <p className="mt-2 text-sm text-muted">No client's requirement fits this listing yet. It is checked against every new client automatically.</p>
        : <div className="mt-4 space-y-3">{matches.map((m) => <MatchCard key={m.id} m={m} show="client" canCall={firm.aiCallsEnabled} />)}</div>}
    </section>
  );
}
