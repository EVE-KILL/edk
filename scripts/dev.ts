import { spawn } from 'node:child_process';
import { createServer } from 'node:net';

async function reservePort(port: number, host: string) {
  return new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen({ port, host }, () => {
      const address = server.address();
      if (address && typeof address === 'object') {
        server.close(() => resolve(address.port));
      } else {
        server.close(() => reject(new Error('Unable to determine port')));
      }
    });
  });
}

async function pickPort() {
  const preferred = Number.parseInt(process.env.PORT || '3000', 10) || 3000;
  // Align with listhen defaults: localhost unless HOST is explicitly set.
  const host =
    process.env.HOST === undefined
      ? 'localhost'
      : process.env.HOST === ''
        ? '0.0.0.0'
        : process.env.HOST;

  try {
    const available = await reservePort(preferred, host);
    return { port: available, chosen: preferred };
  } catch (error) {
    console.warn(
      `[dev] Preferred port ${preferred} unavailable (${(error as Error).message}). Selecting a free port instead.`
    );
  }

  const fallback = await reservePort(0, host);
  return { port: fallback, chosen: preferred };
}

const { port, chosen } = await pickPort();
const envHost = process.env.HOST;

if (port !== chosen) {
  console.info(`[dev] Using port ${port} (preferred ${chosen} was busy).`);
}

const args = ['--bun', 'nitro', 'dev', '--port', String(port)];
if (envHost !== undefined) {
  args.push('--host', envHost);
}

const child = spawn('bun', args, {
  stdio: 'inherit',
  env: {
    ...process.env,
    PORT: String(port),
    HOST: envHost ?? process.env.HOST,
  },
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 0);
  }
});
