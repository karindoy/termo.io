import type { Player } from '../lib/types';
import type { FastRevealInfo } from '../hooks/useFastGame';

interface FastRevealBannerProps {
  reveal: FastRevealInfo;
  players: Player[];
}

export function FastRevealBanner({ reveal, players }: FastRevealBannerProps) {
  const nickname = players.find((player) => player.playerId === reveal.playerId)?.nickname ?? 'Alguém';

  let message: string;
  if (reveal.reason === 'solved') {
    message = reveal.playerWon
      ? `🏆 ${nickname} acertou todas as palavras e venceu a corrida! Última palavra: ${reveal.revealedWord}`
      : `🎉 ${nickname} acertou: ${reveal.revealedWord}`;
  } else {
    message = `⏰ Tempo esgotado para ${nickname}! A palavra era: ${reveal.revealedWord}`;
  }

  return <p className="banner banner-info">{message}</p>;
}
