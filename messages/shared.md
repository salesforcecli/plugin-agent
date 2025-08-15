# flags.result-format.summary

Format of the agent test run results.

# flags.output-dir.summary

Directory to write the agent test results into.

# flags.output-dir.description

If the agent test run completes, write the results to the specified directory. If the test is still running, the test results aren't written.

# flags.verbose.summary

Show generated data in the test results output.

# flags.verbose.description

When enabled, includes detailed generated data (such as invoked actions) in the human-readable test results output. This is useful for debugging test failures and understanding what actions were actually invoked during the test run.

# error.invalidAgentType

agentType must be either "customer" or "internal". Found: [%s]

# error.invalidMaxTopics

maxNumOfTopics must be a number between 1-30. Found: [%s]

# error.invalidTone

tone must be one of ['formal', 'casual', 'neutral']. Found: [%s]

# error.invalidAgentUser

agentUser must be the username of an existing user in the org. Found: [%s]
