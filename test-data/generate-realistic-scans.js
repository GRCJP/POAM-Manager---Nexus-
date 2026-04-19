#!/usr/bin/env node
// Generate realistic Qualys scan CSV files for testing the full pipeline
// Creates 3 scans: baseline, follow-up (30 days later), third scan (60 days later)
const fs = require('fs');
const path = require('path');

const HEADERS = [
  'CVE', 'CVE-Description', 'CVSSv2 Base', 'CVSSv3.1 Base', 'QID', 'Title', 'Severity',
  'KB Severity', 'Type Detected', 'Last Detected', 'First Detected', 'Protocol', 'Port',
  'Status', 'Asset Id', 'Asset Name', 'Asset IPV4', 'Asset IPV6', 'Solution', 'Asset Tags',
  'Disabled', 'Ignored', 'QVS Score', 'Detection AGE', 'Published Date', 'Patch Released',
  'Category', 'CVSS Rating Labels', 'RTI', 'Operating System', 'Last Fixed', 'Last Reopened',
  'Times Detected', 'Threat', 'Vuln Patchable', 'Asset Critical Score', 'TruRisk Score',
  'Vulnerability Tags', 'Results', 'Deep Scan Result'
];

// Asset pool
const ASSETS = [
  { id: 'A001', name: 'web-prod-01', ip: '10.10.1.10', os: 'Red Hat Enterprise Linux 8' },
  { id: 'A002', name: 'web-prod-02', ip: '10.10.1.11', os: 'Red Hat Enterprise Linux 8' },
  { id: 'A003', name: 'web-staging', ip: '10.10.2.10', os: 'Red Hat Enterprise Linux 8' },
  { id: 'A004', name: 'db-prod-01', ip: '10.10.3.10', os: 'Windows Server 2019' },
  { id: 'A005', name: 'db-prod-02', ip: '10.10.3.11', os: 'Windows Server 2019' },
  { id: 'A006', name: 'db-staging', ip: '10.10.4.10', os: 'Windows Server 2019' },
  { id: 'A007', name: 'app-server-01', ip: '10.10.5.10', os: 'Ubuntu 22.04' },
  { id: 'A008', name: 'app-server-02', ip: '10.10.5.11', os: 'Ubuntu 22.04' },
  { id: 'A009', name: 'app-server-03', ip: '10.10.5.12', os: 'Ubuntu 22.04' },
  { id: 'A010', name: 'mail-server', ip: '10.10.6.10', os: 'Ubuntu 20.04' },
  { id: 'A011', name: 'dns-primary', ip: '10.10.7.10', os: 'Amazon Linux 2' },
  { id: 'A012', name: 'dns-secondary', ip: '10.10.7.11', os: 'Amazon Linux 2' },
  { id: 'A013', name: 'jump-host', ip: '10.10.8.10', os: 'Windows Server 2022' },
  { id: 'A014', name: 'monitoring-01', ip: '10.10.9.10', os: 'Ubuntu 22.04' },
  { id: 'A015', name: 'legacy-payroll', ip: '10.10.10.10', os: 'Windows Server 2012 R2' },
  { id: 'A016', name: 'legacy-hr', ip: '10.10.10.11', os: 'Windows Server 2012 R2' },
  { id: 'A017', name: 'file-server', ip: '10.10.11.10', os: 'Windows Server 2019' },
  { id: 'A018', name: 'print-server', ip: '10.10.11.11', os: 'Windows Server 2019' },
  { id: 'A019', name: 'vpn-gateway', ip: '10.10.12.10', os: 'Cisco IOS 15.x' },
  { id: 'A020', name: 'fw-external', ip: '10.10.12.11', os: 'Palo Alto PAN-OS 10' },
];

