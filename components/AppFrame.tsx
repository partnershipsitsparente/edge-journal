'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useStore } from '@/lib/store'
import NavBar from './NavBar'

export default function AppFrame({ children }: { children: React.ReactNode }) {
  const { userId, loaded } = useStore()
  const router = useRouter()

  useEffect(() => {
    if (loaded && !userId) {
      router.push('/')
    }
  }, [userId, loaded, router])

  if (!loaded) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: 'var(--bg)', color: 'var(--muted)', fontSize: 14
      }}>
        Loading...
      </div>
    )
  }

  if (!userId) return null

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <NavBar />
      <main style={{
        flex: 1, height: '100vh', overflowY: 'auto', overflowX: 'hidden',
        background: 'var(--bg)', padding: '28px 32px'
      }}>
        {children}
      </main>
    </div>
  )
}
