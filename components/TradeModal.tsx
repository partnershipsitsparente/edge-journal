'use client'
import { useState } from 'react'
import { useStore } from '@/lib/store'
import { Trade, TradeOutcome } from '@/lib/types'

interface Props { onClose: () => void }

const OUTCOMES: { value: TradeOutcome; label: string; desc: string; color: string }[] = [
  { value: 'win',      label: 'Win',        desc: 'Hit target',                       color: 'var(--green)' },
  { value: 'loss',     label: 'Loss',       desc: 'Stopped out at SL',                color: 'var(--red)' },
  { value: 'be_win',   label: 'BE \u2192 Win',  desc: 'BE stop hit, trade ran to TP', color: '#7ec8a4' },
  { value: 'be_loss',  label: 'BE \u2192 Loss', desc: 'BE stop hit, trade ran to SL', color: '#c88a7e' },
]

export default function TradeModal({ onClose }: Props) {
  const addTrade = useStore(s => s.addTrade)
  const [form, setForm] = useState({
    ticker: 'MNQ',
    date: new Date().toISOString().slice(0, 10),
    side: 'short' as 'long' | 'short',
    outcome: 'win' as TradeOutcome,
    pnl: '',
    rr: '',
    potentialRR: '',
    holdMins: '',
    notes: '',
  })
  const [screenshots, setScreenshots] = useState<string[]>([])

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))
  const isBE = form.outcome === 'be_win' || form.outcome === 'be_loss'

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
      rr: isBE ? 0 : (form.rr ? parseFloat(form.rr) : null),
      potentialRR: isBE ? (parseFloat(form.potentialRR) || 0) : null,
      notes: form.notes,
      holdMins: form.holdMins ? parseFloat(form.holdMins) : undefined,
      screenshots,
      tags: [],
      mistakes: [],
    }
    addTrade(trade)
    onClose()
  }

  const row2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }
  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6, display: 'block' }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width: 500 }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Log Trade</div>

        <div style={row2}>
          <div><label style={lbl}>Ticker</label><input className="form-input" value={form.ticker} onChange={e => set('ticker', e.target.value)} /></div>
          <div><label style={lbl}>Date</label><input className="form-input" type="date" value={form.date} onChange={e => set('date', e.target.value)} /></div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={lbl}>Side</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['long', 'short'] as const).map(s => (
              <button key={s} onClick={() => set('side', s)} style={{
                flex: 1, padding: '10px', borderRadius: 8, fontFamily: 'inherit', cursor: 'pointer',
                border: `1px solid ${form.side === s ? (s === 'long' ? 'var(--green)' : 'var(--red)') : 'var(--border)'}`,
                background: form.side === s ? (s === 'long' ? 'rgba(0,208,132,0.1)' : 'rgba(255,77,77,0.1)') : 'var(--bg3)',
                color: form.side === s ? (s === 'long' ? 'var(--green)' : 'var(--red)') : 'var(--muted)',
                fontWeight: 700, fontSize: 13, textTransform: 'uppercase'
              }}>{s}</button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={lbl}>Outcome</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {OUTCOMES.map(o => (
              <button key={o.value} onClick={() => set('outcome', o.value)} style={{
                padding: '10px 14px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
                border: `1px solid ${form.outcome === o.value ? o.color : 'var(--border)'}`,
                background: form.outcome === o.value ? `${o.color}18` : 'var(--bg3)',
                color: form.outcome === o.value ? o.color : 'var(--muted)',
                transition: 'all .15s', textAlign: 'left'
              }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{o.label}</div>
                <div style={{ fontSize: 10, opacity: .7, marginTop: 2 }}>{o.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* BE fields */}
        {isBE ? (
          <>
            <div style={{ marginBottom: 12, padding: '10px 14px', background: 'rgba(124,111,205,0.08)', borderRadius: 8, fontSize: 12, color: 'var(--muted)', borderLeft: '3px solid var(--accent)' }}>
              BE trades don't count toward Win Rate or R:R averages. Track the potential RR below to see if BE is helping or hurting you.
            </div>
            <div style={row2}>
              <div>
                <label style={lbl}>P&amp;L ($) <span style={{ color: 'var(--muted)', textTransform: 'none', letterSpacing: 0 }}>(usually ~$0)</span></label>
                <input className="form-input" type="number" step="0.01" placeholder="0.00" value={form.pnl} onChange={e => set('pnl', e.target.value)} />
              </div>
              <div>
                <label style={lbl}>
                  {form.outcome === 'be_win' ? 'Missed RR (trade ran to TP)' : 'Saved RR (would have lost)'}
                </label>
                <input className="form-input" type="number" step="0.01"
                  placeholder={form.outcome === 'be_win' ? 'e.g. 2.5R' : 'e.g. 1R'}
                  value={form.potentialRR}
                  onChange={e => set('potentialRR', e.target.value)} />
              </div>
            </div>
          </>
        ) : (
          <div style={row2}>
            <div><label style={lbl}>P&amp;L ($)</label><input className="form-input" type="number" step="0.01" placeholder="0.00" value={form.pnl} onChange={e => set('pnl', e.target.value)} /></div>
            <div><label style={lbl}>R:R</label><input className="form-input" type="number" step="0.01" placeholder="e.g. 2.0" value={form.rr} onChange={e => set('rr', e.target.value)} /></div>
          </div>
        )}

        <div style={row2}>
          <div>
            <label style={lbl}>Notes</label>
            <input className="form-input" placeholder="Quick note..." value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
          <div>
            <label style={lbl}>Hold Time (mins)</label>
            <input className="form-input" type="number" step="0.5" placeholder="e.g. 6.5" value={form.holdMins} onChange={e => set('holdMins', e.target.value)} />
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={lbl}>Screenshots</label>
          <div onClick={() => document.getElementById('ss-file-input')?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files) }}
            style={{ border: '2px dashed var(--border)', borderRadius: 10, padding: '14px', textAlign: 'center', cursor: 'pointer', background: 'var(--bg3)', fontSize: 12, color: 'var(--muted)' }}>
            📷 Click or drag to add chart screenshots
          </div>
          <input id="ss-file-input" type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => handleFiles(e.target.files)} />
          {screenshots.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8, marginTop: 10 }}>
              {screenshots.map((src, i) => (
                <div key={i} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', aspectRatio: '16/9', background: 'var(--bg4)' }}>
                  <img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                  <button onClick={() => setScreenshots(prev => prev.filter((_, j) => j !== i))}
                    style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,.7)', border: 'none', color: '#fff', width: 22, height: 22, borderRadius: '50%', cursor: 'pointer', fontSize: 14 }}>×</button>
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
