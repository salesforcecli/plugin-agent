# summary

Get the status of a server-side HEPO optimization run.

# description

Returns the current status of a running or completed HEPO optimization, including iteration progress and score improvements.

# examples

- Get status of an optimization run:

  <%= config.bin %> <%= command.id %> --execution-id hepo:wf-abc123:run-xyz --target-org myOrg

# flags.execution-id.summary

Execution ID returned by `sf agent optimize start`.

# error.statusFailed

Failed to get optimization status: %s
