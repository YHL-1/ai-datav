/**
 * 地图底图注册表：内置底图 + 用户上传的自定义底图。
 * 新增内置底图只需把 GeoJSON 放进 assets 并在 BUILTIN_MAPS 里加一项。
 */
import type * as echarts from "echarts";
import chinaGeo from "@/assets/china.json";
import sichuanGeo from "@/assets/sichuan.json";
import { readCustomMaps } from "@/lib/customMaps";

export interface MapPreset {
  key: string;
  name: string;
  /** GeoJSON FeatureCollection */
  geo: unknown;
  /** 是否为用户上传的自定义底图 */
  custom?: boolean;
}

export const BUILTIN_MAPS: MapPreset[] = [
  { key: "china", name: "中国", geo: chinaGeo },
  { key: "sichuan", name: "四川省", geo: sichuanGeo },
];

let cached: MapPreset[] | null = null;

/** 内置 + 自定义底图，带缓存；自定义底图增删后调用 invalidateMapPresets */
export function listMapPresets(): MapPreset[] {
  if (!cached) {
    cached = [
      ...BUILTIN_MAPS,
      ...readCustomMaps().map((item) => ({
        key: item.key,
        name: item.name,
        geo: item.geo,
        custom: true,
      })),
    ];
  }
  return cached;
}

export function invalidateMapPresets(): void {
  cached = null;
}

const registeredKeys = new Set<string>();

/** 注册全部底图，重复调用只补注册新增项 */
export function ensureMaps(instance: typeof echarts): void {
  listMapPresets().forEach((preset) => {
    if (registeredKeys.has(preset.key)) return;
    instance.registerMap(preset.key, preset.geo as never);
    registeredKeys.add(preset.key);
  });
}

export function resolveMapKey(key: string | undefined): string {
  return listMapPresets().some((preset) => preset.key === key)
    ? (key as string)
    : BUILTIN_MAPS[0].key;
}

export function mapPresetName(key: string | undefined): string {
  return (
    listMapPresets().find((preset) => preset.key === key)?.name ??
    BUILTIN_MAPS[0].name
  );
}
