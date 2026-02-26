# Independence Plan: Replacing @mariozechner/pi-* packages

## Status: FULLY FEASIBLE

The pi-agent-core package is only **307 lines of JavaScript**. It's elegant but simple.

## What pi-agent-core Does (the entire thing)

### agentLoop(prompts, context, config, signal, streamFn)
1. Push prompts into context
2. Enter outer loop (handles follow-up messages)
3. Inner loop: 
   a. Check for steering messages (user typed while agent was working)
   b. Inject pending messages into context
   c. Call `streamAssistantResponse()` → gets LLM response
   d. If response has tool calls → execute them sequentially
   e. After each tool: check for steering messages (user interrupts)
   f. After turn: check for more steering messages
   g. Repeat while tool calls exist or steering messages pending
4. After inner loop: check for follow-up messages
5. If follow-ups exist, loop back to step 3
6. Emit agent_end, return all new messages

### streamAssistantResponse(context, config, signal, stream, streamFn)
1. Apply transformContext (optional context pruning)
2. Convert AgentMessage[] → Message[] via convertToLlm
3. Build LLM context (systemPrompt + messages + tools)
4. Call streamSimple (or custom streamFn) with model + context
5. Stream events: start → text/thinking/toolcall deltas → done
6. Return final assistant message

### executeToolCalls(tools, message, signal, stream, getSteeringMessages)
1. For each tool call in the assistant message:
   a. Find tool by name
   b. Validate arguments
   c. Execute tool.execute()
   d. Collect result
   e. Check for steering messages (user interrupt → skip remaining tools)
2. Return tool results + any steering messages

## What pi-ai Does
- `streamSimple()` — unified LLM streaming (Anthropic, OpenAI, Google, Bedrock)
- `EventStream` — async iterable event stream
- `validateToolArguments()` — JSON schema validation for tool args
- Model catalog — huge list of model definitions
- Types — Message, Tool, Model, Content types

## Replacement Strategy

### Phase 1: Wrapper (Quick Independence)
- Keep using pi-* as vendored packages (already done)
- No npm dependency — we control the code
- Can patch/modify as needed

### Phase 2: Port pi-agent-core (~1 day of work)
- Rewrite 307 lines as `src/core/agent-loop.ts`
- Same interface, our code
- The logic is straightforward event-driven streaming

### Phase 3: Port pi-ai (~1 week of work)  
- Replace streamSimple with direct provider SDK calls
- Already have provider code in `src/providers/`
- The model catalog is just data — can regenerate
- EventStream is a simple async iterable pattern

### Phase 4: Remove pi-coding-agent & pi-tui
- Coding agent functionality can be inlined
- TUI components only needed for terminal mode (not critical for 24/7 gateway)

## Risk Assessment
- **Low risk**: pi-agent-core is simple, well-documented via types
- **Medium risk**: pi-ai has more surface area but OpenClaw already wraps it heavily  
- **Low urgency**: Vendored copies mean we're not dependent on npm updates
- **High value**: Full code ownership = can modify anything

## Current State
- ✅ Full codebase forked to ~/spryte-engine/
- ✅ pi-* packages vendored (compiled JS + types)
- ✅ Architecture documented
- ⬜ Phase 2: Port agent-loop
- ⬜ Phase 3: Port streaming/providers
- ⬜ Phase 4: Remove remaining deps
