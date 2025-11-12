# summary

Publish an authoring bundle to your org, which results in a new or updated agent.

# description

An authoring bundle is a metadata type (named aiAuthoringBundle) that provides the blueprint for an agent. The metadata type contains two files: the standard metatada XML file and an Agent Script file (extension ".agent") that fully describes the agent using the Agent Script language.

When you publish an authoring bundle to your org, a number of things happen. First, this command validates that the Agent Script file successfully compiles. If there are compilation errors, the command exits and you must fix the Agent Script file to continue. Once the Agent Script file compiles, then the authoring bundle metadata component is deployed to the org, and all associated agent metadata components, such as the Bot, BotVersion, and GenAiXXX components, are either created or updated. The org then either creates a new agent based on the deployed authoring bundle, or creates a new version of the agent if it already existed. Finally, all the new or changed metadata components associated with the new agent are retrieved back to your local DX project.

This command uses the API name of the authoring bundle. If you don't provide an API name with the --api-name flag, the command searches the current DX project and outputs a list of authoring bundles that it found for you to choose from.

# examples

- Publish an authoring bundle with API name MyAuthoringBundle to the org with alias "my-org":

  <%= config.bin %> <%= command.id %> --api-name MyAuthoringbundle --target-org my-org

# flags.api-name.summary

API name of the authoring bundle you want to publish.

# flags.api-name.prompt

API name of the authoring bundle to publish

# error.missingRequiredFlags

Required flag(s) missing: %s.

# error.invalidBundlePath

Invalid bundle path. Provide a valid directory path to an authoring bundle.

# error.publishFailed

Failed to publish agent with the following errors:
%s

# error.agentNotFound

Couldn't find a ".bundle-meta.xml" file with API name '%s' in the DX project.

# error.agentNotFoundAction

Check that the API name is correct and that the ".agent" file exists in your DX project directory.
