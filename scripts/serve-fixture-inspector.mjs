#!/usr/bin/env node
// Fixture inspector 服务器（阶段 2 步骤 9）：
//   node scripts/serve-fixture-inspector.mjs --root fixtures --port 4174
// 只允许读取 --root 内的常规文件：拒绝绝对路径、.. 穿越、符号链接逃逸。无依赖。
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat, realpath } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { argv, exit } from 'node:process';

function arg(name, dflt) {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 && i + 1 < argv.length ? argv[i + 1] : dflt;
}
const root = resolve(arg('root', 'fixtures'));
const port = Number(arg('port', '4174'));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.js': 'text/javascript',
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.includes('..')) throw new Error('path traversal rejected');
    const rel =
      url.pathname === '/' ? 'inspector/index.html' : decodeURIComponent(url.pathname).slice(1);
    const abs = resolve(root, rel);
    if (abs !== root && !abs.startsWith(root + sep))
      throw new Error('outside fixture root rejected');
    const [st, realRoot, realAbs] = await Promise.all([stat(abs), realpath(root), realpath(abs)]);
    if (!st.isFile()) throw new Error('not a file');
    if (realAbs !== realRoot && !realAbs.startsWith(realRoot + sep))
      throw new Error('symlink escape rejected');
    res.writeHead(200, { 'content-type': MIME[extname(abs)] ?? 'application/octet-stream' });
    createReadStream(abs).pipe(res);
  } catch (e) {
    res.writeHead(e.message.includes('rejected') ? 403 : 404, {
      'content-type': 'text/plain; charset=utf-8',
    });
    res.end(`fixture-inspector: ${e.message}\n`);
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(
    `fixture inspector: http://127.0.0.1:${port}/ （root=${root}；仅原型/测试，禁止生产导入）`,
  );
});
