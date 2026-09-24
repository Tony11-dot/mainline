import type { Chess } from 'chessops/chess';
import { SquareSet } from 'chessops/squareSet';
import { parseSan } from 'chessops/san';
import { makeSquare } from 'chessops/util';
import { positionFromFen } from './epd';
import { uciLineToSan, uciToSan, type Color } from './chess';
import { evalPawns, formatEval, wdlPercents } from './eval';
import type { EvalLine, ExplorerData } from './api';

/* ---------------- Pawn structure & material ---------------- */

const FILES = 'abcdefgh';

export interface SideStructure {
  pawns: number;
  islands: number;
  isolated: string[]; // squares
  doubledFiles: string[];
  passed: string[];
  castled: 'kingside' | 'queenside' | 'no';
  canCastle: ('kingside' | 'queenside')[];
}

export interface Structure {
  white: SideStructure;
  black: SideStructure;
  openFiles: string[];
  halfOpenFiles: { white: string[]; black: string[] };
  material: { white: number; black: number; balance: number };
  pieces: { white: string; black: string };
}

const VALUE: Record<string, number> = { pawn: 1, knight: 3, bishop: 3, rook: 5, queen: 9, king: 0 };

export function structureOf(fenOrPos: string | Chess): Structure {
  const pos = typeof fenOrPos === 'string' ? positionFromFen(fenOrPos) : fenOrPos;
  const b = pos.board;
  const pawnsOf = (c: Color) => b.pawn.intersect(b[c]);
  const fileHas = (set: SquareSet, f: number) => set.intersects(SquareSet.fromFile(f));
  const side = (c: Color): SideStructure => {
    const mine = pawnsOf(c);
    const theirs = pawnsOf(c === 'white' ? 'black' : 'white');
    const files = [...Array(8).keys()].map((f) => fileHas(mine, f));
    let islands = 0;
    files.forEach((has, f) => {
      if (has && (f === 0 || !files[f - 1])) islands++;
    });
    const isolated: string[] = [];
    const doubled: string[] = [];
    const passed: string[] = [];
    for (let f = 0; f < 8; f++) {
      const onFile = [...mine].filter((sq) => sq % 8 === f);
      if (onFile.length > 1) doubled.push(FILES[f]!);
      for (const sq of onFile) {
        if (!files[f - 1] && !files[f + 1]) isolated.push(makeSquare(sq));
        const rank = Math.floor(sq / 8);
        const blockers = [...theirs].some((t) => Math.abs((t % 8) - f) <= 1 && (c === 'white' ? Math.floor(t / 8) > rank : Math.floor(t / 8) < rank));
        if (!blockers) passed.push(makeSquare(sq));
      }
    }
    const king = b.kingOf(c);
    const kf = king !== undefined ? king % 8 : 4;
    const homeRank = c === 'white' ? 0 : 7;
    const castled = king !== undefined && Math.floor(king / 8) === homeRank ? (kf >= 6 ? 'kingside' : kf <= 2 ? 'queenside' : 'no') : 'no';
    const rights = pos.castles.castlingRights;
    const canCastle: ('kingside' | 'queenside')[] = [];
    const cr = c === 'white' ? 0 : 56;
    if (rights.has(cr + 7)) canCastle.push('kingside');
    if (rights.has(cr)) canCastle.push('queenside');
    return { pawns: mine.size(), islands, isolated, doubledFiles: doubled, passed, castled, canCastle };
  };
  const openFiles: string[] = [];
  const halfOpen = { white: [] as string[], black: [] as string[] };
  for (let f = 0; f < 8; f++) {
    const w = fileHas(pawnsOf('white'), f);
    const bl = fileHas(pawnsOf('black'), f);
    if (!w && !bl) openFiles.push(FILES[f]!);
    else if (!w) halfOpen.white.push(FILES[f]!);
    else if (!bl) halfOpen.black.push(FILES[f]!);
  }
  const mat = (c: Color) => [...b[c]].reduce((s, sq) => s + VALUE[b.getRole(sq) ?? 'king']!, 0);
  const pieceList = (c: Color) =>
    (['queen', 'rook', 'bishop', 'knight'] as const)
      .map((r) => {
        const n = b[r].intersect(b[c]).size();
        return n ? `${n}${'QRBN'['queen rook bishop knight'.split(' ').indexOf(r)]}` : '';
      })
      .filter(Boolean)
      .join(' ');
  const w = mat('white');
  const bl = mat('black');
  return { white: side('white'), black: side('black'), openFiles, halfOpenFiles: halfOpen, material: { white: w, black: bl, balance: w - bl }, pieces: { white: pieceList('white'), black: pieceList('black') } };
}

