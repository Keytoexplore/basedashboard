export type Grade = 'PSA6' | 'PSA7' | 'PSA8' | 'PSA9';

export type GradeStats = {
  count: number;
  averagePrice: number | null;
  medianPrice: number | null;
  minPrice: number | null;
  maxPrice: number | null;
  marketPrice7Day: number | null;
  marketPriceMedian7Day: number | null;
  dailyVolume7Day: number | null;
  marketTrend: string | null;
  lastMarketUpdate: string | null;
  smartMarketPrice: {
    price: number | null;
    confidence?: string | null;
    method?: string | null;
    daysUsed?: number | null;
  } | null;
};

export type LastSale = {
  date: string | null; // YYYY-MM-DD
  average: number | null;
  count: number | null;
  totalValue: number | null;
};

export type CardRow = {
  tcgPlayerId: string;
  name: string;
  cardNumber: string; // 001/102
  setName: string;
  rarity: string;
  tcgPlayerUrl: string | null;

  grades: Record<Grade, {
    stats: GradeStats | null;
    lastSale: LastSale | null;
    priceHistoryDays: number; // number of distinct dates in API history map
  }>;
};

export type DashboardData = {
  meta: {
    builtAt: string;
    setName: string;
    setId: number;
    grades: Grade[];
  };
  cards: CardRow[];
};
