# plugin-agent

[![NPM](https://img.shields.io/npm/v/@salesforce/plugin-agent.svg?label=@salesforce/plugin-agent)](https://www.npmjs.com/package/@salesforce/plugin-agent) [![Downloads/week](https://img.shields.io/npm/dw/@salesforce/plugin-agent.svg)](https://npmjs.org/package/@salesforce/plugin-agent) [![License](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](https://opensource.org/license/apache-2-0)

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

- [`sf agent activate`](#sf-agent-activate)
- [`sf agent create`](#sf-agent-create)
- [`sf agent deactivate`](#sf-agent-deactivate)
- [`sf agent generate agent-spec`](#sf-agent-generate-agent-spec)
- [`sf agent generate authoring-bundle`](#sf-agent-generate-authoring-bundle)
- [`sf agent generate template`](#sf-agent-generate-template)
- [`sf agent generate test-spec`](#sf-agent-generate-test-spec)
- [`sf agent preview`](#sf-agent-preview)
- [`sf agent preview end`](#sf-agent-preview-end)
- [`sf agent preview send`](#sf-agent-preview-send)
- [`sf agent preview sessions`](#sf-agent-preview-sessions)
- [`sf agent preview start`](#sf-agent-preview-start)
- [`sf agent publish authoring-bundle`](#sf-agent-publish-authoring-bundle)
- [`sf agent test create`](#sf-agent-test-create)
- [`sf agent test list`](#sf-agent-test-list)
- [`sf agent test results`](#sf-agent-test-results)
- [`sf agent test resume`](#sf-agent-test-resume)
- [`sf agent test run`](#sf-agent-test-run)
- [`sf agent validate authoring-bundle`](#sf-agent-validate-authoring-bundle)

## `sf agent activate`

Activate an agent in an org.

```
USAGE
  $ sf agent activate -o <value> [--json] [--flags-dir <value>] [--api-version <value>] [-n <value>]

FLAGS
  -n, --api-name=<value>     API name of the agent to activate.
  -o, --target-org=<value>   (required) Username or alias of the target org. Not required if the `target-org`
                             configuration variable is already set.
      --api-version=<value>  Override the api version used for api requests made by this command

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Activate an agent in an org.

  Activating an agent makes it immediately available to your users. An agent must be active before you can preview it
  with the "agent preview" CLI command or VS Code.

  You must know the agent's API name to activate it; you can either be prompted for it or you can specify it with the
  --api-name flag. Find the agent's API name in its Agent Details page of your org's Agentforce Studio UI in Setup.

EXAMPLES
  Activate an agent in your default target org by being prompted:

    $ sf agent activate

  Activate an agent with API name Resort_Manager in the org with alias "my-org":

    $ sf agent activate --api-name Resort_Manager --target-org my-org
```

_See code: [src/commands/agent/activate.ts](https://github.com/salesforcecli/plugin-agent/blob/1.30.2/src/commands/agent/activate.ts)_

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

  NOTE: This command creates an agent that doesn't use Agent Script as its blueprint. We generally don't recommend you
  use this workflow to create an agent. Rather, use the "agent generate|validate|publish authoring-bundle" commands to
  author agents that use the Agent Script language. See "Author an Agent"
  (https://developer.salesforce.com/docs/einstein/genai/guide/agent-dx-nga-author-agent.html) for details.

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

_See code: [src/commands/agent/create.ts](https://github.com/salesforcecli/plugin-agent/blob/1.30.2/src/commands/agent/create.ts)_

## `sf agent deactivate`

Deactivate an agent in an org.

```
USAGE
  $ sf agent deactivate -o <value> [--json] [--flags-dir <value>] [--api-version <value>] [-n <value>]

FLAGS
  -n, --api-name=<value>     API name of the agent to deactivate.
  -o, --target-org=<value>   (required) Username or alias of the target org. Not required if the `target-org`
                             configuration variable is already set.
      --api-version=<value>  Override the api version used for api requests made by this command

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Deactivate an agent in an org.

  Deactivating an agent makes it unavailable to your users. To make changes to an agent, such as adding or removing
  topics or actions, you must deactivate it. You can't preview an agent with the "agent preview" CLI command or VS Code
  if it's deactivated.

  You must know the agent's API name to deactivate it; you can either be prompted for it or you can specify it with the
  --api-name flag. Find the agent's API name in its Agent Details page of your org's Agentforce Studio UI in Setup.

EXAMPLES
  Deactivate an agent in your default target org by being prompted:

    $ sf agent deactivate

  Deactivate the agent Resort_Manager in the org with alias "my_org":

    $ sf agent deactivate --api-name Resort_Manager --target-org my-org
```

_See code: [src/commands/agent/deactivate.ts](https://github.com/salesforcecli/plugin-agent/blob/1.30.2/src/commands/agent/deactivate.ts)_

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

  An agent spec is a YAML-formatted file that contains basic information about the agent, such as its role, company
  description, and an AI-generated list of topics based on this information. Topics define the range of jobs your agent
  can handle.

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

  When your agent spec is ready, generate an authoring bundle from it by passing the spec file to the --spec flag of the
  "agent generate authoring-bundle" CLI command. An authoring bundle is a metadata type that contains an Agent Script
  file, which is the blueprint for an agent. (While not recommended, you can also use the agent spec file to immediately
  create an agent with the "agent create" command. We don't recommend this workflow because these types of agents don't
  use Agent Script, and are thus less flexible and more difficult to maintain.)

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

_See code: [src/commands/agent/generate/agent-spec.ts](https://github.com/salesforcecli/plugin-agent/blob/1.30.2/src/commands/agent/generate/agent-spec.ts)_

## `sf agent generate authoring-bundle`

Generate an authoring bundle from an existing agent spec YAML file.

```
USAGE
  $ sf agent generate authoring-bundle -o <value> [--json] [--flags-dir <value>] [--api-name <value>] [--api-version <value>] [-f
    <value>] [--no-spec] [-d <value>] [-n <value>] [--force-overwrite]

FLAGS
  -d, --output-dir=<value>   Directory where the authoring bundle files are generated.
  -f, --spec=<value>         Path to the agent spec YAML file. If you don't specify the flag, the command provides a
                             list that you can choose from. Use the --no-spec flag to skip using an agent spec entirely.
  -n, --name=<value>         Name (label) of the authoring bundle; if not specified, you're prompted for the name.
  -o, --target-org=<value>   (required) Username or alias of the target org. Not required if the `target-org`
                             configuration variable is already set.
      --api-name=<value>     API name of the new authoring bundle; if not specified, the API name is derived from the
                             authoring bundle name (label); the API name can't exist in the org.
      --api-version=<value>  Override the api version used for api requests made by this command
      --force-overwrite      Overwrite the existing authoring bundle if one with the same API name already exists
                             locally.
      --no-spec              Skip prompting for an agent spec and use the default Agent Script boilerplate in the
                             generated authoring bundle.

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Generate an authoring bundle from an existing agent spec YAML file.

  Authoring bundles are metadata components that contain an agent's Agent Script file. The Agent Script file is the
  agent's blueprint; it fully describes what the agent can do using the Agent Script language.

  Use this command to generate a new authoring bundle based on an agent spec YAML file, which you create with the "agent
  generate agent-spec" command. The agent spec YAML file is a high-level description of the agent; it describes its
  essence rather than exactly what it can do. The resulting Agent Script file is customized to reflect what's in the
  agent spec file. You can also create an authoring bundle without an agent spec file by specifying the "--no-spec"
  flag; in this case, the resulting Agent Script file is just the default boilerplate.

  The metadata type for authoring bundles is aiAuthoringBundle, which consist of a standard
  "<bundle-api-name>.bundle-meta.xml" metadata file and the Agent Script file (with extension ".agent"). When you run
  this command, the new authoring bundle is generated in the force-app/main/default/aiAuthoringBundles/<bundle-api-name>
  directory. Use the --output-dir flag to generate them elsewhere.

  After you generate the initial authoring bundle, code the Agent Script file so your agent behaves exactly as you want.
  The Agent Script file generated by this command is just a first draft of your agent! Interactively test the agent by
  conversing with it using the "agent preview" command. Then publish the agent to your org with the "agent publish
  authoring-bundle" command.

  This command requires an org because it uses it to access an LLM for generating the Agent Script file.

EXAMPLES
  Generate an authoring bundle by being prompted for all required values, such as the agent spec YAML file, the bundle
  name, and the API name; use your default org:

    $ sf agent generate authoring-bundle

  Generate an authoring bundle without using an agent spec file; give the bundle the label "My Authoring Bundle" and
  use your default org:

    $ sf agent generate authoring-bundle --no-spec --name "My Authoring Bundle"

  Generate an authoring bundle from the "specs/agentSpec.yaml" agent spec YAML file and give it the label "My
  Authoring Bundle"; use your default org:

    $ sf agent generate authoring-bundle --spec specs/agentSpec.yaml --name "My Authoring Bundle"

  Similar to previous example, but generate the authoring bundle files in the "other-package-dir/main/default" package
  directory; use the org with alias "my-dev-org":

    $ sf agent generate authoring-bundle --spec specs/agentSpec.yaml --name "My Authoring Bundle" --output-dir \
      other-package-dir/main/default --target-org my-dev-org
```

_See code: [src/commands/agent/generate/authoring-bundle.ts](https://github.com/salesforcecli/plugin-agent/blob/1.30.2/src/commands/agent/generate/authoring-bundle.ts)_

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

_See code: [src/commands/agent/generate/template.ts](https://github.com/salesforcecli/plugin-agent/blob/1.30.2/src/commands/agent/generate/template.ts)_

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
  - (Optional) Custom evaluation: Test an agent's response for specific strings or numbers.
  - (Optional) Conversation history: Boilerplate for additional context you can add to the test in the form of a
  conversation history.

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

_See code: [src/commands/agent/generate/test-spec.ts](https://github.com/salesforcecli/plugin-agent/blob/1.30.2/src/commands/agent/generate/test-spec.ts)_

## `sf agent preview`

Interact with an agent to preview how it responds to your statements, questions, and commands (utterances).

```
USAGE
  $ sf agent preview -o <value> [--flags-dir <value>] [--api-version <value>] [-n <value>] [--authoring-bundle
    <value>] [-d <value>] [-x] [--use-live-actions]

FLAGS
  -d, --output-dir=<value>        Directory where conversation transcripts are saved.
  -n, --api-name=<value>          API name of the activated published agent you want to interact with.
  -o, --target-org=<value>        (required) Username or alias of the target org. Not required if the `target-org`
                                  configuration variable is already set.
  -x, --apex-debug                Enable Apex debug logging during the agent preview conversation.
      --api-version=<value>       Override the api version used for api requests made by this command
      --authoring-bundle=<value>  API name of the authoring bundle metadata component that contains the agent's Agent
                                  Script file.
      --use-live-actions          Use real actions in the org; if not specified, preview uses AI to simulate (mock)
                                  actions.

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.

DESCRIPTION
  Interact with an agent to preview how it responds to your statements, questions, and commands (utterances).

  Use this command to have a natural language conversation with an agent, either while you code its local Agent Script
  file or when it's published to an org. Previewing an agent acts like an initial test to make sure it responds to your
  utterances as you expect. For example, you can test that the agent uses a particular topic when asked a question, and
  then whether it invokes the correct action associated with that topic. This command is the CLI-equivalent of the
  Preview panel in your org's Agentforce Builder UI.

  Run without flags, this command provides a list of agents to preview, divided into two categories: "Agent Script",
  which are agents that have a local authoring bundle in your DX project, or "Published", which are agents that are
  published and activated in your org. Authoring bundles contain an agent's Agent Script file. You then choose the agent
  you want to preview from the list. Or you can use the --authoring-bundle flag to specify a local authoring bundle's
  API name or --api-name to specify an activated published agent.

  When previewing an agent from its Agent Script file, you can use these two modes:

  - Simulated mode (Default): Uses only the Agent Script file to converse, and it simulates (mocks) all the actions. Use
  this mode if none of the Apex classes, flows, or prompt templates that implement your actions are available yet. The
  LLM uses the information about topics in the Agent Script file to simulate what the action does or how it responds.
  - Live mode: Uses the actual Apex classes, flows, and prompt templates in your development org in the agent preview.
  If you've changed the Apex classe, flows, or prompt templates in your local DX project, then you must deploy them to
  your development org if you want to use them in your live preview.

  You can use the Apex Replay Debugger to debug your Apex classes when using live mode for Agent Script files and for
  activated published agents; specify the --apex-debug flag.

  Once connected to your agent, the preview interface is simple: in the "Start typing..." prompt, enter a statement,
  question, or command; when you're done, enter Return. Your utterance is posted on the right along with a timestamp.
  The agent then responds on the left. To exit the conversation, hit ESC or Control+C.

  When the session concludes, the command asks if you want to save the API responses and chat transcripts. By default,
  the files are saved to the "./temp/agent-preview" directory. Specify a new default directory with the --output-dir
  flag.

EXAMPLES
  Preview an agent by choosing from the list of available local Agent Script or published agents. If previewing a
  local Agent Script agent, use simulated mode. Use the org with alias "my-dev-org".

    $ sf agent preview --target-org my-dev-org

  Preview an agent in live mode by choosing from a list of authoring bundles. Save the conversation transcripts to the
  "./transcripts/my-preview" directory, enable the Apex debug logs, and use your default org:

    $ sf agent preview --use-live-actions --apex-debug --output-dir transcripts/my-preview
```

_See code: [src/commands/agent/preview.ts](https://github.com/salesforcecli/plugin-agent/blob/1.30.2/src/commands/agent/preview.ts)_

## `sf agent preview end`

End an existing programmatic agent preview session and get trace location.

```
USAGE
  $ sf agent preview end -o <value> [--json] [--flags-dir <value>] [--api-version <value>] [--session-id <value>] [-n
    <value>] [--authoring-bundle <value>]

FLAGS
  -n, --api-name=<value>          API name of the activated published agent you want to preview.
  -o, --target-org=<value>        (required) Username or alias of the target org. Not required if the `target-org`
                                  configuration variable is already set.
      --api-version=<value>       Override the api version used for api requests made by this command
      --authoring-bundle=<value>  API name of the authoring bundle metadata component that contains the agent's Agent
                                  Script file.
      --session-id=<value>        Session ID outputted by "agent preview start". Not required when the agent has exactly
                                  one active session. Run "agent preview sessions" to see the list of all sessions.

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  End an existing programmatic agent preview session and get trace location.

  You must have previously started a programmatic agent preview session with the "agent preview start" command to then
  use this command to end it. This command also displays the local directory where the session trace files are stored.

  The original "agent preview start" command outputs a session ID which you then use with the --session-id flag of this
  command to end the session.  You don't have to specify the --session-id flag if an agent has only one active preview
  session. You must also use either the --authoring-bundle or --api-name flag to specify the API name of the authoring
  bundle or the published agent, respecitvely.  To find either API name, navigate to your package directory in your DX
  project. The API name of an authoring bundle is the same as its directory name under the "aiAuthoringBundles" metadata
  directory.  Similarly, the published agent's API name is the same as its directory name under the "Bots" metadata
  directory.

EXAMPLES
  End a preview session of a published agent by specifying its session ID and API name ; use the default org:

    $ sf agent preview end --session-id <SESSION_ID> --api-name My_Published_Agent

  Similar to previous example, but don't specify a session ID; you get an error if the published agent has more than
  one active session. Use the org with alias "my-dev-org":

    $ sf agent preview end --api-name My_Published_Agent --target-org my-dev-org

  End a preview session of an agent using its authoring bundle API name; you get an error if the agent has more than
  one active session.

    $ sf agent preview end --authoring-bundle My_Local_Agent
```

_See code: [src/commands/agent/preview/end.ts](https://github.com/salesforcecli/plugin-agent/blob/1.30.2/src/commands/agent/preview/end.ts)_

## `sf agent preview send`

Send a message to an existing agent preview session.

```
USAGE
  $ sf agent preview send -o <value> -u <value> [--json] [--flags-dir <value>] [--api-version <value>] [--session-id
    <value>] [-n <value>] [--authoring-bundle <value>]

FLAGS
  -n, --api-name=<value>          API name of the activated published agent you want to preview.
  -o, --target-org=<value>        (required) Username or alias of the target org. Not required if the `target-org`
                                  configuration variable is already set.
  -u, --utterance=<value>         (required) Utterance to send to the agent, enclosed in double quotes.
      --api-version=<value>       Override the api version used for api requests made by this command
      --authoring-bundle=<value>  API name of the authoring bundle metadata component that contains the agent's Agent
                                  Script file.
      --session-id=<value>        Session ID outputted by "agent preview start". Not required when the agent has exactly
                                  one active session. Run "agent preview sessions" to see list of all sessions.

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Send a message to an existing agent preview session.

  You must have previously started a programmatic agent preview session with the "agent preview start" command to then
  use this command to send the agent a message (utterance). This command then displays the agent's response.

  The original "agent preview start" command outputs a session ID which you then use with the --session-id flag of this
  command to send a message.  You don't have to specify the --session-id flag if an agent has only one active preview
  session. You must also use either the --authoring-bundle or --api-name flag to specify the API name of the authoring
  bundle or the published agent, respecitvely.  To find either API name, navigate to your package directory in your DX
  project. The API name of an authoring bundle is the same as its directory name under the "aiAuthoringBundles" metadata
  directory.  Similarly, the published agent's API name is the same as its directory name under the "Bots" metadata
  directory.

EXAMPLES
  Send a message to an activated published agent using its API name and session ID; use the default org:

    $ sf agent preview send --utterance "What can you help me with?" --api-name My_Published_Agent --session-id \
      <SESSION_ID>

  Similar to previous example, but don't specify a session ID; you get an error if the agent has more than one active
  session. Use the org with alias "my-dev-org":

    $ sf agent preview send --utterance "What can you help me with?" --api-name My_Published_Agent --target-org \
      my-dev-org

  Send a message to an agent using its authoring bundle API name; you get an error if the agent has more than one
  active session:

    $ sf agent preview send --utterance "what can you help me with?" --authoring-bundle My_Local_Agent
```

_See code: [src/commands/agent/preview/send.ts](https://github.com/salesforcecli/plugin-agent/blob/1.30.2/src/commands/agent/preview/send.ts)_

## `sf agent preview sessions`

List all known programmatic agent preview sessions.

```
USAGE
  $ sf agent preview sessions [--json] [--flags-dir <value>]

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  List all known programmatic agent preview sessions.

  This command lists the agent preview sessions that were started with the "agent preview start" command and are still
  in the local cache. Use this command to discover specific session IDs that you can pass to the "agent preview send" or
  "agent preview end" commands with the --session-id flag.

  Programmatic agent preview sessions can be started for both published activated agents and by using an agent's local
  authoring bundle, which contains its Agent Script file.  In this command's output table, the Agent column contains
  either the API name of the authoring bundle or the published agent, whichever was used when starting the session. In
  the table, if the same API name has multiple rows with different session IDs, then it means that you previously
  started multiple preview sessions with the associated agent.

EXAMPLES
  List all cached agent preview sessions:

    $ sf agent preview sessions
```

_See code: [src/commands/agent/preview/sessions.ts](https://github.com/salesforcecli/plugin-agent/blob/1.30.2/src/commands/agent/preview/sessions.ts)_

## `sf agent preview start`

Start a programmatic agent preview session.

```
USAGE
  $ sf agent preview start -o <value> [--json] [--flags-dir <value>] [--api-version <value>] [-n <value>]
    [--authoring-bundle <value>] [--use-live-actions]

FLAGS
  -n, --api-name=<value>          API name of the activated published agent you want to preview.
  -o, --target-org=<value>        (required) Username or alias of the target org. Not required if the `target-org`
                                  configuration variable is already set.
      --api-version=<value>       Override the api version used for api requests made by this command
      --authoring-bundle=<value>  API name of the authoring bundle metadata component that contains the agent's Agent
                                  Script file.
      --use-live-actions          Use real actions in the org; if not specified, preview uses AI to simulate (mock)
                                  actions.

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Start a programmatic agent preview session.

  This command outputs a session ID that you then use with the "agent preview send" command to send an utterance to the
  agent.  Use the "agent preview sessions" command to list all active sessions and the "agent preview end" command to
  end a specific session.

  Identify the agent you want to start previewing with either the --authoring-bundle flag to specify a local authoring
  bundle's API name or --api-name to specify an activated published agent's API name.  To find either API name, navigate
  to your package directory in your DX project. The API name of an authoring bundle is the same as its directory name
  under the "aiAuthoringBundles" metadata directory.  Similarly, the published agent's API name is the same as its
  directory name under the "Bots" metadata directory.

  When starting a preview session using the authoring bundle, which contains the agent's Agent Script file, the preview
  uses mocked actions by default.  Specify --use-live-actions for live mode, which uses the real Apex classes, flows,
  etc, in the org for the actions.

EXAMPLES
  Start a programmatic agent preview session by specifying an authoring bundle; uses mocked actions by default. Use
  the org with alias "my-dev-org":

    $ sf agent preview start --authoring-bundle My_Agent_Bundle --target-org my-dev-org

  Similar to previous example but use live actions and the default org:

    $ sf agent preview start --authoring-bundle My_Agent_Bundle --use-live-actions

  Start a preview session with an activated published agent:

    $ sf agent preview start --api-name My_Published_Agent
```

_See code: [src/commands/agent/preview/start.ts](https://github.com/salesforcecli/plugin-agent/blob/1.30.2/src/commands/agent/preview/start.ts)_

## `sf agent publish authoring-bundle`

Publish an authoring bundle to your org, which results in a new agent or a new version of an existing agent.

```
USAGE
  $ sf agent publish authoring-bundle -o <value> [--json] [--flags-dir <value>] [--api-version <value>] [-n <value>]
    [--skip-retrieve]

FLAGS
  -n, --api-name=<value>     API name of the authoring bundle you want to publish; if not specified, the command
                             provides a list that you can choose from.
  -o, --target-org=<value>   (required) Username or alias of the target org. Not required if the `target-org`
                             configuration variable is already set.
      --api-version=<value>  Override the api version used for api requests made by this command
      --skip-retrieve        Don't retrieve the metadata associated with the agent to your DX project.

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Publish an authoring bundle to your org, which results in a new agent or a new version of an existing agent.

  An authoring bundle is a metadata type (named aiAuthoringBundle) that provides the blueprint for an agent. The
  metadata type contains two files: the standard metatada XML file and an Agent Script file (extension ".agent") that
  fully describes the agent using the Agent Script language.

  When you publish an authoring bundle to your org, a number of things happen. First, this command validates that the
  Agent Script file successfully compiles. If there are compilation errors, the command exits and you must fix the Agent
  Script file to continue. Once the Agent Script file compiles, then it's published to the org, which in turn creates
  new associated metadata (Bot, BotVersion, GenAiX), or new versions of the metadata if the agent already exists. The
  new or updated metadata is retrieved back to your DX project; specify the --skip-retrieve flag to skip this step.
  Finally, the authoring bundle metadata (AiAuthoringBundle) is deployed to your org.

  This command uses the API name of the authoring bundle.

EXAMPLES
  Publish an authoring bundle by being prompted for its API name; use your default org:

    $ sf agent publish authoring-bundle

  Publish an authoring bundle with API name MyAuthoringBundle to the org with alias "my-dev-org":

    $ sf agent publish authoring-bundle --api-name MyAuthoringbundle --target-org my-dev-org
```

_See code: [src/commands/agent/publish/authoring-bundle.ts](https://github.com/salesforcecli/plugin-agent/blob/1.30.2/src/commands/agent/publish/authoring-bundle.ts)_

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

_See code: [src/commands/agent/test/create.ts](https://github.com/salesforcecli/plugin-agent/blob/1.30.2/src/commands/agent/test/create.ts)_

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

_See code: [src/commands/agent/test/list.ts](https://github.com/salesforcecli/plugin-agent/blob/1.30.2/src/commands/agent/test/list.ts)_

## `sf agent test results`

Get the results of a completed agent test run.

```
USAGE
  $ sf agent test results -o <value> -i <value> [--json] [--flags-dir <value>] [--api-version <value>] [--result-format
    json|human|junit|tap] [-d <value>] [--verbose]

FLAGS
  -d, --output-dir=<value>      Directory to write the agent test results into.
  -i, --job-id=<value>          (required) Job ID of the completed agent test run.
  -o, --target-org=<value>      (required) Username or alias of the target org. Not required if the `target-org`
                                configuration variable is already set.
      --api-version=<value>     Override the api version used for api requests made by this command
      --result-format=<option>  [default: human] Format of the agent test run results.
                                <options: json|human|junit|tap>
      --verbose                 Show generated data in the test results output.

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

  --verbose  Show generated data in the test results output.

    When enabled, includes detailed generated data (such as invoked actions) in the human-readable test results output.
    This is useful for debugging test failures and understanding what actions were actually invoked during the test run.

    The generated data is in JSON format and includes the Apex classes or Flows that were invoked, the Salesforce
    objects that were touched, and so on. Use the JSON structure of this information to build the test case JSONPath
    expression when using custom evaluations.
```

_See code: [src/commands/agent/test/results.ts](https://github.com/salesforcecli/plugin-agent/blob/1.30.2/src/commands/agent/test/results.ts)_

## `sf agent test resume`

Resume an agent test that you previously started in your org so you can view the test results.

```
USAGE
  $ sf agent test resume -o <value> [--json] [--flags-dir <value>] [--api-version <value>] [-i <value>] [-r] [-w
    <value>] [--result-format json|human|junit|tap] [-d <value>] [--verbose]

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
      --verbose                 Show generated data in the test results output.

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

  --verbose  Show generated data in the test results output.

    When enabled, includes detailed generated data (such as invoked actions) in the human-readable test results output.
    This is useful for debugging test failures and understanding what actions were actually invoked during the test run.

    The generated data is in JSON format and includes the Apex classes or Flows that were invoked, the Salesforce
    objects that were touched, and so on. Use the JSON structure of this information to build the test case JSONPath
    expression when using custom evaluations.
```

_See code: [src/commands/agent/test/resume.ts](https://github.com/salesforcecli/plugin-agent/blob/1.30.2/src/commands/agent/test/resume.ts)_

## `sf agent test run`

Start an agent test in your org.

```
USAGE
  $ sf agent test run -o <value> [--json] [--flags-dir <value>] [--api-version <value>] [-n <value>] [-w <value>]
    [--result-format json|human|junit|tap] [-d <value>] [--verbose]

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
      --verbose                 Show generated data in the test results output.

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

  --verbose  Show generated data in the test results output.

    When enabled, includes detailed generated data (such as invoked actions) in the human-readable test results output.
    This is useful for debugging test failures and understanding what actions were actually invoked during the test run.

    The generated data is in JSON format and includes the Apex classes or Flows that were invoked, the Salesforce
    objects that were touched, and so on. Use the JSON structure of this information to build the test case JSONPath
    expression when using custom evaluations.
```

_See code: [src/commands/agent/test/run.ts](https://github.com/salesforcecli/plugin-agent/blob/1.30.2/src/commands/agent/test/run.ts)_

## `sf agent validate authoring-bundle`

Validate an authoring bundle to ensure its Agent Script file compiles successfully and can be used to publish an agent.

```
USAGE
  $ sf agent validate authoring-bundle -o <value> [--json] [--flags-dir <value>] [--api-version <value>] [-n <value>]

FLAGS
  -n, --api-name=<value>     API name of the authoring bundle you want to validate; if not specified, the command
                             provides a list that you can choose from.
  -o, --target-org=<value>   (required) Username or alias of the target org. Not required if the `target-org`
                             configuration variable is already set.
      --api-version=<value>  Override the api version used for api requests made by this command

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Validate an authoring bundle to ensure its Agent Script file compiles successfully and can be used to publish an
  agent.

  An authoring bundle is a metadata type (named aiAuthoringBundle) that provides the blueprint for an agent. The
  metadata type contains two files: the standard metatada XML file and an Agent Script file (extension ".agent") that
  fully describes the agent using the Agent Script language.

  This command validates that the Agent Script file in the authoring bundle compiles without errors so that you can
  later publish the bundle to your org. Use this command while you code the Agent Script file to ensure that it's valid.
  If the validation fails, the command outputs the list of syntax errors, a brief description of the error, and the
  location in the Agent Script file where the error occurred.

  This command uses the API name of the authoring bundle. If you don't provide an API name with the --api-name flag, the
  command searches the current DX project and outputs a list of authoring bundles that it found for you to choose from.

EXAMPLES
  Validate an authoring bundle by being prompted for its API name; use your default org:

    $ sf agent validate authoring-bundle

  Validate an authoring bundle with API name MyAuthoringBundle; use the org with alias "my-dev-org":

    $ sf agent validate authoring-bundle --api-name MyAuthoringBundle --target-org my-dev-org
```

_See code: [src/commands/agent/validate/authoring-bundle.ts](https://github.com/salesforcecli/plugin-agent/blob/1.30.2/src/commands/agent/validate/authoring-bundle.ts)_

<!-- commandsstop -->
