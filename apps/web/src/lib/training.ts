/**
 * Local-first training state: FSRS cards and the review log, in IndexedDB (memory first, then
 * persisted — same pattern as the library). Reviews recorded offline sync later.
 */
import { create } from 'zustand';
import { cardKey, newCardState, scheduleCard, type Color, type ReviewEntry, type TrainCard, type TrainMode } from '@mainline/shared';
import { db } from './idb';
import { uid } from './library';

interface TrainingState {
  loaded: boolean;
  cards: TrainCard[];
  reviews: ReviewEntry[];
  version: number;
  load: () => Promise<void>;
  /** Records an answer. Drill answers are logged but never change the schedule. */
  record: (r: { color: Color; epd: string; rating: 1 | 2 | 3 | 4; played: string | null; expected: string[]; mode: TrainMode; msTaken: number }) => Promise<TrainCard | undefined>;
  /** Mistake → due now (used by games import: "you left book"). */
  makeDue: (color: Color, epd: string) => Promise<void>;
  applyRemote: (rows: { cards?: TrainCard[]; reviews?: ReviewEntry[] }) => Promise<void>;
}

async function markDirty(table: 'cards' | 'reviews', keys: string[]) {
  const d = await db();
  const tx = d.transaction('dirty', 'readwrite');
  for (const k of keys) await tx.store.put({ key: `${table}|${k}`, table, at: Date.now() });
  await tx.done;
  window.dispatchEvent(new CustomEvent('mainline:dirty'));
}

export const useTraining = create<TrainingState>((set, get) => ({
  loaded: false,
  cards: [],
  reviews: [],
  version: 0,
  load: async () => {
    if (get().loaded) return;
    try {
      const d = await db();
      const [cards, reviews] = await Promise.all([d.getAll('cards'), d.getAll('reviews')]);
      set((s) => ({ cards, reviews, loaded: true, version: s.version + 1 }));
    } catch {
      set({ loaded: true });
    }
  },
  record: async ({ color, epd, rating, played, expected, mode, msTaken }) => {
    const now = Date.now();
    const review: ReviewEntry = { id: uid(), cardEpd: epd, color, rating, playedUci: played, expectedUci: expected, mode, msTaken, reviewedAt: now, updatedAt: now };
    let card: TrainCard | undefined;
    if (mode !== 'drill') {
      const prev = get().cards.find((c) => c.color === color && c.epd === epd && c.kind === 'repertoire' && !c.deleted);
      const fsrs = scheduleCard(prev?.fsrs, rating, now);
      card = { color, epd, kind: 'repertoire', fsrs, due: fsrs.due, lastReview: now, updatedAt: now };
    }
    set((s) => ({
      reviews: [...s.reviews, review],
      cards: card ? [...s.cards.filter((c) => cardKey(c) !== cardKey(card!)), card] : s.cards,
      version: s.version + 1,
    }));
    const d = await db();
    await d.put('reviews', review);
    if (card) await d.put('cards', card);
    await markDirty('reviews', [review.id]);
    if (card) await markDirty('cards', [cardKey(card)]);
    return card;
  },
  makeDue: async (color, epd) => {
    const now = Date.now();
    const prev = get().cards.find((c) => c.color === color && c.epd === epd && c.kind === 'repertoire');
    const fsrs = prev?.fsrs ?? newCardState(now);
    const card: TrainCard = { color, epd, kind: 'repertoire', fsrs: { ...fsrs, due: now }, due: now, lastReview: prev?.lastReview ?? null, updatedAt: now };
    set((s) => ({ cards: [...s.cards.filter((c) => cardKey(c) !== cardKey(card)), card], version: s.version + 1 }));
    await (await db()).put('cards', card);
    await markDirty('cards', [cardKey(card)]);
  },
  applyRemote: async ({ cards = [], reviews = [] }) => {
    const s = get();
    const cur = new Map(s.cards.map((c) => [cardKey(c), c]));
    const newerCards = cards.filter((c) => (cur.get(cardKey(c))?.updatedAt ?? -1) < c.updatedAt);
    const haveReviews = new Set(s.reviews.map((r) => r.id));
    const newReviews = reviews.filter((r) => !haveReviews.has(r.id));
    const d = await db();
    for (const c of newerCards) await d.put('cards', c);
    for (const r of newReviews) await d.put('reviews', r);
    const merged = new Map(cur);
    for (const c of newerCards) merged.set(cardKey(c), c);
    set({ cards: [...merged.values()], reviews: [...s.reviews, ...newReviews], version: s.version + 1 });
  },
}));

/** Reviews in the user's local "today". */
export function reviewsToday(reviews: ReviewEntry[], now = Date.now()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return reviews.filter((r) => r.reviewedAt >= start.getTime());
}
