"use client";
import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { supportWidgetHiddenRoute } from '../utils/supportWidget';

export default function SupportWidget() {
  const pathname = usePathname();
  const hidden = supportWidgetHiddenRoute(pathname);
  const mobileHidden = supportWidgetHiddenRoute(pathname, true);
  // Hide already-loaded widgets too, including on client-side navigation.
  const selectors = '#chatbase-bubble-button, #chatbase-bubble-window, #chatbase-message-bubbles, iframe[src*="chatbase.co"]';
  const hideCss = `${selectors} { display: none !important; }`;
  if (hidden) return <style>{hideCss}</style>;
  return (
<>
{mobileHidden && <style>{`@media (max-width: 767px) { ${hideCss} }`}</style>}
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
</>
  );
}
