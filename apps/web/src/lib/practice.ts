import type { Color, Folder, Repertoire } from '@mainline/shared';
import { repsUnder } from './library';

/** What a practice session covers: everything, one colour, a folder (a first move, an opening) or one line. */
export type Scope = { kind: 'all' } | { kind: 'color'; color: Color } | { kind: 'folder'; id: string } | { kind: 'rep'; id: string };

/** "Show me" walks every line with your moves shown; "test" plays random lines from memory. */
export type Practice = 'show' | 'test';

export function practiceHref(scope: Scope, how: Practice): string {
  const q = new URLSearchParams(how === 'show' ? { mode: 'learn', show: '1' } : { mode: 'drill' });
  if (scope.kind === 'color') q.set('color', scope.color);
  if (scope.kind === 'folder') q.set('folder', scope.id);
  if (scope.kind === 'rep') q.set('reps', scope.id);
  return `/train?${q}`;
}

/** The repertoires a session's URL asks for; undefined = all of them. */
export function scopeRepIds(params: URLSearchParams, folders: Folder[], reps: Repertoire[]): string[] | undefined {
  const ids = params.get('reps')?.split(',').filter(Boolean);
  if (ids?.length) return ids;
  const folder = params.get('folder');
  if (folder) return repsUnder(folders, reps, folder).map((r) => r.id);
  const color = params.get('color');
  if (color === 'white' || color === 'black') return reps.filter((r) => !r.deleted && r.color === color).map((r) => r.id);
  return undefined;
}
