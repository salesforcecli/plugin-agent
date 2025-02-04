# plugin-agent - PREVIEW

### THIS PLUGIN IS A PREVIEW VERSION AND IS NOT MEANT FOR PRODUCTION USAGE UNTIL ANNOUNCED.

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
- [`sf agent generate test-spec`](#sf-agent-generate-test-spec)
- [`sf agent preview`](#sf-agent-preview)
- [`sf agent test cancel`](#sf-agent-test-cancel)
- [`sf agent test create`](#sf-agent-test-create)
- [`sf agent test list`](#sf-agent-test-list)
- [`sf agent test results`](#sf-agent-test-results)
- [`sf agent test resume`](#sf-agent-test-resume)
- [`sf agent test run`](#sf-agent-test-run)

## `sf agent create`

Create an agent in your org using a local agent spec file.

```
USAGE
  $ sf agent create -o <value> [--json] [--flags-dir <value>] [--api-version <value>] [--agent-name <value>]
    [--agent-api-name <value>] [--spec <value>] [--preview]

FLAGS
  -o, --target-org=<value>      (required) Username or alias of the target org. Not required if the `target-org`
                                configuration variable is already set.
      --agent-api-name=<value>  API name of the new agent; if not specified, the API name is derived from the agent name
                                (label); the API name must not exist in the org.
      --agent-name=<value>      Name (label) of the new agent.
      --api-version=<value>     Override the api version used for api requests made by this command
      --preview                 Preview the agent without saving it in your org.
      --spec=<value>            Path to an agent spec file.

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Create an agent in your org using a local agent spec file.

  Before you run this command, you must first generate an agent spec file by running the "agent generate spec" CLI
  command, which outputs a YAML file with the agent properties and list of AI-generated topics. Topics define the range
  of jobs the agent can handle. Then specify the generated agent spec file to this command using the --spec flag, along
  with the name (label) of the new agent using the --agent-name flag.

  When this command finishes, your org contains the new agent, which you can then edit in the Agent Builder UI. The new
  agent's topics are the same as the ones listed in the agent spec file. The agent might also have some AI-generated
  actions. This command also retrieves all the metadata files associated with the new agent to your local Salesforce DX
  project.

  Use the --preview flag to review what the agent looks like without actually saving it in your org. Rather, the command
  creates a JSON file with all the agent details in the current directory.

  To open the new agent in your org's Agent Builder UI, run this command: "sf org open agent --name
  <api-name-of-your-agent>".

EXAMPLES
  Create an agent called "ResortManager" in an org with alias "my-org" using the specified agent spec file:

    $ sf agent create --agent-name ResortManager --spec specs/resortManagerAgent.yaml --target-org my-org

  Preview the creation of an agent called "ResortManager" and use your default org:

    $ sf agent create --agent-name ResortManager --spec specs/resortManagerAgent.yaml --preview
```

_See code: [src/commands/agent/create.ts](https://github.com/salesforcecli/plugin-agent/blob/1.13.1/src/commands/agent/create.ts)_

## `sf agent generate agent-spec`

Generate an agent spec, which is a YAML file that captures what an agent can do.

```
USAGE
  $ sf agent generate agent-spec -o <value> [--json] [--flags-dir <value>] [--api-version <value>] [--type customer|internal]
    [--role <value>] [--company-name <value>] [--company-description <value>] [--company-website <value>] [--max-topics
    <value>] [--agent-user <value>] [--enrich-logs true|false] [--tone formal|casual|neutral] [--spec <value>]
    [--output-file <value>] [--full-interview] [--grounding-context <value> --prompt-template <value>] [-p]

FLAGS
  -o, --target-org=<value>           (required) Username or alias of the target org. Not required if the `target-org`
                                     configuration variable is already set.
  -p, --no-prompt                    Don't prompt the user to confirm spec file overwrite.
      --agent-user=<value>           Username of a user in your org to assign to your agent; determines what your agent
                                     can access and do.
      --api-version=<value>          Override the api version used for api requests made by this command
      --company-description=<value>  Description of your company.
      --company-name=<value>         Name of your company.
      --company-website=<value>      Website URL of your company.
      --enrich-logs=<option>         Adds agent conversation data to event logs so you can view all agent session
                                     activity in one place.
                                     <options: true|false>
      --full-interview               Prompt for both required and optional flags.
      --grounding-context=<value>    Context information and personalization that's added to your prompts when using a
                                     custom prompt template.
      --max-topics=<value>           Maximum number of topics to generate in the agent spec; default is 10.
      --output-file=<value>          [default: specs/agentSpec.yaml] Path for the generated YAML agent spec file; can be
                                     an absolute or relative path.
      --prompt-template=<value>      API name of a customized prompt template to use instead of the default prompt
                                     template.
      --role=<value>                 Role of the agent.
      --spec=<value>                 Agent spec file, in YAML format, to use as input to the command.
      --tone=<option>                Conversational style of the agent, such as how it expresses your brand personality
                                     in its messages through word choice, punctuation, and sentence structure.
                                     <options: formal|casual|neutral>
      --type=<option>                Type of agent to create.
                                     <options: customer|internal>

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Generate an agent spec, which is a YAML file that captures what an agent can do.

  Before you use Salesforce CLI to create an agent in your org, you must first generate an agent spec with this command.
  An agent spec is a YAML-formatted file that contains information about the agent, such as its role and company
  description, and then an AI-generated list of topics based on this information. Topics define the range of jobs your
  agent can handle.

  Use flags, such as --role and --company-description, to provide details about your company and the role that the agent
  plays in your company. If you prefer, you can also be prompted for the information. Upon command execution, the large
  language model (LLM) associated with your org uses the information you provided to generate a list of topics for the
  agent. Because the LLM uses the company and role information to generate the topics, we recommend that you provide
  accurate and specific details so the LLM generates the best and most relevant topics. Once generated, you can edit the
  spec file; for example, you can remove topics that don't apply to your agent or change the description of a particular
  topic.

  You can iterate the spec generation process by using the --spec flag to pass an existing agent spec file to this
  command, and then using the --role, --company-description, etc, flags to refine your agent properties. Iteratively
  improving the description of your agent allows the LLM to generate progressively better topics.

  You can also specify a custom prompt template that the agent uses, and ground the prompt template to add context and
  personalization to the agent's prompts.

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

  Specify an existing agent spec file called "specs/resortManagerAgent.yaml", and then overwrite it with a new version
  that contains newly AI-generated topics based on the updated role information passed in with the --role flag:

    $ sf agent generate agent-spec --spec specs/resortManagerAgent.yaml --output-file specs/resortManagerAgent.yaml \
      --role "Field customer complaints, manage employee schedules, and ensure all resort operations are running \
      smoothly" --target-org my-org
```

_See code: [src/commands/agent/generate/agent-spec.ts](https://github.com/salesforcecli/plugin-agent/blob/1.13.1/src/commands/agent/generate/agent-spec.ts)_

## `sf agent generate test-spec`

Interactively generate a specification file for a AI evaluation test.

```
USAGE
  $ sf agent generate test-spec [--flags-dir <value>]

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.

DESCRIPTION
  Interactively generate a specification file for a AI evaluation test.

  This command will prompt you for the necessary information to create a new spec file (in yaml format). You can then
  create a new AI evaluation using "sf agent test create --spec <spec-file>".

EXAMPLES
  $ sf agent generate test-spec
```

_See code: [src/commands/agent/generate/test-spec.ts](https://github.com/salesforcecli/plugin-agent/blob/1.13.1/src/commands/agent/generate/test-spec.ts)_

## `sf agent preview`

Interact with an active agent, as a user would, to preview responses

```
USAGE
  $ sf agent preview -o <value> -n <value> [--flags-dir <value>] [--api-version <value>]

FLAGS
  -n, --name=<value>         (required) The name of the agent you want to preview
  -o, --target-org=<value>   (required) Username or alias of the target org. Not required if the `target-org`
                             configuration variable is already set.
      --api-version=<value>  Override the api version used for api requests made by this command

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.

DESCRIPTION
  Interact with an active agent, as a user would, to preview responses

  XXX

EXAMPLES
  $ sf agent preview --agent HelpDeskAgent

  $ sf agent preview --agent ConciergeAgent --target-org production

FLAG DESCRIPTIONS
  -n, --name=<value>  The name of the agent you want to preview

    the API name of the agent? (TBD based on agents library)
```

_See code: [src/commands/agent/preview.ts](https://github.com/salesforcecli/plugin-agent/blob/1.13.1/src/commands/agent/preview.ts)_

## `sf agent test cancel`

Cancel an agent test that's currently running in your org.

```
USAGE
  $ sf agent test cancel -o <value> [--json] [--flags-dir <value>] [--api-version <value>] [-i <value>] [-r]

FLAGS
  -i, --job-id=<value>       Job ID of the running agent test that you want to cancel.
  -o, --target-org=<value>   (required) Username or alias of the target org. Not required if the `target-org`
                             configuration variable is already set.
  -r, --use-most-recent      Use the job ID of the most recently-run agent test.
      --api-version=<value>  Override the api version used for api requests made by this command

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Cancel an agent test that's currently running in your org.

  This command requires a job ID, which the original "agent test run" command displays when it completes. You can also
  use the --use-most-recent flag to see results for the most recently run agent test.

EXAMPLES
  Cancel an agent test currently running in your default org using a job ID:

    $ sf agent test cancel --job-id 4KBfake0000003F4AQ

  Cancel the most recently run agent test in the org with alias "my-org":

    $ sf agent test cancel --job-id 4KBfake0000003F4AQ --target-org my-org
```

_See code: [src/commands/agent/test/cancel.ts](https://github.com/salesforcecli/plugin-agent/blob/1.13.1/src/commands/agent/test/cancel.ts)_

## `sf agent test create`

Summary of a command.

```
USAGE
  $ sf agent test create -s <value> -o <value> [--json] [--flags-dir <value>] [--api-version <value>] [--preview] [-p]

FLAGS
  -o, --target-org=<value>   (required) Username or alias of the target org. Not required if the `target-org`
                             configuration variable is already set.
  -p, --no-prompt            Don't prompt for confirmation when overwriting an existing test.
  -s, --spec=<value>         (required) Description of a flag.
      --api-version=<value>  Override the api version used for api requests made by this command
      --preview              Preview the test metadata without deploying to your org.

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Summary of a command.

  More information about a command. Don't repeat the summary.

EXAMPLES
  $ sf agent test create

FLAG DESCRIPTIONS
  -s, --spec=<value>  Description of a flag.

    More information about a flag. Don't repeat the summary.
```

_See code: [src/commands/agent/test/create.ts](https://github.com/salesforcecli/plugin-agent/blob/1.13.1/src/commands/agent/test/create.ts)_

## `sf agent test list`

List the available tests in the org.

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
  List the available tests in the org.

  Run this command to get a list of tests that are available in the org. This command will return the test ID, name, and
  created date of each test.

EXAMPLES
  $ sf agent test list
```

_See code: [src/commands/agent/test/list.ts](https://github.com/salesforcecli/plugin-agent/blob/1.13.1/src/commands/agent/test/list.ts)_

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

_See code: [src/commands/agent/test/results.ts](https://github.com/salesforcecli/plugin-agent/blob/1.13.1/src/commands/agent/test/results.ts)_

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

_See code: [src/commands/agent/test/resume.ts](https://github.com/salesforcecli/plugin-agent/blob/1.13.1/src/commands/agent/test/resume.ts)_

## `sf agent test run`

Start an agent test in your org.

```
USAGE
  $ sf agent test run -o <value> -n <value> [--json] [--flags-dir <value>] [--api-version <value>] [-w <value>]
    [--result-format json|human|junit|tap] [-d <value>]

FLAGS
  -d, --output-dir=<value>      Directory to write the agent test results into.
  -n, --name=<value>            (required) Name of the agent test to start.
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

  Use the --name flag to specify the name of the agent test you want to run; find the agent test's name in the Testing
  Center page in the Setup UI of your org.

  This command starts the agent test in your org, but doesn't by default wait for it to finish. Instead, it displays the
  "agent test resume" command, with a job ID, that you execute to see the results of the test run, and then returns
  control of the terminal window to you. Use the --wait flag to specify the number of minutes for the command to wait
  for the agent test to complete; if the test completes by the end of the wait time, the command displays the test
  results. If not, run "agent test resume".

  By default, this command outputs test results in human-readable tables for each test case, if the test completes in
  time. The tables show whether the test case passed, the expected and actual values, the test score, how long the test
  took, and more. Use the --result-format to display the test results in JSON or Junit format. Use the --output-dir flag
  to write the results to a file rather than to the terminal.

EXAMPLES
  Start a test called MyAgentTest for an agent in your default org, don't wait for the test to finish:

    $ sf agent test run --name MyAgentTest

  Start a test for an agent in an org with alias "my-org" and wait for 10 minutes for the test to finish:

    $ sf agent test run --name MyAgentTest --wait 10 --target-org my-org

  Start a test and write the JSON-formatted results into a directory called "test-results":

    $ sf agent test run --name MyAgentTest --wait 10 --output-dir ./test-results --result-format json

FLAG DESCRIPTIONS
  -d, --output-dir=<value>  Directory to write the agent test results into.

    If the agent test run completes, write the results to the specified directory. If the test is still running, the
    test results aren't written.
```

_See code: [src/commands/agent/test/run.ts](https://github.com/salesforcecli/plugin-agent/blob/1.13.1/src/commands/agent/test/run.ts)_

<!-- commandsstop -->
