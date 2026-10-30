<script setup lang="ts">
import Icon from '@/components/ui/Icon.vue'

withDefaults(
  defineProps<{
    crumb?: string
    search?: string
    placeholder?: string
  }>(),
  {
    crumb: '总览',
    search: '',
    placeholder: '搜索草稿、模板或数据源',
  },
)

const emit = defineEmits<{
  (e: 'update:search', value: string): void
  (e: 'new-canvas'): void
}>()
</script>

<template>
  <header class="topbar">
    <div class="crumbs">
      <span>WORKSPACE</span>
      <Icon name="chevron-right" :size="12" />
      <span class="current">{{ crumb }}</span>
    </div>
    <div class="topbar-search">
      <div class="input-wrap">
        <Icon name="search" :size="14" />
        <input class="input" type="text" :value="search" :placeholder="placeholder"
          @input="emit('update:search', ($event.target as HTMLInputElement).value)" />
      </div>
    </div>
    <div class="top-actions">
      <span class="sync-state"><span class="dot" /> 云端已同步</span>
      <button class="icon-btn" type="button" title="通知">
        <Icon name="bell" />
      </button>
      <button class="icon-btn" type="button" title="帮助中心">
        <Icon name="help" />
      </button>
    </div>
  </header>
</template>

<style scoped>
.topbar {
  position: relative;
  z-index: 40;
}
</style>
