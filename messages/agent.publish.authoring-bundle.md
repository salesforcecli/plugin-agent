# summary

Publish an authoring bundle to your org, which results in a new next-gen agent.

# description

When you publish an authoring bundle to your org, a number of things happen. First, this command validates that the agent file (with extension ".agent") successfully compiles. Then the authoring bundle metadata component is deployed to the org, and all associated metadata components, such as the Bot, BotVersion, and GenAiXXX components, are either created or updated. The org then creates a new next-gen agent based on the deployed authoring bundle and associated metadata. Finally, all the metadata associated with the new agent is retrieved back to your local DX project.

Authoring bundles are metadata types that represent the next-gen Salesforce agents. Their exact metadata name is AiAuthoringBundle and they consist of a standard "\*-meta.xml" metadata file and an agent file (with extension ".agent") that fully describes the next-gen agent.

This command requires the API name of the authoring bundle; if you don't provide it with the --api-name flag, the command prompts you for it.

# examples

- Publish an authoring bundle with API name MyAuthoringBundle to the org with alias "my-org", resulting in a new agent named "My Fab Agent"::

  <%= config.bin %> <%= command.id %> --api-name MyAuthoringbundle --agent-name "My Fab Agent" --target-org my-org

# flags.api-name.summary

API name of the authoring bundle you want to publish.

# flags.api-name.prompt

API name of the authoring bundle to publish

# flags.agent-name.summary

Name for the new agent that is created from the published authoring bundle.

# error.missingRequiredFlags

Required flag(s) missing: %s.

# error.invalidBundlePath

Invalid bundle path. Provide a valid directory path to an authoring bundle.

# error.publishFailed

Failed to publish agent with the following errors:
%s

# error.agentNotFound

Couldn't find an .agent file with API name '%s' in the project.

# error.agentNotFoundAction

Check that the API name is correct and that the .agent file exists in your project directory.
