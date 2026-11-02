import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Notifications from '@/components/notifications';

const inter = Inter({ subsets: ['latin', 'cyrillic'], weight: ['400', '500', '600', '700'], display: 'swap' });
export const metadata: Metadata = { title: 'Тестирование выпускников', description: 'Система тестирования и анализа результатов выпускников техникума' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru"><body className={inter.className}>{children}<Notifications/></body></html>;
}
