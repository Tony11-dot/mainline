import { sanListToUcis, type Color, type Folder, type PlayedGame, type Repertoire } from '@mainline/shared';
import { msg, t } from './i18n';
import { useLibrary } from './library';

/**
 * Ready-made openings. The library is organised the way players think about it:
 *
 *   White › 1.e4 › vs Caro-Kann (1…c6) › lines          Black › vs 1.e4 › Sicilian (1…c5) › lines
 *
 * A pack fills one of those opening folders with a few named lines — for White one system against that
 * reply (Black's main tries are the lines), for Black one defence (White's main tries are the lines).
 * Each line becomes its own repertoire rooted at the opening, marked ready-made: practised as is, not
 * rebuilt. Lines of one pack never disagree on your move, even where they transpose.
 */
export type FirstMove = 'e4' | 'd4' | 'c4' | 'Nf3' | 'Nc3';

export interface PackLine {
  id: string;
  name: string;
  /** From the starting position; variations allowed. */
  pgn: string;
}

export interface Pack {
  id: string;
  color: Color;
  first: FirstMove;
  /** Black's first move, in SAN: the opening folder this pack fills (White packs get their own folder inside it). */
  reply: string;
  name: string;
  /** Black only: the defence's name, which names the folder (two defences can share a reply). */
  opening?: string;
  lines: PackLine[];
  /** Offered on the welcome screen. */
  starter?: boolean;
}

export const FIRST_MOVES: FirstMove[] = ['e4', 'd4', 'c4', 'Nf3', 'Nc3'];

/** What each reply is called, for the folder names: "vs Caro-Kann (1…c6)". */
export const REPLY_NAMES: Record<FirstMove, Record<string, string>> = {
  e4: { e5: 'Open Games', c5: 'Sicilian', c6: 'Caro-Kann', e6: 'French', d5: 'Scandinavian', Nf6: 'Alekhine', d6: 'Pirc', g6: 'Modern' },
  d4: { d5: 'Closed Games', Nf6: 'Indian Defences', f5: 'Dutch', c5: 'Benoni', e5: 'Englund Gambit', e6: 'Horwitz', d6: 'Old Indian', g6: 'Modern' },
  c4: { e5: 'Reversed Sicilian', c5: 'Symmetrical English', Nf6: 'Anglo-Indian', e6: 'Agincourt', c6: 'Caro-Kann setup', g6: 'Modern' },
  Nf3: { d5: 'Queen’s Pawn', Nf6: 'Indian setup', c5: 'Symmetrical', g6: 'Modern' },
  Nc3: { d5: 'Queen’s Pawn', e5: 'King’s Pawn', c5: 'Sicilian setup', Nf6: 'Indian setup' },
};

const REPLY_BY_UCI = new Map<string, string>();
for (const [first, names] of Object.entries(REPLY_NAMES)) for (const r of Object.keys(names)) REPLY_BY_UCI.set(`${first}|${sanListToUcis([first, r])[1]}`, r);

/** Folders store positions as moves; packs and records name the reply in SAN. */
export const replySan = (first: FirstMove, replyUci: string) => REPLY_BY_UCI.get(`${first}|${replyUci}`) ?? replyUci;

const line = (id: string, name: string, pgn: string): PackLine => ({ id, name, pgn: `${pgn} *` });

/* ---------------- White, 1.e4 ---------------- */

const PETROV = line(
  'petrov-philidor',
  'Petrov & Philidor (2…Nf6, 2…d6)',
  '1. e4 e5 2. Nf3 Nf6 (2... d6 3. d4 exd4 (3... Nf6 4. Nc3 Nbd7 5. Bc4 Be7 6. O-O O-O 7. Re1) 4. Nxd4 Nf6 5. Nc3 Be7 6. Bf4 O-O 7. Qd2) 3. Nxe5 d6 4. Nf3 Nxe4 5. d4 d5 6. Bd3 Nc6 7. O-O Be7 8. c4',
);

