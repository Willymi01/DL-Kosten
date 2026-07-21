import { supabase } from './supabase.js'

export async function signIn(email, password) {
  return supabase.auth.signInWithPassword({ email, password })
}

export async function signOut() {
  return supabase.auth.signOut()
}

export async function sendReset(email) {
  const redirectTo = `${window.location.origin}${window.location.pathname}`
  return supabase.auth.resetPasswordForEmail(email, { redirectTo })
}

export async function updatePassword(password) {
  return supabase.auth.updateUser({ password })
}

export async function getSession() {
  return supabase.auth.getSession()
}

export function onAuthChange(callback) {
  return supabase.auth.onAuthStateChange(callback)
}

export async function getProfile(userId) {
  if (!userId) return { data: null, error: new Error('Die Benutzer-ID fehlt.') }

  return supabase
    .from('profiles')
    .select('id, account_id, full_name, email, role, active')
    .eq('id', userId)
    .limit(1)
    .maybeSingle()
}
