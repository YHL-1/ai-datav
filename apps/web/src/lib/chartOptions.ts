import { echarts } from "@/lib/echarts";

export const C = {
  mint: "#5ef2c2",
  cyan: "#54c8e8",
  blue: "#7aa2ff",
  violet: "#a78bfa",
  amber: "#f6c37a",
  coral: "#ff7a8a",
  lime: "#c7f36b",
  text: "#c3d0dd",
  muted: "#8494a8",
  dim: "#5a6a7e",
};

function hexA(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const n = parseInt(
    h.length === 3
      ? h
          .split("")
          .map((x) => x + x)
          .join("")
      : h,
    16,
  );
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

export function tooltipStyle(extra: Record<string, unknown> = {}) {
  return {
    backgroundColor: "rgba(8,14,23,.94)",
    borderColor: "rgba(94,242,194,.22)",
    borderWidth: 1,
    padding: [8, 11],
    textStyle: {
      color: "#dbe7f2",
      fontSize: 11,
      fontFamily: "Microsoft YaHei UI",
    },
    extraCssText: "border-radius:8px;box-shadow:0 12px 30px rgba(0,0,0,.4);",
    axisPointer: { lineStyle: { color: "rgba(94,242,194,.35)" } },
    ...extra,
  };
}

const PROVINCE_VALUES: Record<string, number> = {
  广东省: 96,
  江苏省: 88,
  浙江省: 84,
  山东省: 76,
  上海市: 91,
  北京市: 86,
  四川省: 68,
  湖北省: 63,
  福建省: 61,
  河南省: 58,
  湖南省: 54,
  安徽省: 52,
  河北省: 48,
  陕西省: 44,
  重庆市: 42,
  辽宁省: 37,
  江西省: 34,
  云南省: 32,
  广西壮族自治区: 30,
  山西省: 27,
  贵州省: 25,
  天津市: 24,
  黑龙江省: 22,
  吉林省: 20,
  内蒙古自治区: 19,
  新疆维吾尔自治区: 17,
  甘肃省: 14,
  海南省: 12,
  宁夏回族自治区: 9,
  青海省: 7,
  西藏自治区: 5,
  台湾省: 28,
  香港特别行政区: 21,
  澳门特别行政区: 8,
};

function provinceData() {
  return Object.entries(PROVINCE_VALUES).map(([name, value]) => ({
    name,
    value,
  }));
}

const POINTS: Array<[number, number, number, string]> = [
  [116.4, 39.9, 86, "北京"],
  [121.47, 31.23, 91, "上海"],
  [113.26, 23.13, 77, "广州"],
  [120.15, 30.28, 84, "杭州"],
  [104.06, 30.67, 68, "成都"],
  [114.3, 30.59, 63, "武汉"],
  [108.94, 34.34, 44, "西安"],
  [123.43, 41.8, 37, "沈阳"],
  [102.71, 25.04, 32, "昆明"],
  [118.09, 24.48, 61, "厦门"],
];

/** 按数值深浅给区域着色，色相跟随组件主题色 */
function mapRegionColor(
  value: number,
  min: number,
  max: number,
  accentColor: string,
): string {
  const ratio = max === min ? 1 : (value - min) / (max - min);
  return mixHex("#0a2029", accentColor, 0.15 + ratio * 0.6);
}

export function mapOption(
  mapKey = "china",
  rows?: { category: string; value: number }[],
  accentColor = C.mint,
) {
  const isBuiltinChina = mapKey === "china";
  const source: { name: string; value: number }[] =
    rows && rows.length
      ? rows
          .filter((row) => Number.isFinite(row.value))
          .map((row) => ({ name: row.category, value: row.value }))
      : isBuiltinChina
        ? provinceData()
        : [];
  const values = new Map(source.map((d) => [d.name, d.value]));
  const numbers = source.map((d) => d.value);
  const max = Math.max(1, ...numbers);
  const min = numbers.length ? Math.min(...numbers) : 0;
  return {
    backgroundColor: "transparent",
    animationDuration: 900,
    tooltip: tooltipStyle({
      trigger: "item",
      formatter: (params: { name?: string; value?: unknown }) => {
        const name = params.name ?? "";
        const value = values.get(name);
        return `<b style="color:#eaf2f8">${name}</b><br/><span style="color:#8494a8">区域指数</span>&nbsp;&nbsp;<b style="color:#5ef2c2">${value ?? "-"}</b>`;
      },
    }),
    geo: {
      map: mapKey,
      roam: false,
      // 用四边留白让地图在组件内完整自适应，避免被裁切
      left: "8%",
      right: "8%",
      top: "10%",
      bottom: "10%",
      label: { show: false },
      itemStyle: {
        areaColor: "#0c1b25",
        borderColor: "rgba(107,191,180,.42)",
        borderWidth: 0.9,
        shadowColor: "rgba(94,242,194,.12)",
        shadowBlur: 18,
      },
      emphasis: {
        itemStyle: { areaColor: "#174f52", borderColor: "#7dffe0" },
        label: { show: true, color: "#eafff9", fontSize: 11, fontWeight: 600 },
      },
      select: { disabled: true },
      regions: source.map((d) => ({
        name: d.name,
        itemStyle: {
          areaColor: mapRegionColor(d.value, min, max, accentColor),
        },
        emphasis: {
          itemStyle: {
            areaColor: hexA(accentColor, 0.35),
            borderColor: accentColor,
          },
        },
      })),
    },
    // 内置演示的散射点只对中国底图有意义，自定义底图/绑定数据时不显示
    series:
      isBuiltinChina && !(rows && rows.length)
        ? [
            {
              type: "effectScatter",
              coordinateSystem: "geo",
              geoIndex: 0,
              data: POINTS.map((p) => ({
                name: p[3],
                value: [p[0], p[1], p[2]],
              })),
              symbolSize: (val: number[]) => 4 + val[2] / 22,
              showEffectOn: "render",
              rippleEffect: {
                brushType: "stroke",
                scale: 3.4,
                period: 4.5,
                color: accentColor,
              },
              itemStyle: {
                color: hexA(accentColor, 0.85),
                shadowBlur: 14,
                shadowColor: hexA(accentColor, 0.9),
              },
              emphasis: { scale: 1.3 },
              z: 5,
            },
            {
              type: "scatter",
              coordinateSystem: "geo",
              geoIndex: 0,
              data: POINTS.map((p) => ({
                name: p[3],
                value: [p[0], p[1], p[2]],
              })),
              symbolSize: 3,
              itemStyle: { color: "#05110f" },
              silent: true,
              z: 6,
            },
          ]
        : [],
  };
}

function mixHex(from: string, to: string, t: number): string {
  const parse = (hex: string) => {
    const h = hex.replace("#", "");
    const full =
      h.length === 3
        ? h
            .split("")
            .map((x) => x + x)
            .join("")
        : h;
    const n = parseInt(full, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const [r1, g1, b1] = parse(from);
  const [r2, g2, b2] = parse(to);
  const ratio = Math.min(1, Math.max(0, t));
  const rgb = [r1, g1, b1].map((c, i) =>
    Math.round(c + ([r2, g2, b2][i] - c) * ratio),
  );
  return `#${rgb.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

/** 3D 地图（ECharts GL）：省份按数值着色，可自动旋转 */
export function map3DOption(
  options: {
    rows?: { category: string; value: number }[];
    color?: string;
    autoRotate?: boolean;
    mapKey?: string;
  } = {},
) {
  const accentColor = options.color ?? C.mint;
  const rows: { category: string; value: number }[] = options.rows?.length
    ? options.rows.filter((row) => Number.isFinite(row.value))
    : provinceData().map((item) => ({
        category: item.name,
        value: item.value,
      }));
  const values = rows.map((row) => row.value);
  const max = Math.max(1, ...values);
  const min = Math.min(...values);
  const valueMap = new Map(rows.map((row) => [row.category, row.value]));
  const colorOf = (value: number) => {
    const ratio = max === min ? 1 : (value - min) / (max - min);
    return mixHex("#0a2029", accentColor, 0.2 + ratio * 0.6);
  };

  return {
    backgroundColor: "transparent",
    tooltip: tooltipStyle({
      trigger: "item",
      formatter: (params: { name?: string }) => {
        const name = params.name ?? "";
        const value = valueMap.get(name);
        return `<b style="color:#eaf2f8">${name}</b><br/><span style="color:#8494a8">区域指数</span>&nbsp;&nbsp;<b style="color:#5ef2c2">${value ?? "-"}</b>`;
      },
    }),
    series: [
      {
        type: "map3D",
        map: options.mapKey ?? "china",
        name: "3D 地图",
        boxHeight: 22,
        regionHeight: 3,
        shading: "lambert",
        itemStyle: {
          color: "#0d2732",
          opacity: 0.96,
          borderWidth: 1,
          borderColor: hexA(accentColor, 0.3),
        },
        emphasis: {
          itemStyle: {
            color: hexA(accentColor, 0.55),
            borderColor: accentColor,
          },
          label: {
            show: true,
            textStyle: { color: "#eafff9", fontSize: 11, fontWeight: 600 },
          },
        },
        label: { show: false, textStyle: { color: "#dbe7f2", fontSize: 10 } },
        light: {
          main: {
            intensity: 1.1,
            shadow: true,
            alpha: 38,
            beta: 20,
            shadowQuality: "medium",
          },
          ambient: { intensity: 0.45 },
        },
        viewControl: {
          autoRotate: options.autoRotate ?? true,
          autoRotateSpeed: 8,
          distance: 145,
          alpha: 45,
          beta: 0,
          minDistance: 60,
          maxDistance: 260,
        },
        regions: rows.map((row) => ({
          name: row.category,
          itemStyle: { color: colorOf(row.value) },
        })),
        postEffect: { enable: false },
      },
    ],
  };
}

export function sparkOption(data: number[], color = C.mint) {
  return {
    animationDuration: 700,
    grid: { left: 1, right: 1, top: 4, bottom: 1 },
    xAxis: {
      type: "category",
      show: false,
      boundaryGap: false,
      data: data.map((_, i) => i),
    },
    yAxis: { type: "value", show: false, min: "dataMin" },
    series: [
      {
        type: "line",
        data,
        smooth: 0.35,
        symbol: "none",
        lineStyle: { width: 1.6, color },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: hexA(color, 0.28) },
            { offset: 1, color: hexA(color, 0) },
          ]),
        },
      },
    ],
  };
}

export function miniBarOption(data: number[], color = C.cyan) {
  return {
    animationDuration: 700,
    grid: { left: 0, right: 0, top: 2, bottom: 0 },
    xAxis: { type: "category", show: false, data: data.map((_, i) => i) },
    yAxis: { type: "value", show: false },
    series: [
      {
        type: "bar",
        data,
        barWidth: "46%",
        itemStyle: {
          borderRadius: [2, 2, 0, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color },
            { offset: 1, color: hexA(color, 0.12) },
          ]),
        },
      },
    ],
  };
}

export function trendOption() {
  const labels = [
    "10:00",
    "11:00",
    "12:00",
    "13:00",
    "14:00",
    "15:00",
    "16:00",
    "17:00",
    "18:00",
  ];
  const a = [128, 152, 146, 188, 214, 232, 218, 264, 291];
  const b = [86, 98, 104, 121, 138, 146, 156, 171, 188];
  return {
    animationDuration: 1000,
    grid: { left: 34, right: 12, top: 28, bottom: 24 },
    tooltip: tooltipStyle({ trigger: "axis" }),
    legend: {
      top: 0,
      right: 4,
      itemWidth: 14,
      itemHeight: 3,
      itemGap: 16,
      textStyle: { color: "#7e8fa3", fontSize: 10 },
      data: ["交易额", "订单量"],
    },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: labels,
      axisLine: { lineStyle: { color: "rgba(255,255,255,.08)" } },
      axisTick: { show: false },
      axisLabel: { color: "#5a6a7e", fontSize: 9, margin: 10 },
    },
    yAxis: {
      type: "value",
      splitNumber: 3,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: "#5a6a7e", fontSize: 9 },
      splitLine: {
        lineStyle: { color: "rgba(255,255,255,.045)", type: "dashed" },
      },
    },
    series: [
      {
        name: "交易额",
        type: "line",
        smooth: 0.4,
        data: a,
        symbol: "circle",
        symbolSize: 4,
        showSymbol: false,
        lineStyle: {
          width: 2.2,
          color: C.mint,
          shadowBlur: 12,
          shadowColor: "rgba(94,242,194,.4)",
        },
        itemStyle: { color: C.mint, borderColor: "#061016", borderWidth: 2 },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "rgba(94,242,194,.22)" },
            { offset: 1, color: "rgba(94,242,194,0)" },
          ]),
        },
      },
      {
        name: "订单量",
        type: "line",
        smooth: 0.4,
        data: b,
        symbol: "none",
        lineStyle: { width: 1.6, color: C.cyan, opacity: 0.72, type: "dashed" },
      },
    ],
  };
}

export function donutOption() {
  const data = [
    { name: "线上商城", value: 46 },
    { name: "门店零售", value: 28 },
    { name: "企业采购", value: 16 },
    { name: "其他渠道", value: 10 },
  ];
  const colors = [C.mint, C.cyan, C.violet, "rgba(246,195,122,.85)"];
  return {
    backgroundColor: "transparent",
    tooltip: tooltipStyle({
      trigger: "item",
      formatter: '{b}<br/><b style="color:#5ef2c2">{c}%</b>',
    }),
    series: [
      {
        type: "pie",
        radius: ["58%", "78%"],
        center: ["50%", "48%"],
        avoidLabelOverlap: true,
        padAngle: 3,
        itemStyle: { borderRadius: 3, borderColor: "#0a121c", borderWidth: 3 },
        label: { show: false },
        emphasis: { scaleSize: 5 },
        data: data.map((d, i) => ({
          ...d,
          itemStyle: { color: colors[i % colors.length] },
        })),
      },
    ],
    graphic: [
      {
        type: "group",
        left: "center",
        top: "33%",
        children: [
          {
            type: "text",
            style: {
              text: "46%",
              fill: "#eaf2f8",
              font: "600 28px Bahnschrift",
              textAlign: "center",
            },
          },
          {
            type: "text",
            top: 34,
            style: {
              text: "线上占比",
              fill: "#6f8094",
              font: "10px Microsoft YaHei UI",
              textAlign: "center",
            },
          },
        ],
      },
    ],
  };
}
