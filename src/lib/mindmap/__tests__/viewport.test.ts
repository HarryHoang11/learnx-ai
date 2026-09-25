// Test cho phép tính khung nhìn mind map. Đây là chỗ sửa lỗi "node bị cắt ở
// mép": auto-fit cũ có sàn zoom cứng 0.45 nên graph lớn KHÔNG được thu nhỏ đủ
// để vừa khung, phần thừa bị `overflow: hidden` của canvas cắt mất.
import { describe, expect, it } from "vitest";
import {
  boundsOfBoxes,
  clampZoom,
  computeAnchoredZoom,
  computeFitTransform,
  pinchZoomFactor,
  type Bounds,
} from "../viewport";

const VIEWPORT = { width: 800, height: 600 };
const PADDING = 28;
const LIMITS = { minZoom: 0.2, maxZoom: 2.5 };

/** Chiếu một hộp trong hệ toạ độ stage sang toạ độ màn hình. */
function project(bounds: Bounds, zoom: number, pan: { x: number; y: number }) {
  return {
    left: bounds.minX * zoom + pan.x,
    top: bounds.minY * zoom + pan.y,
    right: bounds.maxX * zoom + pan.x,
    bottom: bounds.maxY * zoom + pan.y,
  };
}

describe("computeFitTransform", () => {
  it("đưa cả graph vào khung nhìn kể cả khi graph lớn hơn viewport nhiều lần", () => {
    const bounds: Bounds = { minX: 0, minY: 0, maxX: 3000, maxY: 2000 };
    const { zoom, pan } = computeFitTransform({ viewport: VIEWPORT, bounds, padding: PADDING, ...LIMITS });

    // Sàn zoom 0.45 của bản cũ sẽ cho ra 0.45 -> graph 1350px rộng, tràn khỏi
    // viewport 800px. Fit thật phải nhỏ hơn thế và vừa khung.
    expect(zoom).toBeLessThan(0.45);
    const screen = project(bounds, zoom, pan);
    expect(screen.left).toBeGreaterThanOrEqual(PADDING - 1);
    expect(screen.right).toBeLessThanOrEqual(VIEWPORT.width - PADDING + 1);
    expect(screen.top).toBeGreaterThanOrEqual(PADDING - 1);
    expect(screen.bottom).toBeLessThanOrEqual(VIEWPORT.height - PADDING + 1);
  });

  it("căn giữa graph theo trục còn dư khoảng trống", () => {
    const bounds: Bounds = { minX: -500, minY: -200, maxX: 500, maxY: 200 };
    const { zoom, pan } = computeFitTransform({ viewport: VIEWPORT, bounds, padding: PADDING, ...LIMITS });
    const screen = project(bounds, zoom, pan);
    const leftGap = screen.left - 0;
    const rightGap = VIEWPORT.width - screen.right;
    expect(Math.abs(leftGap - rightGap)).toBeLessThan(1);
    const topGap = screen.top;
    const bottomGap = VIEWPORT.height - screen.bottom;
    expect(Math.abs(topGap - bottomGap)).toBeLessThan(1);
  });

  it("không phóng to graph nhỏ quá maxZoom và không thu nhỏ dưới minZoom", () => {
    const tiny: Bounds = { minX: 0, minY: 0, maxX: 40, maxY: 30 };
    // maxZoom do nơi gọi quyết định: trang mind map truyền 1 để graph nhỏ
    // không bị phóng to vỡ nét (giữ đúng hành vi cũ).
    expect(computeFitTransform({ viewport: VIEWPORT, bounds: tiny, padding: PADDING, ...LIMITS, maxZoom: 1 }).zoom).toBe(1);
    expect(computeFitTransform({ viewport: VIEWPORT, bounds: tiny, padding: PADDING, ...LIMITS }).zoom).toBe(LIMITS.maxZoom);

    const huge: Bounds = { minX: 0, minY: 0, maxX: 100_000, maxY: 100_000 };
    expect(computeFitTransform({ viewport: VIEWPORT, bounds: huge, padding: PADDING, ...LIMITS }).zoom).toBe(LIMITS.minZoom);
  });

  it("giữ đúng lề khi zoom bị kẹp ở minZoom (graph khổng lồ vẫn ưu tiên đọc được)", () => {
    const bounds: Bounds = { minX: 0, minY: 0, maxX: 200_000, maxY: 1_000 };
    const { zoom } = computeFitTransform({ viewport: VIEWPORT, bounds, padding: PADDING, ...LIMITS });
    expect(zoom).toBe(LIMITS.minZoom);
  });
});

