// app/meta-auth-callback/page.tsx
'use client';

import { useEffect } from 'react';

export default function MetaAuthCallback() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    console.log('[📥 Meta Redirect Params]', { code, state });

    // TODO: send `code` to your API to exchange for access_token
  }, []);

  return (
    <div className="p-8 text-center">
      <h1 className="text-xl font-bold">Connecting Meta...</h1>
      <p className="mt-2 text-gray-500">Hang tight. Finalizing connection.</p>
    </div>
  );
}