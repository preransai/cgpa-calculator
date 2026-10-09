import { round } from './calc.js';

export const DASH = '–';

export function formatGpa(value) {
  return value === null || !Number.isFinite(value) ? DASH : round(value).toFixed(2);
}

export function formatPercent(value) {
  return value === null || !Number.isFinite(value) ? DASH : `${round(value).toFixed(2)}%`;
}

export function formatCredits(value) {
  return Number.isFinite(value) ? String(round(value)) : DASH;
}

export function plural(count, word, many = `${word}s`) {
  return `${count} ${count === 1 ? word : many}`;
}
