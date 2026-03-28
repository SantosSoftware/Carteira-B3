<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits<{
  arquivo: [file: File]
}>()

const arrastando = ref(false)
const inputRef = ref<HTMLInputElement | null>(null)

const MAX_SIZE_MB = 10

function validarArquivo(file: File): string | null {
  if (!file.name.endsWith('.xlsx')) return 'Apenas arquivos .xlsx são aceitos.'
  if (file.size > MAX_SIZE_MB * 1024 * 1024) return `O arquivo deve ter no máximo ${MAX_SIZE_MB}MB.`
  return null
}

function processarArquivo(file: File) {
  const erro = validarArquivo(file)
  if (erro) {
    alert(erro)
    return
  }
  emit('arquivo', file)
}

function onDrop(e: DragEvent) {
  arrastando.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) processarArquivo(file)
}

function onFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) processarArquivo(file)
  if (inputRef.value) inputRef.value.value = ''
}
</script>

<template>
  <div
    class="dropzone"
    :class="{ 'dropzone--active': arrastando }"
    @dragover.prevent="arrastando = true"
    @dragleave.prevent="arrastando = false"
    @drop.prevent="onDrop"
    @click="inputRef?.click()"
  >
    <input
      ref="inputRef"
      type="file"
      accept=".xlsx"
      class="dropzone-input"
      @change="onFileChange"
    />

    <div class="dropzone-content">
      <div class="dropzone-icon-wrap">
        <i class="pi pi-upload dropzone-icon" />
      </div>
      <p class="dropzone-title">
        {{ arrastando ? 'Solte o arquivo aqui' : 'Arraste o arquivo aqui' }}
      </p>
      <p class="dropzone-sub">ou <span class="dropzone-link">clique para selecionar</span></p>
      <p class="dropzone-hint">Formatos aceitos: <strong>.xlsx</strong> · Máximo: 10MB</p>
    </div>
  </div>
</template>

<style scoped>
.dropzone {
  border: 2px dashed var(--color-border);
  border-radius: 14px;
  padding: 2.5rem 1.5rem;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
  background-color: var(--color-bg);
  user-select: none;
}

.dropzone:hover,
.dropzone--active {
  border-color: var(--color-primary);
  background-color: #f3eeff;
}

.dropzone-input {
  display: none;
}

.dropzone-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  pointer-events: none;
}

.dropzone-icon-wrap {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  background-color: #ede9f8;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 0.5rem;
}

.dropzone-icon {
  font-size: 22px;
  color: var(--color-primary);
}

.dropzone-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
}

.dropzone-sub {
  font-size: 13px;
  color: var(--color-text-muted);
  margin: 0;
}

.dropzone-link {
  color: var(--color-primary);
  font-weight: 500;
}

.dropzone-hint {
  font-size: 12px;
  color: var(--color-text-muted);
  margin: 0.25rem 0 0;
}
</style>
