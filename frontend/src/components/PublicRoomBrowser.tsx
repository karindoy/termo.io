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
    <section className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Salas públicas</h2>
        <button className="btn btn-ghost btn-sm" disabled={loading} onClick={refresh}>
          Atualizar
        </button>
      </div>

      {rooms.length === 0 && !loading && <p style={{ color: 'var(--color-text-muted)' }}>Nenhuma sala pública aberta agora.</p>}

      <ul className="row-list">
        {rooms.map((room) => (
          <li key={room.code} className="row-item">
            <span>
              {room.code} · {room.mode === 'round' ? 'Round' : 'Fast'} · {room.players.length} jogador(es)
            </span>
            <button className="btn btn-sm" onClick={() => onJoin(room.code)}>
              Entrar
            </button>
          </li>
        ))}
      </ul>

      {error && <p className="banner banner-error">{error}</p>}
    </section>
  );
}
