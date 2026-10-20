// Ejecuta las pruebas pgTAP de supabase/tests/database contra Supabase Cloud, sin Docker.
// Requiere SUPABASE_DB_URL (cadena "Session pooler" del proyecto DE PRUEBAS; nunca producción).
// Cada archivo de prueba corre en una transacción que termina en ROLLBACK.
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import pg from 'pg';

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error('Falta SUPABASE_DB_URL (proyecto de pruebas).');
  process.exit(2);
}

const dir = join(import.meta.dirname, '..', 'supabase', 'tests', 'database');
const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();

// El certificado de Supabase no está en el almacén de Node; la conexión sigue cifrada.
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
console.log(`Conectado a ${new URL(url).hostname}`);

let failed = 0;
for (const file of files) {
  console.log(`\n# ${file}`);
  try {
    const results = await client.query(await readFile(join(dir, file), 'utf8'));
    const lines = (Array.isArray(results) ? results : [results])
      .flatMap((r) => r.rows ?? [])
      .flatMap((row) => Object.values(row))
      .filter((v) => typeof v === 'string' && /^(ok|not ok|#|1\.\.)/.test(v.trimStart()));
    for (const line of lines) console.log(line);
    failed += lines.filter((l) => l.startsWith('not ok')).length;
    if (lines.some((l) => l.includes('Looks like'))) failed ||= 1;
  } catch (err) {
    failed += 1;
    console.error(`ERROR en ${file}: ${err.message}`);
    await client.query('rollback').catch(() => {});
  }
}

await client.end();
console.log(failed ? `\n${failed} fallo(s)` : '\nTodas las pruebas pasaron');
process.exit(failed ? 1 : 0);
