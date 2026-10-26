"use client";
import Script from 'next/script';
import { usePathname } from 'next/navigation';

export default function SupportWidget() {
  const pathname = usePathname();
  const authPage = /^\/(?:login|create-account|signup|reset-password|auth)(?:\/|$)/.test(pathname || '');
  // CSS also hides an already-loaded widget during client-side navigation.
  if (authPage) return <style>{`#chatbase-bubble-button, #chatbase-bubble-window, #chatbase-message-bubbles, iframe[src*="chatbase.co"] { display: none !important; }`}</style>;
  return (
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
  );
}
