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
- [`sf agent generate spec`](#sf-agent-generate-spec)
- [`sf agent preview`](#sf-agent-preview)
- [`sf agent test cancel`](#sf-agent-test-cancel)
- [`sf agent test results`](#sf-agent-test-results)
- [`sf agent test resume`](#sf-agent-test-resume)
- [`sf agent test run`](#sf-agent-test-run)

## `sf agent create`

Create an Agent from an agent spec.

```
USAGE
  $ sf agent create -o <value> -f <value> -n <value> [--json] [--flags-dir <value>] [--api-version <value>]

FLAGS
  -f, --job-spec=<value>     (required) The path to an agent spec file.
  -n, --name=<value>         (required) The name of the agent.
  -o, --target-org=<value>   (required) Username or alias of the target org. Not required if the `target-org`
                             configuration variable is already set.
      --api-version=<value>  Override the api version used for api requests made by this command

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Create an Agent from an agent spec.

  Create an Agent from an agent spec. Agent metadata is created in the target org and retrieved to the local project.

EXAMPLES
  Create an Agent:

    $ sf agent create --spec ./agent-spec.json

FLAG DESCRIPTIONS
  -f, --job-spec=<value>  The path to an agent spec file.

    The agent spec file defines job titles and descriptions for the agent and can be created using the `sf agent create
    spec` command.
```

_See code: [src/commands/agent/create.ts](https://github.com/salesforcecli/plugin-agent/blob/1.5.1/src/commands/agent/create.ts)_

## `sf agent generate spec`

Create an Agent spec.

```
USAGE
  $ sf agent generate spec -o <value> [--json] [--flags-dir <value>] [--api-version <value>] [-t customer|internal]
    [--role <value>] [--company-name <value>] [--company-description <value>] [--company-website <value>] [-d <value>]
    [-f <value>]

FLAGS
  -d, --output-dir=<value>           [default: config] The location within the project where the agent spec will be
                                     written.
  -f, --file-name=<value>            [default: agentSpec.json] The name of the file to write the agent spec to.
  -o, --target-org=<value>           (required) Username or alias of the target org. Not required if the `target-org`
                                     configuration variable is already set.
  -t, --type=<option>                The type of agent to create.
                                     <options: customer|internal>
      --api-version=<value>          Override the api version used for api requests made by this command
      --company-description=<value>  The description of the company, containing details to be used when generating agent
                                     job descriptions.
      --company-name=<value>         The name of the company.
      --company-website=<value>      The website URL for the company.
      --role=<value>                 The role of the agent.

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Create an Agent spec.

  Create an Agent spec, which is a list of job titles and descriptions that the agent performs.

EXAMPLES
  Create an Agent spec in the default location:

    $ sf agent generate spec --type customer_facing --role Support --company-name "Coral Cloud" \
      --company-description "A meaningful description"
```

_See code: [src/commands/agent/generate/spec.ts](https://github.com/salesforcecli/plugin-agent/blob/1.5.1/src/commands/agent/generate/spec.ts)_

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

_See code: [src/commands/agent/preview.ts](https://github.com/salesforcecli/plugin-agent/blob/1.5.1/src/commands/agent/preview.ts)_

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

_See code: [src/commands/agent/test/cancel.ts](https://github.com/salesforcecli/plugin-agent/blob/1.5.1/src/commands/agent/test/cancel.ts)_

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

_See code: [src/commands/agent/test/results.ts](https://github.com/salesforcecli/plugin-agent/blob/1.5.1/src/commands/agent/test/results.ts)_

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

_See code: [src/commands/agent/test/resume.ts](https://github.com/salesforcecli/plugin-agent/blob/1.5.1/src/commands/agent/test/resume.ts)_

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

_See code: [src/commands/agent/test/run.ts](https://github.com/salesforcecli/plugin-agent/blob/1.5.1/src/commands/agent/test/run.ts)_

<!-- commandsstop -->
