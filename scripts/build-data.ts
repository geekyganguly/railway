// Builds per-train JSON files from the datameet railways dataset
// (https://github.com/datameet/railways) into public/data/, which is
// committed. Run locally with `npm run data`; deploys never run it.
// Runs with Node's built-in TypeScript support (Node 22.18+), no build step.
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { LatLng, Stop, Train, TrainIndex } from '../src/types.ts';

// Raw dataset shapes (only the fields used here).
interface Feature<G, P> {
  geometry: G | null;
  properties: P;
}
interface FeatureCollection<G, P> {
  features: Feature<G, P>[];
}
type StationsFile = FeatureCollection<{ coordinates: [number, number] }, { code: string }>;
type TrainsFile = FeatureCollection<
  { coordinates: [number, number][] },
  {
    number: string;
    name?: string;
    type?: string;
    from_station_code?: string;
    from_station_name?: string;
    to_station_code?: string;
    to_station_name?: string;
    distance?: number;
    departure?: string;
    arrival?: string;
    return_train?: string;
  }
>;
interface ScheduleRow {
  id: number;
  train_number: string;
  train_name: string;
  station_code: string;
  station_name: string;
  arrival: string;
  departure: string;
  day: number;
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rawDir = join(root, 'data/raw');
const outDir = join(root, 'public/data');
const trainsDir = join(outDir, 'trains');
const SOURCE = 'https://raw.githubusercontent.com/datameet/railways/master';

async function loadRaw<T>(name: string): Promise<T> {
  const file = join(rawDir, `${name}.json`);
  if (!existsSync(file)) {
    console.log(`Downloading ${name}.json …`);
    const res = await fetch(`${SOURCE}/${name}.json`);
    if (!res.ok) throw new Error(`Download of ${name}.json failed: HTTP ${res.status}`);
    await mkdir(rawDir, { recursive: true });
    await writeFile(file, Buffer.from(await res.arrayBuffer()));
  }
  return JSON.parse(await readFile(file, 'utf8')) as T;
}

const padNumber = (n: string | number) => String(n).trim().padStart(5, '0');
// Dataset uses the string "None" for missing times; drop the seconds.
const time = (t: string | undefined) => (t && t !== 'None' ? t.slice(0, 5) : null);
const round = (x: number) => Math.round(x * 1e5) / 1e5;

const [trains, stations, schedules] = await Promise.all([
  loadRaw<TrainsFile>('trains'),
  loadRaw<StationsFile>('stations'),
  loadRaw<ScheduleRow[]>('schedules'),
]);

const stationCoords = new Map<string, LatLng>();
for (const f of stations.features) {
  if (f.geometry?.coordinates) {
    const [lng, lat] = f.geometry.coordinates;
    stationCoords.set(f.properties.code, [round(lat), round(lng)]);
  }
}

const rowsByTrain = new Map<string, ScheduleRow[]>();
for (const row of schedules) {
  const n = padNumber(row.train_number);
  const rows = rowsByTrain.get(n) ?? [];
  rows.push(row);
  rowsByTrain.set(n, rows);
}

const featureByTrain = new Map(trains.features.map((f) => [padNumber(f.properties.number), f]));
const numbers = [...new Set([...featureByTrain.keys(), ...rowsByTrain.keys()])].sort();

await rm(outDir, { recursive: true, force: true });
await mkdir(trainsDir, { recursive: true });

const index: TrainIndex = [];
let missingCoords = 0;

for (const number of numbers) {
  const feature = featureByTrain.get(number);
  const props: Partial<TrainsFile['features'][number]['properties']> = feature?.properties ?? {};
  const rows = (rowsByTrain.get(number) ?? []).sort((a, b) => a.id - b.id);

  // Schedules list every station the train passes; it only halts where the
  // arrival and departure times differ (or at the first and last station).
  const stops = rows.map((r, i): Stop => {
    const arr = time(r.arrival);
    const dep = time(r.departure);
    const coords = stationCoords.get(r.station_code);
    if (!coords) missingCoords++;
    return {
      code: r.station_code,
      name: r.station_name,
      arr,
      dep,
      day: r.day,
      halt: i === 0 || i === rows.length - 1 || arr !== dep,
      lat: coords?.[0] ?? null,
      lng: coords?.[1] ?? null,
    };
  });

  const geometry = feature?.geometry?.coordinates;
  const path: LatLng[] = geometry?.length
    ? geometry.map(([lng, lat]): LatLng => [round(lat), round(lng)])
    : stops.flatMap((s): LatLng[] => (s.lat !== null && s.lng !== null ? [[s.lat, s.lng]] : []));

  const first = stops[0];
  const last = stops.at(-1);
  const name = props.name ?? rows[0]?.train_name ?? '';
  const train: Train = {
    number,
    name,
    type: props.type ?? null,
    from: { code: props.from_station_code ?? first?.code ?? '', name: props.from_station_name ?? first?.name ?? '' },
    to: { code: props.to_station_code ?? last?.code ?? '', name: props.to_station_name ?? last?.name ?? '' },
    distance: props.distance ?? null,
    departure: time(props.departure),
    arrival: time(props.arrival),
    returnTrain: props.return_train ? padNumber(props.return_train) : null,
    stops,
    path,
  };

  await writeFile(join(trainsDir, `${number}.json`), JSON.stringify(train));
  index.push([number, name]);
}

await writeFile(join(outDir, 'index.json'), JSON.stringify(index));
console.log(
  `Wrote ${index.length} trains to public/data (${missingCoords} stop rows without station coordinates).`,
);
