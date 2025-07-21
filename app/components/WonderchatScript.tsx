'use client';

import { useEffect } from 'react';

export default function WonderchatScript() {
  useEffect(() => {
    const wcs = document.createElement("script");
    wcs.setAttribute("data-name", "wonderchat");
    wcs.setAttribute("data-address", "app.wonderchat.io");
    wcs.setAttribute("data-id", "cmda3mhdi0jl6sz2xs2z92mjr");
    wcs.setAttribute("src", "https://app.wonderchat.io/scripts/wonderchat.js");
    wcs.setAttribute("data-widget-size", "normal");
    wcs.setAttribute("data-widget-button-size", "normal");
    wcs.defer = true;

    document.body.appendChild(wcs);
  }, []);

  return null;
}