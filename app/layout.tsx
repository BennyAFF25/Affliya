import './globals.css'
import Providers from './Providers'
import ThemeWrapper from '@/components/ThemeWrapper'
import TidioChat from '@/components/TidioChat'

export const metadata = {
  title: 'Affliya',
  description: 'Affliya – The Fastest Growing Affiliate Platform on the Planet',
  metadataBase: new URL('https://app.affliya.vercel.app'),
  openGraph: {
    title: 'Affliya',
    description: 'Join the future of performance marketing.',
    url: 'https://app.affliya.vercel.app',
    siteName: 'Affliya',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Affliya Preview',
      },
    ],
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <ThemeWrapper>
            {children}
          </ThemeWrapper>
          <TidioChat />
        </Providers>
      </body>
    </html>
  )
}