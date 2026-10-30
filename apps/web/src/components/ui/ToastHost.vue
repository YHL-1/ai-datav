<script setup lang="ts">
import Icon from '@/components/ui/Icon.vue'
import { toastState } from '@/lib/toast'
</script>

<template>
  <div class="toast" :class="{ show: toastState.visible }" role="status">
    <Icon name="check" :size="14" />
    <span>{{ toastState.message }}</span>
  </div>
</template>
