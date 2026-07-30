// local, best-effort scan for secrets a user might paste into a composer before
// sending. pattern-only, runs entirely on-device, never blocks — just warns.
// this is a safety net, not an org policy engine; false positives are expected.

export interface SecretFinding {
  label: string; // human name of what matched
  sample: string; // short, redacted preview
}

interface Rule {
  label: string;
  re: RegExp;
}

const RULES: Rule[] = [
  { label: 'private key block', re: /-----BEGIN (?:RSA |EC |OPENSSH |PGP |DSA )?PRIVATE KEY-----/ },
  { label: 'AWS access key id', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { label: 'OpenAI-style key', re: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/ },
  { label: 'GitHub token', re: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/ },
  { label: 'Google API key', re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { label: 'Slack token', re: /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/ },
  { label: 'Stripe key', re: /\b[rs]k_(?:live|test)_[0-9A-Za-z]{16,}\b/ },
  { label: 'JWT', re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/ },
  {
    label: 'secret assignment',
    re: /\b(?:api[_-]?key|secret|token|passwd|password|access[_-]?key)\b\s*[:=]\s*['"]?[A-Za-z0-9/_+.=-]{12,}['"]?/i,
  },
  {
    label: '.env secret line',
    re: /^[A-Z][A-Z0-9_]*(?:KEY|SECRET|TOKEN|PASSWORD|PASSWD)\s*=\s*\S{6,}/m,
  },
];

function redact(match: string): string {
  const trimmed = match.replace(/\s+/g, ' ').trim();
  if (trimmed.length <= 14) return `${trimmed.slice(0, 4)}…`;
  return `${trimmed.slice(0, 8)}…${trimmed.slice(-3)}`;
}

// returns one finding per matched rule (deduped by label), or [] when clean
export function scanForSecrets(text: string): SecretFinding[] {
  if (!text || text.length < 8) return [];
  const findings: SecretFinding[] = [];
  const seen = new Set<string>();
  for (const rule of RULES) {
    const m = text.match(rule.re);
    if (m && !seen.has(rule.label)) {
      seen.add(rule.label);
      findings.push({ label: rule.label, sample: redact(m[0]) });
    }
  }
  return findings;
}

// stable signature so the UI can tell "same warning, already dismissed" from a new one
export function findingsSignature(findings: SecretFinding[]): string {
  return findings.map((f) => f.label).sort().join('|');
}
