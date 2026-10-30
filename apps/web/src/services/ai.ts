/**
 * AI 生成：浏览器直连硅基流动，API Key 仅存在于本机 localStorage，不经过服务端。
 */
import {
  aiResponseSchema,
  type AIResponse,
  type CanvasComponent,
  type CanvasSchema,
} from "@nexa/schema";
import { getAiKey } from "@/lib/aiKey";
import type { DatasetSummary } from "@/services/datasets";

const ENDPOINT = "https://api.siliconflow.cn/v1/chat/completions";
const MODEL = "deepseek-ai/DeepSeek-V3";
const TIMEOUT_MS = 90_000;

export class AiError extends Error {}

/** AI 面板中的一条对话消息 */
export interface AiChatMessage {
  id: number;
  role: "user" | "ai";
  text: string;
  time: string;
  status?: "done" | "error";
  applied?: {
    mode: AIResponse["mode"];
    count: number;
    theme: string;
    warnings: string[];
  };
}

const SYSTEM_PROMPT = `你是 NEXA 大屏编辑器的布局引擎。用户用中文描述需求，你只输出一个 JSON 对象，不要输出解释、Markdown 或代码块。

JSON 结构：
{
  "mode": "replace" | "append" | "edit",
  "message": "一句话说明你做了什么（不超过80字）",
  "theme": { "preset": "deep-space", "primary": "#RRGGBB", "accent": "#RRGGBB" },
  "components": [ ... ],
  "warnings": ["可选提示"]
}

每个组件：
{
  "id": "c1" 形式的唯一字符串,
  "type": "metric" | "chart.line" | "chart.bar" | "chart.pie" | "chart.area" | "table" | "text" | "image" | "decor",
  "name": "组件中文名（不超过20字）",
  "frame": { "x": 数字, "y": 数字, "w": 数字, "h": 数字 },
  "zIndex": 数字（从1递增）,
  "locked": false,
  "visible": true,
  "props": { ... },
  "style": { "fill": "rgba(9,15,24,0.72)", "border": "1px solid rgba(255,255,255,0.07)", "radius": 10, "fontSize": 数字, "color": "#RRGGBB" },
  "binding": { "sourceId": "数据源id", "path": "", "fields": { "category": "列名", "value": "列名" }, "refresh": 30 }  // 仅当绑定了给定数据源时才出现
}

硬性约束：
- 画布 1920×1080，任何组件必须满足 x>=0, y>=0, x+w<=1920, y+h<=1080；最小宽 40、高 24；所有坐标和尺寸必须是 8 的倍数。
- 组件数量 6~14 个，禁止重叠，组件总覆盖面积不低于画布的 75%。
- 禁止使用 map.geo、on* 事件字段、html 或 script 内容；颜色只能是 #RRGGBB / #RRGGBBAA / rgba()。
- props 约定：metric -> {label, value, unit}；图表 -> {title}；table -> {title, pageSize}；text -> {text, subtitle}；image -> {alt}；decor -> {}。metric 的 value 给合理示例数字（不超过 6 个字符），表格 pageSize 固定 6。
- 只有提供的"可用数据源"才能写 binding，sourceId 必须原样使用给定 id，category/value 必须是该数据源已有列名；没有合适数据源时不要写 binding。
- mode：用户要从零生成整块大屏用 "replace"；要求新增/追加内容用 "append"；要求在现有画布上微调（改颜色、改标题、改数值等）用 "edit"，此时 edit 需返回修改后的完整组件列表。

布局蓝图（外边距 40，间距 20，必须直接采用其中的坐标，只允许整体按 8 的倍数微调）：
- 页面标题 text：x=40, y=32, w=680, h=52, fontSize=30，subtitle 写英文副标题。
- KPI 行 metric：y=112, h=152。4 个时 w=445，x=40 / 505 / 970 / 1435；3 个时 w=600，x=40 / 660 / 1280；2 个时 w=900，x=40 / 1020；1 个时 w=1840, x=40。
- 主区图表：y=288, h=376。左侧主图 x=40, w=1100；右侧副图 x=1160, w=720。只有一个主图时 x=40, w=1840。
- 底部区：y=688, h=336。左侧表格 x=40, w=1100；右侧图表 x=1160, w=720。只有表格时 x=40, w=1840。
- 组件少时用上述规则合并区域铺满，绝不允许留下超过 24px 的空档；不要把组件做得又小又散。append 模式下只调整新增组件，不要覆盖已有组件，从空白区域取位。

视觉规范：
- 除 text / decor 外，所有组件 style 必须是：fill "rgba(9,15,24,0.72)"、border "1px solid rgba(255,255,255,0.07)"、radius 10。
- 强调色只使用主题 primary（用于折线、柱状、指标数值）；所有图表统一颜色，饼图除外；不要出现红、黄、紫等杂色。
- 只有页面标题使用 text 组件，卡片标题写进 props.title，不要再用 text 组件重复标题。
- metric 的 style.fontSize=34、fontWeight=600；页面标题 style.color="#DFF3F6"。`;

function describeDatasets(datasets: DatasetSummary[]): string {
  if (!datasets.length) return "当前没有任何可用数据源。";
  return datasets
    .slice(0, 8)
    .map(
      (dataset) =>
        `- id: ${dataset.id} | 名称: ${dataset.name} | 列: ${dataset.columns.join(", ")} | 行数: ${dataset.rowCount}`,
    )
    .join("\n");
}

