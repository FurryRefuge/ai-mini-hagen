import OpenAI from 'openai';
import { Data, data } from './data.js';
import { setTimeout } from 'node:timers/promises';
import { inspect } from 'node:util';
import fs from 'node:fs';
import { Functions } from './functions.js';
import assert from 'node:assert/strict';
import path from 'node:path';
import { Logger } from './logger.js';

// import { inspect } from 'node:util';

const openai = new OpenAI();

if (!data.assistant_id) {
  console.warn('no assitantid. creating...');
  const assistant = await openai.beta.assistants.create({
    name: 'Mini Hagen',
    instructions: fs.readFileSync(path.join(__rootname, 'src', 'persona.txt'), 'utf8'),
    model: 'gpt-3.5-turbo-1106',
    tools: [{ type: 'retrieval' }, ...Functions.tools],
  });

  data.assistant_id = assistant.id;
  Data.write();
}

/* @ts-expect-error */
Functions.tools = undefined;

if (!data.thread_id) {
  console.warn('no threadid. creating...');
  const thread = await openai.beta.threads.create();
  data.thread_id = thread.id;
  Data.write();
}

const { thread_id, assistant_id } = data;

// console.log(inspect(await openai.beta.threads.messages.list(thread_id), { depth: Infinity, colors: true }))

export namespace Chat {
  export namespace Message {
    export let count = 0;
    export let pending_count_for_run = 0;
    export async function create(body: OpenAI.Beta.Threads.Messages.MessageCreateParams) {
      await setTimeout(50);
      while (Run.active) await setTimeout(500);
      ++pending_count_for_run;
      ++count;
      console.debug('sent message', body);
      const msg = await openai.beta.threads.messages.create(thread_id, body);
      Logger.add_user_message(body);
      --count;
      return msg;
    }

    export function list(query?: OpenAI.Beta.Threads.Messages.MessageListParams | undefined) {
      return openai.beta.threads.messages.list(thread_id, query);
    }
  }

  export namespace Run {
    export let active = false;
    export async function create_and_wait() {
      if (active) return;
      active = true;

      while (Message.count !== 0) await setTimeout(500);
      Message.pending_count_for_run = 0;

      console.debug('created and waiting run task');
      const run = await openai.beta.threads.runs.create(thread_id, { assistant_id });

      let is_done = false;
      let attempts = 0;

      do {
        await setTimeout(1_000);
        is_done = await Run.has_stopped(run.id);
        ++attempts;
      } while (is_done === false && attempts <= 5);
      active = false;
    }

    export async function has_stopped(id) {
      const run = await openai.beta.threads.runs.retrieve(
        thread_id,
        id
      );

      console.log('status:', run.status);

      switch (run.status) {
        case 'queued':
        case 'in_progress': return false;
        case 'requires_action': {
          const { required_action } = run;
          assert.ok(required_action !== null);

          Logger.add_tool_calls(required_action.submit_tool_outputs.tool_calls);

          (async () => {
            const tool_outputs: (OpenAI.Beta.Threads.Runs.RunSubmitToolOutputsParams.ToolOutput & { name: string })[] = [];

            const _ = async (call: OpenAI.Beta.Threads.Runs.RequiredActionFunctionToolCall) => {
              const func = Functions.mapping[call.function.name];
              if (!func) {
                void console.error('incorrect function tool name', call);
                tool_outputs.push({
                  name: call.function.name,
                  tool_call_id: call.id,
                  output: 'error: invalid function',
                })
                return;
              }

              const res = await func(JSON.parse(call.function.arguments));

              tool_outputs.push({
                name: call.function.name,
                tool_call_id: call.id,
                output: res ?? 'done',
              });
            }

            for (const call of required_action.submit_tool_outputs.tool_calls)
              await _(call);

            Logger.add_tool_outputs(tool_outputs);

            if (tool_outputs.length) {
              for (const output of tool_outputs)
                /* @ts-expect-error */
                delete output.name;

              await openai.beta.threads.runs.submitToolOutputs(data.thread_id, run.id, { tool_outputs });
            }
          })();

          return false;
        }
        case 'cancelling':
        case 'cancelled':
        case 'failed':
          console.debug(inspect(run, { depth: Infinity, colors: true }));
          return true;
        case 'completed':
        case 'expired':
        default:
          return true;
      }
    }
  }
}