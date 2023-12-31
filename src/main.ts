import { Client, GatewayIntentBits, TextChannel } from 'discord.js';
import { Chat } from './chat.js';
import { Data, data } from './data.js';
import { Time } from './time.js';

const client = new Client({
  intents: 0
    | GatewayIntentBits.Guilds
    | GatewayIntentBits.GuildMessages
    | GatewayIntentBits.MessageContent
  ,
});

client.once('ready', () => {
  console.log(`Logged in as ${client.user!.tag}!`);
});

const did_info_command = new Set();
const per_user_ratelimit = new Map();

client.on('messageCreate', message => {
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
    if (message.channel.messages.cache.get(message.reference.messageId)?.author.id === client.user!.id)
      text += '[YOU] ';
    else
      text += `[REPLY ${message.reference.messageId}]`
  }

  if (!did_info_command.has(message.author.id)) {
    text = '[INFO] ';
    if (message.member.roles.cache.has('645783680295370758'))
      text += '[MOD] ';
    text += `[NICK ${message.member.displayName}] `;
    did_info_command.add(message.author.id);
  }

  text += `${message.id} ${message.author.id} ${message.content}`;

  Chat.Message.create({ role: 'user', content: text });
});

let sleep_time = 0;

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

  if (raw.length === 0) return void console.warn('no answer received', list.data);
  console.debug('raw responses:', raw);

  for (let i = raw.length - 1; i !== -1; --i) {
    let text = raw[i]!;
    console.log(i, text);

    loop: while (text[0] === '[') {
      const end = text.indexOf(']');
      const parts = text.substring(1, end).split(' ');

      switch (parts[0]) {
        case 'OK': {
          if (text !== '[OK]') break loop;
          break;
        }

        case 'REPLY': {
          if (parts.length !== 2) break loop;

          const msg_id = parts[1]!;
          const colon = text.indexOf(':', 1 + end);
          const content = text.substring(1 + colon);
          text = text.substring(0, colon);
          await (client.channels.cache.get('645783743423840277') as TextChannel).send({
            reply: { messageReference: msg_id },
            content,
            allowedMentions: {
              repliedUser: false,
              roles: [],
            }
          }).catch(console.error);
          break;
        }

        case 'SEND': {
          if (parts.length !== 1) break loop;
          const colon = text.indexOf(':', 1 + end);
          const content = text.substring(1 + colon);
          text = text.substring(0, colon);
          if (content.length === 0) break loop;

          await (client.channels.cache.get('645783743423840277') as TextChannel).send({
            content,
            allowedMentions: {
              roles: [],
            }
          }).catch(console.error);
          break;
        }

        case 'SLEEP': {
          if (parts.length !== 2) break loop;

          const mins = +parts[1]!;
          if (isNaN(mins)) break loop;
          sleep_time += mins * 1_000 * 60;
          break;
        }

        case 'REACT': {
          if (parts.length !== 3) break loop;

          const [, messageid, emoji] = parts as [string, string, string];
          await (client.channels.cache.get('645783743423840277') as TextChannel).messages.cache.get(messageid)?.react(emoji)
            .catch(console.error);
          break;
        }
      }

      text = text.substring(1 + end).trimStart();
    }

    if (text.length !== 0) {
      console.warn('unexpected chat response:', text);
      await Chat.Message.create({ role: 'user', content: '[INVALID]' });
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
  sleep_time = 0;
}
cycle();

client.login(process.env.DISCORD_TOKEN);