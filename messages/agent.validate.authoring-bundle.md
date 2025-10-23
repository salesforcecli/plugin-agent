# summary

Validate a local authoring bundle to ensure it compiles successfully and can be used to create a next-gen agent.

# description

Authoring bundles are metadata types that represent the next-gen Salesforce agents. Their exact metadata name is AiAuthoringBundle and they consist of a standard "\*-meta.xml" metadata file and an agent file (with extension ".agent") that fully describes the next-gen agent. Generate a local authoring bundle with the "agent generate authoring-bundle" command.

This command validates that the agent file (with extension ".agent") that's part of the authoring bundle compiles without errors and can later be used to successfully create a next-gen agent.

This command requires the API name of the authoring bundle; if you don't provide it with the --api-name flag, the command prompts you for it.

# examples

- Validate a local authoring bundle with API name MyAuthoringBundle:

  <%= config.bin %> <%= command.id %> --api-name MyAuthoringBundle

# flags.api-name.summary

API name of the authoring bundle you want to validate.

# flags.api-name.prompt

API name of the authoring bundle to validate

# error.missingRequiredFlags

Required flag(s) missing: %s.

# error.invalidBundlePath

Invalid authoring bundle path. Provide a valid directory path to the authoring bundle you want to validate.

# error.compilationFailed

Compilation of the agent file failed with the following errors:
%s

# error.agentNotFound

Could not find a .bundle-meta.xml file with API name '%s' in the project.

# error.agentNotFoundAction

Check that the API name is correct and that the ".agent" file exists in your project directory.
