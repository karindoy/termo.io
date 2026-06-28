import { useEffect, useState } from 'react';
import { listPublicRooms, RoomLookupError } from '../lib/api';
import type { RoomSummary } from '../lib/types';

export function PublicRoomBrowser({ onJoin }: { onJoin: (code: string) => void }) {
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      setRooms(await listPublicRooms());
    } catch (err) {
      setError(err instanceof RoomLookupError ? err.message : 'Não foi possível listar as salas públicas');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p>Salas públicas</p>
        <button disabled={loading} onClick={refresh}>
          Atualizar
        </button>
      </div>

      {rooms.length === 0 && !loading && <p>Nenhuma sala pública aberta agora.</p>}

      <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {rooms.map((room) => (
          <li
            key={room.code}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#2a2a2c', padding: 8, borderRadius: 4 }}
          >
            <span>
              {room.code} · {room.mode === 'round' ? 'Round' : 'Fast'} · {room.players.length} jogador(es)
            </span>
            <button onClick={() => onJoin(room.code)}>Entrar</button>
          </li>
        ))}
      </ul>

      {error && <p style={{ background: '#8d3838', padding: 8, borderRadius: 4 }}>{error}</p>}
    </section>
  );
}
