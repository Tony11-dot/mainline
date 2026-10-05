import type { Color, Repertoire } from '@mainline/shared';
import { msg, t } from './i18n';
import { useLibrary } from './library';

/**
 * Ready-made repertoires. Each answers every main reply (White) or every main try (Black) with a sound,
 * mainstream line a few moves deep, ready to learn as is or to grow with the guided builder.
 */
export interface Template {
  id: string;
  /** Translated for the original starters; the combos are named after their openings (proper names). */
  name: string;
  color: Color;
  /** White: the first move it plays. Black: the first move it answers. */
  vs: '1.e4' | '1.d4';
  blurb: string;
  /** What it plays against each main reply: [moves, opening name]. */
  covers: [string, string][];
  pgn: string;
  /** Offered on the welcome screen. */
  starter?: boolean;
}

/** One answer to one first reply: the reply (Black's first move) and White's line after it, in PGN. */
interface Fragment {
  reply: string;
  name: string;
  line: string;
}

/** A White repertoire from its answers to each first reply; the first fragment is the main line. */
function white(first: '1.e4' | '1.d4', parts: Fragment[]): { pgn: string; covers: [string, string][] } {
  const [main, ...rest] = parts;
  const alt = rest.map((p) => `(1... ${p.reply} ${p.line})`).join(' ');
  return {
    pgn: `1. ${first.slice(2)} ${main!.reply} ${alt} ${main!.line} *`,
    covers: parts.map((p) => [`1…${p.reply}`, p.name]),
  };
}

/* ---------------- 1.e4: answers to each reply ---------------- */

const PETROV_PHILIDOR = '(2... Nf6 3. Nxe5 d6 4. Nf3 Nxe4 5. d4 d5 6. Bd3 Nc6 7. O-O Be7 8. c4) (2... d6 3. d4 exd4 4. Nxd4 Nf6 5. Nc3 Be7 6. Bf4)';

const E5 = {
  ruy: {
    reply: 'e5',
    name: 'Ruy Lopez',
    line: `2. Nf3 Nc6 ${PETROV_PHILIDOR} 3. Bb5 a6 (3... Nf6 4. O-O Nxe4 5. d4 Nd6 6. Bxc6 dxc6 7. dxe5 Nf5 8. Qxd8+ Kxd8 9. Nc3) (3... Bc5 4. c3 Nf6 5. d4 Bb6 6. O-O) 4. Ba4 Nf6 5. O-O Be7 (5... Nxe4 6. d4 b5 7. Bb3 d5 8. dxe5 Be6 9. Nbd2) (5... b5 6. Bb3 Bc5 7. a4 Rb8 8. c3 d6 9. d4 Bb6) 6. Re1 b5 7. Bb3 d6 (7... O-O 8. c3 d5 9. exd5 Nxd5 10. Nxe5 Nxe5 11. Rxe5 c6 12. d4 Bd6 13. Re1) 8. c3 O-O 9. h3`,
  },
  italian: {
    reply: 'e5',
    name: 'Italian Game',
    line: `2. Nf3 Nc6 ${PETROV_PHILIDOR} 3. Bc4 Bc5 (3... Nf6 4. d3 Bc5 5. c3 d6 6. O-O O-O 7. Re1 a6 8. Bb3) (3... Be7 4. d4 d6 5. Nc3 Nf6 6. h3) 4. c3 Nf6 5. d3 d6 (5... O-O 6. O-O d5 7. exd5 Nxd5 8. a4) 6. O-O O-O 7. Re1 a6 8. Bb3 Ba7 9. h3 h6 10. Nbd2`,
  },
  vienna: {
    reply: 'e5',
    name: 'Vienna Game',
    line: '2. Nc3 Nf6 (2... Nc6 3. Bc4 Nf6 4. d3 Bc5 5. f4 d6 6. Nf3) (2... Bc5 3. Nf3 d6 4. d4 exd4 5. Nxd4 Nf6 6. Bg5) 3. f4 d5 (3... exf4 4. e5 Ng8 5. Nf3 d6 6. d4) 4. fxe5 Nxe4 5. Nf3 Be7 (5... Bc5 6. d4 Bb4 7. Bd2) (5... Nc6 6. Qe2 Nxc3 7. dxc3) 6. d4 O-O 7. Bd3 f5 8. exf6 Bxf6 9. O-O',
  },
  kingsGambit: {
    reply: 'e5',
    name: 'King’s Gambit',
    line: '2. f4 exf4 (2... d5 3. exd5 exf4 4. Nf3 Nf6 5. Bb5+) (2... Bc5 3. Nf3 d6 4. c3 Nf6 5. d4 exd4 6. cxd4 Bb4+ 7. Bd2) 3. Nf3 g5 (3... d5 4. exd5 Nf6 5. Bb5+ c6 6. dxc6 bxc6 7. Bc4) (3... d6 4. d4 g5 5. h4 g4 6. Ng1) (3... Nf6 4. e5 Nh5 5. Qe2 Be7 6. d4) 4. h4 g4 5. Ne5 Nf6 6. d4 d6 7. Nd3 Nxe4 8. Bxf4',
  },
} satisfies Record<string, Fragment>;

