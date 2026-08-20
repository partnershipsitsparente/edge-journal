'use client'
import { useState, useEffect, useRef } from 'react'
import AppFrame from '@/components/AppFrame'
import { useStore } from '@/lib/store'
import { periodFilter, calcPnl, getWins, getLosses, getDecided, getWinRate, getProfitFactor, getAvgRR, getBEImpact } from '@/lib/utils'
import { Trade } from '@/lib/types'
import { Chart, registerables } from 'chart.js'
Chart.register(...registerables)

type ViewMode = 'table' | 'bar' | 'donut'

// ── Data helpers ──────────────────────────────────────────────────────────────
function getRows(analyzeBy: string, trades: Trade[]) {
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
      const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
      keys = [days[new Date(t.date + 'T12:00:00').getDay()]]
    } else if (analyzeBy === 'session') {
      const time = (t.datetime || '').slice(11, 16)
      if (!time) { keys = ['Unknown'] } else {
        const [h, m] = time.split(':').map(Number)
        const mins = h * 60 + m
        keys = [mins < 570 ? 'Pre-Market' : mins < 660 ? 'NY AM (9:30)' : mins < 720 ? 'Mid-Day' : 'Afternoon']
      }
    } else if (analyzeBy === 'symbol') { keys = [t.ticker || 'Unknown']
    } else if (analyzeBy === 'side') { keys = [t.side === 'long' ? 'Long' : 'Short']
    } else if (analyzeBy === 'tags') { keys = (t.tags || []).length ? t.tags! : ['Untagged']
    } else if (analyzeBy === 'mistakes') { keys = (t.mistakes || []).length ? t.mistakes! : ['None']
    } else if (analyzeBy === 'outcome') {
      const map: Record<string,string> = { win:'Win', loss:'Loss', be_win:'BE → Win', be_loss:'BE → Loss' }
      keys = [map[t.outcome] || t.outcome]
    }
    keys.forEach(k => { if (!groups[k]) groups[k] = []; groups[k].push(t) })
  })

  const order: Record<string, string[]> = {
    weekday: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
  }
  let keys = Object.keys(groups)
  if (order[analyzeBy]) keys.sort((a,b) => order[analyzeBy].indexOf(a) - order[analyzeBy].indexOf(b))
  else if (analyzeBy === 'time_of_day') keys.sort()
  else keys.sort((a,b) => groups[b].length - groups[a].length)

  return keys.map(key => {
    const ts = groups[key]
    const dec = ts.filter(t => t.outcome==='win'||t.outcome==='loss')
    const w = dec.filter(t => t.outcome==='win')
    const l = dec.filter(t => t.outcome==='loss')
    const wr = dec.length ? w.length/dec.length*100 : 0
    const gW = w.reduce((s,t)=>s+(t.pnl||0),0)
    const gL = Math.abs(l.reduce((s,t)=>s+(t.pnl||0),0))
    const pf = gL > 0 ? gW/gL : null
    const rrTs = dec.filter(t=>t.rr!=null)
    const avgr = rrTs.length ? rrTs.reduce((s,t)=>s+(t.rr||0),0)/rrTs.length : 0
    const totalr = rrTs.reduce((s,t)=>s+(t.rr||0),0)
    const aW = w.filter(t=>t.rr!=null).reduce((s,t)=>s+(t.rr||0),0)/(w.filter(t=>t.rr!=null).length||1)
    const aL = l.filter(t=>t.rr!=null).reduce((s,t)=>s+Math.abs(t.rr||0),0)/(l.filter(t=>t.rr!=null).length||1)
    const exp = (wr/100*aW)-((1-wr/100)*aL)
    const pnl = ts.reduce((s,t)=>s+(t.pnl||0),0)
    return { label:key, trades:ts.length, winrate:wr, avgr, totalr, exp, pnl, pf }
  })
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ title, subtitle, view, setView, views = ['table','bar','donut'], children }: {
  title: string; subtitle?: string
  view: ViewMode; setView: (v: ViewMode) => void
  views?: ViewMode[]; children: React.ReactNode
}) {
  const icons: Record<ViewMode, string> = { table:'≡', bar:'▬', donut:'◎' }
  const labels: Record<ViewMode, string> = { table:'Table', bar:'Bar', donut:'Donut' }
  return (
    <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', borderBottom:'1px solid var(--border)' }}>
        <div>
          <div style={{ fontSize:14, fontWeight:700, color:'var(--text)' }}>{title}</div>
          {subtitle && <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>{subtitle}</div>}
        </div>
        {views.length > 1 && (
          <div style={{ display:'flex', background:'var(--bg3)', borderRadius:8, padding:3, gap:2 }}>
            {views.map(v => (
              <button key={v} onClick={() => setView(v)} title={labels[v]} style={{
                padding:'5px 10px', borderRadius:6, border:'none', cursor:'pointer',
                fontFamily:'inherit', fontSize:13, fontWeight:600, transition:'all .15s',
                background: view===v ? 'var(--bg5)' : 'transparent',
                color: view===v ? 'var(--text)' : 'var(--muted)',
                boxShadow: view===v ? '0 1px 4px rgba(0,0,0,0.3)' : 'none',
              }}>{icons[v]}</button>
            ))}
          </div>
        )}
      </div>
      <div>{children}</div>
    </div>
  )
}

