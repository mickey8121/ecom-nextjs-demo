import type { Metadata } from 'next';
import { Toaster } from 'sonner';

import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Ecom demo', template: '%s · Ecom demo' },
  description:
    'A small e-commerce prototype on Next.js over the DummyJSON API.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-zinc-50 text-zinc-900 antialiased">
        {children}
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
