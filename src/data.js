import { supabase } from './supabase.js'

export async function getVendors() {
  const { data, error } = await supabase
    .from('vendors')
    .select('id, name, color, active, vendor_rates(id, name, hourly_rate, active, effective_from, effective_to)')
    .order('name')
  if (error) throw error
  return data ?? []
}

export async function saveVendor(vendor) {
  const payload = { name: vendor.name, color: vendor.color, active: vendor.active ?? true }
  let vendorId = vendor.id
  if (vendorId) {
    const { error } = await supabase.from('vendors').update(payload).eq('id', vendorId)
    if (error) throw error
  } else {
    const { data, error } = await supabase.from('vendors').insert(payload).select('id').single()
    if (error) throw error
    vendorId = data.id
  }

  for (const rate of vendor.rates) {
    const ratePayload = {
      vendor_id: vendorId,
      name: rate.name,
      hourly_rate: Number(rate.hourly_rate),
      active: rate.active ?? true,
      effective_from: rate.effective_from,
      effective_to: rate.effective_to || null
    }
    if (rate.id) {
      const { error } = await supabase.from('vendor_rates').update(ratePayload).eq('id', rate.id)
      if (error) throw error
    } else {
      const { error } = await supabase.from('vendor_rates').insert(ratePayload)
      if (error) throw error
    }
  }
}

export async function deactivateVendor(vendorId) {
  const { error } = await supabase.from('vendors').update({ active: false }).eq('id', vendorId)
  if (error) throw error
}

export async function getEntries(fromDate, toDate) {
  const { data, error } = await supabase
    .from('time_entries')
    .select('id, work_date, hours, note, vendor_id, rate_id, vendors(name,color), vendor_rates(name,hourly_rate,effective_from,effective_to)')
    .gte('work_date', fromDate)
    .lte('work_date', toDate)
    .order('work_date')
  if (error) throw error
  return data ?? []
}

export async function upsertEntry(entry) {
  const { data, error } = await supabase
    .from('time_entries')
    .upsert({
      vendor_id: entry.vendor_id,
      rate_id: entry.rate_id,
      work_date: entry.work_date,
      hours: Number(entry.hours || 0),
      note: entry.note || null
    }, { onConflict: 'user_id,vendor_id,rate_id,work_date' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getMonthlyBudget(year, month) {
  const { data, error } = await supabase
    .from('monthly_budgets')
    .select('id, amount')
    .eq('year', year)
    .eq('month', month)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function getYearBudgets(year) {
  const { data, error } = await supabase
    .from('monthly_budgets')
    .select('id, year, month, amount')
    .eq('year', year)
    .order('month')
  if (error) throw error
  return data ?? []
}

export async function upsertMonthlyBudget(year, month, amount) {
  const { error } = await supabase.from('monthly_budgets').upsert({
    year,
    month,
    amount: Number(amount || 0)
  }, { onConflict: 'user_id,year,month' })
  if (error) throw error
}

export function subscribeToChanges(onChange) {
  return supabase.channel('costpilot-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'vendors' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'vendor_rates' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'time_entries' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'monthly_budgets' }, onChange)
    .subscribe()
}


export async function getAllEntries() {
  const { data, error } = await supabase
    .from('time_entries')
    .select('id, work_date, hours, note, vendor_id, rate_id, vendors(name,color), vendor_rates(name,hourly_rate,effective_from,effective_to)')
    .order('work_date')
  if (error) throw error
  return data ?? []
}

export async function getAllBudgets() {
  const { data, error } = await supabase
    .from('monthly_budgets')
    .select('id, year, month, amount')
    .order('year')
    .order('month')
  if (error) throw error
  return data ?? []
}

export async function importEntries(entries) {
  if (!entries.length) return
  const payload = entries.map(entry => ({
    vendor_id: entry.vendor_id,
    rate_id: entry.rate_id,
    work_date: entry.work_date,
    hours: Number(entry.hours || 0),
    note: entry.note || null
  }))
  const { error } = await supabase
    .from('time_entries')
    .upsert(payload, { onConflict: 'user_id,vendor_id,rate_id,work_date' })
  if (error) throw error
}

export async function importBudgets(budgets) {
  if (!budgets.length) return
  const payload = budgets.map(item => ({
    year: Number(item.year),
    month: Number(item.month),
    amount: Number(item.amount || 0)
  }))
  const { error } = await supabase
    .from('monthly_budgets')
    .upsert(payload, { onConflict: 'user_id,year,month' })
  if (error) throw error
}
