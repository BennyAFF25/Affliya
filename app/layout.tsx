import './globals.css';
import React from 'react';
import Providers from './Providers';
import ThemeWrapper from '@/components/ThemeWrapper';
import NettmarkOfferTracker from '../components/marketing/NettmarkOfferTracker';
import BusinessProductAnalytics from '../components/analytics/BusinessProductAnalytics';
import { Toaster } from 'react-hot-toast';
import Script from 'next/script';
import { META_PIXEL_ID } from '@/../utils/marketing/metaPixel';

const REDDIT_PIXEL_ID = 'a2_jpxi5jrkyvlx';

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

const mobileInputZoomGuard = `
@media (max-width: 768px), (pointer: coarse) {
  input:not([type='checkbox']):not([type='radio']):not([type='range']):not([type='color']),
  select,
  textarea {
    font-size: 16px !important;
  }
}
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
        <style id="mobile-input-zoom-guard" dangerouslySetInnerHTML={{ __html: mobileInputZoomGuard }} />
        <Providers>
          <ThemeWrapper>
            {children}
            <BusinessProductAnalytics />
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
              id="trybe-attribution-pixel"
              strategy="afterInteractive"
              dangerouslySetInnerHTML={{
                __html: `
(function(w,d,p,s,u,pl,at) {
  w._trybe = w._trybe || { pixelCode: p, storeId: s, platform: pl, autoTracking: at, customDomain: 'track.nettmark.com', serviceUrl: 'https://prod-trybe-platform-6mi3j.ondigitalocean.app/attribution' };
  var script = d.createElement('script');
  script.src = u + '/pixel.js';
  script.async = true;
  script.setAttribute('data-pixel-code', p);
  script.setAttribute('data-store-id', s);
  script.setAttribute('data-platform', pl);
  script.setAttribute('data-auto-tracking', at);
  d.head.appendChild(script);
})(window, document, 'px_4f4f743c629f', '1f76e30b-a49e-419f-bb2f-116385e337ac', 'https://track.nettmark.com', 'CUSTOM', 'false');
`
              }}
            />
            <Script
              id="reddit-pixel-base"
              strategy="afterInteractive"
              dangerouslySetInnerHTML={{
                __html: `
!function(w,d){if(!w.rdt){var p=w.rdt=function(){p.sendEvent?p.sendEvent.apply(p,arguments):p.callQueue.push(arguments)};p.callQueue=[];var t=d.createElement("script");t.src="https://www.redditstatic.com/ads/pixel.js?pixel_id=${REDDIT_PIXEL_ID}",t.async=!0;var s=d.getElementsByTagName("script")[0];s.parentNode.insertBefore(t,s)}}(window,document);
rdt('init','${REDDIT_PIXEL_ID}');
rdt('track','PageVisit');
(function(){
  var previousPath = window.location.pathname;
  var makeConversionId = function(prefix){
    try {
      if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        return prefix + '_' + window.crypto.randomUUID();
      }
    } catch (e) {}
    return prefix + '_' + Date.now() + '_' + Math.random().toString(36).slice(2);
  };
  var checkRoute = function(){
    var nextPath = window.location.pathname;
    if (previousPath === '/create-account' && nextPath === '/onboarding/for-business') {
      rdt('track', 'SignUp', { conversionId: makeConversionId('signup') });
    }
    previousPath = nextPath;
  };
  ['pushState','replaceState'].forEach(function(method){
    var original = window.history[method];
    if (typeof original !== 'function') return;
    window.history[method] = function(){
      var result = original.apply(this, arguments);
      setTimeout(checkRoute, 0);
      return result;
    };
  });
  window.addEventListener('popstate', function(){ setTimeout(checkRoute, 0); });
})();
`
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
            <Script
              id="data-minimisation-footer-link"
              strategy="afterInteractive"
              dangerouslySetInnerHTML={{
                __html: `
(function(){
  function addPolicyLink(){
    var footer = document.querySelector('footer');
    if(!footer || footer.querySelector('a[href="/legal/privacy/data-minimisation"]')) return;
    var privacy = footer.querySelector('a[href="/legal/privacy"]');
    if(!privacy || !privacy.parentElement) return;
    var link = document.createElement('a');
    link.href = '/legal/privacy/data-minimisation';
    link.textContent = 'Data Minimisation';
    link.className = privacy.className;
    privacy.parentElement.insertBefore(link, privacy.nextSibling);
  }
  addPolicyLink();
  var observer = new MutationObserver(addPolicyLink);
  observer.observe(document.body, { childList: true, subtree: true });
})();
`
              }}
            />
            <NettmarkOfferTracker />
          </ThemeWrapper>
        </Providers>
      </body>
    </html>
  );
}