const WHITE_E4: Pack[] = [
  {
    id: 'w-italian',
    color: 'white',
    first: 'e4',
    reply: 'e5',
    name: msg('Italian Game'),
    starter: true,
    lines: [
      line('giuoco', 'Giuoco Piano (3…Bc5)', '1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d3 d6 (5... O-O 6. O-O d5 7. exd5 Nxd5 8. a4) 6. O-O O-O 7. Re1 a6 8. Bb3 Ba7 9. h3 h6 10. Nbd2'),
      line('two-knights', 'Two Knights (3…Nf6)', '1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. d3 Bc5 (4... Be7 5. O-O O-O 6. Re1 d6 7. c3) (4... h6 5. O-O d6 6. c3 g6 7. Re1) 5. c3 d6 6. O-O O-O 7. Re1 a6 8. Bb3'),
      line('hungarian', 'Hungarian & sidelines (3…Be7, 3…d6)', '1. e4 e5 2. Nf3 Nc6 3. Bc4 Be7 (3... d6 4. c3 Nf6 5. d4 Be7 6. O-O O-O 7. Re1) 4. d4 d6 (4... exd4 5. Nxd4 Nf6 6. Nc3 O-O 7. O-O) 5. Nc3 Nf6 6. h3 O-O 7. O-O'),
      PETROV,
    ],
  },
  {
    id: 'w-ruy',
    color: 'white',
    first: 'e4',
    reply: 'e5',
    name: 'Ruy Lopez',
    lines: [
      line('closed', 'Closed (3…a6, 5…Be7)', '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 (7... O-O 8. c3 d5 9. exd5 Nxd5 10. Nxe5 Nxe5 11. Rxe5 c6 12. d4 Bd6 13. Re1) 8. c3 O-O 9. h3 Na5 (9... Bb7 10. d4 Re8 11. Nbd2 Bf8 12. a3) 10. Bc2 c5 11. d4'),
      line('open', 'Open & Arkhangelsk (5…Nxe4, 5…b5)', '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Nxe4 (5... b5 6. Bb3 Bc5 7. a4 Rb8 8. c3 d6 9. d4 Bb6) 6. d4 b5 7. Bb3 d5 8. dxe5 Be6 9. Nbd2'),
      line('berlin', 'Berlin (3…Nf6)', '1. e4 e5 2. Nf3 Nc6 3. Bb5 Nf6 4. O-O Nxe4 (4... Bc5 5. c3 O-O 6. d4 Bb6 7. Bg5) 5. d4 Nd6 6. Bxc6 dxc6 7. dxe5 Nf5 8. Qxd8+ Kxd8 9. Nc3'),
      line('classical', 'Classical, Steinitz & Schliemann', '1. e4 e5 2. Nf3 Nc6 3. Bb5 Bc5 (3... d6 4. d4 Bd7 5. Nc3 Nf6 6. O-O Be7 7. Re1) (3... f5 4. Nc3 fxe4 5. Nxe4 d5 6. Nxe5 dxe4 7. Nxc6 Qg5 8. Qe2 Nf6 9. f4) 4. c3 Nf6 5. O-O O-O 6. d4 Bb6 7. Bg5 h6 8. Bh4'),
      PETROV,
    ],
  },
  {
    id: 'w-vienna',
    color: 'white',
    first: 'e4',
    reply: 'e5',
    name: 'Vienna Game',
    lines: [
      line('nf6', 'Vienna Gambit (2…Nf6 3.f4)', '1. e4 e5 2. Nc3 Nf6 3. f4 d5 (3... exf4 4. e5 Ng8 5. Nf3 d6 6. d4) 4. fxe5 Nxe4 5. Nf3 Be7 (5... Bc5 6. d4 Bb4 7. Bd2) (5... Nc6 6. Qe2 Nxc3 7. dxc3) 6. d4 O-O 7. Bd3 f5 8. exf6 Bxf6 9. O-O'),
      line('nc6', '2…Nc6', '1. e4 e5 2. Nc3 Nc6 3. Bc4 Nf6 (3... Bc5 4. d3 d6 5. f4 Nf6 6. Nf3) 4. d3 Bc5 (4... Na5 5. Nge2 Nxc4 6. dxc4 Bc5 7. O-O d6 8. b3) 5. f4 d6 6. Nf3'),
      line('bc5', '2…Bc5 & 2…d6', '1. e4 e5 2. Nc3 Bc5 (2... d6 3. Nf3 Nf6 4. d4) 3. Nf3 d6 4. d4 exd4 5. Nxd4 Nf6 6. Bg5'),
    ],
  },
  {
    id: 'w-kings-gambit',
    color: 'white',
    first: 'e4',
    reply: 'e5',
    name: 'King’s Gambit',
    lines: [
      line('g5', 'Accepted: Kieseritzky (3…g5)', '1. e4 e5 2. f4 exf4 3. Nf3 g5 4. h4 g4 5. Ne5 Nf6 6. d4 d6 7. Nd3 Nxe4 8. Bxf4'),
      line('d5', 'Accepted: 3…d5, 3…d6, 3…Nf6', '1. e4 e5 2. f4 exf4 3. Nf3 d5 (3... d6 4. d4 g5 5. h4 g4 6. Ng1) (3... Nf6 4. e5 Nh5 5. Qe2 Be7 6. d4) 4. exd5 Nf6 5. Bb5+ c6 6. dxc6 bxc6 7. Bc4'),
      line('declined', 'Falkbeer & declined (2…d5, 2…Bc5)', '1. e4 e5 2. f4 d5 (2... Bc5 3. Nf3 d6 4. c3 Nf6 5. d4 exd4 6. cxd4 Bb4+ 7. Bd2) 3. exd5 exf4 4. Nf3 Nf6 5. Bb5+'),
    ],
  },
  {
    id: 'w-open-sicilian',
    color: 'white',
    first: 'e4',
    reply: 'c5',
    name: 'Open Sicilian',
    lines: [
      line('najdorf', 'vs Najdorf (5…a6)', '1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 6. Be3 e5 (6... e6 7. f3 b5 8. Qd2 Bb7 9. g4) (6... Ng4 7. Bg5 h6 8. Bh4 g5 9. Bg3 Bg7 10. Be2) 7. Nb3 Be6 8. f3 Be7 9. Qd2 O-O 10. O-O-O'),
      line('dragon', 'vs Dragon, Classical & Scheveningen', '1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 g6 (5... Nc6 6. Bg5 e6 7. Qd2 a6 8. O-O-O) (5... e6 6. Be3 a6 7. f3 b5 8. Qd2) 6. Be3 Bg7 7. f3 O-O 8. Qd2 Nc6 9. O-O-O'),
      line('nc6', 'vs 2…Nc6 (Sveshnikov, Taimanov)', '1. e4 c5 2. Nf3 Nc6 3. d4 cxd4 4. Nxd4 Nf6 (4... g6 5. c4 Bg7 6. Be3 Nf6 7. Nc3 O-O 8. Be2) (4... e6 5. Nc3 Qc7 6. Be3 a6 7. Qf3) 5. Nc3 e5 (5... d6 6. Bg5 e6 7. Qd2 a6 8. O-O-O) (5... e6 6. Ndb5 d6 7. Bf4 e5 8. Bg5) 6. Ndb5 d6 7. Bg5 a6 8. Na3 b5 9. Bxf6 gxf6 10. Nd5'),
      line('e6', 'vs 2…e6 (Kan, Paulsen)', '1. e4 c5 2. Nf3 e6 3. d4 cxd4 4. Nxd4 Nc6 (4... a6 5. Bd3 Nf6 6. O-O Qc7 7. Qe2) (4... Nf6 5. Nc3 d6 6. Be3) 5. Nc3 Qc7 6. Be3 a6 7. Qf3'),
      line('g6', 'vs 2…g6 & 2…a6', '1. e4 c5 2. Nf3 g6 (2... a6 3. c3 d5 4. exd5 Qxd5 5. d4) 3. d4 cxd4 4. Nxd4 Nc6 5. c4'),
    ],
  },
  {
    id: 'w-alapin',
    color: 'white',
    first: 'e4',
    reply: 'c5',
    name: 'Alapin (2.c3)',
    lines: [
      line('nf6', '2…Nf6', '1. e4 c5 2. c3 Nf6 3. e5 Nd5 4. d4 cxd4 5. Nf3 Nc6 (5... e6 6. cxd4 b6 7. Nc3) (5... d6 6. Bc4 Nb6 7. Bb3) 6. Bc4 Nb6 7. Bb3 d5 8. exd6 Qxd6 9. O-O'),
      line('d5', '2…d5', '1. e4 c5 2. c3 d5 3. exd5 Qxd5 4. d4 Nf6 (4... Nc6 5. Nf3 Bg4 6. Be2 cxd4 7. cxd4 e6 8. Nc3) 5. Nf3 e6 (5... Bg4 6. Be2 e6 7. O-O Nc6 8. h3) 6. Be3 cxd4 7. cxd4 Nc6 8. Nc3'),
      line('e6', '2…e6, 2…Nc6, 2…g6', '1. e4 c5 2. c3 e6 (2... Nc6 3. d4 d5 4. exd5 Qxd5 5. Nf3 Bg4 6. Be2 cxd4 7. cxd4 e6 8. Nc3) (2... g6 3. d4 cxd4 4. cxd4 d5 5. e5) 3. d4 d5 4. e5 Nc6 5. Nf3 Qb6 6. a3'),
    ],
  },
  {
    id: 'w-grand-prix',
    color: 'white',
    first: 'e4',
    reply: 'c5',
    name: 'Grand Prix (2.Nc3, 3.f4)',
    lines: [
      line('nc6', '2…Nc6', '1. e4 c5 2. Nc3 Nc6 3. f4 g6 (3... e6 4. Nf3 d5 5. Bb5 Nge7 6. Qe2) 4. Nf3 Bg7 5. Bb5 Nd4 6. O-O a6 7. Bd3 d6 8. Nxd4 cxd4 9. Ne2'),
      line('d6', '2…d6 & 2…e6', '1. e4 c5 2. Nc3 d6 (2... e6 3. f4 d5 4. Nf3 Nf6 5. e5 Nfd7 6. g3 Nc6 7. Bg2) 3. f4 Nc6 4. Nf3 g6 5. Bb5 Bd7 6. O-O Bg7 7. d3'),
    ],
  },
  {
    id: 'w-smith-morra',
    color: 'white',
    first: 'e4',
    reply: 'c5',
    name: 'Smith-Morra Gambit',
    lines: [
      line('accepted', 'Accepted (3…dxc3)', '1. e4 c5 2. d4 cxd4 3. c3 dxc3 4. Nxc3 Nc6 5. Nf3 d6 (5... e6 6. Bc4 a6 7. O-O Nge7 8. Bg5) 6. Bc4 e6 7. O-O Nf6 8. Qe2 Be7 9. Rd1 e5 10. h3'),
      line('declined', 'Declined (3…Nf6, 3…d5, 3…d3)', '1. e4 c5 2. d4 cxd4 3. c3 Nf6 (3... d5 4. exd5 Qxd5 5. cxd4 Nc6 6. Nf3) (3... d3 4. Bxd3 Nc6 5. Nf3) 4. e5 Nd5 5. Nf3 Nc6 6. Bc4 Nb6 7. Bb3 d5 8. exd6'),
    ],
  },
  {
    id: 'w-caro-advance',
    color: 'white',
    first: 'e4',
    reply: 'c6',
    name: 'Advance Variation',
    lines: [
      line('bf5', '3…Bf5 (Short System)', '1. e4 c6 2. d4 d5 3. e5 Bf5 4. Nf3 e6 5. Be2 c5 (5... Nd7 6. O-O Ne7 7. Nh4) (5... Ne7 6. O-O Nd7 7. Nh4) 6. Be3 Nd7 (6... cxd4 7. Nxd4 Ne7 8. O-O) 7. O-O Ne7 8. c4'),
      line('c5', '3…c5', '1. e4 c6 2. d4 d5 3. e5 c5 4. dxc5 e6 (4... Nc6 5. Nf3 Bg4 6. Bb5 e6 7. Be3) 5. Nf3 Bxc5 6. Bd3'),
    ],
  },
  {
    id: 'w-caro-two-knights',
    color: 'white',
    first: 'e4',
    reply: 'c6',
    name: 'Two Knights (2.Nc3, 3.Nf3)',
    lines: [
      line('bg4', '3…Bg4', '1. e4 c6 2. Nc3 d5 3. Nf3 Bg4 4. h3 Bxf3 (4... Bh5 5. exd5 cxd5 6. Bb5+ Nc6 7. g4 Bg6 8. Ne5) 5. Qxf3 e6 6. d3 Nf6 7. a3'),
      line('dxe4', '3…dxe4', '1. e4 c6 2. Nc3 d5 3. Nf3 dxe4 4. Nxe4 Nf6 (4... Bf5 5. Ng3 Bg6 6. h4 h6 7. Ne5) 5. Nxf6+ exf6 (5... gxf6 6. d4 Bf5 7. Bd3) 6. d4 Bd6 7. Bd3'),
      line('nf6', '3…Nf6 & 2…g6', '1. e4 c6 2. Nc3 d5 (2... g6 3. d4 d5 4. h3 Bg7 5. Nf3) 3. Nf3 Nf6 4. e5 Ne4 5. Ne2 Qb6 6. d4 c5 7. c3'),
    ],
  },
  {
    id: 'w-french-advance',
    color: 'white',
    first: 'e4',
    reply: 'e6',
    name: 'Advance Variation',
    lines: [
      line('c5', '3…c5', '1. e4 e6 2. d4 d5 3. e5 c5 4. c3 Nc6 5. Nf3 Qb6 (5... Bd7 6. Be2 Nge7 7. Na3 cxd4 8. cxd4 Nf5 9. Nc2) 6. a3 c4 (6... Bd7 7. b4 cxd4 8. cxd4 Rc8 9. Bb2) 7. Nbd2 Na5 8. Rb1 Bd7 9. h4'),
      line('b6', '3…b6 & 3…Ne7', '1. e4 e6 2. d4 d5 3. e5 b6 (3... Ne7 4. Nf3 b6 5. c3 Qd7 6. h4) 4. c3 Qd7 5. Nf3 Ba6 6. Bxa6 Nxa6 7. O-O'),
    ],
  },
  {
    id: 'w-french-tarrasch',
    color: 'white',
    first: 'e4',
    reply: 'e6',
    name: 'Tarrasch (3.Nd2)',
    lines: [
      line('c5', '3…c5', '1. e4 e6 2. d4 d5 3. Nd2 c5 4. exd5 Qxd5 (4... exd5 5. Ngf3 Nc6 6. Bb5 Bd6 7. dxc5 Bxc5 8. O-O) 5. Ngf3 cxd4 6. Bc4 Qd6 7. O-O Nf6 8. Nb3 Nc6 9. Nbxd4 Nxd4 10. Nxd4 a6 11. Re1'),
      line('nf6', '3…Nf6', '1. e4 e6 2. d4 d5 3. Nd2 Nf6 4. e5 Nfd7 5. Bd3 c5 6. c3 Nc6 7. Ne2 cxd4 8. cxd4 f6 9. exf6 Nxf6 10. Nf3'),
      line('dxe4', '3…dxe4 & 3…Be7', '1. e4 e6 2. d4 d5 3. Nd2 dxe4 (3... Be7 4. Ngf3 Nf6 5. Bd3 c5 6. e5) 4. Nxe4 Nd7 5. Nf3 Ngf6 6. Nxf6+ Nxf6 7. c3'),
    ],
  },
  {
    id: 'w-scandinavian',
    color: 'white',
    first: 'e4',
    reply: 'd5',
    name: 'Main line (2.exd5, 3.Nc3)',
    lines: [
      line('qa5', '2…Qxd5 3…Qa5', '1. e4 d5 2. exd5 Qxd5 3. Nc3 Qa5 4. d4 Nf6 5. Nf3 c6 (5... Bf5 6. Bd2 c6 7. Bc4 e6 8. Qe2) (5... Bg4 6. h3 Bh5 7. g4 Bg6 8. Ne5) 6. Bc4 Bf5 7. Bd2 e6 8. Qe2 Bb4 9. O-O-O'),
      line('qd6', '3…Qd6 & 3…Qd8', '1. e4 d5 2. exd5 Qxd5 3. Nc3 Qd6 (3... Qd8 4. d4 Nf6 5. Nf3 Bg4 6. h3 Bxf3 7. Qxf3 c6 8. Be3) 4. d4 Nf6 5. Nf3 a6 6. g3'),
      line('nf6', '2…Nf6', '1. e4 d5 2. exd5 Nf6 3. d4 Nxd5 4. Nf3 g6 (4... Bg4 5. Be2 e6 6. O-O) 5. c4 Nb6 6. Nc3 Bg7 7. h3'),
    ],
  },
  {
    id: 'w-alekhine',
    color: 'white',
    first: 'e4',
    reply: 'Nf6',
    name: 'Modern (4.Nf3)',
    lines: [
      line('dxe5', '4…dxe5', '1. e4 Nf6 2. e5 Nd5 3. d4 d6 4. Nf3 dxe5 5. Nxe5 c6 (5... g6 6. Bc4 c6 7. O-O Bg7 8. Re1) (5... Nd7 6. Nf3 g6 7. c4 N5b6 8. Nc3) 6. Be2 Bf5 7. O-O Nd7 8. Nf3 e6 9. c4'),
      line('bg4', '4…Bg4 & 4…g6', '1. e4 Nf6 2. e5 Nd5 3. d4 d6 4. Nf3 Bg4 (4... g6 5. Bc4 Nb6 6. Bb3 Bg7 7. a4 a5 8. Ng5) 5. Be2 e6 6. O-O Be7 7. c4 Nb6 8. h3 Bh5 9. Nc3'),
    ],
  },
  {
    id: 'w-pirc',
    color: 'white',
    first: 'e4',
    reply: 'd6',
    name: '150 Attack (Be3, Qd2)',
    lines: [
      line('g6', '3…g6', '1. e4 d6 2. d4 Nf6 3. Nc3 g6 4. Be3 Bg7 (4... c6 5. Qd2 b5 6. f3 Nbd7 7. Bd3) 5. Qd2 c6 (5... O-O 6. O-O-O c6 7. f3 b5 8. h4) 6. Bh6 Bxh6 7. Qxh6 Qa5 8. Bd3'),
      line('e5', '3…e5 (Philidor)', '1. e4 d6 2. d4 Nf6 3. Nc3 e5 4. Nf3 Nbd7 5. Bc4 Be7 6. O-O O-O 7. Re1 c6 8. a4'),
    ],
  },
  {
    id: 'w-modern',
    color: 'white',
    first: 'e4',
    reply: 'g6',
    name: '150 Attack (Be3, Qd2)',
    lines: [
      line('d6', '3…d6', '1. e4 g6 2. d4 Bg7 3. Nc3 d6 4. Be3 Nf6 (4... a6 5. Qd2 b5 6. f3 Nd7 7. h4) 5. Qd2'),
      line('c6', '3…c6', '1. e4 g6 2. d4 Bg7 3. Nc3 c6 4. Nf3 d5 5. h3'),
    ],
  },
];

