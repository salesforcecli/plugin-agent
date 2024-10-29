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

To use your plugin, run using the local `./bin/dev` or `./bin/dev.cmd` file.

```bash
# Run using local run file.
./bin/dev agent
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

- [`sf agent run test`](#sf-agent-run-test)

## `sf agent run test`

Start a test for an Agent.

```
USAGE
  $ sf agent run test -o <value> -i <value> [--json] [--flags-dir <value>] [-w <value>] [-d <value>]

FLAGS
  -d, --output-dir=<value>  Directory in which to store test run files.
  -i, --id=<value>          (required) The AiEvalDefinitionVersion ID.
  -o, --target-org=<value>  (required) Username or alias of the target org. Not required if the `target-org`
                            configuration variable is already set.
  -w, --wait=<value>        Number of minutes to wait for the command to complete and display results to the terminal
                            window.

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Start a test for an Agent.

  Start a test for an Agent, providing the AiEvalDefinitionVersion ID. Returns the job ID.

EXAMPLES
  Start a test for an Agent:

    $ sf agent run test --id AiEvalDefVerId

FLAG DESCRIPTIONS
  -i, --id=<value>  The AiEvalDefinitionVersion ID.

    The AiEvalDefinitionVersion ID.

  -w, --wait=<value>  Number of minutes to wait for the command to complete and display results to the terminal window.

    If the command continues to run after the wait period, the CLI returns control of the terminal window to you.
```

_See code: [src/commands/agent/run/test.ts](https://github.com/salesforcecli/plugin-agent/blob/1.1.0/src/commands/agent/run/test.ts)_

<!-- commandsstop -->