const C5 = {
  open: {
    reply: 'c5',
    name: 'Open Sicilian',
    line: '2. Nf3 d6 (2... Nc6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 e5 6. Ndb5 d6 7. Bg5 a6 8. Na3 b5 9. Bxf6 gxf6 10. Nd5) (2... e6 3. d4 cxd4 4. Nxd4 Nc6 (4... a6 5. Bd3 Nf6 6. O-O) 5. Nc3 Qc7 6. Be3 a6 7. Qf3) (2... g6 3. d4 cxd4 4. Nxd4 Nc6 5. c4) 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 (5... g6 6. Be3 Bg7 7. f3 O-O 8. Qd2 Nc6 9. O-O-O) (5... Nc6 6. Bg5 e6 7. Qd2 a6 8. O-O-O) (5... e6 6. g4) 6. Be3 e5 (6... e6 7. f3 b5 8. Qd2) 7. Nb3 Be6 8. f3 Be7 9. Qd2 O-O 10. O-O-O',
  },
  alapin: {
    reply: 'c5',
    name: 'Alapin Sicilian',
    line: '2. c3 Nf6 (2... d5 3. exd5 Qxd5 4. d4 Nf6 5. Nf3 e6 (5... Bg4 6. Be2 e6 7. O-O Nc6 8. h3) 6. Be3 cxd4 7. cxd4 Nc6 8. Nc3 Qd6) (2... e6 3. d4 d5 4. e5 Nc6 5. Nf3 Qb6 6. a3) (2... Nc6 3. d4 d5 4. exd5 Qxd5 5. Nf3 Bg4 6. Be2 cxd4 7. cxd4 e6 8. Nc3) (2... g6 3. d4 cxd4 4. cxd4 d5 5. e5) 3. e5 Nd5 4. d4 cxd4 5. Nf3 Nc6 (5... e6 6. cxd4 b6 7. Nc3) (5... d6 6. Bc4 Nb6 7. Bb3) 6. Bc4 Nb6 7. Bb3 d5 8. exd6 Qxd6 9. O-O',
  },
  grandPrix: {
    reply: 'c5',
    name: 'Grand Prix Attack',
    line: '2. Nc3 Nc6 (2... d6 3. f4 Nc6 4. Nf3 g6 5. Bb5 Bd7 6. O-O Bg7 7. d3) (2... e6 3. f4 d5 4. Nf3 Nf6 5. e5 Nfd7 6. g3 Nc6 7. Bg2) 3. f4 g6 (3... e6 4. Nf3 d5 5. Bb5 Nge7 6. Qe2) 4. Nf3 Bg7 5. Bb5 Nd4 6. O-O a6 7. Bd3 d6 8. Nxd4 cxd4 9. Ne2',
  },
  smithMorra: {
    reply: 'c5',
    name: 'Smith-Morra Gambit',
    line: '2. d4 cxd4 3. c3 dxc3 (3... Nf6 4. e5 Nd5 5. Nf3 Nc6 6. Bc4 Nb6 7. Bb3 d5 8. exd6) (3... d5 4. exd5 Qxd5 5. cxd4 Nc6 6. Nf3) 4. Nxc3 Nc6 5. Nf3 d6 (5... e6 6. Bc4 a6 7. O-O Nge7 8. Bg5) 6. Bc4 e6 7. O-O Nf6 8. Qe2 Be7 9. Rd1 e5 10. h3',
  },
} satisfies Record<string, Fragment>;

const C6 = {
  advance: {
    reply: 'c6',
    name: 'Caro-Kann: Advance',
    line: '2. d4 d5 3. e5 Bf5 (3... c5 4. dxc5 e6 5. Nf3 Bxc5 6. Bd3) 4. Nf3 e6 5. Be2 c5 (5... Nd7 6. O-O Ne7 7. Nh4) 6. Be3 Nd7 (6... cxd4 7. Nxd4 Ne7 8. O-O) 7. O-O Ne7 8. c4',
  },
  exchange: {
    reply: 'c6',
    name: 'Caro-Kann: Exchange',
    line: '2. d4 d5 3. exd5 cxd5 4. Bd3 Nc6 5. c3 Nf6 (5... Qc7 6. Ne2 Bg4 7. f3) 6. Bf4 Bg4 (6... g6 7. Nf3 Bf5 8. Bxf5 gxf5 9. Qb3) 7. Qb3 Qd7 (7... Na5 8. Qa4+ Bd7 9. Qc2) 8. Nd2 e6 9. Ngf3 Bd6 10. Bxd6 Qxd6 11. O-O',
  },
  twoKnights: {
    reply: 'c6',
    name: 'Caro-Kann: Two Knights',
    line: '2. Nc3 d5 3. Nf3 Bg4 (3... dxe4 4. Nxe4 Nf6 5. Nxf6+ exf6 6. d4 Bd6 7. Bd3) (3... Nf6 4. e5 Ne4 5. Ne2 Qb6 6. d4 c5 7. c3) 4. h3 Bxf3 (4... Bh5 5. exd5 cxd5 6. Bb5+ Nc6 7. g4 Bg6 8. Ne5) 5. Qxf3 e6 6. d3 Nf6 7. a3',
  },
  fantasy: {
    reply: 'c6',
    name: 'Caro-Kann: Fantasy',
    line: '2. d4 d5 3. f3 e6 (3... dxe4 4. fxe4 e5 5. Nf3 exd4 6. Bc4 Bb4+ 7. c3) (3... g6 4. Nc3 Bg7 5. Be3) 4. Nc3 Bb4 5. a3 Bxc3+ 6. bxc3 dxe4 7. fxe4 e5 8. Nf3',
  },
} satisfies Record<string, Fragment>;

