/**
 * Slash command execution (`/status`, `/clear`, `/models`, `/compact`) and multi-step agentic
 * prompt turn loop for Olympus ACP sessions, including cache-write usage & USD cost tracking.
 */
import { randomUUID } from 'node:crypto';
import { RequestError } from '@agentclientprotocol/sdk/unstable';
import { advertiseSessionReady, buildConfigOptions, buildSystemInstructions, emitSessionUpdate, modelOptionValue, plainTextOfBlocks, promptBlocksToContent, steeredDisplayText, } from './acpConfig.js';
import { estimateCostUsd, streamChatCompletion, } from './providers.js';
import { applyContextPrunePlan, decideContextPruneFlush, planContextPrune, } from './contextPruner.js';
import { fetchOlympusCloudStatus } from './olympusCloud.js';
import { saveStoredSession } from './sessionStore.js';
import { BUILTIN_TOOL_SPECS, describeToolCall, executeBuiltinTool } from './tools.js';
const SEP = String.fromCharCode(47);
export async function runSessionPromptTurn(ctx) {
    const { prompt, signal, client, clientCaps, live, set, sessionCat, version, resolveModelPick, applyModelPick } = ctx;
    const ep = sessionCat.endpoint;
    const models = sessionCat.models;
    const rawUserText = plainTextOfBlocks(prompt);
    const trimmedCmd = rawUserText.trim();
    // Record user message for `session/load` replay.
    live.stored.updates.push({
        sessionUpdate: 'user_message_chunk',
        content: { type: 'text', text: rawUserText },
    });
    // Built-in local slash commands (`/status`, `/models`, `/clear`, `/compact`).
    if (trimmedCmd.startsWith(SEP)) {
        const spaceIdx = trimmedCmd.indexOf(' ');
        const cmdName = (spaceIdx >= 0 ? trimmedCmd.slice(1, spaceIdx) : trimmedCmd.slice(1)).toLowerCase();
        const cmdArg = spaceIdx >= 0 ? trimmedCmd.slice(spaceIdx + 1).trim() : '';
        if (cmdName === 'status') {
            const cloudStatus = ep.flavor === 'olympus-cloud' ? await fetchOlympusCloudStatus(ep.baseUrl, ep.headers) : undefined;
            const gwLabel = cloudStatus?.gatewayLabel ?? ep.label;
            const statusMd = [
                `**Olympus Native Agent** (\`v${version}\`)`,
                `- **Gateway**: ${gwLabel} (\`${ep.baseUrl}\`) · provider id \`${sessionCat.id}\``,
                ...(set.list.length > 1 ? [`- **Connected Providers**: ${set.list.map((c) => `\`${c.id}\``).join(', ')}`] : []),
                `- **Model**: \`${live.stored.model}\` (context window: ${live.stored.usage.contextSize.toLocaleString()} tokens)`,
                `- **Mode**: \`${live.stored.mode}\` · **Reasoning**: \`${live.stored.reasoning}\``,
                `- **Session Usage**: ${live.stored.usage.usedTokens.toLocaleString()} tokens${live.stored.usage.costUsd > 0 ? ` · $${live.stored.usage.costUsd.toFixed(4)}` : ''}`,
                ...(live.stored.pruner?.prunedToolCount
                    ? [
                        `- **Context Pruner**: ${live.stored.pruner.prunedToolCount} stale tool outputs collapsed (~${live.stored.pruner.savedTokensEstimate.toLocaleString()} tokens reclaimed${live.stored.pruner.lastFlushReason ? ` · ${live.stored.pruner.lastFlushReason}` : ''})`,
                    ]
                    : []),
                `- **Connected MCP Tools**: ${live.mcp.tools.size}`,
                ...(cloudStatus ? cloudStatus.lines : []),
            ].join('\n');
            await emitSessionUpdate(client, live, {
                sessionUpdate: 'agent_message_chunk',
                messageId: randomUUID(),
                content: { type: 'text', text: statusMd },
            });
            saveStoredSession(live.stored);
            return { stopReason: 'end_turn' };
        }
        if (cmdName === 'clear') {
            live.stored.messages = [];
            live.stored.todos = [];
            live.stored.usage.usedTokens = 0;
            live.stored.lastLlmCallAt = undefined;
            live.stored.pruner = undefined;
            saveStoredSession(live.stored);
            await emitSessionUpdate(client, live, {
                sessionUpdate: 'agent_message_chunk',
                messageId: randomUUID(),
                content: { type: 'text', text: 'Cleared conversation context for this session.' },
            });
            await advertiseSessionReady(client, live, models);
            return { stopReason: 'end_turn' };
        }
        if (cmdName === 'models') {
            if (cmdArg) {
                const pick = resolveModelPick(set, cmdArg, live.stored.providerId);
                applyModelPick(live.stored, pick, true);
                saveStoredSession(live.stored);
                await emitSessionUpdate(client, live, { sessionUpdate: 'config_option_update', configOptions: buildConfigOptions(live.stored, set) }, false);
                await advertiseSessionReady(client, live, pick.cat.models);
                await emitSessionUpdate(client, live, {
                    sessionUpdate: 'agent_message_chunk',
                    messageId: randomUUID(),
                    content: { type: 'text', text: `Switched active model to \`${pick.model}\` on ${pick.cat.label} (\`${pick.cat.id}\`).` },
                });
                return { stopReason: 'end_turn' };
            }
            const sections = set.list.map((cat) => {
                const top = cat.models
                    .slice(0, 20)
                    .map((m) => `- \`${modelOptionValue(set, cat.id, m.id)}\` — ${m.name} (${Math.round(m.contextSize / 1000)}k ctx)`)
                    .join('\n');
                return `**${cat.label}** (\`${cat.id}\`, ${cat.models.length} loaded)\n${top}`;
            });
            await emitSessionUpdate(client, live, {
                sessionUpdate: 'agent_message_chunk',
                messageId: randomUUID(),
                content: {
                    type: 'text',
                    text: `**Available Models** (active: \`${live.stored.model}\` on \`${sessionCat.id}\`):\n\n${sections.join('\n\n')}\n\nUse the Model selector below the chat box or run \`${SEP}models <model-id>\` (or \`${SEP}models <provider>::<model-id>\`) to switch.`,
                },
            });
            saveStoredSession(live.stored);
            return { stopReason: 'end_turn' };
        }
        if (cmdName === 'compact') {
            if (live.stored.messages.length < 2) {
                await emitSessionUpdate(client, live, {
                    sessionUpdate: 'agent_message_chunk',
                    messageId: randomUUID(),
                    content: { type: 'text', text: 'Conversation is already compact.' },
                });
                return { stopReason: 'end_turn' };
            }
            const summaryRes = await streamChatCompletion({
                baseUrl: ep.baseUrl,
                headers: ep.headers,
                model: live.stored.model,
                providerFlavor: ep.flavor,
                reasoning: 'low',
                messages: [
                    {
                        role: 'system',
                        content: 'Summarize the key decisions, modified files, architecture facts, and remaining tasks from this coding session concisely so work can continue seamlessly.',
                    },
                    ...live.stored.messages,
                    { role: 'user', content: 'Produce a dense technical handoff summary of our session so far.' },
                ],
                signal,
            });
            const compactCost = estimateCostUsd(summaryRes.usage, live.stored.model, models);
            if (compactCost !== undefined)
                live.stored.usage.costUsd += compactCost;
            live.stored.messages = [
                { role: 'user', content: '[Compacted Session Summary]\n' + summaryRes.content },
                { role: 'assistant', content: 'Understood. Continuing from the compacted session summary.' },
            ];
            live.stored.usage.usedTokens = summaryRes.usage.totalTokens;
            live.stored.lastLlmCallAt = Date.now();
            live.stored.pruner = undefined;
            saveStoredSession(live.stored);
            await emitSessionUpdate(client, live, {
                sessionUpdate: 'agent_message_chunk',
                messageId: randomUUID(),
                content: { type: 'text', text: `**Compacted context** (${summaryRes.usage.totalTokens.toLocaleString()} tokens):\n\n${summaryRes.content}` },
            });
            await advertiseSessionReady(client, live, models);
            return { stopReason: 'end_turn' };
        }
    }
    const userContent = promptBlocksToContent(prompt);
    live.stored.messages.push({ role: 'user', content: userContent });
    if (!live.stored.title && rawUserText.trim()) {
        live.stored.title = rawUserText.replace(/\s+/g, ' ').trim().slice(0, 60);
    }
    // Run cache-aware read-on-demand context pruning ONCE at the turn boundary (never mid-turn):
    // flushes immediately on local/uncached endpoints, or only at free cache boundaries on cloud providers.
    const prunePlan = planContextPrune(live.stored.messages, rawUserText);
    const pruneDecision = decideContextPruneFlush({
        flavor: ep.flavor,
        baseUrl: ep.baseUrl,
        lastLlmCallAt: live.stored.lastLlmCallAt,
        nowMs: Date.now(),
        usedTokens: live.stored.usage.usedTokens,
        contextSize: live.stored.usage.contextSize,
        plan: prunePlan,
    });
    if (pruneDecision.flush) {
        live.stored.pruner = applyContextPrunePlan(live.stored.messages, prunePlan, pruneDecision.reason, live.stored.pruner);
        saveStoredSession(live.stored);
    }
    const turnAbort = new AbortController();
    const onReqAbort = () => turnAbort.abort();
    signal.addEventListener('abort', onReqAbort, { once: true });
    live.abort = turnAbort;
    live.running = true;
    const totalTurnUsage = {
        inputTokens: 0,
        outputTokens: 0,
        thoughtTokens: 0,
        cachedReadTokens: 0,
        cachedWriteTokens: 0,
        totalTokens: 0,
    };
    try {
        const MAX_STEPS = 28;
        for (let step = 0; step < MAX_STEPS; step++) {
            if (turnAbort.signal.aborted) {
                saveStoredSession(live.stored);
                return { stopReason: 'cancelled', usage: totalTurnUsage };
            }
            // Drain any mid-turn steered messages injected by the user since the previous step.
            while (live.steeredQueue.length > 0) {
                const steered = live.steeredQueue.shift();
                live.stored.messages.push(steered);
                const steeredText = steeredDisplayText.get(steered) ?? (typeof steered.content === 'string' ? steered.content : '');
                if (steeredText) {
                    await emitSessionUpdate(client, live, {
                        sessionUpdate: 'user_message_chunk',
                        content: { type: 'text', text: steeredText },
                        _meta: { steering: true },
                    });
                }
            }
            // Keep tool declarations stable across plan/code/auto toggles so cloud & local KV caches stay warm;
            // `tools.ts` enforces read-only plan mode deterministically on edit_file/write_file.
            const mcpSpecs = [...live.mcp.tools.values()].map((t) => t.spec);
            const allTools = [...BUILTIN_TOOL_SPECS, ...mcpSpecs];
            const systemMessage = {
                role: 'system',
                content: buildSystemInstructions(live.stored.cwd, live.stored.mode, live.stored.systemPrompt),
            };
            const msgId = randomUUID();
            const thoughtId = randomUUID();
            const stepRes = await streamChatCompletion({
                baseUrl: ep.baseUrl,
                headers: ep.headers,
                model: live.stored.model,
                providerFlavor: ep.flavor,
                reasoning: live.stored.reasoning,
                messages: [systemMessage, ...live.stored.messages],
                tools: allTools,
                signal: turnAbort.signal,
                onDelta: async (ev) => {
                    if (ev.type === 'thought') {
                        await emitSessionUpdate(client, live, {
                            sessionUpdate: 'agent_thought_chunk',
                            messageId: thoughtId,
                            content: { type: 'text', text: ev.text },
                        });
                    }
                    else {
                        await emitSessionUpdate(client, live, {
                            sessionUpdate: 'agent_message_chunk',
                            messageId: msgId,
                            content: { type: 'text', text: ev.text },
                        });
                    }
                },
            });
            totalTurnUsage.inputTokens += stepRes.usage.inputTokens;
            totalTurnUsage.outputTokens += stepRes.usage.outputTokens;
            totalTurnUsage.thoughtTokens += stepRes.usage.thoughtTokens;
            totalTurnUsage.cachedReadTokens += stepRes.usage.cachedReadTokens;
            totalTurnUsage.cachedWriteTokens += (stepRes.usage.cachedWriteTokens ?? 0) + (stepRes.usage.cachedWrite1hTokens ?? 0);
            totalTurnUsage.totalTokens += stepRes.usage.totalTokens;
            const stepCost = estimateCostUsd(stepRes.usage, live.stored.model, models);
            if (stepCost !== undefined) {
                live.stored.usage.costUsd += stepCost;
            }
            if (stepRes.usage.totalTokens > 0) {
                live.stored.usage.usedTokens = stepRes.usage.totalTokens;
            }
            live.stored.lastLlmCallAt = Date.now();
            await emitSessionUpdate(client, live, {
                sessionUpdate: 'usage_update',
                used: live.stored.usage.usedTokens,
                size: live.stored.usage.contextSize,
                ...(live.stored.usage.costUsd > 0 ? { cost: { amount: live.stored.usage.costUsd, currency: 'USD' } } : {}),
                _meta: { '_claude/model': stepRes.model ?? live.stored.model },
            }, false);
            live.stored.messages.push({
                role: 'assistant',
                content: stepRes.content || null,
                ...(stepRes.toolCalls.length ? { tool_calls: stepRes.toolCalls } : {}),
                ...(stepRes.anthropicBlocks?.length ? { anthropicBlocks: stepRes.anthropicBlocks } : {}),
            });
            saveStoredSession(live.stored);
            if (!stepRes.toolCalls.length) {
                if (live.steeredQueue.length > 0)
                    continue;
                return {
                    stopReason: stepRes.finishReason === 'length' ? 'max_tokens' : 'end_turn',
                    usage: totalTurnUsage,
                };
            }
            // Execute every tool call requested in this step sequentially so file edits & permissions stay deterministic.
            for (const tc of stepRes.toolCalls) {
                if (turnAbort.signal.aborted) {
                    saveStoredSession(live.stored);
                    return { stopReason: 'cancelled', usage: totalTurnUsage };
                }
                let parsedArgs = {};
                try {
                    const raw = JSON.parse(tc.function.arguments || '{}');
                    if (raw && typeof raw === 'object' && !Array.isArray(raw))
                        parsedArgs = raw;
                }
                catch {
                    parsedArgs = {};
                }
                const mcpTool = live.mcp.tools.get(tc.function.name);
                const meta = mcpTool
                    ? { kind: 'other', title: tc.function.name, locations: undefined }
                    : describeToolCall(tc.function.name, parsedArgs, live.stored.cwd);
                await emitSessionUpdate(client, live, {
                    sessionUpdate: 'tool_call',
                    toolCallId: tc.id,
                    title: meta.title,
                    name: tc.function.name,
                    kind: meta.kind,
                    status: 'in_progress',
                    rawInput: parsedArgs,
                    ...(meta.locations ? { locations: meta.locations } : {}),
                });
                try {
                    if (mcpTool) {
                        const mcpOut = await mcpTool.call(parsedArgs);
                        await emitSessionUpdate(client, live, {
                            sessionUpdate: 'tool_call_update',
                            toolCallId: tc.id,
                            status: 'completed',
                            rawOutput: mcpOut,
                            content: [{ type: 'content', content: { type: 'text', text: mcpOut } }],
                        });
                        live.stored.messages.push({
                            role: 'tool',
                            tool_call_id: tc.id,
                            name: tc.function.name,
                            content: mcpOut,
                        });
                    }
                    else {
                        const outcome = await executeBuiltinTool(tc.function.name, parsedArgs, tc.id, {
                            sessionId: live.stored.sessionId,
                            cwd: live.stored.cwd,
                            additionalDirectories: live.stored.additionalDirectories ?? [],
                            mode: live.stored.mode,
                            signal: turnAbort.signal,
                            clientCtx: client,
                            clientCaps,
                            onTodosUpdated: async (todos) => {
                                live.stored.todos = todos;
                                await emitSessionUpdate(client, live, {
                                    sessionUpdate: 'plan',
                                    entries: todos,
                                });
                            },
                            onTerminalCreated: async (terminalId) => {
                                await emitSessionUpdate(client, live, {
                                    sessionUpdate: 'tool_call_update',
                                    toolCallId: tc.id,
                                    status: 'in_progress',
                                    content: [{ type: 'terminal', terminalId }],
                                }, false);
                            },
                        });
                        await emitSessionUpdate(client, live, {
                            sessionUpdate: 'tool_call_update',
                            toolCallId: tc.id,
                            title: outcome.title,
                            status: outcome.isError ? 'failed' : 'completed',
                            ...(outcome.locations ? { locations: outcome.locations } : {}),
                            rawOutput: outcome.output,
                            ...(outcome.acpContent ? { content: outcome.acpContent } : {}),
                        });
                        live.stored.messages.push({
                            role: 'tool',
                            tool_call_id: tc.id,
                            name: tc.function.name,
                            content: outcome.output,
                        });
                    }
                }
                catch (toolErr) {
                    if (turnAbort.signal.aborted) {
                        saveStoredSession(live.stored);
                        return { stopReason: 'cancelled', usage: totalTurnUsage };
                    }
                    const errText = `Tool error: ${toolErr?.message ?? String(toolErr)}`;
                    await emitSessionUpdate(client, live, {
                        sessionUpdate: 'tool_call_update',
                        toolCallId: tc.id,
                        status: 'failed',
                        rawOutput: errText,
                        content: [{ type: 'content', content: { type: 'text', text: errText } }],
                    });
                    live.stored.messages.push({
                        role: 'tool',
                        tool_call_id: tc.id,
                        name: tc.function.name,
                        content: errText,
                    });
                }
                saveStoredSession(live.stored);
            }
        }
        return { stopReason: 'max_turn_requests', usage: totalTurnUsage };
    }
    catch (err) {
        if (turnAbort.signal.aborted) {
            saveStoredSession(live.stored);
            return { stopReason: 'cancelled', usage: totalTurnUsage };
        }
        const errMsg = String(err?.message ?? err);
        if (/Authentication failed|\(401\)|\(403\)/i.test(errMsg)) {
            throw RequestError.authRequired(undefined, errMsg);
        }
        throw err;
    }
    finally {
        if (turnAbort.signal.aborted) {
            live.steeredQueue.length = 0;
        }
        signal.removeEventListener('abort', onReqAbort);
        live.running = false;
        live.abort = undefined;
        saveStoredSession(live.stored);
    }
}
//# sourceMappingURL=acpPromptTurn.js.map