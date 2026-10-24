// El enlace del correo de recuperación vuelve a la raíz del sitio con «?code=…» (flujo PKCE). La app usa rutas
// con «#», así que, antes de que Supabase intercambie el código y limpie la URL, se deja la ruta del hash en la
// pantalla para elegir la nueva contraseña. Debe importarse antes de crear el cliente de Supabase.
const { search, hash, pathname } = window.location
if (new URLSearchParams(search).has('code') && !hash.startsWith('#/')) {
  window.history.replaceState(null, '', `${pathname}${search}#/admin/restablecer`)
}