const E6 = {
  tarrasch: {
    reply: 'e6',
    name: 'French: Tarrasch',
    line: '2. d4 d5 3. Nd2 c5 (3... Nf6 4. e5 Nfd7 5. Bd3 c5 6. c3 Nc6 7. Ne2 cxd4 8. cxd4 f6 9. exf6 Nxf6 10. Nf3) (3... dxe4 4. Nxe4 Nd7 5. Nf3 Ngf6 6. Nxf6+ Nxf6 7. c3) (3... Be7 4. Ngf3 Nf6 5. Bd3 c5 6. e5) 4. exd5 Qxd5 (4... exd5 5. Ngf3 Nc6 6. Bb5 Bd6 7. dxc5 Bxc5 8. O-O) 5. Ngf3 cxd4 6. Bc4 Qd6 7. O-O Nf6 8. Nb3 Nc6 9. Nbxd4 Nxd4 10. Nxd4 a6 11. Re1',
  },
  advance: {
    reply: 'e6',
    name: 'French: Advance',
    line: '2. d4 d5 3. e5 c5 (3... b6 4. c3 Qd7 5. Nf3 Ba6 6. Bxa6 Nxa6 7. O-O) 4. c3 Nc6 5. Nf3 Qb6 (5... Bd7 6. Be2 Nge7 7. Na3 cxd4 8. cxd4 Nf5 9. Nc2) 6. a3 c4 (6... Bd7 7. b4 cxd4 8. cxd4 Rc8 9. Bb2) 7. Nbd2 Na5 8. Rb1 Bd7 9. h4',
  },
  nc3: {
    reply: 'e6',
    name: 'French: Winawer & Classical',
    line: '2. d4 d5 3. Nc3 Bb4 (3... Nf6 4. e5 Nfd7 5. f4 c5 6. Nf3 Nc6 7. Be3 cxd4 8. Nxd4 Bc5 9. Qd2 O-O 10. O-O-O) (3... dxe4 4. Nxe4 Nd7 5. Nf3 Ngf6 6. Nxf6+ Nxf6 7. c3) 4. e5 c5 5. a3 Bxc3+ 6. bxc3 Ne7 7. Qg4 O-O (7... Qc7 8. Qxg7 Rg8 9. Qxh7 cxd4 10. Ne2) 8. Bd3',
  },
} satisfies Record<string, Fragment>;

const SCANDI: Fragment = {
  reply: 'd5',
  name: 'Scandinavian',
  line: '2. exd5 Qxd5 (2... Nf6 3. d4 Nxd5 4. Nf3 g6 5. c4 Nb6 6. Nc3 Bg7 7. h3) 3. Nc3 Qa5 (3... Qd6 4. d4 Nf6 5. Nf3 a6 6. g3) (3... Qd8 4. d4 Nf6 5. Nf3 Bg4 6. h3 Bxf3 7. Qxf3 c6 8. Be3) 4. d4 Nf6 5. Nf3 c6 (5... Bf5 6. Bd2 c6 7. Bc4 e6 8. Qe2) (5... Bg4 6. h3 Bh5 7. g4 Bg6 8. Ne5) 6. Bc4 Bf5 7. Bd2 e6 8. Qe2 Bb4 9. O-O-O',
};

const ALEKHINE: Fragment = {
  reply: 'Nf6',
  name: 'Alekhine: Modern',
  line: '2. e5 Nd5 3. d4 d6 4. Nf3 dxe5 (4... g6 5. Bc4 Nb6 6. Bb3 Bg7 7. a4 a5 8. Ng5) (4... Bg4 5. Be2 e6 6. O-O Be7 7. c4 Nb6 8. h3 Bh5 9. Nc3) 5. Nxe5 c6 (5... g6 6. Bc4 c6 7. O-O Bg7 8. Re1) 6. Be2 Bf5 7. O-O Nd7 8. Nf3 e6 9. c4',
};

const PIRC = {
  attack150: {
    reply: 'd6',
    name: 'Pirc: 150 Attack',
    line: '2. d4 Nf6 3. Nc3 g6 (3... e5 4. Nf3 Nbd7 5. Bc4 Be7 6. O-O O-O 7. Re1 c6 8. a4) 4. Be3 Bg7 (4... c6 5. Qd2 b5 6. f3 Nbd7 7. Bd3) 5. Qd2 c6 (5... O-O 6. O-O-O c6 7. f3 b5 8. h4) 6. Bh6 Bxh6 7. Qxh6 Qa5 8. Bd3',
  },
  austrian: {
    reply: 'd6',
    name: 'Pirc: Austrian Attack',
    line: '2. d4 Nf6 3. Nc3 g6 (3... e5 4. Nf3 Nbd7 5. Bc4 Be7 6. O-O O-O 7. Re1 c6 8. a4) 4. f4 Bg7 5. Nf3 O-O (5... c5 6. Bb5+ Bd7 7. e5 Ng4 8. e6) 6. Bd3 Na6 (6... Nc6 7. e5) 7. O-O c5 8. d5',
  },
} satisfies Record<string, Fragment>;

const MODERN = {
  attack150: { reply: 'g6', name: 'Modern Defence', line: '2. d4 Bg7 3. Nc3 d6 (3... c6 4. Nf3 d5 5. h3) 4. Be3 Nf6 5. Qd2' },
  austrian: { reply: 'g6', name: 'Modern Defence', line: '2. d4 Bg7 3. Nc3 d6 (3... c6 4. Nf3 d5 5. h3) 4. f4 Nf6 5. Nf3' },
} satisfies Record<string, Fragment>;

const NIMZOWITSCH: Fragment = { reply: 'Nc6', name: 'Nimzowitsch Defence', line: '2. Nf3 d6 3. d4 Nf6 4. Nc3 Bg4 5. Be2 e6 6. O-O' };

/* ---------------- 1.d4: answers to each reply ---------------- */

