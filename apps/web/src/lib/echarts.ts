import * as echarts from "echarts";
import "echarts-gl";
import { ensureMaps } from "@/lib/maps";

export function ensureChinaMap(): void {
  ensureMaps(echarts);
}

/**
 * 3D 地图（ECharts GL）用 WebGL 画布，默认不保留绘制缓冲，
 * 导出 PNG 时（html-to-image 走 canvas.toDataURL）会得到空白图。
 * 这里统一给 WebGL 上下文加上 preserveDrawingBuffer。
 */
const nativeGetContext = HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext = function (
  this: HTMLCanvasElement,
  type: string,
  attributes?: Record<string, unknown>,
) {
  if (type === "webgl" || type === "webgl2" || type === "experimental-webgl") {
    return nativeGetContext.call(this, type as "webgl", {
      ...(attributes ?? {}),
      preserveDrawingBuffer: true,
    });
  }
  return nativeGetContext.call(this, type as "2d", attributes as never);
} as typeof nativeGetContext;

export { echarts };
