import { parsePgn } from 'chessops/pgn';
import { sanListToUcis, OPENING_PLIES, type PlayedGame } from '@mainline/shared';
import { lichessFetch, USER_AGENT } from '../lib/lichess';
import { KeyedSerialQueue } from '../lib/queue';

const chesscomQueue = new KeyedSerialQueue();

interface LichessGame {
  id: string;
  variant: string;
  speed: string;
  createdAt: number;
  lastMoveAt?: number;
  status: string;
  winner?: 'white' | 'black';
  moves?: string;
  initialFen?: string;
  players: { white: { user?: { name: string }; rating?: number }; black: { user?: { name: string }; rating?: number } };
}

/** A user's recent standard games from Lichess (NDJSON), newest first. */
export async function lichessGames(user: string, opts: { since?: number; max?: number; token?: string } = {}): Promise<PlayedGame[]> {
  const url = new URL(`https://lichess.org/api/games/user/${encodeURIComponent(user)}`);
  url.searchParams.set('max', String(Math.min(opts.max ?? 200, 500)));
  url.searchParams.set('moves', 'true');
  url.searchParams.set('pgnInJson', 'false');
  url.searchParams.set('perfType', 'ultraBullet,bullet,blitz,rapid,classical,correspondence');
  if (opts.since) url.searchParams.set('since', String(opts.since + 1));
  const res = await lichessFetch(url.toString(), { token: opts.token, bucket: 'games', accept: 'application/x-ndjson' });
  if (res.status === 404) throw Object.assign(new Error(`No Lichess user “${user}”`), { statusCode: 404 });
  if (!res.ok) throw Object.assign(new Error(`Lichess returned ${res.status}`), { statusCode: 502 });
  const text = await res.text();
  const lower = user.toLowerCase();
  const out: PlayedGame[] = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    const g = JSON.parse(line) as LichessGame;
    if (g.variant !== 'standard' || g.initialFen || !g.moves) continue;
    const color = g.players.white.user?.name.toLowerCase() === lower ? 'white' : 'black';
    const opp = color === 'white' ? g.players.black : g.players.white;
    out.push({
      id: `lichess:${g.id}`,
      site: 'lichess',
      url: `https://lichess.org/${g.id}`,
      color,
      opponent: opp.user?.name ?? 'Anonymous',
      opponentRating: opp.rating,
      result: !g.winner ? 'draw' : g.winner === color ? 'win' : 'loss',
      speed: g.speed,
      playedAt: g.lastMoveAt ?? g.createdAt,
      ucis: sanListToUcis(g.moves.split(' '), undefined, OPENING_PLIES),
    });
  }
  return out;
}

interface ChesscomGame {
  url: string;
  pgn?: string;
  time_class: string;
  end_time: number;
  rules: string;
  white: { username: string; rating: number; result: string };
  black: { username: string; rating: number; result: string };
}

const DRAWS = new Set(['agreed', 'repetition', 'stalemate', 'insufficient', '50move', 'timevsinsufficient']);

async function chesscomJson<T>(url: string): Promise<T> {
  return chesscomQueue.run('chesscom', async () => {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } });
    if (res.status === 404) throw Object.assign(new Error('No such Chess.com user'), { statusCode: 404 });
    if (res.status === 429) throw Object.assign(new Error('Chess.com rate limit — try again in a minute'), { statusCode: 429, retryAfterSec: 60 });
    if (!res.ok) throw Object.assign(new Error(`Chess.com returned ${res.status}`), { statusCode: 502 });
    return (await res.json()) as T;
  });
}

/** Recent standard games from Chess.com's public API (monthly archives, newest months first). */
export async function chesscomGames(user: string, opts: { since?: number; months?: number } = {}): Promise<PlayedGame[]> {
  const u = user.toLowerCase();
  const { archives } = await chesscomJson<{ archives: string[] }>(`https://api.chess.com/pub/player/${encodeURIComponent(u)}/games/archives`);
  const since = opts.since ?? 0;
  const recent = archives
    .slice()
    .reverse()
    .filter((a) => {
      const m = a.match(/(\d{4})\/(\d{2})$/);
      return !m || Date.UTC(Number(m[1]), Number(m[2]), 1) > since; // month end after `since`
    })
    .slice(0, opts.months ?? 3);
  const out: PlayedGame[] = [];
  for (const a of recent) {
    const { games } = await chesscomJson<{ games: ChesscomGame[] }>(a);
    for (const g of games) {
      if (g.rules !== 'chess' || !g.pgn || g.end_time * 1000 <= since) continue;
      const parsed = parsePgn(g.pgn)[0];
      if (!parsed || parsed.headers.get('SetUp') === '1') continue;
      const sans: string[] = [];
      for (const node of parsed.moves.mainline()) {
        sans.push(node.san);
        if (sans.length >= OPENING_PLIES) break;
      }
      const color = g.white.username.toLowerCase() === u ? 'white' : 'black';
      const me = color === 'white' ? g.white : g.black;
      const opp = color === 'white' ? g.black : g.white;
      out.push({
        id: `chesscom:${g.url.split('/').pop()}`,
        site: 'chesscom',
        url: g.url,
        color,
        opponent: opp.username,
        opponentRating: opp.rating,
        result: me.result === 'win' ? 'win' : DRAWS.has(me.result) ? 'draw' : 'loss',
        speed: g.time_class,
        playedAt: g.end_time * 1000,
        ucis: sanListToUcis(sans, undefined, OPENING_PLIES),
      });
    }
  }
  return out.sort((a, b) => b.playedAt - a.playedAt);
}
