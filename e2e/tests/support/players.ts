import type { Browser, Page } from '@playwright/test';

export interface TestPlayer {
  nickname: string;
  page: Page;
  close(): Promise<void>;
}

export async function createPlayer(browser: Browser, baseURL: string, nickname: string): Promise<TestPlayer> {
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  await page.goto('/');
  await page.locator('#nickname-form input').fill(nickname);
  await page.locator('#nickname-form button').click();
  await page.locator('#room-choice-screen').waitFor({ state: 'visible' });
  return { nickname, page, close: () => context.close() };
}

export async function createRoom(
  page: Page,
  mode: 'championship' | 'race',
): Promise<string> {
  await page.locator('#create-room-section select').selectOption(mode);
  await page.locator('#create-room-section input[type="checkbox"]').uncheck();
  await page.locator('#create-room-section button', { hasText: 'Criar sala' }).click();
  await page.locator('#lobby-shell').waitFor({ state: 'visible' });
  // .innerText() reflects CSS text-transform (this h1 renders as uppercase), so match
  // case-insensitively rather than depending on presentation.
  const headerText = await page.locator('#lobby-shell h1').innerText();
  const match = /sala (\S+)/i.exec(headerText);
  if (!match) throw new Error(`Could not parse room code from lobby header: "${headerText}"`);
  return match[1]!;
}

async function joinRoom(page: Page, code: string): Promise<void> {
  await page.locator('#join-room-section input').fill(code);
  await page.locator('#join-room-section button').click();
  await page.locator('#lobby-shell').waitFor({ state: 'visible' });
}

// GET /rooms/:code (hit once per join) is rate-limited to 20 req/min per IP, and every
// simulated player shares one IP (localhost) — so joins are batched well under that cap
// rather than firing all at once.
export async function joinRoomThrottled(
  players: TestPlayer[],
  code: string,
  { batchSize = 18, batchDelayMs = 65_000 }: { batchSize?: number; batchDelayMs?: number } = {},
): Promise<void> {
  for (let start = 0; start < players.length; start += batchSize) {
    const batch = players.slice(start, start + batchSize);
    await Promise.all(batch.map((player) => joinRoom(player.page, code)));
    const isLastBatch = start + batchSize >= players.length;
    if (!isLastBatch) {
      await new Promise((resolve) => setTimeout(resolve, batchDelayMs));
    }
  }
}

// Types a guess via the physical keyboard (the app listens on `window` keydown, so no
// element needs focus) and waits for that row's feedback to finish rendering before
// returning, keeping guess "waves" across many players in sync round by round.
export async function submitGuess(page: Page, word: string, row: number): Promise<void> {
  await page.keyboard.type(word.toUpperCase());
  await page.keyboard.press('Enter');
  await page.waitForSelector(
    `#my-word-r${row}-c0.tile-correct, #my-word-r${row}-c0.tile-present, #my-word-r${row}-c0.tile-absent`,
    { timeout: 15_000 },
  );
}

// For a guess that wins/ends the current round (championship) or the whole game (race,
// tie-break): the client resets its per-round attempt state (and, near-simultaneously,
// React commits that reset in the same batch as the winning guess's own feedback), so the
// winning tile's completed CSS class may never actually be observable in the DOM — the
// round transition (or finished/placar state) wins the render race. Don't wait on the tile
// here; the caller's next assertion (round advancing, tie-break starting, placar showing)
// is what actually confirms the guess was accepted.
export async function submitWinningGuess(page: Page, word: string): Promise<void> {
  await page.keyboard.type(word.toUpperCase());
  await page.keyboard.press('Enter');
}
