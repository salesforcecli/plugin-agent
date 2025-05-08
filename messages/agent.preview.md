# summary

Interact with an active agent to preview how the agent responds to your statements, questions, and commands (utterances).

# description

Use this command to have a natural language conversation with an active agent in your org, as if you were an actual user. The interface is simple: in the "Start typing..." prompt, enter a statement, question, or command; when you're done, enter Return. Your utterance is posted on the right along with a timestamp. The agent then responds on the left. To exit the conversation, hit ESC or Control+C.

This command is useful to test if the agent responds to your utterances as you expect. For example, you can test that the agent uses a particular topic when asked a question, and then whether it invokes the correct action associated with that topic. This command is the CLI-equivalent of the Conversation Preview panel in your org's Agent Builder UI.

When the session concludes, the command asks if you want to save the API responses and chat transcripts. By default, the files are saved to the "./temp/agent-preview" directory. Specify a new default directory by setting the environment variable "SF_AGENT_PREVIEW_OUTPUT_DIR" to the directory. Or you can pass the directory to the --output-dir flag.

Find the agent's API name in its main details page in your org's Agent page in Setup.

Before you use this command, you must complete these steps:
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

1. Create a connected app in your org as described in the "Create a Connected App" section here: https://developer.salesforce.com/docs/einstein/genai/guide/agent-api-get-started.html#create-a-connected-app. Do these four additional steps:

   a. When specifying the connected app's Callback URL, add this second callback URL on a new line: "http://localhost:1717/OauthRedirect".

   b. When adding the scopes to the connected app, add "Manage user data via Web browsers (web)".

   c. Ensure that the "Require Secret for Web Server Flow" option is not selected.

   d. Make note of the user that you specified as the "Run As" user when updating the Client Credentials Flow section.

2. Add the connected app to your agent as described in the "Add Connected App to Agent" section here: https://developer.salesforce.com/docs/einstein/genai/guide/agent-api-get-started.html#add-connected-app-to-agent.

3. Copy the consumer key from your connected app as described in the "Obtain Credentials" section here: https://developer.salesforce.com/docs/einstein/genai/guide/agent-api-get-started.html#obtain-credentials.

4. Set the "SFDX_AUTH_SCOPES" environment variable to "refresh_token sfap_api chatbot_api web api". This step ensures that you get the specific OAuth scopes required by this command.

5. Using the username of the user you specified as the "Run As" user above, authorize your org using the web server flow, as described in this document: https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_auth_web_flow.htm.

   IMPORTANT: You must use the "--client-id <CONNECTED-APP-CONSUMER-KEY>" flag of "org login web", where CONNECTED-APP-CONSUMER-KEY is the consumer key you previously copied. This step ensures that the "org login web" command uses your custom connected app, and not the default CLI connected app.

   Press Enter to skip sharing the client secret.

6. When you run this command to interact with an agent, specify the username you authorized in the preceding step with the --connected-app-user (-a) flag.

# flags.api-name.summary

API name of the agent you want to interact with.

# flags.connected-app-user.summary

Username or alias of the connected app user that's configured with web-based access tokens to the agent.

# flags.output-dir.summary

Directory where conversation transcripts are saved.

# examples

- Interact with an agent with API name "Resort_Manager" in the org with alias "my-org". Connect to your agent using the alias "my-agent-user"; this alias must point to the username who is authorized using the Web server flow:

  <%= config.bin %> <%= command.id %> --api-name "Resort_Manager" --target-org my-org --connected-app-user my-agent-user

- Same as the preceding example, but this time save the conversation transcripts to the "./transcripts/my-preview" directory rather than the default "./temp/agent-preview":

  <%= config.bin %> <%= command.id %> --api-name "Resort_Manager" --target-org my-org --connected-app-user my-agent-user --output-dir "transcripts/my-preview"
