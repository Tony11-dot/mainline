/**
 * The AI assistant: a chat that knows your folders and lines, your settings, what you've told it about
 * yourself, and what's on screen. The context is plain text built here on the device and sent with each
 * question; nothing is stored on the server.
 */
import { create } from 'zustand';
import { buildGraph, INITIAL_FEN, playLine, type Folder, type RepMove, type Repertoire } from '@mainline/shared';
import { api } from './api';
import { repMoves, useLibrary } from './library';
import { usePrefs } from './prefs';
import { useI18n } from './i18n';

export interface ChatTurn {
  role: 'user' | 'assistant';
  text: string;
}

/** What a screen is showing, for questions like "explain this line". */
export interface AssistantFocus {
  lineId: string;
  /** Moves from the start of the game to the position on the board. */
  ucis: string[];
}

interface AssistantState {
  open: boolean;
  turns: ChatTurn[];
  busy: boolean;
  focus?: AssistantFocus;
  setOpen: (open: boolean) => void;
  setFocus: (f?: AssistantFocus) => void;
  clear: () => void;
  ask: (question: string) => Promise<void>;
}

export const useAssistant = create<AssistantState>((set, get) => ({
  open: false,
  turns: [],
  busy: false,
  setOpen: (open) => set({ open }),
  setFocus: (focus) => set({ focus }),
  clear: () => set({ turns: [] }),
  ask: async (question) => {
    const q = question.trim();
    if (!q || get().busy) return;
    const history = get().turns;
    set({ turns: [...history, { role: 'user', text: q }], busy: true });
    try {
      await useLibrary.getState().load();
      const lib = useLibrary.getState();
      const prefs = usePrefs.getState();
      const context = assistantContext({ folders: lib.folders, reps: lib.reps, moves: lib.moves, prefs, focus: get().focus });
      const r = await api<{ text: string }>('/api/assistant', { method: 'POST', json: { question: q, history, context, lang: useI18n.getState().lang } });
      set((s) => ({ turns: [...s.turns, { role: 'assistant', text: r.text }] }));
    } catch (e) {
      set((s) => ({ turns: [...s.turns, { role: 'assistant', text: `⚠️ ${(e as Error).message}` }] }));
    } finally {
      set({ busy: false });
    }
  },
}));

const sanLine = (ucis: string[]) => {
  try {
    return playLine(INITIAL_FEN, ucis)
      .moves.map((m, i) => `${i % 2 === 0 ? `${i / 2 + 1}.` : ''}${m.san}`)
      .join(' ');
  } catch {
    return '';
  }
};

/** A line as text: its main path, and how many other moves it prepares along the way. */
export function describeLine(rep: Repertoire, moves: RepMove[]): string {
  const graph = buildGraph(moves);
  const ucis = [...rep.rootMovesUci];
  let epd = rep.rootEpd;
  let others = 0;
  const seen = new Set<string>();
  for (let i = 0; i < 60; i++) {
    const here = graph.get(epd);
    if (!here?.length || seen.has(epd)) break;
    seen.add(epd);
    const main = here.find((m) => m.isMainline) ?? here[0]!;
    others += here.length - 1;
    ucis.push(main.uci);
    epd = main.toEpd;
  }
  const line = sanLine(ucis) || '(no moves yet)';
  return others ? `${line} (+${others} other ${others === 1 ? 'move' : 'moves'} prepared)` : line;
}

export function assistantContext(o: {
  folders: Folder[];
  reps: Repertoire[];
  moves: RepMove[];
  prefs: { rating: number; speeds: string[]; aiNotes: string };
  focus?: AssistantFocus;
}): string {
  const folders = o.folders.filter((f) => !f.deleted);
  const reps = o.reps.filter((r) => !r.deleted);
  const out: string[] = [];
  out.push(`PLAYER: rated about ${o.prefs.rating}, plays ${o.prefs.speeds.join(', ') || 'all speeds'}.`);
  if (o.prefs.aiNotes.trim()) out.push(`THE PLAYER'S NOTES ABOUT THEMSELVES:\n${o.prefs.aiNotes.trim()}`);

  out.push('REPERTOIRE (folders hold lines and folders; every line starts from its folder’s moves):');
  const kids = (id: string | null) => folders.filter((f) => f.parentId === id).sort((a, b) => a.sortIndex - b.sortIndex);
  const walk = (f: Folder, depth: number) => {
    const pad = '  '.repeat(depth);
    const at = f.rootMovesUci?.length ? ` [${sanLine(f.rootMovesUci)}]` : '';
    out.push(`${pad}${f.name}${depth === 0 ? ` (playing ${f.color})` : ''}${at}`);
    for (const r of reps.filter((x) => x.folderId === f.id).sort((a, b) => a.sortIndex - b.sortIndex)) out.push(`${pad}  - line "${r.name}": ${describeLine(r, repMoves(o.moves, r.id))}`);
    for (const k of kids(f.id)) walk(k, depth + 1);
  };
  for (const root of kids(null)) walk(root, 0);
  if (!reps.length) out.push('(no lines yet)');

  if (o.focus) {
    const r = reps.find((x) => x.id === o.focus!.lineId);
    if (r) {
      const path = folders.find((f) => f.id === r.folderId);
      out.push(`ON SCREEN: the player is editing the line "${r.name}"${path ? ` in the folder "${path.name}"` : ''}, at the position after ${sanLine(o.focus.ucis) || 'the start'}.`);
    }
  }
  const text = out.join('\n');
  return text.length > 24000 ? `${text.slice(0, 24000)}\n(…more lines not shown)` : text;
}
