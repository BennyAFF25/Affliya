import './globals.css';
import Providers from './Providers';
import ThemeWrapper from '@/components/ThemeWrapper';
import { Toaster } from 'react-hot-toast';
import Script from 'next/script';
import { Analytics } from "@vercel/analytics/next"

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
        <Analytics />
      </body>
    </html>
  );
}