/* ---------------- White, 1.d4 ---------------- */

const WHITE_D4: Pack[] = [
  {
    id: 'w-queens-gambit',
    color: 'white',
    first: 'd4',
    reply: 'd5',
    name: 'Queen’s Gambit',
    lines: [
      line('qgd', 'QGD: Exchange (2…e6)', '1. d4 d5 2. c4 e6 3. Nc3 Nf6 (3... Be7 4. Nf3 Nf6 5. Bf4 O-O 6. e3) (3... c5 4. cxd5 exd5 5. Nf3 Nc6 6. g3 Nf6 7. Bg2 Be7 8. O-O) 4. cxd5 exd5 5. Bg5 Be7 (5... c6 6. Qc2 Be7 7. e3) 6. e3 c6 7. Qc2 Nbd7 8. Bd3 O-O 9. Nge2 Re8 10. O-O'),
      line('slav', 'Slav (2…c6)', '1. d4 d5 2. c4 c6 3. Nf3 Nf6 4. Nc3 dxc4 (4... e6 5. Bg5 h6 6. Bh4 dxc4 7. e4 g5 8. Bg3 b5 9. Be2) (4... a6 5. e3 b5 6. b3) 5. a4 Bf5 6. e3 e6 7. Bxc4 Bb4 8. O-O Nbd7 9. Qe2'),
      line('qga', 'Accepted (2…dxc4)', '1. d4 d5 2. c4 dxc4 3. e4 e5 (3... Nf6 4. e5 Nd5 5. Bxc4 Nb6 6. Bb3) (3... c5 4. d5 Nf6 5. Nc3 b5) 4. Nf3 exd4 5. Bxc4 Nc6 6. O-O Be6 7. Bxe6 fxe6 8. Qb3'),
      line('others', 'Chigorin, Albin & others', '1. d4 d5 2. c4 Nc6 (2... Nf6 3. cxd5 Nxd5 4. e4 Nf6 5. Nc3) (2... e5 3. dxe5 d4 4. Nf3 Nc6 5. g3) (2... Bf5 3. Nc3 e6 4. Nf3 c6 5. Qb3 Qb6 6. c5) 3. Nf3 Bg4 4. cxd5 Bxf3 5. gxf3 Qxd5 6. e3'),
    ],
  },
  {
    id: 'w-london-d5',
    color: 'white',
    first: 'd4',
    reply: 'd5',
    name: msg('London System'),
    starter: true,
    lines: [
      line('e6', '2…Nf6 3…e6', '1. d4 d5 2. Bf4 Nf6 3. e3 e6 (3... Bf5 4. c4 e6 5. Nc3 Bb4 6. Qb3) (3... g6 4. Nf3 Bg7 5. Be2 O-O 6. O-O c5 7. c3) 4. Nf3 c5 (4... Bd6 5. Bg3 O-O 6. Bd3 c5 7. c3 Nc6 8. Nbd2) 5. c3 Nc6 6. Nbd2 Bd6 7. Bg3 O-O 8. Bd3'),
      line('c5', '2…Nf6 3…c5', '1. d4 d5 2. Bf4 Nf6 3. e3 c5 4. c3 Nc6 5. Nd2 Bf5 (5... e6 6. Ngf3 Bd6 7. Bg3 O-O 8. Bd3) 6. Ngf3 e6 7. Qb3 Qc8'),
      line('early', '2…c5 & 2…Bf5', '1. d4 d5 2. Bf4 c5 (2... Bf5 3. e3 e6 4. c4 Nf6 5. Nc3) 3. e3 Nc6 4. c3 Nf6 5. Nd2 e6 6. Ngf3 Bd6 7. Bg3 O-O 8. Bd3'),
    ],
  },
  {
    id: 'w-qg-indian',
    color: 'white',
    first: 'd4',
    reply: 'Nf6',
    name: 'Queen’s Gambit setup (2.c4, 3.Nc3)',
    lines: [
      line('nimzo', 'Nimzo-Indian (3…Bb4)', '1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 4. Qc2 O-O (4... d5 5. cxd5 exd5 6. Bg5 h6 7. Bh4 c5 8. dxc5) (4... c5 5. dxc5 O-O 6. a3 Bxc5 7. Nf3) 5. a3 Bxc3+ 6. Qxc3 b6 (6... d5 7. Nf3 dxc4 8. Qxc4 b6 9. Bf4) 7. Bg5 Bb7 8. f3 h6 9. Bh4 d5 10. e3'),
      line('qgd', '2…e6 3…d5 & 3…b6', '1. d4 Nf6 2. c4 e6 3. Nc3 d5 (3... b6 4. e4 Bb7 5. Bd3) 4. cxd5 exd5 5. Bg5 Be7 6. e3'),
      line('kid', 'King’s Indian (2…g6 3…Bg7)', '1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6 5. Nf3 O-O 6. Be2 e5 7. O-O Nc6 (7... Nbd7 8. Re1 c6 9. Bf1) (7... exd4 8. Nxd4 Re8 9. f3) 8. d5 Ne7 9. Ne1 Nd7 10. Be3 f5 11. f3'),
      line('grunfeld', 'Grünfeld (3…d5)', '1. d4 Nf6 2. c4 g6 3. Nc3 d5 4. cxd5 Nxd5 5. e4 Nxc3 6. bxc3 Bg7 7. Nf3 c5 8. Be3 Qa5 9. Qd2'),
      line('benoni', 'Benoni, Benko & others', '1. d4 Nf6 2. c4 c5 (2... e5 3. dxe5 Ng4 4. Bf4 Nc6 5. Nf3 Bb4+ 6. Nbd2) (2... d6 3. Nc3 g6 4. e4 Bg7 5. Nf3 O-O 6. Be2) 3. d5 e6 (3... b5 4. cxb5 a6 5. bxa6 g6 6. Nc3 Bxa6 7. e4 Bxf1 8. Kxf1) 4. Nc3 exd5 5. cxd5 d6 6. e4 g6 7. Nf3 Bg7 8. Be2 O-O 9. O-O'),
    ],
  },
  {
    id: 'w-london-nf6',
    color: 'white',
    first: 'd4',
    reply: 'Nf6',
    name: msg('London System'),
    lines: [
      line('g6', '2…g6', '1. d4 Nf6 2. Bf4 g6 3. e3 Bg7 4. Nf3 O-O 5. Be2 d6 6. h3 c5 7. c3'),
      line('e6', '2…e6', '1. d4 Nf6 2. Bf4 e6 3. e3 c5 (3... d5 4. Nf3) 4. c3 b6 5. Nd2 Bb7 6. Ngf3 Be7 7. h3'),
      line('c5', '2…c5 & 2…d5', '1. d4 Nf6 2. Bf4 c5 (2... d5 3. e3 c5 4. c3 Nc6 5. Nd2) 3. d5 d6 (3... b5 4. e3 Bb7 5. c4) (3... Qb6 4. Nc3 Qxb2 5. Bd2) 4. Nc3 g6 5. e4 Bg7 6. Nf3 O-O 7. Be2'),
    ],
  },
  {
    id: 'w-dutch',
    color: 'white',
    first: 'd4',
    reply: 'f5',
    name: 'Fianchetto (g3, Bg2)',
    lines: [
      line('leningrad', 'Leningrad (…g6)', '1. d4 f5 2. g3 Nf6 3. Bg2 g6 4. Nf3 Bg7 5. O-O O-O 6. c4 d6 7. Nc3'),
      line('e6', 'Stonewall & Classical (…e6)', '1. d4 f5 2. g3 Nf6 3. Bg2 e6 4. Nf3 d5 (4... Be7 5. O-O O-O 6. c4 d6 7. Nc3) 5. O-O Bd6 6. c4 c6 7. b3'),
    ],
  },
  {
    id: 'w-benoni',
    color: 'white',
    first: 'd4',
    reply: 'c5',
    name: '2.d5 with e4',
    lines: [line('main', 'Old Benoni (1…c5)', '1. d4 c5 2. d5 Nf6 (2... e5 3. e4 d6 4. Nc3 Be7 5. Nf3) (2... d6 3. e4 Nf6 4. Nc3 g6 5. Nf3 Bg7 6. Be2) 3. Nc3 d6 4. e4 g6 5. Nf3 Bg7 6. Be2 O-O 7. O-O')],
  },
];

