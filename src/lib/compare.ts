"use client";
import { useSyncExternalStore } from "react";

import { COMPARE_MAX } from "./compare-limit";

/** Comparator selection (up to COMPARE_MAX property ids), kept in this browser and synced across tabs. */
export { COMPARE_MAX };
const KEY = "radar:comparar";
const listeners = new Set<() => void>();

function read(): number[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]") as unknown;
    return Array.isArray(v) ? v.filter((x): x is number => Number.isInteger(x)).slice(0, COMPARE_MAX) : [];
  } catch {
    return [];
  }
}

let cache: number[] = [];
let cacheRaw = "";
function snapshot(): number[] {
  let raw = "[]";
  try {
    raw = localStorage.getItem(KEY) ?? "[]";
  } catch {
    // Storage blocked: the comparator still works through the URL.
  }
  if (raw !== cacheRaw) {
    cacheRaw = raw;
    cache = read();
  }
  return cache;
}

function write(ids: number[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids.slice(0, COMPARE_MAX)));
  } catch {
    // ignore
  }
  listeners.forEach((l) => l());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  const onStorage = (e: StorageEvent) => e.key === KEY && fn();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", onStorage);
  };
}

const EMPTY: number[] = [];

export function useCompare() {
  const ids = useSyncExternalStore(subscribe, snapshot, () => EMPTY);
  return {
    ids,
    has: (id: number) => ids.includes(id),
    full: ids.length >= COMPARE_MAX,
    toggle: (id: number) => write(ids.includes(id) ? ids.filter((x) => x !== id) : ids.length >= COMPARE_MAX ? ids : [...ids, id]),
    remove: (id: number) => write(ids.filter((x) => x !== id)),
    set: (next: number[]) => write(next),
    clear: () => write([]),
  };
}
