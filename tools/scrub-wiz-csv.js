#!/usr/bin/env node
'use strict';

/**
 * Wiz CSV Scrubber
 *
 * Replaces system-specific info (hostnames, IPs, subscriptions, tags, ARNs, URLs)
 * while preserving grouping-relevant fields (Name/CVE, DetailedName, Severity,
 * Score, Version, FixedVersion, Remediation, DetectionMethod, OperatingSystem,
 * FindingStatus, dates).
 *
 * Usage: node tools/scrub-wiz-csv.js <input.csv> [output.csv]
 */

const fs = require('fs');
const crypto = require('crypto');

const inputFile = process.argv[2];
const outputFile = process.argv[3] || inputFile.replace(/\.csv$/i, '-scrubbed.csv');

if (!inputFile) {
    console.error('Usage: node tools/scrub-wiz-csv.js <input.csv> [output.csv]');
    process.exit(1);
}

// Deterministic hash so same input always maps to same fake value
function hash(val, prefix, len) {
    const h = crypto.createHash('md5').update(val).digest('hex');
    return prefix + h.substring(0, len || 6);
}

// Caches for consistent replacement across rows
const hostMap = new Map();
const ipMap = new Map();
const subMap = new Map();
const projMap = new Map();
let hostCounter = 1;
let ipOctet = 1;
let subCounter = 1;
let projCounter = 1;

function fakeHost(real) {
    if (!real || real.trim() === '') return '';
    const key = real.trim().toLowerCase();
    if (!hostMap.has(key)) {
        hostMap.set(key, `host-${String(hostCounter++).padStart(4, '0')}`);
    }
    return hostMap.get(key);
}

function fakeIP(real) {
    if (!real || real.trim() === '') return '';
    const key = real.trim();
    if (!ipMap.has(key)) {
        const a = 10, b = Math.floor(ipOctet / 256), c = ipOctet % 256;
        ipMap.set(key, `${a}.${b}.${c}.${ipOctet % 254 + 1}`);
        ipOctet++;
    }
    return ipMap.get(key);
}

function fakeSub(real) {
    if (!real || real.trim() === '') return '';
    const key = real.trim().toLowerCase();
    if (!subMap.has(key)) {
        subMap.set(key, `subscription-${String(subCounter++).padStart(2, '0')}`);
    }
    return subMap.get(key);
}

function fakeProjects(real) {
    if (!real || real.trim() === '') return '';
    // Projects can be semicolon-separated
    const parts = real.split(';').map(p => p.trim()).filter(Boolean);
    return parts.map(p => {
        const key = p.toLowerCase();
        if (!projMap.has(key)) {
            projMap.set(key, `Project-${String(projCounter++).padStart(2, '0')}`);
        }
        return projMap.get(key);
    }).join('; ');
}

function fakeAssetId(real) {
    if (!real || real.trim() === '') return '';
    return hash(real, 'asset-');
}

function fakeARN(real) {
    if (!real || real.trim() === '') return '';
    // Replace the account/instance ID but keep the structure
    return 'arn:aws:ec2:us-east-1:000000000000:instance/' + hash(real, 'i-', 12);
}

function fakeCloudURL(real) {
    if (!real || real.trim() === '') return '';
    return 'https://console.example.com/instance/' + hash(real, '', 8);
}

function fakeSubId(real) {
    if (!real || real.trim() === '') return '';
    return hash(real, '', 8) + '-0000-0000-0000-' + hash(real, '', 12);
}

function fakeSubExtId(real) {
    if (!real || real.trim() === '') return '';
    return hash(real, '', 12);
}

function scrubbedTags(real) {
    if (!real || real.trim() === '') return '';
    try {
        const parsed = JSON.parse(real);
        if (typeof parsed !== 'object') return '';
        // Allowlist approach: only keep PCA Code and Environment.
        // Everything else is scrubbed or dropped.
        const scrubbed = {};
        for (const [key, val] of Object.entries(parsed)) {
            const k = key.toLowerCase().replace(/[\s_-]/g, '');
            if (!val || String(val).trim() === '') continue;
            if (k === 'pcacode') {
                scrubbed[key] = val;
            } else if (k === 'environment') {
                scrubbed[key] = val;
            } else {
                // Replace value with generic label
                scrubbed[key] = key.charAt(0).toUpperCase() + key.slice(1) + '-' + hash(String(val), '', 4);
            }
        }
        return JSON.stringify(scrubbed);
    } catch (e) {
        return '';
    }
}

