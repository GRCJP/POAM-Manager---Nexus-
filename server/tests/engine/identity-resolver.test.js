const { deriveIdentityKey, extractProductBranch, extractFixAction } = require('../../src/engine/identity-resolver');

describe('extractProductBranch', () => {
  test('extracts product and branch from Firefox ESR title', () => {
    const result = extractProductBranch('Mozilla Firefox ESR < 128.5.0 Multiple Vulnerabilities');
    expect(result).toEqual({ product: 'mozilla firefox esr', branch: 'esr' });
  });

  test('extracts product from Firefox mainline title', () => {
    const result = extractProductBranch('Mozilla Firefox < 134.0 Multiple Vulnerabilities');
    expect(result).toEqual({ product: 'mozilla firefox', branch: '' });
  });

  test('extracts product from Windows update title', () => {
    const result = extractProductBranch('Microsoft Windows Security Update for January 2026');
    expect(result).toEqual({ product: 'microsoft windows', branch: '' });
  });

  test('extracts product from OpenSSH title', () => {
    const result = extractProductBranch('OpenSSH < 9.6 Multiple Vulnerabilities');
    expect(result).toEqual({ product: 'openssh', branch: '' });
  });
});

describe('extractFixAction', () => {
  test('extracts normalized fix action from update solution', () => {
    const result = extractFixAction('Mozilla Firefox ESR is installed. Update to Firefox ESR 128.7.0 or later.');
    expect(result).toBe('update firefox esr');
  });

  test('extracts fix action from config solution', () => {
    const result = extractFixAction('Disable TLS 1.0 and TLS 1.1 protocols on the server.');
    expect(result).toBe('disable tls');
  });

  test('extracts fix action from KB solution', () => {
    const result = extractFixAction('Apply the January 2026 cumulative update KB5034441 from Microsoft Update Catalog.');
    expect(result).toBe('apply cumulative update kb5034441');
  });
});

describe('deriveIdentityKey', () => {
  test('same product different title versions produce same key', () => {
    const finding1 = {
      title: 'Mozilla Firefox ESR < 128.5.0 Multiple Vulnerabilities',
      solution: 'Update to Firefox ESR 128.7.0 or later.',
      qid: 'QID-001',
    };
    const finding2 = {
      title: 'Mozilla Firefox ESR < 128.6.0 Multiple Vulnerabilities',
      solution: 'Update to Firefox ESR 128.7.0 or later.',
      qid: 'QID-002',
    };
    expect(deriveIdentityKey(finding1)).toBe(deriveIdentityKey(finding2));
  });

  test('different products produce different keys', () => {
    const firefox = {
      title: 'Mozilla Firefox ESR < 128.5.0 Multiple Vulnerabilities',
      solution: 'Update to Firefox ESR 128.7.0 or later.',
      qid: 'QID-001',
    };
    const chrome = {
      title: 'Google Chrome < 120.0 Multiple Vulnerabilities',
      solution: 'Update to Google Chrome 120.0 or later.',
      qid: 'QID-003',
    };
    expect(deriveIdentityKey(firefox)).not.toBe(deriveIdentityKey(chrome));
  });

  test('Firefox ESR and Firefox mainline produce different keys', () => {
    const esr = {
      title: 'Mozilla Firefox ESR < 128.5.0 Multiple Vulnerabilities',
      solution: 'Update to Firefox ESR 128.7.0 or later.',
      qid: 'QID-001',
    };
    const mainline = {
      title: 'Mozilla Firefox < 134.0 Multiple Vulnerabilities',
      solution: 'Update to Firefox 134.0 or later.',
      qid: 'QID-004',
    };
    expect(deriveIdentityKey(esr)).not.toBe(deriveIdentityKey(mainline));
  });

  test('same solution text across different title versions produces same key', () => {
    const a = {
      title: 'Apache HTTP Server < 2.4.58 Multiple Vulnerabilities',
      solution: 'Update to Apache HTTP Server 2.4.59 or later.',
      qid: 'QID-010',
    };
    const b = {
      title: 'Apache HTTP Server < 2.4.59 Multiple Vulnerabilities',
      solution: 'Update to Apache HTTP Server 2.4.59 or later.',
      qid: 'QID-011',
    };
    expect(deriveIdentityKey(a)).toBe(deriveIdentityKey(b));
  });

  test('falls back to title + QID when solution is empty', () => {
    const finding = {
      title: 'Unknown Vulnerability',
      solution: '',
      qid: 'QID-999',
    };
    const key = deriveIdentityKey(finding);
    expect(key).toBeTruthy();
    expect(typeof key).toBe('string');
    expect(key.length).toBe(64); // SHA-256 hex
  });

  test('returns a 64-char hex string (SHA-256)', () => {
    const finding = {
      title: 'Mozilla Firefox ESR < 128.5.0 Multiple Vulnerabilities',
      solution: 'Update to Firefox ESR 128.7.0 or later.',
      qid: 'QID-001',
    };
    const key = deriveIdentityKey(finding);
    expect(key).toMatch(/^[a-f0-9]{64}$/);
  });
});
