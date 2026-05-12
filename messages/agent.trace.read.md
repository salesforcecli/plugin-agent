# summary

Read trace files from an agent preview session.

# description

When you run an agent preview conversation (either interactive or programmatic), trace files are automatically recorded and saved in your local DX project. Each turn (utterance or response) of a conversation creates trace data. Use this command to view trace data for a specific preview session, so you can then analyze the trace data to observe, monitor, investigate, and troubleshoot agent events and behavior.

Use the --format flag to specify one of these formats of the outputted trace data:

- summary (Default): A per-turn narrative showing topic routing, actions executed, and the agent's response. Use this to quickly understand what happened in a preview session.
- detail: Diagnostic drill-down into a specific dimension. Filters output to only the trace steps relevant to that dimension, minimizing noise.
- raw: Unprocessed trace JSON. Use this as a fallback when the trace schema has changed or you need to perform custom analysis.

If you specify "--format detail", you must also specify a dimension with the --dimension flag. Dimensions are a way to slice and analyze the agent execution trace from a specific angle or concern. Instead of looking at the raw sequence of everything that happened, each dimension filters and organizes the trace data to answer a specific type of question. These are the available dimensions and the information they provide:

- actions: The actions the agent executed. Includes action name, input parameters, output, and latency. Use this dimension to understand what the agent actually did when answering an utterance in the preview session.
- grounding: The reasoning steps used by the LLM. Use this dimension to see how the agent "thought" about the problem - the AI reasoning that determined which actions to take.
- routing: How the agent navigated between subagents. Use this dimension to understand conversation flow - when and why the agent switched between different subagents or contexts during the conversation.
- errors: Aggregates all errors during the session. Use this dimension to quickly identify and debug issues across all steps.

# flags.session-id.summary

Session ID to read traces for. Use the "agent preview sessions" CLI command to list all known agent preview sessions along with their session IDs

# flags.format.summary

Output format of the trace data; specifies the level of detail you want in the trace files.

# flags.dimension.summary

Dimension to drill into when using "--format detail"; used to filter and organize the trace data to answer a specific type of question.

# flags.turn.summary

Turn number for which you want trace data. A turn is a single utterance or response in a conversation, starting with 1.

# error.detailRequiresDimension

The "--format detail" flag requires --dimension. Specify one of: actions, grounding, routing, errors.

# error.sessionNotFound

Session '%s' wasn't found in the local session cache. Run "sf agent trace list" to see available sessions.

# error.turnIndexNotFound

No turn index found for session '%s'. Can't filter by --turn without a turn index.

# error.turnNotFound

Turn %s wasn't found in session '%s'.

# error.parseFailedAll

Trace parsing failed for all files: %s. The trace schema may have changed. Try "--format raw" to access unprocessed trace data.

# warn.dimensionIgnored

The --dimension flag is ignored when --format is '%s'. Use "--format detail" to drill into a dimension.

# warn.parseFailed

Trace parsing failed for some files (skipped): %s. Try "--format raw" to access unprocessed trace data.

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

- Show a session trace summary for all turns in the session with the specified ID:

  <%= config.bin %> <%= command.id %> --session-id <SESSION_ID>

- Show a trace summary for the second turn (utterance or response) of the conversation:

  <%= config.bin %> <%= command.id %> --session-id <SESSION_ID> --turn 2

- Drill into action execution across all turns:

  <%= config.bin %> <%= command.id %> --session-id <SESSION_ID> --format detail --dimension actions

- Drill into routing decisions for the first turn of the conversation:

  <%= config.bin %> <%= command.id %> --session-id <SESSION_ID> --format detail --dimension routing --turn 1

- Show all errors across the session:

  <%= config.bin %> <%= command.id %> --session-id <SESSION_ID> --format detail --dimension errors

- Output raw trace JSON for custom parsing:

  <%= config.bin %> <%= command.id %> --session-id <SESSION_ID> --format raw

- Return results as JSON:

  <%= config.bin %> <%= command.id %> --session-id <SESSION_ID> --json
