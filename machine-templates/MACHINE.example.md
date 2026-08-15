# Machine Workspace Notes

Optional local registry for the computer and workspace containing this file.
It is inert: Codex and Claude do not load it automatically. The
`machine-bootstrap` repository reads it deliberately only for administration,
discovery, port allocation, or sibling-project routing.

Keep project architecture and agent policy in each project. Do not put
credentials, tokens, private documents, secret filenames, or provider responses
here, and do not copy this file blindly to another machine.

## Workspace Root

- Absolute path: TODO
- Operating system: TODO
- Shell: TODO
- Primary agent harnesses: TODO

## Project Map

| Folder | Purpose | Git repository | Guidance |
| --- | --- | --- | --- |
| TODO | TODO | TODO | TODO |

## Routing And Cross-Project Links

- TODO: local-only, retired, or canonical project folders.
- TODO: content or generated artifacts mirrored between siblings.
- TODO: folders agents must not edit.

## Port Registry

Use fixed, non-overlapping ranges. A bound canonical port means to connect to
the recognized running service; do not silently choose another port.

| Range | Project | Canonical ports |
| --- | --- | --- |
| TODO | TODO | TODO |

- Next free range: TODO
- Non-web service ports: TODO

## Local Tooling

- Browser preference and QA limitations: TODO
- Launch configuration locations: TODO
- Provider-specific local tools: TODO

## Git And Sensitive Files

- Repository roots: TODO
- Intentionally non-Git folders: TODO
- Locally ignored continuity or guidance files: TODO
- Sensitive root-level material: record only handling rules, never filenames or
  contents.

## Local Lifecycle Notes

- TODO: stale processes, retired folders, pending archive decisions, or other
  machine-only operational facts.
