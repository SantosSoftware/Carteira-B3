<script setup lang="ts">
defineProps<{ tipo: string }>()

const ESTILOS: Record<string, { bg: string; color: string; label: string }> = {
  Acao:      { bg: '#ede9f8', color: '#6c3fc5', label: 'Ação' },
  FII:       { bg: '#fff4e0', color: '#c47a00', label: 'FII' },
  BDR:       { bg: '#e0f0ff', color: '#2563eb', label: 'BDR' },
  ETF:       { bg: '#e6faf5', color: '#059669', label: 'ETF' },
  RendaFixa: { bg: '#fef3c7', color: '#92400e', label: 'Renda Fixa' },
  Outro:     { bg: '#f3f4f6', color: '#6b7280', label: 'Outro' },
}
const ESTILO_FALLBACK = { bg: '#f3f4f6', color: '#6b7280', label: 'Outro' }
</script>

<template>
  <span
    class="badge-tipo"
    :style="{
      background: (ESTILOS[tipo] ?? ESTILO_FALLBACK).bg,
      color: (ESTILOS[tipo] ?? ESTILO_FALLBACK).color,
    }"
  >
    {{ (ESTILOS[tipo] ?? ESTILO_FALLBACK).label }}
  </span>
</template>

<style scoped>
.badge-tipo {
  display: inline-block;
  padding: 2px 9px;
  border-radius: 99px;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}
</style>
