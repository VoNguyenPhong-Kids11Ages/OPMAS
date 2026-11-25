# Security

Report vulnerabilities privately (GitHub Security Advisories on this repository) instead of opening a public issue.

Notes for contributors: build DOM with `textContent` (never `innerHTML` with remote data); the API server only fetches ids parsed from known game URLs; the userscript requests no `@grant` privileges.
