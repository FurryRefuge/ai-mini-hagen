import fs from 'node:fs';

const path = './data.json';

if (!fs.existsSync(path))
  fs.writeFileSync(path, '{}', 'utf8');

export const data = JSON.parse(fs.readFileSync(path, 'utf8')) as {
  thread_id: string;
  assistant_id: string;
  /** the last object id that was processed, always the most recent */
  last_object_id: string;
};

export namespace Data {
  export function write() {
    fs.writeFileSync(path, JSON.stringify(data), 'utf8');
  }
}