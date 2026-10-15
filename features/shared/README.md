# Shared building blocks

Code used by more than one feature lives here, so each feature folder stays small and nothing is written twice.

| Folder | Used by | What it will hold |
| --- | --- | --- |
| `meta/` | social-replies, whatsapp-assistant | Meta Graph API client: webhook verification and signature check, sending replies and messages, token handling |
| `assistant/` | social-replies, whatsapp-assistant | The text AI assistant: firm details, listings search (same rules as the calling assistant), reply guardrails |

The calling assistant (Riya) runs on ElevenLabs and keeps its instructions in `voice-agent/`; the text
assistant here follows the same rules, so a client hears the same thing on a call, on WhatsApp and in a
comment reply.
