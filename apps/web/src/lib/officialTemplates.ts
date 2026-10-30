/**
 * 官方只读模板（计划书 F-04）。
 * 使用模板时把这里的画布 JSON 深拷贝成一份新草稿，模板本身不被修改。
 */
import {
  createEmptyCanvas,
  type CanvasComponent,
  type CanvasSchema,
  type ComponentType,
  type ComponentVariant,
} from "@nexa/schema";

function node(
  id: string,
  type: ComponentType,
  name: string,
  frame: CanvasComponent["frame"],
  props: Record<string, unknown>,
  style: CanvasComponent["style"] = {},
  zIndex = 1,
): CanvasComponent {
  return {
    id,
    type,
    name,
    frame,
    zIndex,
    locked: false,
    visible: true,
    props,
    style,
  };
}

/**
 * 每个官方模板一个专属舱体动效，落到画布组件上，进入编辑器后整屏保持动效：
 * holo 扫描线 / neon 流光带 / outline 呼吸光晕。
 * 纯文本不套舱体底，用 minimal（只留角标），避免标题被框住。
 */
function buildCanvas(
  preset: string,
  primary: string,
  components: CanvasComponent[],
  hull: ComponentVariant,
): CanvasSchema {
  const base = createEmptyCanvas();
  return {
    ...base,
    theme: { ...base.theme, preset, primary, accent: "#54C8E8" },
    components: components.map((item, index) => ({
      ...item,
      zIndex: index + 1,
      style: {
        ...item.style,
        variant:
          item.style?.variant ?? (item.type === "text" ? "minimal" : hull),
      },
    })),
  };
}

export interface OfficialTemplate {
  id: string;
  name: string;
  desc: string;
  icon: string;
  variant: number;
  canvas: CanvasSchema;
}

const cityOps = buildCanvas(
  "deep-space",
  "#5EF2C2",
  [
    node(
      "t1_intro",
      "text",
      "标题",
      { x: 48, y: 40, w: 760, h: 56 },
      {
        text: "城市运行指挥中心",
        subtitle: "CITY OPERATIONS CENTER",
      },
      { fontSize: 32, color: "#EAF2F8", fontWeight: 600 },
    ),
    node(
      "t1_kpi1",
      "metric",
      "实时客流",
      { x: 48, y: 140, w: 360, h: 140 },
      {
        label: "实时客流",
        value: "1,284,320",
        unit: "人次",
      },
      { fill: "#0C1721", radius: 12, color: "#5EF2C2", fontSize: 28 },
    ),
    node(
      "t1_kpi2",
      "metric",
      "在线设备",
      { x: 444, y: 140, w: 360, h: 140 },
      {
        label: "在线设备",
        value: "18,642",
        unit: "台",
      },
      { fill: "#0C1721", radius: 12, color: "#54C8E8", fontSize: 28 },
    ),
    node(
      "t1_kpi3",
      "metric",
      "事件处置率",
      { x: 840, y: 140, w: 360, h: 140 },
      {
        label: "事件处置率",
        value: "97.4",
        unit: "%",
      },
      { fill: "#0C1721", radius: 12, color: "#F6C37A", fontSize: 28 },
    ),
    node(
      "t1_map",
      "map.geo",
      "城市地图",
      { x: 1236, y: 140, w: 636, h: 600 },
      {
        title: "城市网格",
        region: "hangzhou",
      },
      { fill: "#08131C", radius: 12 },
    ),
    node(
      "t1_trend",
      "chart.line",
      "客流趋势",
      { x: 48, y: 320, w: 1152, h: 420 },
      {
        title: "客流趋势 · 24h",
      },
      { fill: "#0A1520", radius: 12 },
    ),
    node(
      "t1_rank",
      "chart.bar",
      "区域排行",
      { x: 48, y: 780, w: 576, h: 260 },
      {
        title: "区域事件排行",
      },
      { fill: "#0A1520", radius: 12 },
    ),
    node(
      "t1_events",
      "table",
      "事件列表",
      { x: 660, y: 780, w: 612, h: 260 },
      {
        title: "实时事件",
        pageSize: 6,
      },
      { fill: "#0A1520", radius: 12 },
    ),
  ],
  "holo",
);

