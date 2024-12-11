# summary

Create an agent in your org from a local agent spec file.

# description

To generate an agent spec file, run the "agent generate spec" CLI command, which outputs a JSON file with the list of jobs and descriptions that the new agent can perform. Then specify this generated spec file to the --job-spec flag of this command, along with the name of the new agent.

When this command finishes, your org contains the new agent, which you can then edit in the Agent Builder UI. This command also retrieves all the metadata files associated with the new agent to your local DX project.

To open the new agent in your org's Agent Builder UI, run this command: "sf org open agent --name <api-name-of-your-agent>". If your agent's name includes spaces, replace them with underscores to get the API name. For example, if you specified --name "My Agent", the API name is "My_Agent".

# flags.job-spec.summary

Path to an agent spec file.

# flags.name.summary

Name of the new agent.

# examples

- Create an agent called "Customer Support Agent" in an org with alias "my-org" using the specified agent spec file:

  <%= config.bin %> <%= command.id %> --name "Customer Support Agent" --job-spec ./config/agentSpec.json --target-org my-org
