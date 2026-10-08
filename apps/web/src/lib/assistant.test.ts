import { describe, expect, it } from 'vitest';
import { makeMove, rootFromMoves, type Folder, type Repertoire } from '@mainline/shared';
import { assistantContext } from './assistant';

const folder = (id: string, parentId: string | null, name: string, rootMovesUci?: string[]): Folder => ({ id, parentId, name, color: 'white', sortIndex: 0, rootMovesUci, createdAt: 0, updatedAt: 0 }) as Folder;

describe('assistantContext', () => {
  it('lays out folders, lines with their moves, notes and what is on screen', () => {
    const root = rootFromMoves(['e2e4', 'e7e5']);
    const rep: Repertoire = { id: 'l1', folderId: 'f2', name: 'Line 1', color: 'white', rootEpd: root.epd, rootMovesUci: ['e2e4', 'e7e5'], sortIndex: 0, createdAt: 0, updatedAt: 0 };
    const m1 = makeMove(rep, [], root.fen, 'g1f3');
    const moves = [m1];
    const text = assistantContext({
      folders: [folder('w', null, 'White'), folder('f1', 'w', '1.e4', ['e2e4']), folder('f2', 'f1', 'e5', ['e2e4', 'e7e5'])],
      reps: [rep],
      moves,
      prefs: { rating: 1500, speeds: ['blitz'], aiNotes: 'I like sharp lines' },
      focus: { lineId: 'l1', ucis: ['e2e4', 'e7e5', 'g1f3'] },
    });
    expect(text).toContain('White (playing white)');
    expect(text).toContain('    e5 [1.e4 e5]');
    expect(text).toContain('line "Line 1": 1.e4 e5 2.Nf3');
    expect(text).toContain('I like sharp lines');
    expect(text).toContain('editing the line "Line 1" in the folder "e5", at the position after 1.e4 e5 2.Nf3');
  });
});
