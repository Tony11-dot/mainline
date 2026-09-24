import type { FastifyInstance } from 'fastify';
import { and, eq, gt, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb, schema } from '../db/client';
import { requireUser } from '../lib/session';
import { MissingConfigError } from '../env';

/**
 * Local-first sync. The client pushes rows it changed (with its own `updatedAt`); the server keeps
 * the newest version of each row (last write wins, tombstones included) and stamps `synced_at` with
 * its own clock. The client then pulls every row with `synced_at` after its cursor — server time, so
 * device clock skew can never hide a change.
 */
const color = z.enum(['white', 'black']);
const ms = z.number().int().nonnegative();

const folder = z.object({ id: z.string().uuid(), parentId: z.string().uuid().nullable(), name: z.string().max(120), color, sortIndex: z.number(), updatedAt: ms, deleted: z.boolean().optional() });
const repertoire = z.object({
  id: z.string().uuid(),
  folderId: z.string().uuid().nullable(),
  name: z.string().max(120),
  color,
  rootEpd: z.string().max(100),
  rootMovesUci: z.array(z.string().max(5)).max(60),
  sortIndex: z.number(),
  createdAt: ms,
  updatedAt: ms,
  deleted: z.boolean().optional(),
});
const move = z.object({
  repertoireId: z.string().uuid(),
  fromEpd: z.string().max(100),
  uci: z.string().regex(/^[a-h][1-8][a-h][1-8][qrbn]?$/),
  san: z.string().max(10),
  toEpd: z.string().max(100),
  isMainline: z.boolean(),
  note: z.string().max(4000).nullable().optional(),
  shapes: z.array(z.object({ orig: z.string().max(2), dest: z.string().max(2).optional(), brush: z.string().max(20).optional() })).max(64).nullable().optional(),
  addedAt: ms,
  updatedAt: ms,
  deleted: z.boolean().optional(),
});
const card = z.object({
  color,
  epd: z.string().max(100),
  kind: z.enum(['repertoire', 'radar']),
  fsrs: z.record(z.string(), z.unknown()),
  due: ms,
  lastReview: ms.nullable(),
  updatedAt: ms,
  deleted: z.boolean().optional(),
});
const review = z.object({
  id: z.string().uuid(),
  cardEpd: z.string().max(100),
  color,
  rating: z.number().int().min(1).max(4),
  playedUci: z.string().max(5).nullable(),
  expectedUci: z.array(z.string().max(5)).max(10),
  mode: z.enum(['learn', 'review', 'drill', 'quiz']),
  msTaken: z.number().int().min(0).max(86_400_000),
  reviewedAt: ms,
  updatedAt: ms,
  deleted: z.boolean().optional(),
});

export const syncBody = z.object({
  cursor: z.string().datetime().nullable().optional(),
  changes: z
    .object({
      folders: z.array(folder).max(2000).default([]),
      repertoires: z.array(repertoire).max(2000).default([]),
      moves: z.array(move).max(20000).default([]),
      cards: z.array(card).max(20000).default([]),
      reviews: z.array(review).max(20000).default([]),
    })
    .default({ folders: [], repertoires: [], moves: [], cards: [], reviews: [] }),
});

const d = (n: number) => new Date(n);
const newer = (col: unknown) => sql`excluded.updated_at > ${col}`;

