'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import AppFrame from '@/components/AppFrame'
import { useStore } from '@/lib/store'
import { periodFilter, calcPnl, getWins, getLosses, getDecided, getWinRate, getProfitFactor, getAvgRR, getBEImpact } from '@/lib/utils'
import { WidgetConfig, Trade } from '@/lib/types'
import { Chart, registerables } from 'chart.js'
Chart.register(...registerables)

// ── Widget sizes ──────────────────────────────────────────────────────────────
type WidgetSize = 'sm' | 'md' | 'lg' | 'full'
type WidgetStyle = 'table' | 'visual'

interface ExtWidgetConfig extends WidgetConfig {
  size?: WidgetSize
  style?: WidgetStyle
}

const SIZE_COLS: Record<WidgetSize, string> = {
  sm:   'span 1',
  md:   'span 1',
  lg:   'span 2',
  full: 'span 2',
}

const DEFAULT_WIDGETS: ExtWidgetConfig[] = [
  { id: 'w1', analyzeBy: 'time_of_day', title: 'Time of Day',   cols: ['trades','winrate','avgr','totalr','expectancy'], size: 'md', style: 'table' },
  { id: 'w2', analyzeBy: 'outcome',     title: 'Results',       cols: ['trades','winrate','avgr','totalr','expectancy'], size: 'md', style: 'table' },
  { id: 'w3', analyzeBy: 'weekday',     title: 'Weekday',       cols: ['trades','winrate','avgr','pnl','expectancy'],   size: 'lg', style: 'visual' },
  { id: 'w4', analyzeBy: 'tags',        title: 'Setup Tags',    cols: ['trades','winrate','avgr','totalr','expectancy'], size: 'md', style: 'table' },
  { id: 'w5', analyzeBy: 'symbol',      title: 'Symbol',        cols: ['trades','winrate','pnl','avgr','pf'],           size: 'md', style: 'table' },
  { id: 'w6', analyzeBy: 'side',        title: 'Long vs Short', cols: ['trades','winrate','avgr','totalr','expectancy'], size: 'lg', style: 'visual' },
]

// ── Data helpers ──────────────────────────────────────────────────────────────
function getWidgetRows(analyzeBy: string, trades: Trade[]) {
  const groups: Record<string, Trade[]> = {}
  trades.forEach(t => {
    let keys: string[] = []
    if (analyzeBy === 'time_of_day') {
      const time = (t.datetime || t.date || '').slice(11, 16)
      if (!time) return
      const [h, m] = time.split(':').map(Number)
      keys = [`${h}:${String(Math.floor(m / 15) * 15).padStart(2, '0')}`]
    } else if (analyzeBy === 'weekday') {
      if (!t.date) return
      const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
      keys = [days[new Date(t.date + 'T12:00:00').getDay()]]
    } else if (analyzeBy === 'month') {
      if (!t.date) return
      const months = ['January','February','March','April','May','June','July','August','September','October','November','December']
      keys = [months[new Date(t.date + 'T12:00:00').getMonth()]]
    } else if (analyzeBy === 'session') {
      const time = (t.datetime || '').slice(11, 16)
      const [h, m] = time ? time.split(':').map(Number) : [0, 0]
      const mins = h * 60 + m
      keys = [!time ? 'Unknown' : mins < 570 ? 'Pre-Market' : mins < 660 ? 'NY AM (9:30-11)' : mins < 720 ? 'Mid-Day' : 'Afternoon']
    } else if (analyzeBy === 'outcome') {
      const outcomeMap: Record<string, string> = { win: 'Win', loss: 'Loss', be_win: 'BE → Win', be_loss: 'BE → Loss' }
      keys = [outcomeMap[t.outcome] || t.outcome]
    } else if (analyzeBy === 'symbol') { keys = [t.ticker || 'Unknown']
    } else if (analyzeBy === 'side') { keys = [t.side ? t.side.charAt(0).toUpperCase() + t.side.slice(1) : 'Unknown']
    } else if (analyzeBy === 'tags') { keys = (t.tags || []).length ? t.tags! : ['Untagged']
    } else if (analyzeBy === 'mistakes') { keys = (t.mistakes || []).length ? t.mistakes! : ['None']
    } else if (analyzeBy === 'grade') { keys = [t.grade || 'Ungraded'] }
    keys.forEach(k => { if (!groups[k]) groups[k] = []; groups[k].push(t) })
  })

  const order: Record<string, string[]> = {
    weekday: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'],
    month: ['January','February','March','April','May','June','July','August','September','October','November','December'],
  }
  let sortedKeys = Object.keys(groups)
  if (order[analyzeBy]) sortedKeys.sort((a, b) => order[analyzeBy].indexOf(a) - order[analyzeBy].indexOf(b))
  else if (analyzeBy === 'time_of_day') sortedKeys.sort()
  else sortedKeys.sort((a, b) => groups[b].length - groups[a].length)

  return sortedKeys.map(key => {
    const ts = groups[key]
    const dec = ts.filter(t => t.outcome === 'win' || t.outcome === 'loss')
    const w = dec.filter(t => t.outcome === 'win')
    const l = dec.filter(t => t.outcome === 'loss')
    const wr = dec.length ? w.length / dec.length * 100 : 0
    const gW = w.reduce((s, t) => s + (t.pnl || 0), 0)
    const gL = Math.abs(l.reduce((s, t) => s + (t.pnl || 0), 0))
    const pf = gL > 0 ? gW / gL : null
    const rrTs = dec.filter(t => t.rr != null)
    const avgr = rrTs.length ? rrTs.reduce((s, t) => s + (t.rr || 0), 0) / rrTs.length : 0
    const totalr = rrTs.reduce((s, t) => s + (t.rr || 0), 0)
    const aW = w.filter(t => t.rr != null).reduce((s, t) => s + (t.rr || 0), 0) / (w.filter(t => t.rr != null).length || 1)
    const aL = l.filter(t => t.rr != null).reduce((s, t) => s + Math.abs(t.rr || 0), 0) / (l.filter(t => t.rr != null).length || 1)
    const expectancy = (wr / 100 * aW) - ((1 - wr / 100) * aL)
    const pnl = ts.reduce((s, t) => s + (t.pnl || 0), 0)
    return { label: key, trades: ts.length, winrate: wr, avgr, totalr, expectancy, pnl, pf }
  })
}

