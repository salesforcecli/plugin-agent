# summary

Start a programmatic preview session (beta).

# description

Start an agent preview session and get a session ID. Use the session ID with "agent preview send" and "agent preview end". Specify the agent with --api-name (published agent) or --authoring-bundle (Agent Script); one is required. Use --use-live-actions for live mode; otherwise preview uses mock (simulated) actions.

# flags.api-name.summary

API name or ID of the published agent.

# flags.authoring-bundle.summary

API name of the authoring bundle (Agent Script) to preview.

# flags.use-live-actions.summary

Use real actions in the org; if not specified, preview uses mock (simulated) actions.

# output.sessionId

Session ID: %s

# examples

- Start a preview session with an authoring bundle and use mock actions:

  <%= config.bin %> <%= command.id %> --authoring-bundle My_Agent_Bundle --target-org my-dev-org

- Start a preview session with an authoring bundle and use real actions:

  <%= config.bin %> <%= command.id %> --authoring-bundle My_Agent_Bundle --use-live-actions --target-org my-dev-org

- Start a preview session with a published agent:

  <%= config.bin %> <%= command.id %> --api-name My_Published_Agent
