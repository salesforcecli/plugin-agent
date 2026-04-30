# summary

Delete agent preview trace files.

# description

Deletes trace files recorded during agent preview sessions. By default, shows a preview of what will be deleted and prompts for confirmation. Use --no-prompt to skip confirmation.

Without filters, deletes all traces for all agents and sessions. Use flags to narrow the scope: filter by agent name (--api-name or --authoring-bundle), by session (--session-id), or by age (--older-than).

# flags.session-id.summary

Only delete traces from this session ID.

# flags.api-name.summary

Only delete traces for this published agent API name.

# flags.authoring-bundle.summary

Only delete traces for this authoring bundle API name.

# flags.older-than.summary

Only delete traces older than this duration. Accepts a number followed by a unit: m/minutes, h/hours, d/days, w/weeks (e.g. 7d, 24h, 2w).

# flags.no-prompt.summary

Skip the confirmation prompt and delete immediately.

# error.invalidOlderThan

Invalid --older-than value: '%s'. Use a number followed by a unit: m/minutes, h/hours, d/days, w/weeks (e.g. 7d, 24h, 30m, 2w).

# prompt.confirm

Delete %s trace file(s)? This cannot be undone.

# output.noneFound

No trace files matched the specified filters.

# output.preview

Found %s trace file(s) to delete:

# output.cancelled

Deletion cancelled.

# output.deleted

Deleted %s trace file(s).

# output.tableHeader.agent

Agent

# output.tableHeader.sessionId

Session ID

# output.tableHeader.planId

Plan ID

# examples

- Delete all traces for all agents and sessions (with confirmation prompt):

  <%= config.bin %> <%= command.id %>

- Delete all traces for a specific published agent:

  <%= config.bin %> <%= command.id %> --api-name My_Published_Agent

- Delete traces from a specific session:

  <%= config.bin %> <%= command.id %> --session-id <SESSION_ID>

- Delete traces older than 7 days:

  <%= config.bin %> <%= command.id %> --older-than 7d

- Delete traces older than 24 hours for a specific agent, no prompt:

  <%= config.bin %> <%= command.id %> --authoring-bundle My_Local_Agent --older-than 24h --no-prompt

- Delete all traces for an authoring bundle without confirmation:

  <%= config.bin %> <%= command.id %> --authoring-bundle My_Local_Agent --no-prompt