export async function syncRoutes(app: FastifyInstance) {
  app.post('/api/sync', { bodyLimit: 20 * 1024 * 1024 }, async (req) => {
    const db = getDb();
    if (!db) throw new MissingConfigError('DATABASE_URL', 'Sync');
    const user = await requireUser(req);
    const { cursor, changes } = syncBody.parse(req.body);
    const uid = user.id;

    // Everything written in this request gets the same server stamp, taken before pulling.
    const [{ now }] = (await db.execute(sql`select now() as now`)).rows as [{ now: Date }];
    const stamp = new Date(now);

    await db.transaction(async (tx) => {
      const T = schema;
      for (const chunk of chunks(changes.folders)) {
        await tx
          .insert(T.folders)
          .values(chunk.map((f) => ({ id: f.id, userId: uid, parentId: f.parentId, name: f.name, color: f.color, sortIndex: f.sortIndex, updatedAt: d(f.updatedAt), deleted: !!f.deleted, syncedAt: stamp })))
          .onConflictDoUpdate({
            target: T.folders.id,
            set: { parentId: sql`excluded.parent_id`, name: sql`excluded.name`, color: sql`excluded.color`, sortIndex: sql`excluded.sort_index`, updatedAt: sql`excluded.updated_at`, deleted: sql`excluded.deleted`, syncedAt: stamp },
            setWhere: and(eq(T.folders.userId, uid), newer(T.folders.updatedAt)),
          });
      }
      for (const chunk of chunks(changes.repertoires)) {
        await tx
          .insert(T.repertoires)
          .values(
            chunk.map((r) => ({
              id: r.id,
              userId: uid,
              folderId: r.folderId,
              name: r.name,
              color: r.color,
              rootEpd: r.rootEpd,
              rootMovesUci: r.rootMovesUci,
              sortIndex: r.sortIndex,
              createdAt: d(r.createdAt),
              updatedAt: d(r.updatedAt),
              deleted: !!r.deleted,
              syncedAt: stamp,
            })),
          )
          .onConflictDoUpdate({
            target: T.repertoires.id,
            set: {
              folderId: sql`excluded.folder_id`,
              name: sql`excluded.name`,
              color: sql`excluded.color`,
              rootEpd: sql`excluded.root_epd`,
              rootMovesUci: sql`excluded.root_moves_uci`,
              sortIndex: sql`excluded.sort_index`,
              updatedAt: sql`excluded.updated_at`,
              deleted: sql`excluded.deleted`,
              syncedAt: stamp,
            },
            setWhere: and(eq(T.repertoires.userId, uid), newer(T.repertoires.updatedAt)),
          });
      }
      // Moves may only target this user's repertoires.
      const ownRepIds = new Set(
        (await tx.select({ id: T.repertoires.id }).from(T.repertoires).where(eq(T.repertoires.userId, uid))).map((r) => r.id),
      );
      for (const chunk of chunks(changes.moves.filter((m) => ownRepIds.has(m.repertoireId)))) {
        await tx
          .insert(T.repertoireMoves)
          .values(
            chunk.map((m) => ({
              userId: uid,
              repertoireId: m.repertoireId,
              fromEpd: m.fromEpd,
              uci: m.uci,
              san: m.san,
              toEpd: m.toEpd,
              isMainline: m.isMainline,
              note: m.note ?? null,
              shapesJson: m.shapes ?? null,
              addedAt: d(m.addedAt),
              updatedAt: d(m.updatedAt),
              deleted: !!m.deleted,
              syncedAt: stamp,
            })),
          )
          .onConflictDoUpdate({
            target: [T.repertoireMoves.repertoireId, T.repertoireMoves.fromEpd, T.repertoireMoves.uci],
            set: {
              san: sql`excluded.san`,
              toEpd: sql`excluded.to_epd`,
              isMainline: sql`excluded.is_mainline`,
              note: sql`excluded.note`,
              shapesJson: sql`excluded.shapes_json`,
              updatedAt: sql`excluded.updated_at`,
              deleted: sql`excluded.deleted`,
              syncedAt: stamp,
            },
            setWhere: and(eq(T.repertoireMoves.userId, uid), newer(T.repertoireMoves.updatedAt)),
          });
      }
      for (const chunk of chunks(changes.cards)) {
        await tx
          .insert(T.cards)
          .values(
            chunk.map((c) => ({
              userId: uid,
              color: c.color,
              epd: c.epd,
              kind: c.kind,
              fsrsStateJson: c.fsrs,
              due: d(c.due),
              lastReview: c.lastReview ? d(c.lastReview) : null,
              updatedAt: d(c.updatedAt),
              deleted: !!c.deleted,
              syncedAt: stamp,
            })),
          )
          .onConflictDoUpdate({
            target: [T.cards.userId, T.cards.color, T.cards.epd, T.cards.kind],
            set: { fsrsStateJson: sql`excluded.fsrs_state_json`, due: sql`excluded.due`, lastReview: sql`excluded.last_review`, updatedAt: sql`excluded.updated_at`, deleted: sql`excluded.deleted`, syncedAt: stamp },
            setWhere: newer(T.cards.updatedAt),
          });
      }
      for (const chunk of chunks(changes.reviews)) {
        await tx
          .insert(T.reviewLog)
          .values(
            chunk.map((r) => ({
              id: r.id,
              userId: uid,
              cardEpd: r.cardEpd,
              color: r.color,
              rating: r.rating,
              playedUci: r.playedUci,
              expectedUci: r.expectedUci,
              mode: r.mode,
              msTaken: r.msTaken,
              reviewedAt: d(r.reviewedAt),
              updatedAt: d(r.updatedAt),
              deleted: !!r.deleted,
              syncedAt: stamp,
            })),
          )
          .onConflictDoNothing();
      }
    });

    // Pull everything changed since the client's cursor (including what it just pushed — cheap and it
    // lets the client confirm the merge).
    const since = cursor ? new Date(cursor) : new Date(0);
    const T = schema;
    const [folders, repertoires, moves, cards, reviews] = await Promise.all([
      db.select().from(T.folders).where(and(eq(T.folders.userId, uid), gt(T.folders.syncedAt, since))),
      db.select().from(T.repertoires).where(and(eq(T.repertoires.userId, uid), gt(T.repertoires.syncedAt, since))),
      db.select().from(T.repertoireMoves).where(and(eq(T.repertoireMoves.userId, uid), gt(T.repertoireMoves.syncedAt, since))),
      db.select().from(T.cards).where(and(eq(T.cards.userId, uid), gt(T.cards.syncedAt, since))),
      db.select().from(T.reviewLog).where(and(eq(T.reviewLog.userId, uid), gt(T.reviewLog.syncedAt, since))),
    ]);
    const t = (x: Date | null) => (x ? x.getTime() : null);
    return {
      // 30 s overlap: a concurrent write from another device may commit with a slightly earlier stamp.
      cursor: new Date(stamp.getTime() - 30_000).toISOString(),
      pull: {
        folders: folders.map((f) => ({ id: f.id, parentId: f.parentId, name: f.name, color: f.color, sortIndex: f.sortIndex, updatedAt: t(f.updatedAt), deleted: f.deleted })),
        repertoires: repertoires.map((r) => ({ id: r.id, folderId: r.folderId, name: r.name, color: r.color, rootEpd: r.rootEpd, rootMovesUci: r.rootMovesUci, sortIndex: r.sortIndex, createdAt: t(r.createdAt), updatedAt: t(r.updatedAt), deleted: r.deleted })),
        moves: moves.map((m) => ({ repertoireId: m.repertoireId, fromEpd: m.fromEpd, uci: m.uci, san: m.san, toEpd: m.toEpd, isMainline: m.isMainline, note: m.note, shapes: m.shapesJson, addedAt: t(m.addedAt), updatedAt: t(m.updatedAt), deleted: m.deleted })),
        cards: cards.map((c) => ({ color: c.color, epd: c.epd, kind: c.kind, fsrs: c.fsrsStateJson, due: t(c.due), lastReview: t(c.lastReview), updatedAt: t(c.updatedAt), deleted: c.deleted })),
        reviews: reviews.map((r) => ({ id: r.id, cardEpd: r.cardEpd, color: r.color, rating: r.rating, playedUci: r.playedUci, expectedUci: r.expectedUci, mode: r.mode, msTaken: r.msTaken, reviewedAt: t(r.reviewedAt), updatedAt: t(r.updatedAt), deleted: r.deleted })),
      },
    };
  });
}

function chunks<T>(rows: T[], size = 500): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}
