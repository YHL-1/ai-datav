<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<template>
  <main class="not-found">
    <p class="eyebrow">ERROR 404</p>
    <h1 class="display">页面不存在</h1>
    <p class="muted">链接可能已失效，或者你没有访问权限。</p>
    <button type="button" class="back" @click="router.push('/home')">返回工作台</button>
  </main>
</template>

<style scoped>
.not-found {
  min-height: 100vh;
  display: grid;
  place-content: center;
  gap: 10px;
  padding: 40px;
  text-align: center;
}

.not-found h1 {
  margin: 0;
  font-size: 28px;
}

.not-found p {
  margin: 0;
  font-size: 13px;
}

.back {
  justify-self: center;
  height: 36px;
  margin-top: 10px;
  padding: 0 18px;
  border-radius: var(--r-sm);
  background: var(--brand-grad);
  color: #04130f;
  font-size: 13px;
  font-weight: 600;
}
</style>
