import type { CoachKind, FactsPacket } from '@mainline/shared';
import { api } from './api';
import { usePrefs } from './prefs';

export interface CoachReply {
  text: string;
  source: 'ai' | 'template' | 'cache';
  model?: string;
  resting?: boolean;
  facts: FactsPacket;
}

const mem = new Map<string, Promise<CoachReply>>();

export function askCoach(input: { kind: CoachKind; fen: string; moveUci?: string; playedUci?: string; lineUcis?: string[]; question?: string }): Promise<CoachReply> {
  const { rating, speeds } = usePrefs.getState();
  const body = { ...input, rating, speeds };
  const key = JSON.stringify(body);
  if (!input.question && mem.has(key)) return mem.get(key)!;
  const p = api<CoachReply>('/api/coach', { method: 'POST', json: body });
  if (!input.question) {
    mem.set(key, p);
    p.catch(() => mem.delete(key));
  }
  return p;
}
