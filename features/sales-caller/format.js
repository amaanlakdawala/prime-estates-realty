// How a sales call reads in the admin panel and the lead's history. No server code: the browser uses it too.

export const minutes = (s) => (s >= 60 ? `${Math.floor(s / 60)} min ${s % 60} s` : `${s} s`);

// Sarvam's charge for one call, estimated: ₹3.50 per started minute of agent time plus ₹0.20 per started
// 30 seconds of phone line. Unanswered calls are counted as free.
export function estimatedCost(call) {
  const s = call.status === 'done' ? call.duration_secs ?? 0 : 0;
  return s ? Math.ceil(s / 60) * 3.5 + Math.ceil(s / 30) * 0.2 : 0;
}

// The call's result in a word or two, for the calls table, with a colour: good, bad or neutral.
export function callOutcome(call) {
  const r = call.result ?? {};
  if (call.status === 'placing') return { label: 'Calling…', tone: 'neutral' };
  if (call.status === 'failed') return { label: 'Failed', tone: 'bad' };
  if (call.status !== 'done') return { label: 'No answer', tone: 'neutral' };
  if (r.do_not_call) return { label: 'Do not call', tone: 'bad' };
  if (r.demo_time) return { label: 'Demo booked', tone: 'good' };
  if (r.interested) return { label: 'Interested', tone: 'good' };
  if (r.interested === false) return { label: 'Not interested', tone: 'bad' };
  return { label: 'Answered', tone: 'neutral' };
}

// One line for the lead's history: what happened and what to do next.
export function describeCall(info) {
  if (info.status !== 'done') return info.status === 'failed' ? `AI call failed: ${info.error ?? 'not placed'}` : 'AI call: no answer.';
  const r = info.result ?? {};
  return [
    `AI call, ${minutes(info.duration_secs ?? 0)}.`,
    r.firm_heard && `Firm: ${r.firm_heard}.`,
    r.do_not_call ? 'Asked not to be called again.' : r.interested ? 'Interested.' : r.interested === false ? 'Not interested.' : '',
    r.demo_time && `Demo booked: ${r.demo_time}.`,
    r.whatsapp_ok && `Send the demo link and pricing on WhatsApp.`,
    r.callback_time && `Call back: ${r.callback_time}.`,
    r.lead_sources && `Gets leads from: ${r.lead_sources}.`,
    r.website_status && `Website: ${r.website_status}.`,
    r.objection && `Concern: ${r.objection}.`,
  ].filter(Boolean).join(' ');
}
