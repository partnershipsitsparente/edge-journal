'use client'
import { useState } from 'react'
import { useStore } from '@/lib/store'
import { Trade } from '@/lib/types'

interface Props {
  onClose: () => void
}

export default function TradeModal({ onClose }: Props) {
  const addTrade = useStore(s => s.addTrade)
  const [form, setForm] = useState({
    ticker: 'MNQ',
    date: new Date().toISOString().slice(0, 10),
    side: 'short' as 'long' | 'short',
    outcome: 'win' as 'win' | 'loss' | 'be',
    pnl: '',
    rr: '',
    notes: '',
  })
  const [screenshots, setScreenshots] = useState<string[]>([])

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleFiles = (files: FileList | null) => {
    if (!files) return
    Array.from(files).forEach(f => {
      const r = new FileReader()
      r.onload = e => setScreenshots(prev => [...prev, e.target?.result as string])
      r.readAsDataURL(f)
    })
  }

  const submit = () => {
    const trade: Trade = {
      id: Date.now().toString(),
      ticker: form.ticker || 'MNQ',
      date: form.date,
      side: form.side,
      outcome: form.outcome,
      pnl: parseFloat(form.pnl) || 0,
      rr: form.rr ? parseFloat(form.rr) : null,
      notes: form.notes,
      screenshots,
      tags: [],
      mistakes: [],
    }
    addTrade(trade)
    onClose()
  }

  const row2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }
  const label: React.CSSProperties = { fontSize: 11, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6, display: 'block' }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Log Trade</div>
        <div style={row2}>
          <div><label style={label}>Ticker</label><input className="form-input" value={form.ticker} onChange={e => set('ticker', e.target.value)} /></div>
          <div><label style={label}>Date</label><input className="form-input" type="date" value={form.date} onChange={e => set('date', e.target.value)} /></div>
        </div>
        <div style={row2}>
          <div>
            <label style={label}>Side</label>
            <select className="form-input" value={form.side} onChange={e => set('side', e.target.value)}>
              <option value="long">Long</option>
              <option value="short">Short</option>
            </select>
          </div>
          <div>
            <label style={label}>Outcome</label>
            <select className="form-input" value={form.outcome} onChange={e => set('outcome', e.target.value)}>
              <option value="win">Win</option>
              <option value="loss">Loss</option>
              <option value="be">Breakeven</option>
            </select>
          </div>
        </div>
        <div style={row2}>
          <div><label style={label}>P&amp;L ($)</label><input className="form-input" type="number" step="0.01" placeholder="0.00" value={form.pnl} onChange={e => set('pnl', e.target.value)} /></div>
          <div><label style={label}>R:R</label><input className="form-input" type="number" step="0.01" placeholder="0.00" value={form.rr} onChange={e => set('rr', e.target.value)} /></div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={label}>Notes</label>
          <input className="form-input" placeholder="Quick note..." value={form.notes} onChange={e => set('notes', e.target.value)} />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={label}>Screenshots</label>
          <div
            onClick={() => document.getElementById('ss-file-input')?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files) }}
            style={{
              border: '2px dashed var(--border)', borderRadius: 10, padding: '16px',
              textAlign: 'center', cursor: 'pointer', background: 'var(--bg3)',
              fontSize: 12, color: 'var(--muted)', transition: 'border-color .15s'
            }}
          >
            📷 Click or drag to add chart screenshots
          </div>
          <input id="ss-file-input" type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => handleFiles(e.target.files)} />
          {screenshots.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8, marginTop: 10 }}>
              {screenshots.map((src, i) => (
                <div key={i} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', aspectRatio: '16/9', background: 'var(--bg4)' }}>
                  <img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button onClick={() => setScreenshots(prev => prev.filter((_, j) => j !== i))}
                    style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,.7)', border: 'none', color: '#fff', width: 22, height: 22, borderRadius: '50%', cursor: 'pointer', fontSize: 14 }}>
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn" onClick={onClose} style={{ color: 'var(--muted)' }}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} style={{ flex: 1 }}>Save Trade</button>
        </div>
      </div>
    </div>
  )
}
