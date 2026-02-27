# Security Policy

## Supported Versions

Only the latest deployed version of Arkora receives security updates.

| Version | Supported |
| ------- | --------- |
| Latest  | Yes       |
| Older   | No        |

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

If you discover a security vulnerability in Arkora, please report it responsibly through one of these channels:

- **GitHub Private Vulnerability Reporting**: [Security Advisories](../../security/advisories/new) — preferred method
- **Email**: arkhet@arkora.info — for sensitive disclosures

### What to Include

Please provide as much of the following as possible:

- Description of the vulnerability and its potential impact
- Steps to reproduce (proof-of-concept if applicable)
- Affected components or endpoints
- Any suggested mitigations you have identified

### What to Expect

| Timeline | Action |
| -------- | ------ |
| 48 hours | Acknowledgment of your report |
| 7 days | Initial assessment and severity triage |
| 14 days | Patch for critical/high severity issues |
| 30 days | Patch for medium/low severity issues |
| 90 days | Public disclosure (coordinated with reporter) |

We will keep you informed throughout the process and credit you in the fix unless you prefer to remain anonymous.

## Scope

### In Scope

- Authentication and session management (SIWE, World ID verification)
- API route authorization and access control
- Input validation and sanitization
- Data exposure or privacy leaks
- Cryptographic weaknesses
- Rate limiting bypass
- Denial-of-service vulnerabilities in application logic

### Out of Scope

- Vulnerabilities in third-party services (Neon, Pusher, Vercel, World ID)
- Social engineering attacks against team members
- Physical security
- Denial-of-service via infrastructure (volumetric attacks)
- Issues requiring physical access to a device
- Findings from automated scanners without manual validation

## Safe Harbor

Arkora considers good-faith security research to be authorized and will not pursue legal action against researchers who:

- Report vulnerabilities through the channels described above
- Do not access, modify, or delete user data beyond what is minimally necessary to demonstrate the vulnerability
- Do not perform denial-of-service attacks, social engineering, or spam
- Do not publicly disclose the vulnerability before a fix is deployed

## Acknowledgments

We thank the following researchers for responsibly disclosing vulnerabilities:

*No disclosures to date.*
