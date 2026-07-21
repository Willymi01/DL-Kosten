import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const authHeader = req.headers.get('Authorization') || ''

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const adminClient = createClient(supabaseUrl, serviceKey)

    const { data: userData, error: userError } = await callerClient.auth.getUser()
    if (userError || !userData.user) throw new Error('Nicht angemeldet.')

    const { data: caller, error: callerError } = await adminClient
      .from('profiles')
      .select('id, account_id, role, active')
      .eq('id', userData.user.id)
      .single()

    if (callerError || !caller?.active || caller.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Nur Administratoren dürfen Benutzer verwalten.' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json().catch(() => ({}))
    const action = body.action || 'list'

    if (action === 'list') {
      const { data: profiles, error } = await adminClient
        .from('profiles')
        .select('id, email, full_name, role, active, created_at')
        .eq('account_id', caller.account_id)
        .order('created_at')
      if (error) throw error
      return json({ users: profiles })
    }

    if (action === 'create') {
      const email = String(body.email || '').trim().toLowerCase()
      const password = String(body.password || '')
      const fullName = String(body.full_name || '').trim()
      if (!email || password.length < 10) throw new Error('E-Mail und ein Passwort mit mindestens 10 Zeichen sind erforderlich.')

      const { data, error } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName, account_id: caller.account_id, role: 'member' },
      })
      if (error) throw error
      return json({ user: { id: data.user.id, email: data.user.email } })
    }

    const targetId = String(body.user_id || '')
    if (!targetId || targetId === caller.id) throw new Error('Das eigene Administratorkonto kann hier nicht geändert werden.')

    const { data: target } = await adminClient
      .from('profiles')
      .select('id, account_id, role')
      .eq('id', targetId)
      .single()
    if (!target || target.account_id !== caller.account_id || target.role === 'admin') throw new Error('Benutzer nicht gefunden oder nicht änderbar.')

    if (action === 'password') {
      const password = String(body.password || '')
      if (password.length < 10) throw new Error('Das Passwort muss mindestens 10 Zeichen lang sein.')
      const { error } = await adminClient.auth.admin.updateUserById(targetId, { password })
      if (error) throw error
      return json({ ok: true })
    }

    if (action === 'delete') {
      const { error } = await adminClient.auth.admin.deleteUser(targetId)
      if (error) throw error
      return json({ ok: true })
    }

    throw new Error('Unbekannte Aktion.')
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

function json(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