function describeCanvas(canvas: CanvasSchema): string {
  if (!canvas.components.length) return "当前画布为空。";
  const items = canvas.components.map(
    (component) =>
      `- ${component.id} ${component.name} (${component.type}) 位置 x=${component.frame.x} y=${component.frame.y} 尺寸 ${component.frame.w}×${component.frame.h} props=${JSON.stringify(component.props)}`,
  );
  return `当前画布主题 ${canvas.theme.preset}，主色 ${canvas.theme.primary}，强调色 ${canvas.theme.accent}，共 ${canvas.components.length} 个组件：\n${items.join("\n")}`;
}

function extractJson(content: string): unknown {
  const trimmed = content
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) throw new AiError("AI 没有返回可解析的 JSON");
  try {
    return JSON.parse(trimmed.slice(start, end + 1));
  } catch {
    throw new AiError("AI 返回的 JSON 格式有误，请重试");
  }
}

/** 从硅基流动错误响应里取出可读原因 */
function providerMessage(detail: string): string {
  if (!detail) return "";
  try {
    const parsed = JSON.parse(detail) as {
      message?: unknown;
      error?: { message?: unknown };
    };
    const text = parsed.message ?? parsed.error?.message;
    if (typeof text === "string") return text.slice(0, 80);
  } catch {
    // 非 JSON 错误体直接截断原文
  }
  return detail.slice(0, 80);
}

/** 8 像素对齐，模型偶尔给出小数或越界坐标时兜底 */
function snap(value: number, step = 8): number {
  return Math.round(value / step) * step;
}

function significantOverlap(components: CanvasComponent[]): boolean {
  for (let i = 0; i < components.length; i += 1) {
    for (let j = i + 1; j < components.length; j += 1) {
      const a = components[i].frame;
      const b = components[j].frame;
      const width = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const height = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      if (width > 0 && height > 0) {
        const overlap = width * height;
        if (overlap > Math.min(a.w * a.h, b.w * b.h) * 0.25) return true;
      }
    }
  }
  return false;
}

/**
 * 对模型输出做确定性兜底：8px 对齐、统一卡片样式、统一强调色。
 * 模型不听话时也能保证画布视觉一致。
 */
function normalizeResponse(
  response: AIResponse,
  canvas: CanvasSchema,
): AIResponse {
  const theme = response.theme ?? canvas.theme;

  const components: CanvasComponent[] = response.components.map(
    (component, index) => {
      const x = Math.max(0, Math.min(1920 - 40, snap(component.frame.x)));
      const y = Math.max(0, Math.min(1080 - 24, snap(component.frame.y)));
      const w = Math.max(40, Math.min(1920 - x, snap(component.frame.w)));
      const h = Math.max(24, Math.min(1080 - y, snap(component.frame.h)));

      const style = { ...component.style };
      const isCard = component.type !== "text" && component.type !== "decor";
      if (isCard) {
        style.fill = style.fill ?? "rgba(9,15,24,0.72)";
        style.border = style.border ?? "1px solid rgba(255,255,255,0.07)";
        style.radius = style.radius ?? 10;
      }
      if (component.type === "metric" || component.type.startsWith("chart.")) {
        style.color = theme.primary;
      }
      if (component.type === "metric") {
        style.fontSize = style.fontSize ?? 34;
        style.fontWeight = style.fontWeight ?? 600;
      }
      if (component.type === "text" && style.fontSize === undefined) {
        style.fontSize = y <= 80 ? 30 : 20;
      }

      const props = { ...component.props };
      if (component.type === "table") props.pageSize = 6;

      return {
        ...component,
        frame: { x, y, w, h },
        zIndex: index + 1,
        props,
        style,
      };
    },
  );

  const warnings = [...response.warnings];
  if (significantOverlap(components))
    warnings.push("部分组件位置重叠，可让 AI 重新排布");

  return { ...response, theme, components, warnings };
}

export async function generateCanvas(input: {
  prompt: string;
  canvas: CanvasSchema;
  datasets: DatasetSummary[];
}): Promise<AIResponse> {
  const key = getAiKey();
  if (!key) throw new AiError("请先配置硅基流动 API Key");

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        stream: false,
        temperature: 0.2,
        max_tokens: 4096,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `需求：${input.prompt}\n\n可用数据源：\n${describeDatasets(input.datasets)}\n\n${describeCanvas(input.canvas)}`,
          },
        ],
      }),
    });
  } catch (error) {
    if ((error as Error).name === "AbortError")
      throw new AiError("AI 响应超时，请稍后重试");
    throw new AiError("无法连接硅基流动接口，请检查网络或 API Key 是否可用");
  } finally {
    window.clearTimeout(timer);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    const reason = providerMessage(detail);
    if (response.status === 401)
      throw new AiError("API Key 无效或已过期，请重新配置");
    if (response.status === 402)
      throw new AiError(
        `账户余额不足，请前往硅基流动控制台充值${reason ? `（${reason}）` : ""}`,
      );
    if (response.status === 403)
      throw new AiError(
        `账户无权调用该模型，请确认已实名认证并开通 ${MODEL}${reason ? `（${reason}）` : ""}`,
      );
    if (response.status === 429) throw new AiError("请求过于频繁，请稍后再试");
    throw new AiError(
      `AI 服务返回 ${response.status}${detail ? `：${detail.slice(0, 80)}` : ""}`,
    );
  }

  const payload = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new AiError("AI 没有返回内容，请重试");

  const parsed = aiResponseSchema.safeParse(extractJson(content));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new AiError(
      `AI 输出未通过 Schema 校验：${first?.path.join(".") ?? ""} ${first?.message ?? ""}`.trim(),
    );
  }
  return normalizeResponse(parsed.data, input.canvas);
}
