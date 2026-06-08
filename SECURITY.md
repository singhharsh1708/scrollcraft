# Security Policy

## Reporting a vulnerability

We take the security of ScrollCraft seriously. If you discover a security vulnerability,
please report it **privately** — do not open a public issue.

- Use GitHub's [private vulnerability reporting](https://github.com/singhharsh1708/scrollcraft/security/advisories/new), or
- Email the maintainer directly.

Please include:

- A description of the vulnerability and its impact.
- Steps to reproduce (proof of concept if possible).
- Affected versions / commit, if known.

We'll acknowledge your report as quickly as we can, keep you updated on progress, and
credit you once a fix is released (unless you prefer to remain anonymous).

## Scope

In scope:

- Authentication / authorization bypass
- Payment / webhook signature verification flaws
- Injection (SQL, XSS in exported sites, etc.)
- Exposure of secrets or other users' data

Out of scope:

- Findings that require physical access to a user's device
- Missing security headers with no demonstrable impact
- Reports from automated scanners without a working proof of concept

## Supported versions

The latest `main` and the current production deployment receive security fixes.

Thank you for helping keep ScrollCraft and its users safe. 🔒