const WHITE_MORE: Pack[] = [
  {
    id: 'w-catalan',
    color: 'white',
    first: 'd4',
    reply: 'd5',
    name: 'Catalan',
    lines: [
      line('open', 'QGD & Open Catalan (2…e6)', '1. d4 d5 2. c4 e6 3. Nf3 Nf6 4. g3 Be7 (4... dxc4 5. Bg2 a6 6. O-O) (4... Bb4+ 5. Bd2 Be7 6. Bg2 O-O 7. O-O) 5. Bg2 O-O 6. O-O dxc4 (6... c6 7. Qc2 Nbd7 8. Nbd2 b6 9. e4 Bb7 10. b3) 7. Qc2 a6 8. Qxc4 b5 9. Qc2 Bb7 10. Bd2'),
      line('slav', 'Slav & Accepted (2…c6, 2…dxc4)', '1. d4 d5 2. c4 c6 (2... dxc4 3. Nf3 Nf6 4. e3 e6 5. Bxc4 c5 6. O-O a6 7. a4) 3. Nf3 Nf6 4. e3 Bf5 5. Nc3 e6 6. Nh4 Bg6 7. Nxg6 hxg6'),
      line('others', 'Chigorin & Albin (2…Nc6, 2…e5)', '1. d4 d5 2. c4 Nc6 (2... e5 3. dxe5 d4 4. Nf3 Nc6 5. g3) 3. Nf3 Bg4 4. cxd5 Bxf3 5. gxf3 Qxd5 6. e3'),
    ],
  },
  {
    id: 'w-englund',
    color: 'white',
    first: 'd4',
    reply: 'e5',
    name: 'Refuting the Englund',
    lines: [
      line('nc6', '2…Nc6 3.Nf3', '1. d4 e5 2. dxe5 Nc6 3. Nf3 Qe7 (3... d6 4. exd6 Bxd6 5. Nc3 Nf6 6. g3) (3... Nge7 4. Bf4 Ng6 5. Bg3 Qe7 6. Nc3) 4. Qd5 f6 5. exf6 Nxf6 6. Qb3 d5 7. Nc3'),
      line('others', '2…d6 & 2…f6', '1. d4 e5 2. dxe5 d6 (2... f6 3. exf6 Nxf6 4. Nf3) 3. exd6 Bxd6 4. Nf3 Nf6 5. g3'),
    ],
  },
  {
    id: 'w-reti-d5',
    color: 'white',
    first: 'Nf3',
    reply: 'd5',
    name: 'Réti & King’s Indian Attack',
    lines: [
      line('nf6', '2…Nf6', '1. Nf3 d5 2. g3 Nf6 3. Bg2 e6 (3... c6 4. O-O Bg4 5. d3 Nbd7 6. Nbd2 e5 7. e4) (3... g6 4. O-O Bg7 5. d3 O-O 6. Nbd2 c5 7. e4) 4. O-O Be7 5. d3 O-O 6. Nbd2 c5 7. e4 Nc6 8. Re1'),
      line('c5', '2…c5 & 2…Bg4', '1. Nf3 d5 2. g3 c5 (2... Bg4 3. Bg2 Nd7 4. O-O c6 5. d3) 3. Bg2 Nc6 4. O-O e5 5. d3'),
    ],
  },
  {
    id: 'w-reti-nf6',
    color: 'white',
    first: 'Nf3',
    reply: 'Nf6',
    name: 'King’s Indian Attack',
    lines: [line('main', '1…Nf6', '1. Nf3 Nf6 2. g3 g6 (2... d5 3. Bg2 e6 4. O-O Be7 5. d3 O-O 6. Nbd2 c5 7. e4 Nc6 8. Re1) (2... b6 3. Bg2 Bb7 4. O-O e6 5. d3) 3. Bg2 Bg7 4. O-O O-O 5. d3 d6 6. e4 e5 7. Nc3')],
  },
  {
    id: 'w-nc3-d5',
    color: 'white',
    first: 'Nc3',
    reply: 'd5',
    name: 'Van Geet with 2.e4',
    lines: [
      line('dxe4', '2…dxe4 & 2…c6', '1. Nc3 d5 2. e4 dxe4 (2... c6 3. d4 dxe4 4. Nxe4 Bf5 5. Ng3 Bg6 6. h4) 3. Nxe4 Bf5 (3... Nf6 4. Nxf6+ exf6 5. Nf3) 4. Ng3 Bg6 5. h4 h6 6. Nf3'),
      line('d4', '2…d4 & 2…e6', '1. Nc3 d5 2. e4 d4 (2... e6 3. d4 Nf6 4. e5 Nfd7 5. f4 c5 6. Nf3 Nc6 7. Be3) 3. Nce2 e5 4. Ng3 Be6 5. Nf3 f6 6. Bb5+'),
    ],
  },
  {
    id: 'w-nc3-e5',
    color: 'white',
    first: 'Nc3',
    reply: 'e5',
    name: 'Into the Vienna',
    lines: [line('main', '1…e5 2.e4', '1. Nc3 e5 2. e4 Nf6 (2... Nc6 3. Bc4 Nf6 4. d3 Bc5 5. f4 d6 6. Nf3) 3. f4 d5 4. fxe5 Nxe4 5. Nf3 Be7 6. d4 O-O 7. Bd3 f5 8. exf6 Bxf6 9. O-O')],
  },
];

