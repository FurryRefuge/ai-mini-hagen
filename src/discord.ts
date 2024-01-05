import { Client, GatewayIntentBits, TextChannel } from 'discord.js';

export namespace Discord {
  export const client = new Client({
    intents: 0
      | GatewayIntentBits.Guilds
      | GatewayIntentBits.GuildMessages
      | GatewayIntentBits.MessageContent
    ,
  });

  client.once('ready', () => {
    console.log(`Logged in as ${Discord.client.user!.tag}!`);
    channel = client.channels.cache.get('645783743423840277') as TextChannel;
  });

  export let channel: TextChannel;
}