# summary

Start a programmatic agent preview session.

# description

This command outputs a session ID that you then use with the "agent preview send" command to send an utterance to the agent. Use the "agent preview sessions" command to list all active sessions and the "agent preview end" command to end a specific session.

Identify the agent you want to start previewing with either the --authoring-bundle flag to specify a local authoring bundle's API name or --api-name to specify an activated published agent's API name. To find either API name, navigate to your package directory in your DX project. The API name of an authoring bundle is the same as its directory name under the "aiAuthoringBundles" metadata directory. Similarly, the published agent's API name is the same as its directory name under the "Bots" metadata directory.

When starting a preview session with --authoring-bundle, you must explicitly specify the execution mode using one of these flags:

- --use-live-actions: Executes real Apex classes, flows, and other actions in the org. This surfaces compile and validation errors during preview.
- --simulate-actions: Uses AI to simulate action execution without calling real implementations.

Published agents (--api-name) always use live actions. The mode flags are optional and have no effect for published agents.

# flags.api-name.summary

API name of the activated published agent you want to preview.

# flags.authoring-bundle.summary

API name of the authoring bundle metadata component that contains the agent's Agent Script file.

# flags.agent-json.summary

Path to a pre-compiled AgentJSON file to use instead of compiling the agent script. Intended for internal use and testing.

# flags.use-live-actions.summary

Execute real actions in the org (Apex classes, flows, etc.). Required with --authoring-bundle.

# flags.simulate-actions.summary

Use AI to simulate action execution instead of calling real actions. Required with --authoring-bundle.

# output.sessionId

Session ID: %s

# error.agentNotFound

Agent '%s' not found. Check that the API name is correct and that the agent exists in your org or project.

# error.compilationFailed

Agent Script compilation failed. See errors above for details.

# error.previewStartFailed

Failed to start preview session: %s

# examples

- Start a programmatic agent preview session by specifying an authoring bundle; use simulated actions. Use the org with alias "my-dev-org":

  <%= config.bin %> <%= command.id %> --authoring-bundle My_Agent_Bundle --target-org my-dev-org --simulate-actions

- Similar to previous example but use live actions and the default org:

  <%= config.bin %> <%= command.id %> --authoring-bundle My_Agent_Bundle --use-live-actions

- Start a preview session with an activated published agent (always uses live actions):

  <%= config.bin %> <%= command.id %> --api-name My_Published_Agent
