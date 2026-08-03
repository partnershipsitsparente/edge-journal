'use client'
import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { signInWithPopup, signInWithRedirect, getRedirectResult } from 'firebase/auth'
import { auth, googleProvider } from '@/lib/firebase'
import { useStore } from '@/lib/store'

export default function LoginPage() {
  const router = useRouter()
  const { userId } = useStore()
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (userId) router.push('/dashboard')
  }, [userId, router])

  // Handle redirect result on page load (for Safari/redirect flow)
  useEffect(() => {
    getRedirectResult(auth).then(result => {
      if (result?.user) {
        router.push('/dashboard')
      }
    }).catch(console.error)
  }, [])

  // Particle animation
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    let W = canvas.width = window.innerWidth
    let H = canvas.height = window.innerHeight
    let mx = -999, my = -999
    const dots = Array.from({ length: 80 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - .5) * .5, vy: (Math.random() - .5) * .5,
      r: Math.random() * 2 + 1,
      color: Math.random() > .5 ? '155,127,255' : '0,208,132',
      opacity: Math.random() * 0.5 + 0.4
    }))
    const onMouse = (e: MouseEvent) => { mx = e.clientX; my = e.clientY }
    const onResize = () => { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight }
    window.addEventListener('mousemove', onMouse)
    window.addEventListener('resize', onResize)
    let raf: number
    function draw() {
      ctx.clearRect(0, 0, W, H)
      if (mx > 0) {
        const g = ctx.createRadialGradient(mx, my, 0, mx, my, 220)
        g.addColorStop(0, 'rgba(155,127,255,0.1)')
        g.addColorStop(1, 'rgba(155,127,255,0)')
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
      }
      dots.forEach(d => {
        const dx = mx - d.x, dy = my - d.y, dist = Math.hypot(dx, dy)
        if (dist < 200 && dist > 0) { d.vx += dx/dist*0.015; d.vy += dy/dist*0.015 }
        const sp = Math.hypot(d.vx, d.vy)
        if (sp > 1.5) { d.vx = d.vx/sp*1.5; d.vy = d.vy/sp*1.5 }
        d.x += d.vx; d.y += d.vy
        if (d.x < 0 || d.x > W) d.vx *= -1
        if (d.y < 0 || d.y > H) d.vy *= -1
        const near = dist < 150
        if (near) { ctx.shadowBlur = 8; ctx.shadowColor = `rgba(${d.color},0.8)` }
        ctx.beginPath()
        ctx.arc(d.x, d.y, near ? d.r * 1.5 : d.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${d.color},${d.opacity})`
        ctx.fill(); ctx.shadowBlur = 0
      })
      for (let i = 0; i < dots.length; i++) {
        for (let j = i + 1; j < dots.length; j++) {
          const dd = Math.hypot(dots[i].x - dots[j].x, dots[i].y - dots[j].y)
          if (dd < 130) {
            ctx.beginPath(); ctx.moveTo(dots[i].x, dots[i].y); ctx.lineTo(dots[j].x, dots[j].y)
            ctx.strokeStyle = `rgba(155,127,255,${(1 - dd/130) * 0.25})`
            ctx.lineWidth = 0.6; ctx.stroke()
          }
        }
        const cd = Math.hypot(dots[i].x - mx, dots[i].y - my)
        if (cd < 180) {
          ctx.beginPath(); ctx.moveTo(dots[i].x, dots[i].y); ctx.lineTo(mx, my)
          ctx.strokeStyle = `rgba(155,127,255,${(1 - cd/180) * 0.5})`
          ctx.lineWidth = 0.8; ctx.stroke()
        }
      }
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(raf); window.removeEventListener('mousemove', onMouse); window.removeEventListener('resize', onResize) }
  }, [])

  const signIn = async () => {
    try {
      // Try popup first (works on Chrome/Firefox)
      await signInWithPopup(auth, googleProvider)
    } catch (e: any) {
      // If popup blocked or not supported (Safari), fall back to redirect
      if (e.code === 'auth/popup-blocked' || e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request' || e.code === 'auth/operation-not-supported-in-this-environment') {
        await signInWithRedirect(auth, googleProvider)
      } else {
        console.error('Sign in error:', e)
      }
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#05050a' }}>
      <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, textAlign: 'center' }}>
        <div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 52, fontWeight: 800, letterSpacing: -2, color: '#fff' }}>
            EDGE<span style={{ color: '#7c6fcd' }}>.</span>
          </div>
          <div style={{ fontSize: 11, color: '#6b6b80', letterSpacing: '.14em', textTransform: 'uppercase', marginTop: -8 }}>
            Trading Journal
          </div>
        </div>
        <button onClick={signIn} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: '#fff', color: '#111', border: 'none', borderRadius: 14,
          padding: '15px 32px', fontSize: 15, fontWeight: 700, cursor: 'pointer',
          boxShadow: '0 4px 32px rgba(0,0,0,0.5)', transition: 'transform .15s, box-shadow .15s'
        }}
          onMouseOver={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 40px rgba(0,0,0,0.6)' }}
          onMouseOut={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 32px rgba(0,0,0,0.5)' }}
        >
          <svg width="20" height="20" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          Continue with Google
        </button>
      </div>
    </div>
  )
}
