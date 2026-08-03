'use client'
import { useState } from 'react'
import AppFrame from '@/components/AppFrame'
import TradeModal from '@/components/TradeModal'
import { useStore } from '@/lib/store'
import { periodFilter, calcPnl, getWins, getLosses, getDecided, getWinRate, getProfitFactor } from '@/lib/utils'
import { Trade } from '@/lib/types'

const TAGS = ['ICT','SMC','Continuation','Mech Model','Breakout','IFVG','SIBI','BISI','OTE','FVG','Liquidity Sweep','HTF Aligned','Session Open','Reversal']
const MISTAKES = ['Early Exit','FOMO','Revenge Trade','Oversized','No Setup','Chased Entry','Ignored SL','Emotional','Late Entry','Moved Stop']

export default function TradesPage() {
  const { trades, updateTrade, deleteTrade } = useStore()
  const [showModal, setShowModal] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [period, setPeriod] = useState('all')
  const [search, setSearch] = useState('')
  const [filterOutcome, setFilterOutcome] = useState('')
  const [filterSide, setFilterSide] = useState('')
  const [lightbox, setLightbox] = useState<string | null>(null)

  let filtered = periodFilter(trades, period)
  if (search) filtered = filtered.filter(t => (t.ticker || '').toLowerCase().includes(search.toLowerCase()))
  if (filterOutcome) filtered = filtered.filter(t => t.outcome === filterOutcome)
  if (filterSide) filtered = filtered.filter(t => t.side === filterSide)

  const sorted = [...filtered].sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  const selected = selectedId ? trades.find(t => t.id === selectedId) : null

  const decided = getDecided(filtered)
  const wins = getWins(filtered)
  const losses = getLosses(filtered)
  const totalPnl = calcPnl(filtered)
  const wr = getWinRate(filtered)
  const pf = getProfitFactor(filtered)
  const grossW = wins.reduce((s, t) => s + (t.pnl || 0), 0)
  const grossL = Math.abs(losses.reduce((s, t) => s + (t.pnl || 0), 0))
  const avgWin = wins.length ? grossW / wins.length : null
  const avgLoss = losses.length ? grossL / losses.length : null

  const toggleTag = (id: string, tag: string) => {
    const t = trades.find(tr => tr.id === id)
    if (!t) return
    const tags = t.tags || []
    updateTrade(id, { tags: tags.includes(tag) ? tags.filter(x => x !== tag) : [...tags, tag] })
  }
  const toggleMistake = (id: string, m: string) => {
    const t = trades.find(tr => tr.id === id)
    if (!t) return
    const mistakes = t.mistakes || []
    updateTrade(id, { mistakes: mistakes.includes(m) ? mistakes.filter(x => x !== m) : [...mistakes, m] })
  }

  const handleSSUpload = (id: string, files: FileList | null) => {
    if (!files) return
    const t = trades.find(tr => tr.id === id)
    if (!t) return
    Array.from(files).forEach(f => {
      const r = new FileReader()
      r.onload = e => updateTrade(id, { screenshots: [...(t.screenshots || []), e.target?.result as string] })
      r.readAsDataURL(f)
    })
  }

  const deleteSSFn = (id: string, idx: number) => {
    const t = trades.find(tr => tr.id === id)
    if (!t) return
    const ss = [...(t.screenshots || [])]
    ss.splice(idx, 1)
    updateTrade(id, { screenshots: ss })
  }

  const pill: React.CSSProperties = { display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, margin: 2, cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--muted)', transition: 'all .15s' }

  return (
    <AppFrame>
      <div className="page-fade">
        {showModal && <TradeModal onClose={() => setShowModal(false)} />}
        {lightbox && (
          <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <button onClick={() => setLightbox(null)} style={{ position: 'fixed', top: 20, right: 24, background: 'transparent', border: 'none', color: '#fff', fontSize: 28, cursor: 'pointer' }}>×</button>
            <img src={lightbox} style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 8 }} />
          </div>
        )}

        {/* HEADER STATS */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
          <div className="stat-card">
            <div className="stat-label">Net Cumulative P&L · {filtered.length} trades</div>
            <div className={`stat-val ${totalPnl > 0 ? 'pos' : totalPnl < 0 ? 'neg' : ''}`} style={{ fontSize: 26 }}>
              {totalPnl >= 0 ? '+' : ''}${Math.abs(totalPnl).toFixed(2)}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Profit Factor</div>
            <div className={`stat-val ${pf != null ? (pf >= 1.5 ? 'pos' : pf < 1 ? 'neg' : '') : ''}`} style={{ fontSize: 26 }}>{pf != null ? pf.toFixed(2) : '--'}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Trade Win %</div>
            <div className={`stat-val ${wr >= 55 ? 'pos' : wr < 40 ? 'neg' : ''}`} style={{ fontSize: 26 }}>{wr.toFixed(1)}%</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>{wins.length}W / {losses.length}L</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Avg Win / Avg Loss</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
              <span className="stat-val pos" style={{ fontSize: 20 }}>{avgWin != null ? '+$' + avgWin.toFixed(0) : '--'}</span>
              <span className="stat-val neg" style={{ fontSize: 16 }}>{avgLoss != null ? '-$' + avgLoss.toFixed(0) : '--'}</span>
            </div>
          </div>
        </div>

        {/* FILTERS */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <input className="form-input" placeholder="Search ticker..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: 160, padding: '7px 12px', fontSize: 12 }} />
          <select className="form-input" value={filterOutcome} onChange={e => setFilterOutcome(e.target.value)} style={{ width: 'auto', padding: '7px 12px', fontSize: 12 }}>
            <option value="">All outcomes</option>
            <option value="win">Win</option>
            <option value="loss">Loss</option>
            <option value="be">Breakeven</option>
          </select>
          <select className="form-input" value={filterSide} onChange={e => setFilterSide(e.target.value)} style={{ width: 'auto', padding: '7px 12px', fontSize: 12 }}>
            <option value="">All sides</option>
            <option value="long">Long</option>
            <option value="short">Short</option>
          </select>
          <select className="form-input" value={period} onChange={e => setPeriod(e.target.value)} style={{ width: 'auto', padding: '7px 12px', fontSize: 12 }}>
            <option value="all">All time</option>
            <option value="today">Today</option>
            <option value="week">This week</option>
            <option value="month">This month</option>
          </select>
          <button className="btn" onClick={() => { setSearch(''); setFilterOutcome(''); setFilterSide(''); setPeriod('all') }} style={{ fontSize: 11, padding: '6px 12px', color: 'var(--muted)' }}>Clear</button>
          <button className="btn btn-primary" onClick={() => setShowModal(true)} style={{ marginLeft: 'auto', padding: '7px 16px', fontSize: 12 }}>+ Add Trade</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: selectedId ? '1fr 400px' : '1fr', gap: 12 }}>
          {/* TABLE */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="trades-table">
              <thead>
                <tr>
                  <th>Date</th><th>Symbol</th><th>Side</th><th>Status</th>
                  <th>Net P&L</th><th>R:R</th><th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {!sorted.length ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>No trades found</td></tr>
                ) : sorted.map(t => (
                  <tr key={t.id} onClick={() => setSelectedId(selectedId === t.id ? null : t.id)}
                    style={{ background: selectedId === t.id ? 'rgba(124,111,205,0.08)' : undefined }}>
                    <td style={{ color: 'var(--muted)', fontSize: 11, fontFamily: 'var(--mono)' }}>{t.date || ''}</td>
                    <td style={{ fontWeight: 700 }}>{t.ticker}</td>
                    <td><span className={`pill ${t.side}`}>{(t.side || '').toUpperCase()}</span></td>
                    <td><span className={`pill ${t.outcome}`}>{t.outcome === 'win' ? 'Win' : t.outcome === 'loss' ? 'Loss' : 'BE'}</span></td>
                    <td style={{ fontFamily: 'var(--mono)', fontWeight: 600, color: (t.pnl || 0) > 0 ? 'var(--green)' : (t.pnl || 0) < 0 ? 'var(--red)' : 'var(--muted)' }}>
                      {(t.pnl || 0) >= 0 ? '+' : ''}${Math.abs(t.pnl || 0).toFixed(2)}
                    </td>
                    <td style={{ fontFamily: 'var(--mono)', color: 'var(--muted)' }}>{t.rr != null ? t.rr.toFixed(2) + 'R' : '--'}</td>
                    <td style={{ color: 'var(--muted)', fontSize: 11, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.notes || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* DETAIL PANEL */}
          {selected && (
            <div className="card" style={{ height: 'fit-content', maxHeight: 'calc(100vh - 100px)', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{selected.ticker} · {(selected.date || '').slice(5)}</div>
                <button onClick={() => setSelectedId(null)} style={{ background: 'transparent', border: 'none', color: 'var(--muted)', fontSize: 20, cursor: 'pointer' }}>×</button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                {[
                  { l: 'Net P&L', v: (selected.pnl >= 0 ? '+' : '') + '$' + Math.abs(selected.pnl || 0).toFixed(2), c: selected.pnl > 0 ? 'var(--green)' : selected.pnl < 0 ? 'var(--red)' : 'var(--muted)' },
                  { l: 'Outcome', v: selected.outcome === 'win' ? 'Win' : selected.outcome === 'loss' ? 'Loss' : 'BE' },
                  { l: 'Side', v: (selected.side || '').toUpperCase() },
                  { l: 'R:R', v: selected.rr != null ? selected.rr.toFixed(2) + 'R' : '--' },
                ].map(s => (
                  <div key={s.l} style={{ background: 'var(--bg3)', borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 3 }}>{s.l}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--mono)', color: s.c || 'var(--text)' }}>{s.v}</div>
                  </div>
                ))}
              </div>

              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>Setup Tags</div>
                <div>{TAGS.map(tag => {
                  const active = (selected.tags || []).includes(tag)
                  return <span key={tag} onClick={() => toggleTag(selected.id, tag)} style={{ ...pill, ...(active ? { background: 'rgba(124,111,205,0.2)', borderColor: 'var(--accent)', color: 'var(--accent)' } : {}) }}>{tag}</span>
                })}</div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>Mistakes</div>
                <div>{MISTAKES.map(m => {
                  const active = (selected.mistakes || []).includes(m)
                  return <span key={m} onClick={() => toggleMistake(selected.id, m)} style={{ ...pill, border: '1px solid rgba(255,77,77,0.3)', background: 'rgba(255,77,77,0.07)', color: 'var(--red)', ...(active ? { background: 'rgba(255,77,77,0.2)' } : {}) }}>{m}</span>
                })}</div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>Notes</div>
                <textarea defaultValue={selected.notes || ''} onBlur={e => updateTrade(selected.id, { notes: e.target.value })}
                  placeholder="What happened? What did you learn?" style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', color: 'var(--text)', fontFamily: 'inherit', fontSize: 12, lineHeight: 1.6, resize: 'vertical', outline: 'none', minHeight: 80 }} />
              </div>

              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>Screenshots</div>
                <div onClick={() => document.getElementById(`ss-${selected.id}`)?.click()} style={{ border: '2px dashed var(--border)', borderRadius: 10, padding: '14px', textAlign: 'center', cursor: 'pointer', background: 'var(--bg3)', fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>📷 Click or drag to add screenshots</div>
                <input id={`ss-${selected.id}`} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => handleSSUpload(selected.id, e.target.files)} />
                {(selected.screenshots || []).length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
                    {(selected.screenshots || []).map((src, i) => (
                      <div key={i} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', aspectRatio: '16/9', background: 'var(--bg4)' }}>
                        <img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }} onClick={() => setLightbox(src)} />
                        <button onClick={() => deleteSSFn(selected.id, i)} style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,.7)', border: 'none', color: '#fff', width: 22, height: 22, borderRadius: '50%', cursor: 'pointer', fontSize: 14 }}>×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button onClick={() => { if (confirm('Delete this trade?')) { deleteTrade(selected.id); setSelectedId(null) } }}
                style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid rgba(255,77,77,0.2)', background: 'transparent', color: 'var(--red)', fontSize: 12, cursor: 'pointer', marginTop: 8 }}>
                🗑 Delete trade
              </button>
            </div>
          )}
        </div>
      </div>
    </AppFrame>
  )
}
