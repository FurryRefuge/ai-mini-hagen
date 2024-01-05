// utility for time commands

import { Chat } from './chat.js';
import { setTimeout as p_setTimeout } from 'node:timers/promises';

export namespace Time {
  export let sent_last_time = false;
  export let sent_last_date = false;

  const f_time = Intl.DateTimeFormat('en-UK', { timeStyle: 'medium', timeZone: 'UTC' });
  const f_date = Intl.DateTimeFormat('en-UK', { dateStyle: 'short', timeZone: 'UTC' });

  {
    const now = Date.now();
    setTimeout(() => {
      setInterval(() => {
        if (sent_last_time) sent_last_time = false;
        else (async () => {
          let iter = 0;
          do await p_setTimeout(50); while (sent_last_time === false && ++iter < 5);
          if (sent_last_time) return;
          Chat.Message.create({
            role: 'user',
            content: `[TIME ${f_time.format(new Date())}]`,
          });
        })();
      }, 60_000);
    }, (Math.ceil(now / 60_000) * 60_000) - now);

    const next_day = new Date();
    next_day.setUTCDate(next_day.getUTCDate() + 1);
    next_day.setUTCHours(0, 0, 0, 0);
    setTimeout(() => {
      setInterval(() => {
        if (sent_last_date) sent_last_date = false;
        else (async () => {
          let iter = 0;
          do await p_setTimeout(50); while (sent_last_date === false && ++iter < 5);
          if (sent_last_date) return;
          Chat.Message.create({
            role: 'user',
            content: `[DATE ${f_date.format(new Date())}]`,
          });
        })();
      }, 24 * 60_000);
    }, next_day.valueOf() - now);
  }

  export function time() {
    sent_last_time = true;
    return f_time.format(new Date());
  }

  export function date() {
    sent_last_date = true;
    return f_date.format(new Date());
  }
}