const D5 = {
  queensGambit: {
    reply: 'd5',
    name: 'Queen’s Gambit',
    line: '2. c4 e6 (2... c6 3. Nf3 Nf6 4. Nc3 dxc4 (4... e6 5. Bg5 h6 6. Bh4 dxc4 7. e4 g5 8. Bg3 b5 9. Be2) (4... a6 5. e3 b5 6. b3) 5. a4 Bf5 6. e3 e6 7. Bxc4 Bb4 8. O-O Nbd7 9. Qe2) (2... dxc4 3. e4 e5 (3... Nf6 4. e5 Nd5 5. Bxc4 Nb6 6. Bb3) (3... c5 4. d5 Nf6 5. Nc3 b5) 4. Nf3 exd4 5. Bxc4 Nc6 6. O-O Be6 7. Bxe6 fxe6 8. Qb3) (2... Nc6 3. Nf3 Bg4 4. cxd5 Bxf3 5. gxf3 Qxd5 6. e3) (2... Nf6 3. cxd5 Nxd5 4. e4 Nf6 5. Nc3) (2... e5 3. dxe5 d4 4. Nf3 Nc6 5. g3) 3. Nc3 Nf6 (3... Be7 4. Nf3 Nf6 5. Bf4 O-O 6. e3) (3... c5 4. cxd5 exd5 5. Nf3 Nc6 6. g3 Nf6 7. Bg2 Be7 8. O-O) 4. cxd5 exd5 5. Bg5 Be7 (5... c6 6. Qc2 Be7 7. e3) 6. e3 c6 7. Qc2 Nbd7 8. Bd3 O-O 9. Nge2 Re8 10. O-O',
  },
  london: {
    reply: 'd5',
    name: 'London System',
    line: '2. Bf4 Nf6 (2... c5 3. e3 Nc6 4. c3 Nf6 5. Nd2 e6 6. Ngf3 Bd6 7. Bg3 O-O 8. Bd3) (2... Bf5 3. e3 e6 4. c4 Nf6 5. Nc3) 3. e3 e6 (3... c5 4. c3 Nc6 5. Nd2 Bf5 6. Ngf3 e6 7. Qb3 Qc8) (3... Bf5 4. c4 e6 5. Nc3 Bb4 6. Qb3) (3... g6 4. Nf3 Bg7 5. Be2 O-O 6. O-O c5 7. c3) 4. Nf3 c5 (4... Bd6 5. Bg3 O-O 6. Bd3 c5 7. c3 Nc6 8. Nbd2) 5. c3 Nc6 6. Nbd2 Bd6 7. Bg3 O-O 8. Bd3',
  },
  catalan: {
    reply: 'd5',
    name: 'Catalan',
    line: '2. c4 e6 (2... c6 3. Nf3 Nf6 4. e3 Bf5 5. Nc3 e6 6. Nh4 Bg6 7. Nxg6 hxg6) (2... dxc4 3. Nf3 Nf6 4. e3 e6 5. Bxc4 c5 6. O-O a6 7. a4) (2... Nc6 3. Nf3 Bg4 4. cxd5 Bxf3 5. gxf3 Qxd5 6. e3) (2... e5 3. dxe5 d4 4. Nf3 Nc6 5. g3) 3. Nf3 Nf6 4. g3 Be7 (4... dxc4 5. Bg2 a6 6. O-O) (4... Bb4+ 5. Bd2 Be7 6. Bg2 O-O 7. O-O) 5. Bg2 O-O 6. O-O dxc4 (6... c6 7. Qc2 Nbd7 8. Nbd2 b6 9. e4 Bb7 10. b3) 7. Qc2 a6 8. Qxc4 b5 9. Qc2 Bb7 10. Bd2',
  },
} satisfies Record<string, Fragment>;

const NF6 = {
  queensGambit: {
    reply: 'Nf6',
    name: 'Nimzo, King’s Indian, Grünfeld',
    line: '2. c4 e6 (2... g6 3. Nc3 Bg7 (3... d5 4. cxd5 Nxd5 5. e4 Nxc3 6. bxc3 Bg7 7. Nf3 c5 8. Be3 Qa5 9. Qd2) 4. e4 d6 5. Nf3 O-O 6. Be2 e5 7. O-O Nc6 (7... Nbd7 8. Re1 c6 9. Bf1) (7... exd4 8. Nxd4 Re8 9. f3) 8. d5 Ne7 9. Ne1 Nd7 10. Be3 f5 11. f3) (2... c5 3. d5 e6 (3... b5 4. cxb5 a6 5. bxa6 g6 6. Nc3 Bxa6 7. e4 Bxf1 8. Kxf1) 4. Nc3 exd5 5. cxd5 d6 6. e4 g6 7. Nf3 Bg7 8. Be2 O-O 9. O-O) (2... e5 3. dxe5 Ng4 4. Bf4 Nc6 5. Nf3 Bb4+ 6. Nbd2) 3. Nc3 Bb4 (3... d5 4. cxd5 exd5 5. Bg5 Be7 6. e3) (3... b6 4. e4 Bb7 5. Bd3) (3... c5 4. d5 exd5 5. cxd5 d6 6. e4 g6 7. Nf3 Bg7 8. Be2 O-O 9. O-O) 4. Qc2 O-O (4... d5 5. cxd5 exd5 6. Bg5 h6 7. Bh4 c5 8. dxc5) (4... c5 5. dxc5 O-O 6. a3 Bxc5 7. Nf3) 5. a3 Bxc3+ 6. Qxc3 b6 (6... d5 7. Nf3 dxc4 8. Qxc4 b6 9. Bf4) 7. Bg5 Bb7 8. f3 h6 9. Bh4 d5 10. e3',
  },
  london: {
    reply: 'Nf6',
    name: 'London System',
    line: '2. Bf4 g6 (2... e6 3. e3 c5 4. c3 b6 5. Nd2 Bb7 6. Ngf3 Be7 7. h3) (2... d5 3. e3) (2... c5 3. d5 d6 4. Nc3 g6 5. e4 Bg7 6. Nf3 O-O 7. Be2) 3. e3 Bg7 4. Nf3 O-O 5. Be2 d6 6. h3 c5 7. c3',
  },
  catalan: {
    reply: 'Nf6',
    name: 'Catalan & Fianchetto',
    line: '2. c4 e6 (2... g6 3. g3 Bg7 (3... d5 4. cxd5 Nxd5 5. Bg2 Bg7 6. Nf3 O-O 7. O-O) 4. Bg2 O-O 5. Nf3 d6 6. O-O Nbd7 (6... Nc6 7. Nc3 a6 8. d5 Na5 9. Nd2 c5 10. Qc2) 7. Nc3 e5 8. e4 c6 9. h3) (2... c5 3. d5 e6 4. Nc3 exd5 5. cxd5 d6 6. Nf3 g6 7. g3 Bg7 8. Bg2 O-O 9. O-O) (2... e5 3. dxe5 Ng4 4. Bf4 Nc6 5. Nf3 Bb4+ 6. Nbd2) 3. g3 d5 (3... Bb4+ 4. Bd2 Be7 5. Bg2 d5 6. Nf3 O-O 7. O-O) 4. Bg2 Be7 5. Nf3 O-O 6. O-O',
  },
  trompowsky: {
    reply: 'Nf6',
    name: 'Trompowsky',
    line: '2. Bg5 Ne4 (2... e6 3. e4 h6 4. Bxf6 Qxf6 5. Nc3 d6 6. Qd2) (2... d5 3. Bxf6 exf6 4. e3 Bd6 5. c4 dxc4 6. Bxc4) (2... c5 3. Bxf6 gxf6 4. d5 Qb6 5. Qc1 f5 6. c3) (2... g6 3. Bxf6 exf6 4. c4 Bg7 5. Nc3 d6 6. e3) 3. Bf4 c5 (3... d5 4. e3 c5 5. Bd3 Nf6 6. c3) 4. f3 Qa5+ 5. c3 Nf6 6. Nd2 cxd4 7. Nb3 Qb6 8. Qxd4 Nc6 9. Qxb6 axb6 10. Nd4',
  },
} satisfies Record<string, Fragment>;

