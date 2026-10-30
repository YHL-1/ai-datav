/** 草稿卡片展示用的格式化工具，首页与草稿页共用 */

export function hashId(id: string): number {
  let hash = 0
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return hash
}

/** 由 id 稳定映射到 4 种缩略图样式 */
export function draftVariant(id: string): number {
  return (hashId(id) % 4) + 1
}

export function formatClock(iso: string): string {
  const date = new Date(iso)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

export function formatRelative(iso: string): string {
  const date = new Date(iso)
  const diffMinutes = Math.floor((Date.now() - date.getTime()) / 60_000)

  if (diffMinutes < 1) return '刚刚'
  if (diffMinutes < 60) return `${diffMinutes} 分钟前`
  if (diffMinutes < 24 * 60) return `${Math.floor(diffMinutes / 60)} 小时前`

  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) return `昨天 ${formatClock(iso)}`

  return `${date.getMonth() + 1} 月 ${date.getDate()} 日`
}
