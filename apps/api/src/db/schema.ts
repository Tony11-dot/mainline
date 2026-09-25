import {
  bigserial,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  smallint,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  lichessUsername: text('lichess_username').notNull().unique(),
  lichessTokenEnc: text('lichess_token_enc'),
  chesscomUsername: text('chesscom_username'),
  rating: integer('rating').default(1500).notNull(),
  ratingSpeed: text('rating_speed').default('blitz').notNull(),
  timezone: text('timezone').default('UTC').notNull(),
  reminderTime: text('reminder_time').default('19:00').notNull(),
  dailyNewLimit: integer('daily_new_limit').default(10).notNull(),
  settingsJson: jsonb('settings_json').$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: ts('created_at').defaultNow().notNull(),
});

export const sessions = pgTable(
  'sessions',
  {
    idHash: text('id_hash').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: ts('created_at').defaultNow().notNull(),
    lastSeenAt: ts('last_seen_at').defaultNow().notNull(),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
);

/* ---------- Synced (local-first) tables: client ids, updated_at, tombstones ---------- */

export const folders = pgTable(
  'folders',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    parentId: uuid('parent_id'),
    name: text('name').notNull(),
    color: text('color').$type<'white' | 'black'>().notNull(),
    sortIndex: real('sort_index').default(0).notNull(),
    updatedAt: ts('updated_at').notNull(),
    deleted: boolean('deleted').default(false).notNull(),
    syncedAt: ts('synced_at').defaultNow().notNull(),
  },
  (t) => [index('folders_user_upd_idx').on(t.userId, t.updatedAt)],
);

export const repertoires = pgTable(
  'repertoires',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    folderId: uuid('folder_id'),
    name: text('name').notNull(),
    color: text('color').$type<'white' | 'black'>().notNull(),
    rootEpd: text('root_epd').notNull(),
    rootMovesUci: text('root_moves_uci').array().default([]).notNull(),
    sortIndex: real('sort_index').default(0).notNull(),
    createdAt: ts('created_at').defaultNow().notNull(),
    updatedAt: ts('updated_at').notNull(),
    deleted: boolean('deleted').default(false).notNull(),
    syncedAt: ts('synced_at').defaultNow().notNull(),
  },
  (t) => [index('repertoires_user_upd_idx').on(t.userId, t.updatedAt)],
);

export const repertoireMoves = pgTable(
  'repertoire_moves',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    repertoireId: uuid('repertoire_id').notNull(),
    fromEpd: text('from_epd').notNull(),
    uci: text('uci').notNull(),
    san: text('san').notNull(),
    toEpd: text('to_epd').notNull(),
    isMainline: boolean('is_mainline').default(true).notNull(),
    note: text('note'),
    shapesJson: jsonb('shapes_json').$type<unknown[]>(),
    addedAt: ts('added_at').defaultNow().notNull(),
    updatedAt: ts('updated_at').notNull(),
    deleted: boolean('deleted').default(false).notNull(),
    syncedAt: ts('synced_at').defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.repertoireId, t.fromEpd, t.uci] }),
    index('rmoves_user_upd_idx').on(t.userId, t.updatedAt),
  ],
);

export const cards = pgTable(
  'cards',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    color: text('color').$type<'white' | 'black'>().notNull(),
    epd: text('epd').notNull(),
    kind: text('kind').$type<'repertoire' | 'radar'>().default('repertoire').notNull(),
    fsrsStateJson: jsonb('fsrs_state_json').$type<Record<string, unknown>>().notNull(),
    due: ts('due').notNull(),
    lastReview: ts('last_review'),
    updatedAt: ts('updated_at').notNull(),
    deleted: boolean('deleted').default(false).notNull(),
    syncedAt: ts('synced_at').defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.color, t.epd, t.kind] }),
    index('cards_user_due_idx').on(t.userId, t.due),
    index('cards_user_upd_idx').on(t.userId, t.updatedAt),
  ],
);

export const reviewLog = pgTable(
  'review_log',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    cardEpd: text('card_epd').notNull(),
    color: text('color').$type<'white' | 'black'>().notNull(),
    rating: smallint('rating').notNull(),
    playedUci: text('played_uci'),
    expectedUci: text('expected_uci').array().default([]).notNull(),
    mode: text('mode').notNull(),
    msTaken: integer('ms_taken').notNull(),
    reviewedAt: ts('reviewed_at').notNull(),
    updatedAt: ts('updated_at').notNull(),
    deleted: boolean('deleted').default(false).notNull(),
    syncedAt: ts('synced_at').defaultNow().notNull(),
  },
  (t) => [index('review_log_user_idx').on(t.userId, t.reviewedAt), index('review_log_upd_idx').on(t.userId, t.updatedAt)],
);

