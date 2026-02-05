# summary

Send a message in a preview session (beta).

# description

Send an utterance to an existing preview session and get the agent response. Use the session ID returned by "agent preview start". Specify the same agent with --api-name or --authoring-bundle as used when starting the session; one is required.

# flags.session-id.summary

Session ID from "agent preview start" (required).

# flags.utterance.summary

Utterance to send to the agent.

# flags.api-name.summary

API name or ID of the published agent.

# flags.authoring-bundle.summary

API name of the authoring bundle (Agent Script).

# examples

- Send a message to a preview session:

  <%= config.bin %> <%= command.id %> --session-id <SESSION_ID> --utterance "What can you help me with?" --target-org my-dev-org
