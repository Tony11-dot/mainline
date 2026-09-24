import { eq } from 'drizzle-orm';
import { buildFacts, invalidMoves, playUci, positionFromFen, templateExplanation, toEpd, FACTS_VERSION, type CoachKind, type EvalLine, type FactsPacket } from '@mainline/shared';
import { getDb, schema } from '../db/client';
import { sha256 } from '../lib/crypto';
import { Lru } from '../lib/lru';
import { aiConfigured, AiResting, generate } from '../lib/ai';
import { getEval } from './evals';
import { getExplorer } from './explorer';
import { openingAt } from './openings';

export interface CoachInput {
  kind: CoachKind;
  fen: string;
  moveUci?: string;
  playedUci?: string;
  lineUcis?: string[];
  question?: string;
  rating?: number;
  speeds?: string[];
}

export interface CoachResult {
  text: string;
  source: 'ai' | 'template' | 'cache';
  model?: string;
  resting?: boolean;
  facts: FactsPacket;
}

const hot = new Lru<CoachResult>(2000, 24 * 3600_000);

export const SYSTEM_PROMPT = `You are MainLine's chess coach, sitting next to a club player who is learning an opening repertoire.
Rules (non-negotiable):
- Explain ONLY with the facts in the JSON packet you are given (engine lines, evals, explorer statistics, pawn structure, opening name). Do not use outside knowledge of specific games, players or theory that is not in the packet.
- Every concrete move you mention must be written as [[SAN]] (e.g. [[Nf3]], [[O-O]]) and must either be legal right now from the FEN or appear in the packet's engine lines or line.
- Never invent evaluations, percentages or grades. Quote numbers only from the packet. If unsure why a move is good, say "the engine prefers" rather than inventing a reason.
- Never recommend a move that is not in the packet.
- Plain, warm, precise English. Short markdown: 1–2 short paragraphs or a few bullets. No headings.`;

const TASKS: Record<CoachKind, (f: FactsPacket) => string> = {
  move: (f) => `Explain why ${f.sideToMove} plays [[${f.move}]] here: the idea, what it prepares, what it prevents, typical plans for both sides and the key pawn structure. 80–150 words.`,
  line: (f) => `Tell the story of this line (${(f.line ?? []).join(' ')}) from its first move to the final position, then give the 2–3 ideas to remember. 120–200 words.`,
  mistake: (f) => `The player played [[${f.played}]] instead of their prep move [[${f.move}]]. Using the engine lines and eval difference, explain concretely why [[${f.move}]] is better and what [[${f.played}]] allows. 80–150 words.`,
  punish: (f) => `The opponent often plays the mistake that led to this position. Explain how [[${f.move}]] punishes it, using only the engine line. 80–140 words.`,
  position: (f) => `Answer the player's question about this position: "${(f.question ?? '').slice(0, 300)}". If the packet doesn't contain the answer, say so briefly. 40–150 words.`,
};

function keyFor(i: CoachInput) {
  return sha256([FACTS_VERSION, i.kind, toEpd(i.fen), i.moveUci ?? '', i.playedUci ?? '', (i.lineUcis ?? []).join(','), i.question?.trim().toLowerCase() ?? '', i.rating ?? ''].join('|'));
}

async function safe<T>(p: Promise<T>): Promise<T | undefined> {
  try {
    return await p;
  } catch {
    return undefined;
  }
}

export async function explain(input: CoachInput, explorerToken: string | undefined): Promise<CoachResult> {
  const key = keyFor(input);
  const h = hot.get(key);
  if (h) return { ...h, source: 'cache' };
  const db = getDb();
  if (db) {
    const row = await db.query.aiExplanations.findFirst({ where: eq(schema.aiExplanations.keyHash, key) });
    if (row) {
      const r: CoachResult = { text: row.textMd, source: 'cache', model: row.model, facts: row.factsJson as FactsPacket };
      hot.set(key, r);
      return r;
    }
  }

  // Facts, from caches only — never invented.
  const pos = positionFromFen(input.fen);
  const afterFen = (uci?: string) => {
    if (!uci) return undefined;
    try {
      return playUci(pos, uci).fen;
    } catch {
      return undefined;
    }
  };
  const bands = input.rating ? ratingBands(input.rating) : undefined;
  const [engine, afterMove, afterPlayed, lichess, masters] = await Promise.all([
    safe(getEval(input.fen, 3)),
    safe(afterFen(input.moveUci) ? getEval(afterFen(input.moveUci)!, 1) : Promise.resolve(null)),
    safe(afterFen(input.playedUci) ? getEval(afterFen(input.playedUci)!, 1) : Promise.resolve(null)),
    explorerToken ? safe(getExplorer({ source: 'lichess', fen: input.fen, ratings: bands, speeds: input.speeds ?? ['blitz', 'rapid'] }, explorerToken)) : undefined,
    explorerToken ? safe(getExplorer({ source: 'masters', fen: input.fen }, explorerToken)) : undefined,
  ]);
  const first = (e: { lines: EvalLine[] } | null | undefined) => e?.lines[0];
  const facts = buildFacts({
    kind: input.kind,
    fen: input.fen,
    moveUci: input.moveUci,
    playedUci: input.playedUci,
    lineUcis: input.lineUcis,
    opening: openingAt(input.fen) ?? null,
    engine: engine ? { depth: engine.depth, lines: engine.lines } : undefined,
    evalAfterMove: first(afterMove),
    evalAfterPlayed: first(afterPlayed),
    lichess,
    masters,
    question: input.question,
  });

  let result: CoachResult;
  if (!aiConfigured()) {
    result = { text: templateExplanation(facts), source: 'template', facts };
  } else {
    result = await askAi(facts);
  }
  hot.set(key, result);
  // Cache real AI output forever (shared across users) so the free quota is spent once per position.
  if (db && result.source === 'ai' && input.kind !== 'position') {
    await db
      .insert(schema.aiExplanations)
      .values({ keyHash: key, kind: input.kind, factsJson: facts, textMd: result.text, model: result.model ?? '' })
      .onConflictDoNothing();
  }
  return result;
}

async function askAi(facts: FactsPacket): Promise<CoachResult> {
  const prompt = `FACTS (JSON):\n${JSON.stringify(facts)}\n\nTASK: ${TASKS[facts.kind](facts)}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { text, model } = await generate({ system: SYSTEM_PROMPT, prompt: attempt ? `${prompt}\n\nYour previous answer mentioned moves that are not legal here or not in the packet. Only use moves from the packet.` : prompt, long: facts.kind === 'line', maxTokens: facts.kind === 'line' ? 700 : 450 });
      const clean = text.trim();
      if (clean && invalidMoves(clean, facts).length === 0) return { text: clean, source: 'ai', model, facts };
    } catch (e) {
      if (e instanceof AiResting) return { text: templateExplanation(facts), source: 'template', resting: true, facts };
      break;
    }
  }
  return { text: templateExplanation(facts), source: 'template', facts };
}

function ratingBands(r: number) {
  const bands = [0, 1000, 1200, 1400, 1600, 1800, 2000, 2200, 2500];
  let i = 0;
  for (let k = 0; k < bands.length; k++) if (r >= bands[k]!) i = k;
  return bands.slice(i, i + 2);
}
