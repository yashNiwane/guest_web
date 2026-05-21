import { useEffect, useState } from 'react'
import { supabase } from '../config/supabase'

export function useAnonymousAuth() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }

    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, newSession) => {
      setSession(newSession)
      setLoading(false)
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  async function ensureAnonymous() {
    if (!supabase) throw new Error('Supabase is not configured')
    if (session) return session
    const { data, error } = await supabase.auth.signInAnonymously()
    if (error) throw error
    return data.session
  }

  return { session, loading, ensureAnonymous }
}
