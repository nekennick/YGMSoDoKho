export type ViewportTransform = { scale: number; panX: number; panY: number };
export type Point = { x: number; y: number };

export function worldToScreen(point: Point, transform: ViewportTransform): Point {
  return { x: point.x * transform.scale + transform.panX, y: point.y * transform.scale + transform.panY };
}

export function screenToWorld(point: Point, transform: ViewportTransform): Point {
  return { x: (point.x - transform.panX) / transform.scale, y: (point.y - transform.panY) / transform.scale };
}

export function screenDeltaToWorld(delta: Point, scale: number): Point {
  return { x: delta.x / scale, y: delta.y / scale };
}
