<script setup lang="ts">
import { computed } from 'vue'
import { ICONS } from '@/lib/icons'

const props = withDefaults(
  defineProps<{
    name: string
    size?: number | string
    strokeWidth?: number
  }>(),
  { size: 18, strokeWidth: 1.65 },
)

const body = computed(() => ICONS[props.name] ?? '')
const style = computed(() => ({
  width: typeof props.size === 'number' ? `${props.size}px` : props.size,
  height: typeof props.size === 'number' ? `${props.size}px` : props.size,
}))
</script>

<template>
  <svg
    class="icon"
    viewBox="0 0 24 24"
    :style="style"
    :stroke-width="strokeWidth"
    aria-hidden="true"
    v-html="body"
  />
</template>
