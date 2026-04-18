const crypto = require('crypto');

/**
 * Known branch identifiers that distinguish product lines.
 * "Firefox ESR" and "Firefox" are different products.
 */
const BRANCH_MARKERS = ['esr', 'lts', 'lsr', 'extended support'];

/**
 * Extract product name and branch from a vulnerability title.
 * Strips version numbers and descriptive suffixes.
 *
 * @param {string} title
 * @returns {{ product: string, branch: string }}
 */
function extractProductBranch(title) {
  const lower = title.toLowerCase();

  // Remove version patterns: < 128.5.0, < 9.6, etc.
  let cleaned = lower.replace(/<\s*[\d.]+/g, '');
  // Remove common suffixes
  cleaned = cleaned.replace(/multiple vulnerabilities/gi, '');
  cleaned = cleaned.replace(/security update.*$/gi, '');
  cleaned = cleaned.replace(/critical patch update.*$/gi, '');
  cleaned = cleaned.replace(/vulnerability$/gi, '');
  cleaned = cleaned.replace(/path traversal/gi, '');
  // Collapse whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  // Detect branch
  let branch = '';
  for (const marker of BRANCH_MARKERS) {
    if (cleaned.includes(marker)) {
      branch = marker;
      break;
    }
  }

  return { product: cleaned, branch };
}

/**
 * Extract the core fix action from a solution string.
 * Strips version numbers, installed-version prefixes, and advisory references.
 *
 * @param {string} solution
 * @returns {string} normalized fix action
 */
function extractFixAction(solution) {
  if (!solution) return '';
  const lower = solution.toLowerCase();

  // Find the actionable sentence (starts with a verb: update, upgrade, apply, disable, configure, install, remove)
  const actionVerbs = ['update', 'upgrade', 'apply', 'disable', 'configure', 'install', 'remove', 'patch', 'migrate'];
  let actionSentence = '';

  const sentences = lower.split(/\.\s+/);
  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    for (const verb of actionVerbs) {
      if (trimmed.startsWith(verb)) {
        actionSentence = trimmed;
        break;
      }
    }
    if (actionSentence) break;
  }

  if (!actionSentence) {
    // Fallback: use the whole solution
    actionSentence = lower;
  }

  // Strip version numbers (but keep KB identifiers like KB5034441)
  // First, protect KB identifiers by replacing them with placeholders
  const kbMatches = [];
  let normalized = actionSentence.replace(/kb\d+/gi, (match) => {
    kbMatches.push(match.toLowerCase());
    return `__KB${kbMatches.length - 1}__`;
  });

  // Strip version numbers: dotted versions (2.4.58) and standalone numbers (1.0, 2026)
  normalized = normalized.replace(/\d+\.\d+[\d.]*/g, '');
  normalized = normalized.replace(/\b\d{4}\b/g, ''); // strip years like 2026

  // Restore KB identifiers
  normalized = normalized.replace(/__KB(\d+)__/g, (_, idx) => kbMatches[parseInt(idx)]);

  // Remove trailing clauses: "or later", "from microsoft", "refer to", etc.
  normalized = normalized.replace(/\s+or\s+later.*$/g, '');
  normalized = normalized.replace(/\s+from\s+.*$/g, '');
  normalized = normalized.replace(/\s+refer\s+to\s+.*$/g, '');
  normalized = normalized.replace(/\s+per\s+.*$/g, '');
  normalized = normalized.replace(/\s+on\s+the\s+server.*$/g, '');
  normalized = normalized.replace(/\s+protocols.*$/g, '');

  // Remove filler words: to, the, a, an, and, for
  normalized = normalized.replace(/\b(to|the|a|an|and|for)\b/g, '');

  // Remove month names (temporal references)
  normalized = normalized.replace(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/g, '');

  // Remove duplicate consecutive words
  normalized = normalized.replace(/\b(\w+)\s+\1\b/g, '$1');

  // Collapse whitespace and trim
  normalized = normalized.replace(/\s+/g, ' ').trim();

  return normalized;
}

/**
 * Derive a Remediation Identity key for a normalized finding.
 * The key is a SHA-256 hash of: normalized_product + branch + fix_action.
 *
 * Same fix across different title versions = same key.
 * Different product lines (Firefox vs Firefox ESR) = different keys.
 *
 * @param {{ title: string, solution: string, qid: string }} finding
 * @returns {string} 64-char hex SHA-256 hash
 */
function deriveIdentityKey(finding) {
  const { product, branch } = extractProductBranch(finding.title);
  const fixAction = extractFixAction(finding.solution);

  let input;
  if (fixAction) {
    input = `${product}|${branch}|${fixAction}`;
  } else {
    // Fallback: product + QID when no solution is available
    input = `${product}|${branch}|${finding.qid}`;
  }

  return crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * Generate a human-readable display name for an identity.
 *
 * @param {{ title: string, solution: string }} finding
 * @returns {string}
 */
function generateDisplayName(finding) {
  const { product } = extractProductBranch(finding.title);
  // Title-case the product name
  const display = product.replace(/\b\w/g, c => c.toUpperCase());

  // Determine fix type from solution
  const solution = (finding.solution || '').toLowerCase();
  let fixType = 'Remediation';
  if (solution.includes('update') || solution.includes('upgrade') || solution.includes('patch')) {
    fixType = 'Patch Update';
  } else if (solution.includes('disable') || solution.includes('configure')) {
    fixType = 'Configuration Change';
  } else if (solution.includes('apply') && solution.includes('kb')) {
    fixType = 'KB Update';
  }

  return `${display} — ${fixType}`;
}

module.exports = { deriveIdentityKey, extractProductBranch, extractFixAction, generateDisplayName };
