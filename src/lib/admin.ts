// Candado simple de superadmin (etapa de prueba).
// NOTA: NO es seguridad fuerte — la clave viaja en el código del navegador y
// alguien técnico podría saltarla. Solo evita borrados accidentales. Para
// seguridad real haría falta login + políticas RLS en Supabase.
//
// Cambia esta clave por la que quieras:
const ADMIN_PIN = '1979'
const KEY = 'golf_admin_ok'

export function isAdminUnlocked(): boolean {
  if (typeof window === 'undefined') return false
  try { return sessionStorage.getItem(KEY) === '1' } catch { return false }
}
export function tryUnlockAdmin(pin: string): boolean {
  if (pin === ADMIN_PIN) {
    try { sessionStorage.setItem(KEY, '1') } catch {}
    return true
  }
  return false
}
export function lockAdmin(): void {
  try { sessionStorage.removeItem(KEY) } catch {}
}
