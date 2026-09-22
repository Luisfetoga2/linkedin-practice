import { games } from '../games/registry';
import { href } from '../lib/router';

export function Home() {
  return (
    <div>
      {games.map((g) => (
        <p key={g.meta.id}>
          <a href={href(g.meta.id)}>{g.meta.name}</a>
        </p>
      ))}
    </div>
  );
}
