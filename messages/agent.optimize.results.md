# summary

Get the final results of a completed HEPO optimization run.

# description

Returns detailed results of a completed optimization, including iteration history, score improvements, and the best agent snapshot.

# examples

- Get results of a completed optimization:

  <%= config.bin %> <%= command.id %> --execution-id hepo:wf-abc123:run-xyz --target-org myOrg

# flags.execution-id.summary

Execution ID returned by `sf agent optimize start`.

# error.resultsFailed

Failed to get optimization results: %s

# error.stillRunning

Optimization %s is still running. Use `sf agent optimize status` to check progress.
