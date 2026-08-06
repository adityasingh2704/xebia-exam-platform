/**
 * Xe-Recruiters — Project Startup Script
 * Starts all 6 services in separate processes with coloured logs.
 *
 * Usage:  node scripts/start-all.js
 */

const { spawn } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// ── Service definitions ──────────────────────────────────────────────────────
const SERVICES = [
  { name: 'api-gateway',   dir: path.join(ROOT, 'services', 'api-gateway'),          port: 3006, color: '\x1b[35m' }, // Magenta
  { name: 'auth',          dir: path.join(ROOT, 'services', 'auth-service'),          port: 3001, color: '\x1b[34m' }, // Blue
  { name: 'tenant',        dir: path.join(ROOT, 'services', 'tenant-service'),        port: 3002, color: '\x1b[36m' }, // Cyan
  { name: 'user',          dir: path.join(ROOT, 'services', 'user-service'),          port: 3003, color: '\x1b[33m' }, // Yellow
  { name: 'exam',          dir: path.join(ROOT, 'services', 'exam-service'),          port: 3004, color: '\x1b[32m' }, // Green
  { name: 'question-bank', dir: path.join(ROOT, 'services', 'question-bank-service'), port: 3005, color: '\x1b[31m' }, // Red
  { name: 'frontend',      dir: path.join(ROOT, 'frontend'),                          port: 3000, color: '\x1b[37m', cmd: 'dev' }, // White
];

const RESET = '\x1b[0m';
const BOLD  = '\x1b[1m';

function log(color, prefix, msg) {
  const time = new Date().toLocaleTimeString('en-US', { hour12: false });
  process.stdout.write(`${color}${BOLD}[${prefix}]${RESET} ${color}${time}${RESET} ${msg}\n`);
}

let running = 0;

function startService(svc) {
  const cmd = svc.cmd || 'dev';
  const args = svc.args || [];
  const label = svc.name.padEnd(12);

  log(svc.color, label, `Starting on port ${svc.port}...`);

  const proc = spawn('npm', ['run', cmd, '--', ...args], {
    cwd: svc.dir,
    shell: true,
    env: { ...process.env, PORT: String(svc.port), NEXT_TELEMETRY_DISABLED: '1' },
  });

  running++;

  proc.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(Boolean);
    for (const line of lines) {
      log(svc.color, label, line);
    }
  });

  proc.stderr.on('data', (data) => {
    const lines = data.toString().split('\n').filter(Boolean);
    for (const line of lines) {
      // Filter out common non-error noise
      if (line.includes('ExperimentalWarning') || line.includes('DeprecationWarning')) continue;
      log(svc.color, label, `⚠  ${line}`);
    }
  });

  proc.on('close', (code) => {
    log(svc.color, label, `Process exited with code ${code}`);
    running--;
    if (running === 0) process.exit(0);
  });

  proc.on('error', (err) => {
    log(svc.color, label, `Failed to start: ${err.message}`);
  });

  return proc;
}

// ── Main ─────────────────────────────────────────────────────────────────────

const procs = [];

console.log(`
\x1b[35m\x1b[1m╔══════════════════════════════════════════════╗
║       Xe-Recruiters Platform Startup         ║
╠══════════════════════════════════════════════╣
║  Frontend (UI) -> http://localhost:3000       ║
║  API Gateway  -> http://localhost:3006       ║
║  Auth Service -> http://localhost:3001       ║
║  Tenant Svc   -> http://localhost:3002       ║
║  User Service -> http://localhost:3003       ║
║  Exam Service -> http://localhost:3004       ║
║  Question Svc -> http://localhost:3005       ║
╠══════════════════════════════════════════════╣
║  Open: http://localhost:3000                 ║
║  Login: admin@acme.edu / Admin@123           ║
╚══════════════════════════════════════════════╝\x1b[0m
`);

// Start backend services first, then frontend
for (const svc of SERVICES) {
  procs.push(startService(svc));
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\x1b[33mShutting down all services...\x1b[0m');
  for (const p of procs) {
    try { p.kill('SIGTERM'); } catch (_) {}
  }
  setTimeout(() => process.exit(0), 2000);
});

process.on('SIGTERM', () => {
  for (const p of procs) {
    try { p.kill('SIGTERM'); } catch (_) {}
  }
  process.exit(0);
});
