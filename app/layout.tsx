import './globals.css';
import Providers from './Providers';
import ThemeWrapper from '@/components/ThemeWrapper';
import { Toaster } from 'react-hot-toast';

export const metadata = {
  title: 'Nettmark',
  description: 'Nettmark – The Fastest Growing Affiliate Platform on the Planet',
  metadataBase: new URL('https://app.affliya.vercel.app'),
  openGraph: {
    title: 'Nettmark',
    description: 'Join the future of performance marketing.',
    url: 'https://app.affliya.vercel.app',
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
              toastOptions={{
                style: {
                  background: "#001718",
                  color: "#F9FAFB",
                  border: "1px solid #00C2CB",
                  boxShadow: "0 0 25px rgba(0,194,203,0.25)",
                  borderRadius: "9999px",
                  paddingInline: "16px",
                },
                success: {
                  iconTheme: {
                    primary: "#00C2CB",
                    secondary: "#001718",
                  },
                },
              }}
            />
          </ThemeWrapper>
        </Providers>
      </body>
    </html>
  );
}