const retailWeekly = buildCanvas(
  "deep-space",
  "#F6C37A",
  [
    node(
      "t2_intro",
      "text",
      "标题",
      { x: 48, y: 40, w: 760, h: 56 },
      {
        text: "零售经营周报",
        subtitle: "RETAIL WEEKLY REPORT",
      },
      { fontSize: 32, color: "#EAF2F8", fontWeight: 600 },
    ),
    node(
      "t2_kpi1",
      "metric",
      "销售额",
      { x: 48, y: 140, w: 280, h: 120 },
      {
        label: "本周销售额",
        value: "3,842",
        unit: "万元",
      },
      { fill: "#0C1721", radius: 12, color: "#F6C37A", fontSize: 26 },
    ),
    node(
      "t2_kpi2",
      "metric",
      "客单价",
      { x: 352, y: 140, w: 280, h: 120 },
      {
        label: "客单价",
        value: "128.6",
        unit: "元",
      },
      { fill: "#0C1721", radius: 12, color: "#5EF2C2", fontSize: 26 },
    ),
    node(
      "t2_kpi3",
      "metric",
      "转化率",
      { x: 656, y: 140, w: 280, h: 120 },
      {
        label: "转化率",
        value: "34.2",
        unit: "%",
      },
      { fill: "#0C1721", radius: 12, color: "#54C8E8", fontSize: 26 },
    ),
    node(
      "t2_pie",
      "chart.pie",
      "渠道占比",
      { x: 984, y: 140, w: 888, h: 540 },
      {
        title: "渠道销售占比",
      },
      { fill: "#0A1520", radius: 12 },
    ),
    node(
      "t2_bar",
      "chart.bar",
      "门店排行",
      { x: 48, y: 300, w: 900, h: 380 },
      {
        title: "门店销售排行",
      },
      { fill: "#0A1520", radius: 12 },
    ),
    node(
      "t2_table",
      "table",
      "明细",
      { x: 48, y: 720, w: 900, h: 300 },
      {
        title: "重点门店明细",
        pageSize: 8,
      },
      { fill: "#0A1520", radius: 12 },
    ),
    node(
      "t2_trend",
      "chart.line",
      "周趋势",
      { x: 984, y: 720, w: 888, h: 300 },
      {
        title: "近 7 日销售趋势",
      },
      { fill: "#0A1520", radius: 12 },
    ),
  ],
  "neon",
);

const energyMonitor = buildCanvas(
  "deep-space",
  "#A78BFA",
  [
    node(
      "t3_intro",
      "text",
      "标题",
      { x: 48, y: 40, w: 760, h: 56 },
      {
        text: "园区能耗监测",
        subtitle: "ENERGY MONITORING",
      },
      { fontSize: 32, color: "#EAF2F8", fontWeight: 600 },
    ),
    node(
      "t3_kpi1",
      "metric",
      "总用电",
      { x: 48, y: 140, w: 320, h: 130 },
      {
        label: "今日总用电",
        value: "42,860",
        unit: "kWh",
      },
      { fill: "#0C1721", radius: 12, color: "#A78BFA", fontSize: 26 },
    ),
    node(
      "t3_kpi2",
      "metric",
      "峰值负荷",
      { x: 400, y: 140, w: 320, h: 130 },
      {
        label: "峰值负荷",
        value: "1,284",
        unit: "kW",
      },
      { fill: "#0C1721", radius: 12, color: "#F6C37A", fontSize: 26 },
    ),
    node(
      "t3_kpi3",
      "metric",
      "碳排放",
      { x: 752, y: 140, w: 320, h: 130 },
      {
        label: "碳排放",
        value: "24.6",
        unit: "tCO₂",
      },
      { fill: "#0C1721", radius: 12, color: "#5EF2C2", fontSize: 26 },
    ),
    node(
      "t3_kpi4",
      "metric",
      "告警数",
      { x: 1104, y: 140, w: 320, h: 130 },
      {
        label: "异常告警",
        value: "3",
        unit: "条",
      },
      { fill: "#0C1721", radius: 12, color: "#FF7A8A", fontSize: 26 },
    ),
    node(
      "t3_area",
      "chart.area",
      "能耗趋势",
      { x: 984, y: 320, w: 888, h: 560 },
      {
        title: "分时能耗曲线",
      },
      { fill: "#0A1520", radius: 12 },
    ),
    node(
      "t3_line",
      "chart.line",
      "负荷曲线",
      { x: 48, y: 320, w: 900, h: 380 },
      {
        title: "负荷与温度对照",
      },
      { fill: "#0A1520", radius: 12 },
    ),
    node(
      "t3_table",
      "table",
      "告警列表",
      { x: 48, y: 760, w: 900, h: 260 },
      {
        title: "能耗异常告警",
        pageSize: 6,
      },
      { fill: "#0A1520", radius: 12 },
    ),
    node(
      "t3_note",
      "text",
      "说明",
      { x: 984, y: 920, w: 888, h: 100 },
      {
        text: "数据每 5 分钟刷新一次",
        subtitle: "ENERGY · AUTO REFRESH",
      },
      { fontSize: 13, color: "#5A6A7E" },
    ),
  ],
  "outline",
);

export const OFFICIAL_TEMPLATES: OfficialTemplate[] = [
  {
    id: "city-ops",
    name: "城市运行指挥中心",
    desc: "地图 + 指标 + 事件流",
    icon: "map",
    variant: 1,
    canvas: cityOps,
  },
  {
    id: "retail-ops",
    name: "零售经营周报",
    desc: "趋势 + 渠道 + 排行",
    icon: "chart-bar",
    variant: 2,
    canvas: retailWeekly,
  },
  {
    id: "energy-ops",
    name: "园区能耗监测",
    desc: "能耗趋势 + 异常告警",
    icon: "zap",
    variant: 3,
    canvas: energyMonitor,
  },
];