// ── Visual Widget (bar chart style) ──────────────────────────────────────────
function VisualWidget({ w, rows, onRemove, onResize, onStyleToggle }: {
  w: ExtWidgetConfig
  rows: ReturnType<typeof getWidgetRows>
  onRemove: () => void
  onResize: (size: WidgetSize) => void
  onStyleToggle: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<Chart | null>(null)

  useEffect(() => {
    if (!canvasRef.current || !rows.length) return
    if (chartRef.current) chartRef.current.destroy()
    const labels = rows.map(r => r.label)
    const pnlVals = rows.map(r => +r.pnl.toFixed(2))
    const wrVals = rows.map(r => +r.winrate.toFixed(1))
    chartRef.current = new Chart(canvasRef.current, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Net P&L', data: pnlVals, backgroundColor: pnlVals.map(v => v >= 0 ? 'rgba(0,208,132,0.7)' : 'rgba(255,77,77,0.7)'), borderRadius: 4, yAxisID: 'y' },
          { label: 'Win %', data: wrVals, type: 'line' as const, borderColor: 'rgba(124,111,205,0.8)', backgroundColor: 'transparent', borderWidth: 2, pointRadius: 4, pointBackgroundColor: 'rgba(124,111,205,0.8)', tension: 0.3, yAxisID: 'y2' },
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: true, labels: { color: '#6b6b80', font: { size: 10 }, boxWidth: 12 } },
          tooltip: { backgroundColor: '#1e1e2a', bodyColor: '#e8e8f0', titleColor: '#6b6b80' }
        },
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#6b6b80', font: { size: 10 } } },
          y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#6b6b80', font: { size: 10 }, callback: (v: any) => '$' + v }, position: 'left' },
          y2: { grid: { display: false }, ticks: { color: '#7c6fcd', font: { size: 10 }, callback: (v: any) => v + '%' }, position: 'right', min: 0, max: 100 }
        }
      }
    })
    return () => { if (chartRef.current) chartRef.current.destroy() }
  }, [rows])

  const bestRow = rows.reduce((b, r) => (!b || r.expectancy > b.expectancy) ? r : b, null as typeof rows[0] | null)

  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <WidgetHeader w={w} onRemove={onRemove} onResize={onResize} onStyleToggle={onStyleToggle} rows={rows} />
      {!rows.length ? (
        <div style={{ padding: '32px 18px', textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>No data -- log trades to see patterns</div>
      ) : (
        <>
          {/* Quick stat pills */}
          <div style={{ display: 'flex', gap: 8, padding: '10px 18px', flexWrap: 'wrap' }}>
            {rows.slice(0, 5).map(r => (
              <div key={r.label} style={{ background: 'var(--bg3)', borderRadius: 8, padding: '6px 12px', fontSize: 11 }}>
                <span style={{ fontWeight: 700, color: r.label === bestRow?.label ? 'var(--green)' : 'var(--text)' }}>
                  {r.label === bestRow?.label ? '★ ' : ''}{r.label}
                </span>
                <span style={{ color: r.winrate >= 55 ? 'var(--green)' : r.winrate < 40 ? 'var(--red)' : 'var(--muted)', marginLeft: 6, fontFamily: 'var(--mono)' }}>
                  {r.winrate.toFixed(0)}%
                </span>
                <span style={{ color: r.pnl >= 0 ? 'var(--green)' : 'var(--red)', marginLeft: 6, fontFamily: 'var(--mono)' }}>
                  {r.pnl >= 0 ? '+' : ''}${Math.abs(r.pnl).toFixed(0)}
                </span>
              </div>
            ))}
          </div>
          {/* Chart */}
          <div style={{ position: 'relative', height: 180, padding: '0 18px 14px' }}>
            <canvas ref={canvasRef} />
          </div>
        </>
      )}
    </div>
  )
}

