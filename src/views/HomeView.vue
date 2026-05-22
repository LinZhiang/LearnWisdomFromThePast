<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useCounterStore } from '@/stores/counter'

const counterStore = useCounterStore()
const { count, doubled } = storeToRefs(counterStore)
</script>

<template>
  <section>
    <h2>首页</h2>
    <p>这里是 Vue 3 + TypeScript + Router + Pinia 基础模板。</p>
    <div class="card">
      <p>count: {{ count }}</p>
      <p>doubled: {{ doubled }}</p>
      <button type="button" @click="counterStore.increment">+1</button>
    </div>
  </section>
</template>
