# summary

List the available trace files that were recorded during all agent preview sessions.

# description

When you run an agent preview conversation (either interactive or programmatic), trace files are automatically recorded and saved in your local DX project. By default, this command lists all trace files for all agents and all of their sessions. Use flags to narrow results: filter by agent name (--agent), by session (--session-id), or by date (--since).

Each row in the output corresponds to one trace file, which in turn corresponds to one agent session. The Agent column shows the authoring bundle or API name used when starting the session.

# flags.agent.summary

API name of the agent used to filter the list of available trace files. Matches against the API name used when starting the session, either an authoring bundle or a published agent API name.

# flags.session-id.summary

Session ID used to filter the list of trace files. Use the "agent preview sessions" CLI command to list all known agent preview sessions along with their session IDs.

# flags.since.summary

Date used to filter the list of trace files; only those recorded on or after the date are listed.

# flags.since.description

Accepts ISO 8601 format: date-only (2026-04-20), date-time (2026-04-20T14:00:00Z), or date-time with milliseconds (2026-04-20T14:00:00.000Z). The "Recorded At" values shown in the table output are valid inputs.

# error.invalidSince

Invalid --since value: '%s'. Use ISO 8601 format — date-only (2026-04-20), date-time (2026-04-20T14:00:00Z), or with milliseconds (2026-04-20T14:00:00.000Z). The "Recorded At" values shown in the table output are valid inputs.

# output.empty

No trace files found.

# output.tableHeader.agent

Agent

# output.tableHeader.sessionId

Session ID

# output.tableHeader.planId

Plan ID

# output.tableHeader.mtime

Recorded At

# output.tableHeader.size

Size

# output.tableHeader.path

Path

# examples

- List all trace files for all agents and sessions:

  <%= config.bin %> <%= command.id %>

- List all trace files for a specific agent:

  <%= config.bin %> <%= command.id %> --agent My_Agent

- List trace files for a specific session:

  <%= config.bin %> <%= command.id %> --session-id <SESSION_ID>

- List trace files recorded on or after April 20, 2026 (date-only, interpreted as UTC midnight):

  <%= config.bin %> <%= command.id %> --since 2026-04-20

- List trace files recorded on or after a specific UTC time:

  <%= config.bin %> <%= command.id %> --since 2026-04-20T14:00:00Z

- Filter by agent and date together:

  <%= config.bin %> <%= command.id %> --agent My_Agent --since 2026-04-20

- Return results as JSON:

  <%= config.bin %> <%= command.id %> --json
