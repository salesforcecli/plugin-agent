# summary

End a preview session and get trace location (beta).

# description

End an existing preview session and print the local path where session traces are stored (.sfdx/agents/). Use the session ID returned by "agent preview start". Specify the same agent with --api-name or --authoring-bundle as used when starting the session; one is required.

# flags.session-id.summary

Session ID from "agent preview start". Omit when the agent has exactly one active session.

# flags.api-name.summary

API name or ID of the published agent.

# flags.authoring-bundle.summary

API name of the authoring bundle (Agent Script).

# error.noSession

No preview session found. Run "sf agent preview start" first.

# error.multipleSessions

Multiple preview sessions found for this agent. Specify --session-id. Sessions: %s

# output.tracesPath

Session traces: %s

# examples

- End the single active preview session:

  <%= config.bin %> <%= command.id %> --target-org my-dev-org

- End a specific session when multiple exist:

  <%= config.bin %> <%= command.id %> --session-id <SESSION_ID> --target-org my-dev-org
