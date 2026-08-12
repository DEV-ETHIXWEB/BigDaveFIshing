/**
 * Reads configuration at runtime.
 *
 * `import.meta.env.FOO` is not reliable for this on Vercel. Vite resolves it while
 * building, so a value the build could not see is frozen into the bundle as missing and
 * no amount of setting it on the deployment will bring it back. That is exactly how the
 * live site ended up trying to open a local SQLite file on a read-only filesystem and
 * returning 500 on every page that touched the database.
 *
 * `process.env` is read when the function actually runs, which is where the values live.
 * `import.meta.env` stays as the fallback so local `astro dev` — where .env is loaded by
 * Vite, not into the process — keeps working unchanged.
 *
 * Use this for anything set as an environment variable. Do not reach for
 * `import.meta.env` directly in server code.
 */
export function envVar(name: string): string | undefined {
  const fromProcess = typeof process !== 'undefined' ? process.env?.[name] : undefined;
  if (fromProcess) return fromProcess;
  return (import.meta.env as Record<string, string | undefined>)[name];
}

/** Same, trimmed and with blanks treated as absent — how every caller here wants it. */
export function envSetting(name: string): string | undefined {
  return envVar(name)?.trim() || undefined;
}
