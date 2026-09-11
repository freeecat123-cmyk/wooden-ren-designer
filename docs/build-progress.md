# Device Build Progress

- BuildSteps retains generated instructions, tools and safety warnings. A client
  wrapper adds completion checkboxes and focus/scroll to the next unfinished step.
- Browser storage key: `wooden-ren:build:v1:<user-or-guest>:<category>:<designId-or-new>`.
  This is device-only progress, not a cloud save or proof that a part is safe.
- Unsaved designs share one slot per category/account. Save As uses a new design
  ID and starts separate progress. No implicit copying to another saved design.
- A serialized generated design is the comparison fingerprint. Differences block
  completion edits until the user chooses to retain matching step IDs or restart.
  Changes to geometry, joinery or material do not silently inherit completion.
- Storage writes occur only on explicit completion/confirmation actions. Failed
  writes retain session state and visibly warn that it may be lost on close.
- Storage events synchronize open tabs; a custom event synchronizes multiple
  instances within the same page. Account/design changes reset the component.
- Printed construction instructions remain independent of device progress.

## Verification

- Browser component tests cover reopening, next-step focus, design/account
  isolation, changed-design confirmation, reset and failed storage writes.
- Actual localhost cert-c1 page checked at 390x844 and 1440x1000: completion
  survives reload, next-step focus works, no document horizontal overflow.
- No template geometry or generated construction instructions changed.
