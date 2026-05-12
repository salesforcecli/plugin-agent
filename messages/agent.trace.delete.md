# summary

Delete trace files from an agent preview session.

# description

When you run an agent preview conversation (either interactive or programmatic), trace files are automatically recorded and saved in your local DX project. Use this command to delete some or all of the trace files.

By default, this command shows a preview of what will be deleted and prompts for confirmation. Use --no-prompt to skip confirmation.

Without filters, this comamnd deletes all trace files for all agents and sessions. Use flags to narrow the scope: filter by agent API name (--agent), by session (--session-id), or by age (--older-than).

# flags.agent.summary

API name of the agent used to filter the list of trace files you want to delete. Matches against the API name used when starting the session, either an authoring bundle or a published agent API name.

# flags.session-id.summary

Session ID used to filter the list of trace files you want to delete. Use the "agent preview sessions" CLI command to list all known agent preview sessions along with their session IDs.

# flags.older-than.summary

Duration used to filter the list of trace files; only files older than the duration are deleted. Accepts a number followed by a unit: m/minutes, h/hours, d/days, w/weeks. Examples: 7d, 24h, 2w.

# flags.no-prompt.summary

Skip the confirmation prompt and delete immediately.

# error.invalidOlderThan

Invalid --older-than value: '%s'. Use a number followed by a unit: m/minutes, h/hours, d/days, w/weeks, Examples: 7d, 24h, 30m, 2w.

# prompt.confirm

Delete %s trace file(s)? This can't be undone.

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

- Delete all traces for all agents and sessions; prompt for confirmation:

  <%= config.bin %> <%= command.id %>

- Delete all traces for a specific agent:

  <%= config.bin %> <%= command.id %> --agent My_Agent

- Delete traces from a specific session:

  <%= config.bin %> <%= command.id %> --session-id <SESSION_ID>

- Delete traces older than 7 days:

  <%= config.bin %> <%= command.id %> --older-than 7d

- Delete traces older than 24 hours for a specific agent; don't prompt for confirmation:

  <%= config.bin %> <%= command.id %> --agent My_Agent --older-than 24h --no-prompt

- Delete all traces for all agents and sessions; don't prompt for confirmation:

  <%= config.bin %> <%= command.id %> --no-prompt
