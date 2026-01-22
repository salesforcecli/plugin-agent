# summary

Publish an authoring bundle to your org, which results in a new agent or a new version of an existing agent.

# description

An authoring bundle is a metadata type (named aiAuthoringBundle) that provides the blueprint for an agent. The metadata type contains two files: the standard metatada XML file and an Agent Script file (extension ".agent") that fully describes the agent using the Agent Script language.

When you publish an authoring bundle to your org, a number of things happen. First, this command validates that the Agent Script file successfully compiles. If there are compilation errors, the command exits and you must fix the Agent Script file to continue. Once the Agent Script file compiles, then it's published to the org, which in turn creates new associated metadata (Bot, BotVersion, GenAiX), or new versions of the metadata if the agent already exists. The new or updated metadata is retrieved back to your DX project, and then the authoring bundle metadata (AiAuthoringBundle) is deployed to your org.

This command uses the API name of the authoring bundle.

# examples

- Publish an authoring bundle by being prompted for its API name; use your default org:

  <%= config.bin %> <%= command.id %>

- Publish an authoring bundle with API name MyAuthoringBundle to the org with alias "my-dev-org":

  <%= config.bin %> <%= command.id %> --api-name MyAuthoringbundle --target-org my-dev-org

# flags.api-name.summary

API name of the authoring bundle you want to publish; if not specified, the command provides a list that you can choose from.

# flags.api-name.prompt

API name of the authoring bundle to publish

# flags.skip-retrieve.summary

Skips the retrieval of metadata associated with the agent.

# error.missingRequiredFlags

Required flag(s) missing: %s.

# error.invalidBundlePath

Invalid authoring bundle path. Provide a valid directory path to an authoring bundle.

# error.publishFailed

Failed to publish agent with the following errors:
%s

# error.agentNotFound

Couldn't find a ".bundle-meta.xml" file with API name '%s' in the DX project.

# error.agentNotFoundAction

Check that the API name is correct and that the ".agent" file exists in your DX project directory.