/* ---------------- Facts packet (the only thing the coach may use) ---------------- */

export const FACTS_VERSION = 1;

export type CoachKind = 'move' | 'line' | 'mistake' | 'punish' | 'position';

export interface FactsPacket {
  v: number;
  kind: CoachKind;
  fen: string;
  sideToMove: Color;
  /** The move being explained (repertoire move / prep move / refutation), SAN. */
  move?: string;
  /** For 'mistake': what the user played. */
  played?: string;
  /** For 'line': the SAN moves of the line from its start. */
  line?: string[];
  opening?: { eco: string; name: string } | null;
  engine?: { depth: number; lines: { san: string[]; eval: string }[] };
  evalBefore?: string;
  evalAfterMove?: string;
  evalAfterPlayed?: string;
  swingForMover?: number;
  explorer?: {
    atYourRating?: { games: number; moveShare?: number; white: number; draws: number; black: number };
    masters?: { games: number; moveShare?: number; white: number; draws: number; black: number; players: string[] };
  };
  structure: Structure;
  question?: string;
}

export function buildFacts(input: {
  kind: CoachKind;
  fen: string;
  moveUci?: string;
  playedUci?: string;
  lineUcis?: string[];
  opening?: { eco: string; name: string } | null;
  engine?: { depth: number; lines: EvalLine[] };
  evalAfterMove?: EvalLine;
  evalAfterPlayed?: EvalLine;
  lichess?: ExplorerData;
  masters?: ExplorerData;
  question?: string;
}): FactsPacket {
  const pos = positionFromFen(input.fen);
  const stm: Color = pos.turn;
  const san = (u?: string) => (u ? uciToSan(pos, u) : undefined);
  const exStats = (d: ExplorerData | undefined, uci?: string, withPlayers = false) => {
    if (!d || !d.total) return undefined;
    const m = uci ? d.moves.find((x) => x.uci === uci) : undefined;
    const src = m ?? d;
    const total = m ? m.total : d.total;
    const [w, dr, b] = wdlPercents(src.white, src.draws, src.black);
    const players = withPlayers
      ? d.topGames
          .filter((g) => !uci || g.uci === uci)
          .slice(0, 5)
          .map((g) => `${(stm === 'white' ? g.white : g.black).name} (${stm === 'white' ? g.white.rating : g.black.rating}, ${g.year ?? '?'})`)
      : [];
    return { games: total, moveShare: m ? Math.round((m.total / d.total) * 1000) / 10 : undefined, white: w, draws: dr, black: b, ...(withPlayers ? { players } : {}) };
  };
  const best = input.engine?.lines[0];
  const swing =
    best && input.evalAfterMove
      ? Math.round((stm === 'white' ? evalPawns(best) - evalPawns(input.evalAfterMove) : evalPawns(input.evalAfterMove) - evalPawns(best)) * 100) / 100
      : undefined;
  return {
    v: FACTS_VERSION,
    kind: input.kind,
    fen: input.fen,
    sideToMove: stm,
    move: san(input.moveUci),
    played: san(input.playedUci),
    line: input.lineUcis ? uciLineToSan(input.fen, input.lineUcis) : undefined,
    opening: input.opening ?? null,
    engine: input.engine ? { depth: input.engine.depth, lines: input.engine.lines.slice(0, 3).map((l) => ({ san: uciLineToSan(input.fen, l.moves.slice(0, 8)), eval: formatEval(l) })) } : undefined,
    evalBefore: best ? formatEval(best) : undefined,
    evalAfterMove: input.evalAfterMove ? formatEval(input.evalAfterMove) : undefined,
    evalAfterPlayed: input.evalAfterPlayed ? formatEval(input.evalAfterPlayed) : undefined,
    swingForMover: swing,
    explorer: input.lichess || input.masters ? { atYourRating: exStats(input.lichess, input.moveUci), masters: exStats(input.masters, input.moveUci, true) as never } : undefined,
    structure: structureOf(pos),
    question: input.question,
  };
}

