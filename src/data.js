// Loads the per-train files produced by scripts/build-data.mjs.
const base = `${import.meta.env.BASE_URL}data`;
const trainCache = new Map();
let indexPromise = null;

export function padNumber(n) {
  return String(n).trim().padStart(5, '0');
}

/** All trains as [number, name] pairs. */
export function loadIndex() {
  indexPromise ??= fetch(`${base}/index.json`).then((res) => {
    if (!res.ok) throw new Error(`Could not load the train list (HTTP ${res.status}).`);
    return res.json();
  });
  return indexPromise;
}

/** One train's details, or null when the dataset has no such train. */
export async function loadTrain(number) {
  const key = padNumber(number);
  if (!trainCache.has(key)) {
    const res = await fetch(`${base}/trains/${key}.json`);
    // Vite's dev server answers unknown paths with index.html, so check the type too.
    const isJson = res.headers.get('content-type')?.includes('json');
    if (res.status === 404 || (res.ok && !isJson)) return null;
    if (!res.ok) throw new Error(`Could not load train ${key} (HTTP ${res.status}).`);
    trainCache.set(key, await res.json());
  }
  return trainCache.get(key);
}
