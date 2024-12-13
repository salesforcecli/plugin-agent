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
- [`sf agent generate definition`](#sf-agent-generate-definition)
- [`sf agent generate spec`](#sf-agent-generate-spec)
- [`sf agent generate testset`](#sf-agent-generate-testset)
- [`sf agent preview`](#sf-agent-preview)
- [`sf agent test cancel`](#sf-agent-test-cancel)
- [`sf agent test results`](#sf-agent-test-results)
- [`sf agent test resume`](#sf-agent-test-resume)
- [`sf agent test run`](#sf-agent-test-run)

## `sf agent create`

Create an agent in your org from a local agent spec file.

```
USAGE
  $ sf agent create -o <value> -f <value> -n <value> [--json] [--flags-dir <value>] [--api-version <value>]

FLAGS
  -f, --job-spec=<value>     (required) Path to an agent spec file.
  -n, --name=<value>         (required) API name of the new agent.
  -o, --target-org=<value>   (required) Username or alias of the target org. Not required if the `target-org`
                             configuration variable is already set.
      --api-version=<value>  Override the api version used for api requests made by this command

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Create an agent in your org from a local agent spec file.

  To generate an agent spec file, run the "agent generate spec" CLI command, which outputs a JSON file with the list of
  jobs and descriptions that the new agent can perform. Then specify this generated spec file to the --job-spec flag of
  this command, along with the name of the new agent.

  When this command finishes, your org contains the new agent, which you can then edit in the Agent Builder UI. The new
  agent already has a list of topics and actions that were automatically created from the list of jobs in the provided
  agent spec file. This command also retrieves all the metadata files associated with the new agent to your local DX
  project.

  To open the new agent in your org's Agent Builder UI, run this command: "sf org open agent --name
  <api-name-of-your-agent>".

EXAMPLES
  Create an agent called "CustomerSupportAgent" in an org with alias "my-org" using the specified agent spec file:

    $ sf agent create --name CustomerSupportAgent --job-spec ./config/agentSpec.json --target-org my-org
```

_See code: [src/commands/agent/create.ts](https://github.com/salesforcecli/plugin-agent/blob/1.6.0/src/commands/agent/create.ts)_

## `sf agent generate definition`

Interactively generate a new AiEvaluationDefinition.

```
USAGE
  $ sf agent generate definition [--flags-dir <value>]

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.

DESCRIPTION
  Interactively generate a new AiEvaluationDefinition.

  This command will prompt you for the necessary information to create a new AiEvaluationDefinition. The definition will
  be saved to the `aiEvaluationDefinitions` directory in the project.

  You must have the `Bots` and `AiEvaluationTestSets` metadata types present in your project to use this command.

EXAMPLES
  $ sf agent generate definition
```

_See code: [src/commands/agent/generate/definition.ts](https://github.com/salesforcecli/plugin-agent/blob/1.6.0/src/commands/agent/generate/definition.ts)_

## `sf agent generate spec`

Generate an agent spec, which is the list of jobs that the agent performs.

```
USAGE
  $ sf agent generate spec -o <value> [--json] [--flags-dir <value>] [--api-version <value>] [-t customer|internal]
    [--role <value>] [--company-name <value>] [--company-description <value>] [--company-website <value>] [-d <value>]
    [-f <value>]

FLAGS
  -d, --output-dir=<value>           [default: config] Directory where the agent spec file is written; can be an
                                     absolute or relative path.
  -f, --file-name=<value>            [default: agentSpec.json] Name of the generated agent spec file.
  -o, --target-org=<value>           (required) Username or alias of the target org. Not required if the `target-org`
                                     configuration variable is already set.
  -t, --type=<option>                Type of agent to create.
                                     <options: customer|internal>
      --api-version=<value>          Override the api version used for api requests made by this command
      --company-description=<value>  Description of your company.
      --company-name=<value>         Name of your company.
      --company-website=<value>      Website URL of your company.
      --role=<value>                 Role of the agent.

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Generate an agent spec, which is the list of jobs that the agent performs.

  When using Salesforce CLI to create an agent in your org, the first step is to generate the local JSON-formatted agent
  spec file with this command.

  An agent spec is a list of jobs and descriptions that capture what the agent can do. Use flags such as --role and
  --company-description to provide details about your company and the role that the agent plays in your company; you can
  also enter the information interactively if you prefer. When you then execute this command, the large language model
  (LLM) associated with your org uses the information to generate the list of jobs that the agent most likely performs.
  We recommend that you provide good details for --role, --company-description, etc, so that the LLM can generate the
  best and most relevant list of jobs and descriptions. Once generated, you can edit the spec file; for example, you can
  remove jobs that don't apply to your agent.

  When your agent spec is ready, you then create the agent in your org by specifying the agent spec file to the
  --job-spec flag of the "agent create" CLI command.

EXAMPLES
  Create an agent spec for your default org in the default location and use flags to specify the agent's role and your
  company details:

    $ sf agent generate spec --type customer --role "Assist users in navigating and managing bookings" \
      --company-name "Coral Cloud" --company-description "Resort that manages guests and their reservations and \
      experiences"

  Create an agent spec by being prompted for role and company details interactively; write the generated file to the
  "specs" directory and use the org with alias "my-org":

    $ sf agent generate spec --output-dir specs --target-org my-org
```

_See code: [src/commands/agent/generate/spec.ts](https://github.com/salesforcecli/plugin-agent/blob/1.6.0/src/commands/agent/generate/spec.ts)_

## `sf agent generate testset`

Interactively generate an AiEvaluationTestSet.

```
USAGE
  $ sf agent generate testset [--flags-dir <value>]

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.

DESCRIPTION
  Interactively generate an AiEvaluationTestSet.

  Answer the prompts to generate an AiEvaluationTestSet that will be written to a file. You can then run "sf agent
  generate definition" to generate the AiEvaluationDefinition that can be used to evaluate the test set.

EXAMPLES
  $ sf agent generate testset
```

_See code: [src/commands/agent/generate/testset.ts](https://github.com/salesforcecli/plugin-agent/blob/1.6.0/src/commands/agent/generate/testset.ts)_

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

_See code: [src/commands/agent/preview.ts](https://github.com/salesforcecli/plugin-agent/blob/1.6.0/src/commands/agent/preview.ts)_

## `sf agent test cancel`

Cancel a running test for an Agent.

```
USAGE
  $ sf agent test cancel -o <value> [--json] [--flags-dir <value>] [--api-version <value>] [-i <value>] [-r]

FLAGS
  -i, --job-id=<value>       The AiEvaluation ID.
  -o, --target-org=<value>   (required) Username or alias of the target org. Not required if the `target-org`
                             configuration variable is already set.
  -r, --use-most-recent      Use the job ID of the most recent test evaluation.
      --api-version=<value>  Override the api version used for api requests made by this command

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Cancel a running test for an Agent.

  Cancel a running test for an Agent, providing the AiEvaluation ID.

EXAMPLES
  Cancel a test for an Agent:

    $ sf agent test cancel --job-id AiEvalId
```

_See code: [src/commands/agent/test/cancel.ts](https://github.com/salesforcecli/plugin-agent/blob/1.6.0/src/commands/agent/test/cancel.ts)_

## `sf agent test results`

Get the results of a test evaluation.

```
USAGE
  $ sf agent test results -o <value> -i <value> [--json] [--flags-dir <value>] [--api-version <value>] [--result-format
    json|human|junit] [-f <value>]

FLAGS
  -f, --output-dir=<value>      Directory to write the test results to.
  -i, --job-id=<value>          (required) The AiEvaluation ID.
  -o, --target-org=<value>      (required) Username or alias of the target org. Not required if the `target-org`
                                configuration variable is already set.
      --api-version=<value>     Override the api version used for api requests made by this command
      --result-format=<option>  [default: human] Format of the test run results.
                                <options: json|human|junit>

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Get the results of a test evaluation.

  Provide the AiEvaluation ID to get the results of a test evaluation.

EXAMPLES
  $ sf agent test results --job-id AiEvalId

FLAG DESCRIPTIONS
  -f, --output-dir=<value>  Directory to write the test results to.

    If test run is complete, write the results to the specified directory. If the tests are still running, the test
    results will not be written.
```

_See code: [src/commands/agent/test/results.ts](https://github.com/salesforcecli/plugin-agent/blob/1.6.0/src/commands/agent/test/results.ts)_

## `sf agent test resume`

Resume a running test for an Agent.

```
USAGE
  $ sf agent test resume -o <value> [--json] [--flags-dir <value>] [--api-version <value>] [-i <value>] [-r] [-w
    <value>] [--result-format json|human|junit] [-f <value>]

FLAGS
  -f, --output-dir=<value>      Directory to write the test results to.
  -i, --job-id=<value>          The AiEvaluation ID.
  -o, --target-org=<value>      (required) Username or alias of the target org. Not required if the `target-org`
                                configuration variable is already set.
  -r, --use-most-recent         Use the job ID of the most recent test evaluation.
  -w, --wait=<value>            [default: 5 minutes] Number of minutes to wait for the command to complete and display
                                results to the terminal window.
      --api-version=<value>     Override the api version used for api requests made by this command
      --result-format=<option>  [default: human] Format of the test run results.
                                <options: json|human|junit>

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Resume a running test for an Agent.

  Resume a running test for an Agent, providing the AiEvaluation ID.

EXAMPLES
  Resume a test for an Agent:

    $ sf agent test resume --job-id AiEvalId

FLAG DESCRIPTIONS
  -f, --output-dir=<value>  Directory to write the test results to.

    If test run is complete, write the results to the specified directory. If the tests are still running, the test
    results will not be written.

  -w, --wait=<value>  Number of minutes to wait for the command to complete and display results to the terminal window.

    If the command continues to run after the wait period, the CLI returns control of the terminal window to you.
```

_See code: [src/commands/agent/test/resume.ts](https://github.com/salesforcecli/plugin-agent/blob/1.6.0/src/commands/agent/test/resume.ts)_

## `sf agent test run`

Start a test for an Agent.

```
USAGE
  $ sf agent test run -o <value> -n <value> [--json] [--flags-dir <value>] [--api-version <value>] [-w <value>]
    [--result-format json|human|junit] [-f <value>]

FLAGS
  -f, --output-dir=<value>      Directory to write the test results to.
  -n, --name=<value>            (required) The name of the AiEvaluationDefinition to start.
  -o, --target-org=<value>      (required) Username or alias of the target org. Not required if the `target-org`
                                configuration variable is already set.
  -w, --wait=<value>            Number of minutes to wait for the command to complete and display results to the
                                terminal window.
      --api-version=<value>     Override the api version used for api requests made by this command
      --result-format=<option>  [default: human] Format of the test run results.
                                <options: json|human|junit>

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Start a test for an Agent.

  Start a test for an Agent, providing the AiEvalDefinitionVersion ID. Returns the job ID.

EXAMPLES
  Start a test for an Agent:

    $ sf agent test run --name AiEvalDefVerId

FLAG DESCRIPTIONS
  -f, --output-dir=<value>  Directory to write the test results to.

    If test run is complete, write the results to the specified directory. If the tests are still running, the test
    results will not be written.

  -n, --name=<value>  The name of the AiEvaluationDefinition to start.

    The name of the AiEvaluationDefinition to start.

  -w, --wait=<value>  Number of minutes to wait for the command to complete and display results to the terminal window.

    If the command continues to run after the wait period, the CLI returns control of the terminal window to you.
```

_See code: [src/commands/agent/test/run.ts](https://github.com/salesforcecli/plugin-agent/blob/1.6.0/src/commands/agent/test/run.ts)_

<!-- commandsstop -->
