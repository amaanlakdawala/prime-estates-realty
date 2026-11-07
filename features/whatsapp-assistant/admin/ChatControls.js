'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { sendTeamReply, setChatMode } from '../actions';

// Under an open chat: take it over from Riya (or give it back), and reply as the team.
export default function ChatControls({ chatId, mode, canReply }) {
  const router = useRouter();
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  const act = (fn, after) => {
    setError('');
    startTransition(async () => {
      const result = await fn();
      if (result?.error) setError(result.error);
      else { after?.(); router.refresh(); }
    });
  };

  return (
    <div className="space-y-3 border-t border-line pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p>{mode === 'ai' ? 'Riya is replying in this chat.' : 'Your team has this chat; Riya stays quiet.'}</p>
        <button type="button" className="btn-outline py-1.5 text-sm" disabled={pending}
          onClick={() => act(() => setChatMode(chatId, mode === 'ai' ? 'human' : 'ai'))}>
          {mode === 'ai' ? 'Take over' : 'Let Riya reply again'}
        </button>
      </div>
      {canReply ? (
        <form onSubmit={(e) => { e.preventDefault(); act(() => sendTeamReply(chatId, text), () => setText('')); }} className="flex gap-2">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} className="field flex-1" placeholder="Reply as your team (this takes the chat over)" />
          <button type="submit" className="btn-primary self-end" disabled={pending || !text.trim()}>{pending ? 'Sending…' : 'Send'}</button>
        </form>
      ) : (
        <p className="text-sm text-muted">More than 24 hours since their last message: WhatsApp only allows a reply from your own phone now.</p>
      )}
      {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
    </div>
  );
}
