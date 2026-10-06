import type { Color, Folder, RepMove, Repertoire } from '@mainline/shared';
import { repsUnder } from './library';

/** What a practice session covers: everything, one colour, a folder (a first move, an opening) or one line. */
export type Scope =
  | { kind: 'all' }
  | { kind: 'color'; color: Color }
  | { kind: 'folder'; id: string }
  | { kind: 'rep'; id: string }
  /** Everything after one position: the lines that live in the answers to a move. */
  | { kind: 'at'; color: Color; epd: string };

/** Learn new moves, review what's due, quiz single positions — the remaining session kinds, for plans. */
export type Practice = 'show' | 'test' | 'learn' | 'review' | 'quiz';

export function practiceHref(scope: Scope, how: Practice): string {
  // "Show me" walks every line with your moves shown; "test" plays random lines from memory.
  const q = new URLSearchParams(how === 'show' ? { mode: 'learn', show: '1' } : { mode: how === 'test' ? 'drill' : how });
  if (scope.kind === 'color') q.set('color', scope.color);
  if (scope.kind === 'folder') q.set('folder', scope.id);
  if (scope.kind === 'rep') q.set('reps', scope.id);
  if (scope.kind === 'at') {
    q.set('color', scope.color);
    q.set('at', scope.epd);
  }
  return `/train?${q}`;
}

/** The repertoires a session's URL asks for; undefined = all of them. */
export function scopeRepIds(params: URLSearchParams, folders: Folder[], reps: Repertoire[], moves: RepMove[] = []): string[] | undefined {
  const at = params.get('at');
  if (at) {
    const color = params.get('color');
    const live = new Set(reps.filter((r) => !r.deleted && r.color === color).map((r) => r.id));
    return [...new Set(moves.filter((m) => !m.deleted && live.has(m.repertoireId) && m.fromEpd === at).map((m) => m.repertoireId))];
  }
  const ids = params.get('reps')?.split(',').filter(Boolean);
  if (ids?.length) return ids;
  const folder = params.get('folder');
  if (folder) return repsUnder(folders, reps, folder).map((r) => r.id);
  const color = params.get('color');
  if (color === 'white' || color === 'black') return reps.filter((r) => !r.deleted && r.color === color).map((r) => r.id);
  return undefined;
}
