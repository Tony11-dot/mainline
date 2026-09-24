import { expect, type Page } from '@playwright/test';

/** Center of a square in page coordinates, honouring board orientation. */
export async function squareCenter(page: Page, sq: string, boardSel = '.ml-board') {
  const box = (await page.locator(boardSel).first().boundingBox())!;
  const flipped = await page.locator(`${boardSel} .cg-wrap.orientation-black`).count();
  const file = sq.charCodeAt(0) - 97;
  const rank = Number(sq[1]) - 1;
  const size = box.width / 8;
  const col = flipped ? 7 - file : file;
  const row = flipped ? rank : 7 - rank;
  return { x: box.x + size * (col + 0.5), y: box.y + size * (row + 0.5) };
}

export async function dragMove(page: Page, from: string, to: string) {
  const a = await squareCenter(page, from);
  const b = await squareCenter(page, to);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 5 });
  await page.mouse.move(b.x, b.y, { steps: 5 });
  await page.mouse.up();
}

export async function clickMove(page: Page, from: string, to: string) {
  const a = await squareCenter(page, from);
  const b = await squareCenter(page, to);
  await page.mouse.click(a.x, a.y);
  await page.mouse.click(b.x, b.y);
}

export async function tapMove(page: Page, from: string, to: string) {
  const a = await squareCenter(page, from);
  const b = await squareCenter(page, to);
  await page.touchscreen.tap(a.x, a.y);
  await page.touchscreen.tap(b.x, b.y);
}

/** Real touch drag via CDP (Chromium only). */
export async function touchDrag(page: Page, from: string, to: string, holdMs = 0) {
  const a = await squareCenter(page, from);
  const b = await squareCenter(page, to);
  const cdp = await page.context().newCDPSession(page);
  const tp = (x: number, y: number) => [{ x, y, id: 1, radiusX: 8, radiusY: 8, force: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: tp(a.x, a.y) });
  if (holdMs) await page.waitForTimeout(holdMs);
  for (let i = 1; i <= 8; i++) {
    const x = a.x + ((b.x - a.x) * i) / 8;
    const y = a.y + ((b.y - a.y) * i) / 8;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: tp(x, y) });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

export async function pieceAt(page: Page, sq: string): Promise<string | null> {
  return page.evaluate((s) => {
    const wrap = document.querySelector('.ml-board .cg-wrap') as HTMLElement & { cgApi?: unknown };
    const pieces = wrap?.querySelectorAll('piece:not(.ghost):not(.fading)');
    const board = wrap!.getBoundingClientRect();
    const flipped = wrap!.classList.contains('orientation-black');
    const size = board.width / 8;
    const file = s.charCodeAt(0) - 97;
    const rank = Number(s[1]) - 1;
    const col = flipped ? 7 - file : file;
    const row = flipped ? rank : 7 - rank;
    for (const p of Array.from(pieces ?? [])) {
      const r = p.getBoundingClientRect();
      const cx = r.x + r.width / 2 - board.x;
      const cy = r.y + r.height / 2 - board.y;
      if (Math.floor(cx / size) === col && Math.floor(cy / size) === row) {
        const cls = (p as HTMLElement).className.split(' ');
        const color = cls.find((c) => c === 'white' || c === 'black');
        const role = cls.find((c) => ['pawn', 'knight', 'bishop', 'rook', 'queen', 'king'].includes(c));
        return `${color} ${role}`;
      }
    }
    return null;
  }, sq);
}

/** Waits (through the move animation) until `sq` holds `piece` ('white pawn') or is empty (null). */
export async function expectPiece(page: Page, sq: string, piece: string | null) {
  await expect.poll(() => pieceAt(page, sq), { timeout: 3000 }).toBe(piece);
}
