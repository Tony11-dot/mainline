/**
 * Screen-reader announcements (a polite live region) and SAN → words, e.g.
 * "Nxf3+" → "Knight takes f 3, check", "O-O" → "castles kingside".
 */
let region: HTMLElement | null = null;

export function announce(text: string) {
  if (typeof document === 'undefined') return;
  if (!region) {
    region = document.createElement('div');
    region.setAttribute('aria-live', 'polite');
    region.setAttribute('aria-atomic', 'true');
    region.className = 'sr-only';
    region.id = 'ml-announcer';
    document.body.appendChild(region);
  }
  // Clear first so repeating the same text is announced again.
  region.textContent = '';
  requestAnimationFrame(() => {
    if (region) region.textContent = text;
  });
}

const PIECES: Record<string, string> = { K: 'King', Q: 'Queen', R: 'Rook', B: 'Bishop', N: 'Knight' };

export function sanToSpeech(san: string): string {
  if (!san) return '';
  const suffix = san.endsWith('#') ? ', checkmate' : san.endsWith('+') ? ', check' : '';
  const s = san.replace(/[+#!?]+$/, '');
  if (s === 'O-O') return `castles kingside${suffix}`;
  if (s === 'O-O-O') return `castles queenside${suffix}`;
  const m = s.match(/^([KQRBN])?([a-h]?[1-8]?)(x)?([a-h][1-8])(?:=([QRBN]))?$/);
  if (!m) return san;
  const [, piece, from, takes, to, promo] = m;
  const sq = (x: string) => x.split('').join(' ');
  const parts = [piece ? PIECES[piece] : from && !piece ? `${from} pawn` : 'Pawn'];
  if (piece && from) parts.push(`from ${sq(from)}`);
  parts.push(takes ? `takes ${sq(to!)}` : sq(to!));
  if (promo) parts.push(`promotes to ${PIECES[promo]!.toLowerCase()}`);
  return parts.join(' ') + suffix;
}

export const announceMove = (color: 'white' | 'black', san: string) => announce(`${color === 'white' ? 'White' : 'Black'}: ${sanToSpeech(san)}`);