// Columns to scrub and their scrub functions
// PRESERVE: Name, CVSSSeverity, HasExploit, HasCisaKevExploit, FindingStatus,
//   Score, Severity, VendorSeverity, NvdSeverity, FirstDetected, LastDetected,
//   ResolvedAt, ResolutionReason, Remediation, LocationPath, DetailedName,
//   Version, FixedVersion, DetectionMethod, OperatingSystem, AssetType,
//   CloudPlatform, Status, AssetRegion
const SCRUB_MAP = {
    'AssetName':        fakeHost,
    'AssetID':          fakeAssetId,
    'IpAddresses':      fakeIP,
    'ProviderUniqueId': fakeARN,
    'CloudProviderURL': fakeCloudURL,
    'SubscriptionExternalId': fakeSubExtId,
    'SubscriptionId':   fakeSubId,
    'SubscriptionName': fakeSub,
    'Projects':         fakeProjects,
    'Tags':             scrubbedTags,
    'Link':             (v) => v ? 'https://app.example.com/vuln/' + hash(v, '', 8) : '',
    'ExecutionControllers':                     () => '[]',
    'ExecutionControllersSubscriptionExternalIds': () => '',
    'ExecutionControllersSubscriptionNames':     () => '',
    'ExecutionControllersKubernetesClusterNames': () => '',
    'PodNamespace':     () => '',
    'PodName':          () => '',
    'NodeName':         () => '',
    'Runtime':          () => '',
    'ImageId':          () => '',
    'ImageExternalId':  () => '',
    'VmExternalId':     (v) => v ? hash(v, 'vm-', 8) : '',
};

// Parse CSV (handles quoted fields with commas/newlines)
function parseCSVLine(line) {
    const fields = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
            if (ch === '"' && line[i + 1] === '"') {
                current += '"';
                i++;
            } else if (ch === '"') {
                inQuotes = false;
            } else {
                current += ch;
            }
        } else {
            if (ch === '"') {
                inQuotes = true;
            } else if (ch === ',') {
                fields.push(current);
                current = '';
            } else {
                current += ch;
            }
        }
    }
    fields.push(current);
    return fields;
}

function escapeCSVField(val) {
    if (!val) return '';
    const s = String(val);
    if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
        return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
}

// Main
console.log(`Reading: ${inputFile}`);
const content = fs.readFileSync(inputFile, 'utf8');
const lines = content.split(/\r?\n/);

if (lines.length < 2) {
    console.error('File too short — need at least a header + 1 data row');
    process.exit(1);
}

const headers = parseCSVLine(lines[0]);
console.log(`Headers: ${headers.length} columns, ${lines.length - 1} data rows`);

// Build column index → scrub function map
const colScrubbers = headers.map(h => SCRUB_MAP[h.trim()] || null);
const scrubCount = colScrubbers.filter(Boolean).length;
console.log(`Scrubbing ${scrubCount} columns: ${headers.filter((h, i) => colScrubbers[i]).join(', ')}`);

const output = [lines[0]]; // header unchanged

for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const fields = parseCSVLine(line);
    const scrubbed = fields.map((val, idx) => {
        const fn = colScrubbers[idx];
        return fn ? fn(val) : val;
    });

    output.push(scrubbed.map(escapeCSVField).join(','));
}

fs.writeFileSync(outputFile, output.join('\n'), 'utf8');
console.log(`\nWrote: ${outputFile}`);
console.log(`  ${output.length - 1} rows`);
console.log(`  ${hostMap.size} unique hosts → fake hostnames`);
console.log(`  ${ipMap.size} unique IPs → fake IPs`);
console.log(`  ${subMap.size} unique subscriptions → fake names`);
console.log(`  ${projMap.size} unique projects → fake names`);
console.log(`\nPreserved: Name (CVE), DetailedName, Severity, Score, Version,`);
console.log(`  FixedVersion, Remediation, DetectionMethod, OperatingSystem,`);
console.log(`  FindingStatus, dates, AssetType, CloudPlatform, AssetRegion`);