// ── Widget Header ─────────────────────────────────────────────────────────────
function WidgetHeader({ w, onRemove, onResize, onStyleToggle, rows }: {
  w: ExtWidgetConfig
  onRemove: () => void
  onResize: (s: WidgetSize) => void
  onStyleToggle: () => void
  rows: ReturnType<typeof getWidgetRows>
}) {
  const [showMenu, setShowMenu] = useState(false)
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--border)', position: 'relative' }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700 }}>{w.title}</div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{rows.length} groups</div>
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {/* Style toggle */}
        <button onClick={onStyleToggle} title={w.style === 'table' ? 'Switch to visual' : 'Switch to table'}
          style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--muted)', padding: '4px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
          {w.style === 'table' ? '📊' : '≡'}
        </button>
        {/* Size controls */}
        <div style={{ display: 'flex', gap: 2 }}>
          {(['sm','lg'] as WidgetSize[]).map(s => (
            <button key={s} onClick={() => onResize(s === 'sm' ? (w.size === 'lg' || w.size === 'full' ? 'md' : 'lg') : (w.size === 'md' || w.size === 'sm' ? 'lg' : 'md'))}
              title={s === 'sm' ? 'Shrink' : 'Expand'}
              style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--muted)', width: 24, height: 24, borderRadius: 4, cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {s === 'sm' ? '⊟' : '⊞'}
            </button>
          ))}
        </div>
        <button onClick={onRemove} style={{ background: 'transparent', border: 'none', color: 'var(--muted)', fontSize: 18, cursor: 'pointer', padding: '2px 4px', borderRadius: 4 }}>×</button>
      </div>
    </div>
  )
}

