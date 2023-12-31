process.env.TZ = 'UTC';

import assert from 'node:assert/strict';
import { configDotenv } from 'dotenv';

configDotenv();
assert.ok(process.env.DISCORD_TOKEN);

await import('./main.js');