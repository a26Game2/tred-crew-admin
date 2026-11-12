import { useCallback, useEffect, useState } from 'react';
import { request } from './api';

const refreshEvent = 'tred-quotation-notifications-refresh';

export function refreshQuotationNotifications() {
  window.dispatchEvent(new Event(refreshEvent));
}

export function useNewQuotationCount(enabled: boolean) {
  const [count, setCount] = useState(0);
  const load = useCallback(async () => {
    if (!enabled) { setCount(0); return; }
    try {
      const response = await request<unknown[]>('/quotation/requests?page=1&pageSize=1&status=NEW');
      setCount(response.meta?.total ?? response.data.length);
    } catch {
      // Notification failure must not block the admin shell.
    }
  }, [enabled]);

  useEffect(() => {
    void load();
    if (!enabled) return;
    const refresh = () => void load();
    window.addEventListener(refreshEvent, refresh);
    return () => window.removeEventListener(refreshEvent, refresh);
  }, [enabled, load]);

  return count;
}
