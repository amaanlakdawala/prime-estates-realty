'use server';

import Anthropic from '@anthropic-ai/sdk';
import { getAdminContext } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { extractProperties, MAX_INPUT } from './extract';

async function requireLogin() {
  const ctx = await getAdminContext();
  if (!ctx?.user || !ctx.firm) throw new Error('Please sign in again.');
  return ctx;
}

// Pasted description -> write-up fields (one entry per property found).
export async function tidyDescription(text) {
  try {
    await requireLogin();
    const clean = (text ?? '').toString().trim();
    if (clean.length < 15) throw new Error('Paste the property description first.');
    if (clean.length > MAX_INPUT) throw new Error(`That's too long. Paste up to ${MAX_INPUT.toLocaleString('en-IN')} characters at a time.`);
    if (!process.env.ANTHROPIC_API_KEY) throw new Error('AI tidy-up is not set up yet. Ask the platform admin to add the AI key.');
    return { properties: await extractProperties(clean) };
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) return { error: 'The AI key is not valid. Ask the platform admin to check it.' };
    if (err instanceof Anthropic.RateLimitError) return { error: 'The AI service is busy right now. Please try again in a minute.' };
    if (err instanceof Anthropic.APIError) {
      console.error('tidyDescription:', err.status, err.message);
      return { error: 'The AI service had a problem. Please try again.' };
    }
    return { error: err.message };
  }
}

// Saves the signed-in person's own name and number, so write-ups fill them in next time.
export async function saveMyContact({ name, phone }) {
  try {
    const { user } = await requireLogin();
    const digits = (phone ?? '').replace(/\D/g, '');
    if (digits.length < 10) throw new Error('Enter a valid mobile number.');
    const { error } = await createAdminClient().auth.admin.updateUserById(user.id, {
      user_metadata: { ...user.user_metadata, full_name: (name ?? '').trim().slice(0, 80), phone: (phone ?? '').trim().slice(0, 20) },
    });
    if (error) throw new Error(error.message);
    return { success: true };
  } catch (err) {
    return { error: err.message };
  }
}