const DUTCH = {
  fianchetto: { reply: 'f5', name: 'Dutch: Fianchetto', line: '2. g3 Nf6 3. Bg2 g6 (3... e6 4. Nf3 d5 5. O-O Bd6 6. c4 c6 7. b3) 4. Nf3 Bg7 5. O-O O-O 6. c4 d6 7. Nc3' },
  london: { reply: 'f5', name: 'Dutch vs London', line: '2. Nf3 Nf6 3. Bf4 e6 4. e3 b6 5. h3 Bb7 6. Nbd2 Be7 7. Bd3' },
} satisfies Record<string, Fragment>;

const BENONI: Fragment = {
  reply: 'c5',
  name: 'Benoni',
  line: '2. d5 Nf6 (2... e5 3. e4 d6 4. Nc3 Be7 5. Nf3) (2... d6 3. e4 Nf6 4. Nc3 g6 5. Nf3 Bg7 6. Be2) 3. Nc3 d6 4. e4 g6 5. Nf3 Bg7 6. Be2 O-O 7. O-O',
};

const SIDELINES_D4 = {
  queensGambit: [
    { reply: 'e6', name: 'Nimzo-Indian', line: '2. c4 Nf6 3. Nc3 Bb4 4. Qc2' },
    { reply: 'g6', name: 'King’s Indian', line: '2. c4 Bg7 3. Nc3 d6 4. e4 Nf6 5. Nf3 O-O 6. Be2' },
    { reply: 'd6', name: 'King’s Indian', line: '2. Nf3 Nf6 3. c4 g6 4. Nc3 Bg7 5. e4 O-O 6. Be2' },
  ],
  london: [
    { reply: 'e6', name: 'London System', line: '2. Nf3 Nf6 3. Bf4 c5 4. e3' },
    { reply: 'g6', name: 'London System', line: '2. Nf3 Bg7 3. Bf4 d6 4. e3 Nf6 5. Be2 O-O 6. h3' },
    { reply: 'd6', name: 'London System', line: '2. Nf3 Nf6 3. Bf4 g6 4. e3 Bg7 5. Be2 O-O 6. h3' },
  ],
  catalan: [
    { reply: 'e6', name: 'Catalan', line: '2. c4 Nf6 3. g3' },
    { reply: 'g6', name: 'King’s Indian: Fianchetto', line: '2. c4 Bg7 3. Nf3 d6 4. g3 Nf6 5. Bg2 O-O 6. O-O' },
    { reply: 'd6', name: 'King’s Indian: Fianchetto', line: '2. Nf3 Nf6 3. c4 g6 4. g3 Bg7 5. Bg2 O-O 6. O-O' },
  ],
} satisfies Record<string, Fragment[]>;

/* ---------------- The repertoires ---------------- */

