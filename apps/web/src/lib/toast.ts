import { reactive } from 'vue'

export const toastState = reactive({
  message: '',
  visible: false,
})

let timer = 0

export function toast(message: string, duration = 2400) {
  toastState.message = message
  toastState.visible = true
  window.clearTimeout(timer)
  timer = window.setTimeout(() => {
    toastState.visible = false
  }, duration)
}
