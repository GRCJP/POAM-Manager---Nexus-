const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const HEADER = 'CVE,CVE-Description,CVSSv2 Base (nvd),CVSSv3.1 Base (nvd),QID,Title,Severity,KB Severity,Type Detected,Last Detected,First Detected,Protocol,Port,Status,Asset Id,Asset Name,Asset IPV4,Asset IPV6,Solution,Asset Tags,Disabled,Ignored,QVS Score,Detection AGE,Published Date,Patch Released,Category,CVSS Rating Labels,RTI,Operating System,Last Fixed,Last Reopened,Times Detected,Threat,Vuln Patchable,Asset Critical Score,TruRisk Score,Vulnerability Tags,Results,';

const ORGDATA_ROWS = [
  Array(39).fill(0).map(() => `ORGDATA-${Math.floor(Math.random()*9000+1000)}`).join(','),
  Array(39).fill(0).map(() => `ORGDATA-${Math.floor(Math.random()*9000+1000)}`).join(','),
  Array(39).fill(0).map(() => `ORGDATA-${Math.floor(Math.random()*9000+1000)}`).join(','),
];

// Product catalog: each entry defines a product line with realistic titles and solutions
const PRODUCTS = [
  {
    product: 'Mozilla Firefox ESR',
    titles: [
      'Mozilla Firefox ESR < 128.5.0 Multiple Vulnerabilities',
      'Mozilla Firefox ESR < 128.6.0 Multiple Vulnerabilities',
      'Mozilla Firefox ESR < 128.7.0 Multiple Vulnerabilities',
    ],
    // All titles share the same solution = same Remediation Identity
    solution: 'Mozilla Firefox ESR is installed. Update to Firefox ESR 128.7.0 or later. Refer to Mozilla Foundation Security Advisory.',
    cves: ['CVE-2024-11691','CVE-2024-11692','CVE-2024-11694'],
    severity: 4,
    category: 'Web Browser',
    rti: 'Public Exploit',
    os: 'Microsoft Windows 10',
    trurisk: 72,
  },
  {
    product: 'Mozilla Firefox',
    titles: ['Mozilla Firefox < 134.0 Multiple Vulnerabilities'],
    solution: 'Mozilla Firefox is installed. Update to Firefox 134.0 or later. Refer to Mozilla Foundation Security Advisory.',
    cves: ['CVE-2024-11700','CVE-2024-11701'],
    severity: 4,
    category: 'Web Browser',
    rti: 'Easy Exploit',
    os: 'Microsoft Windows 10',
    trurisk: 68,
  },
  {
    product: 'OpenSSH',
    titles: ['OpenSSH < 9.6 Multiple Vulnerabilities'],
    solution: 'OpenSSH 8.4p1 is installed. Upgrade to OpenSSH 9.6p1 or later.',
    cves: ['CVE-2023-51385','CVE-2023-48795'],
    severity: 5,
    category: 'General remote services',
    rti: 'Known Exploit,Actively Exploited',
    os: 'Red Hat Enterprise Linux 8.x',
    trurisk: 95,
  },
  {
    product: 'Apache HTTP Server',
    titles: [
      'Apache HTTP Server < 2.4.58 Multiple Vulnerabilities',
      'Apache HTTP Server < 2.4.59 Multiple Vulnerabilities',
    ],
    solution: 'Apache HTTP Server is installed. Update to Apache HTTP Server 2.4.59 or later. Refer to Apache Security Advisory.',
    cves: ['CVE-2023-45802','CVE-2023-43622'],
    severity: 4,
    category: 'Web server',
    rti: 'Public Exploit',
    os: 'Amazon Linux 2',
    trurisk: 78,
  },
  {
    product: 'Microsoft Windows Cumulative Update',
    titles: ['Microsoft Windows Security Update for January 2026'],
    solution: 'Apply the January 2026 cumulative update KB5034441 from Microsoft Update Catalog.',
    cves: ['CVE-2026-21311','CVE-2026-21312'],
    severity: 5,
    category: 'Windows',
    rti: 'Known Exploit,Easy Exploit,Public Exploit',
    os: 'Microsoft Windows Server 2019',
    trurisk: 98,
  },
  {
    product: 'Oracle Java SE',
    titles: ['Oracle Java SE Critical Patch Update - January 2026'],
    solution: 'Oracle Java SE 8 Update 401 is installed. Update to Oracle Java SE 8 Update 411 or later per Oracle Critical Patch Update Advisory.',
    cves: ['CVE-2026-21400','CVE-2026-21401'],
    severity: 4,
    category: 'Java',
    rti: 'Easy Exploit',
    os: 'Red Hat Enterprise Linux 7.x',
    trurisk: 65,
  },
  {
    product: 'OpenSSL',
    titles: ['OpenSSL < 3.0.13 Vulnerability'],
    solution: 'OpenSSL 3.0.10 is installed. Upgrade to OpenSSL 3.0.13 or later.',
    cves: ['CVE-2024-0727'],
    severity: 3,
    category: 'General remote services',
    rti: '',
    os: 'Amazon Linux 2',
    trurisk: 42,
  },
  {
    product: 'Spring Framework',
    titles: ['Spring Framework Path Traversal Vulnerability'],
    solution: 'Vendor has released patch addressing the vulnerability. For more information, please refer to the Spring Core Security Advisory(https://spring.io/security/cve-2024-38819)',
    cves: ['CVE-2024-38819'],
    severity: 4,
    category: 'Web Application',
    rti: 'Easy Exploit,High Data Loss,Public Exploit',
    os: 'Amazon Linux 2',
    trurisk: 75,
  },
  {
    product: 'PostgreSQL',
    titles: ['PostgreSQL < 16.2 Multiple Vulnerabilities'],
    solution: 'PostgreSQL 15.4 is installed. Upgrade to PostgreSQL 16.2 or later.',
    cves: ['CVE-2024-0985'],
    severity: 3,
    category: 'Database',
    rti: '',
    os: 'Red Hat Enterprise Linux 8.x',
    trurisk: 38,
  },
  {
    product: 'TLS Configuration',
    titles: ['SSL/TLS Server Supports TLS 1.0 and 1.1'],
    solution: 'Disable TLS 1.0 and TLS 1.1 protocols on the server. Configure the server to use TLS 1.2 or TLS 1.3 only.',
    cves: [],
    severity: 3,
    category: 'General remote services',
    rti: '',
    os: 'Microsoft Windows Server 2016',
    trurisk: 35,
  },
];

