/**
 * 组件的样式模板与主题色预设：属性面板选择，写入组件 style 字段。
 * 模板只负责容器底色/描边/圆角等可持久化参数；
 * 外层渐变、外壳装饰、交互动效、循环动画都在 EditorCanvas 的 CSS 中实现。
 */
import type { ComponentStyle, ComponentVariant } from "@nexa/schema";

export interface VariantPreset {
  key: ComponentVariant;
  name: string;
  hint: string;
}

export const VARIANT_PRESETS: VariantPreset[] = [
  {
    key: "panel",
    name: "深蓝舱体",
    hint: "深蓝渐变 + 内网格 + 双框角标，悬停上浮",
  },
  {
    key: "card",
    name: "暗夜舱体",
    hint: "深色底 + 顶部高光 + 内框 + 四角角标",
  },
  {
    key: "outline",
    name: "描边舱体",
    hint: "透明底 + 主题色描边 + 长角标 + 呼吸光晕",
  },
  { key: "glass", name: "玻璃舱体", hint: "磨砂模糊 + 斜向反光 + 亮边" },
  { key: "solid", name: "色块舱体", hint: "主题色渐变 + 斜纹肌理 + 内发光" },
  { key: "holo", name: "全息舱体", hint: "青蓝渐变 + 网格纹理 + 循环扫描线" },
  { key: "neon", name: "霓虹舱体", hint: "深底 + 双层外发光 + 上下流光带" },
  { key: "aurora", name: "极光舱体", hint: "多层径向渐变缓慢流动，悬停提亮" },
  {
    key: "minimal",
    name: "极简舱体",
    hint: "无底无框，仅留四角角标与顶部短线",
  },
];

export interface TonePreset {
  key: string;
  name: string;
  color: string;
}

export const TONE_PRESETS: TonePreset[] = [
  { key: "mint", name: "薄荷绿", color: "#5EF2C2" },
  { key: "blue", name: "科技蓝", color: "#54C8E8" },
  { key: "amber", name: "琥珀金", color: "#F6C37A" },
  { key: "violet", name: "紫罗兰", color: "#A78BFA" },
  { key: "coral", name: "珊瑚红", color: "#FF7A8A" },
  { key: "ice", name: "冰川白", color: "#DCE9F0" },
];

export const DEFAULT_TONE = TONE_PRESETS[0].color;

function withAlpha(color: string, alpha: string): string {
  const hex = color.replace("#", "");
  return `#${hex.slice(0, 6)}${alpha}`;
}

/** 生成某个样式模板的完整 style 补丁 */
export function variantStyle(
  key: ComponentVariant,
  tone: string,
): ComponentStyle {
  switch (key) {
    case "card":
      return {
        variant: key,
        fill: "rgba(9,15,24,0.72)",
        border: "1px solid rgba(255,255,255,0.08)",
        radius: 10,
      };
    case "glass":
      return {
        variant: key,
        fill: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.16)",
        radius: 12,
      };
    case "outline":
      return {
        variant: key,
        fill: "rgba(6,12,18,0.35)",
        border: `1px solid ${tone}`,
        radius: 6,
      };
    case "minimal":
      return {
        variant: key,
        fill: "#00000000",
        border: "none",
        radius: 0,
      };
    case "solid":
      return {
        variant: key,
        fill: withAlpha(tone, "1F"),
        border: `1px solid ${withAlpha(tone, "40")}`,
        radius: 8,
      };
    case "holo":
      return {
        variant: key,
        fill: "rgba(8,22,32,0.62)",
        border: `1px solid ${withAlpha(tone, "4D")}`,
        radius: 8,
      };
    case "neon":
      return {
        variant: key,
        fill: "rgba(6,10,18,0.92)",
        border: `1px solid ${withAlpha(tone, "80")}`,
        radius: 10,
      };
    case "panel":
      return {
        variant: key,
        fill: "rgba(7,14,22,0.9)",
        border: `1px solid ${withAlpha(tone, "40")}`,
        radius: 0,
      };
    case "aurora":
      return {
        variant: key,
        fill: "rgba(8,18,26,0.55)",
        border: `1px solid ${withAlpha(tone, "2E")}`,
        radius: 14,
      };
    default:
      return {};
  }
}

