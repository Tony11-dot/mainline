import { msg, t } from './i18n';
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

const PIECES: Record<string, string> = { K: msg('King'), Q: msg('Queen'), R: msg('Rook'), B: msg('Bishop'), N: msg('Knight') };
const PROMOS: Record<string, string> = { Q: msg('promotes to queen'), R: msg('promotes to rook'), B: msg('promotes to bishop'), N: msg('promotes to knight') };

export function sanToSpeech(san: string): string {
  if (!san) return '';
  const suffix = san.endsWith('#') ? `, ${t('checkmate')}` : san.endsWith('+') ? `, ${t('check')}` : '';
  const s = san.replace(/[+#!?]+$/, '');
  if (s === 'O-O') return `${t('castles kingside')}${suffix}`;
  if (s === 'O-O-O') return `${t('castles queenside')}${suffix}`;
  const m = s.match(/^([KQRBN])?([a-h]?[1-8]?)(x)?([a-h][1-8])(?:=([QRBN]))?$/);
  if (!m) return san;
  const [, piece, from, takes, to, promo] = m;
  const sq = (x: string) => x.split('').join(' ');
  const parts = [piece ? t(PIECES[piece]!) : from && !piece ? t('{file} pawn', { file: from }) : t('Pawn')];
  if (piece && from) parts.push(t('from {square}', { square: sq(from) }));
  parts.push(takes ? t('takes {square}', { square: sq(to!) }) : sq(to!));
  if (promo) parts.push(t(PROMOS[promo]!));
  return parts.join(' ') + suffix;
}

export const announceMove = (color: 'white' | 'black', san: string) => announce(`${color === 'white' ? t('White') : t('Black')}: ${sanToSpeech(san)}`);
