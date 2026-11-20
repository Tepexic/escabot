import { Bangers, Rubik } from 'next/font/google';
import './globals.css';

const display = Bangers({ weight: '400', subsets: ['latin'], variable: '--display' });
const body = Rubik({ subsets: ['latin'], variable: '--body' });

export const metadata = {
  title: 'Escabot',
  description: 'Pregúntale lo que quieras de Fórmula 1. Homenaje de fans a Alex Escalera.',
};
export const viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-MX" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
