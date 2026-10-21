// Respaldo lógico de los DATOS de la tienda (el esquema ya está versionado en supabase/migrations).
//   SUPABASE_DB_URL=<cadena Session pooler> node scripts/backup-datos.mjs [carpeta]
// Genera backups/luchy-AAAAMMDD-HHMMSS.json. Contiene datos personales de clientes: NO se versiona
// (backups/ está en .gitignore) y debe guardarse cifrado y fuera del equipo. Solo lee; no modifica nada.
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import pg from 'pg'

const url = process.env.SUPABASE_DB_URL
if (!url) {
  console.error('Define SUPABASE_DB_URL (cadena Session pooler del proyecto a respaldar).')
  process.exit(2)
}

// Orden de dependencias: la restauración inserta en este mismo orden.
export const TABLAS = [
  'categories', 'products', 'product_images', 'orders', 'order_items', 'payments', 'inventory_movements',
]

const db = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
await db.connect()
try {
  await db.query('begin transaction isolation level repeatable read read only') // instantánea coherente
  const datos = {}
  // to_jsonb: fechas, arreglos y números salen tal como los guarda PostgreSQL (sin saltos de zona horaria).
  for (const t of TABLAS) datos[t] = (await db.query(`select to_jsonb(t) as j from public.${t} t order by t.id`)).rows.map((r) => r.j)
  datos.store_settings = (await db.query('select to_jsonb(s) as j from public.store_settings s')).rows[0].j
  // Solo ids y correos de los administradores (nunca contraseñas): para recrearlos con el mismo id.
  datos.admins = (
    await db.query(`select u.id, u.email, p.role from public.profiles p join auth.users u on u.id = p.user_id order by u.email`)
  ).rows
  await db.query('commit')

  const ahora = new Date().toISOString()
  const resumen = Object.fromEntries(TABLAS.map((t) => [t, datos[t].length]))
  const archivo = {
    formato: 1,
    creado: ahora,
    migracion_mas_reciente: (await db.query('select max(version) v from supabase_migrations.schema_migrations')).rows[0].v,
    resumen,
    datos,
  }
  const carpeta = process.argv[2] ?? 'backups'
  await mkdir(carpeta, { recursive: true })
  const nombre = `luchy-${ahora.replace(/[-:]/g, '').replace('T', '-').slice(0, 15)}.json`
  await writeFile(join(carpeta, nombre), JSON.stringify(archivo), 'utf8')
  console.log(`Respaldo: ${join(carpeta, nombre)}`)
  console.log(`Filas: ${JSON.stringify(resumen)} · administradores: ${datos.admins.length}`)
} finally {
  await db.end()
}
