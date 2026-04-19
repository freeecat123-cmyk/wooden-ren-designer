/**
 * Shared geometry helpers used across furniture templates.
 */

/** Four corner positions (centered on origin) for a leg of given size. */
export function corners(length: number, width: number, legSize: number) {
  const halfL = length / 2 - legSize / 2;
  const halfW = width / 2 - legSize / 2;
  return [
    { x: -halfL, z: -halfW },
    { x: halfL, z: -halfW },
    { x: -halfL, z: halfW },
    { x: halfL, z: halfW },
  ];
}
