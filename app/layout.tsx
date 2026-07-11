import './globals.css';
import React from 'react';
import Providers from './Providers';
import ThemeWrapper from '@/components/ThemeWrapper';
import { Toaster } from 'react-hot-toast';
import Script from 'next/script';
import { META_PIXEL_ID } from '@/../utils/marketing/metaPixel';

const themeInitScript = `
(function () {
  try {
    var storedTheme = window.localStorage.getItem('nettmark.theme');
    var storedThemeSource = window.localStorage.getItem('nettmark.themeSource');
    var theme =
      storedThemeSource === 'manual' && (storedTheme === 'light' || storedTheme === 'dark')
        ? storedTheme
        : 'dark';
    var root = document.documentElement;
    var body = document.body;

    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    root.style.colorScheme = theme;

    if (body) {
      body.classList.remove('light', 'dark');
      body.classList.add(theme);
      body.style.colorScheme = theme;
    }
  } catch (error) {}
})();
`;

export const metadata = {
  title: 'Nettmark',
  description: 'Nettmark – The Fastest Growing Affiliate Platform on the Planet',
  metadataBase: new URL('https://www.nettmark.com'),
  icons: {
    icon: '/Nettmark-icon.png',
    apple: '/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    title: 'Nettmark',
    statusBarStyle: 'black-translucent',
  },
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
    <html lang="en" className="dark bg-[#0b0b0b] text-white" suppressHydrationWarning>
      <body className="dark min-h-screen bg-gradient-to-b from-[#0b0b0b] to-[#0e0e0e] antialiased">
        <script id="theme-init" dangerouslySetInnerHTML={{ __html: themeInitScript }} />
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
            <Script
              id="meta-pixel-base"
              strategy="afterInteractive"
              dangerouslySetInnerHTML={{
                __html: `
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${META_PIXEL_ID}');
fbq('track', 'PageView');
`
              }}
            />
            <noscript>
              <img
                height="1"
                width="1"
                style={{ display: 'none' }}
                src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
                alt=""
              />
            </noscript>
            <Script
              id="chatbase-embed"
              strategy="afterInteractive"
              dangerouslySetInnerHTML={{
                __html: `
(function(){
  if(!window.chatbase||window.chatbase("getState")!=="initialized"){
    window.chatbase=(...arguments)=>{
      if(!window.chatbase.q){window.chatbase.q=[]}
      window.chatbase.q.push(arguments)
    };
    window.chatbase=new Proxy(window.chatbase,{
      get(target,prop){
        if(prop==="q"){return target.q}
        return(...args)=>target(prop,...args)
      }
    })
  }

  const load=function(){
    const s=document.createElement("script");
    s.src="https://www.chatbase.co/embed.min.js";
    s.id="SIfIZPMuvWaYrY3TzaJrg";
    s.domain="www.chatbase.co";
    document.body.appendChild(s);
  };

  if(document.readyState==="complete"){load()}
  else{window.addEventListener("load",load)}
})();
`
              }}
            />
            <Script
              id="chatbase-identify"
              strategy="afterInteractive"
              dangerouslySetInnerHTML={{
                __html: `
(async function(){
  try{
    const res = await fetch('/api/chatbase/identify', { method: 'POST' });
    if(!res.ok) return;
    const { token } = await res.json();
    if(token){
      window.chatbase('identify', { token });
    }
  }catch(e){}
})();
`
              }}
            />
          </ThemeWrapper>
        </Providers>
      </body>
    </html>
  );
}
