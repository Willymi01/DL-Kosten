import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function response(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return response({ error: 'Nur POST ist erlaubt.' }, 405)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !anonKey || !serviceKey) throw new Error('Supabase-Umgebungsvariablen fehlen.')

    const authorization = req.headers.get('Authorization') || ''
    if (!authorization) return response({ error: 'Nicht angemeldet.' }, 401)

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    })
    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: authData, error: authError } = await callerClient.auth.getUser()
    if (authError || !authData.user) return response({ error: 'Sitzung ist ungültig. Bitte neu anmelden.' }, 401)

    const { data: caller, error: callerError } = await adminClient
      .from('profiles')
      .select('id, account_id, role, active')
      .eq('id', authData.user.id)
      .single()

    if (callerError || !caller?.active || caller.role !== 'admin') {
      return response({ error: 'Nur aktive Administratoren dürfen Benutzer verwalten.' }, 403)
    }

    const body = await req.json().catch(() => ({}))
    const action = String(body.action || 'list')

    if (action === 'list') {
      const { data, error } = await adminClient
        .from('profiles')
        .select('id, email, full_name, role, active, created_at')
        .eq('account_id', caller.account_id)
        .order('created_at')
      if (error) throw error
      return response({ users: data || [] })
    }

    if (action === 'create') {
      const email = String(body.email || '').trim().toLowerCase()
      const password = String(body.password || '')
      const fullName = String(body.full_name || '').trim()
      if (!fullName) throw new Error('Bitte einen Namen eingeben.')
      if (!email || !email.includes('@')) throw new Error('Bitte eine gültige E-Mail-Adresse eingeben.')
      if (password.length < 10) throw new Error('Das Startpasswort muss mindestens 10 Zeichen lang sein.')

      const { data: created, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          account_id: caller.account_id,
          role: 'member',
          provisioned_by_admin: true,
        },
      })
      if (createError) throw createError

      // Absicherung, falls der Datenbank-Trigger verzögert oder nicht vorhanden ist.
      const { error: profileError } = await adminClient.from('profiles').upsert({
        id: created.user.id,
        account_id: caller.account_id,
        role: 'member',
        active: true,
        email,
        full_name: fullName,
      })
      if (profileError) {
        await adminClient.auth.admin.deleteUser(created.user.id)
        throw profileError
      }
      return response({ user: { id: created.user.id, email } }, 201)
    }

    const targetId = String(body.user_id || '')
    if (!targetId) throw new Error('Benutzer-ID fehlt.')
    if (targetId === caller.id) throw new Error('Das eigene Administratorkonto kann hier nicht geändert werden.')

    const { data: target, error: targetError } = await adminClient
      .from('profiles')
      .select('id, account_id, role, email')
      .eq('id', targetId)
      .single()
    if (targetError || !target || target.account_id !== caller.account_id || target.role === 'admin') {
      throw new Error('Benutzer nicht gefunden oder nicht änderbar.')
    }

    if (action === 'password') {
      const password = String(body.password || '')
      if (password.length < 10) throw new Error('Das Passwort muss mindestens 10 Zeichen lang sein.')
      const { error } = await adminClient.auth.admin.updateUserById(targetId, { password })
      if (error) throw error
      return response({ ok: true })
    }

    if (action === 'toggle') {
      const active = body.active === true
      const { error } = await adminClient.from('profiles').update({ active }).eq('id', targetId)
      if (error) throw error
      return response({ ok: true, active })
    }

    if (action === 'delete') {
      const { error } = await adminClient.auth.admin.deleteUser(targetId)
      if (error) throw error
      return response({ ok: true })
    }

    throw new Error('Unbekannte Aktion.')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(message)
    return response({ error: message }, 400)
  }
})
