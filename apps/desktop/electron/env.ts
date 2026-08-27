/**
 * dsh spawns pnpm inside the profile/runtime dirs; inherited workspace
 * context from our own launcher (`pnpm exec` sets INIT_CWD/npm_config_*
 * pointing at the repo) makes that pnpm refuse with ERR_PNPM_ADDING_TO_ROOT.
 * Strip the leak for every dsh/pnpm child we spawn.
 */
export function sanitizedChildEnv(): Record<string, string> {
  const env: Record<string, string> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (value === undefined) continue
    if (key === 'INIT_CWD' || key.startsWith('PNPM_') || key.startsWith('npm_')) continue
    env[key] = value
  }
  // Belt and braces: any pnpm the child resolves must never refuse the
  // profile-dir install with ERR_PNPM_ADDING_TO_ROOT.
  env.npm_config_ignore_workspace_root_check = 'true'
  return env
}