export const TEMPLATES: Template[] = [
  {
    id: 'italian',
    name: msg('Italian Game'),
    color: 'white',
    vs: '1.e4',
    blurb: msg('Quick development, aim at f7, calm plans with c3 and d3.'),
    starter: true,
    ...white('1.e4', [E5.italian, C5.alapin, C6.exchange, E6.advance, SCANDI, ALEKHINE, PIRC.attack150, MODERN.attack150, NIMZOWITSCH]),
  },
  {
    id: 'ruy-open',
    name: 'Ruy Lopez & Open Sicilian',
    color: 'white',
    vs: '1.e4',
    blurb: msg('The classical main lines: the Spanish, the Open Sicilian and the Tarrasch French. Rich, principled positions.'),
    ...white('1.e4', [E5.ruy, C5.open, C6.advance, E6.tarrasch, SCANDI, ALEKHINE, PIRC.attack150, MODERN.attack150, NIMZOWITSCH]),
  },
  {
    id: 'vienna-gp',
    name: 'Vienna & Grand Prix',
    color: 'white',
    vs: '1.e4',
    blurb: msg('Knight to c3 and an early f4 against almost everything: fast attacks with little theory.'),
    ...white('1.e4', [E5.vienna, C5.grandPrix, C6.twoKnights, E6.nc3, SCANDI, ALEKHINE, PIRC.austrian, MODERN.austrian, NIMZOWITSCH]),
  },
  {
    id: 'kings-gambit',
    name: 'King’s Gambit & Smith-Morra',
    color: 'white',
    vs: '1.e4',
    blurb: msg('Gambits for open lines and quick attacks: give a pawn, take the initiative.'),
    ...white('1.e4', [E5.kingsGambit, C5.smithMorra, C6.fantasy, E6.advance, SCANDI, ALEKHINE, PIRC.austrian, MODERN.austrian, NIMZOWITSCH]),
  },
  {
    id: 'london',
    name: msg('London System'),
    color: 'white',
    vs: '1.d4',
    blurb: msg('The same solid setup against almost everything: d4, Bf4, e3, c3.'),
    starter: true,
    ...white('1.d4', [D5.london, NF6.london, DUTCH.london, BENONI, ...SIDELINES_D4.london]),
  },
  {
    id: 'queens-gambit',
    name: 'Queen’s Gambit',
    color: 'white',
    vs: '1.d4',
    blurb: msg('1.d4 and 2.c4 by the book: the Exchange QGD, Qc2 against the Nimzo, the Classical against the King’s Indian.'),
    ...white('1.d4', [D5.queensGambit, NF6.queensGambit, DUTCH.fianchetto, BENONI, ...SIDELINES_D4.queensGambit]),
  },
  {
    id: 'catalan',
    name: 'Catalan',
    color: 'white',
    vs: '1.d4',
    blurb: msg('Queen’s Gambit with a fianchettoed bishop: long-term pressure on the long diagonal.'),
    ...white('1.d4', [D5.catalan, NF6.catalan, DUTCH.fianchetto, BENONI, ...SIDELINES_D4.catalan]),
  },
  {
    id: 'tromp-london',
    name: 'Trompowsky & London',
    color: 'white',
    vs: '1.d4',
    blurb: msg('Bishop out early: the Trompowsky against 1…Nf6, the London against the rest. Takes opponents out of their theory.'),
    ...white('1.d4', [D5.london, NF6.trompowsky, DUTCH.london, BENONI, ...SIDELINES_D4.london]),
  },
  {
    id: 'caro',
    name: msg('Caro-Kann Defence'),
    color: 'black',
    vs: '1.e4',
    blurb: msg('Solid and sound: …c6 and …d5, then develop the light-squared bishop.'),
    starter: true,
    covers: [['3.Nc3', 'Classical'], ['3.e5', 'Advance'], ['3.exd5', 'Exchange & Panov'], ['2.Nc3', 'Two Knights'], ['2.d3', 'King’s Indian Attack']],
    pgn: '1. e4 c6 2. d4 (2. Nc3 d5 3. Nf3 Bg4 4. h3 Bxf3 5. Qxf3 e6) (2. d3 d5 3. Nd2 e5 4. Ngf3 Bd6) 2... d5 3. Nc3 (3. e5 Bf5 4. Nf3 e6 5. Be2 c5 6. Be3 Nd7 7. O-O Ne7) (3. exd5 cxd5 4. Bd3 (4. c4 Nf6 5. Nc3 e6 6. Nf3 Be7) 4... Nc6 5. c3 Nf6 6. Bf4 Bg4 7. Qb3 Qd7) (3. Nd2 dxe4 4. Nxe4 Bf5 5. Ng3 Bg6) 3... dxe4 4. Nxe4 Bf5 5. Ng3 Bg6 6. h4 h6 7. Nf3 Nd7 8. h5 Bh7 9. Bd3 Bxd3 10. Qxd3 e6 *',
  },
  {
    id: 'najdorf',
    name: 'Najdorf Sicilian',
    color: 'black',
    vs: '1.e4',
    blurb: msg('The fighting choice: …c5 and …a6, playing for a win with Black against the Open Sicilian and every anti-Sicilian.'),
    covers: [['2.Nf3 & 3.d4', 'Najdorf'], ['3.Bb5+', 'Moscow'], ['2.c3', 'Alapin'], ['2.Nc3', 'Closed & Grand Prix'], ['2.d4', 'Smith-Morra']],
    pgn: '1. e4 c5 2. Nf3 (2. c3 Nf6 3. e5 Nd5 4. d4 cxd4 5. Nf3 Nc6 6. cxd4 d6) (2. Nc3 Nc6 3. f4 g6 4. Nf3 Bg7 5. Bb5 Nd4) (2. d4 cxd4 3. c3 Nf6 4. e5 Nd5 5. cxd4 d6 6. Nf3 Nc6) 2... d6 3. d4 (3. Bb5+ Bd7 4. Bxd7+ Qxd7 5. O-O Nc6 6. c3 Nf6) 3... cxd4 4. Nxd4 Nf6 5. Nc3 a6 6. Be3 (6. Bg5 e6 7. f4 Be7 8. Qf3 Qc7 9. O-O-O Nbd7) (6. Be2 e5 7. Nb3 Be7 8. O-O O-O) (6. Bc4 e6 7. Bb3 b5 8. O-O Be7) (6. h3 e5 7. Nde2 h5) (6. f3 e5 7. Nb3 Be6 8. Be3 Be7) 6... e5 7. Nb3 Be6 8. f3 Be7 9. Qd2 O-O 10. O-O-O Nbd7 *',
  },
  {
    id: 'french',
    name: 'French Defence',
    color: 'black',
    vs: '1.e4',
    blurb: msg('…e6 and …d5: a solid centre and clear counterplay with …c5 against every White system.'),
    covers: [['3.Nc3', 'Classical'], ['3.e5', 'Advance'], ['3.Nd2', 'Tarrasch'], ['3.exd5', 'Exchange'], ['2.d3', 'King’s Indian Attack']],
    pgn: '1. e4 e6 2. d4 (2. d3 d5 3. Nd2 Nf6 4. Ngf3 c5 5. g3 Nc6 6. Bg2 Be7 7. O-O O-O) (2. Nf3 d5 3. Nc3 Nf6 4. e5 Nfd7 5. d4 c5) 2... d5 3. Nc3 (3. e5 c5 4. c3 Nc6 5. Nf3 Qb6 6. a3 c4 7. Nbd2 Na5) (3. Nd2 c5 4. exd5 Qxd5 5. Ngf3 cxd4 6. Bc4 Qd6 7. O-O Nf6 8. Nb3 Nc6 9. Nbxd4 Nxd4 10. Nxd4 a6) (3. exd5 exd5 4. Bd3 Bd6 5. Nf3 Ne7 6. O-O O-O) 3... Nf6 4. e5 (4. Bg5 Be7 5. e5 Nfd7 6. Bxe7 Qxe7 7. f4 O-O 8. Nf3 c5) 4... Nfd7 5. f4 c5 6. Nf3 Nc6 7. Be3 cxd4 8. Nxd4 Bc5 9. Qd2 O-O 10. O-O-O *',
  },
  {
    id: 'e5-berlin',
    name: '1…e5: Berlin & Classical',
    color: 'black',
    vs: '1.e4',
    blurb: msg('The symmetrical answer: the Berlin against the Ruy Lopez, …Bc5 against the Italian, clear lines against the rest.'),
    covers: [['3.Bb5', 'Berlin'], ['3.Bc4', 'Giuoco Piano'], ['3.d4', 'Scotch'], ['3.Nc3', 'Four Knights'], ['2.Nc3', 'Vienna'], ['2.f4', 'King’s Gambit']],
    pgn: '1. e4 e5 2. Nf3 (2. Nc3 Nf6 3. f4 d5 4. fxe5 Nxe4 5. Nf3 Be7 6. d4 O-O) (2. f4 exf4 3. Nf3 d5 4. exd5 Nf6 5. Bc4 Nxd5 6. O-O Be7) (2. Bc4 Nf6 3. d3 c6 4. Nf3 d5 5. Bb3 Bd6) (2. d4 exd4 3. Qxd4 Nc6 4. Qe3 Nf6 5. Nc3 Bb4 6. Bd2 O-O 7. O-O-O Re8) 2... Nc6 3. Bb5 (3. Bc4 Bc5 4. c3 (4. b4 Bxb4 5. c3 Be7) (4. O-O Nf6 5. d3 d6) 4... Nf6 5. d3 d6 6. O-O a6 7. a4 O-O) (3. d4 exd4 4. Nxd4 (4. Bc4 Nf6 5. e5 d5 6. Bb5 Ne4 7. Nxd4) 4... Nf6 5. Nxc6 bxc6 6. e5 Qe7 7. Qe2 Nd5 8. c4 Ba6) (3. Nc3 Nf6 4. Bb5 Nd4 5. Nxd4 exd4 6. e5 dxc3 7. exf6 Qxf6 8. dxc3 Qe5+) 3... Nf6 4. O-O (4. d3 Bc5 5. c3 O-O 6. O-O d6) 4... Nxe4 5. d4 (5. Re1 Nd6 6. Nxe5 Be7 7. Bf1 Nxe5 8. Rxe5 O-O) 5... Nd6 6. Bxc6 dxc6 7. dxe5 Nf5 8. Qxd8+ Kxd8 9. Nc3 Ke8 *',
  },
  {
    id: 'qgd',
    name: msg('Queen’s Gambit Declined'),
    color: 'black',
    vs: '1.d4',
    blurb: msg('Classical centre with …d5 and …e6 — trusted at every level.'),
    starter: true,
    covers: [['4.Bg5', 'Tartakower'], ['4.cxd5', 'Exchange'], ['3.Nf3 & g3', 'Catalan'], ['2.Bf4', 'London'], ['2.Nf3 & e3', 'Colle']],
    pgn: '1. d4 d5 2. c4 (2. Bf4 Nf6 3. e3 c5 4. c3 Nc6 5. Nd2 e6 6. Ngf3 Bd6 7. Bg3 O-O 8. Bd3 b6) (2. Nf3 Nf6 3. e3 (3. c4 e6) 3... e6 4. Bd3 c5 5. c3 Nc6 6. Nbd2 Bd6 7. O-O O-O) 2... e6 3. Nc3 (3. Nf3 Nf6 4. g3 (4. Nc3 Be7) 4... Be7 5. Bg2 O-O 6. O-O dxc4 7. Qc2 a6 8. Qxc4 b5 9. Qc2 Bb7) 3... Nf6 4. Bg5 (4. cxd5 exd5 5. Bg5 c6 6. Qc2 Be7 7. e3 Nbd7 8. Bd3 O-O 9. Nge2 Re8) (4. Nf3 Be7 5. Bf4 O-O 6. e3 c5 7. dxc5 Bxc5) 4... Be7 5. e3 O-O 6. Nf3 h6 7. Bh4 b6 8. Be2 Bb7 9. Bxf6 Bxf6 10. cxd5 exd5 *',
  },
  {
    id: 'slav',
    name: 'Slav Defence',
    color: 'black',
    vs: '1.d4',
    blurb: msg('…c6 and …d5: the light-squared bishop comes out before …e6. Solid, with fewer weaknesses than the QGD.'),
    covers: [['4.Nc3', 'Main line'], ['4.e3', 'Quiet Slav'], ['3.cxd5', 'Exchange'], ['2.Bf4', 'London'], ['2.Nf3', 'Transpositions']],
    pgn: '1. d4 d5 2. c4 (2. Bf4 Nf6 3. e3 Bf5 4. c4 e6 5. Nc3 c6 6. Qb3 Qb6) (2. Nf3 Nf6 3. c4 c6 4. Nc3 dxc4) 2... c6 3. Nf3 (3. Nc3 Nf6 4. Nf3 dxc4) (3. cxd5 cxd5 4. Nc3 Nf6 5. Bf4 Nc6 6. e3 Bf5) 3... Nf6 4. Nc3 (4. e3 Bf5 5. Nc3 e6 6. Nh4 Bg6 7. Nxg6 hxg6) 4... dxc4 5. a4 Bf5 6. e3 e6 7. Bxc4 Bb4 8. O-O O-O 9. Qe2 Nbd7 *',
  },
  {
    id: 'kid',
    name: 'King’s Indian Defence',
    color: 'black',
    vs: '1.d4',
    blurb: msg('Let White build the centre, then strike with …e5 and a kingside pawn storm. Dynamic and ambitious.'),
    covers: [['5.Nf3', 'Classical'], ['5.f3', 'Sämisch'], ['3.Nf3 & g3', 'Fianchetto'], ['2.Bf4', 'London'], ['2.Bg5', 'Trompowsky']],
    pgn: '1. d4 Nf6 2. c4 (2. Bf4 g6 3. e3 Bg7 4. Nf3 O-O 5. Be2 d6 6. h3 c5) (2. Nf3 g6 3. Bf4 Bg7 4. e3 O-O 5. Be2 d6 6. h3 c5) (2. Bg5 Ne4 3. Bf4 c5 4. f3 Qa5+ 5. c3 Nf6 6. Nd2 cxd4 7. Nb3 Qb6 8. Qxd4 Nc6 9. Qxb6 axb6) 2... g6 3. Nc3 (3. Nf3 Bg7 4. g3 O-O 5. Bg2 d6 6. O-O Nbd7 7. Nc3 e5 8. e4 c6) (3. g3 Bg7 4. Bg2 O-O 5. Nf3 d6 6. O-O Nbd7) 3... Bg7 4. e4 d6 5. Nf3 (5. f3 O-O 6. Be3 e5 7. Nge2 c6) (5. h3 O-O 6. Be3 e5 7. d5 a5) 5... O-O 6. Be2 e5 7. O-O (7. d5 a5 8. Bg5 h6 9. Bh4 Na6) 7... Nc6 8. d5 Ne7 9. Ne1 Nd7 10. Be3 f5 *',
  },
  {
    id: 'nimzo-qid',
    name: 'Nimzo- & Queen’s Indian',
    color: 'black',
    vs: '1.d4',
    blurb: msg('…e6 and …Bb4 against 3.Nc3, …b6 against 3.Nf3: control the centre with pieces, not pawns.'),
    covers: [['4.e3', 'Rubinstein'], ['4.Qc2', 'Classical'], ['4.f3 & a3', 'Sämisch'], ['3.Nf3', 'Queen’s Indian'], ['3.g3', 'Catalan']],
    pgn: '1. d4 Nf6 2. c4 (2. Nf3 e6 3. c4 b6) (2. Bf4 e6 3. e3 c5 4. c3 Nc6 5. Nd2 d5) (2. Bg5 e6 3. e4 h6 4. Bxf6 Qxf6 5. Nc3 d6) 2... e6 3. Nc3 (3. Nf3 b6 4. g3 (4. a3 Bb7 5. Nc3 d5 6. cxd5 Nxd5) 4... Ba6 5. b3 Bb4+ 6. Bd2 Be7 7. Bg2 c6 8. Bc3 d5) (3. g3 d5 4. Bg2 Be7 5. Nf3 O-O 6. O-O dxc4) 3... Bb4 4. e3 (4. Qc2 O-O 5. a3 Bxc3+ 6. Qxc3 b6 7. Bg5 Bb7) (4. f3 d5 5. a3 Bxc3+ 6. bxc3 c5 7. cxd5 Nxd5) (4. a3 Bxc3+ 5. bxc3 c5 6. f3 d5) (4. Nf3 c5 5. g3 cxd4 6. Nxd4 O-O 7. Bg2 d5) 4... O-O 5. Bd3 d5 6. Nf3 c5 7. O-O dxc4 8. Bxc4 Nc6 9. a3 Ba5 *',
  },
];

