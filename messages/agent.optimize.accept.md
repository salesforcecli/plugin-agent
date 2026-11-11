# summary

Accept and publish the results of a completed HEPO optimization.

# description

Sends a publish signal to the optimization workflow, deploying the best-performing agent configuration as a draft.

# examples

- Accept and publish an optimization result:

  <%= config.bin %> <%= command.id %> --execution-id hepo:wf-abc123:run-xyz --target-org myOrg

# flags.execution-id.summary

Execution ID returned by `sf agent optimize start`.

# error.acceptFailed

Failed to accept optimization: %s