// ── Table view ────────────────────────────────────────────────────────────────
function TableView({ rows, cols }: { rows: ReturnType<typeof getRows>; cols: string[] }) {
  const colCfg: Record<string,{label:string;align:string}> = {
    trades:   { label:'Trades',  align:'right' },
    winrate:  { label:'Win %',   align:'right' },
    pnl:      { label:'Net P&L', align:'right' },
    avgr:     { label:'Avg R',   align:'right' },
    totalr:   { label:'Total R', align:'right' },
    exp:      { label:'Expect.', align:'right' },
    pf:       { label:'PF',      align:'right' },
  }
  const maxT = Math.max(...rows.map(r=>r.trades), 1)
  const best = rows.length > 1 ? rows.reduce((b,r) => r.exp > b.exp ? r : b) : null
  if (!rows.length) return <div style={{ padding:'32px', textAlign:'center', color:'var(--muted)', fontSize:13 }}>No data for this period</div>
  return (
    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
      <thead>
        <tr>
          <th style={{ textAlign:'left', padding:'10px 20px', fontSize:11, fontWeight:600, letterSpacing:'.06em', textTransform:'uppercase', color:'var(--muted)', background:'var(--bg3)', borderBottom:'1px solid var(--border)' }}>Group</th>
          {cols.map(c => (
            <th key={c} style={{ textAlign:'right', padding:'10px 20px', fontSize:11, fontWeight:600, letterSpacing:'.06em', textTransform:'uppercase', color:'var(--muted)', background:'var(--bg3)', borderBottom:'1px solid var(--border)', whiteSpace:'nowrap' }}>
              {colCfg[c]?.label || c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map(r => {
          const isBest = best && r.label === best.label
          return (
            <tr key={r.label} style={{ background: isBest ? 'rgba(34,197,94,0.04)' : undefined }}>
              <td style={{ padding:'11px 20px', fontWeight:600, borderBottom:'1px solid rgba(255,255,255,.04)', color: isBest ? 'var(--green)' : 'var(--text)' }}>
                {isBest && <span style={{ color:'var(--amber)', marginRight:5 }}>★</span>}{r.label}
              </td>
              {cols.map(c => {
                let node: React.ReactNode = '--'
                if (c==='trades') node = (
                  <div style={{ display:'flex', alignItems:'center', gap:8, justifyContent:'flex-end' }}>
                    <span style={{ fontFamily:'var(--mono)' }}>{r.trades}</span>
                    <div style={{ width:48, height:4, background:'var(--bg4)', borderRadius:2, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:(r.trades/maxT*100)+'%', background:'var(--accent)', borderRadius:2 }} />
                    </div>
                  </div>
                )
                else if (c==='winrate') node = <span style={{ fontFamily:'var(--mono)', fontWeight:600, color: r.winrate>=55?'var(--green)':r.winrate<40?'var(--red)':'var(--text2)' }}>{r.winrate.toFixed(1)}%</span>
                else if (c==='pnl') node = <span style={{ fontFamily:'var(--mono)', fontWeight:600, color: r.pnl>=0?'var(--green)':'var(--red)' }}>{r.pnl>=0?'+':''}${Math.abs(r.pnl).toFixed(0)}</span>
                else if (c==='avgr') node = <span style={{ fontFamily:'var(--mono)', color: r.avgr>=1?'var(--green)':r.avgr<0?'var(--red)':'var(--text2)' }}>{r.avgr.toFixed(2)}R</span>
                else if (c==='totalr') node = <span style={{ fontFamily:'var(--mono)', color: r.totalr>=0?'var(--green)':'var(--red)' }}>{r.totalr>=0?'+':''}{r.totalr.toFixed(2)}R</span>
                else if (c==='exp') node = <span style={{ fontFamily:'var(--mono)', color: r.exp>=0?'var(--green)':'var(--red)' }}>{r.exp>=0?'+':''}{r.exp.toFixed(2)}</span>
                else if (c==='pf') node = <span style={{ fontFamily:'var(--mono)' }}>{r.pf!=null?r.pf.toFixed(2):'--'}</span>
                return <td key={c} style={{ padding:'11px 20px', textAlign:'right', borderBottom:'1px solid rgba(255,255,255,.04)' }}>{node}</td>
              })}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

// ── Bar view ──────────────────────────────────────────────────────────────────
function BarView({ rows }: { rows: ReturnType<typeof getRows> }) {
  if (!rows.length) return <div style={{ padding:'32px', textAlign:'center', color:'var(--muted)', fontSize:13 }}>No data for this period</div>
  const max = Math.max(...rows.map(r => Math.abs(r.pnl)), 1)
  const best = rows.length > 1 ? rows.reduce((b,r) => r.exp > b.exp ? r : b) : null
  return (
    <div style={{ padding:'18px 20px 10px' }}>
      {rows.map(r => {
        const isBest = best && r.label === best.label
        const pct = Math.abs(r.pnl) / max * 100
        const isPos = r.pnl >= 0
        return (
          <div key={r.label} style={{ marginBottom:16 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                {isBest && <span style={{ color:'var(--amber)', fontSize:13 }}>★</span>}
                <span style={{ fontSize:13, fontWeight:600, color: isBest ? 'var(--text)' : 'var(--text2)' }}>{r.label}</span>
                <span style={{ fontSize:11, color:'var(--muted)', background:'var(--bg3)', padding:'2px 7px', borderRadius:4, fontFamily:'var(--mono)' }}>{r.trades}</span>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                <span style={{ fontSize:12, fontFamily:'var(--mono)', fontWeight:600, color: r.winrate>=55?'var(--green)':r.winrate<40?'var(--red)':'var(--muted)' }}>{r.winrate.toFixed(0)}% WR</span>
                <span style={{ fontSize:13, fontFamily:'var(--mono)', fontWeight:700, color: isPos?'var(--green)':'var(--red)', minWidth:72, textAlign:'right' }}>
                  {isPos?'+':''}${Math.abs(r.pnl).toFixed(0)}
                </span>
              </div>
            </div>
            <div style={{ height:8, background:'var(--bg4)', borderRadius:4, overflow:'hidden' }}>
              <div style={{ height:'100%', width:`${pct}%`, borderRadius:4, transition:'width .5s cubic-bezier(.16,1,.3,1)',
                background: isPos ? 'linear-gradient(90deg, var(--green2), var(--green))' : 'linear-gradient(90deg, var(--red2), var(--red))',
                boxShadow: isPos ? '0 0 8px rgba(34,197,94,0.4)' : '0 0 8px rgba(239,68,68,0.4)'
              }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Donut view ────────────────────────────────────────────────────────────────
function DonutView({ rows, metric = 'trades' }: { rows: ReturnType<typeof getRows>; metric?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<Chart|null>(null)
  const PALETTE = ['#22c55e','#ef4444','#6c63ff','#f59e0b','#3b82f6','#ec4899','#14b8a6','#f97316']

  useEffect(() => {
    if (!canvasRef.current || !rows.length) return
    if (chartRef.current) chartRef.current.destroy()
    const vals = rows.map(r => metric === 'pnl' ? Math.abs(r.pnl) : r.trades)
    chartRef.current = new Chart(canvasRef.current, {
      type: 'doughnut',
      data: { labels: rows.map(r=>r.label), datasets: [{ data: vals, backgroundColor: rows.map((_,i) => PALETTE[i%PALETTE.length]), borderWidth:0, hoverBorderWidth:0 }] },
      options: { responsive:true, maintainAspectRatio:false, cutout:'70%',
        plugins: { legend:{display:false}, tooltip:{ backgroundColor:'#1e1e2a', bodyColor:'#e8e8f0', titleColor:'#7878a0',
          callbacks:{ label:(c:any) => ` ${c.label}: ${metric==='pnl'?'$'+Math.abs(rows[c.dataIndex].pnl).toFixed(0):c.parsed+' trades'}` }
        }}
      }
    })
    return () => { if (chartRef.current) chartRef.current.destroy() }
  }, [rows, metric])

  const total = rows.reduce((s,r) => s + (metric==='pnl'?Math.abs(r.pnl):r.trades), 0)

  if (!rows.length) return <div style={{ padding:'32px', textAlign:'center', color:'var(--muted)', fontSize:13 }}>No data for this period</div>

  return (
    <div style={{ display:'grid', gridTemplateColumns:'200px 1fr', gap:0, padding:'20px' }}>
      <div style={{ position:'relative', height:180, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <canvas ref={canvasRef} />
        <div style={{ position:'absolute', textAlign:'center', pointerEvents:'none' }}>
          <div style={{ fontSize:20, fontWeight:800, fontFamily:'var(--mono)', color:'var(--text)' }}>
            {metric === 'pnl' ? '$' + Math.abs(total).toFixed(0) : total}
          </div>
          <div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.06em' }}>
            {metric === 'pnl' ? 'Total P&L' : 'Total Trades'}
          </div>
        </div>
      </div>
      <div style={{ display:'flex', flexDirection:'column', justifyContent:'center', gap:8, padding:'0 8px' }}>
        {rows.slice(0,8).map((r,i) => {
          const val = metric === 'pnl' ? Math.abs(r.pnl) : r.trades
          const pct = total > 0 ? (val/total*100).toFixed(0) : '0'
          return (
            <div key={r.label} style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ width:8, height:8, borderRadius:2, background:PALETTE[i%PALETTE.length], flexShrink:0 }} />
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:12, fontWeight:600, color:'var(--text2)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.label}</span>
                  <span style={{ fontSize:11, color:'var(--muted)', fontFamily:'var(--mono)', flexShrink:0 }}>{pct}%</span>
                </div>
                <div style={{ height:3, background:'var(--bg4)', borderRadius:2, marginTop:3, overflow:'hidden' }}>
                  <div style={{ height:'100%', width:pct+'%', background:PALETTE[i%PALETTE.length], borderRadius:2, opacity:.7 }} />
                </div>
              </div>
              <span style={{ fontSize:12, fontFamily:'var(--mono)', fontWeight:600, color: r.pnl>=0?'var(--green)':'var(--red)', flexShrink:0, minWidth:50, textAlign:'right' }}>
                {r.pnl>=0?'+':''}${Math.abs(r.pnl).toFixed(0)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function ReportsPage() {
  const { trades } = useStore()
  const [period, setPeriod] = useState('all')

  // View modes per section
  const [v1, sv1] = useState<ViewMode>('bar')   // Time of Day
  const [v2, sv2] = useState<ViewMode>('donut') // Results
  const [v3, sv3] = useState<ViewMode>('bar')   // Weekday
  const [v4, sv4] = useState<ViewMode>('bar')   // Setup Tags
  const [v5, sv5] = useState<ViewMode>('table') // Symbol
  const [v6, sv6] = useState<ViewMode>('donut') // Long vs Short
  const [v7, sv7] = useState<ViewMode>('bar')   // Mistakes

  const equityRef = useRef<HTMLCanvasElement>(null)
  const dailyRef  = useRef<HTMLCanvasElement>(null)
  const donutRef  = useRef<HTMLCanvasElement>(null)
  const eChart = useRef<Chart|null>(null)
  const dChart = useRef<Chart|null>(null)
  const donutChart = useRef<Chart|null>(null)

  const filtered = periodFilter(trades, period)
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

  // Equity chart
  useEffect(()=>{
    if(!equityRef.current) return
    const sorted=[...filtered].sort((a,b)=>(a.date||'').localeCompare(b.date||''))
    let cum=0;const labels=['Start'];const data=[0]
    sorted.forEach(t=>{cum+=t.pnl||0;labels.push((t.date||'').slice(5));data.push(+cum.toFixed(2))})
    if(eChart.current) eChart.current.destroy()
    const isPos=(data[data.length-1]||0)>=0;const lc=isPos?'#22c55e':'#ef4444'
    eChart.current=new Chart(equityRef.current,{
      type:'line',data:{labels,datasets:[{data,borderColor:lc,borderWidth:2.5,pointRadius:data.length>30?0:4,pointBackgroundColor:lc,tension:0.4,fill:true,
        backgroundColor:(ctx:any)=>{const g=ctx.chart.ctx.createLinearGradient(0,0,0,200);g.addColorStop(0,isPos?'rgba(34,197,94,0.2)':'rgba(239,68,68,0.18)');g.addColorStop(1,'rgba(0,0,0,0)');return g}}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{backgroundColor:'#1e1e28',bodyColor:'#f0f0f8',titleColor:'#7878a0',callbacks:{label:(c:any)=>' $'+c.parsed.y.toFixed(2)}}},
        scales:{x:{grid:{color:'rgba(255,255,255,0.04)'},ticks:{color:'#7878a0',font:{size:10},maxTicksLimit:8}},y:{grid:{color:'rgba(255,255,255,0.04)'},ticks:{color:'#7878a0',font:{size:10},callback:(v:any)=>'$'+v}}}}
    })
  },[filtered.length,period])

  // Daily bar
  useEffect(()=>{
    if(!dailyRef.current) return
    const days=Object.keys(byDay).sort();const vals=days.map(d=>+byDay[d].toFixed(2))
    if(dChart.current) dChart.current.destroy()
    dChart.current=new Chart(dailyRef.current,{
      type:'bar',data:{labels:days.map(d=>d.slice(5)),datasets:[{data:vals,backgroundColor:vals.map(v=>v>=0?'rgba(34,197,94,0.75)':'rgba(239,68,68,0.75)'),borderRadius:4,borderSkipped:false as const}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{backgroundColor:'#1e1e28',bodyColor:'#f0f0f8',titleColor:'#7878a0',callbacks:{label:(c:any)=>' $'+c.parsed.y.toFixed(2)}}},
        scales:{x:{grid:{color:'rgba(255,255,255,0.04)'},ticks:{color:'#7878a0',font:{size:10},maxTicksLimit:10}},y:{grid:{color:'rgba(255,255,255,0.04)'},ticks:{color:'#7878a0',font:{size:10},callback:(v:any)=>'$'+v}}}}
    })
  },[filtered.length,period])

  // Win rate donut
  useEffect(()=>{
    if(!donutRef.current) return
    if(donutChart.current) donutChart.current.destroy()
    donutChart.current=new Chart(donutRef.current,{
      type:'doughnut',
      data:{labels:['Wins','Losses'],datasets:[{data:[wins.length,losses.length||0.001],backgroundColor:['#22c55e','#ef4444'],borderWidth:0}]},
      options:{responsive:true,maintainAspectRatio:false,cutout:'74%',plugins:{legend:{display:false},tooltip:{enabled:false}}}
    })
  },[wins.length,losses.length])

  const summaryStats=[
    {l:'Net P&L',         v:(totalPnl>=0?'+':'')+'$'+Math.abs(totalPnl).toFixed(2),      c:totalPnl>0?'var(--green)':totalPnl<0?'var(--red)':''},
    {l:'Expectancy',      v:exp!=null?(exp>=0?'+':'')+'$'+Math.abs(exp).toFixed(2):'--',  c:exp!=null&&exp>=0?'var(--green)':'var(--red)'},
    {l:'Win %',           v:wr.toFixed(2)+'%',                                             c:wr>=55?'var(--green)':wr<40?'var(--red)':''},
    {l:'Profit Factor',   v:pf!=null?pf.toFixed(2):'--',                                  c:pf!=null&&pf>=1.5?'var(--green)':pf!=null&&pf<1?'var(--red)':''},
    {l:'Avg R:R',         v:avgRR!=null?avgRR.toFixed(2)+'R':'--',                         c:avgRR!=null&&avgRR>=1?'var(--green)':'var(--red)'},
    {l:'Avg Win',         v:avgWin!=null?'+$'+avgWin.toFixed(2):'--',                      c:'var(--green)'},
    {l:'Avg Loss',        v:avgLoss!=null?'-$'+avgLoss.toFixed(2):'--',                    c:'var(--red)'},
    {l:'Total Trades',    v:String(filtered.length),                                        c:''},
    {l:'Winning Days',    v:String(dayPnls.filter(p=>p>0).length),                          c:'var(--green)'},
    {l:'Losing Days',     v:String(dayPnls.filter(p=>p<0).length),                          c:'var(--red)'},
    {l:'Largest Win',     v:wins.length?'+$'+Math.max(...wins.map(t=>t.pnl||0)).toFixed(2):'--', c:'var(--green)'},
    {l:'Largest Loss',    v:losses.length?'$'+Math.min(...losses.map(t=>t.pnl||0)).toFixed(2):'--', c:'var(--red)'},
  ]

  const cols = ['trades','winrate','pnl','avgr','exp']

  return (
    <AppFrame>
      <div className="page-fade">
        {/* HEADER */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24}}>
          <div>
            <div className="page-title">Reports</div>
            <div style={{fontSize:13,color:'var(--muted)',marginTop:2}}>Deep analytics across all your trades</div>
          </div>
          <select className="form-input" value={period} onChange={e=>setPeriod(e.target.value)} style={{width:'auto',padding:'8px 14px',fontSize:13}}>
            <option value="all">All time</option>
            <option value="today">Today</option>
            <option value="week">This week</option>
            <option value="month">This month</option>
          </select>
        </div>

        {/* TOP CHARTS */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 240px',gap:14,marginBottom:14}}>
          <div className="card" style={{padding:'18px 20px 14px'}}>
            <div style={{fontSize:11,fontWeight:600,letterSpacing:'.06em',textTransform:'uppercase',color:'var(--muted)',marginBottom:12}}>Cumulative P&L</div>
            <div style={{position:'relative',height:190}}><canvas ref={equityRef} /></div>
          </div>
          <div className="card" style={{padding:'18px 20px 14px'}}>
            <div style={{fontSize:11,fontWeight:600,letterSpacing:'.06em',textTransform:'uppercase',color:'var(--muted)',marginBottom:12}}>Daily P&L</div>
            <div style={{position:'relative',height:190}}><canvas ref={dailyRef} /></div>
          </div>
          <div className="card" style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:14,padding:20}}>
            <div style={{position:'relative',width:130,height:130}}>
              <canvas ref={donutRef} />
              <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',pointerEvents:'none'}}>
                <div style={{fontSize:22,fontWeight:800,fontFamily:'var(--mono)',color:wr>=55?'var(--green)':wr<40?'var(--red)':'var(--text)'}}>{wr.toFixed(1)}%</div>
                <div style={{fontSize:10,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'.06em'}}>Win Rate</div>
              </div>
            </div>
            <div style={{display:'flex',gap:20}}>
              <div style={{textAlign:'center'}}>
                <div style={{fontSize:20,fontWeight:800,fontFamily:'var(--mono)',color:'var(--green)'}}>{wins.length}</div>
                <div style={{fontSize:11,color:'var(--muted)'}}>Wins</div>
              </div>
              <div style={{textAlign:'center'}}>
                <div style={{fontSize:20,fontWeight:800,fontFamily:'var(--mono)',color:'var(--red)'}}>{losses.length}</div>
                <div style={{fontSize:11,color:'var(--muted)'}}>Losses</div>
              </div>
            </div>
          </div>
        </div>

        {/* SUMMARY STATS */}
        <div className="card" style={{padding:0,marginBottom:14,overflow:'hidden'}}>
          <div style={{padding:'14px 20px',borderBottom:'1px solid var(--border)'}}>
            <div style={{fontSize:14,fontWeight:700}}>Summary</div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)'}}>
            {summaryStats.map((s,i)=>(
              <div key={s.l} style={{padding:'14px 18px',borderRight:(i+1)%6===0?'none':'1px solid var(--border)',borderTop:i>=6?'1px solid var(--border)':'none'}}>
                <div style={{fontSize:11,color:'var(--muted)',marginBottom:5,whiteSpace:'nowrap'}}>{s.l}</div>
                <div style={{fontSize:17,fontWeight:700,fontFamily:'var(--mono)',color:s.c||'var(--text)',letterSpacing:'-0.3px'}}>{s.v}</div>
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
                  <div style={{fontSize:14,fontWeight:700}}>BE Impact</div>
                  <div style={{fontSize:12,color:'var(--muted)',marginTop:2}}>{bei.count} BE trades · excluded from Win Rate & R:R</div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:11,color:'var(--muted)'}}>Net Impact</div>
                  <div style={{fontSize:24,fontWeight:800,fontFamily:'var(--mono)',color:netPos?'var(--green)':'var(--red)',letterSpacing:'-0.5px'}}>{netPos?'+':''}{bei.net.toFixed(2)}R</div>
                  <div style={{fontSize:11,color:'var(--muted)'}}>{netPos?'Saving you money':'Costing you money'}</div>
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
                <div style={{background:'rgba(34,197,94,0.07)',borderRadius:10,padding:'14px 16px',border:'1px solid rgba(34,197,94,0.15)'}}>
                  <div style={{fontSize:10,color:'var(--muted)',marginBottom:5,letterSpacing:'.06em',textTransform:'uppercase'}}>RR Saved (BE→Loss)</div>
                  <div style={{fontSize:22,fontWeight:700,fontFamily:'var(--mono)',color:'var(--green)'}}>+{bei.rrSaved.toFixed(2)}R</div>
                  <div style={{fontSize:11,color:'var(--muted)',marginTop:4}}>Would have been losses</div>
                </div>
                <div style={{background:'rgba(239,68,68,0.07)',borderRadius:10,padding:'14px 16px',border:'1px solid rgba(239,68,68,0.15)'}}>
                  <div style={{fontSize:10,color:'var(--muted)',marginBottom:5,letterSpacing:'.06em',textTransform:'uppercase'}}>RR Missed (BE→Win)</div>
                  <div style={{fontSize:22,fontWeight:700,fontFamily:'var(--mono)',color:'var(--red)'}}>-{bei.rrMissed.toFixed(2)}R</div>
                  <div style={{fontSize:11,color:'var(--muted)',marginTop:4}}>Would have been wins</div>
                </div>
                <div style={{background:'var(--bg3)',borderRadius:10,padding:'14px 16px'}}>
                  <div style={{fontSize:10,color:'var(--muted)',marginBottom:10,letterSpacing:'.06em',textTransform:'uppercase'}}>Per Trade</div>
                  {bei.beTrades.map(t=>(
                    <div key={t.id} style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:5}}>
                      <span style={{color:'var(--muted)'}}>{t.date?.slice(5)} {t.ticker}</span>
                      <span style={{fontFamily:'var(--mono)',fontWeight:600,color:t.outcome==='be_loss'?'var(--green)':'var(--red)'}}>
                        {t.outcome==='be_loss'?'+':'-'}{(t.potentialRR||0).toFixed(2)}R
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        })()}

        {/* ANALYTICS SECTIONS - 2 col grid */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>

          <Section title="Time of Day" subtitle="Performance by entry time" view={v1} setView={sv1} views={['bar','table']}>
            {v1==='bar' ? <BarView rows={getRows('time_of_day',filtered)} /> : <TableView rows={getRows('time_of_day',filtered)} cols={cols} />}
          </Section>

          <Section title="Results Breakdown" subtitle="Win / Loss / BE distribution" view={v2} setView={sv2} views={['donut','bar','table']}>
            {v2==='donut' ? <DonutView rows={getRows('outcome',filtered)} /> : v2==='bar' ? <BarView rows={getRows('outcome',filtered)} /> : <TableView rows={getRows('outcome',filtered)} cols={cols} />}
          </Section>

          <Section title="Weekday" subtitle="Performance by day of week" view={v3} setView={sv3} views={['bar','table']}>
            {v3==='bar' ? <BarView rows={getRows('weekday',filtered)} /> : <TableView rows={getRows('weekday',filtered)} cols={cols} />}
          </Section>

          <Section title="Setup Tags" subtitle="Performance by your tagged setups" view={v4} setView={sv4} views={['bar','table']}>
            {v4==='bar' ? <BarView rows={getRows('tags',filtered)} /> : <TableView rows={getRows('tags',filtered)} cols={cols} />}
          </Section>

          <Section title="Symbol" subtitle="Performance by instrument" view={v5} setView={sv5} views={['table','bar','donut']}>
            {v5==='table' ? <TableView rows={getRows('symbol',filtered)} cols={['trades','winrate','pnl','avgr','pf']} /> : v5==='bar' ? <BarView rows={getRows('symbol',filtered)} /> : <DonutView rows={getRows('symbol',filtered)} />}
          </Section>

          <Section title="Long vs Short" subtitle="Trade direction analysis" view={v6} setView={sv6} views={['donut','bar','table']}>
            {v6==='donut' ? <DonutView rows={getRows('side',filtered)} /> : v6==='bar' ? <BarView rows={getRows('side',filtered)} /> : <TableView rows={getRows('side',filtered)} cols={cols} />}
          </Section>

          <Section title="Session" subtitle="Performance by trading session" view={v7} setView={sv7} views={['bar','table']}>
            {v7==='bar' ? <BarView rows={getRows('session',filtered)} /> : <TableView rows={getRows('session',filtered)} cols={cols} />}
          </Section>

          <Section title="Mistakes" subtitle="Your most costly errors" view={v6} setView={sv6} views={['bar','table']}>
            {v6==='bar' ? <BarView rows={getRows('mistakes',filtered)} /> : <TableView rows={getRows('mistakes',filtered)} cols={cols} />}
          </Section>

        </div>
      </div>
    </AppFrame>
  )
}
