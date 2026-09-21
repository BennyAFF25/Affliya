'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useSessionContext } from '@supabase/auth-helpers-react';
import {
  identifyTikTokUser,
  trackTikTokEvent,
} from '@/../utils/marketing/tiktokPixel';

const BUSINESS_DEMO_PATH = '/lp/business-demo';
const CREATE_ACCOUNT_PATH = '/create-account';
const BUSINESS_ONBOARDING_PATH = '/onboarding/for-business';
const TIKTOK_TEST_EVENT_CODE = 'TEST61337';

const demoContent = [
  {
    content_id: 'nettmark_business_demo',
    content_type: 'product' as const,
    content_name: 'Nettmark Business Demo',
  },
];

export default function TikTokProductTracker() {
  const pathname = usePathname();
  const { session } = useSessionContext();
  const businessSignupStartedRef = useRef(false);

  useEffect(() => {
    if (pathname !== BUSINESS_DEMO_PATH) return;

    trackTikTokEvent(
      'ViewContent',
      {
        contents: demoContent,
        value: 0,
        currency: 'USD',
      },
      { testEventCode: TIKTOK_TEST_EVENT_CODE },
    );
  }, [pathname]);

  useEffect(() => {
    if (pathname !== BUSINESS_DEMO_PATH) return;

    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const anchor = target?.closest('a');
      if (!anchor) return;

      const href = anchor.getAttribute('href') || '';
      if (!href.includes('/create-account') || !href.includes('role=business')) return;

      trackTikTokEvent('ClickButton', {
        contents: demoContent,
        value: 0,
        currency: 'USD',
      });
    };

    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [pathname]);

  useEffect(() => {
    if (pathname === CREATE_ACCOUNT_PATH) {
      try {
        const params = new URLSearchParams(window.location.search);
        const role = (params.get('role') || 'business').toLowerCase();
        businessSignupStartedRef.current = role === 'business';
      } catch {
        businessSignupStartedRef.current = true;
      }
      return;
    }

    if (
      pathname !== BUSINESS_ONBOARDING_PATH ||
      !businessSignupStartedRef.current ||
      !session?.user?.id
    ) {
      return;
    }

    const userId = session.user.id;
    const storageKey = `nettmark.tiktok.businessLead.${userId}`;

    try {
      if (window.localStorage.getItem(storageKey) === '1') {
        businessSignupStartedRef.current = false;
        return;
      }
    } catch {}

    void (async () => {
      await identifyTikTokUser({
        email: session.user.email,
        externalId: userId,
      });

      trackTikTokEvent(
        'Lead',
        {
          contents: [
            {
              content_id: 'nettmark_business_signup',
              content_type: 'product',
              content_name: 'Nettmark Business Account',
            },
          ],
          value: 0,
          currency: 'USD',
        },
        {
          eventId: `lead_${userId}`,
          email: session.user.email,
          externalId: userId,
        },
      );

      try {
        window.localStorage.setItem(storageKey, '1');
      } catch {}

      businessSignupStartedRef.current = false;
    })();
  }, [pathname, session?.user?.email, session?.user?.id]);

  return null;
}
