'use client';

import { useEffect } from 'react';

const TidioChat = () => {
  useEffect(() => {
    if (document.getElementById('tidio-script')) return;

    const script = document.createElement('script');
    script.src = '//code.tidio.co/jydrfj6b1fxm5jpsaxkfbaf54wvu2iuh.js';
    script.async = true;
    script.id = 'tidio-script';
    document.body.appendChild(script);
  }, []);

  return null;
};

export default TidioChat;