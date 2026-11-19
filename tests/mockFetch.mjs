/**
 * Shared sandbox-safe SSE / fetch mock harness for `tests/olympusCli.unit.mjs` and `tests/providerStore.cases.mjs`.
 */

export const SEP = String.fromCharCode(47);
export const mockBaseUrl = `https:${SEP}${SEP}mock-openrouter.olympus.test${SEP}api${SEP}v1`;
export const mockSecondUrl = `https:${SEP}${SEP}mock-second.olympus.test${SEP}v1`;

export function sseResponse(frames) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      for (const frame of frames) {
        const line = frame === '[DONE]' ? 'data: [DONE]\n\n' : `data: ${JSON.stringify(frame)}\n\n`;
        const half = Math.floor(line.length / 2);
        controller.enqueue(encoder.encode(line.slice(0, half)));
        await new Promise((r) => setTimeout(r, 1));
        controller.enqueue(encoder.encode(line.slice(half)));
      }
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  });
}

export function installMockGatewayFetch(curatedFirstId) {
  const state = {
    requestLog: [],
    rejectCompatOnce: false,
    onFirstStepToolIssued: null,
  };

  const realFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    const method = (init.method || 'GET').toUpperCase();
    if (url.startsWith(mockSecondUrl)) {
      if (method === 'GET' && url.endsWith('models')) {
        return new Response(
          JSON.stringify({
            data: [
              { id: 'second-only-model', name: 'Second Only Model', context_length: 32768 },
              { id: curatedFirstId, name: 'Shared Model' },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      if (method === 'POST' && url.endsWith('completions')) {
        const body = JSON.parse(String(init.body || '{}'));
        state.requestLog.push({ url, headers: init.headers, body });
        return sseResponse([
          { model: body.model, choices: [{ delta: { content: 'PONG_FROM_SECOND' } }] },
          { choices: [{ delta: {}, finish_reason: 'stop' }], usage: { prompt_tokens: 9, completion_tokens: 3, total_tokens: 12 } },
          '[DONE]',
        ]);
      }
      return new Response('not found', { status: 404 });
    }
    if (!url.startsWith(`https:${SEP}${SEP}mock-openrouter.olympus.test`)) {
      return realFetch(input, init);
    }
    if (method === 'GET' && url.endsWith('models')) {
      return new Response(
        JSON.stringify({
          data: [
            {
              id: curatedFirstId,
              name: 'Claude Sonnet 5.5',
              context_length: 1000000,
              pricing: { prompt: '0.000002', completion: '0.00001' },
            },
            {
              id: 'martian-custom-coder-v1',
              name: 'Martian Custom Coder v1',
              context_length: 131072,
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }

    if (method === 'POST' && url.endsWith('completions')) {
      const body = JSON.parse(String(init.body || '{}'));
      state.requestLog.push({ url, headers: init.headers, body });

      if (state.rejectCompatOnce && (body.reasoning || body.reasoning_effort)) {
        state.rejectCompatOnce = false;
        return new Response(
          JSON.stringify({ error: { message: 'Unrecognized request argument: reasoning_effort' } }),
          { status: 400, headers: { 'content-type': 'application/json' } },
        );
      }

      const msgs = body.messages || [];
      const lastMsg = msgs[msgs.length - 1] || {};
      const allUserText = msgs
        .filter((m) => m.role === 'user')
        .map((m) => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content)))
        .join('\n');

      if (allUserText.includes('handoff summary')) {
        return sseResponse([
          { model: body.model, choices: [{ delta: { content: 'Updated app.ts greeting and verified terminal + MCP tools.' } }] },
          { choices: [{ delta: {}, finish_reason: 'stop' }], usage: { prompt_tokens: 80, completion_tokens: 16, total_tokens: 96, cost: 0.0005 } },
          '[DONE]',
        ]);
      }

      if (allUserText.includes('Reply with PONG')) {
        return sseResponse([
          { model: body.model, choices: [{ delta: { content: 'PONG_FROM_OLYMPUS_CLI' } }] },
          { choices: [{ delta: {}, finish_reason: 'stop' }], usage: { prompt_tokens: 20, completion_tokens: 5, total_tokens: 25 } },
          '[DONE]',
        ]);
      }

      const hasToolResults = msgs.some((m) => m.role === 'tool');
      if (!hasToolResults && lastMsg.role === 'user') {
        const targetTs = ['app', 'ts'].join('.');
        const calls = [
          { index: 0, id: 'call_todo', type: 'function', function: { name: 'todo_write', arguments: JSON.stringify({ todos: [{ content: `Update ${targetTs}`, status: 'in_progress', priority: 'high' }] }) } },
          { index: 1, id: 'call_read', type: 'function', function: { name: 'read_file', arguments: JSON.stringify({ path: targetTs }) } },
          { index: 2, id: 'call_edit', type: 'function', function: { name: 'edit_file', arguments: JSON.stringify({ path: targetTs, old_string: 'UNSAVED_VALUE = 1', new_string: 'UNSAVED_VALUE = 42' }) } },
          { index: 3, id: 'call_cmd', type: 'function', function: { name: 'run_command', arguments: JSON.stringify({ command: 'echo build-ok', description: 'Verify build' }) } },
          { index: 4, id: 'call_mcp', type: 'function', function: { name: 'mcp__olympus__session_info', arguments: '{}' } },
        ];
        if (state.onFirstStepToolIssued) setTimeout(() => state.onFirstStepToolIssued(), 5);
        return sseResponse([
          { model: body.model, choices: [{ delta: { reasoning: 'Inspecting unsaved buffer, editing file, running command, and calling MCP.' } }] },
          ...calls.map((tc) => ({ choices: [{ delta: { tool_calls: [tc] } }] })),
          { choices: [{ delta: {}, finish_reason: 'tool_calls' }], usage: { prompt_tokens: 120, completion_tokens: 60, completion_tokens_details: { reasoning_tokens: 18 }, total_tokens: 180, cost: 0.0012 } },
          '[DONE]',
        ]);
      }

      const sawSteer = allUserText.includes('STEER_NOTE_EXTRA');
      const toolOutputs = msgs.filter((m) => m.role === 'tool').map((m) => m.content).join('\n');
      return sseResponse([
        { model: body.model, choices: [{ delta: { content: `<think>Verifying all tool results.</think>\nCompleted! Steered=${sawSteer}; MCP=${toolOutputs.includes('ORCHESTRATOR_OK')}` } }] },
        { choices: [{ delta: {}, finish_reason: 'stop' }], usage: { prompt_tokens: 200, completion_tokens: 30, total_tokens: 230, cost: 0.0018 } },
        '[DONE]',
      ]);
    }

    return new Response('not found', { status: 404 });
  };

  return state;
}
