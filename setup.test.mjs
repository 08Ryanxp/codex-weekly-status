import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { configure } from './setup.mjs';

const script = fileURLToPath(new URL('./setup.mjs', import.meta.url));

test('Codex real: preserva preferências, comentários e alterações posteriores à instalação', { timeout: 90_000 }, () => {
  // Pasta exclusiva, sem credenciais. Nunca usa nem copia o CODEX_HOME real.
  const home = mkdtempSync(join(tmpdir(), 'codex-weekly-status test-'));
  const config = join(home, 'config.toml');
  const original = '# comentário que deve sobreviver\nmodel_reasoning_effort = "high"\n\n[tui]\nstatus_line = ["current-dir", "model-with-reasoning", "context-remaining"]\n\n[features]\nweb_search = false\n';
  writeFileSync(config, original);
  const run = (...args) => execFileSync(process.execPath, [script, ...args], {
    encoding: 'utf8', timeout: 40_000, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, CODEX_HOME: home },
  });
  assert.match(run(), /ativado/);
  const installed = readFileSync(config, 'utf8');
  assert.match(installed, /\["current-dir", "model-with-reasoning", "five-hour-limit", "weekly-limit", "context-remaining"\]/);
  assert.equal(installed.replace(', "five-hour-limit", "weekly-limit"', ''), original);
  assert.match(run(), /Nenhuma alteração/);
  assert.equal(readFileSync(config, 'utf8'), installed);
  // Remover os indicadores não pode apagar uma preferência adicionada depois.
  writeFileSync(config, installed.replace('"context-remaining"', '"context-remaining", "git-branch"'));
  assert.match(run('--remove'), /removido/);
  assert.equal(readFileSync(config, 'utf8'), original.replace('"context-remaining"', '"context-remaining", "git-branch"'));
  const removed = readFileSync(config, 'utf8');
  assert.match(run('--remove'), /Nenhuma alteração/);
  assert.equal(readFileSync(config, 'utf8'), removed);
  // Uma configuração inválida deve permanecer intacta.
  writeFileSync(config, '[tui\n');
  assert.throws(() => run());
  assert.equal(readFileSync(config, 'utf8'), '[tui\n');
  // Configuração nova: conserva o rodapé padrão e acrescenta os limites.
  writeFileSync(config, '');
  run();
  assert.match(readFileSync(config, 'utf8'), /\["model-with-reasoning", "five-hour-limit", "weekly-limit", "current-dir", "thread-name"\]/);
  // Um rodapé explicitamente vazio não deve ganhar os outros itens padrão.
  writeFileSync(config, '[tui]\nstatus_line = []\n');
  run();
  assert.match(readFileSync(config, 'utf8'), /status_line = \["five-hour-limit", "weekly-limit"\]/);
  run('--remove');
  assert.equal(readFileSync(config, 'utf8'), '[tui]\nstatus_line = []\n');
  // Atualizar uma instalação antiga só adiciona o indicador que está faltando.
  for (const existing of ['weekly-limit', 'five-hour-limit']) {
    const prior = `# preferências existentes\n[tui]\nstatus_line = ["current-dir", "${existing}", "git-branch"]\n`;
    writeFileSync(config, prior);
    run();
    const upgraded = prior.replace(`"${existing}"`, '"five-hour-limit", "weekly-limit"');
    assert.equal(readFileSync(config, 'utf8'), upgraded);
    assert.match(run(), /Nenhuma alteração/);
    assert.equal(readFileSync(config, 'utf8'), upgraded);
  }
  // A remoção também funciona para quem ainda tem só um dos indicadores.
  writeFileSync(config, '[tui]\nstatus_line = ["weekly-limit", "git-branch"]\n');
  run('--remove');
  assert.equal(readFileSync(config, 'utf8'), '[tui]\nstatus_line = ["git-branch"]\n');
});

test('alteração concorrente é recusada pelo controle de versão do Codex', async () => {
  const request = async (method, params) => {
    if (method === 'config/read') return {
      config: { tui: { status_line: [] } },
      layers: [{ name: { type: 'user', file: '/config.toml' }, version: 'original' }],
    };
    assert.equal(method, 'config/batchWrite');
    assert.equal(params.expectedVersion, 'original');
    assert.equal(params.filePath, '/config.toml');
    assert.deepEqual(params.edits, [{ keyPath: 'tui.status_line', value: ['five-hour-limit', 'weekly-limit'], mergeStrategy: 'replace' }]);
    throw new Error('configuration version mismatch');
  };
  await assert.rejects(configure(request), /version mismatch/);
});

test('indicadores já ativados preservam a ordem escolhida sem gerar escrita', async () => {
  let calls = 0;
  const result = await configure(async method => {
    assert.equal(method, 'config/read');
    calls++;
    return {
      config: { tui: { status_line: ['weekly-limit', 'git-branch', 'five-hour-limit'] } },
      layers: [{ name: { type: 'user', file: '/config.toml' }, version: 'original' }],
    };
  });
  assert.equal(calls, 1);
  assert.equal(result.changed, false);
});