/* ---------------- White, 1.c4 ---------------- */

const WHITE_C4: Pack[] = [
  {
    id: 'w-english-e5',
    color: 'white',
    first: 'c4',
    reply: 'e5',
    name: 'Four Knights with g3',
    lines: [
      line('four-knights', 'Four Knights (2…Nf6 3…Nc6)', '1. c4 e5 2. Nc3 Nf6 3. Nf3 Nc6 4. g3 d5 (4... Bb4 5. Bg2 O-O 6. O-O e4 7. Ne1 Bxc3 8. dxc3 h6 9. Nc2) (4... Bc5 5. Bg2 d6 6. O-O O-O 7. d3) 5. cxd5 Nxd5 6. Bg2 Nb6 7. O-O Be7 8. d3 O-O 9. a3'),
      line('nf6', '2…Nf6, 3…e4 & 3…d6', '1. c4 e5 2. Nc3 Nf6 3. Nf3 e4 (3... d6 4. d4 exd4 5. Nxd4 g6 6. g3 Bg7 7. Bg2 O-O 8. O-O) 4. Nd4 Nc6 5. Nxc6 dxc6 6. e3'),
      line('nc6', '2…Nc6 & 2…Bb4', '1. c4 e5 2. Nc3 Nc6 (2... Bb4 3. Nd5 Be7 4. d4 d6 5. e4 Nf6 6. Nxe7 Qxe7 7. Bd3) 3. g3 g6 4. Bg2 Bg7 5. d3 d6 6. e4'),
    ],
  },
  {
    id: 'w-english-c5',
    color: 'white',
    first: 'c4',
    reply: 'c5',
    name: 'Symmetrical with g3',
    lines: [
      line('nc6', '2…Nc6', '1. c4 c5 2. Nc3 Nc6 3. g3 g6 4. Bg2 Bg7 5. Nf3 Nf6 (5... e6 6. O-O Nge7 7. d3 O-O 8. Bd2) (5... e5 6. O-O Nge7 7. d3 O-O 8. a3) 6. O-O O-O 7. d4 cxd4 8. Nxd4'),
      line('nf6', '2…Nf6', '1. c4 c5 2. Nc3 Nf6 3. g3 d5 (3... g6 4. Bg2 Bg7 5. Nf3 Nc6 6. O-O O-O 7. d4 cxd4 8. Nxd4) (3... e6 4. Nf3 b6 5. Bg2 Bb7 6. O-O Be7 7. d4 cxd4 8. Qxd4) 4. cxd5 Nxd5 5. Bg2 Nc7 6. Nf3 Nc6 7. O-O e5 8. d3'),
    ],
  },
  {
    id: 'w-english-nf6',
    color: 'white',
    first: 'c4',
    reply: 'Nf6',
    name: '2.Nc3 with e4',
    lines: [
      line('g6', '2…g6', '1. c4 Nf6 2. Nc3 g6 3. e4 d6 4. d4 Bg7 5. Nf3 O-O 6. Be2 e5 7. O-O'),
      line('e6', '2…e6 (Mikenas)', '1. c4 Nf6 2. Nc3 e6 3. e4 d5 (3... c5 4. e5 Ng8 5. Nf3 Nc6 6. d4 cxd4 7. Nxd4 Nxe5 8. Ndb5) 4. e5 d4 (4... Nfd7 5. cxd5 exd5 6. d4) (4... Ne4 5. Nf3) 5. exf6 dxc3 6. bxc3 Qxf6 7. d4'),
      line('others', '2…e5, 2…c5, 2…d5', '1. c4 Nf6 2. Nc3 e5 (2... c5 3. g3 d5 4. cxd5 Nxd5 5. Bg2 Nc7 6. Nf3 Nc6 7. O-O e5 8. d3) (2... d5 3. cxd5 Nxd5 4. g3 g6 5. Bg2 Nxc3 6. bxc3 Bg7 7. Rb1) 3. Nf3 Nc6 4. g3 d5 5. cxd5 Nxd5 6. Bg2 Nb6 7. O-O Be7 8. d3 O-O 9. a3'),
    ],
  },
];

/* ---------------- Black ---------------- */