/** Where each kind of template is listed, in order. */
export const TEMPLATE_GROUPS: { color: Color; vs: Template['vs'] }[] = [
  { color: 'white', vs: '1.e4' },
  { color: 'white', vs: '1.d4' },
  { color: 'black', vs: '1.e4' },
  { color: 'black', vs: '1.d4' },
];

/** The template's main line (variations stripped), as "1. e4 e5 2. Nf3 …", up to `plies` moves. */
export function templateMainLine(tpl: Template, plies = 9): string {
  let depth = 0;
  let flat = '';
  for (const ch of tpl.pgn) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (depth === 0) flat += ch;
  }
  const sans = flat.replace(/\*/g, '').replace(/\d+\.(\.\.)?/g, ' ').split(/\s+/).filter(Boolean).slice(0, plies);
  return sans.map((s, i) => (i % 2 ? s : `${i / 2 + 1}. ${s}`)).join(' ');
}

/** Adds the template as a new repertoire in the top folder of its colour. */
export async function addTemplate(tpl: Template): Promise<Repertoire> {
  const lib = useLibrary.getState();
  await lib.load();
  const root = useLibrary.getState().folders.find((f) => !f.deleted && f.parentId === null && f.color === tpl.color);
  const rep = await useLibrary.getState().createRepertoire({ name: t(tpl.name), color: tpl.color, folderId: root?.id ?? null });
  await useLibrary.getState().importPgn(rep.id, tpl.pgn);
  return rep;
}
