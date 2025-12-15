import './globals.css';
import Providers from './Providers';
import ThemeWrapper from '@/components/ThemeWrapper';
import { Toaster } from 'react-hot-toast';

export const metadata = {
  title: 'Nettmark',
  description: 'Nettmark – The Fastest Growing Affiliate Platform on the Planet',
  metadataBase: new URL('https://www.nettmark.com'),
  openGraph: {
    title: 'Nettmark',
    description: 'Join the future of performance marketing.',
    url: 'https://www.nettmark.com',
    siteName: 'Nettmark',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Nettmark Preview',
      },
    ],
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="bg-[#0b0b0b] text-white">
      <body className="min-h-screen bg-gradient-to-b from-[#0b0b0b] to-[#0e0e0e] antialiased">
        <Providers>
          <ThemeWrapper>
            {children}
            <Toaster
              position="top-center"
              gutter={10}
              toastOptions={{
                duration: 3500,
                style: {
                  fontSize: "14px",
                  borderRadius: "14px",
                },
              }}
            />
          </ThemeWrapper>
        </Providers>
      </body>
    </html>
  );
}