const BLACK: Pack[] = [
  {
    id: 'b-najdorf',
    color: 'black',
    first: 'e4',
    reply: 'c5',
    opening: 'Sicilian',
    name: 'Najdorf Sicilian',
    lines: [
      line('english-attack', 'Open: English Attack (6.Be3)', '1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 6. Be3 e5 7. Nb3 (7. Nf3 Be7 8. Bc4 O-O 9. O-O Be6) 7... Be6 8. f3 Be7 9. Qd2 O-O 10. O-O-O Nbd7'),
      line('bg5', 'Open: 6.Bg5', '1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 6. Bg5 e6 7. f4 Be7 8. Qf3 Qc7 9. O-O-O Nbd7'),
      line('quiet', 'Open: 6.Be2, 6.Bc4, 6.f3, 6.h3, 6.g3', '1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 6. Be2 (6. Bc4 e6 7. Bb3 b5 8. O-O Be7) (6. h3 e5 7. Nde2 h5) (6. f3 e5 7. Nb3 Be6 8. Be3 Be7) (6. g3 e5 7. Nde2 Be7 8. Bg2 O-O) 6... e5 7. Nb3 Be7 8. O-O O-O'),
      line('moscow', 'Moscow (3.Bb5+)', '1. e4 c5 2. Nf3 d6 3. Bb5+ Bd7 4. Bxd7+ (4. a4 Nf6 5. Qe2 Nc6 6. O-O g6) 4... Qxd7 5. O-O Nc6 6. c3 Nf6 7. d4 (7. Re1 e6 8. d4 cxd4 9. cxd4 d5 10. e5 Ne4) 7... Nxe4 8. d5 Ne5'),
      line('alapin', 'Alapin (2.c3)', '1. e4 c5 2. c3 Nf6 3. e5 (3. d3 Nc6 4. Nf3 g6) 3... Nd5 4. d4 (4. Nf3 Nc6 5. Bc4 Nb6 6. Bb3 d5 7. exd6 Qxd6) 4... cxd4 5. Nf3 (5. Bc4 Nb6 6. Bb3 d5 7. exd6 Qxd6) (5. cxd4 d6 6. Nf3 Nc6) 5... Nc6 6. cxd4 d6 7. Bc4 Nb6 8. Bb5 dxe5 9. Nxe5 Bd7'),
      line('closed', 'Closed & Grand Prix (2.Nc3)', '1. e4 c5 2. Nc3 d6 3. f4 (3. Nf3 Nf6 4. d4 cxd4 5. Nxd4 a6) (3. g3 Nc6 4. Bg2 g6 5. d3 Bg7 6. Be3 e5 7. Qd2 Nge7) 3... Nc6 4. Nf3 g6 5. Bb5 Bd7 6. O-O Bg7 7. d3 Nf6'),
      line('morra', 'Smith-Morra & 2.d4', '1. e4 c5 2. d4 cxd4 3. c3 (3. Nf3 d6 4. Nxd4 Nf6 5. Nc3 a6) (3. Qxd4 Nc6 4. Qd1 Nf6 5. Nc3 d6) 3... Nf6 4. e5 Nd5 5. Nf3 (5. cxd4 d6 6. Nf3 Nc6 7. Bc4 Nb6 8. Bb5 dxe5 9. Nxe5 Bd7) 5... Nc6 6. Bc4 Nb6 7. Bb3 d5 8. exd6 Qxd6 9. O-O Be6'),
    ],
  },
  {
    id: 'b-caro',
    color: 'black',
    first: 'e4',
    reply: 'c6',
    opening: 'Caro-Kann',
    name: msg('Caro-Kann Defence'),
    starter: true,
    lines: [
      line('classical', 'Classical (3.Nc3, 3.Nd2)', '1. e4 c6 2. d4 d5 3. Nc3 (3. Nd2 dxe4 4. Nxe4 Bf5) 3... dxe4 4. Nxe4 Bf5 5. Ng3 Bg6 6. h4 (6. Nf3 Nd7 7. h4 h6 8. h5 Bh7) 6... h6 7. Nf3 Nd7 8. h5 Bh7 9. Bd3 Bxd3 10. Qxd3 e6 11. Bd2 Ngf6 12. O-O-O Be7'),
      line('advance', 'Advance (3.e5)', '1. e4 c6 2. d4 d5 3. e5 Bf5 4. Nf3 (4. Nc3 e6 5. g4 Bg6 6. Nge2 c5 7. h4 h5 8. Nf4 Bh7) (4. h4 h5 5. c4 e6 6. Nc3 Ne7) 4... e6 5. Be2 c5 6. Be3 Nd7 7. O-O Ne7'),
      line('exchange', 'Exchange & Panov (3.exd5)', '1. e4 c6 2. d4 d5 3. exd5 cxd5 4. Bd3 (4. c4 Nf6 5. Nc3 e6 6. Nf3 Be7 7. cxd5 Nxd5) 4... Nc6 5. c3 Nf6 6. Bf4 Bg4 7. Qb3 Qd7 8. Nd2 e6'),
      line('two-knights', 'Two Knights (2.Nc3)', '1. e4 c6 2. Nc3 d5 3. Nf3 (3. d4 dxe4 4. Nxe4 Bf5) 3... Bg4 4. h3 Bxf3 5. Qxf3 e6 6. d3 Nf6 7. Bd2 Nbd7'),
      line('fantasy', 'Fantasy (3.f3) & 2.d3', '1. e4 c6 2. d4 (2. d3 d5 3. Nd2 e5 4. Ngf3 Bd6 5. g3 Nf6 6. Bg2 O-O 7. O-O Re8) 2... d5 3. f3 e6 4. Nc3 Bb4 5. a3 Bxc3+ 6. bxc3 dxe4 7. fxe4 e5 8. Nf3'),
    ],
  },
  {
    id: 'b-french',
    color: 'black',
    first: 'e4',
    reply: 'e6',
    opening: 'French',
    name: 'French Defence',
    lines: [
      line('classical', 'Classical (3.Nc3)', '1. e4 e6 2. d4 d5 3. Nc3 Nf6 4. e5 (4. Bg5 Be7 5. e5 Nfd7 6. Bxe7 Qxe7 7. f4 O-O 8. Nf3 c5) 4... Nfd7 5. f4 c5 6. Nf3 Nc6 7. Be3 cxd4 8. Nxd4 Bc5 9. Qd2 O-O 10. O-O-O a6'),
      line('advance', 'Advance (3.e5)', '1. e4 e6 2. d4 d5 3. e5 c5 4. c3 Nc6 5. Nf3 Qb6 6. a3 (6. Be2 cxd4 7. cxd4 Nh6 8. Nc3 Nf5) (6. Bd3 cxd4 7. cxd4 Bd7) 6... c4 7. Nbd2 Na5'),
      line('tarrasch', 'Tarrasch (3.Nd2)', '1. e4 e6 2. d4 d5 3. Nd2 c5 4. exd5 (4. Ngf3 cxd4 5. exd5 Qxd5 6. Bc4 Qd6 7. O-O Nf6 8. Nb3 Nc6 9. Nbxd4 Nxd4 10. Nxd4 a6) 4... Qxd5 5. Ngf3 cxd4 6. Bc4 Qd6 7. O-O Nf6 8. Nb3 Nc6 9. Nbxd4 Nxd4 10. Nxd4 a6'),
      line('exchange', 'Exchange, 2.d3 & 2.Nf3', '1. e4 e6 2. d4 (2. d3 d5 3. Nd2 Nf6 4. Ngf3 c5 5. g3 Nc6 6. Bg2 Be7 7. O-O O-O) (2. Nf3 d5 3. Nc3 Nf6 4. e5 Nfd7 5. d4 c5) 2... d5 3. exd5 exd5 4. Bd3 Bd6 5. Nf3 Ne7 6. O-O O-O'),
    ],
  },
  {
    id: 'b-e5',
    color: 'black',
    first: 'e4',
    reply: 'e5',
    opening: 'Open Games',
    name: '1…e5: Berlin & Classical',
    lines: [
      line('berlin', 'Ruy Lopez: Berlin', '1. e4 e5 2. Nf3 Nc6 3. Bb5 Nf6 4. O-O (4. d3 Bc5 5. c3 O-O 6. O-O d6) 4... Nxe4 5. d4 (5. Re1 Nd6 6. Nxe5 Be7 7. Bf1 Nxe5 8. Rxe5 O-O) 5... Nd6 6. Bxc6 dxc6 7. dxe5 Nf5 8. Qxd8+ Kxd8 9. Nc3 Ke8'),
      line('italian', 'Italian', '1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 (4. b4 Bxb4 5. c3 Be7) (4. O-O Nf6 5. d3 d6) (4. d3 Nf6 5. c3 d6) 4... Nf6 5. d3 (5. d4 exd4 6. e5 d5 7. Bb5 Ne4 8. cxd4 Bb6) 5... d6 6. O-O a6 7. a4 O-O'),
      line('scotch', 'Scotch & Four Knights', '1. e4 e5 2. Nf3 Nc6 3. d4 (3. Nc3 Nf6 4. Bb5 (4. d4 exd4 5. Nxd4 Bb4 6. Nxc6 bxc6 7. Bd3 d5) 4... Nd4 5. Nxd4 exd4 6. e5 dxc3 7. exf6 Qxf6 8. dxc3 Qe5+) 3... exd4 4. Nxd4 (4. Bc4 Nf6 5. e5 d5 6. Bb5 Ne4 7. Nxd4 Bd7 8. Bxc6 bxc6) (4. c3 d5 5. exd5 Qxd5 6. cxd4 Bg4) 4... Nf6 5. Nxc6 (5. Nc3 Bb4 6. Nxc6 bxc6 7. Bd3 d5) 5... bxc6 6. e5 Qe7 7. Qe2 Nd5 8. c4 Ba6'),
      line('vienna', 'Vienna, King’s Gambit & others', '1. e4 e5 2. Nc3 (2. f4 exf4 3. Nf3 d5 4. exd5 Nf6 5. Bc4 Nxd5 6. O-O Be7) (2. Bc4 Nf6 3. d3 c6 4. Nf3 d5 5. Bb3 Bd6) (2. d4 exd4 3. Qxd4 Nc6 4. Qe3 Nf6 5. Nc3 Bb4 6. Bd2 O-O 7. O-O-O Re8) 2... Nf6 3. f4 (3. Bc4 Nc6 4. d3 Bb4 5. Nge2 d5 6. exd5 Nxd5 7. O-O Be6) (3. g3 d5 4. exd5 Nxd5 5. Bg2 Nxc3 6. bxc3 Bd6) 3... d5 4. fxe5 Nxe4 5. Nf3 Be7 6. d4 O-O 7. Bd3 f5'),
    ],
  },
  {
    id: 'b-qgd',
    color: 'black',
    first: 'd4',
    reply: 'd5',
    opening: 'Queen’s Gambit Declined',
    name: msg('Queen’s Gambit Declined'),
    starter: true,
    lines: [
      line('bg5', 'Tartakower (4.Bg5)', '1. d4 d5 2. c4 e6 3. Nc3 Nf6 4. Bg5 Be7 5. e3 O-O 6. Nf3 h6 7. Bh4 b6 8. Be2 Bb7 9. Bxf6 Bxf6 10. cxd5 exd5'),
      line('exchange', 'Exchange (4.cxd5)', '1. d4 d5 2. c4 e6 3. Nc3 Nf6 4. cxd5 exd5 5. Bg5 c6 6. Qc2 Be7 7. e3 Nbd7 8. Bd3 O-O 9. Nge2 Re8'),
      line('bf4', '4.Nf3 & 5.Bf4', '1. d4 d5 2. c4 e6 3. Nc3 Nf6 4. Nf3 Be7 5. Bf4 (5. Bg5 O-O 6. e3 h6 7. Bh4 b6) 5... O-O 6. e3 c5 7. dxc5 Bxc5'),
      line('catalan', 'Catalan (3.Nf3, 4.g3)', '1. d4 d5 2. c4 e6 3. Nf3 Nf6 4. g3 (4. Nc3 Be7) 4... Be7 5. Bg2 O-O 6. O-O dxc4 7. Qc2 a6 8. Qxc4 b5 9. Qc2 Bb7'),
      line('london', 'London & Colle', '1. d4 d5 2. Bf4 (2. Nf3 Nf6 3. e3 e6 4. Bd3 c5 5. c3 Nc6 6. Nbd2 Bd6 7. O-O O-O) 2... Nf6 3. e3 c5 4. c3 Nc6 5. Nd2 e6 6. Ngf3 Bd6 7. Bg3 O-O 8. Bd3 b6'),
    ],
  },
  {
    id: 'b-slav',
    color: 'black',
    first: 'd4',
    reply: 'd5',
    opening: 'Slav',
    name: 'Slav Defence',
    lines: [
      line('main', 'Main line (4.Nc3 dxc4)', '1. d4 d5 2. c4 c6 3. Nf3 Nf6 4. Nc3 dxc4 5. a4 (5. e3 b5 6. a4 b4 7. Na2 e6) (5. e4 b5 6. e5 Nd5) 5... Bf5 6. e3 e6 7. Bxc4 Bb4 8. O-O O-O 9. Qe2 Nbd7'),
      line('quiet', 'Quiet (4.e3)', '1. d4 d5 2. c4 c6 3. Nf3 Nf6 4. e3 Bf5 5. Nc3 (5. Bd3 Bxd3 6. Qxd3 e6 7. O-O Nbd7) 5... e6 6. Nh4 Bg6 7. Nxg6 hxg6'),
      line('exchange', 'Exchange (3.cxd5)', '1. d4 d5 2. c4 c6 3. cxd5 cxd5 4. Nc3 (4. Nf3 Nf6 5. Nc3 Nc6 6. Bf4 Bf5) 4... Nf6 5. Bf4 Nc6 6. e3 Bf5'),
      line('nc3', '3.Nc3 & London', '1. d4 d5 2. c4 (2. Bf4 Nf6 3. e3 Bf5 4. c4 e6 5. Nc3 c6 6. Qb3 Qb6) 2... c6 3. Nc3 Nf6 4. e3 (4. Nf3 dxc4) 4... Bf5 5. Nf3 e6 6. Nh4 Bg6 7. Nxg6 hxg6'),
    ],
  },
  {
    id: 'b-kid',
    color: 'black',
    first: 'd4',
    reply: 'Nf6',
    opening: 'King’s Indian',
    name: 'King’s Indian Defence',
    lines: [
      line('classical', 'Classical (5.Nf3, 6.Be2)', '1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6 5. Nf3 O-O 6. Be2 e5 7. O-O (7. d5 a5 8. Bg5 h6 9. Bh4 Na6) (7. dxe5 dxe5 8. Qxd8 Rxd8 9. Bg5 Re8) 7... Nc6 8. d5 Ne7 9. Ne1 Nd7 10. Be3 f5'),
      line('samisch', 'Sämisch (5.f3)', '1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6 5. f3 O-O 6. Be3 e5 7. Nge2 (7. d5 Nh5 8. Qd2 f5 9. O-O-O Nd7) 7... c6'),
      line('others', '5.h3, 5.Be2 & 5.f4', '1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6 5. h3 (5. Be2 O-O 6. Bg5 Na6) (5. f4 O-O 6. Nf3 c5 7. d5 e6 8. Be2 exd5 9. cxd5) 5... O-O 6. Be3 e5 7. d5 a5'),
      line('fianchetto', 'Fianchetto (g3)', '1. d4 Nf6 2. c4 g6 3. Nf3 (3. g3 Bg7 4. Bg2 O-O 5. Nf3 d6 6. O-O Nbd7) 3... Bg7 4. g3 O-O 5. Bg2 d6 6. O-O Nbd7 7. Nc3 e5 8. e4 c6'),
      line('london', 'London & Trompowsky', '1. d4 Nf6 2. Bf4 (2. Bg5 Ne4 3. Bf4 c5 4. f3 Qa5+ 5. c3 Nf6 6. Nd2 cxd4 7. Nb3 Qb6 8. Qxd4 Nc6 9. Qxb6 axb6) (2. Nf3 g6 3. Bf4 Bg7 4. e3 O-O 5. Be2 d6 6. h3 c5) 2... g6 3. e3 Bg7 4. Nf3 O-O 5. Be2 d6 6. h3 c5 7. c3 b6'),
    ],
  },
  {
    id: 'b-nimzo',
    color: 'black',
    first: 'd4',
    reply: 'Nf6',
    opening: 'Nimzo-Indian',
    name: 'Nimzo- & Queen’s Indian',
    lines: [
      line('rubinstein', 'Rubinstein (4.e3)', '1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 4. e3 O-O 5. Bd3 (5. Nge2 d5 6. a3 Be7 7. cxd5 exd5) 5... d5 6. Nf3 c5 7. O-O dxc4 8. Bxc4 Nc6 9. a3 Ba5'),
      line('classical', 'Classical (4.Qc2)', '1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 4. Qc2 O-O 5. a3 (5. e4 d5 6. e5 Ne4 7. Bd3 c5) (5. Nf3 c5 6. dxc5 Na6 7. g3 Nxc5) 5... Bxc3+ 6. Qxc3 b6 7. Bg5 Bb7 8. f3 h6 9. Bh4 d5'),
      line('samisch', 'Sämisch, 4.f3, 4.Nf3 & 4.Bg5', '1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 4. f3 (4. a3 Bxc3+ 5. bxc3 c5 6. f3 d5) (4. Nf3 c5 5. g3 cxd4 6. Nxd4 O-O 7. Bg2 d5) (4. Bg5 h6 5. Bh4 c5 6. d5 d6 7. e3 exd5 8. cxd5 Nbd7) 4... d5 5. a3 Bxc3+ 6. bxc3 c5 7. cxd5 Nxd5'),
      line('qid', 'Queen’s Indian (3.Nf3)', '1. d4 Nf6 2. c4 e6 3. Nf3 b6 4. g3 (4. a3 Bb7 5. Nc3 d5 6. cxd5 Nxd5) (4. Nc3 Bb4 5. Bg5 Bb7 6. e3 h6 7. Bh4 g5 8. Bg3 Ne4 9. Qc2 Bxc3+ 10. bxc3 d6) (4. e3 Bb7 5. Bd3 c5 6. O-O Be7) 4... Ba6 5. b3 Bb4+ 6. Bd2 Be7 7. Bg2 c6 8. Bc3 d5'),
      line('catalan', 'Catalan, London & Trompowsky', '1. d4 Nf6 2. c4 (2. Bf4 e6 3. e3 c5 4. c3 Nc6 5. Nd2 d5) (2. Bg5 e6 3. e4 h6 4. Bxf6 Qxf6 5. Nc3 d6) (2. Nf3 e6 3. c4 b6) 2... e6 3. g3 d5 4. Bg2 Be7 5. Nf3 O-O 6. O-O dxc4 7. Qc2 a6 8. Qxc4 b5 9. Qc2 Bb7'),
    ],
  },
  {
    id: 'b-english-e5',
    color: 'black',
    first: 'c4',
    reply: 'e5',
    opening: 'Reversed Sicilian',
    name: '1…e5 with …d5',
    lines: [
      line('four-knights', 'Four Knights (2.Nc3, 3.Nf3)', '1. c4 e5 2. Nc3 Nf6 3. Nf3 Nc6 4. g3 (4. e3 Bb4 5. Qc2 Bxc3 6. Qxc3 Qe7 7. a3 a5) (4. d3 d5 5. cxd5 Nxd5) 4... d5 5. cxd5 Nxd5 6. Bg2 Nb6 7. O-O Be7 8. d3 O-O'),
      line('g3', '3.g3', '1. c4 e5 2. Nc3 Nf6 3. g3 d5 4. cxd5 Nxd5 5. Bg2 Nb6 6. Nf3 Nc6 7. O-O Be7 8. d3 O-O'),
      line('2g3', '2.g3', '1. c4 e5 2. g3 Nf6 3. Bg2 d5 4. cxd5 Nxd5 5. Nc3 Nb6 6. Nf3 Nc6 7. O-O Be7 8. d3 O-O'),
      line('nf3', '2.Nf3', '1. c4 e5 2. Nf3 e4 3. Nd4 Nc6 4. Nxc6 dxc6 5. Nc3 Nf6'),
    ],
  },
  {
    id: 'b-english-kid',
    color: 'black',
    first: 'c4',
    reply: 'Nf6',
    opening: 'King’s Indian setup',
    name: '1…Nf6 and …g6',
    lines: [
      line('e4', '2.Nc3 & 3.e4', '1. c4 Nf6 2. Nc3 g6 3. e4 d6 4. d4 Bg7 5. Nf3 O-O 6. Be2 e5'),
      line('g3', '2.Nc3 & 3.g3', '1. c4 Nf6 2. Nc3 g6 3. g3 Bg7 4. Bg2 O-O 5. Nf3 d6 6. O-O e5 7. d3 Nc6'),
      line('2g3', '2.g3', '1. c4 Nf6 2. g3 g6 3. Bg2 Bg7 4. Nc3 O-O 5. Nf3 d6 6. O-O e5'),
      line('nf3', '2.Nf3', '1. c4 Nf6 2. Nf3 g6 3. Nc3 (3. g3 Bg7 4. Bg2 O-O 5. O-O d6 6. Nc3 e5) 3... Bg7 4. e4 d6 5. d4 O-O 6. Be2 e5'),
    ],
  },
];

