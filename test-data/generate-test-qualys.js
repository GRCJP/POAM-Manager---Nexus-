#!/usr/bin/env node
// Generate a test Qualys vulnerability scan CSV
const fs = require('fs');
const path = require('path');

const headers = [
  'IP', 'DNS', 'QID', 'Title', 'Vuln Status', 'Severity', 'Port',
  'First Detected', 'Last Detected', 'CVE ID', 'Category',
  'OS', 'Results', 'Solution', 'Ignored'
];

const findings = [
  // Active critical findings (old enough for SLA gate)
  ['10.0.1.10', 'web-prod-01', '38173', 'Apache HTTP Server Multiple Vulnerabilities', 'Active', '5', '443',
   '2025-06-01', '2026-04-15', 'CVE-2024-24795', 'Web Server',
   'Red Hat Enterprise Linux 8', 'Apache/2.4.37 detected', 'Upgrade Apache HTTP Server to 2.4.59+', ''],
  ['10.0.1.11', 'web-prod-02', '38173', 'Apache HTTP Server Multiple Vulnerabilities', 'Active', '5', '443',
   '2025-06-01', '2026-04-15', 'CVE-2024-24795', 'Web Server',
   'Red Hat Enterprise Linux 8', 'Apache/2.4.37 detected', 'Upgrade Apache HTTP Server to 2.4.59+', ''],

  // Active high findings
  ['10.0.2.20', 'db-prod-01', '91774', 'Windows Server 2019 Missing Security Update', 'Active', '4', '',
   '2025-09-15', '2026-04-15', 'CVE-2025-21234', 'Windows',
   'Windows Server 2019', 'KB5034127 not installed', 'Apply latest Windows security updates', ''],
  ['10.0.2.21', 'db-prod-02', '91774', 'Windows Server 2019 Missing Security Update', 'Active', '4', '',
   '2025-09-15', '2026-04-15', 'CVE-2025-21234', 'Windows',
   'Windows Server 2019', 'KB5034127 not installed', 'Apply latest Windows security updates', ''],
  ['10.0.2.22', 'db-staging-01', '91774', 'Windows Server 2019 Missing Security Update', 'Active', '4', '',
   '2025-09-15', '2026-04-15', 'CVE-2025-21234', 'Windows',
   'Windows Server 2019', 'KB5034127 not installed', 'Apply latest Windows security updates', ''],

  // Active medium findings
  ['10.0.3.30', 'app-server-01', '45142', 'SSL/TLS Certificate Expiring Soon', 'Active', '3', '443',
   '2026-01-10', '2026-04-15', '', 'Encryption',
   'Ubuntu 22.04', 'Certificate expires in 28 days', 'Renew SSL certificate before expiration', ''],
  ['10.0.3.31', 'app-server-02', '45142', 'SSL/TLS Certificate Expiring Soon', 'Active', '3', '443',
   '2026-01-10', '2026-04-15', '', 'Encryption',
   'Ubuntu 22.04', 'Certificate expires in 28 days', 'Renew SSL certificate before expiration', ''],

  // Active low findings
  ['10.0.1.10', 'web-prod-01', '12345', 'HTTP Server Banner Disclosure', 'Active', '2', '80',
   '2025-03-01', '2026-04-15', '', 'Information Gathering',
   'Red Hat Enterprise Linux 8', 'Server: Apache/2.4.37', 'Configure ServerTokens Prod', ''],

  // Risk Accepted (Ignored)
  ['10.0.4.40', 'legacy-app-01', '38830', 'TLS 1.0 Enabled', 'Active', '4', '443',
   '2025-01-15', '2026-04-15', 'CVE-2011-3389', 'Encryption',
   'Windows Server 2012 R2', 'TLS 1.0 enabled', 'Disable TLS 1.0', 'Yes'],
  ['10.0.4.41', 'legacy-app-02', '38830', 'TLS 1.0 Enabled', 'Active', '4', '443',
   '2025-01-15', '2026-04-15', 'CVE-2011-3389', 'Encryption',
   'Windows Server 2012 R2', 'TLS 1.0 enabled', 'Disable TLS 1.0', 'Yes'],

  // Fixed/closed findings (should be excluded by pipeline)
  ['10.0.5.50', 'mail-01', '67890', 'OpenSSL Vulnerability', 'Fixed', '5', '443',
   '2025-06-01', '2026-03-01', 'CVE-2022-3602', 'Encryption',
   'Ubuntu 20.04', 'OpenSSL 3.0.2 detected', 'Upgrade OpenSSL', ''],

  // Recent finding (should be excluded by SLA gate — only 5 days old)
  ['10.0.6.60', 'test-server', '99999', 'Very Recent Finding', 'Active', '3', '',
   '2026-04-14', '2026-04-15', '', 'Miscellaneous',
   'Ubuntu 22.04', 'Just detected', 'Investigate', ''],
];

const csv = [headers.join(',')];
for (const row of findings) {
  csv.push(row.map(v => `"${v}"`).join(','));
}

const outPath = path.join(__dirname, 'test-qualys-scan.csv');
fs.writeFileSync(outPath, csv.join('\n'));
console.log(`Test Qualys CSV generated: ${outPath}`);
console.log(`  ${findings.length} findings (${findings.filter(f => f[4] === 'Active' && f[14] !== 'Yes').length} active, ${findings.filter(f => f[14] === 'Yes').length} risk accepted, ${findings.filter(f => f[4] === 'Fixed').length} fixed)`);
