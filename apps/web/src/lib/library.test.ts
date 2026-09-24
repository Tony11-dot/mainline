import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { INITIAL_FEN, playLine } from '@mainline/shared';
import { useLibrary } from './library';
import { db } from './idb';

beforeEach(async () => {
  useLibrary.setState({ loaded: false, folders: [], reps: [], moves: [], version: 0 });
});

describe('library store', () => {
  it('creates White/Black roots, repertoires, moves, alternates; delete + undo; persists', async () => {
    const L = useLibrary.getState();
    await L.load();
    const roots = useLibrary.getState().folders.filter((f) => f.parentId === null);
    expect(roots.map((f) => f.name).sort()).toEqual(['Black', 'White']);

    const white = roots.find((f) => f.color === 'white')!;
    const sub = await L.createFolder('1.e4', 'white', white.id);
    const rep = await L.createRepertoire({ name: 'Italian', color: 'white', folderId: sub.id });
    const { moves } = playLine(INITIAL_FEN, ['e2e4', 'e7e5', 'g1f3', 'b8c6']);
    let fen = INITIAL_FEN;
    for (const [i, u] of ['e2e4', 'e7e5', 'g1f3', 'b8c6'].entries()) {
      await L.addMove(rep.id, fen, u);
      fen = moves[i]!.fen;
    }
    const alt = await L.addMove(rep.id, INITIAL_FEN, 'd2d4');
    expect(alt.isMainline).toBe(false);

    const undo = await L.deleteBranch(rep.id, moves[0]!.fen.split(' ').slice(0, 4).join(' '), 'e7e5');
    let live = useLibrary.getState().moves.filter((m) => !m.deleted);
    expect(live.map((m) => m.san).sort()).toEqual(['d4', 'e4']);
    await undo();
    live = useLibrary.getState().moves.filter((m) => !m.deleted);
    expect(live).toHaveLength(5);

    // main-move deletion promotes the alternate
    await L.deleteBranch(rep.id, live.find((m) => m.san === 'e4')!.fromEpd, 'e2e4');
    expect(useLibrary.getState().moves.find((m) => m.san === 'd4')!.isMainline).toBe(true);

    const res = await L.importPgn(rep.id, '1. d4 d5 2. c4 (2. Bf4) *');
    expect(res.added).toBe(3);
    expect(L.exportPgn(rep.id)).toContain('1. d4 d5 2. c4 (2. Bf4) *');

    // everything is in IndexedDB and dirty for sync
    const d = await db();
    expect((await d.getAll('moves')).length).toBeGreaterThanOrEqual(8);
    expect((await d.getAll('dirty')).length).toBeGreaterThan(5);

    // cannot move a folder into its own child
    const child = await L.createFolder('child', 'white', sub.id);
    await L.moveFolder(sub.id, child.id);
    expect(useLibrary.getState().folders.find((f) => f.id === sub.id)!.parentId).toBe(white.id);
  });
});
