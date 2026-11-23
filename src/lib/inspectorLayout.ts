/** Keep the inspector below the rendered header, including wrapped rows.
 * A CSS fallback covers the first paint; ResizeObserver updates this offset
 * without forcing React or Three.js rerenders.
 */
export function inspectorTopOffset(headerBottom: number, rootTop: number): number {
  if (!Number.isFinite(headerBottom) || !Number.isFinite(rootTop)) return 160;
  return Math.max(86, Math.ceil(headerBottom - rootTop + 12));
}
