'use client'
import { create } from 'zustand'
import { db } from './firebase'
import { doc, setDoc, getDoc } from 'firebase/firestore'
import { Trade, JournalNote, WidgetConfig } from './types'

interface AppState {
  trades: Trade[]
  journalNotes: Record<string, JournalNote>
  widgets: WidgetConfig[]
  userId: string | null
  loaded: boolean
  setUserId: (uid: string | null) => void
  loadData: (uid: string) => Promise<void>
  saveData: () => void
  addTrade: (trade: Trade) => void
  updateTrade: (id: string, updates: Partial<Trade>) => void
  deleteTrade: (id: string) => void
  setJournalNote: (date: string, type: 'pre' | 'post', text: string) => void
  setWidgets: (widgets: WidgetConfig[]) => void
}

let saveTimeout: ReturnType<typeof setTimeout> | null = null

export const useStore = create<AppState>((set, get) => ({
  trades: [],
  journalNotes: {},
  widgets: [],
  userId: null,
  loaded: false,

  setUserId: (uid) => set({ userId: uid }),

  loadData: async (uid) => {
    try {
      const snap = await getDoc(doc(db, 'users', uid))
      if (snap.exists()) {
        const data = snap.data()
        set({
          trades: data.trades || [],
          journalNotes: data.journalNotes || {},
          widgets: data.widgets || [],
          loaded: true
        })
      } else {
        set({ loaded: true })
      }
    } catch (e) {
      console.error('Load error', e)
      set({ loaded: true })
    }
  },

  saveData: () => {
    const { userId, trades, journalNotes, widgets } = get()
    if (!userId) return
    if (saveTimeout) clearTimeout(saveTimeout)
    saveTimeout = setTimeout(async () => {
      try {
        await setDoc(doc(db, 'users', userId), { trades, journalNotes, widgets })
      } catch (e) {
        console.error('Save error', e)
      }
    }, 800)
  },

  addTrade: (trade) => {
    set(s => ({ trades: [trade, ...s.trades] }))
    get().saveData()
  },

  updateTrade: (id, updates) => {
    set(s => ({ trades: s.trades.map(t => t.id === id ? { ...t, ...updates } : t) }))
    get().saveData()
  },

  deleteTrade: (id) => {
    set(s => ({ trades: s.trades.filter(t => t.id !== id) }))
    get().saveData()
  },

  setJournalNote: (date, type, text) => {
    set(s => ({
      journalNotes: {
        ...s.journalNotes,
        [date]: { ...s.journalNotes[date], [type]: text }
      }
    }))
    get().saveData()
  },

  setWidgets: (widgets) => {
    set({ widgets })
    get().saveData()
  }
}))
