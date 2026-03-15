# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest (main) | Yes |
| Previous minor releases | Best-effort for 90 days |

## Reporting Vulnerabilities

If you discover a security vulnerability, please report it responsibly:

**Email:** security@prontiq.com

Please include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact assessment
- Suggested fix (if any)

**Do not** open a public GitHub issue for security vulnerabilities.

## Response Timeline

- **Acknowledgment:** within 2 business days
- **Initial assessment:** within 5 business days
- **Fix or mitigation:** depends on severity, typically within 30 days for critical issues

## Security Scope

The following are in scope for security reports:

- **CLI code execution** — any path where `ariscan` could be tricked into executing code from the scanned repository
- **Information disclosure** — leaking data from the scanning machine beyond scan output
- **Dependency vulnerabilities** — known CVEs in direct dependencies
- **Supply chain** — compromised build or publish pipeline

The following are out of scope:

- Vulnerabilities in scanned repositories (that is the user's responsibility)
- Denial of service via large repositories (expected behavior; use resource limits)

## Responsible Disclosure

We follow coordinated disclosure. We ask that you:

1. Report the vulnerability privately via the email above
2. Allow reasonable time for a fix before public disclosure
3. Do not access or modify other users' data during research

We will credit reporters in the changelog unless they prefer to remain anonymous.
