import type { OpenAI } from 'openai';
import { Discord } from './discord.js';
import type { Message } from 'discord.js';

export namespace Functions {
  export const mapping = {};
  export let tools: Exclude<OpenAI.Beta.AssistantCreateParams['tools'], undefined> = [];

  namespace Error {
    function error(text: string) {
      return JSON.stringify({ error: text });
    }

    export const InvalidArgs = error('invalid arguments');
  };

  { // setup
    const functions: Record<OpenAI.FunctionDefinition['name'], Omit<OpenAI.FunctionDefinition, 'name'>
      & { call: (args: { [k: string]: string }) => string | void | Promise<string | void> }> =
    {
      get_current_date: {
        description: 'get current ISO 8601 date and time',
        call: () => JSON.stringify(new Date().toISOString()),
      },

      react: {
        description: 'use Discord\'s reaction feature and add a UTF-8 emoji to a message',
        parameters: {
          type: 'object',
          properties: {
            messageid: {
              type: 'string',
              description: 'the messageid to react',
            },
            emoji: {
              type: 'string',
              description: 'the UTF-8 emoji to react with',
            },
          },
          required: ['messageid', 'emoji'],
        },
        call: ({ messageid, emoji }) => {
          if (!messageid || !emoji) return Error.InvalidArgs;

          return void Discord.channel.messages.cache.get(messageid)?.react(emoji)
            .catch(console.error);
        },
      },

      reply: {
        description: 'send a message using Discord\'s reply feature',
        parameters: {
          type: 'object',
          properties: {
            messageid: {
              type: 'string',
              description: 'the messageid to reply to',
            },
            content: {
              type: 'string',
              description: 'the content of your message',
            },
          },
          required: ['messageid', 'content'],
        },
        call: ({ messageid, content }) => {
          if (!messageid || !content) return Error.InvalidArgs;

          return void Discord.channel.send({
            content,
            reply: { messageReference: messageid, failIfNotExists: false },
            allowedMentions: {
              repliedUser: false,
              roles: [],
            },
          }).catch(console.error);
        },
      },

      send: {
        description: 'send a message',
        parameters: {
          type: 'object',
          properties: {
            content: {
              type: 'string',
              description: 'the content of your message',
            },
          },
          required: ['content'],
        },
        call: ({ content }) => {
          if (!content) return Error.InvalidArgs;

          return void Discord.channel.send({
            content,
            allowedMentions: {
              roles: [],
            },
          }).catch(console.error);
        },
      },

      flag: {
        description: 'report rule-breaking messages to the moderation team',
        parameters: {
          type: 'object',
          properties: {
            messageid: {
              type: 'string',
              description: 'the messageid to flag',
            },
            reason: {
              type: 'string',
              description: 'the reason for the flag',
            },
          },
          required: ['messageid', 'reason'],
        },
        call: ({ messageid, reason }) => {
          if (!messageid || !reason) return Error.InvalidArgs;

          return void Discord.channel.send({
            content: `ChatGPT flagged this message${reason ? ` for: ${reason}` : ''}`,
            reply: {
              failIfNotExists: false,
              messageReference: messageid,
            },
            allowedMentions: {
              repliedUser: false,
              roles: [],
            },
          }).catch(console.error);
        },
      },

      fetch_message: {
        description: 'fetch a message',
        parameters: {
          type: 'object',
          properties: {
            messageid: {
              type: 'string',
              description: 'the messageid to fetch',
            },
          },
          required: ['messageid'],
        },
        call: ({ messageid }) => {
          if (!messageid) return Error.InvalidArgs;

          const message = Discord.channel.messages.cache.get(messageid);
          if (message) {
            return Internal.fetch_message(message);
          } else {
            return Discord.channel.messages.fetch(messageid)
              .then(Internal.fetch_message)
              .catch(console.error);
          }
        }
      },
    };

    for (const key in functions) {
      const val = functions[key]!;
      const def = val as unknown as OpenAI.FunctionDefinition;
      def.name = key;
      mapping[key] = val.call;
      /* @ts-expect-error */
      delete val.call;
      tools.push({
        type: 'function',
        function: def,
      });
    }
  }

  namespace Internal {
    export function fetch_message(message: Message<true>) {
      const obj = {
        display_name: message.member?.displayName ?? message.author.displayName,
        userid: message.author.id,
        content: message.content,
      } as Record<string, string>;

      if (message.reference?.messageId) {
        obj.replyid = message.reference.messageId;
      }

      return JSON.stringify(obj);
    }
  }
}