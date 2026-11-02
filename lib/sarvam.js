// AI calling through Sarvam AI (Riya with the Kavya voice, Indian numbers): the pilot alternative to
// ElevenLabs + Twilio. Server only: uses secret keys. Sarvam reports each finished call to
// /api/voice/sarvam-webhook, so calls are never polled.
const API = 'https://apps.sarvam.ai/api/outbounds/v1';

// Our calls rows keep Sarvam's attempt id with this prefix, which is how the rest of the app tells them apart.
export const SARVAM_PREFIX = 'sarvam:';
export const isSarvamCall = (conversationId) => Boolean(conversationId?.startsWith(SARVAM_PREFIX));

const settings = () => ({
  apiKey: process.env.SARVAM_AGENTS_API_KEY,
  org: process.env.SARVAM_ORG_ID || '01a18876-5fd6-7b98-8531-d4996b3eadf7',
  workspace: process.env.SARVAM_WORKSPACE_ID || '01a18876-5fe0-77fc-8962-5f7e7a8dee3b',
  appId: process.env.SARVAM_APP_ID || 'Riya-proper-598c396f-ae7e',
  appVersion: Number(process.env.SARVAM_APP_VERSION) || 1, // the committed agent version; bump after each commit in Sarvam
  connectionId: process.env.SARVAM_CONNECTION_ID, // the phone line in Sarvam (Voice Agents -> Telephony)
  agentNumber: process.env.SARVAM_AGENT_NUMBER, // the number calls go out from, as Sarvam stores it
  // Where Sarvam reports results: Netlify sets URL (the site's main address) at build time, and not always
  // for the running server, hence the fallbacks.
  site: process.env.URL || process.env.DEPLOY_PRIME_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://nexorautomate.netlify.app',
});

// app: another Sarvam agent than Riya's, e.g. the sales caller ({ id, version, webhookPath }).
export async function placeSarvamCall({ toNumber, variables, app = null }) {
  const s = settings();
  const missing = Object.entries({
    SARVAM_AGENTS_API_KEY: s.apiKey, SARVAM_CONNECTION_ID: s.connectionId, SARVAM_AGENT_NUMBER: s.agentNumber,
    VOICE_TOOL_SECRET: process.env.VOICE_TOOL_SECRET,
  }).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) throw new Error(`AI calling is not configured on the server (missing: ${missing.join(', ')}).`);
  const res = await fetch(`${API}/orgs/${s.org}/workspaces/${s.workspace}/outbounds`, {
    method: 'POST',
    headers: { 'X-API-Key': s.apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      app_config: {
        app_id: app?.id ?? s.appId,
        app_version: app?.version ?? s.appVersion,
        connection_config: { connection_id: s.connectionId, agent_phone_number: s.agentNumber },
        agent_variables: variables,
      },
      user_config: { user_phone_number: toNumber },
      // Sarvam signs nothing, so the shared secret travels in the address.
      webhook_config: { url: `${s.site}${app?.webhookPath ?? '/api/voice/sarvam-webhook'}?key=${encodeURIComponent(process.env.VOICE_TOOL_SECRET)}` },
    }),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.attempt_id) {
    const detail = (Array.isArray(data.detail) ? data.detail[0]?.msg : data.detail?.message ?? data.detail) || `HTTP ${res.status}`;
    throw new Error(`The call could not be placed: ${detail}`);
  }
  return { conversationId: `${SARVAM_PREFIX}${data.attempt_id}`, callSid: null };
}

// The details saved after each call, as the agent's post-call fields are named (the same as ElevenLabs').
const RESULT_FIELDS = ['interested', 'deal', 'area', 'project', 'bhk', 'budget_rupees', 'timeline', 'site_visit', 'callback_time', 'do_not_call'];

// Sarvam returns these as text: "True", "None", "2".
function plain(value) {
  if (value == null) return null;
  const v = String(value).trim();
  if (v === '' || v === 'None' || v === 'null') return null;
  if (/^true$/i.test(v)) return true;
  if (/^false$/i.test(v)) return false;
  return /^\d+(\.\d+)?$/.test(v) ? Number(v) : v;
}

// Turns Sarvam's end-of-call report into what we store on the call (same shape as readConversation in lib/voice.js).
// fields: the agent's post-call fields to keep (Riya's by default).
export function sarvamCallInfo(report, fields = RESULT_FIELDS) {
  const connectivity = report.status ?? report.connectivity_status;
  const transcript = (report.interaction_transcript ?? [])
    .map((t) => ({ role: t.role === 'agent' ? 'agent' : 'caller', text: t.indic_text || t.en_text, at: null }))
    .filter((t) => t.text);
  const callerSpoke = transcript.some((t) => t.role === 'caller');
  const status = connectivity === 'connected' ? (callerSpoke ? 'done' : 'no_answer') : connectivity === 'failed' ? 'failed' : 'no_answer';
  const variables = report.final_agent_variables ?? report.output_agent_variables ?? {};
  const result = Object.fromEntries(fields.map((k) => [k, plain(variables[k])]).filter(([, v]) => v !== null));
  return {
    status,
    duration_secs: report.duration == null ? null : Math.round(report.duration),
    summary: null,
    result: Object.keys(result).length ? result : null,
    transcript: transcript.length ? transcript : null,
    error: connectivity === 'failed' ? report.failure_reason || 'The call could not be placed.' : null,
  };
}
