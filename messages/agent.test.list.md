# summary

List the available agent tests in your org.

# description

The command outputs a table with the name (API name) of each test along with its unique ID and the date it was created in the org.

# examples

- List the agent tests in your default org:

  <%= config.bin %> <%= command.id %>

- List the agent tests in an org with alias "my-org""

  <%= config.bin %> <%= command.id %> --target-org my-org
