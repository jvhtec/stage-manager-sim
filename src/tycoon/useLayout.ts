import { useEffect, useState } from 'react';

/** Phone-sized screens (either orientation) get the compact layout. */
const COMPACT_QUERY = '(max-width: 760px), (max-height: 520px)';
const LANDSCAPE_QUERY = '(orientation: landscape)';

export function useLayout() {
  const read = () => ({
    compact: typeof window !== 'undefined' && window.matchMedia(COMPACT_QUERY).matches,
    landscape: typeof window !== 'undefined' && window.matchMedia(LANDSCAPE_QUERY).matches,
  });
  const [layout, setLayout] = useState(read);
  useEffect(() => {
    const update = () => setLayout(read());
    const a = window.matchMedia(COMPACT_QUERY);
    const b = window.matchMedia(LANDSCAPE_QUERY);
    a.addEventListener('change', update);
    b.addEventListener('change', update);
    window.addEventListener('resize', update);
    return () => {
      a.removeEventListener('change', update);
      b.removeEventListener('change', update);
      window.removeEventListener('resize', update);
    };
  }, []);
  return layout;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Android/desktop Chrome hand us an install prompt we can trigger from our
 * own button. iOS never does — there the player uses Share → Add to Home
 * Screen, which the help window explains.
 */
export function useInstallPrompt() {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const standalone =
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true);
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setEvent(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);
  const isIos = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);
  return {
    standalone,
    canPrompt: !!event,
    isIos,
    install: async () => {
      if (!event) return;
      await event.prompt();
      await event.userChoice;
      setEvent(null);
    },
  };
}
