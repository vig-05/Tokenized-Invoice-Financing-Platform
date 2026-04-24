export function monthsDiff(from, to) {
  const a = new Date(from), b = new Date(to)
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth())
}

export function classifyGain(purchaseDate, saleDate, assetType = 'equity') {
  const months = monthsDiff(purchaseDate, saleDate)
  if (assetType === 'equity') return months >= 12 ? 'LTCG' : 'STCG'
  if (assetType === 'debt')   return months >= 24 ? 'LTCG' : 'STCG'
  return 'LTCG'
}

export function ltcgTax(gain) {
  const exempt = 100000
  return gain > exempt ? (gain - exempt) * 0.125 : 0
}

export function stcgTax(gain) {
  return gain * 0.20
}

export function calc80CRemaining(elss = 0, ppf = 0, nps_tier1 = 0) {
  const limit = 150000
  const used  = elss + ppf + nps_tier1
  return Math.max(0, limit - used)
}

export function sipOptimiser(monthlyIncome, existingElss, existingPpf) {
  const remaining80c = calc80CRemaining(existingElss, existingPpf)
  const monthlySip   = Math.min(remaining80c / 12, monthlyIncome * 0.15)
  return Math.round(monthlySip / 500) * 500
}
