# summary

List trace files across all agent preview sessions.

# description

Lists trace files recorded during agent preview sessions. By default, lists all traces for all agents and all of their sessions. Use flags to narrow results: filter by agent name (--api-name or --authoring-bundle), by session (--session-id), or by date (--since).

Each row in the output corresponds to one trace file (one agent turn). The Agent column shows the authoring bundle or API name used when starting the session.

# flags.session-id.summary

Only show traces from this session ID.

# flags.api-name.summary

Only show traces for this published agent API name.

# flags.authoring-bundle.summary

Only show traces for this authoring bundle API name.

# flags.since.summary

Only show traces recorded on or after this date. Accepts ISO 8601 format: date-only (2026-04-20), date-time (2026-04-20T14:00:00Z), or date-time with milliseconds (2026-04-20T14:00:00.000Z). The "Recorded At" values shown in the table output are valid inputs.

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

- List all traces for all agents and sessions:

  <%= config.bin %> <%= command.id %>

- List all traces for a specific published agent (all its sessions):

  <%= config.bin %> <%= command.id %> --api-name My_Published_Agent

- List traces for a specific session:

  <%= config.bin %> <%= command.id %> --session-id <SESSION_ID>

- List traces recorded on or after April 20, 2026 (date-only, interpreted as UTC midnight):

  <%= config.bin %> <%= command.id %> --since 2026-04-20

- List traces recorded on or after a specific UTC time:

  <%= config.bin %> <%= command.id %> --since 2026-04-20T14:00:00Z

- Filter by authoring bundle and date together:

  <%= config.bin %> <%= command.id %> --authoring-bundle My_Local_Agent --since 2026-04-20

- Return results as JSON:

  <%= config.bin %> <%= command.id %> --json