/* ---------- Shared caches ---------- */

export const explorerCache = pgTable(
  'explorer_cache',
  {
    source: text('source').$type<'masters' | 'lichess' | 'player'>().notNull(),
    epd: text('epd').notNull(),
    paramsHash: text('params_hash').notNull(),
    payloadJson: jsonb('payload_json').notNull(),
    fetchedAt: ts('fetched_at').defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.source, t.epd, t.paramsHash] })],
);

export const engineEvals = pgTable('engine_evals', {
  epd: text('epd').primaryKey(),
  depth: integer('depth').notNull(),
  multipvJson: jsonb('multipv_json').notNull(),
  source: text('source').$type<'cloud' | 'local'>().notNull(),
  updatedAt: ts('updated_at').defaultNow().notNull(),
});

export const openings = pgTable(
  'openings',
  {
    epd: text('epd').notNull(),
    eco: text('eco').notNull(),
    name: text('name').notNull(),
    pgn: text('pgn').notNull(),
    uci: text('uci').notNull(),
  },
  (t) => [primaryKey({ columns: [t.epd, t.name] }), index('openings_name_idx').on(t.name)],
);

export const aiExplanations = pgTable('ai_explanations', {
  keyHash: text('key_hash').primaryKey(),
  kind: text('kind').$type<'move' | 'line' | 'mistake' | 'position' | 'punish'>().notNull(),
  factsJson: jsonb('facts_json').notNull(),
  textMd: text('text_md').notNull(),
  model: text('model').notNull(),
  createdAt: ts('created_at').defaultNow().notNull(),
});

export const aiUsage = pgTable('ai_usage', {
  day: text('day').primaryKey(), // YYYY-MM-DD, Pacific time (Gemini quota reset)
  requests: integer('requests').default(0).notNull(),
});

/* ---------- Push, games, jobs ---------- */

export const pushSubs = pgTable('push_subs', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  // Guests can get reminders too; linked to the user when signed in.
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  endpoint: text('endpoint').notNull().unique(),
  keysJson: jsonb('keys_json').$type<{ p256dh: string; auth: string }>().notNull(),
  timezone: text('timezone').default('UTC').notNull(),
  reminderTime: text('reminder_time').default('19:00').notNull(),
  dueCount: integer('due_count').default(0).notNull(),
  streak: integer('streak').default(0).notNull(),
  // Streak freezes held at the end of the last practised day (see packages/shared/src/streak.ts).
  freezes: integer('freezes').default(0).notNull(),
  lastReviewDay: text('last_review_day'),
  lastNotifiedOn: text('last_notified_on'),
  lastNudgeOn: text('last_nudge_on'),
  lastWeeklyOn: text('last_weekly_on'),
  lastLateOn: text('last_late_on'),
  createdAt: ts('created_at').defaultNow().notNull(),
  updatedAt: ts('updated_at').defaultNow().notNull(),
});

export const games = pgTable(
  'games',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    site: text('site').$type<'lichess' | 'chesscom'>().notNull(),
    externalId: text('external_id').notNull(),
    pgn: text('pgn').notNull(),
    color: text('color').$type<'white' | 'black'>().notNull(),
    result: text('result').notNull(),
    speed: text('speed'),
    opponent: text('opponent'),
    playedAt: ts('played_at').notNull(),
  },
  (t) => [index('games_user_idx').on(t.userId, t.playedAt), index('games_ext_idx').on(t.userId, t.site, t.externalId)],
);

export const gameDeviations = pgTable(
  'game_deviations',
  {
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    ply: integer('ply').notNull(),
    epd: text('epd').notNull(),
    kind: text('kind').$type<'you_left_book' | 'opponent_left_book' | 'end_of_prep'>().notNull(),
    playedUci: text('played_uci'),
    expectedUci: text('expected_uci').array().default([]).notNull(),
    repertoireId: uuid('repertoire_id'),
  },
  (t) => [primaryKey({ columns: [t.gameId] })],
);

export const jobs = pgTable(
  'jobs',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    type: text('type').notNull(),
    payloadJson: jsonb('payload_json').$type<Record<string, unknown>>().default({}).notNull(),
    status: text('status').$type<'queued' | 'running' | 'done' | 'failed'>().default('queued').notNull(),
    attempts: integer('attempts').default(0).notNull(),
    runAfter: ts('run_after').defaultNow().notNull(),
    lastError: text('last_error'),
    createdAt: ts('created_at').defaultNow().notNull(),
  },
  (t) => [index('jobs_status_idx').on(t.status, t.runAfter)],
);
