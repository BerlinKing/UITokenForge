import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { prepareSubmission } from "../lib/delivery.mjs";
import { captureImplementationBaseline, implementGovernance, planImplementation, validateImplementationInputs } from "../lib/implementation.mjs";
import { extractStyleLibrary } from "../lib/library.mjs";
import { buildTokenContract } from "../lib/token-contract.mjs";

const execFileAsync = promisify(execFile);

test("approved lifecycle batches produce safe source changes and Draft PR preparation", async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "govern-ui-implementation-"));
  const repo = path.join(temp, "repo");
  const output = path.join(temp, "output");
  const delivery = path.join(temp, "delivery");
  await execFileAsync("mkdir", ["-p", repo]);
  const css = `:root {\n  --legacy-color: #123456;\n  --unused-color: #ffffff;\n}\n.button { color: var(--legacy-color); }\n.badge { color: #ff0000; }\n`;
  await writeFile(path.join(repo, "tokens.css"), css, "utf8");
  await execFileAsync("git", ["init", "-b", "main"], { cwd: repo });
  await execFileAsync("git", ["config", "user.email", "govern-ui@example.invalid"], { cwd: repo });
  await execFileAsync("git", ["config", "user.name", "GovernUI Test"], { cwd: repo });
  await execFileAsync("git", ["add", "tokens.css"], { cwd: repo });
  await execFileAsync("git", ["commit", "-m", "fixture"], { cwd: repo });

  const contract = {
    schemaVersion: 1,
    status: "draft",
    repoId: "fixture-repo",
    reportId: "fixture-report",
    sourceBaseline: await captureImplementationBaseline(repo),
    lifecycle: [
      {
        id: "lifecycle-migrate-color",
        action: "migrate",
        currentTokens: [{ id: "legacy", name: "--legacy-color", value: "#123456", file: "tokens.css", line: 2 }],
        targetToken: { name: "--text-primary" },
        verification: "source-confirmed",
      },
      {
        id: "lifecycle-delete-color",
        action: "delete",
        currentTokens: [{ id: "unused", name: "--unused-color", value: "#ffffff", file: "tokens.css", line: 3 }],
        targetToken: null,
        verification: "runtime-required",
      },
    ],
  };
  const decisions = {
    schemaVersion: 4,
    reportId: "fixture-report",
    repoId: "fixture-repo",
    status: "draft",
    batchApprovals: [{ batchId: "batch-color", approved: true, actionIds: contract.lifecycle.map((item) => item.id) }],
    tokenLifecycleDecisions: contract.lifecycle.map((item) => ({ lifecycleId: item.id, action: item.action, batchId: "batch-color", approved: true })),
    directStyleDecisions: [{
      directStyleId: "direct-red-text",
      foundationId: "color",
      batchId: "batch-color",
      action: "migrate",
      targetToken: "--text-primary",
      approved: true,
      sourceValues: ["#ff0000"],
      occurrences: 1,
      examples: [{ file: "tokens.css", line: 6, property: "color", evidence: ".badge { color: #ff0000; }" }],
    }],
  };
  assert.equal(validateImplementationInputs(decisions, contract).valid, true);
  const dryRun = await planImplementation({ repoRoot: repo, decisions, contract });
  assert.equal(dryRun.summary.ready, 2);
  assert.equal(dryRun.summary.blocked, 1);
  assert.equal(dryRun.summary.replacements, 2);

  const decisionsFile = path.join(temp, "decisions.json");
  const contractFile = path.join(temp, "contract.json");
  await Promise.all([
    writeFile(decisionsFile, `${JSON.stringify(decisions, null, 2)}\n`, "utf8"),
    writeFile(contractFile, `${JSON.stringify(contract, null, 2)}\n`, "utf8"),
  ]);
  const result = await implementGovernance({ repoRoot: repo, decisionsFile, contractFile, outputDir: output, write: true });
  assert.equal(result.mode, "write");
  const changed = await readFile(path.join(repo, "tokens.css"), "utf8");
  assert.match(changed, /--text-primary: #123456/);
  assert.match(changed, /var\(--text-primary\)/);
  assert.match(changed, /\.badge \{ color: var\(--text-primary\); \}/);
  assert.match(changed, /--unused-color:/);
  assert.doesNotMatch(changed, /--legacy-color/);

  const prepared = await prepareSubmission({ repoRoot: repo, ledgerFile: result.ledger, outputDir: delivery, base: "main" });
  const body = await readFile(prepared.bodyFile, "utf8");
  assert.match(body, /Draft PR/);
  assert.match(body, /Migrate: 2/);
  assert.match(body, /Runtime-required deletions/);
  assert.equal(prepared.manifest.files.includes("tokens.css"), true);
  assert.match(prepared.manifest.suggestedBranch, /^codex\/govern-ui-/);
  await writeFile(path.join(repo, "tokens.css"), changed + "\n/* edited after execution */\n");
  await assert.rejects(() => prepareSubmission({ repoRoot: repo, ledgerFile: result.ledger, outputDir: delivery }), /ledger source drift/);
  await rm(temp, { recursive: true, force: true });
});

