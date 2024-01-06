import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import type { OpenAI } from 'openai';
import { data } from './data.js';

const loc = path.join('.', 'data', 'logs');
if (!fs.existsSync(loc))
  fs.mkdirSync(loc, { recursive: true });

export namespace Logger {
  const cur_log = path.join(loc, `${Date.now()}.json`);
  const messages: { role: 'user' | 'assistant' | 'function', content?: string | undefined, name?: string, function_call?: OpenAI.Beta.Threads.Runs.RequiredActionFunctionToolCall.Function }[] = [];

  export function add_assistant_message(content: string) {
    messages.push({
      role: 'assistant',
      content,
    });

    schedule_write();
  }

  export function add_user_message(msg: OpenAI.Beta.Threads.Messages.MessageCreateParams) {
    messages.push({
      role: msg.role,
      content: msg.content,
    });

    schedule_write();
  }

  export function add_tool_calls(calls: OpenAI.Beta.Threads.Runs.RequiredActionFunctionToolCall[]) {
    for (const call of calls)
      messages.push({
        role: 'assistant',
        function_call: call.function,
      });

    schedule_write();
  }

  export function add_tool_outputs(outputs: (OpenAI.Beta.Threads.Runs.RunSubmitToolOutputsParams.ToolOutput & { name: string })[]) {
    for (const output of outputs)
      messages.push({
        role: 'function',
        name: output.name,
        content: output.output,
      });

    schedule_write();
  }

  const lock = Promise.resolve();
  let write_scheduled = false;
  function schedule_write() {
    if (write_scheduled === true) return;
    write_scheduled = true;
    lock.finally(write);
  }

  function write() {
    write_scheduled = false;
    return fsp.writeFile(cur_log, JSON.stringify({
      thread_id: data.thread_id,
      messages,
    }, null, 2), 'utf8');
  }
}