export const PACKS: Pack[] = [...WHITE_E4, ...WHITE_D4, ...WHITE_MORE, ...WHITE_C4, ...BLACK];

/* ---------------- Positions and names ---------------- */

/** The opening a pack fills, as moves: [first, reply]. */
export const packMoves = (p: Pick<Pack, 'first' | 'reply'>) => sanListToUcis([p.first, p.reply]);

export const firstFolderName = (color: Color, first: FirstMove) => (color === 'white' ? `1.${first}` : t('vs {move}', { move: `1.${first}` }));

/** "Caro-Kann (1…c6)": for White the reply you meet, for Black the defence you play. */
export function openingFolderName(color: Color, first: FirstMove, reply: string, opening?: string) {
  return `${opening ?? REPLY_NAMES[first][reply] ?? reply} (1…${reply})`;
}

/** What the first versions called White's opening folders, to tidy them up. */
const oldWhiteFolderName = (first: FirstMove, reply: string) => t('vs {move}', { move: `${REPLY_NAMES[first][reply] ?? reply} (1…${reply})` });


/** A line is named for what it answers; its folder already says which system or defence it belongs to. */
export const lineName = (_p: Pack, l: PackLine) => l.name;

export const lineSource = (p: Pack, l: PackLine) => `pack:${p.id}:${l.id}`;

