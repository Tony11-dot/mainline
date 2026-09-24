import type { Color } from '@mainline/shared';

/** Starter repertoires: short, mainstream main lines to grow from (Add popular replies / Suggest). */
export interface Template {
  id: string;
  name: string;
  color: Color;
  vs: string;
  blurb: string;
  pgn: string;
}

export const TEMPLATES: Template[] = [
  {
    id: 'italian',
    name: 'Italian Game',
    color: 'white',
    vs: '1.e4',
    blurb: 'Quick development, aim at f7, calm plans with c3 and d3.',
    pgn: '1. e4 e5 (1... c5 2. Nf3) (1... e6 2. d4 d5 3. Nc3) (1... c6 2. d4 d5 3. Nc3) 2. Nf3 Nc6 3. Bc4 Bc5 (3... Nf6 4. d3 Bc5 5. c3) 4. c3 Nf6 5. d3 d6 6. O-O O-O *',
  },
  {
    id: 'london',
    name: 'London System',
    color: 'white',
    vs: '1.d4',
    blurb: 'The same solid setup against almost everything: d4, Bf4, e3, c3.',
    pgn: '1. d4 d5 (1... Nf6 2. Bf4 e6 (2... g6 3. Nc3) 3. e3 c5 4. c3) 2. Bf4 Nf6 3. e3 e6 (3... c5 4. c3 Nc6 5. Nd2) 4. Nf3 c5 5. c3 Nc6 6. Nbd2 *',
  },
  {
    id: 'caro',
    name: 'Caro-Kann Defence',
    color: 'black',
    vs: 'vs 1.e4',
    blurb: 'Solid and sound: …c6 and …d5, then develop the light-squared bishop.',
    pgn: '1. e4 c6 2. d4 (2. Nc3 d5 3. Nf3 Bg4) 2... d5 3. Nc3 (3. e5 Bf5 4. Nf3 e6) (3. exd5 cxd5 4. Bd3 Nc6) 3... dxe4 4. Nxe4 Bf5 5. Ng3 Bg6 *',
  },
  {
    id: 'qgd',
    name: "Queen's Gambit Declined",
    color: 'black',
    vs: 'vs 1.d4',
    blurb: 'Classical centre with …d5 and …e6 — trusted at every level.',
    pgn: '1. d4 d5 2. c4 (2. Nf3 Nf6 3. Bf4 e6) (2. Bf4 Nf6 3. e3 e6) 2... e6 3. Nc3 (3. Nf3 Nf6 4. Nc3 Be7) 3... Nf6 4. Bg5 (4. Nf3 Be7) 4... Be7 5. e3 O-O *',
  },
];
