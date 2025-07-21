import './globals.css'
import Providers from './Providers'
import ThemeWrapper from '@/components/ThemeWrapper'

export const metadata = {
  title: 'Affliya',
  description: 'Affiliate platform',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <ThemeWrapper>
            {children}
          </ThemeWrapper>
        </Providers>
      </body>
    </html>
  )
}