// ── Table Widget ──────────────────────────────────────────────────────────────
function TableWidget({ w, rows, onRemove, onResize, onStyleToggle }: {
  w: ExtWidgetConfig
  rows: ReturnType<typeof getWidgetRows>
  onRemove: () => void
  onResize: (size: WidgetSize) => void
  onStyleToggle: () => void
}) {
  const colHdr: Record<string,string> = { trades:'Trades', winrate:'Win %', avgr:'Avg R', totalr:'Total R', expectancy:'Expectancy', pnl:'Net P&L', pf:'Profit Factor' }
  const maxT = Math.max(...rows.map(r => r.trades), 1)
  const bestRow = rows.reduce((b, r) => (!b || r.expectancy > b.expectancy) ? r : b, null as typeof rows[0] | null)

  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
      <WidgetHeader w={w} onRemove={onRemove} onResize={onResize} onStyleToggle={onStyleToggle} rows={rows} />
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '8px 18px', fontSize: 10, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', background: 'var(--bg3)', borderBottom: '1px solid var(--border)' }}>
              {w.analyzeBy.replace(/_/g,' ')}
            </th>
            {w.cols.map(c => (
              <th key={c} style={{ textAlign: 'right', padding: '8px 18px', fontSize: 10, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', background: 'var(--bg3)', borderBottom: '1px solid var(--border)' }}>
                {colHdr[c]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {!rows.length ? (
            <tr><td colSpan={w.cols.length+1} style={{ padding: '24px 18px', textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>No data -- log trades to see patterns</td></tr>
          ) : rows.map(r => {
            const isBest = bestRow && r.label === bestRow.label && rows.length > 1
            return (
              <tr key={r.label} style={{ background: isBest ? 'rgba(0,208,132,0.04)' : undefined }}>
                <td style={{ padding: '9px 18px', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,.03)', color: isBest ? 'var(--green)' : 'var(--text)' }}>
                  {isBest ? '★ ' : ''}{r.label}
                </td>
                {w.cols.map(c => {
                  let v: React.ReactNode = '--'
                  if (c==='trades') v = <div style={{display:'flex',alignItems:'center',gap:6,justifyContent:'flex-end'}}><span>{r.trades}</span><div style={{width:40,height:4,background:'var(--bg4)',borderRadius:2,overflow:'hidden'}}><div style={{height:'100%',width:(r.trades/maxT*100)+'%',background:'var(--accent)',borderRadius:2}} /></div></div>
                  else if (c==='winrate') v = <span style={{color:r.winrate>=55?'var(--green)':r.winrate<40?'var(--red)':'var(--text)',fontFamily:'var(--mono)',fontWeight:600}}>{r.winrate.toFixed(1)}%</span>
                  else if (c==='avgr') v = <span style={{color:r.avgr>=1?'var(--green)':r.avgr<0?'var(--red)':'var(--text)',fontFamily:'var(--mono)'}}>{r.avgr.toFixed(2)}R</span>
                  else if (c==='totalr') v = <span style={{color:r.totalr>=0?'var(--green)':'var(--red)',fontFamily:'var(--mono)'}}>{r.totalr>=0?'+':''}{r.totalr.toFixed(2)}R</span>
                  else if (c==='expectancy') v = <span style={{color:r.expectancy>=0?'var(--green)':'var(--red)',fontFamily:'var(--mono)'}}>{r.expectancy>=0?'+':''}{r.expectancy.toFixed(2)}</span>
                  else if (c==='pnl') v = <span style={{color:r.pnl>=0?'var(--green)':'var(--red)',fontFamily:'var(--mono)'}}>{r.pnl>=0?'+':''}${Math.abs(r.pnl).toFixed(0)}</span>
                  else if (c==='pf') v = <span style={{fontFamily:'var(--mono)'}}>{r.pf!=null?r.pf.toFixed(2):'--'}</span>
                  return <td key={c} style={{padding:'9px 18px',textAlign:'right',borderBottom:'1px solid rgba(255,255,255,.03)'}}>{v}</td>
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ReportsPage() {
  const { trades, widgets: storedWidgets, setWidgets } = useStore()
  const [period, setPeriod] = useState('all')
  const [showAdd, setShowAdd] = useState(false)
  const [newAnalyzeBy, setNewAnalyzeBy] = useState('time_of_day')
  const [newTitle, setNewTitle] = useState('')
  const [newCols, setNewCols] = useState(['trades','winrate','avgr','totalr','expectancy'])
  const [newSize, setNewSize] = useState<WidgetSize>('md')
  const [newStyle, setNewStyle] = useState<WidgetStyle>('table')
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const equityRef = useRef<HTMLCanvasElement>(null)
  const dailyRef = useRef<HTMLCanvasElement>(null)
  const eChart = useRef<Chart | null>(null)
  const dChart = useRef<Chart | null>(null)

  const widgets: ExtWidgetConfig[] = (storedWidgets.length ? storedWidgets : DEFAULT_WIDGETS) as ExtWidgetConfig[]
  const filtered = periodFilter(trades, period)
  const decided = getDecided(filtered)
  const wins = getWins(filtered)
  const losses = getLosses(filtered)
  const totalPnl = calcPnl(filtered)
  const wr = getWinRate(filtered)
  const pf = getProfitFactor(filtered)
  const avgRR = getAvgRR(filtered)
  const gW = wins.reduce((s,t)=>s+(t.pnl||0),0)
  const gL = Math.abs(losses.reduce((s,t)=>s+(t.pnl||0),0))
  const avgWin = wins.length ? gW/wins.length : null
  const avgLoss = losses.length ? gL/losses.length : null
  const exp = avgWin!=null&&avgLoss!=null ? (wr/100*avgWin)-((1-wr/100)*avgLoss) : null
  const byDay: Record<string,number> = {}
  filtered.forEach(t=>{const d=(t.date||'').slice(0,10);if(d)byDay[d]=(byDay[d]||0)+(t.pnl||0)})
  const dayPnls = Object.values(byDay)

  useEffect(()=>{
    if(!equityRef.current) return
    const sorted=[...filtered].sort((a,b)=>(a.date||'').localeCompare(b.date||''))
    let cum=0;const labels=['Start'];const data=[0]
    sorted.forEach(t=>{cum+=t.pnl||0;labels.push((t.date||'').slice(5));data.push(+cum.toFixed(2))})
    if(eChart.current) eChart.current.destroy()
    const isPos=(data[data.length-1]||0)>=0;const lc=isPos?'#00d084':'#ff4d4d'
    eChart.current=new Chart(equityRef.current,{
      type:'line',data:{labels,datasets:[{data,borderColor:lc,borderWidth:2,pointRadius:data.length>30?0:3,tension:0.3,fill:true,backgroundColor:(ctx:any)=>{const g=ctx.chart.ctx.createLinearGradient(0,0,0,220);g.addColorStop(0,isPos?'rgba(0,208,132,0.18)':'rgba(255,77,77,0.15)');g.addColorStop(1,'rgba(0,0,0,0)');return g}}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{backgroundColor:'#1e1e2a',bodyColor:'#e8e8f0',titleColor:'#6b6b80',callbacks:{label:(c:any)=>' $'+c.parsed.y.toFixed(2)}}},scales:{x:{grid:{color:'rgba(255,255,255,0.04)'},ticks:{color:'#6b6b80',font:{size:10},maxTicksLimit:8}},y:{grid:{color:'rgba(255,255,255,0.04)'},ticks:{color:'#6b6b80',font:{size:10},callback:(v:any)=>'$'+v}}}}
    })
  },[filtered.length,period])

  useEffect(()=>{
    if(!dailyRef.current) return
    const days=Object.keys(byDay).sort();const vals=days.map(d=>+byDay[d].toFixed(2))
    if(dChart.current) dChart.current.destroy()
    dChart.current=new Chart(dailyRef.current,{
      type:'bar',data:{labels:days.map(d=>d.slice(5)),datasets:[{data:vals,backgroundColor:vals.map(v=>v>=0?'rgba(0,208,132,0.8)':'rgba(255,77,77,0.8)'),borderRadius:3,borderSkipped:false as const}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{backgroundColor:'#1e1e2a',bodyColor:'#e8e8f0',titleColor:'#6b6b80',callbacks:{label:(c:any)=>' $'+c.parsed.y.toFixed(2)}}},scales:{x:{grid:{color:'rgba(255,255,255,0.04)'},ticks:{color:'#6b6b80',font:{size:10},maxTicksLimit:10}},y:{grid:{color:'rgba(255,255,255,0.04)'},ticks:{color:'#6b6b80',font:{size:10},callback:(v:any)=>'$'+v}}}}
    })
  },[filtered.length,period])

  const updateWidget = (id: string, changes: Partial<ExtWidgetConfig>) => {
    setWidgets(widgets.map(w => w.id === id ? {...w,...changes} : w) as WidgetConfig[])
  }
  const removeWidget = (id: string) => { if(!confirm('Remove widget?')) return; setWidgets(widgets.filter(w=>w.id!==id) as WidgetConfig[]) }

  // Drag to reorder
  const handleDragStart = (id: string) => setDragId(id)
  const handleDragOver = (e: React.DragEvent, id: string) => { e.preventDefault(); setDragOverId(id) }
  const handleDrop = (targetId: string) => {
    if (!dragId || dragId === targetId) { setDragId(null); setDragOverId(null); return }
    const arr = [...widgets]
    const from = arr.findIndex(w => w.id === dragId)
    const to = arr.findIndex(w => w.id === targetId)
    const [item] = arr.splice(from, 1)
    arr.splice(to, 0, item)
    setWidgets(arr as WidgetConfig[])
    setDragId(null); setDragOverId(null)
  }

  const addWidget = () => {
    const labelMap: Record<string,string> = { time_of_day:'Time of Day',weekday:'Weekday',month:'Month',session:'Session',outcome:'Results',symbol:'Symbol',side:'Long vs Short',tags:'Setup Tags',mistakes:'Mistakes',grade:'Trade Rating' }
    const w: ExtWidgetConfig = { id:'w'+Date.now(), analyzeBy:newAnalyzeBy, title:newTitle||labelMap[newAnalyzeBy]||newAnalyzeBy, cols:newCols.length?newCols:['trades','winrate','avgr','totalr','expectancy'], size:newSize, style:newStyle }
    setWidgets([...widgets,w] as WidgetConfig[])
    setShowAdd(false); setNewTitle('')
  }
  const toggleCol = (col:string) => setNewCols(prev=>prev.includes(col)?prev.filter(c=>c!==col):[...prev,col])

  const colHdr: Record<string,string> = { trades:'Trades',winrate:'Win %',avgr:'Avg R',totalr:'Total R',expectancy:'Expectancy',pnl:'Net P&L',pf:'Profit Factor' }

  const summaryStats = [
    {l:'Net P&L',v:(totalPnl>=0?'+':'')+'$'+Math.abs(totalPnl).toFixed(2),c:totalPnl>0?'var(--green)':totalPnl<0?'var(--red)':''},
    {l:'Trade Expectancy',v:exp!=null?(exp>=0?'+':'')+'$'+Math.abs(exp).toFixed(2):'--',c:exp!=null&&exp>=0?'var(--green)':'var(--red)'},
    {l:'Avg Trade P&L',v:filtered.length?(totalPnl>=0?'+':'')+'$'+Math.abs(totalPnl/filtered.length).toFixed(2):'--',c:totalPnl>=0?'var(--green)':'var(--red)'},
    {l:'Avg Daily P&L',v:dayPnls.length?(dayPnls.reduce((a,b)=>a+b,0)/dayPnls.length>=0?'+':'')+'$'+Math.abs(dayPnls.reduce((a,b)=>a+b,0)/dayPnls.length).toFixed(2):'--',c:''},
    {l:'Win %',v:wr.toFixed(2)+'%',c:wr>=55?'var(--green)':wr<40?'var(--red)':''},
    {l:'Avg R:R',v:avgRR!=null?avgRR.toFixed(2)+'R':'--',c:avgRR!=null&&avgRR>=1?'var(--green)':'var(--red)'},
    {l:'Avg Win',v:avgWin!=null?'+$'+avgWin.toFixed(2):'--',c:'var(--green)'},
    {l:'Avg Loss',v:avgLoss!=null?'-$'+avgLoss.toFixed(2):'--',c:'var(--red)'},
    {l:'Profit Factor',v:pf!=null?pf.toFixed(2):'--',c:pf!=null&&pf>=1.5?'var(--green)':pf!=null&&pf<1?'var(--red)':''},
    {l:'Largest Win',v:wins.length?'+$'+Math.max(...wins.map(t=>t.pnl||0)).toFixed(2):'--',c:'var(--green)'},
    {l:'Largest Loss',v:losses.length?'$'+Math.min(...losses.map(t=>t.pnl||0)).toFixed(2):'--',c:'var(--red)'},
    {l:'Max Daily DD',v:dayPnls.length?'$'+Math.min(...dayPnls).toFixed(2):'--',c:'var(--red)'},
    {l:'Total Trades',v:String(filtered.length),c:''},
    {l:'Winning Days',v:String(dayPnls.filter(p=>p>0).length),c:'var(--green)'},
    {l:'Losing Days',v:String(dayPnls.filter(p=>p<0).length),c:'var(--red)'},
    {l:'Logged Days',v:String(dayPnls.length),c:''},
  ]

  return (
    <AppFrame>
      <div className="page-fade">
        {showAdd && (
          <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setShowAdd(false)}>
            <div className="modal" style={{width:560}}>
              <div style={{fontSize:16,fontWeight:700,marginBottom:16}}>Add Widget</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:14}}>
                <div>
                  <label style={{fontSize:11,fontWeight:600,letterSpacing:'.07em',textTransform:'uppercase' as const,color:'var(--muted)',marginBottom:6,display:'block'}}>Analyze by</label>
                  <select className="form-input" value={newAnalyzeBy} onChange={e=>setNewAnalyzeBy(e.target.value)}>
                    <optgroup label="Time"><option value="time_of_day">Time of Day</option><option value="weekday">Weekday</option><option value="month">Month</option><option value="session">Session</option></optgroup>
                    <optgroup label="Performance"><option value="outcome">Results</option><option value="symbol">Symbol</option><option value="side">Long vs Short</option></optgroup>
                    <optgroup label="Trade Quality"><option value="tags">Setup Tags</option><option value="mistakes">Mistakes</option><option value="grade">Trade Rating</option></optgroup>
                  </select>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:600,letterSpacing:'.07em',textTransform:'uppercase' as const,color:'var(--muted)',marginBottom:6,display:'block'}}>Title</label>
                  <input className="form-input" value={newTitle} onChange={e=>setNewTitle(e.target.value)} placeholder="Optional custom title" />
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:14}}>
                <div>
                  <label style={{fontSize:11,fontWeight:600,letterSpacing:'.07em',textTransform:'uppercase' as const,color:'var(--muted)',marginBottom:6,display:'block'}}>Style</label>
                  <div style={{display:'flex',gap:8}}>
                    {(['table','visual'] as WidgetStyle[]).map(s=>(
                      <button key={s} onClick={()=>setNewStyle(s)} style={{flex:1,padding:'10px',borderRadius:8,cursor:'pointer',fontFamily:'inherit',border:`1px solid ${newStyle===s?'var(--accent)':'var(--border)'}`,background:newStyle===s?'rgba(124,111,205,0.1)':'var(--bg3)',color:newStyle===s?'var(--accent)':'var(--muted)',fontWeight:600,fontSize:12}}>
                        {s==='table'?'≡ Table':'📊 Visual'}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:600,letterSpacing:'.07em',textTransform:'uppercase' as const,color:'var(--muted)',marginBottom:6,display:'block'}}>Size</label>
                  <div style={{display:'flex',gap:6}}>
                    {([['md','Half'],['lg','Full']] as [WidgetSize,string][]).map(([s,l])=>(
                      <button key={s} onClick={()=>setNewSize(s)} style={{flex:1,padding:'8px',borderRadius:8,cursor:'pointer',fontFamily:'inherit',border:`1px solid ${newSize===s?'var(--accent)':'var(--border)'}`,background:newSize===s?'rgba(124,111,205,0.1)':'var(--bg3)',color:newSize===s?'var(--accent)':'var(--muted)',fontWeight:600,fontSize:12}}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div style={{marginBottom:20}}>
                <label style={{fontSize:11,fontWeight:600,letterSpacing:'.07em',textTransform:'uppercase' as const,color:'var(--muted)',marginBottom:8,display:'block'}}>Columns (table style)</label>
                <div style={{display:'flex',flexWrap:'wrap' as const,gap:6}}>
                  {Object.entries(colHdr).map(([col,lbl])=>(
                    <label key={col} onClick={()=>toggleCol(col)} style={{display:'flex',alignItems:'center',gap:5,fontSize:12,background:'var(--bg3)',border:`1px solid ${newCols.includes(col)?'var(--accent)':'var(--border)'}`,borderRadius:6,padding:'5px 10px',cursor:'pointer',color:newCols.includes(col)?'var(--accent)':'var(--text)'}}>
                      <input type="checkbox" checked={newCols.includes(col)} onChange={()=>{}} style={{accentColor:'var(--accent)'}} />{lbl}
                    </label>
                  ))}
                </div>
              </div>
              <div style={{display:'flex',gap:10}}>
                <button className="btn" onClick={()=>setShowAdd(false)} style={{color:'var(--muted)'}}>Cancel</button>
                <button className="btn btn-primary" onClick={addWidget} style={{flex:1}}>Add Widget</button>
              </div>
            </div>
          </div>
        )}

        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
          <div className="page-title">Reports</div>
          <div style={{display:'flex',gap:8}}>
            <select className="form-input" value={period} onChange={e=>setPeriod(e.target.value)} style={{width:'auto',padding:'7px 12px',fontSize:12}}>
              <option value="all">All time</option><option value="today">Today</option><option value="week">This week</option><option value="month">This month</option>
            </select>
            <button className="btn btn-primary" onClick={()=>setShowAdd(true)} style={{padding:'8px 16px',fontSize:12}}>+ Add Widget</button>
          </div>
        </div>

        {/* CHARTS */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:14}}>
          <div className="card" style={{height:280}}>
            <div style={{fontSize:11,fontWeight:700,letterSpacing:'.07em',textTransform:'uppercase',color:'var(--muted)',marginBottom:12}}>Net P&L -- Cumulative</div>
            <div style={{position:'relative',height:220}}><canvas ref={equityRef} /></div>
          </div>
          <div className="card" style={{height:280}}>
            <div style={{fontSize:11,fontWeight:700,letterSpacing:'.07em',textTransform:'uppercase',color:'var(--muted)',marginBottom:12}}>Daily P&L</div>
            <div style={{position:'relative',height:220}}><canvas ref={dailyRef} /></div>
          </div>
        </div>

        {/* SUMMARY */}
        <div className="card" style={{marginBottom:14}}>
          <div style={{fontSize:13,fontWeight:700,marginBottom:16}}>Summary</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)'}}>
            {summaryStats.map((s,i)=>(
              <div key={s.l} style={{padding:'12px 20px',borderRight:(i+1)%4===0?'none':'1px solid var(--border)',borderTop:i>=4?'1px solid var(--border)':'none'}}>
                <div style={{fontSize:10,color:'var(--muted)',marginBottom:4}}>{s.l}</div>
                <div style={{fontSize:18,fontWeight:700,fontFamily:'var(--mono)',color:s.c||'var(--text)'}}>{s.v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* BE IMPACT */}
        {(()=>{
          const bei=getBEImpact(filtered)
          if(!bei.count) return null
          const netPos=bei.net>=0
          return (
            <div className="card" style={{marginBottom:14,borderLeft:`3px solid ${netPos?'var(--green)':'var(--red)'}`}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
                <div>
                  <div style={{fontSize:13,fontWeight:700}}>BE Impact Analysis</div>
                  <div style={{fontSize:11,color:'var(--muted)',marginTop:2}}>{bei.count} BE trade{bei.count!==1?'s':''} -- excluded from Win Rate and R:R</div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:11,color:'var(--muted)'}}>Net BE Impact</div>
                  <div style={{fontSize:22,fontWeight:800,fontFamily:'var(--mono)',color:netPos?'var(--green)':'var(--red)'}}>{netPos?'+':''}{bei.net.toFixed(2)}R</div>
                  <div style={{fontSize:11,color:'var(--muted)'}}>{netPos?'BE is saving you money':'BE is costing you money'}</div>
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
                <div style={{background:'rgba(0,208,132,0.08)',borderRadius:10,padding:'14px 16px',border:'1px solid rgba(0,208,132,0.15)'}}>
                  <div style={{fontSize:10,color:'var(--muted)',marginBottom:4}}>RR SAVED (BE → Loss)</div>
                  <div style={{fontSize:20,fontWeight:700,fontFamily:'var(--mono)',color:'var(--green)'}}>+{bei.rrSaved.toFixed(2)}R</div>
                  <div style={{fontSize:11,color:'var(--muted)',marginTop:4}}>Would have been losses</div>
                </div>
                <div style={{background:'rgba(255,77,77,0.08)',borderRadius:10,padding:'14px 16px',border:'1px solid rgba(255,77,77,0.15)'}}>
                  <div style={{fontSize:10,color:'var(--muted)',marginBottom:4}}>RR MISSED (BE → Win)</div>
                  <div style={{fontSize:20,fontWeight:700,fontFamily:'var(--mono)',color:'var(--red)'}}>-{bei.rrMissed.toFixed(2)}R</div>
                  <div style={{fontSize:11,color:'var(--muted)',marginTop:4}}>Would have been wins</div>
                </div>
                <div style={{background:'var(--bg3)',borderRadius:10,padding:'14px 16px'}}>
                  <div style={{fontSize:10,color:'var(--muted)',marginBottom:8}}>BREAKDOWN</div>
                  {bei.beTrades.map(t=>(
                    <div key={t.id} style={{display:'flex',justifyContent:'space-between',fontSize:11,marginBottom:4}}>
                      <span style={{color:'var(--muted)'}}>{t.date?.slice(5)} {t.ticker}</span>
                      <span style={{fontFamily:'var(--mono)',color:t.outcome==='be_loss'?'var(--green)':'var(--red)',fontWeight:600}}>
                        {t.outcome==='be_loss'?'+':'-'}{(t.potentialRR||0).toFixed(2)}R
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        })()}

        {/* DRAG-AND-DROP WIDGET GRID */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:14}}>
          {!widgets.length ? (
            <div className="empty-state" style={{gridColumn:'1/-1'}}>
              <div style={{fontSize:36}}>📊</div>
              <div>No widgets yet</div>
              <div style={{fontSize:12}}>Click + Add Widget to build your first report</div>
            </div>
          ) : widgets.map(w => {
            const rows = getWidgetRows(w.analyzeBy, filtered)
            const size = (w as ExtWidgetConfig).size || 'md'
            const style = (w as ExtWidgetConfig).style || 'table'
            const isDragging = dragId === w.id
            const isDragOver = dragOverId === w.id
            return (
              <div
                key={w.id}
                draggable
                onDragStart={()=>handleDragStart(w.id)}
                onDragOver={e=>handleDragOver(e, w.id)}
                onDrop={()=>handleDrop(w.id)}
                onDragEnd={()=>{setDragId(null);setDragOverId(null)}}
                style={{
                  gridColumn: SIZE_COLS[size],
                  opacity: isDragging ? 0.4 : 1,
                  outline: isDragOver ? '2px solid var(--accent)' : 'none',
                  borderRadius: 12,
                  transition: 'opacity .2s, outline .15s',
                  cursor: 'grab',
                }}
              >
                {style === 'visual' ? (
                  <VisualWidget w={w as ExtWidgetConfig} rows={rows}
                    onRemove={()=>removeWidget(w.id)}
                    onResize={s=>updateWidget(w.id,{size:s})}
                    onStyleToggle={()=>updateWidget(w.id,{style:(style as string)==='table'?'visual':'table'})}
                  />
                ) : (
                  <TableWidget w={w as ExtWidgetConfig} rows={rows}
                    onRemove={()=>removeWidget(w.id)}
                    onResize={s=>updateWidget(w.id,{size:s})}
                    onStyleToggle={()=>updateWidget(w.id,{style:(style as string)==='table'?'visual':'table'})}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </AppFrame>
  )
}
