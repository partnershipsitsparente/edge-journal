export type TradeOutcome = 'win' | 'loss' | 'be' | 'be_win' | 'be_loss'

export interface Trade {
  id: string
  ticker: string
  date: string
  datetime?: string
  side: 'long' | 'short'
  outcome: TradeOutcome
  pnl: number
  rr?: number | null
  notes?: string
  tags?: string[]
  mistakes?: string[]
  screenshots?: string[]
  grade?: string
  holdMins?: number
}

export interface JournalNote {
  pre?: string
  post?: string
}

export interface UserData {
  trades: Trade[]
  journalNotes: Record<string, JournalNote>
  widgets?: WidgetConfig[]
}

export interface WidgetConfig {
  id: string
  analyzeBy: string
  title: string
  cols: string[]
}
