// ================================================================
// MIND MAP VIEWPORT MATH
// ================================================================
// Tách toàn bộ phép tính "đặt graph vào khung nhìn" thành hàm THUẦN (không
// React, không DOM) để test được bằng số. Auto-fit và zoom-giữ-tâm là hai chỗ
// dễ sai nhất mà trước đây chỉ kiểm tra được bằng mắt.
//
// Hệ toạ độ canvas (xem .mindmap-stage):
//   screen = pan + stage * zoom        (transform: translate(pan) scale(zoom))
//   => pan   = screen - stage * zoom
//   => stage = (screen - pan) / zoom
// ================================================================

export interface Point {
  x: number;
  y: number;
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface ZoomPan {
  zoom: number;
  pan: Point;
}

/** Dưới ngưỡng này coi là màn hình hẹp (điện thoại) — xem MOBILE_READABLE_ZOOM. */
export const MOBILE_VIEWPORT_WIDTH = 560;

/**
 * Zoom tối thiểu cho lần auto-fit ĐẦU TIÊN trên màn hình hẹp. Trên điện thoại,
 * ép cả graph lớn vào màn hình sẽ làm chữ nhỏ tới mức không đọc được, nên chấp
 * nhận cắt bớt: giữ zoom đọc được rồi để người dùng pan/pinch. Nút "Vừa khung"
 * (người dùng bấm) vẫn fit thật.
 */
export const MOBILE_READABLE_ZOOM = 0.5;

/** Zoom luôn nằm trong [minZoom, maxZoom]; giá trị hỏng trả về minZoom. */
export function clampZoom(zoom: number, minZoom: number, maxZoom: number): number {
  if (!Number.isFinite(zoom) || zoom <= 0) return minZoom;
  return Number(Math.min(maxZoom, Math.max(minZoom, zoom)).toFixed(3));
}

/** Bounding box của các hình chữ nhật (toạ độ stage) — bỏ qua danh sách rỗng. */
export function boundsOfBoxes(boxes: Array<{ x: number; y: number; width: number; height: number }>): Bounds {
  if (boxes.length === 0) return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const box of boxes) {
    minX = Math.min(minX, box.x - box.width / 2);
    minY = Math.min(minY, box.y);
    maxX = Math.max(maxX, box.x + box.width / 2);
    maxY = Math.max(maxY, box.y + box.height);
  }
  return { minX, minY, maxX, maxY };
}

export interface FitOptions {
  /** Kích thước vùng nhìn (px màn hình). */
  viewport: { width: number; height: number };
  /** Bounding box của graph trong hệ toạ độ stage. */
  bounds: Bounds;
  /** Lề chừa quanh graph (px màn hình) — node ngoài cùng không chạm mép. */
  padding: number;
  minZoom: number;
  maxZoom: number;
}

/**
 * Zoom + pan để TOÀN BỘ bounding box nằm trong vùng nhìn: chừa `padding` mỗi
 * bên và đặt tâm graph trùng tâm vùng nhìn. Không vượt `maxZoom` (graph nhỏ
 * không bị phóng to vỡ nét) và không nhỏ hơn `minZoom` (graph lớn: thà cắt bớt
 * còn hơn thu nhỏ tới mức không đọc được).
 */
export function computeFitTransform(options: FitOptions): ZoomPan {
  const { viewport, bounds, padding, minZoom, maxZoom } = options;
  const boxWidth = Math.max(1, bounds.maxX - bounds.minX);
  const boxHeight = Math.max(1, bounds.maxY - bounds.minY);
  const availableWidth = Math.max(1, viewport.width - padding * 2);
  const availableHeight = Math.max(1, viewport.height - padding * 2);
  const zoom = clampZoom(Math.min(availableWidth / boxWidth, availableHeight / boxHeight), minZoom, maxZoom);
  return {
    zoom,
    pan: {
      x: viewport.width / 2 - (bounds.minX + boxWidth / 2) * zoom,
      y: viewport.height / 2 - (bounds.minY + boxHeight / 2) * zoom,
    },
  };
}

/**
 * Zoom quanh một điểm mốc (focal) và GIỮ NGUYÊN điểm graph đang nằm dưới điểm
 * mốc đó. Nhờ vậy lăn chuột / bấm +/- / pinch đều không làm nội dung "trôi" về
 * góc trên-trái, và tâm tương đối của khung nhìn được giữ nguyên.
 */
export function computeAnchoredZoom(
  start: { zoom: number; pan: Point; focal: Point },
  target: { zoom: number; focal: Point },
  minZoom: number,
  maxZoom: number
): ZoomPan {
  const zoom = clampZoom(target.zoom, minZoom, maxZoom);
  const graphX = (start.focal.x - start.pan.x) / start.zoom;
  const graphY = (start.focal.y - start.pan.y) / start.zoom;
  return { zoom, pan: { x: target.focal.x - graphX * zoom, y: target.focal.y - graphY * zoom } };
}

/** Hệ số zoom của pinch: tỉ lệ khoảng cách hai ngón so với lúc bắt đầu. */
export function pinchZoomFactor(startDistance: number, currentDistance: number): number {
  if (!Number.isFinite(startDistance) || !Number.isFinite(currentDistance)) return 1;
  if (startDistance <= 0 || currentDistance <= 0) return 1;
  return currentDistance / startDistance;
}
