import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { createPlayer, createRoom, joinRoomThrottled, submitGuess, submitWinningGuess, type TestPlayer } from './support/players';
import { pickE2eWords } from './support/words';

// Both tests below run against ONE shared backend process for the whole run (see
// e2e/docker-compose.yml). InMemoryWordRepository's E2E_FIXED_WORDS
// cursor is a single counter that advances every time a game draws its secret word(s),
// and Game/RaceGame draw all of their wordCount words upfront, in declared order, when
// the game starts. So these two tests must run in this exact order — corrida (1 word),
// then campeonato (2 words + 1 tie-break word) — for `words.corridaWord`,
// `words.championshipRound1Word/Round2Word/tieBreakWord` to line up with what the
// backend actually hands out. `test.describe.serial` plus declaration order guarantees this.
const words = pickE2eWords();

const PLAYER_COUNT = Number(process.env.E2E_PLAYER_COUNT ?? 50);
const TEST_TIMEOUT_MS = Number(process.env.E2E_TEST_TIMEOUT_MS ?? 15 * 60 * 1000);
const SCREENSHOT_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'screenshots');

async function waitForSettingsSync(page: import('@playwright/test').Page): Promise<void> {
  await page.waitForTimeout(1000);
}

test.describe.serial('termo.io — max players (50)', () => {
  let players: TestPlayer[] = [];

  test.afterEach(async () => {
    await Promise.all(players.map((player) => player.close()));
    players = [];
  });

  test('corrida — 50 players, one winner', async ({ browser, baseURL }) => {
    test.setTimeout(TEST_TIMEOUT_MS);
    const screenshotDir = join(SCREENSHOT_ROOT, 'corrida');
    mkdirSync(screenshotDir, { recursive: true });

    players = await Promise.all(
      Array.from({ length: PLAYER_COUNT }, (_, index) =>
        createPlayer(browser, baseURL!, `Corredor${String(index + 1).padStart(2, '0')}`),
      ),
    );
    const winner = players[0]!;
    const losers = players.slice(1);

    const code = await createRoom(winner.page, 'race');
    await winner.page.getByLabel('Número de palavras').fill('1');
    await winner.page.getByLabel('Tempo por palavra').selectOption('120000');
    await waitForSettingsSync(winner.page);

    await joinRoomThrottled(losers, code);

    await expect(winner.page.locator('#lobby-shell ul.row-list li')).toHaveCount(PLAYER_COUNT);
    await winner.page.screenshot({ path: join(screenshotDir, 'lobby.png'), fullPage: true });

    await winner.page.locator('#lobby-actions button', { hasText: 'Iniciar partida' }).click();
    await Promise.all(players.map((player) => expect(player.page.locator('#race-room')).toBeVisible({ timeout: 20_000 })));

    for (let row = 0; row < 4; row += 1) {
      await Promise.all(players.map((player) => submitGuess(player.page, words.wrongGuess)));
      if (row === 2) {
        await winner.page.screenshot({ path: join(screenshotDir, 'game.png'), fullPage: true });
      }
    }

    // Every non-winner must burn their 5th guess before the winner's — the instant the
    // winner solves, RaceGame.phase flips to 'finished' and further guesses are rejected.
    await Promise.all(losers.map((player) => submitGuess(player.page, words.wrongGuess)));
    await submitGuess(winner.page, words.corridaWord);

    await expect(winner.page.locator('#placar-modal-overlay')).toBeVisible({ timeout: 20_000 });
    await winner.page.screenshot({ path: join(screenshotDir, 'placar.png'), fullPage: true });
  });

  test('campeonato — 50 players, tie-break, one winner', async ({ browser, baseURL }) => {
    test.setTimeout(TEST_TIMEOUT_MS);
    const screenshotDir = join(SCREENSHOT_ROOT, 'campeonato');
    mkdirSync(screenshotDir, { recursive: true });

    players = await Promise.all(
      Array.from({ length: PLAYER_COUNT }, (_, index) =>
        createPlayer(browser, baseURL!, `Campeao${String(index + 1).padStart(2, '0')}`),
      ),
    );
    const playerA = players[0]!;
    const playerB = players[1]!;
    const spectator = players[2]!;

    const code = await createRoom(playerA.page, 'championship');
    await playerA.page.getByLabel('Número de palavras').fill('2');
    await playerA.page.getByLabel('Tentativas por palavra').fill('5');
    await playerA.page.getByLabel('Tempo por palavra').selectOption('120000');
    await waitForSettingsSync(playerA.page);

    await joinRoomThrottled(players.slice(1), code);

    await expect(playerA.page.locator('#lobby-shell ul.row-list li')).toHaveCount(PLAYER_COUNT);
    await playerA.page.screenshot({ path: join(screenshotDir, 'lobby.png'), fullPage: true });

    await playerA.page.locator('#lobby-actions button', { hasText: 'Iniciar partida' }).click();
    await Promise.all(
      players.map((player) => expect(player.page.locator('#championship-room')).toBeVisible({ timeout: 20_000 })),
    );

    // Round 1: playerA wins.
    for (let row = 0; row < 4; row += 1) {
      await Promise.all(players.map((player) => submitGuess(player.page, words.wrongGuess)));
      if (row === 2) {
        await playerA.page.screenshot({ path: join(screenshotDir, 'game.png'), fullPage: true });
      }
    }
    const round1Losers = players.filter((player) => player !== playerA);
    await Promise.all(round1Losers.map((player) => submitGuess(player.page, words.wrongGuess)));
    await submitWinningGuess(playerA.page, words.championshipRound1Word);

    await expect(playerA.page.locator('#round-status')).toContainText('Palavra 2 de 2', { timeout: 20_000 });

    // Round 2: playerB wins, tying playerA 1-1 and triggering the tie-break.
    for (let row = 0; row < 4; row += 1) {
      await Promise.all(players.map((player) => submitGuess(player.page, words.wrongGuess)));
    }
    const round2Losers = players.filter((player) => player !== playerB);
    await Promise.all(round2Losers.map((player) => submitGuess(player.page, words.wrongGuess)));
    await submitWinningGuess(playerB.page, words.championshipRound2Word);

    await expect(spectator.page.locator('#round-status')).toContainText('Desempate', { timeout: 20_000 });
    await expect(spectator.page.locator('#championship-banner-slot')).toContainText('não está no desempate');
    await spectator.page.screenshot({ path: join(screenshotDir, 'tie-break.png'), fullPage: true });

    // Tie-break: only playerA and playerB may guess (tieBreakMaxAttempts is fixed at 3
    // by the backend); playerA wins it to become the sole overall champion.
    for (let row = 0; row < 2; row += 1) {
      await Promise.all([submitGuess(playerA.page, words.wrongGuess), submitGuess(playerB.page, words.wrongGuess)]);
    }
    await submitGuess(playerB.page, words.wrongGuess);
    await submitWinningGuess(playerA.page, words.tieBreakWord);

    await expect(playerA.page.locator('#placar-modal-overlay')).toBeVisible({ timeout: 20_000 });
    await playerA.page.screenshot({ path: join(screenshotDir, 'placar.png'), fullPage: true });
  });
});
