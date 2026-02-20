import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../lib/api';

export function useTrial(session) {
  const [trial, setTrial] = useState(null);
  const [loading, setLoading] = useState(false);

  const refreshTrial = useCallback(async () => {
    if (!session) {
      setTrial(null);
      return;
    }

    setLoading(true);
    try {
      const data = await apiFetch('/api/trial', { method: 'POST' });
      setTrial(data.trial ?? null);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to fetch trial:', error);
      setTrial(null);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    refreshTrial();
  }, [refreshTrial]);

  const isExpired = useMemo(() => {
    if (!trial) return false;
    if (trial.status && trial.status !== 'active') return true;
    if (trial.ends_at) {
      const endsAt = new Date(trial.ends_at).getTime();
      return Number.isFinite(endsAt) && endsAt < Date.now();
    }
    return false;
  }, [trial]);

  return {
    trial,
    loading,
    isExpired,
    refreshTrial
  };
}
