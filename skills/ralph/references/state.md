# Ralph state

Use the harness's working directory, even when the task concerns a different path. Generate a fresh 32-character lowercase hexadecimal ID with a local random generator. Store the state at `.ralph/<id>.json`. Write the file with owner-only permissions and keep it out of commits. Use a default limit of 8 passes unless the user provides another positive limit.

```json
{
  "prompt": "Original task, constraints, and concrete acceptance checks",
  "iteration": 1,
  "limit": 8,
  "status": "active"
}
```

Follow the final report for each pass with a line in this format, substituting the actual ID, pass number, and result:

```text
[ralph:0123456789abcdef0123456789abcdef:1:retry]
```

The result is `retry`, `done`, or `blocked`. On retry the adapter increments the pass number and sends the original prompt again. Use its pass number for the next marker. If continuing manually, increment the pass number yourself before the next pass and record terminal status yourself.

A native adapter binds the run to the first session that submits a valid marker. For explicit resume in a different session, clear the state's `owner` field and set the status to `active`. Keep the original prompt and pass count. Ask for a new total limit if the existing limit is exhausted. A cancelled run requires explicit resume before it can continue.
