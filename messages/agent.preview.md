# summary

Interact with an agent to preview how it responds to your statements, questions, and commands (utterances).

# description

Use this command to have a natural language conversation with an agent, either while you code its local Agent Script file or when it's published to an org. Previewing an agent acts like an initial test to make sure it responds to your utterances as you expect. For example, you can test that the agent uses a particular topic when asked a question, and then whether it invokes the correct action associated with that topic. This command is the CLI-equivalent of the Preview panel in your org's Agentforce Builder UI.

Run without flags, this command provides a list of agents to preview, divided into two categories: "Agent Script", which are agents that have a local authoring bundle in your DX project, or "Published", which are agents that are published and activated in your org. Authoring bundles contain an agent's Agent Script file. You then choose the agent you want to preview from the list. Or you can use the --authoring-bundle flag to specify a local authoring bundle's API name or --api-name to specify an activated published agent.

When previewing an agent from its Agent Script file, you can use these two modes:

- Simulated mode (Default): Uses only the Agent Script file to converse, and it simulates (mocks) all the actions. Use this mode if none of the Apex classes, flows, or prompt templates that implement your actions are available yet. The LLM uses the information about topics in the Agent Script file to simulate what the action does or how it responds.
- Live mode: Uses the actual Apex classes, flows, and prompt templates in your development org in the agent preview. If you've changed the Apex classe, flows, or prompt templates in your local DX project, then you must deploy them to your development org if you want to use them in your live preview.

You can use the Apex Replay Debugger to debug your Apex classes when using live mode for Agent Script files and for activated published agents; specify the --apex-debug flag.

Once connected to your agent, the preview interface is simple: in the "Start typing..." prompt, enter a statement, question, or command; when you're done, enter Return. Your utterance is posted on the right along with a timestamp. The agent then responds on the left. To exit the conversation, hit ESC or Control+C.

When the session concludes, the command asks if you want to save the API responses and chat transcripts. By default, the files are saved to the "./temp/agent-preview" directory. Specify a new default directory with the --output-dir flag.

# flags.api-name.summary

API name of the activated published agent you want to interact with.

# flags.authoring-bundle.summary

API name of the authoring bundle metadata component that contains the agent's Agent Script file.

# flags.output-dir.summary

Directory where conversation transcripts are saved.

# flags.use-live-actions.summary

Use real actions in the org; if not specified, preview uses AI to simulate (mock) actions.

# flags.apex-debug.summary

Enable Apex debug logging during the agent preview conversation.

# examples

- Preview an agent by choosing from the list of available local Agent Script or published agents. If previewing a local Agent Script agent, use simulated mode. Use the org with alias "my-dev-org".

  <%= config.bin %> <%= command.id %> --target-org my-dev-org

- Preview an agent in live mode by choosing from a list of authoring bundles. Save the conversation transcripts to the "./transcripts/my-preview" directory, enable the Apex debug logs, and use your default org:

  <%= config.bin %> <%= command.id %> --use-live-actions --apex-debug --output-dir transcripts/my-preview
