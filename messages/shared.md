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

The generated data is in JSON format and includes the Apex classes or Flows that were invoked, the Salesforce objects that were touched, and so on. Use the JSON structure of this information to build the test case JSONPath expression when using custom evaluations.

# flags.test-runner.summary

Explicitly specify which test runner to use (agentforce-studio or testing-center).

# flags.test-runner.description

By default, the command automatically detects which test runner to use based on the test definition metadata type in your org. Use this flag to explicitly specify the runner type. 'agentforce-studio' uses AiTestingDefinition metadata. 'testing-center' uses AiEvaluationDefinition metadata.

# flags.context-variables.summary

Session variables for the agent preview session, in the form Name=Value.

# flags.context-variables.description

Sets variables on the agent preview session, mirroring what the in-org Agentforce Builder UI does when you override variables before sending a message. Specify this flag multiple times or use comma-separated values. Two namespaces are supported, distinguished by the name shape. Names pass through to the runtime verbatim — the CLI doesn't transform them.

Linked context variables use the "$Context." prefix. These map to externally-provided fields that the runtime resolves (declared in the bundle's globalConfiguration.contextVariables) and are read by live actions and topic-routing expressions via $Context.Name. Example: $Context.MyLinkedVar=some-value.

State variables use the bare developerName, no prefix. These seed mutable agent state declared in agentVersion.stateVariables. Example: MyStateVar=some-value.

Both namespaces can be mixed in one value. Example: --context-variables '$Context.MyLinkedVar=foo,MyStateVar=bar'.

Tips: (1) Quote the whole value in single quotes so $Context isn't shell-expanded. (2) Names are sent verbatim — a bare name is treated as a state variable, not a linked context variable, so live actions that bind via $Context.Name will see null. (3) Type is always Text; to send a typed variable, use --context-variables-json.

# flags.context-variables-json.summary

Typed session variables for the agent preview session, as a JSON array.

# flags.context-variables-json.description

Sets typed variables on the agent preview session. Use this instead of --context-variables when a variable is not Text, for example a boolean-gated route (available when @variables.myFlag == True) that needs a real Boolean, or a Number, Object, List, or Json value.

The value is a JSON array of objects, each with a "name", a "type", and an optional "value". The "type" is one of Text, Date, DateTime, Money, Ref, Boolean, Number, Object, List, or Json. The JSON type of "value" must match "type": Boolean takes a boolean, Number takes a number, the string types take a string, Object and List take an array, and Json takes an object.

Example: --context-variables-json '[{"name":"probeGate","type":"Boolean","value":true},{"name":"retryCount","type":"Number","value":3}]'.

You can pass both --context-variables and --context-variables-json in the same command. When the same variable name appears in both, the --context-variables-json value wins.

Tip: names follow the same rules as --context-variables. Use the "$Context." prefix for linked context variables, and a bare name for state variables.

# error.invalidAgentType

agentType must be either "customer" or "internal". Found: [%s]

# error.invalidMaxTopics

maxNumOfTopics must be a number between 1-30. Found: [%s]

# error.invalidTone

tone must be one of ['formal', 'casual', 'neutral']. Found: [%s]

# error.invalidAgentUser

agentUser must be the username of an existing user in the org. Found: [%s]
