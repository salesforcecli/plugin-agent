# summary

Create an agent in your org using a local agent spec file.

# description

Before you run this command, you must first generate an agent spec file by running the "agent generate spec" CLI command, which outputs a YAML file with the agent properties and list of AI-generated topics. Topics define the range of jobs the agent can handle. Then specify the generated agent spec file to this command using the --spec flag, along with the name (label) of the new agent using the --agent-name flag.

When this command finishes, your org contains the new agent, which you can then edit in the Agent Builder UI. The new agent's topics are the same as the ones listed in the agent spec file. The agent might also have some AI-generated actions. This command also retrieves all the metadata files associated with the new agent to your local Salesforce DX project.

Use the --preview flag to review what the agent looks like without actually saving it in your org. Rather, the command creates a JSON file with all the agent details in the current directory.

To open the new agent in your org's Agent Builder UI, run this command: "sf org open agent --name <api-name-of-your-agent>".

# flags.spec.summary

Path to an agent spec file.

# flags.preview.summary

Preview the agent without saving it in your org.

# flags.agent-name.summary

Name (label) of the new agent.

# flags.agent-api-name.summary

API name of the new agent; if not specified, the API name is derived from the agent name (label); the API name must not exist in the org.

# flags.agent-api-name.prompt

API name of the new agent (default = %s)

# flags.planner-id.summary

An existing GenAiPlanner ID to associate with the agent.

# error.missingRequiredFlags

Missing required flags: %s

# error.missingRequiredSpecProperties

Missing required spec file properties: %s

# examples

- Create an agent called "ResortManager" in an org with alias "my-org" using the specified agent spec file:

  <%= config.bin %> <%= command.id %> --agent-name ResortManager --spec specs/resortManagerAgent.yaml --target-org my-org

- Preview the creation of an agent called "ResortManager" and use your default org:

  <%= config.bin %> <%= command.id %> --agent-name ResortManager --spec specs/resortManagerAgent.yaml --preview
