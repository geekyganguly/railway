# Indian Railways train route

Enter an Indian Railways train number and see its route on a map, with its stops and timings.

Built with TypeScript, [Vite](https://vite.dev), [Tailwind CSS](https://tailwindcss.com), [Alpine.js](https://alpinejs.dev), [Basecoat UI](https://basecoatui.com) and [Leaflet](https://leafletjs.com) on OpenStreetMap tiles.

## Getting started

Requires Node.js 22.18 or later. The data script is TypeScript run directly by Node's built-in type stripping, which needs 22.18+.

```sh
npm install
npm run dev
```

Open http://localhost:5173 and search for a train, for example `12951`. You can link straight to a train with `?train=12951`.

The first `npm run dev` or `npm run build` downloads the dataset (about 100 MB) and generates the train files. Later runs reuse them.

## Scripts

| Command           | What it does                                                   |
| ----------------- | -------------------------------------------------------------- |
| `npm run dev`     | Start the dev server                                           |
| `npm run build`   | Type-check, then build for production into `dist/`             |
| `npm run typecheck` | Type-check only (`tsc`)                                      |
| `npm run preview` | Serve the production build locally                             |
| `npm run data`    | Regenerate `public/data/` from the dataset (downloads it if missing) |

## Data

Train routes, schedules and station coordinates come from the [datameet railways dataset](https://github.com/datameet/railways). The timetables date from around 2017, so some trains, routes and times have changed since. About 3% of stations have no coordinates; those stops are listed but marked "not on map".

`scripts/build-data.ts` downloads the raw files into `data/raw/` and splits them into one small JSON file per train in `public/data/trains/`, plus `public/data/index.json` for search suggestions. The app fetches only the train you look up. Neither folder is committed.

The dataset lists every station a train passes through. A row counts as a stop when its arrival and departure times differ, or it is the first or last station. The **Show stations it passes without stopping** switch adds the rest.

## Project layout

```
index.html              Page markup (Alpine.js + Basecoat components)
src/main.ts             Alpine component: search, URL state, phone bottom sheet
src/map.ts              Leaflet map: route line, stop markers, focusing a stop
src/data.ts             Fetches and caches the index and train files
src/types.ts            Train and Stop types shared by the app and the data script
src/style.css           Tailwind, Basecoat and Leaflet styles
scripts/build-data.ts   Builds public/data/ from the datameet dataset
```

## Notes

- Map tiles come from OpenStreetMap's public tile servers, which are meant for light use. Read their [tile usage policy](https://operations.osmfoundation.org/policies/tiles/) before deploying publicly, or switch to another tile provider in `src/map.ts`.
- Border lines on the map are drawn by OpenStreetMap and may differ from India's official boundary.
