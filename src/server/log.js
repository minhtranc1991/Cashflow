// Log ra console và file logs/server-YYYY-MM-DD.log (mỗi dòng một sự kiện, dễ grep).
const fs = require('node:fs');
const path = require('node:path');

const dir = process.env.LOG_DIR || path.join(__dirname, '..', '..', 'logs');
let ready = false;

function log(event, data = {}) {
  const now = new Date();
  const line = `${now.toISOString()} ${event} ${JSON.stringify(data)}`;
  if (process.env.NODE_ENV !== 'test') console.log(line);
  try {
    if (!ready) { fs.mkdirSync(dir, { recursive: true }); ready = true; }
    fs.appendFileSync(path.join(dir, `server-${now.toISOString().slice(0, 10)}.log`), `${line}\n`);
  } catch { /* log lỗi không được làm sập game */ }
}

module.exports = { log };
