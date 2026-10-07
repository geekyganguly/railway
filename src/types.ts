// Shape of the files written by scripts/build-data.ts and read by the app.

export type LatLng = [lat: number, lng: number];

export interface Stop {
  code: string;
  name: string;
  /** "HH:MM", or null at the origin. */
  arr: string | null;
  /** "HH:MM", or null at the destination. */
  dep: string | null;
  day: number;
  /** False for stations the train passes without stopping. */
  halt: boolean;
  /** Null when the dataset has no coordinates for the station. */
  lat: number | null;
  lng: number | null;
}

export interface StationRef {
  code: string;
  name: string;
}

export interface Train {
  number: string;
  name: string;
  type: string | null;
  from: StationRef;
  to: StationRef;
  distance: number | null;
  departure: string | null;
  arrival: string | null;
  returnTrain: string | null;
  stops: Stop[];
  path: LatLng[];
}

/** public/data/index.json: [number, name] for every train. */
export type TrainIndex = [number: string, name: string][];
