// Settings the API refuses to start without. The placeholders of .env.example and
// docker-compose.yml are public, so a secret left at one of them lets anyone sign a login
// token or an ijaza QR code: they count as missing.
const PLACEHOLDERS = new Set(['change_this_secret', 'change_me_in_production']);
const MIN_SECRET = 32;

const secretProblem = (name, value) => {
  if (!value) return `${name} is not set`;
  if (PLACEHOLDERS.has(value)) return `${name} is still the example value`;
  if (value.length < MIN_SECRET) return `${name} must be at least ${MIN_SECRET} characters`;
  return null;
};

/** Problems with the environment, [] when the API can start. QR_SECRET is optional. */
function envProblems(env = process.env) {
  return [
    secretProblem('JWT_SECRET', env.JWT_SECRET),
    env.QR_SECRET != null && env.QR_SECRET !== '' ? secretProblem('QR_SECRET', env.QR_SECRET) : null,
  ].filter(Boolean);
}

/** Exits with a clear message when the environment is unsafe. */
function checkEnv(env = process.env) {
  const problems = envProblems(env);
  if (!problems.length) return;
  console.error(`Refusing to start:\n${problems.map(p => `  - ${p}`).join('\n')}\n` +
    'Set them in backend/.env. Generate a secret with:\n' +
    '  node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64url\'))"');
  process.exit(1);
}

module.exports = { envProblems, checkEnv, MIN_SECRET };
