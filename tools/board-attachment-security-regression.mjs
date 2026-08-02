import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const worker = await fs.readFile(path.join(root, 'workers/ai-analysis/src/index.js'), 'utf8');
const config = await fs.readFile(path.join(root, 'workers/ai-analysis/wrangler.toml'), 'utf8');
const migration = await fs.readFile(path.join(root, 'workers/ai-analysis/migrations/0004_board_attachments_and_popups.sql'), 'utf8');

const checks = [
  ['upload requires Firebase auth', /attachment\/upload[\s\S]{0,500}requireAuthContext/.test(worker)],
  ['upload requires post management permission', worker.includes('if (!canManageBoardPost(target, authContext))')],
  ['private downloads use board visibility permission', worker.includes('if (!canViewBoardPrivate(target, authContext))')],
  ['only promotion attachments are public', worker.includes('const isPublic = normalizeBoardRoom(target.room) === "promotion"')],
  ['file size is bounded', worker.includes('BOARD_ATTACHMENT_MAX_BYTES = 15 * 1024 * 1024') && worker.includes('request.arrayBuffer()')],
  ['file signatures are checked', worker.includes('hasBoardAttachmentSignature') && worker.includes('BOARD_ATTACHMENT_SIGNATURE')],
  ['dangerous web formats are absent from allowlist', !/\["(?:html?|svg|js|mjs|exe)"\s*,/.test(worker)],
  ['R2 binding is configured', config.includes('binding = "BOARD_ATTACHMENTS"') && config.includes('bucket_name = "gyo6-board-attachments"')],
  ['attachment metadata and popup state are migrated', migration.includes('CREATE TABLE IF NOT EXISTS board_attachments') && migration.includes('ADD COLUMN is_popup')],
  ['post deletion removes stored objects', worker.includes('await env.BOARD_ATTACHMENTS.delete(keys)')]
];

const failures = checks.filter(([, passed]) => !passed);
for (const [name, passed] of checks) console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`);
if (failures.length) process.exitCode = 1;