// Vulnerability definitions
const VULNS = [
  // Critical - old, affects many hosts
  { qid: 'QID-38173', cve: 'CVE-2024-24795', title: 'Apache HTTP Server Multiple Vulnerabilities', severity: 5, category: 'Web Server', solution: 'Upgrade Apache HTTP Server to 2.4.59+', desc: 'Apache HTTP Server versions prior to 2.4.59 contain multiple vulnerabilities including path traversal and SSRF.', firstDetected: '2025-06-01', assets: ['A001', 'A002', 'A003'], port: 443, patchable: true },
  // Critical - OpenSSL
  { qid: 'QID-91234', cve: 'CVE-2024-5535', title: 'OpenSSL Buffer Overflow Vulnerability', severity: 5, category: 'Encryption', solution: 'Upgrade OpenSSL to 3.3.2+', desc: 'OpenSSL SSL_select_next_proto buffer overread vulnerability.', firstDetected: '2025-07-15', assets: ['A007', 'A008', 'A009', 'A010', 'A014'], port: 443, patchable: true },
  // High - Windows patches
  { qid: 'QID-91774', cve: 'CVE-2025-21234', title: 'Windows Server Missing Critical Security Update', severity: 4, category: 'Windows', solution: 'Apply latest Windows security updates via WSUS', desc: 'Multiple Windows Server instances missing KB5034127 cumulative update.', firstDetected: '2025-09-15', assets: ['A004', 'A005', 'A006', 'A013', 'A017', 'A018'], port: 0, patchable: true },
  // High - SSH vuln
  { qid: 'QID-66101', cve: 'CVE-2023-48795', title: 'OpenSSH Terrapin Attack (CVE-2023-48795)', severity: 4, category: 'Remote Access', solution: 'Upgrade OpenSSH to 9.6+', desc: 'SSH transport protocol prefix truncation attack allowing MITM.', firstDetected: '2025-04-01', assets: ['A001', 'A002', 'A003', 'A007', 'A008', 'A009', 'A010', 'A011', 'A012', 'A014'], port: 22, patchable: true },
  // Medium - SSL cert
  { qid: 'QID-45142', cve: '', title: 'SSL/TLS Certificate Expiring Within 60 Days', severity: 3, category: 'Encryption', solution: 'Renew SSL/TLS certificate before expiration', desc: 'SSL certificate on this host expires within 60 days.', firstDetected: '2026-01-10', assets: ['A001', 'A002', 'A007', 'A008'], port: 443, patchable: false },
  // Medium - Python vuln
  { qid: 'QID-60629', cve: 'CVE-2026-0672', title: 'Python HTTP Cookie Injection Vulnerability', severity: 3, category: 'Programming Language', solution: 'Upgrade Python to 3.12.8+', desc: 'http.cookies.Morsel allows HTTP header injection via user-controlled values.', firstDetected: '2026-03-09', assets: ['A007', 'A008', 'A009', 'A011', 'A012'], port: 0, patchable: true },
  // Medium - libxml2
  { qid: 'QID-83568', cve: 'CVE-2026-1757', title: 'libxml2 Memory Leak in xmllint', severity: 3, category: 'Library', solution: 'Update libxml2 package', desc: 'Memory leak in xmllint interactive shell on whitespace-only input.', firstDetected: '2026-03-09', assets: ['A007', 'A008', 'A009', 'A011', 'A012', 'A014'], port: 0, patchable: true },
  // Low - banner disclosure
  { qid: 'QID-12345', cve: '', title: 'HTTP Server Banner Disclosure', severity: 2, category: 'Information Gathering', solution: 'Configure ServerTokens Prod to hide version info', desc: 'Web server reveals version information in HTTP response headers.', firstDetected: '2025-03-01', assets: ['A001', 'A002', 'A003'], port: 80, patchable: false },
  // Low - SNMP
  { qid: 'QID-15678', cve: '', title: 'SNMP Public Community String Detected', severity: 2, category: 'Network', solution: 'Change SNMP community strings to non-default values', desc: 'Default SNMP community string "public" allows information disclosure.', firstDetected: '2025-05-01', assets: ['A019', 'A020'], port: 161, patchable: false },
  // Risk Accepted - TLS 1.0 on legacy
  { qid: 'QID-38830', cve: 'CVE-2011-3389', title: 'TLS 1.0 Enabled on Legacy Application', severity: 4, category: 'Encryption', solution: 'Disable TLS 1.0 and migrate to TLS 1.2+', desc: 'Legacy application requires TLS 1.0 for client compatibility.', firstDetected: '2025-01-15', assets: ['A015', 'A016'], port: 443, patchable: false, ignored: true },
  // Risk Accepted - EOL OS
  { qid: 'QID-45678', cve: '', title: 'End-of-Life Operating System Detected', severity: 4, category: 'Windows', solution: 'Migrate to supported OS version', desc: 'Windows Server 2012 R2 reached end-of-life October 2023.', firstDetected: '2024-11-01', assets: ['A015', 'A016'], port: 0, patchable: false, ignored: true },
  // Will be fixed between scan 1 and 2
  { qid: 'QID-77777', cve: 'CVE-2025-99999', title: 'Nginx Information Disclosure', severity: 3, category: 'Web Server', solution: 'Upgrade Nginx to 1.26+', desc: 'Nginx reveals internal configuration details via error pages.', firstDetected: '2025-08-01', assets: ['A007', 'A008'], port: 80, patchable: true },
  // Will appear only in scan 2 (new finding)
  { qid: 'QID-88888', cve: 'CVE-2026-11111', title: 'Docker Container Escape Vulnerability', severity: 5, category: 'Containers', solution: 'Update Docker Engine to 26.1+', desc: 'Container escape via runc allowing host OS access.', firstDetected: '2026-04-20', assets: ['A007', 'A008', 'A009'], port: 0, patchable: true, scanOnly: [2, 3] },
  // Will appear only in scan 3 (new finding)
  { qid: 'QID-99999', cve: 'CVE-2026-22222', title: 'Log4j 2.x Remote Code Execution', severity: 5, category: 'Library', solution: 'Upgrade Log4j to 2.24+', desc: 'New Log4j vulnerability allowing remote code execution via crafted log messages.', firstDetected: '2026-05-15', assets: ['A004', 'A005', 'A007', 'A008', 'A009'], port: 0, patchable: true, scanOnly: [3] },
];

