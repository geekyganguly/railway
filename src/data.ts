// Loads the per-train files produced by scripts/build-data.ts.
import type { Train, TrainIndex } from './types.ts';

const base = `${import.meta.env.BASE_URL}data`;
const trainCache = new Map<string, Train>();
let indexPromise: Promise<TrainIndex> | null = null;

export function padNumber(n: string | number): string {
  return String(n).trim().padStart(5, '0');
}

/** All trains as [number, name] pairs. */
export function loadIndex(): Promise<TrainIndex> {
  indexPromise ??= fetch(`${base}/index.json`).then((res) => {
    if (!res.ok) throw new Error(`Could not load the train list (HTTP ${res.status}).`);
    return res.json() as Promise<TrainIndex>;
  });
  return indexPromise;
}

/** One train's details, or null when the dataset has no such train. */
export async function loadTrain(number: string | number): Promise<Train | null> {
  const key = padNumber(number);
  const cached = trainCache.get(key);
  if (cached) return cached;
  const res = await fetch(`${base}/trains/${key}.json`);
  // Vite's dev server answers unknown paths with index.html, so check the type too.
  const isJson = res.headers.get('content-type')?.includes('json');
  if (res.status === 404 || (res.ok && !isJson)) return null;
  if (!res.ok) throw new Error(`Could not load train ${key} (HTTP ${res.status}).`);
  const train = (await res.json()) as Train;
  trainCache.set(key, train);
  return train;
}