describe("computeAnchoredZoom", () => {
  it("giữ nguyên điểm graph nằm dưới con trỏ khi zoom (không trôi về góc)", () => {
    const start = { zoom: 1, pan: { x: 120, y: -40 }, focal: { x: 300, y: 220 } };
    const graphPoint = {
      x: (start.focal.x - start.pan.x) / start.zoom,
      y: (start.focal.y - start.pan.y) / start.zoom,
    };

    for (const factor of [1.2, 0.8, 2, 0.5]) {
      const next = computeAnchoredZoom(start, { zoom: start.zoom * factor, focal: start.focal }, LIMITS.minZoom, LIMITS.maxZoom);
      const screenX = graphPoint.x * next.zoom + next.pan.x;
      const screenY = graphPoint.y * next.zoom + next.pan.y;
      expect(screenX).toBeCloseTo(start.focal.x, 1);
      expect(screenY).toBeCloseTo(start.focal.y, 1);
    }
  });

  it("kẹp zoom vào [minZoom, maxZoom] nhưng vẫn giữ điểm mốc", () => {
    const start = { zoom: 1, pan: { x: 0, y: 0 }, focal: { x: 400, y: 300 } };
    const zoomedOut = computeAnchoredZoom(start, { zoom: 0.01, focal: start.focal }, LIMITS.minZoom, LIMITS.maxZoom);
    expect(zoomedOut.zoom).toBe(LIMITS.minZoom);
    const zoomedIn = computeAnchoredZoom(start, { zoom: 99, focal: start.focal }, LIMITS.minZoom, LIMITS.maxZoom);
    expect(zoomedIn.zoom).toBe(LIMITS.maxZoom);
    // Vẫn giữ đúng điểm mốc ở cả hai biên.
    for (const result of [zoomedOut, zoomedIn]) {
      expect(400 * result.zoom + result.pan.x).toBeCloseTo(400, 1);
      expect(300 * result.zoom + result.pan.y).toBeCloseTo(300, 1);
    }
  });
});

describe("boundsOfBoxes", () => {
  it("bao đúng mọi node theo tâm + kích thước", () => {
    const bounds = boundsOfBoxes([
      { x: 100, y: 50, width: 160, height: 40 },
      { x: 300, y: 200, width: 200, height: 60 },
    ]);
    expect(bounds).toEqual({ minX: 20, minY: 50, maxX: 400, maxY: 260 });
  });

  it("trả về hộp an toàn khi chưa có node nào", () => {
    const bounds = boundsOfBoxes([]);
    expect(bounds.maxX).toBeGreaterThan(bounds.minX);
    expect(bounds.maxY).toBeGreaterThan(bounds.minY);
  });
});

describe("pinchZoomFactor + clampZoom", () => {
  it("tỉ lệ thuận với khoảng cách hai ngón và bỏ qua dữ liệu hỏng", () => {
    expect(pinchZoomFactor(100, 200)).toBeCloseTo(2, 5);
    expect(pinchZoomFactor(100, 50)).toBeCloseTo(0.5, 5);
    expect(pinchZoomFactor(0, 50)).toBe(1);
    expect(pinchZoomFactor(100, Number.NaN)).toBe(1);
  });

  it("clampZoom chặn giá trị hỏng và làm tròn 3 chữ số", () => {
    expect(clampZoom(Number.NaN, 0.2, 2.5)).toBe(0.2);
    expect(clampZoom(0, 0.2, 2.5)).toBe(0.2);
    expect(clampZoom(0.123456, 0.2, 2.5)).toBe(0.2);
    expect(clampZoom(1.23456, 0.2, 2.5)).toBe(1.235);
    expect(clampZoom(10, 0.2, 2.5)).toBe(2.5);
  });
});
