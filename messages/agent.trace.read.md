# summary

Read and analyze trace files from an agent preview session.

# description

Reads trace files recorded during an agent preview session and outputs them in one of three formats.

**--format summary** (default): A per-turn narrative showing topic routing, actions executed, and the agent's response. Use this to quickly understand what happened in a session.

**--format detail**: Diagnostic drill-down into a specific dimension (--dimension required). Filters output to only the trace steps relevant to that dimension, minimizing noise.

**--format raw**: Unprocessed trace JSON. Use this as a fallback when the trace schema has changed or you need to perform custom analysis.

Available dimensions for --format detail: actions, grounding, routing, errors.

Use --turn N to scope output to a single conversation turn.

# flags.session-id.summary

Session ID to read traces for.

# flags.format.summary

Output format: summary (default), detail, or raw. Use detail with --dimension to drill into a specific aspect of the trace.

# flags.dimension.summary

Dimension to drill into when using --format detail. One of: actions, grounding, routing, errors. Required when --format is detail.

# flags.turn.summary

Scope output to this conversation turn number.

# error.detailRequiresDimension

--format detail requires --dimension. Specify one of: actions, grounding, routing, errors.

# error.sessionNotFound

Session '%s' was not found in the local session cache. Run "sf agent trace list" to see available sessions.

# error.turnIndexNotFound

No turn index found for session '%s'. Cannot filter by --turn without a turn index.

# error.turnNotFound

Turn %s was not found in session '%s'.

# error.parseFailedAll

Trace parsing failed for all files: %s. The trace schema may have changed. Try --format raw to access unprocessed trace data.

# warn.dimensionIgnored

--dimension is ignored when --format is '%s'. Use --format detail to drill into a dimension.

# warn.parseFailed

Trace parsing failed for some files (skipped): %s. Try --format raw to access unprocessed trace data.

# output.empty

No traces found for this session.

# output.emptyDimension

No '%s' data found in the traces for this session.

# output.tableHeader.turn

Turn

# output.tableHeader.topic

Topic

# output.tableHeader.userInput

User Input

# output.tableHeader.agentResponse

Agent Response

# output.tableHeader.actionsExecuted

Actions Executed

# output.tableHeader.latencyMs

Latency

# output.tableHeader.error

Error

# output.tableHeader.action

Action

# output.tableHeader.input

Input

# output.tableHeader.output

Output

# output.tableHeader.prompt

Prompt

# output.tableHeader.response

Response

# output.tableHeader.intent

Intent

# output.tableHeader.fromTopic

From Topic

# output.tableHeader.toTopic

To Topic

# output.tableHeader.source

Source

# output.tableHeader.errorCode

Error Code

# output.tableHeader.message

Message

# examples

- Show a session summary (all turns):

  <%= config.bin %> <%= command.id %> --session-id <SESSION_ID>

- Show summary for a single turn:

  <%= config.bin %> <%= command.id %> --session-id <SESSION_ID> --turn 2

- Drill into action execution across all turns:

  <%= config.bin %> <%= command.id %> --session-id <SESSION_ID> --format detail --dimension actions

- Drill into routing decisions for a specific turn:

  <%= config.bin %> <%= command.id %> --session-id <SESSION_ID> --format detail --dimension routing --turn 1

- Show all errors across the session:

  <%= config.bin %> <%= command.id %> --session-id <SESSION_ID> --format detail --dimension errors

- Output raw trace JSON for custom parsing:

  <%= config.bin %> <%= command.id %> --session-id <SESSION_ID> --format raw

- Return results as JSON:

  <%= config.bin %> <%= command.id %> --session-id <SESSION_ID> --json
