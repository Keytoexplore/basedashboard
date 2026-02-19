'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CardRow, Grade } from '@/lib/types';

const GRADES_PSA: Grade[] = ['PSA6', 'PSA7', 'PSA8', 'PSA9'];
const GRADES_CGC: Grade[] = ['CGC6', 'CGC7', 'CGC8', 'CGC9'];

function money(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '-';
  return `$${n.toFixed(2)}`;
}

function dateOrDash(d: string | null | undefined): string {
  return d || '-';
}

function toDay(iso: string | null | undefined): string | null {
  if (!iso) return null;
  // "2026-02-18T21:16:17.028Z" -> "2026-02-18"
  return iso.slice(0, 10);
}

function effectiveRecencyDate(g: any): string {
  return dateOrDash(g.lastSale?.date || toDay(g.stats?.lastMarketUpdate));
}

function effectiveRecentAvg(g: any): number | null {
  // Prefer actual last-sale average (if present), else smartMarketPrice, else 7d market.
  return g.lastSale?.average ?? g.stats?.smartMarketPrice?.price ?? g.stats?.marketPrice7Day ?? null;
}

function recentAvgSource(g: any): string {
  if (g.lastSale?.average != null) return 'last sale';
  if (g.stats?.smartMarketPrice?.price != null) return `smart (${g.stats?.smartMarketPrice?.method || 'n/a'})`;
  if (g.stats?.marketPrice7Day != null) return '7d market';
  return 'n/a';
}

export function CardsTable({ cards }: { cards: CardRow[] }) {
  const [grader, setGrader] = useState<'PSA' | 'CGC'>('PSA');
  const [grade, setGrade] = useState<Grade>('PSA9');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'lastSaleDate' | 'lastSaleAvg' | 'smart30d' | 'count'>('lastSaleDate');

  const availableGrades = grader === 'PSA' ? GRADES_PSA : GRADES_CGC;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let out = cards;
    if (q) {
      out = out.filter((c) => c.name.toLowerCase().includes(q) || c.cardNumber.includes(q));
    }

    out = [...out].sort((a, b) => {
      const ga = a.grades[grade];
      const gb = b.grades[grade];

      const aDate = ga.lastSale?.date || '';
      const bDate = gb.lastSale?.date || '';
      const aAvg = ga.lastSale?.average ?? -1;
      const bAvg = gb.lastSale?.average ?? -1;
      const aSmart = ga.stats?.smartMarketPrice?.price ?? -1;
      const bSmart = gb.stats?.smartMarketPrice?.price ?? -1;
      const aCount = ga.stats?.count ?? -1;
      const bCount = gb.stats?.count ?? -1;

      if (sortBy === 'lastSaleDate') return bDate.localeCompare(aDate);
      if (sortBy === 'lastSaleAvg') return bAvg - aAvg;
      if (sortBy === 'smart30d') return bSmart - aSmart;
      if (sortBy === 'count') return bCount - aCount;
      return 0;
    });

    return out;
  }, [cards, grade, search, sortBy]);

  // Keep grade valid when switching grader
  useEffect(() => {
    if (!availableGrades.includes(grade)) {
      const next = availableGrades[availableGrades.length - 1];
      if (next) setGrade(next);
    }
  }, [availableGrades, grade]);

  return (
    <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, padding: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 140px 180px', gap: 12, marginBottom: 12 }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search (name or number)"
          style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
        />
        <select
          value={grader}
          onChange={(e) => setGrader(e.target.value as any)}
          style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
        >
          <option value="PSA">PSA</option>
          <option value="CGC">CGC</option>
        </select>
        <select
          value={grade}
          onChange={(e) => setGrade(e.target.value as Grade)}
          style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
        >
          {availableGrades.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
        >
          <option value="lastSaleDate">Sort: Last sale date</option>
          <option value="lastSaleAvg">Sort: Last sale avg</option>
          <option value="smart30d">Sort: Smart price (30d)</option>
          <option value="count">Sort: Total sales count</option>
        </select>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', color: 'white' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.15)' }}>
              <th style={{ padding: 10 }}>Card</th>
              <th style={{ padding: 10 }}>Latest datapoint</th>
              <th style={{ padding: 10 }}>Recent avg</th>
              <th style={{ padding: 10 }}>Avg source</th>
              <th style={{ padding: 10 }}>Smart price</th>
              <th style={{ padding: 10 }}>7d market</th>
              <th style={{ padding: 10 }}>All-time sales</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => {
              const g = c.grades[grade];
              const href = c.tcgPlayerUrl || `https://www.tcgplayer.com/product/${c.tcgPlayerId}`;
              return (
                <tr key={c.tcgPlayerId} style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <td style={{ padding: 10 }}>
                    <div style={{ fontWeight: 700 }}>{c.name}</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>
                      Base Set • #{c.cardNumber} • {c.rarity}
                    </div>
                    <a href={href} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#34d399' }}>
                      TCGPlayer →
                    </a>
                  </td>
                  <td style={{ padding: 10, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas' }}>{effectiveRecencyDate(g)}</td>
                  <td style={{ padding: 10 }}>{money(effectiveRecentAvg(g))}</td>
                  <td style={{ padding: 10, fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>{recentAvgSource(g)}</td>
                  <td style={{ padding: 10 }}>{money(g.stats?.smartMarketPrice?.price ?? null)}</td>
                  <td style={{ padding: 10 }}>{money(g.stats?.marketPrice7Day ?? null)}</td>
                  <td style={{ padding: 10 }}>{g.stats?.count ?? '-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {cards.length === 0 && <p style={{ color: 'rgba(255,255,255,0.7)' }}>No data yet. Run: npm run build:base-psa</p>}
    </div>
  );
}
