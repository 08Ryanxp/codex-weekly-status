#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const ITEMS = ['five-hour-limit', 'weekly-limit'];
const DEFAULT_ITEMS = ['model-with-reasoning', 'current-dir', 'thread-name'];

export async function configure(request, remove = false) {
  const before = await request('config/read', { includeLayers: true });
  const layer = before.layers?.find(({ name }) => name.type === 'user' && !name.profile);
  if (!layer?.name.file || !layer.version) {
    throw new Error('O Codex não informou a configuração do usuário. Atualize o CLI e tente novamente.');
  }
  const current = before.config.tui?.status_line ?? DEFAULT_ITEMS;
  if (!Array.isArray(current) || current.some(item => typeof item !== 'string')) {
    throw new Error('tui.status_line precisa ser uma lista de textos. Nenhuma alteração foi feita.');
  }
  const missing = ITEMS.filter(item => !current.includes(item));
  if (remove ? missing.length === ITEMS.length : missing.length === 0) {
    return { changed: false, file: layer.name.file, items: current };
  }
  const items = remove ? current.filter(item => !ITEMS.includes(item)) : [...current];
  if (!remove) {
    const weeklyIndex = items.indexOf('weekly-limit');
    const fiveHourIndex = items.indexOf('five-hour-limit');
    const modelIndex = items.findIndex(item => ['model-with-reasoning', 'model', 'model-name'].includes(item));
    const insertAt = weeklyIndex >= 0 ? weeklyIndex : fiveHourIndex >= 0 ? fiveHourIndex + 1 : modelIndex + 1;
    items.splice(insertAt, 0, ...missing);
  }
  const result = await request('config/batchWrite', {
    edits: [{ keyPath: 'tui.status_line', value: items, mergeStrategy: 'replace' }],
    filePath: layer.name.file,
    expectedVersion: layer.version,
    reloadUserConfig: true,
  });
  if (result.status === 'okOverridden') {
    throw new Error('O arquivo foi atualizado, mas outra camada de configuração prevalece. Confira seus perfis ou políticas do Codex.');
  }
  if (result.status !== 'ok') throw new Error('O Codex não confirmou a alteração.');
  const after = await request('config/read', { includeLayers: false });
  if (JSON.stringify(after.config.tui?.status_line) !== JSON.stringify(items)) {
    throw new Error('O arquivo foi atualizado, mas a configuração efetiva é diferente. Confira seus perfis ou políticas do Codex.');
  }
  return { changed: true, file: result.filePath, items };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) {
    console.log('Ativar: node setup.mjs\nRemover: node setup.mjs --remove\nRequer Node.js 20+ e codex no PATH. Altera somente tui.status_line.');
    return;
  }
  if (args.length > 1 || (args.length === 1 && args[0] !== '--remove')) {
    throw new Error('Uso: node setup.mjs [--remove | --help]');
  }
  const remove = args[0] === '--remove';
  const windows = process.platform === 'win32';
  // Comando fixo: o cmd.exe permite usar o codex.cmd instalado pelo npm no Windows.
  const child = spawn(windows ? (process.env.ComSpec || 'cmd.exe') : 'codex',
    windows ? ['/d', '/s', '/c', 'codex app-server'] : ['app-server'],
    { cwd: homedir(), windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] });
  const pending = new Map();
  let nextId = 0;
  const rejectAll = error => {
    for (const call of pending.values()) call.reject(error);
    pending.clear();
  };
  const request = (method, params) => new Promise((resolveRequest, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve: resolveRequest, reject });
    child.stdin.write(JSON.stringify({ id, method, params }) + '\n');
  });
  child.on('error', () => rejectAll(new Error('Não foi possível iniciar o Codex. Confira se codex --version funciona neste terminal.')));
  child.stdin.on('error', () => rejectAll(new Error('A conexão com o Codex foi encerrada. Confira a instalação e o config.toml.')));
  child.on('exit', () => rejectAll(new Error('O Codex encerrou antes de responder. Confira a instalação e o config.toml.')));
  const lines = createInterface({ input: child.stdout });
  lines.on('line', line => {
    let message;
    try { message = JSON.parse(line); } catch { return; }
    const call = pending.get(message.id);
    if (!call) return;
    pending.delete(message.id);
    if (message.error) call.reject(new Error(message.error.message));
    else call.resolve(message.result);
  });
  const timeout = setTimeout(() => rejectAll(new Error('O Codex não respondeu em 30 segundos.')), 30_000);
  try {
    await request('initialize', {
      clientInfo: { name: 'codex_weekly_status', version: '0.1.0' },
      capabilities: { experimentalApi: true },
    });
    child.stdin.write(JSON.stringify({ method: 'initialized', params: {} }) + '\n');
    const result = await configure(request, remove);
    console.log(result.changed
      ? `Indicadores de limite ${remove ? 'removidos' : 'ativados'}.`
      : `Os indicadores já ${remove ? 'estavam ausentes' : 'estão ativados'}. Nenhuma alteração.`);
    console.log(`Arquivo: ${result.file}`);
    console.log(`Rodapé: ${result.items.join(' · ') || '(vazio)'}`);
    if (result.changed) console.log('Reabra o Codex; para retomar uma conversa, use codex resume.');
  } finally {
    clearTimeout(timeout);
    child.stdin.end();
    // O servidor encerra com EOF. Limite a espera caso a instalação esteja travada.
    const cleanup = setTimeout(() => {
      if (child.exitCode !== null || child.signalCode !== null || !child.pid) return;
      if (windows) spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true, stdio: 'ignore' });
      else child.kill();
    }, 3_000);
    cleanup.unref();
    child.once('close', () => { clearTimeout(cleanup); lines.close(); });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(`Erro: ${error.message}`); process.exitCode = 1; });
}
