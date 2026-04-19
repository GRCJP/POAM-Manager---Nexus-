#!/usr/bin/env node
// Generate a test POAM workbook (.xlsx) with realistic data
// Run: node test-data/generate-test-poam.js

const XLSX = require('xlsx');

const headers = [
  'Finding Identifier',
  'Weakness Source Identifier',
  'Control Family',
  'Vulnerability Name',
  'Finding Description',
  'Affected Host(s)\n(For Technical Findings Only)',
  'Finding Source',
  'POC',
  'Resources Required',
  'Initial Scheduled Completion Date',
  'Milestones with Completion Dates',
  'Changes to Milestones with Completion Dates',
  'Updated Scheduled Completion Date',
  'Actual Completion Date',
  'Finding Status',
  'Risk Level',
  'Mitigation',
  'Comments'
];

const rows = [
  // Open - Critical
  ['POAM-2024-001', 'CVE-2024-24795', 'CM', 'Apache HTTP Server 2.4.x Multiple Vulnerabilities',
   'Apache HTTP Server versions prior to 2.4.59 contain multiple vulnerabilities including path traversal and SSRF.',
   'web-prod-01, web-prod-02, web-staging-01', '2024 Annual Security Assessment', 'David Washington',
   'Personnel', new Date(2025, 5, 15), '1. Patch testing (05/01/2025)\n2. Staging deployment (05/15/2025)\n3. Production rollout (06/15/2025)',
   'N/A', 'N/A', '', 'Ongoing', 'Critical',
   'Upgrade Apache HTTP Server to version 2.4.59 or later. Apply vendor patches per patch management SOP.',
   'Patch approved by CAB. Waiting on maintenance window.'],

  // Open - High
  ['POAM-2024-002', 'QID-38830', 'AC', 'Weak Password Policy on Domain Controllers',
   'Domain password policy does not enforce minimum 14-character passwords or MFA for privileged accounts.',
   'N/A', '2024 DHS ATO Assessment', 'Maria Rodriguez', 'Personnel, Funding',
   new Date(2025, 3, 30), '1. Policy update draft (03/01/2025)\n2. AD GPO changes (03/15/2025)\n3. User notification (04/01/2025)\n4. Enforcement (04/30/2025)',
   '', new Date(2025, 6, 30), '', 'Ongoing', 'High',
   'Update AD Group Policy to enforce 14-char minimum. Implement MFA via Azure AD for all privileged accounts.',
   'Extended from original date due to MFA vendor procurement delays.'],

  // Open - Moderate
  ['POAM-2024-003', 'NIST-AU-11', 'AU', 'Insufficient Audit Log Retention',
   'System audit logs are retained for only 30 days. NIST 800-53 AU-11 requires minimum 1 year retention.',
   'N/A', 'Continuous Monitoring', 'Tom Chen', 'Funding',
   new Date(2025, 8, 30), '1. SIEM storage expansion (07/2025)\n2. Retention policy update (08/2025)\n3. Validation (09/2025)',
   'N/A', '', '', 'Ongoing', 'Moderate',
   'Expand SIEM storage to support 13-month log retention. Update log rotation policy.',
   ''],

  // Open - Low
  ['POAM-2024-004', '', 'PE', 'Badge Reader Firmware Out of Date',
   'Physical access badge readers in Building C are running firmware v2.1, current version is v3.4.',
   'Bldg-C badge readers (12 units)', 'Self-Assessment', 'Sarah Patel', 'Funding',
   new Date(2025, 11, 31), '1. Procure firmware licenses (10/2025)\n2. Schedule after-hours update (11/2025)\n3. Test and validate (12/2025)',
   '', '', '', 'Ongoing', 'Low',
   'Upgrade badge reader firmware to v3.4 per vendor advisory.',
   'Low risk — compensating control: security camera coverage.'],

  // Completed
  ['POAM-2024-005', 'CVE-2022-3602', 'SI', 'OpenSSL 3.0.x Heap Buffer Overflow (CVE-2022-3602)',
   'OpenSSL versions 3.0.0-3.0.6 are vulnerable to heap buffer overflow during X.509 certificate verification.',
   'app-server-01, app-server-02', '2024 Pen Test', 'David Washington', 'Personnel',
   new Date(2024, 11, 31), '1. Identify affected systems (10/2024)\n2. Test patches (11/2024)\n3. Deploy (12/2024)',
   'N/A', '', new Date(2024, 11, 15), 'Completed', 'Critical',
   'Upgraded OpenSSL to 3.0.8 on all affected systems.',
   'Verified via Qualys rescan on 12/20/2024. No remaining instances.'],

  // Completed
  ['POAM-2024-006', 'QID-43012', 'IA', 'Default Credentials on Network Switches',
   'Three network switches found with factory default SNMP community strings.',
   'sw-floor2-01, sw-floor3-01, sw-floor3-02', 'HVA Assessment', 'Tom Chen', 'Personnel',
   new Date(2024, 9, 31), '1. Inventory switches (09/2024)\n2. Change credentials (10/2024)',
   '', '', new Date(2024, 9, 28), 'Completed', 'High',
   'Changed all SNMP community strings to unique complex values. Disabled SNMPv1/v2.',
   'Completed ahead of schedule.'],

  // Risk Accepted
  ['POAM-2024-007', 'CVE-2011-3389', 'SC', 'TLS 1.0/1.1 Enabled on Legacy Application',
   'Legacy payroll application requires TLS 1.0 for client compatibility. Vendor EOL is 2026.',
   'payroll-legacy-01', 'Continuous Monitoring', 'Sarah Patel', 'Funding',
   new Date(2025, 5, 30), '1. Vendor engagement for upgrade path (Q1 2025)\n2. Migration planning (Q2 2025)',
   'Original milestone was Q4 2024. Extended pending vendor response.', new Date(2026, 5, 30), '', 'Risk Accepted', 'High',
   'Compensating controls: network segmentation, IDS monitoring, restricted access to legacy subnet.',
   'Risk accepted by AO on 01/15/2025. Review scheduled for 06/2026.'],

  // Risk Accepted
  ['POAM-2024-008', 'QID-91774', 'CM', 'Unsupported Operating System (Windows Server 2012 R2)',
   'Two servers running Windows Server 2012 R2 which reached end-of-life October 2023.',
   'legacy-db-01, legacy-db-02', 'Audit', 'Maria Rodriguez', 'Funding',
   new Date(2025, 2, 31), '1. Migration assessment (01/2025)\n2. New server provisioning (02/2025)\n3. Data migration (03/2025)',
   'Delayed from original 12/2024 date — budget not approved until Q1 2025.',
   new Date(2025, 8, 30), '', 'Risk Accepted', 'Critical',
   'ESU licenses purchased. Servers isolated to management VLAN with restricted firewall rules.',
   'Risk accepted with compensating controls. Migration funded in FY2025 Q3.'],

  // Delayed
  ['POAM-2024-009', '', 'RA', 'Annual Risk Assessment Not Completed',
   'Organization has not completed the required annual risk assessment per NIST 800-53 RA-3.',
   'N/A', '2024 DHS ATO Assessment', 'James Lee', 'Personnel, Funding',
   new Date(2025, 2, 31), '1. Contract assessor (01/2025)\n2. Conduct assessment (02/2025)\n3. Document findings (03/2025)',
   'Delayed from 12/2024 — procurement delays for assessment contractor.',
   new Date(2025, 5, 30), '', 'Delayed', 'High',
   'Engage third-party assessor to conduct comprehensive risk assessment aligned to NIST SP 800-30.',
   'Procurement in progress. Expected contract award 04/2025.'],

  // Open - Critical, multiple hosts
  ['POAM-2024-010', 'NIST-SI-3', 'SI', 'Missing Endpoint Detection and Response (EDR)',
   'Production servers lack EDR/XDR agent deployment. 15 of 42 servers have no endpoint protection.',
   'Multiple — see asset list', 'Continuous Monitoring', 'David Washington', 'Funding',
   new Date(2025, 6, 31), '1. EDR license procurement (04/2025)\n2. Pilot deployment (05/2025)\n3. Full rollout (06/2025)\n4. Validation (07/2025)',
   '', '', '', 'Ongoing', 'Critical',
   'Deploy CrowdStrike Falcon agent to all production servers. Update baseline configuration.',
   'Budget approved. Licenses ordered.'],
];

