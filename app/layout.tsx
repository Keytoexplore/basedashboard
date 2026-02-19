import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Vintage PSA Dashboard',
  description: 'Base Set holo PSA 6-9 recent sales dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial' }}>{children}</body>
    </html>
  );
}