async function withSource(t, css) {
  const repo = await mkdtemp(path.join(os.tmpdir(), 'govern-ui-source-'));
  t.after(() => rm(repo, { recursive: true, force: true }));
  await writeFile(path.join(repo, 'tokens.css'), css);
  const contract = { schemaVersion: 1, status: 'draft', repoId: 'repo', reportId: 'report',
    sourceBaseline: await captureImplementationBaseline(repo),
    lifecycle: [{ id: 'rename', action: 'migrate', currentTokens: [{ name: '--legacy', value: '#111111', file: 'tokens.css', line: 2 }], targetToken: { name: '--text-primary' }, verification: 'source-confirmed' }] };
  const decisions = { schemaVersion: 4, status: 'draft', repoId: 'repo', reportId: 'report', batchApprovals: [],
    tokenLifecycleDecisions: [{ lifecycleId: 'rename', action: 'migrate', approved: true }] };
  return { repo, contract, decisions };
}

test('source value, consumer, added-file and repository drift reject approved contracts', async t => {
  const css = ':root {\n  --legacy: #111111;\n}\n.card {color:var(--legacy)}\n';
  const { repo, contract, decisions } = await withSource(t, css);
  assert.equal((await planImplementation({ repoRoot: repo, contract, decisions })).summary.ready, 1);
  for (const next of [css.replace('#111111', '#ABCDEF'), css.replace('.card', '.other-consumer')]) {
    await writeFile(path.join(repo, 'tokens.css'), next);
    await assert.rejects(() => planImplementation({ repoRoot: repo, contract, decisions }), /source baseline drift/);
    assert.equal(await readFile(path.join(repo, 'tokens.css'), 'utf8'), next);
  }
  await writeFile(path.join(repo, 'tokens.css'), css);
  await writeFile(path.join(repo, 'new-consumer.css'), '.new {color:var(--legacy)}');
  await assert.rejects(() => planImplementation({ repoRoot: repo, contract, decisions }), /source baseline drift/);
  const other = await withSource(t, css);
  await assert.rejects(() => planImplementation({ repoRoot: other.repo, contract, decisions }), /repository mismatch/);
  assert.equal(validateImplementationInputs(decisions, { ...contract, sourceBaseline: undefined }).valid, false);
  assert.equal(validateImplementationInputs({ ...decisions, reportId: 'other' }, contract).valid, false);
});

test('stale or ambiguous declaration evidence stays blocked even with a current baseline', async t => {
  for (const css of [':root {\n  --legacy: #ABCDEF;\n}\n', ':root {\n  --legacy: #111111;\n}\n.dark {\n  --legacy: #222222;\n}\n']) {
    const { repo, contract, decisions } = await withSource(t, css);
    const plan = await planImplementation({ repoRoot: repo, contract, decisions });
    assert.equal(plan.summary.blocked, 1);
    assert.deepEqual(plan.changedFiles, []);
    assert.equal(await readFile(path.join(repo, 'tokens.css'), 'utf8'), css);
  }
});

test('approved deletions retain original evidence when earlier actions move lines', async t => {
  const { repo, contract, decisions } = await withSource(t, ':root {\n  --legacy: #111111;\n  --unused: #222222;\n}\n');
  contract.lifecycle[0].action = 'delete';
  contract.lifecycle.push({ id: 'delete-unused', action: 'delete', currentTokens: [{ name: '--unused', value: '#222222', file: 'tokens.css', line: 3 }], verification: 'source-confirmed' });
  decisions.tokenLifecycleDecisions = contract.lifecycle.map(action => ({ lifecycleId: action.id, action: 'delete', approved: true }));
  const plan = await planImplementation({ repoRoot: repo, contract, decisions });
  assert.equal(plan.summary.ready, 2);
  assert.equal(plan.summary.blocked, 0);
  assert.doesNotMatch(plan._contents[0].content, /--legacy|--unused/);
});

test('direct styles require the exact approved property, value and line evidence', async t => {
  const css = ':root {\n  --legacy: #111111;\n}\n.badge { background: #ff0000; color: #00ff00; }\n';
  const { repo, contract, decisions } = await withSource(t, css);
  decisions.tokenLifecycleDecisions = [];
  const mapping = { directStyleId: 'badge', action: 'migrate', approved: true, targetToken: '--legacy', sourceValues: ['#ff0000'], examples: [{ file: 'tokens.css', line: 4, property: 'color', evidence: css.split('\n')[3] }] };
  decisions.directStyleDecisions = [mapping];
  assert.deepEqual((await planImplementation({ repoRoot: repo, contract, decisions })).changedFiles, [], 'matching literal in another property must not be rewritten');
  mapping.examples[0].property = 'background';
  const plan = await planImplementation({ repoRoot: repo, contract, decisions });
  assert.equal(plan.summary.ready, 1);
  assert.match(plan._contents[0].content, /background: var\(--legacy\); color: #00ff00/);
  mapping.examples[0].evidence = '.old-badge { background: #ff0000; color: #00ff00; }';
  assert.deepEqual((await planImplementation({ repoRoot: repo, contract, decisions })).changedFiles, []);
});

test('actual review exports are rejected by the experimental executor without relabeling', async t => {
  const { repo, decisions } = await withSource(t, ':root {\n  --legacy: #111111;\n}\n.card {color:var(--legacy)}\n');
  const contract = buildTokenContract(await extractStyleLibrary(repo));
  assert.equal(contract.schemaVersion, 2);
  await assert.rejects(() => planImplementation({ repoRoot: repo, contract, decisions }), /token contract schemaVersion must be 1/);
});
