import type { Player } from '../lib/types';
import type { RevealInfo } from '../hooks/useGame';

interface WordRevealBannerProps {
  reveal: RevealInfo;
  players: Player[];
}

export function WordRevealBanner({ reveal, players }: WordRevealBannerProps) {
  const winnerNickname = players.find((player) => player.playerId === reveal.winnerId)?.nickname;
  const prefix = reveal.isTieBreak ? 'Desempate — ' : '';

  let message: string;
  if (reveal.reason === 'solved' && winnerNickname) {
    message = `${prefix}🎉 ${winnerNickname} acertou: ${reveal.revealedWord}`;
  } else if (reveal.reason === 'timeout') {
    message = `${prefix}⏰ Tempo esgotado! A palavra era: ${reveal.revealedWord}`;
  } else {
    message = `${prefix}❌ Tentativas esgotadas! A palavra era: ${reveal.revealedWord}`;
  }

  return <p style={{ background: '#3a5a7a', padding: 8, borderRadius: 4 }}>{message}</p>;
}
