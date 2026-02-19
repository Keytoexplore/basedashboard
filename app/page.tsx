import * as fs from 'fs';
import * as path from 'path';
import { CardsTable } from '@/components/CardsTable';
import { DashboardData } from '@/lib/types';

export const revalidate = 86400; // 24h

function loadData(): DashboardData {
  const dataPath = path.join(process.cwd(), 'data', 'psa-base.json');
  if (!fs.existsSync(dataPath)) {
    return {
      meta: { builtAt: new Date().toISOString(), setName: 'Base Set', setId: 604, grades: ['PSA6', 'PSA7', 'PSA8', 'PSA9'] },
      cards: [],
    };
  }
  return JSON.parse(fs.readFileSync(dataPath, 'utf8'));
}

export default function Home() {
  const data = loadData();

  return (
    <main style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f172a, #2e1065, #0f172a)', padding: 24 }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <h1 style={{ color: 'white', marginBottom: 6 }}>Base Set (EN) PSA Dashboard</h1>
        <p style={{ color: '#c4b5fd', marginTop: 0 }}>
          Holo cards #1–16 • Grades PSA 6–9 • Source: PokemonPriceTracker (eBay graded aggregates)
        </p>
        <p style={{ color: '#a78bfa', fontSize: 12, marginTop: 0 }}>
          Built at: {new Date(data.meta.builtAt).toLocaleString()}
        </p>

        <CardsTable cards={data.cards} />
      </div>
    </main>
  );
}
