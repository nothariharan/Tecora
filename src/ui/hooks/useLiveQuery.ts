import { liveQuery } from 'dexie';
import { useState, useEffect, useRef } from 'react';

export function useLiveQuery<T>(
  querier: () => T | Promise<T>,
  deps: unknown[],
  defaultResult?: T,
): T | undefined {
  const [result, setResult] = useState<T | undefined>(defaultResult);
  const querierRef = useRef(querier);
  querierRef.current = querier;

  useEffect(() => {
    const subscription = liveQuery(() => querierRef.current()).subscribe({
      next: setResult,
      error: (err) => console.error('[tecora] liveQuery error', err),
    });
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return result;
}
