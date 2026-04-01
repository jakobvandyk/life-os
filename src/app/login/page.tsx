'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push('/')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-desert-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        <div className="mb-8 text-center">
          <p className="font-pixel text-desert-accent text-lg tracking-tight">⚡ LIFE OS</p>
          <p className="font-mono text-desert-text-3 text-xs tracking-wider uppercase mt-1">personal dashboard</p>
        </div>

        <form onSubmit={handleLogin} className="bg-desert-surface border border-desert-border rounded-sm p-6 space-y-4 shadow-lg shadow-black/20">

          <div>
            <label className="block font-mono text-desert-text-3 text-xs uppercase tracking-widest mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
              className="w-full bg-desert-bg border border-desert-border-strong rounded-sm px-3 py-2.5 text-desert-text text-sm placeholder:text-desert-text-3 focus:outline-none focus:border-desert-accent focus:ring-1 focus:ring-desert-accent transition-colors"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block font-mono text-desert-text-3 text-xs uppercase tracking-widest mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full bg-desert-bg border border-desert-border-strong rounded-sm px-3 py-2.5 text-desert-text text-sm placeholder:text-desert-text-3 focus:outline-none focus:border-desert-accent focus:ring-1 focus:ring-desert-accent transition-colors"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="font-mono text-sm text-desert-danger bg-desert-danger-dim border border-desert-danger/30 rounded-sm px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-desert-accent hover:bg-desert-accent-glow disabled:opacity-50 disabled:cursor-not-allowed text-desert-bg text-sm font-medium rounded-sm py-3 px-6 transition-colors font-mono tracking-wide"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>

        </form>

      </div>
    </div>
  )
}
