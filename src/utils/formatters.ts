const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const PCT = new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 })
const NUM = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function formatarMoeda(valor: number): string {
  return BRL.format(valor)
}

export function formatarPercentual(valor: number): string {
  return PCT.format(valor / 100)
}

export function formatarNumero(valor: number): string {
  return NUM.format(valor)
}

export function formatarData(dataISO: string): string {
  if (!dataISO) return '-'
  const [ano, mes, dia] = dataISO.split('-')
  return `${dia}/${mes}/${ano}`
}

export function sinalPercentual(valor: number): string {
  return valor >= 0 ? `+${formatarPercentual(valor)}` : formatarPercentual(valor)
}