/* ---------------- Output validation ---------------- */

/** Every [[move]] token in the coach's text. */
export const moveTokens = (text: string) => [...text.matchAll(/\[\[([^\]]{1,12})\]\]/g)].map((m) => m[1]!.trim());

/**
 * Checks that every move the coach mentions is either legal from the position (as the next move) or
 * appears in the packet's engine lines / line. Returns the offending tokens (empty = valid).
 */
export function invalidMoves(text: string, facts: FactsPacket): string[] {
  const pos = positionFromFen(facts.fen);
  const known = new Set<string>([
    ...(facts.engine?.lines.flatMap((l) => l.san) ?? []),
    ...(facts.line ?? []),
    ...[facts.move, facts.played].filter(Boolean) as string[],
  ].map(stripDecorations));
  const bad: string[] = [];
  for (const tok of moveTokens(text)) {
    const t = stripDecorations(tok.replace(/^\d+\.+\s*/, ''));
    if (known.has(t)) continue;
    if (parseSan(pos, t)) continue;
    bad.push(tok);
  }
  return bad;
}

const stripDecorations = (s: string) => s.replace(/[+#!?]+$/g, '');

/** Deterministic explanation from the facts alone — used when the AI is unavailable or fails validation. */
export function templateExplanation(f: FactsPacket): string {
  const parts: string[] = [];
  if (f.opening) parts.push(`**${f.opening.name}** (${f.opening.eco}).`);
  if (f.kind === 'mistake' && f.move) {
    parts.push(`Your prep move here is [[${f.move}]]${f.played ? `; you played [[${f.played}]]` : ''}.`);
    if (f.evalAfterMove && f.evalAfterPlayed) parts.push(`The engine rates the position ${f.evalAfterMove} after [[${f.move}]] and ${f.evalAfterPlayed} after [[${f.played}]].`);
  } else if (f.move) {
    parts.push(`The move is [[${f.move}]].`);
  }
  const top = f.engine?.lines[0];
  if (top?.san[0]) parts.push(`The engine prefers [[${top.san[0]}]] (${top.eval}${f.engine ? `, depth ${f.engine.depth}` : ''}).`);
  if (f.swingForMover !== undefined && f.move && Math.abs(f.swingForMover) >= 0.7) parts.push(`[[${f.move}]] gives up about ${Math.abs(f.swingForMover).toFixed(1)} pawns compared with the engine's choice — a practical rather than a principled choice.`);
  const ex = f.explorer?.atYourRating;
  if (ex?.moveShare !== undefined) parts.push(`At your level it's played in ${ex.moveShare}% of games (${ex.games.toLocaleString()} games; White ${ex.white}% · draws ${ex.draws}% · Black ${ex.black}%).`);
  const ma = f.explorer?.masters;
  if (ma?.games) parts.push(`Masters: ${ma.games.toLocaleString()} games${ma.players?.length ? `, e.g. ${ma.players.slice(0, 3).join(', ')}` : ''}.`);
  const s = f.structure;
  const me = f.sideToMove;
  const my = s[me];
  const notes: string[] = [];
  if (my.isolated.length) notes.push(`an isolated pawn on ${my.isolated.join(', ')}`);
  if (my.passed.length) notes.push(`a passed pawn on ${my.passed.join(', ')}`);
  if (s.openFiles.length) notes.push(`open ${s.openFiles.join(', ')}-file${s.openFiles.length > 1 ? 's' : ''}`);
  if (notes.length) parts.push(`Structure: ${notes.join('; ')}.`);
  return parts.join(' ');
}
