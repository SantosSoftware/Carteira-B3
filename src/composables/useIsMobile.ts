import { ref, onMounted, onUnmounted } from 'vue'

const BREAKPOINT = 768

export function useIsMobile() {
  const isMobile = ref(
    typeof window !== 'undefined' ? window.innerWidth < BREAKPOINT : false,
  )

  function atualizar() {
    isMobile.value = window.innerWidth < BREAKPOINT
  }

  onMounted(() => {
    atualizar()
    window.addEventListener('resize', atualizar)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', atualizar)
  })

  return { isMobile }
}
