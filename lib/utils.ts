import { Trade, TradeOutcome } from './types'

export function isDecisive(t: Trade) {
  return t.outcome === 'win' || t.outcome === 'loss'
}

export function isBE(t: Trade) {
  return t.outcome === 'be_win' || t.outcome === 'be_loss'
}

export function calcPnl(trades: Trade[]) {
  return trades.reduce((s, t) => s + (t.pnl || 0), 0)
}

export function getDecided(trades: Trade[]) {
  return trades.filter(isDecisive)
}

export function getWins(trades: Trade[]) {
  return trades.filter(t => t.outcome === 'win')
}

export function getLosses(trades: Trade[]) {
  return trades.filter(t => t.outcome === 'loss')
}

export function getWinRate(trades: Trade[]) {
  const decided = getDecided(trades)
  const wins = getWins(decided)
  return decided.length ? (wins.length / decided.length) * 100 : 0
}

export function getProfitFactor(trades: Trade[]) {
  const wins = getWins(trades)
  const losses = getLosses(trades)
  const grossW = wins.reduce((s, t) => s + (t.pnl || 0), 0)
  const grossL = Math.abs(losses.reduce((s, t) => s + (t.pnl || 0), 0))
  return grossL > 0 ? grossW / grossL : null
}

export function getAvgRR(trades: Trade[]) {
  const decided = getDecided(trades).filter(t => t.rr != null)
  return decided.length ? decided.reduce((s, t) => s + (t.rr || 0), 0) / decided.length : null
}

// BE Impact: positive = RR saved, negative = RR missed
export function getBEImpact(trades: Trade[]) {
  const beTrades = trades.filter(isBE)
  let rrSaved = 0    // be_loss trades saved this much RR (would have lost)
  let rrMissed = 0   // be_win trades missed this much RR (would have won)

  beTrades.forEach(t => {
    const potential = t.potentialRR || 0
    if (t.outcome === 'be_loss') rrSaved += potential   // avoided losing X R
    if (t.outcome === 'be_win') rrMissed += potential   // missed gaining X R
  })

  return { rrSaved, rrMissed, net: rrSaved - rrMissed, count: beTrades.length, beTrades }
}

export function periodFilter(trades: Trade[], period: string) {
  if (period === 'all') return trades
  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  if (period === 'today') return trades.filter(t => (t.date || '').slice(0, 10) === today)
  if (period === 'week') {
    const mon = new Date(now)
    mon.setDate(now.getDate() - now.getDay() + 1)
    mon.setHours(0, 0, 0, 0)
    return trades.filter(t => new Date(t.date || '') >= mon)
  }
  if (period === 'month') {
    const prefix = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0')
    return trades.filter(t => (t.date || '').startsWith(prefix))
  }
  return trades
}

export function formatPnl(pnl: number) {
  return (pnl >= 0 ? '+' : '') + '$' + Math.abs(pnl).toFixed(2)
}

export function fmtDate(date: string) {
  return new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
  })
}

export function outcomeLabel(outcome: TradeOutcome): string {
  const map: Record<TradeOutcome, string> = {
    win: 'Win', loss: 'Loss', be_win: 'BE \u2192 Win', be_loss: 'BE \u2192 Loss',
  }
  return map[outcome] || outcome
}

export function outcomePillClass(outcome: TradeOutcome): string {
  if (outcome === 'win') return 'win'
  if (outcome === 'loss') return 'loss'
  if (outcome === 'be_win') return 'be_win'
  if (outcome === 'be_loss') return 'be_loss'
  return 'be'
}