// Build worksheet — first sheet is a cover page, second is the POAM data
const coverData = [
  ['Plan of Action & Milestones (POA&M)'],
  [''],
  ['System Name:', 'TRACE Production Environment'],
  ['System ID:', 'SYS-TRACE-PROD-001'],
  ['ISSO:', 'Maria Rodriguez'],
  ['ISSM:', 'James Lee'],
  ['AO:', 'Kevin Nguyen'],
  ['Date:', new Date().toLocaleDateString()],
  [''],
  ['This document contains the POA&M items for the TRACE production system.'],
];

const poamData = [headers, ...rows];

const wbOut = XLSX.utils.book_new();
const wsCover = XLSX.utils.aoa_to_sheet(coverData);
const wsPoam = XLSX.utils.aoa_to_sheet(poamData);

// Set column widths for readability
wsPoam['!cols'] = headers.map((h, i) => ({ wch: i === 3 || i === 9 || i === 15 ? 40 : 20 }));

XLSX.utils.book_append_sheet(wbOut, wsCover, 'Cover');
XLSX.utils.book_append_sheet(wbOut, wsPoam, 'POA&M');

const outPath = __dirname + '/test-poam-workbook.xlsx';
XLSX.writeFile(wbOut, outPath);
console.log(`Test POAM workbook generated: ${outPath}`);
console.log(`  Sheets: Cover (info), POA&M (${rows.length} items)`);
console.log(`  Statuses: 4 Ongoing, 2 Completed, 2 Risk Accepted, 1 Delayed, 1 Open Critical`);
console.log(`  POCs: David Washington, Maria Rodriguez, Tom Chen, Sarah Patel, James Lee`);
