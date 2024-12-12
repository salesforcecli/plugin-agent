# summary

Create an agent in your org from a local agent spec file.

# description

To generate an agent spec file, run the "agent generate spec" CLI command, which outputs a JSON file with the list of jobs and descriptions that the new agent can perform. Then specify this generated spec file to the --job-spec flag of this command, along with the name of the new agent.

When this command finishes, your org contains the new agent, which you can then edit in the Agent Builder UI. The new agent already has a list of topics and actions that were automatically created from the list of jobs in the provided agent spec file. This command also retrieves all the metadata files associated with the new agent to your local DX project.

To open the new agent in your org's Agent Builder UI, run this command: "sf org open agent --name <api-name-of-your-agent>". 

# flags.job-spec.summary

Path to an agent spec file.

# flags.name.summary

API name of the new agent.

# examples

- Create an agent called "CustomerSupportAgent" in an org with alias "my-org" using the specified agent spec file:

  <%= config.bin %> <%= command.id %> --name CustomerSupportAgent --job-spec ./config/agentSpec.json --target-org my-org
