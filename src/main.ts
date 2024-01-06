import { Chat } from './chat.js';
import { Data, data } from './data.js';
import { Time } from './time.js';
import { Logger } from './logger.js';
import { Discord } from './discord.js';
import { set_sleep, sleep_time } from './sleep.js';

const did_info_command = new Set();
const per_user_ratelimit = new Map();

Discord.client.on('messageCreate', message => {
  if (message.channelId !== '645783743423840277') return;
  if (message.author.bot) return;
  if (!message.content || message.content.length <= 1 || message.content.length >= 512) return;
  if (!message.member) return;

  { // per user ratelimit
    const last = per_user_ratelimit.get(message.author.id);
    const now = Date.now();
    per_user_ratelimit.set(message.author.id, now);
    if (last && (now - last <= 1_000)) return;
  }

  let text: string = '';
  if (Time.sent_last_date === false)
    text += `[DATE ${Time.date()}] `
  if (Time.sent_last_time === false)
    text += `[TIME ${Time.time()}] `

  if (message.reference && message.reference.messageId !== undefined) {
    if (message.channel.messages.cache.get(message.reference.messageId)?.author.id === Discord.client.user!.id)
      text += '[YOU] ';
    else
      text += `[REPLY ${message.reference.messageId}] `
  }

  if (!did_info_command.has(message.author.id)) {
    text += '[INFO] ';
    if (message.member.roles.cache.has('645783680295370758'))
      text += '[MOD] ';
    text += `[NICK ${message.member.displayName}] `;
    did_info_command.add(message.author.id);
  }

  text += `${message.id} ${message.author.id} ${message.content}`;

  Chat.Message.create({ role: 'user', content: text });
});

async function process_responses() {
  const list = await Chat.Message.list(data.last_object_id ? { before: data.last_object_id } : undefined);
  const raw: string[] = [];
  data.last_object_id = list.data[0]?.id as string;

  for (const message of list.data) {
    if (message.role === 'user') break;
    let content = '';
    for (const i of message.content)
      if (i.type === 'text') content += i.text.value;
    raw.push(content)
  }

  if (raw.length === 0) return void console.warn('no answer received');
  console.debug('raw responses:', raw);

  for (let i = raw.length - 1; i !== -1; --i) {
    let text = raw[i]!;
    Logger.add_assistant_message(text);
    console.log(i, text);
    
    if (text === '[OK]') continue;

    if (text.length !== 0) {
      await Discord.channel.send({
        content: text,
        allowedMentions: {
          roles: [],
        }
      }).catch(console.error);
    }
  }

  Data.write();
}

let iter = 0;
const cycle = async () => {
  ++iter;
  if (sleep_time === 0 && Chat.Message.pending_count_for_run !== 0) {
    if (Chat.Message.pending_count_for_run > 8 || iter >= 2) {
      await Chat.Run.create_and_wait()
        .then(process_responses);
      iter = 0;
    }
  }

  setTimeout(cycle, 8_000 + sleep_time);
  set_sleep(0);
}
cycle();

Discord.client.login(process.env.DISCORD_TOKEN);