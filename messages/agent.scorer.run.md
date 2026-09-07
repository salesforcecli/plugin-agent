# summary

Run an agent scorer against an STDM session and print its score.

# description

Runs a scorer that is already authored in your project metadata, referenced by its API name, against a single STDM (Session Trace Data Model) session, then prints the resulting score, outcome labels, and explanation.

The scorer is resolved from your project's package directories by API name. If no scorer with that API name exists locally, the command errors — author it first with `sf agent scorer create`.

Provide the session either inline as a JSON string with --data, or as a path to a local JSON file with --file. Exactly one of the two is required.

To help you hand-construct a valid session, run this command with --help: the full JSON Schema for the session object is printed under the --data flag.

# flags.api-name.summary

API name of the scorer to run. Must match a scorer authored in this project's metadata.

# flags.data.summary

Inline STDM session JSON to score.

# flags.data.description

Inline STDM session JSON to score. The value must be a JSON object matching the following JSON Schema (the shape of the scorer's Input:Session value):

# flags.file.summary

Path to a local JSON file containing the STDM session to score.

# examples

- Run a scorer against a session stored in a local file:

  <%= config.bin %> <%= command.id %> --api-name Sentiment_Scorer --file ./session.json

- Run a scorer against an inline session JSON string:

  <%= config.bin %> <%= command.id %> --api-name Sentiment_Scorer --data '{"sessionState":{"sessionId":"1","startTimestamp":"2026-01-01T00:00:00Z","channel":"web"},"actors":[],"metrics":{"durationMs":0,"turns":0},"runs":[]}'

- Show the session JSON Schema in the help output:

  <%= config.bin %> <%= command.id %> --help

# error.invalidSessionJson

Could not parse the STDM session as JSON: %s

# error.invalidSessionShape

The STDM session must be a JSON object matching the session schema (see --help). Received: %s
