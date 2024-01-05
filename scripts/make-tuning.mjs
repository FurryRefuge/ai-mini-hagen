import fs from 'node:fs/promises';
import path from 'node:path';

const promises = [];

for (const filename of await fs.readdir(path.join('.', 'tuning', 'data')))
  promises.push(fs.readFile(path.join('.', 'tuning', 'data', filename), 'utf8'));

const files = await Promise.all(promises);
for (let i = 0; i < files.length; ++i)
  // remove new lines
  files[i] = JSON.stringify(JSON.parse(files[i]));

await fs.writeFile(path.join('.', 'tuning', 'tuning.jsonl'), files.join('\n'), 'utf8');