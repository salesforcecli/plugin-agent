# summary

Validate an authoring bundle to ensure its Agent Script file compiles successfully and can be used to publish an agent.

# description

An authoring bundle is a metadata type (named aiAuthoringBundle) that provides the blueprint for an agent. The metadata type contains two files: the standard metatada XML file and an Agent Script file (extension ".agent") that fully describes the agent using the Agent Script language.

This command validates that the Agent Script file in the authoring bundle compiles without errors so that you can later publish the bundle to your org. Use this command while you code the Agent Script file to ensure that it's valid. If the validation fails, the command outputs the list of syntax errors, a brief description of the error, and the location in the Agent Script file where the error occurred.

This command uses the API name of the authoring bundle. If you don't provide an API name with the --api-name flag, the command searches the current DX project and outputs a list of authoring bundles that it found for you to choose from.

# examples

- Validate an authoring bundle by being prompted for its API name; use your default org:

  <%= config.bin %> <%= command.id %>

- Validate an authoring bundle with API name MyAuthoringBundle; use the org with alias "my-dev-org":

  <%= config.bin %> <%= command.id %> --api-name MyAuthoringBundle --target-org my-dev-org

# flags.api-name.summary

API name of the authoring bundle you want to validate; if not specified, the command provides a list that you can choose from.

# flags.api-name.prompt

API name of the authoring bundle to validate

# error.missingRequiredFlags

Required flag(s) missing: %s.

# error.invalidBundlePath

Invalid authoring bundle path. Provide a valid directory path to the authoring bundle you want to validate.

# error.compilationFailed

Compilation of the Agent Script file failed with the following errors:
%s

# error.agentNotFound

Couldn't find a ".bundle-meta.xml" file with API name '%s' in the DX project.

# error.agentNotFoundAction

Check that the API name is correct and that the ".agent" file exists in your DX project directory.
