<script setup lang="ts">
withDefaults(defineProps<{ small?: boolean; compact?: boolean }>(), {
  small: false,
  compact: false,
})
</script>

<template>
  <div class="logo" :class="{ 'logo--sm': small }">
    <div class="logo-mark" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none">
        <path
          d="M5 19V5l14 14V5"
          stroke="currentColor"
          stroke-width="2.4"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <path d="M5 5h3.5M15.5 19H19" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
      </svg>
    </div>
    <div v-if="!compact" class="logo-type">
      <span class="logo-name">NEXA</span>
      <span class="logo-sub">Smart Screen Studio</span>
    </div>
  </div>
</template>
