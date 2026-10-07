// Builds per-train JSON files from the datameet railways dataset
// (https://github.com/datameet/railways) into public/data/.
//
//   node scripts/build-data.mjs              rebuild everything
//   node scripts/build-data.mjs --if-missing skip when public/data/index.json exists
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rawDir = join(root, 'data/raw');
const outDir = join(root, 'public/data');
const trainsDir = join(outDir, 'trains');
const SOURCE = 'https://raw.githubusercontent.com/datameet/railways/master';

if (process.argv.includes('--if-missing') && existsSync(join(outDir, 'index.json'))) {
  process.exit(0);
}

async function loadRaw(name) {
  const file = join(rawDir, `${name}.json`);
  if (!existsSync(file)) {
    console.log(`Downloading ${name}.json …`);
    const res = await fetch(`${SOURCE}/${name}.json`);
    if (!res.ok) throw new Error(`Download of ${name}.json failed: HTTP ${res.status}`);
    await mkdir(rawDir, { recursive: true });
    await writeFile(file, Buffer.from(await res.arrayBuffer()));
  }
  return JSON.parse(await readFile(file, 'utf8'));
}

const padNumber = (n) => String(n).trim().padStart(5, '0');
// Dataset uses the string "None" for missing times; drop the seconds.
const time = (t) => (t && t !== 'None' ? t.slice(0, 5) : null);
const round = (x) => Math.round(x * 1e5) / 1e5;

const [trains, stations, schedules] = await Promise.all(
  ['trains', 'stations', 'schedules'].map(loadRaw),
);

const stationCoords = new Map();
for (const f of stations.features) {
  if (f.geometry?.coordinates) {
    const [lng, lat] = f.geometry.coordinates;
    stationCoords.set(f.properties.code, [round(lat), round(lng)]);
  }
}

const rowsByTrain = new Map();
for (const row of schedules) {
  const n = padNumber(row.train_number);
  if (!rowsByTrain.has(n)) rowsByTrain.set(n, []);
  rowsByTrain.get(n).push(row);
}

const featureByTrain = new Map(trains.features.map((f) => [padNumber(f.properties.number), f]));
const numbers = [...new Set([...featureByTrain.keys(), ...rowsByTrain.keys()])].sort();

await rm(outDir, { recursive: true, force: true });
await mkdir(trainsDir, { recursive: true });

const index = [];
let missingCoords = 0;

for (const number of numbers) {
  const props = featureByTrain.get(number)?.properties ?? {};
  const rows = (rowsByTrain.get(number) ?? []).sort((a, b) => a.id - b.id);

  // Schedules list every station the train passes; it only halts where the
  // arrival and departure times differ (or at the first and last station).
  const stops = rows.map((r, i) => {
    const arr = time(r.arrival);
    const dep = time(r.departure);
    const [lat, lng] = stationCoords.get(r.station_code) ?? [null, null];
    if (lat === null) missingCoords++;
    return {
      code: r.station_code,
      name: r.station_name,
      arr,
      dep,
      day: r.day,
      halt: i === 0 || i === rows.length - 1 || arr !== dep,
      lat,
      lng,
    };
  });

  const geometry = featureByTrain.get(number)?.geometry?.coordinates;
  const path = geometry?.length
    ? geometry.map(([lng, lat]) => [round(lat), round(lng)])
    : stops.filter((s) => s.lat !== null).map((s) => [s.lat, s.lng]);

  const name = props.name ?? rows[0]?.train_name ?? '';
  const train = {
    number,
    name,
    type: props.type ?? null,
    from: { code: props.from_station_code ?? stops[0]?.code, name: props.from_station_name ?? stops[0]?.name },
    to: { code: props.to_station_code ?? stops.at(-1)?.code, name: props.to_station_name ?? stops.at(-1)?.name },
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