export function packOf(source: string | null | undefined): { pack: Pack; line: PackLine } | undefined {
  const m = /^pack:([^:]+):(.+)$/.exec(source ?? '');
  const pack = m && PACKS.find((p) => p.id === m[1]);
  const l = pack?.lines.find((x) => x.id === m![2]);
  return pack && l ? { pack, line: l } : undefined;
}

/** The pack's lines already in the library (live). */
export function packLinesIn(reps: Repertoire[], p: Pack): Repertoire[] {
  const ids = new Set(p.lines.map((l) => lineSource(p, l)));
  return reps.filter((r) => !r.deleted && r.source && ids.has(r.source));
}

/* ---------------- Adding ---------------- */

/** Finds or makes the folder for a first move, then for the opening, under the colour's root. */
export async function ensureOpeningFolders(color: Color, first: FirstMove, reply?: string, opening?: string): Promise<Folder> {
  const lib = useLibrary.getState();
  await lib.load();
  const live = () => useLibrary.getState().folders.filter((f) => !f.deleted);
  const root = live().find((f) => f.parentId === null && f.color === color);
  const firstUcis = sanListToUcis([first]);
  // Same name, or (unless two defences share the position) the same position under a name you chose.
  const find = (parentId: string | null, name: string, ucis: string[], byPosition: boolean) =>
    live().find((f) => f.parentId === parentId && (f.name === name || (byPosition && f.rootMovesUci?.join(' ') === ucis.join(' '))));
  const firstName = firstFolderName(color, first);
  const l1 = find(root?.id ?? null, firstName, firstUcis, true) ?? (await useLibrary.getState().createFolder(firstName, color, root?.id ?? null, firstUcis));
  if (!reply) return l1;
  const ucis = sanListToUcis([first, reply]);
  const name = openingFolderName(color, first, reply, opening);
  return find(l1.id, name, ucis, color === 'white' || !opening) ?? (await useLibrary.getState().createFolder(name, color, l1.id, ucis));
}

/** The moves every line of a pack shares (its system), e.g. 1.e4 e5 2.Nc3 for the Vienna. */
export function packCommonMoves(p: Pack): string[] {
  const all = p.lines.map((l) => sanListToUcis(mainLineText(l.pgn, 40).replace(/\d+\.\s*/g, '').split(/\s+/).filter(Boolean)));
  let common = all[0] ?? [];
  for (const u of all) {
    let i = 0;
    while (i < common.length && common[i] === u[i]) i++;
    common = common.slice(0, i);
  }
  return common.length >= 2 ? common : packMoves(p);
}

/** Where a pack's lines live: the opening folder for Black; for White a folder for the system inside the reply's folder. */
export async function packFolder(p: Pack): Promise<Folder> {
  const opening = await ensureOpeningFolders(p.color, p.first, p.reply, p.opening);
  if (p.color === 'black') return opening;
  const name = t(p.name);
  return (
    useLibrary.getState().folders.find((f) => !f.deleted && f.parentId === opening.id && f.name === name) ??
    (await useLibrary.getState().createFolder(name, p.color, opening.id, packCommonMoves(p)))
  );
}

/** Adds a pack's lines (any not already there) into their folder; returns the folder. */
export async function addPack(p: Pack): Promise<Folder> {
  const folder = await packFolder(p);
  const have = new Set(packLinesIn(useLibrary.getState().reps, p).map((r) => r.source));
  const root = packMoves(p);
  for (const l of p.lines) {
    const source = lineSource(p, l);
    if (have.has(source)) continue;
    const rep = await useLibrary.getState().createRepertoire({ name: lineName(p, l), color: p.color, folderId: folder.id, rootMovesUci: root, source });
    await useLibrary.getState().importPgn(rep.id, l.pgn);
  }
  return folder;
}

/** The line's main moves as "1. e4 c5 2. Nf3 …" (variations stripped), up to `plies`. */
export function mainLineText(pgn: string, plies = 10): string {
  let depth = 0;
  let flat = '';
  for (const ch of pgn) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (depth === 0) flat += ch;
  }
  const sans = flat.replace(/\*/g, '').replace(/\d+\.(\.\.)?/g, ' ').split(/\s+/).filter(Boolean).slice(0, plies);
  return sans.map((s, i) => (i % 2 ? s : `${i / 2 + 1}. ${s}`)).join(' ');
}

/* ---------------- Your weak spots ---------------- */

export interface OpeningRecord {
  color: Color;
  first: FirstMove;
  reply: string;
  games: number;
  score: number;
  win: number;
  draw: number;
  loss: number;
}

const firstOf = (u: string): FirstMove | undefined => ({ e2e4: 'e4', d2d4: 'd4', c2c4: 'c4', g1f3: 'Nf3', b1c3: 'Nc3' })[u] as FirstMove | undefined;

/** Your score in each opening (your colour × 1st move × reply) across imported games. */
export function openingRecords(games: PlayedGame[]): OpeningRecord[] {
  const by = new Map<string, OpeningRecord>();
  const replySan = new Map<string, string>();
  for (const f of FIRST_MOVES) for (const r of Object.keys(REPLY_NAMES[f])) replySan.set(sanListToUcis([f, r]).join(' '), r);
  for (const g of games) {
    const first = firstOf(g.ucis[0] ?? '');
    const reply = first && replySan.get(g.ucis.slice(0, 2).join(' '));
    if (!first || !reply) continue;
    const key = `${g.color}|${first}|${reply}`;
    const r = by.get(key) ?? { color: g.color, first, reply, games: 0, score: 0, win: 0, draw: 0, loss: 0 };
    r.games++;
    r[g.result]++;
    by.set(key, r);
  }
  for (const r of by.values()) r.score = (r.win + r.draw / 2) / r.games;
  return [...by.values()];
}

export const MIN_GAMES_FOR_WEAKNESS = 5;

/**
 * Openings that cost you the most points: at least a few games, under 50%, ranked by points dropped
 * against an even score (so 2/10 outranks 0/2), each with the packs that answer it.
 */
export function weakSpots(games: PlayedGame[]): (OpeningRecord & { packs: Pack[] })[] {
  return openingRecords(games)
    .filter((r) => r.games >= MIN_GAMES_FOR_WEAKNESS && r.score < 0.5)
    .sort((a, b) => b.games * (0.5 - b.score) - a.games * (0.5 - a.score))
    .map((r) => ({ ...r, packs: PACKS.filter((p) => p.color === r.color && p.first === r.first && p.reply === r.reply) }));
}

export const recordFor = (records: OpeningRecord[], color: Color, first: FirstMove, reply: string) => records.find((r) => r.color === color && r.first === first && r.reply === reply);

/**
 * Lines added by the first version of ready-made openings sat straight in a "vs …" folder with the system in
 * their name. Moves them into their system's folder and drops the prefix — only where they were left as added.
 */
export async function tidyPackLines() {
  try {
    if (localStorage.getItem('ml.tidy.packs') === '1') return;
  } catch {
    return;
  }
  const lib = useLibrary.getState();
  await lib.load();
  for (const p of PACKS) {
    const old = oldWhiteFolderName(p.first, p.reply);
    for (const rep of packLinesIn(useLibrary.getState().reps, p)) {
      const folder = useLibrary.getState().folders.find((f) => f.id === rep.folderId);
      if (p.color !== 'white' || !folder || folder.name !== old) continue;
      const target = await packFolder(p);
      await useLibrary.getState().moveRepertoire(rep.id, target.id);
      const l = packOf(rep.source)?.line;
      if (l && rep.name === `${t(p.name)}: ${l.name}`) await useLibrary.getState().renameRepertoire(rep.id, l.name);
    }
  }
  for (const f of useLibrary.getState().folders) {
    if (f.deleted || f.color !== 'white' || f.rootMovesUci?.length !== 2) continue;
    const first = ({ e2e4: 'e4', d2d4: 'd4', c2c4: 'c4', g1f3: 'Nf3', b1c3: 'Nc3' } as Record<string, FirstMove>)[f.rootMovesUci[0]!];
    const reply = first && replySan(first, f.rootMovesUci[1]!);
    if (first && reply && f.name === oldWhiteFolderName(first, reply)) await useLibrary.getState().renameFolder(f.id, openingFolderName('white', first, reply));
  }
  try {
    localStorage.setItem('ml.tidy.packs', '1');
  } catch {
    /* tidies again next time */
  }
}
