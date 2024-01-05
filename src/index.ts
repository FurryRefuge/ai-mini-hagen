process.env.TZ = 'UTC';

import assert from 'node:assert/strict';
import { configDotenv } from 'dotenv';

declare global {
  const __rootname: string;
}

configDotenv();
assert.ok(process.env.DISCORD_TOKEN);
assert.ok(process.env.OPENAI_API_KEY);

// hack: tsup doesn't preserve the order of when configDotenv() is called.
// this forces the openai library to be imported after configDotenv() is called.
await import('./main.js');