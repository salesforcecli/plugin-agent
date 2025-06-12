# plugin-agent

[![NPM](https://img.shields.io/npm/v/@salesforce/plugin-agent.svg?label=@salesforce/plugin-agent)](https://www.npmjs.com/package/@salesforce/plugin-agent) [![Downloads/week](https://img.shields.io/npm/dw/@salesforce/plugin-agent.svg)](https://npmjs.org/package/@salesforce/plugin-agent) [![License](https://img.shields.io/badge/License-BSD%203--Clause-brightgreen.svg)](https://raw.githubusercontent.com/salesforcecli/plugin-agent/main/LICENSE.txt)

## Install

```bash
sf plugins install @salesforce/plugin-agent@x.y.z
```

## Contributing

1. Please read our [Code of Conduct](CODE_OF_CONDUCT.md)
2. Create a new issue before starting your project so that we can keep track of
   what you are trying to add/fix. That way, we can also offer suggestions or
   let you know if there is already an effort in progress.
3. Fork this repository.
4. [Build the plugin locally](#build)
5. Create a _topic_ branch in your fork. Note, this step is recommended but technically not required if contributing using a fork.
6. Edit the code in your fork.
7. Write appropriate tests for your changes. Try to achieve at least 95% code coverage on any new code. No pull request will be accepted without unit tests.
8. Sign CLA (see [CLA](#cla) below).
9. Send us a pull request when you are done. We'll review your code, suggest any needed changes, and merge it in.

### CLA

External contributors will be required to sign a Contributor's License
Agreement. You can do so by going to https://cla.salesforce.com/sign-cla.

### Build

To build the plugin locally, make sure to have yarn installed and run the following commands:

```bash
# Clone the repository
git clone git@github.com:salesforcecli/plugin-agent

# Install the dependencies and compile
yarn && yarn build
```

To use your plugin, run using the local `./bin/dev.js` or `./bin/dev.cmd` file.

```bash
# Run using local run file.
./bin/dev.js agent
```

There should be no differences when running via the Salesforce CLI or using the local run file. However, it can be useful to link the plugin to do some additional testing or run your commands from anywhere on your machine.

```bash
# Link your plugin to the sf cli
sf plugins link .
# To verify
sf plugins
```

## Commands

<!-- commands -->

- [`sf agent create`](#sf-agent-create)
- [`sf agent generate agent-spec`](#sf-agent-generate-agent-spec)
- [`sf agent generate template`](#sf-agent-generate-template)
- [`sf agent generate test-spec`](#sf-agent-generate-test-spec)
- [`sf agent preview`](#sf-agent-preview)
- [`sf agent test create`](#sf-agent-test-create)
- [`sf agent test list`](#sf-agent-test-list)
- [`sf agent test results`](#sf-agent-test-results)
- [`sf agent test resume`](#sf-agent-test-resume)
- [`sf agent test run`](#sf-agent-test-run)

## `sf agent create`

Create an agent in your org using a local agent spec file.

```
USAGE
  $ sf agent create -o <value> [--json] [--flags-dir <value>] [--api-version <value>] [--name <value>] [--api-name
    <value>] [--spec <value>] [--preview]

FLAGS
  -o, --target-org=<value>   (required) Username or alias of the target org. Not required if the `target-org`
                             configuration variable is already set.
      --api-name=<value>     API name of the new agent; if not specified, the API name is derived from the agent name
                             (label); the API name must not exist in the org.
      --api-version=<value>  Override the api version used for api requests made by this command
      --name=<value>         Name (label) of the new agent.
      --preview              Preview the agent without saving it in your org.
      --spec=<value>         Path to an agent spec file.

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Create an agent in your org using a local agent spec file.

  To run this command, you must have an agent spec file, which is a YAML file that define the agent properties and
  contains a list of AI-generated topics. Topics define the range of jobs the agent can handle. Use the "agent generate
  agent-spec" CLI command to generate an agent spec file. Then specify the file to this command using the --spec flag,
  along with the name (label) of the new agent with the --name flag. If you don't specify any of the required flags, the
  command prompts you.

  When this command completes, your org contains the new agent, which you can then edit and customize in the Agent
  Builder UI. The new agent's topics are the same as the ones listed in the agent spec file. The agent might also have
  some AI-generated actions, or you can add them. This command also retrieves all the metadata files associated with the
  new agent to your local Salesforce DX project.

  Use the --preview flag to review what the agent looks like without actually saving it in your org. When previewing,
  the command creates a JSON file in the current directory with all the agent details. The name of the JSON file is the
  agent's API name and a timestamp.

  To open the new agent in your org's Agent Builder UI, run this command: "sf org open agent --api-name <api-name>".

EXAMPLES
  Create an agent by being prompted for the required information, such as the agent spec file and agent name, and then
  create it in your default org:

    $ sf agent create

  Create an agent by specifying the agent name, API name, and spec file with flags; use the org with alias "my-org";
  the command fails if the API name is already being used in your org:

    $ sf agent create --name "Resort Manager" --api-name Resort_Manager --spec specs/resortManagerAgent.yaml \
      --target-org my-org

  Preview the creation of an agent named "Resort Manager" and use your default org:

    $ sf agent create --name "Resort Manager" --spec specs/resortManagerAgent.yaml --preview
```

_See code: [src/commands/agent/create.ts](https://github.com/salesforcecli/plugin-agent/blob/1.23.0/src/commands/agent/create.ts)_

## `sf agent generate agent-spec`

Generate an agent spec, which is a YAML file that captures what an agent can do.

```
USAGE
  $ sf agent generate agent-spec -o <value> [--json] [--flags-dir <value>] [--api-version <value>] [--type customer|internal]
    [--role <value>] [--company-name <value>] [--company-description <value>] [--company-website <value>] [--max-topics
    <value>] [--agent-user <value>] [--enrich-logs true|false] [--tone formal|casual|neutral] [--spec <value>]
    [--output-file <value>] [--full-interview] [--grounding-context <value> --prompt-template <value>]
    [--force-overwrite]

FLAGS
  -o, --target-org=<value>           (required) Username or alias of the target org. Not required if the `target-org`
                                     configuration variable is already set.
      --agent-user=<value>           Username of a user in your org to assign to your agent; determines what your agent
                                     can access and do.
      --api-version=<value>          Override the api version used for api requests made by this command
      --company-description=<value>  Description of your company.
      --company-name=<value>         Name of your company.
      --company-website=<value>      Website URL of your company.
      --enrich-logs=<option>         Adds agent conversation data to event logs so you can view all agent session
                                     activity in one place.
                                     <options: true|false>
      --force-overwrite              Don't prompt the user to confirm that an existing spec file will be overwritten.
      --full-interview               Prompt for both required and optional flags.
      --grounding-context=<value>    Context information and personalization that's added to your prompts when using a
                                     custom prompt template.
      --max-topics=<value>           Maximum number of topics to generate in the agent spec; default is 5.
      --output-file=<value>          [default: specs/agentSpec.yaml] Path for the generated YAML agent spec file; can be
                                     an absolute or relative path.
      --prompt-template=<value>      API name of a customized prompt template to use instead of the default prompt
                                     template.
      --role=<value>                 Role of the agent.
      --spec=<value>                 Agent spec file, in YAML format, to use as input to the command.
      --tone=<option>                Conversational style of the agent, such as how it expresses your brand personality
                                     in its messages through word choice, punctuation, and sentence structure.
                                     <options: formal|casual|neutral>
      --type=<option>                Type of agent to create. Internal types are copilots used internally by your
                                     company and customer types are the agents you create for your customers.
                                     <options: customer|internal>

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Generate an agent spec, which is a YAML file that captures what an agent can do.

  The first step in creating an agent in your org with Salesforce CLI is to generate an agent spec using this command.
  An agent spec is a YAML-formatted file that contains information about the agent, such as its role and company
  description, and then an AI-generated list of topics based on this information. Topics define the range of jobs your
  agent can handle.

  Use flags, such as --role and --company-description, to provide details about your company and the role that the agent
  plays in your company. If you prefer, you can also be prompted for the basic information; use --full-interview to be
  prompted for all required and optional properties. Upon command execution, the large language model (LLM) associated
  with your org uses the provided information to generate a list of topics for the agent. Because the LLM uses the
  company and role information to generate the topics, we recommend that you provide accurate, complete, and specific
  details so the LLM generates the best and most relevant topics. Once generated, you can edit the spec file; for
  example, you can remove topics that don't apply or change a topic's description.

  You can also iterate the spec generation process by using the --spec flag to pass an existing agent spec file to this
  command, and then using the --role, --company-description, etc, flags to refine your agent properties. Iteratively
  improving the description of your agent allows the LLM to generate progressively better topics.

  You can also specify other agent properties, such as a custom prompt template, how to ground the prompt template to
  add context to the agent's prompts, the tone of the prompts, and the username of a user in the org to assign to the
  agent.

  When your agent spec is ready, you then create the agent in your org by running the "agent create" CLI command and
  specifying the spec with the --spec flag.

EXAMPLES
  Generate an agent spec in the default location and use flags to specify the agent properties, such as its role and
  your company details; use your default org:

    $ sf agent generate agent-spec --type customer --role "Field customer complaints and manage employee schedules." \
      --company-name "Coral Cloud Resorts" --company-description "Provide customers with exceptional destination \
      activities, unforgettable experiences, and reservation services."

  Generate an agent spec by being prompted for the required agent properties and generate a maxiumum of 5 topics;
  write the generated file to the "specs/resortManagerSpec.yaml" file and use the org with alias "my-org":

    $ sf agent generate agent-spec --max-topics 5 --output-file specs/resortManagerAgent.yaml --target-org my-org

  Be prompted for all required and optional agent properties; use your default org:

    $ sf agent generate agent-spec --full-interview

  Specify an existing agent spec file called "specs/resortManagerAgent.yaml", and then overwrite it with a new version
  that contains newly AI-generated topics based on the updated role information passed in with the --role flag:

    $ sf agent generate agent-spec --spec specs/resortManagerAgent.yaml --output-file specs/resortManagerAgent.yaml \
      --role "Field customer complaints, manage employee schedules, and ensure all resort operations are running \
      smoothly"

  Specify that the conversational tone of the agent is formal and to attach the "resortmanager@myorg.com" username to
  it; be prompted for the required properties and use your default org:

    $ sf agent generate agent-spec --tone formal --agent-user resortmanager@myorg.com
```

_See code: [src/commands/agent/generate/agent-spec.ts](https://github.com/salesforcecli/plugin-agent/blob/1.23.0/src/commands/agent/generate/agent-spec.ts)_

## `sf agent generate template`

Generate an agent template from an existing agent in your DX project so you can then package the template in a managed package.

```
USAGE
  $ sf agent generate template --agent-version <value> -f <value> [--json] [--flags-dir <value>] [--api-version <value>]

FLAGS
  -f, --agent-file=<value>     (required) Path to an agent (Bot) metadata file.
      --agent-version=<value>  (required) Version of the agent (BotVersion).
      --api-version=<value>    Override the api version used for api requests made by this command

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Generate an agent template from an existing agent in your DX project so you can then package the template in a managed
  package.

  At a high-level, agents are defined by the Bot, BotVersion, and GenAiPlannerBundle metadata types. The
  GenAiPlannerBundle type in turn defines the agent's topics and actions. This command uses the metadata files for these
  three types, located in your local DX project, to generate a BotTemplate file for a specific agent (Bot). You then use
  the BotTemplate file, along with the GenAiPlannerBundle file that references the BotTemplate, to package the template
  in a managed package that you can share between orgs or on AppExchange.

  Use the --agent-file flag to specify the relative or full pathname of the Bot metadata file, such as
  force-app/main/default/bots/My_Awesome_Agent/My_Awesome_Agent.bot-meta.xml. A single Bot can have multiple
  BotVersions, so use the --agent-version flag to specify the version. The corresponding BotVersion file must exist
  locally. For example, if you specify "--agent-version 4", then the file
  force-app/main/default/bots/My_Awesome_Agent/v4.botVersion-meta.xml must exist.

  The new BotTemplate file is generated in the "botTemplates" directory in your local package directory, and has the
  name <Agent_API_name>_v<Version>_Template.botTemplate-meta.xml, such as
  force-app/main/default/botTemplates/My_Awesome_Agent_v4_Template.botTemplate-meta.xml. The command displays the full
  pathname of the generated files when it completes.

EXAMPLES
  Generate an agent template from a Bot metadata file in your DX project that corresponds to the My_Awesome_Agent
  agent; use version 1 of the agent.

    $ sf agent generate template --agent-file \
      force-app/main/default/bots/My_Awesome_Agent/My_Awesome_Agent.bot-meta.xml --agent-version 1
```

_See code: [src/commands/agent/generate/template.ts](https://github.com/salesforcecli/plugin-agent/blob/1.23.0/src/commands/agent/generate/template.ts)_

## `sf agent generate test-spec`

Generate an agent test spec, which is a YAML file that lists the test cases for testing a specific agent.

```
USAGE
  $ sf agent generate test-spec [--flags-dir <value>] [-d <value>] [--force-overwrite] [-f <value>]

FLAGS
  -d, --from-definition=<value>  Filepath to the AIEvaluationDefinition metadata XML file in your DX project that you
                                 want to convert to a test spec YAML file.
  -f, --output-file=<value>      Name of the generated test spec YAML file. Default value is
                                 "specs/<AGENT_API_NAME>-testSpec.yaml".
      --force-overwrite          Don't prompt for confirmation when overwriting an existing test spec YAML file.

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.

DESCRIPTION
  Generate an agent test spec, which is a YAML file that lists the test cases for testing a specific agent.

  The first step when using Salesforce CLI to create an agent test in your org is to use this interactive command to
  generate a local YAML-formatted test spec file. The test spec YAML file contains information about the agent being
  tested, such as its API name, and then one or more test cases. This command uses the metadata components in your DX
  project when prompting for information, such as the agent API name; it doesn't look in your org.

  To generate a specific agent test case, this command prompts you for this information; when possible, the command
  provides a list of options for you to choose from:

  - Utterance: Natural language statement, question, or command used to test the agent.
  - Expected topic: API name of the topic you expect the agent to use when responding to the utterance.
  - Expected actions: One or more API names of the expection actions the agent takes.
  - Expected outcome: Natural language description of the outcome you expect.

  When your test spec is ready, you then run the "agent test create" command to actually create the test in your org and
  synchronize the metadata with your DX project. The metadata type for an agent test is AiEvaluationDefinition.

  If you have an existing AiEvaluationDefinition metadata XML file in your DX project, you can generate its equivalent
  YAML test spec file with the --from-definition flag.

EXAMPLES
  Generate an agent test spec YAML file interactively:

    $ sf agent generate test-spec

  Generate an agent test spec YAML file and specify a name for the new file; if the file exists, overwrite it without
  confirmation:

    $ sf agent generate test-spec --output-file specs/Resort_Manager-new-version-testSpec.yaml --force-overwrite

  Generate an agent test spec YAML file from an existing AiEvaluationDefinition metadata XML file in your DX project:

    $ sf agent generate test-spec --from-definition \
      force-app//main/default/aiEvaluationDefinitions/Resort_Manager_Tests.aiEvaluationDefinition-meta.xml
```

_See code: [src/commands/agent/generate/test-spec.ts](https://github.com/salesforcecli/plugin-agent/blob/1.23.0/src/commands/agent/generate/test-spec.ts)_

## `sf agent preview`

Interact with an active agent to preview how the agent responds to your statements, questions, and commands (utterances).

```
USAGE
  $ sf agent preview (-c <value> -o <value>) [--flags-dir <value>] [--api-version <value>] [-n <value>] [-d
    <value>] [-x]

FLAGS
  -c, --client-app=<value>   (required) Name of the linked client app to use for the agent connection. You must have
                             previously created this link with "org login web --client-app". Run "org display" to see
                             the available linked client apps.
  -d, --output-dir=<value>   Directory where conversation transcripts are saved.
  -n, --api-name=<value>     API name of the agent you want to interact with.
  -o, --target-org=<value>   (required) Username or alias of the target org. Not required if the `target-org`
                             configuration variable is already set.
  -x, --apex-debug           Enable Apex debug logging during the agent preview conversation.
      --api-version=<value>  Override the api version used for api requests made by this command

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.

DESCRIPTION
  Interact with an active agent to preview how the agent responds to your statements, questions, and commands
  (utterances).

  Use this command to have a natural language conversation with an active agent in your org, as if you were an actual
  user. The interface is simple: in the "Start typing..." prompt, enter a statement, question, or command; when you're
  done, enter Return. Your utterance is posted on the right along with a timestamp. The agent then responds on the left.
  To exit the conversation, hit ESC or Control+C.

  This command is useful to test if the agent responds to your utterances as you expect. For example, you can test that
  the agent uses a particular topic when asked a question, and then whether it invokes the correct action associated
  with that topic. This command is the CLI-equivalent of the Conversation Preview panel in your org's Agent Builder UI.

  When the session concludes, the command asks if you want to save the API responses and chat transcripts. By default,
  the files are saved to the "./temp/agent-preview" directory. Specify a new default directory by setting the
  environment variable "SF_AGENT_PREVIEW_OUTPUT_DIR" to the directory. Or you can pass the directory to the --output-dir
  flag.

  Find the agent's API name in its main details page in your org's Agent page in Setup.

  Before you use this command, you must complete these steps:

  1. Using your org's Setup UI, create a connected app in your org as described in the "Create a Connected App" section
  here: https://developer.salesforce.com/docs/einstein/genai/guide/agent-api-get-started.html#create-a-connected-app. Do
  these additional steps:

  a. When specifying the connected app's Callback URL, add this second callback URL on a new line:
  "http://localhost:1717/OauthRedirect".

  b. When adding the scopes to the connected app, add "Manage user data via Web browsers (web)".

  2. Add the connected app to your agent as described in the "Add Connected App to Agent" section here:
  https://developer.salesforce.com/docs/einstein/genai/guide/agent-api-get-started.html#add-connected-app-to-agent.

  3. Copy the consumer key from your connected app as described in the "Obtain Credentials" section here:
  https://developer.salesforce.com/docs/einstein/genai/guide/agent-api-get-started.html#obtain-credentials.

  4. If you haven't already, run the "org login web" CLI command as usual to authorize the development org that contains
  the agent you want to preview.

  5. Re-run the "org web login" command to link the new connected app to your already-authenticated user. Use the
  --client-app flag to give the link a name; you can specify any string, but make a note of it because you'll need it
  later. Use --username to specify the username that you used to log into the org in the previous step. Use --client-id
  to specify the consumer key you previously copied. Finally, use --scopes as indicated to specify the required API
  scopes. Here's an example:

  sf org login web --client-app agent-app --username <username> --client-id <consumer-key> --scopes "sfap_api
  chatbot_api refresh_token api web"

  IMPORTANT: You must use the "--client-id <CONNECTED-APP-CONSUMER-KEY>" flag of "org login web", where
  CONNECTED-APP-CONSUMER-KEY is the consumer key you previously copied. This step ensures that the "org login web"
  command uses your custom connected app, and not the default CLI connected app.

  6. Press Enter to skip sharing the client secret, then log in with your org username as usual and click Accept.

  7. Run this command ("agent preview") to interact with an agent by using the --target-org flag to specify the org
  username or alias as usual and --client-app to specify the linked connected app ("agent-app" in the previous example).
  Use the "org display" command to get the list of client apps associated with an org.

EXAMPLES
  Interact with an agent with API name "Resort_Manager" in the org with alias "my-org" and the linked "agent-app"
  connected app:

    $ sf agent preview --api-name "Resort_Manager" --target-org my-org --client-app agent-app

  Same as the preceding example, but this time save the conversation transcripts to the "./transcripts/my-preview"
  directory rather than the default "./temp/agent-preview":

    $ sf agent preview --api-name "Resort_Manager" --target-org my-org --client-app agent-app --output-dir \
      "transcripts/my-preview"
```

_See code: [src/commands/agent/preview.ts](https://github.com/salesforcecli/plugin-agent/blob/1.23.0/src/commands/agent/preview.ts)_

## `sf agent test create`

Create an agent test in your org using a local test spec YAML file.

```
USAGE
  $ sf agent test create -o <value> [--json] [--flags-dir <value>] [--api-name <value>] [--spec <value>] [--api-version
    <value>] [--preview] [--force-overwrite]

FLAGS
  -o, --target-org=<value>   (required) Username or alias of the target org. Not required if the `target-org`
                             configuration variable is already set.
      --api-name=<value>     API name of the new test; the API name must not exist in the org.
      --api-version=<value>  Override the api version used for api requests made by this command
      --force-overwrite      Don't prompt for confirmation when overwriting an existing test (based on API name) in your
                             org.
      --preview              Preview the test metadata file (AiEvaluationDefinition) without deploying to your org.
      --spec=<value>         Path to the test spec YAML file.

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Create an agent test in your org using a local test spec YAML file.

  To run this command, you must have an agent test spec file, which is a YAML file that lists the test cases for testing
  a specific agent. Use the "agent generate test-spec" CLI command to generate a test spec file. Then specify the file
  to this command with the --spec flag, or run this command with no flags to be prompted.

  When this command completes, your org contains the new agent test, which you can view and edit using the Testing
  Center UI. This command also retrieves the metadata component (AiEvaluationDefinition) associated with the new test to
  your local Salesforce DX project and displays its filename.

  After you've created the test in the org, use the "agent test run" command to run it.

EXAMPLES
  Create an agent test interactively and be prompted for the test spec and API name of the test in the org; use the
  default org:

    $ sf agent test create

  Create an agent test and use flags to specify all required information; if a test with same API name already exists
  in the org, overwrite it without confirmation. Use the org with alias "my-org":

    $ sf agent test create --spec specs/Resort_Manager-testSpec.yaml --api-name Resort_Manager_Test \
      --force-overwrite --target-org my-org

  Preview what the agent test metadata (AiEvaluationDefinition) looks like without deploying it to your default org:

    $ sf agent test create --spec specs/Resort_Manager-testSpec.yaml --api-name Resort_Manager_Test --preview
```

_See code: [src/commands/agent/test/create.ts](https://github.com/salesforcecli/plugin-agent/blob/1.23.0/src/commands/agent/test/create.ts)_

## `sf agent test list`

List the available agent tests in your org.

```
USAGE
  $ sf agent test list -o <value> [--json] [--flags-dir <value>] [--api-version <value>]

FLAGS
  -o, --target-org=<value>   (required) Username or alias of the target org. Not required if the `target-org`
                             configuration variable is already set.
      --api-version=<value>  Override the api version used for api requests made by this command

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  List the available agent tests in your org.

  The command outputs a table with the name (API name) of each test along with its unique ID and the date it was created
  in the org.

EXAMPLES
  List the agent tests in your default org:

    $ sf agent test list

  List the agent tests in an org with alias "my-org""

    $ sf agent test list --target-org my-org
```

_See code: [src/commands/agent/test/list.ts](https://github.com/salesforcecli/plugin-agent/blob/1.23.0/src/commands/agent/test/list.ts)_

## `sf agent test results`

Get the results of a completed agent test run.

```
USAGE
  $ sf agent test results -o <value> -i <value> [--json] [--flags-dir <value>] [--api-version <value>] [--result-format
    json|human|junit|tap] [-d <value>]

FLAGS
  -d, --output-dir=<value>      Directory to write the agent test results into.
  -i, --job-id=<value>          (required) Job ID of the completed agent test run.
  -o, --target-org=<value>      (required) Username or alias of the target org. Not required if the `target-org`
                                configuration variable is already set.
      --api-version=<value>     Override the api version used for api requests made by this command
      --result-format=<option>  [default: human] Format of the agent test run results.
                                <options: json|human|junit|tap>

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Get the results of a completed agent test run.

  This command requires a job ID, which the original "agent test run" command displays when it completes. You can also
  use the --use-most-recent flag to see results for the most recently run agent test.

  By default, this command outputs test results in human-readable tables for each test case. The tables show whether the
  test case passed, the expected and actual values, the test score, how long the test took, and more. Use the
  --result-format to display the test results in JSON or Junit format. Use the --output-dir flag to write the results to
  a file rather than to the terminal.

EXAMPLES
  Get the results of an agent test run in your default org using its job ID:

    $ sf agent test results --job-id 4KBfake0000003F4AQ

  Get the results of the most recently run agent test in an org with alias "my-org":

    $ sf agent test results --use-most-recent --target-org my-org

  Get the results of the most recently run agent test in your default org, and write the JSON-formatted results into a
  directory called "test-results":

    $ sf agent test results --use-most-recent --output-dir ./test-results --result-format json

FLAG DESCRIPTIONS
  -d, --output-dir=<value>  Directory to write the agent test results into.

    If the agent test run completes, write the results to the specified directory. If the test is still running, the
    test results aren't written.
```

_See code: [src/commands/agent/test/results.ts](https://github.com/salesforcecli/plugin-agent/blob/1.23.0/src/commands/agent/test/results.ts)_

## `sf agent test resume`

Resume an agent test that you previously started in your org so you can view the test results.

```
USAGE
  $ sf agent test resume -o <value> [--json] [--flags-dir <value>] [--api-version <value>] [-i <value>] [-r] [-w
    <value>] [--result-format json|human|junit|tap] [-d <value>]

FLAGS
  -d, --output-dir=<value>      Directory to write the agent test results into.
  -i, --job-id=<value>          Job ID of the original agent test run.
  -o, --target-org=<value>      (required) Username or alias of the target org. Not required if the `target-org`
                                configuration variable is already set.
  -r, --use-most-recent         Use the job ID of the most recent agent test run.
  -w, --wait=<value>            [default: 5 minutes] Number of minutes to wait for the command to complete and display
                                results to the terminal window.
      --api-version=<value>     Override the api version used for api requests made by this command
      --result-format=<option>  [default: human] Format of the agent test run results.
                                <options: json|human|junit|tap>

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Resume an agent test that you previously started in your org so you can view the test results.

  This command requires a job ID, which the original "agent test run" command displays when it completes. You can also
  use the --use-most-recent flag to see results for the most recently run agent test.

  Use the --wait flag to specify the number of minutes for this command to wait for the agent test to complete; if the
  test completes by the end of the wait time, the command displays the test results. If not, the CLI returns control of
  the terminal to you, and you must run "agent test resume" again.

  By default, this command outputs test results in human-readable tables for each test case. The tables show whether the
  test case passed, the expected and actual values, the test score, how long the test took, and more. Use the
  --result-format to display the test results in JSON or Junit format. Use the --output-dir flag to write the results to
  a file rather than to the terminal.

EXAMPLES
  Resume an agent test in your default org using a job ID:

    $ sf agent test resume --job-id 4KBfake0000003F4AQ

  Resume the most recently-run agent test in an org with alias "my-org" org; wait 10 minutes for the tests to finish:

    $ sf agent test resume --use-most-recent --wait 10 --target-org my-org

  Resume the most recent agent test in your default org, and write the JSON-formatted results into a directory called
  "test-results":

    $ sf agent test resume --use-most-recent --output-dir ./test-results --result-format json

FLAG DESCRIPTIONS
  -d, --output-dir=<value>  Directory to write the agent test results into.

    If the agent test run completes, write the results to the specified directory. If the test is still running, the
    test results aren't written.
```

_See code: [src/commands/agent/test/resume.ts](https://github.com/salesforcecli/plugin-agent/blob/1.23.0/src/commands/agent/test/resume.ts)_

## `sf agent test run`

Start an agent test in your org.

```
USAGE
  $ sf agent test run -o <value> [--json] [--flags-dir <value>] [--api-version <value>] [-n <value>] [-w <value>]
    [--result-format json|human|junit|tap] [-d <value>]

FLAGS
  -d, --output-dir=<value>      Directory to write the agent test results into.
  -n, --api-name=<value>        API name of the agent test to run; corresponds to the name of the AiEvaluationDefinition
                                metadata component that implements the agent test.
  -o, --target-org=<value>      (required) Username or alias of the target org. Not required if the `target-org`
                                configuration variable is already set.
  -w, --wait=<value>            Number of minutes to wait for the command to complete and display results to the
                                terminal window.
      --api-version=<value>     Override the api version used for api requests made by this command
      --result-format=<option>  [default: human] Format of the agent test run results.
                                <options: json|human|junit|tap>

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Start an agent test in your org.

  Use the --api-name flag to specify the name of the agent test you want to run. Use the output of the "agent test list"
  command to get the names of all the available agent tests in your org.

  By default, this command starts the agent test in your org, but it doesn't wait for the test to finish. Instead, it
  displays the "agent test resume" command, with a job ID, that you execute to see the results of the test run, and then
  returns control of the terminal window to you. Use the --wait flag to specify the number of minutes for the command to
  wait for the agent test to complete; if the test completes by the end of the wait time, the command displays the test
  results. If not, run "agent test resume".

  By default, this command outputs test results in human-readable tables for each test case, if the test completes in
  time. The tables show whether the test case passed, the expected and actual values, the test score, how long the test
  took, and more. Use the --result-format to display the test results in JSON or Junit format. Use the --output-dir flag
  to write the results to a file rather than to the terminal.

EXAMPLES
  Start an agent test called Resort_Manager_Test for an agent in your default org, don't wait for the test to finish:

    $ sf agent test run --api-name Resort_Manager_Test

  Start an agent test for an agent in an org with alias "my-org" and wait for 10 minutes for the test to finish:

    $ sf agent test run --api-name Resort_Manager_Test --wait 10 --target-org my-org

  Start an agent test and write the JSON-formatted results into a directory called "test-results":

    $ sf agent test run --api-name Resort_Manager_Test --wait 10 --output-dir ./test-results --result-format json

FLAG DESCRIPTIONS
  -d, --output-dir=<value>  Directory to write the agent test results into.

    If the agent test run completes, write the results to the specified directory. If the test is still running, the
    test results aren't written.
```

_See code: [src/commands/agent/test/run.ts](https://github.com/salesforcecli/plugin-agent/blob/1.23.0/src/commands/agent/test/run.ts)_

<!-- commandsstop -->
