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
      className="w-full flex items-center gap-2 px-3 py-2 rounded-sm text-[10px] text-desert-text-3 hover:text-desert-danger hover:bg-desert-danger-dim transition-colors font-pixel"
    >
      <span>→</span>
      <span>Sign out</span>
    </button>
  )
}