function formatDate(dateStr) {
  const d = new Date(dateStr);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[d.getMonth()]} ${String(d.getDate()).padStart(2,'0')}, ${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')} PM`;
}

function escCsv(val) {
  const s = String(val || '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function generateScan(scanNumber, scanDate) {
  const rows = [
    // 3 metadata lines like real Qualys exports
    'ORGDATA-1258,ORGDATA-7350,ORGDATA-6271',
    'ORGDATA-5230,ORGDATA-7240,ORGDATA-7589',
    'ORGDATA-7245,ORGDATA-3069,ORGDATA-5967',
    HEADERS.join(','),
  ];

  for (const vuln of VULNS) {
    // Skip vulns not in this scan
    if (vuln.scanOnly && !vuln.scanOnly.includes(scanNumber)) continue;
    // Vuln QID-77777 fixed after scan 1
    if (vuln.qid === 'QID-77777' && scanNumber > 1) continue;

    // Partial remediation: Apache vuln loses 1 asset after scan 1
    let assets = vuln.assets;
    if (vuln.qid === 'QID-38173' && scanNumber >= 2) {
      assets = assets.filter(a => a !== 'A003'); // staging fixed
    }
    // SSH vuln: 3 assets remediated between scan 2 and 3
    if (vuln.qid === 'QID-66101' && scanNumber >= 3) {
      assets = assets.filter(a => !['A011', 'A012', 'A014'].includes(a));
    }
    // Windows patches: 2 assets patched between scan 1 and 2
    if (vuln.qid === 'QID-91774' && scanNumber >= 2) {
      assets = assets.filter(a => !['A017', 'A018'].includes(a));
    }

    for (const assetId of assets) {
      const asset = ASSETS.find(a => a.id === assetId);
      if (!asset) continue;

      const ageInDays = Math.floor((new Date(scanDate) - new Date(vuln.firstDetected)) / 86400000);
      const row = [
        vuln.cve,                                          // CVE
        escCsv(vuln.desc),                                 // CVE-Description
        '0.0',                                             // CVSSv2
        vuln.severity >= 4 ? '7.5' : vuln.severity >= 3 ? '5.3' : '3.1', // CVSSv3.1
        vuln.qid,                                          // QID
        vuln.title,                                        // Title
        String(vuln.severity),                             // Severity
        String(vuln.severity),                             // KB Severity
        'Confirmed',                                       // Type Detected
        formatDate(scanDate),                              // Last Detected
        formatDate(vuln.firstDetected),                    // First Detected
        vuln.port > 0 ? 'TCP' : "'-",                     // Protocol
        String(vuln.port),                                 // Port
        'ACTIVE',                                          // Status
        asset.id,                                          // Asset Id
        asset.name,                                        // Asset Name
        asset.ip,                                          // Asset IPV4
        "'-",                                              // Asset IPV6
        escCsv(vuln.solution),                             // Solution
        escCsv('All Assets,CDM: FISMA Boundaries,BU: ORG'), // Asset Tags
        'No',                                              // Disabled
        vuln.ignored ? 'Yes' : 'No',                       // Ignored
        String(vuln.severity >= 4 ? 80 : vuln.severity >= 3 ? 50 : 25), // QVS Score
        String(ageInDays),                                 // Detection AGE
        formatDate(vuln.firstDetected),                    // Published Date
        vuln.patchable ? formatDate(vuln.firstDetected) : "'-", // Patch Released
        vuln.category,                                     // Category
        vuln.severity >= 4 ? 'HIGH' : vuln.severity >= 3 ? 'MEDIUM' : 'LOW', // CVSS Labels
        vuln.severity >= 4 ? 'Active Attacks' : 'None',   // RTI
        asset.os,                                          // Operating System
        "'-",                                              // Last Fixed
        "'-",                                              // Last Reopened
        String(Math.max(1, Math.floor(ageInDays / 7))),    // Times Detected
        escCsv('Successful exploitation could compromise system security.'), // Threat
        vuln.patchable ? 'Yes' : 'No',                    // Vuln Patchable
        '5',                                               // Asset Critical Score
        String(vuln.severity >= 4 ? 500 : vuln.severity >= 3 ? 200 : 50), // TruRisk
        '',                                                // Vulnerability Tags
        'EVID-' + Math.random().toString(16).substring(2, 10).toUpperCase(), // Results
        "'-",                                              // Deep Scan Result
      ];
      rows.push(row.join(','));
    }
  }

  return rows.join('\n');
}

// Scan 1: Baseline (March 16, 2026)
const scan1 = generateScan(1, '2026-03-16');
fs.writeFileSync(path.join(__dirname, 'scan-baseline-20260316.csv'), scan1);

// Scan 2: 30 days later (April 15, 2026) — some fixed, some new
const scan2 = generateScan(2, '2026-04-15');
fs.writeFileSync(path.join(__dirname, 'scan-followup-20260415.csv'), scan2);

// Scan 3: 60 days later (May 15, 2026) — more progress, new critical
const scan3 = generateScan(3, '2026-05-15');
fs.writeFileSync(path.join(__dirname, 'scan-third-20260515.csv'), scan3);

// Count findings per scan
for (const [name, data] of [['Baseline', scan1], ['Follow-up', scan2], ['Third', scan3]]) {
  const lines = data.split('\n').length - 4; // minus metadata + header
  console.log(`${name}: ${lines} finding rows`);
}
console.log('\nExpected pipeline behavior:');
console.log('  Scan 1 → Baseline import: creates POAMs for old-enough findings');
console.log('  Scan 2 → Re-import: QID-77777 gone (auto-close), QID-88888 new, Apache partial remediation');
console.log('  Scan 3 → Re-import: QID-99999 new critical, SSH partial remediation, QID-88888 still present');
