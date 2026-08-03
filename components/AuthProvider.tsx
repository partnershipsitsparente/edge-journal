'use client'
import { useEffect } from 'react'
import { onAuthStateChanged, getRedirectResult } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useStore } from '@/lib/store'

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUserId, loadData } = useStore()

  useEffect(() => {
    // Handle redirect result first (Safari/redirect flow)
    getRedirectResult(auth).then(result => {
      if (result?.user) {
        setUserId(result.user.uid)
        loadData(result.user.uid)
      }
    }).catch(console.error)

    // Then listen for auth state changes (covers popup flow and existing sessions)
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
