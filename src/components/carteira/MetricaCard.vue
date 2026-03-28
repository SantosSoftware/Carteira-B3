<script setup lang="ts">
defineProps<{
  titulo: string
  valor: string
  subtitulo?: string
  variacao?: number | null
  icone: string
  corIcone?: string
}>()
</script>

<template>
  <div class="metrica-card">
    <div class="card-top">
      <span class="card-titulo">{{ titulo }}</span>
      <div class="card-icone-wrap" :style="{ background: corIcone ? corIcone + '22' : '#ede9f8' }">
        <i :class="icone" :style="{ color: corIcone ?? 'var(--color-primary)' }" />
      </div>
    </div>

    <div class="card-valor">{{ valor }}</div>

    <div v-if="subtitulo || variacao !== undefined" class="card-rodape">
      <span
        v-if="variacao !== null && variacao !== undefined"
        class="card-variacao"
        :class="variacao >= 0 ? 'positivo' : 'negativo'"
      >
        <i :class="variacao >= 0 ? 'pi pi-arrow-up' : 'pi pi-arrow-down'" />
        {{ Math.abs(variacao).toFixed(2).replace('.', ',') }}%
      </span>
      <span v-if="subtitulo" class="card-sub">{{ subtitulo }}</span>
    </div>
  </div>
</template>

<style scoped>
.metrica-card {
  background: var(--color-surface);
  border-radius: 16px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06);
  padding: 1.25rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card-titulo {
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.card-icone-wrap {
  width: 34px;
  height: 34px;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
}

.card-valor {
  font-size: 24px;
  font-weight: 700;
  color: var(--color-text);
  line-height: 1.2;
}

.card-rodape {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.card-variacao {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 12px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 6px;
}

.card-variacao.positivo {
  color: var(--color-accent);
  background: #e6faf5;
}

.card-variacao.negativo {
  color: var(--color-danger);
  background: #fdf2f2;
}

.card-sub {
  font-size: 12px;
  color: var(--color-text-muted);
}
</style>
