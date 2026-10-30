const AI_KEY_STORAGE = 'nexa.aiKey'

export function getAiKey(): string {
  return localStorage.getItem(AI_KEY_STORAGE) ?? ''
}

export function setAiKey(value: string) {
  if (value) localStorage.setItem(AI_KEY_STORAGE, value)
  else localStorage.removeItem(AI_KEY_STORAGE)
}

export function hasAiKey(): boolean {
  return getAiKey().length > 0
}

export function maskedAiKey(): string {
  const value = getAiKey()
  if (!value) return '尚未配置 API Key'
  if (value.length <= 8) return '••••••••'
  return `${value.slice(0, 4)}••••${value.slice(-4)}`
}