// Asset pools per OS type
const WINDOWS_ASSETS = Array.from({length: 60}, (_, i) => ({
  name: `WIN-SRV-${String(i+1).padStart(3,'0')}`,
  ip: `10.1.${Math.floor(i/254)}.${(i%254)+1}`,
}));

const LINUX_ASSETS = Array.from({length: 60}, (_, i) => ({
  name: `LNX-APP-${String(i+1).padStart(3,'0')}`,
  ip: `172.19.${Math.floor(i/254)}.${(i%254)+1}`,
}));

function getAssetPool(os) {
  if (os.includes('Windows')) return WINDOWS_ASSETS;
  return LINUX_ASSETS;
}

function formatDate(d) {
  return `${d.getMonth()+1}/${d.getDate()}/${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function makeRow(product, titleIdx, asset, firstDetected, lastDetected, ignored, status) {
  const title = product.titles[titleIdx % product.titles.length];
  const cve = product.cves.length > 0 ? product.cves[0] : "'-";
  const cveDesc = title;
  const qid = `QID-${crypto.createHash('md5').update(title).digest('hex').substring(0,8).toUpperCase()}`;
  const assetId = crypto.createHash('md5').update(asset.name).digest('hex').substring(0,12).toUpperCase();

  const fields = [
    cve,                                    // CVE
    `"${cveDesc}"`,                         // CVE-Description
    "'-",                                   // CVSSv2
    "'-",                                   // CVSSv3.1
    qid,                                    // QID
    `"${title}"`,                           // Title
    product.severity,                       // Severity
    product.severity,                       // KB Severity
    'Confirmed',                            // Type Detected
    formatDate(lastDetected),               // Last Detected
    formatDate(firstDetected),              // First Detected
    "'-",                                   // Protocol
    0,                                      // Port
    status,                                 // Status
    assetId,                                // Asset Id
    asset.name,                             // Asset Name
    asset.ip,                               // Asset IPV4
    '',                                     // Asset IPV6
    `"${product.solution}"`,                // Solution
    '"Business Units,Cloud Agent"',         // Asset Tags
    'No',                                   // Disabled
    ignored ? 'Yes' : 'No',                // Ignored
    product.trurisk,                        // QVS Score
    Math.floor((lastDetected - firstDetected) / 86400000), // Detection AGE
    formatDate(new Date('2024-06-15')),     // Published Date
    formatDate(new Date('2024-07-01')),     // Patch Released
    product.category,                       // Category
    product.severity >= 4 ? 'HIGH' : 'MEDIUM', // CVSS Rating Labels
    `"${product.rti}"`,                     // RTI
    product.os,                             // Operating System
    '',                                     // Last Fixed
    '',                                     // Last Reopened
    Math.floor(Math.random()*50)+1,         // Times Detected
    '"Vulnerability details"',              // Threat
    'Yes',                                  // Vuln Patchable
    Math.floor(Math.random()*5)+1,          // Asset Critical Score
    product.trurisk,                        // TruRisk Score
    '',                                     // Vulnerability Tags
    '"Test results data"',                  // Results
  ];
  return fields.join(',');
}

function generateScanA() {
  const rows = [...ORGDATA_ROWS, HEADER];
  const firstDetectedBase = new Date('2025-06-15');
  const lastDetectedA = new Date('2026-01-13');

  let rowCount = 0;

  for (const product of PRODUCTS) {
    const pool = getAssetPool(product.os);
    const assetCount = product.severity >= 4 ? 30 : 15;

    for (let a = 0; a < assetCount && a < pool.length; a++) {
      const titleIdx = a % product.titles.length;
      const firstDetected = new Date(firstDetectedBase.getTime() + (a * 86400000));
      const ignored = product.product === 'TLS Configuration' && a < 5; // 5 risk accepted TLS findings
      rows.push(makeRow(product, titleIdx, pool[a], firstDetected, lastDetectedA, ignored, 'ACTIVE'));
      rowCount++;
    }
  }

  // Add 100 extra Risk Accepted findings (various products, Ignored=Yes)
  const raProducts = [PRODUCTS[0], PRODUCTS[3], PRODUCTS[6]]; // Firefox ESR, Apache, OpenSSL
  for (let i = 0; i < 100; i++) {
    const prod = raProducts[i % raProducts.length];
    const pool = getAssetPool(prod.os);
    const asset = pool[Math.min(i % pool.length, pool.length - 1)];
    const firstDetected = new Date('2025-03-01');
    rows.push(makeRow(prod, 0, asset, firstDetected, lastDetectedA, true, 'ACTIVE'));
    rowCount++;
  }

  // Pad to ~1000 rows with duplicates across more assets
  while (rowCount < 1000) {
    const prod = PRODUCTS[rowCount % PRODUCTS.length];
    const pool = getAssetPool(prod.os);
    const asset = pool[Math.min((rowCount + 30) % pool.length, pool.length - 1)];
    const firstDetected = new Date(firstDetectedBase.getTime() + (rowCount * 43200000));
    rows.push(makeRow(prod, rowCount % prod.titles.length, asset, firstDetected, lastDetectedA, false, 'ACTIVE'));
    rowCount++;
  }

  return rows.join('\n');
}

function generateScanB() {
  const rows = [...ORGDATA_ROWS, HEADER];
  const firstDetectedBase = new Date('2025-06-15');
  const lastDetectedB = new Date('2026-02-10');

  let rowCount = 0;

  for (const product of PRODUCTS) {
    const pool = getAssetPool(product.os);
    const assetCount = product.severity >= 4 ? 30 : 15;

    // Simulate remediation: first 5 assets per product are remediated (not in Scan B)
    const startAsset = (product.product === 'Microsoft Windows Cumulative Update') ? 0 : 5;
    // Microsoft gets 15 remediated (half) to show big progress
    const msStart = product.product === 'Microsoft Windows Cumulative Update' ? 15 : startAsset;
    const actualStart = product.product === 'Microsoft Windows Cumulative Update' ? msStart : startAsset;

    for (let a = actualStart; a < assetCount && a < pool.length; a++) {
      const titleIdx = a % product.titles.length;
      const firstDetected = new Date(firstDetectedBase.getTime() + (a * 86400000));
      const ignored = product.product === 'TLS Configuration' && a < 5;
      rows.push(makeRow(product, titleIdx, pool[a], firstDetected, lastDetectedB, ignored, 'ACTIVE'));
      rowCount++;
    }

    // Add 3 NEW assets per high-severity product (regression)
    if (product.severity >= 4) {
      for (let n = 0; n < 3; n++) {
        const newAsset = {
          name: `NEW-${product.product.replace(/\s/g,'-').substring(0,10)}-${n+1}`,
          ip: `10.99.${n}.${rowCount % 254 + 1}`,
        };
        const firstDetected = new Date('2026-01-20'); // recently detected
        rows.push(makeRow(product, 0, newAsset, firstDetected, lastDetectedB, false, 'ACTIVE'));
        rowCount++;
      }
    }
  }

  // Risk Accepted findings carry over (same as Scan A)
  const raProducts = [PRODUCTS[0], PRODUCTS[3], PRODUCTS[6]];
  for (let i = 0; i < 100; i++) {
    const prod = raProducts[i % raProducts.length];
    const pool = getAssetPool(prod.os);
    const asset = pool[Math.min(i % pool.length, pool.length - 1)];
    const firstDetected = new Date('2025-03-01');
    rows.push(makeRow(prod, 0, asset, firstDetected, lastDetectedB, true, 'ACTIVE'));
    rowCount++;
  }

  // 150 brand new findings (new product not in Scan A)
  const newProduct = {
    product: 'Nginx',
    titles: ['Nginx < 1.25.4 HTTP/2 Vulnerability'],
    solution: 'Nginx 1.24.0 is installed. Update to Nginx 1.25.4 or later.',
    cves: ['CVE-2024-24989','CVE-2024-24990'],
    severity: 4,
    category: 'Web server',
    rti: 'Public Exploit',
    os: 'Amazon Linux 2',
    trurisk: 70,
  };
  for (let i = 0; i < 150; i++) {
    const asset = LINUX_ASSETS[Math.min(i % LINUX_ASSETS.length, LINUX_ASSETS.length - 1)];
    const firstDetected = new Date('2025-11-01');
    rows.push(makeRow(newProduct, 0, asset, firstDetected, lastDetectedB, false, 'ACTIVE'));
    rowCount++;
  }

  // Pad remaining to ~1000
  while (rowCount < 1000) {
    const prod = PRODUCTS[rowCount % PRODUCTS.length];
    const pool = getAssetPool(prod.os);
    const asset = pool[Math.min((rowCount + 30) % pool.length, pool.length - 1)];
    const firstDetected = new Date(firstDetectedBase.getTime() + (rowCount * 43200000));
    rows.push(makeRow(prod, rowCount % prod.titles.length, asset, firstDetected, lastDetectedB, false, 'ACTIVE'));
    rowCount++;
  }

  return rows.join('\n');
}

fs.writeFileSync(path.join(__dirname, 'scan-a.csv'), generateScanA());
fs.writeFileSync(path.join(__dirname, 'scan-b.csv'), generateScanB());
console.log('Generated scan-a.csv and scan-b.csv');
