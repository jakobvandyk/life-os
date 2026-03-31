'use client'

import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function SignOutButton() {
  const router = useRouter()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <button
      onClick={handleSignOut}
      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors font-mono"
    >
      <span>→</span>
      <span>Sign out</span>
    </button>
  )
}
