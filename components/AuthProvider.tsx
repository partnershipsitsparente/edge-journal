'use client'
import { useEffect } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useStore } from '@/lib/store'

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUserId, loadData } = useStore()

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserId(user.uid)
        await loadData(user.uid)
      } else {
        setUserId(null)
      }
    })
    return unsub
  }, [])

  return <>{children}</>
}
