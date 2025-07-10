"use client";

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

export default function TopupSuccessPage() {
  const params = useSearchParams();
  const router = useRouter();
  const [message, setMessage] = useState('Processing your top-up...');

  useEffect(() => {
    const sessionId = params.get('session_id');
    if (!sessionId) {
      setMessage('No session ID found.');
      return;
    }

    setMessage('Top-up successful! You can now start promoting offers.');
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center">
      <p className="text-lg">{message}</p>
    </div>
  );
}