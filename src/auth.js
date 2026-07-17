import { supabase } from './supabase.js'

export async function signIn(email, password) {
  return supabase.auth.signInWithPassword({ email, password })
}

export async function signUp(email, password, fullName) {
  return supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } }
  })
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
