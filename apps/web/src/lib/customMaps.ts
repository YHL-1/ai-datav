/**
 * 用户上传的自定义 GeoJSON 底图。
 * 与 AI Key 一致只存在浏览器 localStorage，不上传服务器。
 */
export interface CustomMap {
  key: string;
  name: string;
  /** GeoJSON FeatureCollection */
  geo: unknown;
  createdAt: string;
}

const STORAGE_KEY = "nexa.customMaps";
const MAX_MAPS = 12;

/** 自定义地图弹窗提交后交给编辑器创建组件的载荷 */
export interface CustomMapSubmitPayload {
  mapKey: string;
  mapName: string;
  view: "2d" | "3d";
  dataset?: { id: string; categoryField: string; valueField: string };
}

export function readCustomMaps(): CustomMap[] {
  try {
    const raw = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? "[]",
    ) as unknown;
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (item): item is CustomMap =>
        Boolean(item) &&
        typeof (item as CustomMap).key === "string" &&
        typeof (item as CustomMap).name === "string",
    );
  } catch {
    return [];
  }
}

export function saveCustomMap(name: string, geo: unknown): CustomMap {
  const map: CustomMap = {
    key: `custom_${Date.now().toString(36)}`,
    name,
    geo,
    createdAt: new Date().toISOString(),
  };
  const next = [...readCustomMaps(), map].slice(-MAX_MAPS);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    throw new Error("浏览器存储空间不足，请删除不用的自定义地图后重试");
  }
  return map;
}

export function removeCustomMap(key: string): void {
  const next = readCustomMaps().filter((item) => item.key !== key);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}
