import { describe, expect, it } from 'vitest';
import { sanToSpeech } from './announce';

describe('sanToSpeech', () => {
  it.each([
    ['e4', 'Pawn e 4'],
    ['exd5', 'e pawn takes d 5'],
    ['Nf3', 'Knight f 3'],
    ['Nbd2', 'Knight from b d 2'],
    ['Qxf7#', 'Queen takes f 7, checkmate'],
    ['O-O', 'castles kingside'],
    ['O-O-O+', 'castles queenside, check'],
    ['a8=Q', 'Pawn a 8 promotes to queen'],
  ])('%s → %s', (san, words) => expect(sanToSpeech(san)).toBe(words));
});
