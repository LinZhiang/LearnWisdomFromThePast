<script setup lang="ts">
defineProps<{
  kicker?: string
  title: string
  subtitle: string
}>()
</script>

<template>
  <header class="page-hero">
    <span class="page-kicker">{{ kicker ?? '智学 04' }}</span>
    <h2 class="page-title">{{ title }}</h2>
    <p class="page-subtitle">{{ subtitle }}</p>
  </header>
</template>
