"use client";
/**
 * Loads MapLibre on the client with an explicit worker URL. MapLibre 6 derives the worker path
 * from its own chunk URL, which bundlers rename; the asset reference below makes the bundler
 * emit and serve the worker file.
 */
let ready: Promise<typeof import("maplibre-gl")> | null = null;

export function loadMaplibre() {
  ready ??= import("maplibre-gl").then((ml) => {
    ml.setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).href);
    return ml;
  });
  return ready;
}