/** 换主题色时，同步更新依赖主题色的描边/底色 */
export function toneStyle(
  style: ComponentStyle,
  color: string,
): ComponentStyle {
  const next: ComponentStyle = { ...style, color };
  if (style.variant) {
    const variant = variantStyle(style.variant, color);
    if (variant.border) next.border = variant.border;
    if (variant.fill) next.fill = variant.fill;
  }
  return next;
}

/** 样式模板在选择面板中的预览块（迷你版舱体） */
export function variantPreview(
  key: ComponentVariant,
  tone: string,
): Record<string, string> {
  const style = variantStyle(key, tone);
  const base: Record<string, string> = {
    backgroundColor: style.fill ?? "transparent",
    borderRadius: `${style.radius ?? 0}px`,
  };
  const frame = `inset 0 0 0 1px ${withAlpha(tone, "33")}`;

  switch (key) {
    case "panel":
      return {
        ...base,
        backgroundImage:
          `repeating-linear-gradient(90deg, rgba(255,255,255,.06) 0 1px, transparent 1px 7px), ` +
          `radial-gradient(120% 90% at 50% -10%, ${withAlpha(tone, "99")}, transparent 65%), ` +
          "linear-gradient(168deg, #16324a, #07131e)",
        border: `1px solid ${withAlpha(tone, "73")}`,
        boxShadow: frame,
      };
    case "card":
      return {
        ...base,
        backgroundImage:
          "linear-gradient(180deg, rgba(255,255,255,.1), transparent 55%), " +
          `radial-gradient(100% 80% at 50% 0%, ${withAlpha(tone, "55")}, transparent 65%), ` +
          "linear-gradient(180deg, #0b1521, #060b13)",
        boxShadow: `inset 0 1px 0 rgba(255,255,255,.14), ${frame}`,
      };
    case "outline":
      return {
        ...base,
        border: `1px solid ${tone}`,
        boxShadow: `0 0 10px -2px ${withAlpha(tone, "80")}, ${frame}`,
      };
    case "glass":
      return {
        ...base,
        backgroundImage:
          "linear-gradient(135deg, rgba(255,255,255,.26), rgba(255,255,255,.03) 50%, rgba(255,255,255,.16))",
        border: "1px solid rgba(255,255,255,.2)",
      };
    case "solid":
      return {
        ...base,
        backgroundImage:
          `repeating-linear-gradient(135deg, rgba(255,255,255,.09) 0 2px, transparent 2px 7px), ` +
          `linear-gradient(160deg, ${withAlpha(tone, "73")}, ${withAlpha(tone, "1F")})`,
        boxShadow: frame,
      };
    case "holo":
      return {
        ...base,
        backgroundImage:
          `repeating-linear-gradient(0deg, ${withAlpha(tone, "26")} 0 1px, transparent 1px 5px), ` +
          `radial-gradient(120% 90% at 50% -20%, ${withAlpha(tone, "AA")}, transparent 65%)`,
        border: `1px solid ${withAlpha(tone, "99")}`,
        boxShadow: `0 0 10px -3px ${withAlpha(tone, "AA")}`,
      };
    case "neon":
      return {
        ...base,
        backgroundImage: `radial-gradient(120% 92% at 50% 0%, ${withAlpha(tone, "40")}, transparent 62%)`,
        border: `1px solid ${withAlpha(tone, "CC")}`,
        boxShadow: `0 0 8px ${withAlpha(tone, "80")}, inset 0 0 8px ${withAlpha(tone, "40")}`,
      };
    case "aurora":
      return {
        ...base,
        backgroundImage:
          `radial-gradient(60% 80% at 15% 0%, ${withAlpha(tone, "80")}, transparent 62%), ` +
          `radial-gradient(60% 80% at 90% 20%, rgba(122,162,255,.45), transparent 66%), ` +
          "linear-gradient(180deg, #0a1620, #060c14)",
      };
    case "minimal":
      return {
        ...base,
        border: "1px dashed rgba(255,255,255,.18)",
        backgroundImage: `linear-gradient(90deg, ${withAlpha(tone, "CC")}, transparent 60%)`,
      };
    default:
      return base;
  }
}
