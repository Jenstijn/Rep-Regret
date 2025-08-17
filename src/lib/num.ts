// src/lib/num.ts
/** Toon een getal in <input type="number">; null/undefined → '' (leeg) */
export function toInputValue(v: number | null | undefined): string {
  return v == null ? '' : String(v)
}

/** Lees <input type="number">; '' → null, anders Number(...) */
export function fromInputValue(s: string): number | null {
  return s.trim() === '' ? null : Number(s)
}

/** Tel bij (chip-knoppen). Null telt als 0. */
export function addFromNull(v: number | null | undefined, delta: number): number {
  return Number(v ?? 0) + delta
}