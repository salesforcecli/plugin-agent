# summary

Delete agent preview trace files.

# description

Deletes trace files recorded during agent preview sessions. By default, shows a preview of what will be deleted and prompts for confirmation. Use --no-prompt to skip confirmation.

Without filters, deletes all traces for all agents and sessions. Use flags to narrow the scope: filter by agent name (--agent), by session (--session-id), or by age (--older-than).

# flags.agent.summary

Only delete traces for this agent name (substring match). Matches against the name used when starting the session, whether that's an authoring bundle or a published agent API name.

# flags.session-id.summary

Only delete traces from this session ID.

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

- Delete all traces for a specific agent:

  <%= config.bin %> <%= command.id %> --agent My_Agent

- Delete traces from a specific session:

  <%= config.bin %> <%= command.id %> --session-id <SESSION_ID>

- Delete traces older than 7 days:

  <%= config.bin %> <%= command.id %> --older-than 7d

- Delete traces older than 24 hours for a specific agent, no prompt:

  <%= config.bin %> <%= command.id %> --agent My_Agent --older-than 24h --no-prompt

- Delete all traces without confirmation:

  <%= config.bin %> <%= command.id %> --no-prompt
