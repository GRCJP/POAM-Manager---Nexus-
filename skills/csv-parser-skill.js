/**
 * CSV Parser Skill
 * 
 * Responsibilities:
 * - Parse CSV files with flexible header detection
 * - Map headers to standardized field names
 * - Handle multiple CSV formats (Qualys, Tenable, Wiz, etc.)
 * - Validate data quality and completeness
 */

class CSVParserSkill extends BaseSkill {
    constructor(config = {}) {
        super('CSVParserSkill', config);
        this.supportedFormats = ['qualys', 'tenable', 'wiz'];
    }

    async run(input) {
        const { csvData, format = 'qualys', filename = 'unknown' } = input;

        console.log(`\n📄 CSV PARSER SKILL: Processing ${filename}`);
        console.log(`   Format: ${format}`);
        console.log(`   Rows: ${csvData.length}`);

        // Step 1: Detect header row
        const headerRowIndex = this.findHeaderRow(csvData, format);
        if (headerRowIndex === -1) {
            throw new Error('Could not find header row in CSV data');
        }

        const headers = csvData[headerRowIndex];
        console.log(`   ✅ Found header row at index ${headerRowIndex}`);
        console.log(`   ✅ Headers: ${headers.length} columns`);

        // Step 2: Build flexible header map
        const headerMap = this.buildHeaderMap(headers, format);
        console.log(`   ✅ Mapped ${Object.keys(headerMap).length} standard fields`);

        // Step 3: Validate critical fields are present
        const validation = this.validateHeaders(headerMap, format);
        if (!validation.valid) {
            console.warn(`   ⚠️ Missing critical fields: ${validation.missing.join(', ')}`);
        }

        // Step 4: Parse data rows
        const parseResult = this.parseRows(csvData, headerRowIndex, headers, headerMap, format);

        return {
            findings: parseResult.findings,
            metadata: {
                filename,
                format,
                headerRow: headerRowIndex + 1,
                totalRows: csvData.length,
                dataRows: csvData.length - headerRowIndex - 1,
                parsedRows: parseResult.parsed,
                skippedRows: parseResult.skipped,
                headerMap: Object.keys(headerMap),
                processedAt: new Date().toISOString()
            },
            quality: {
                parseRate: ((parseResult.parsed / (csvData.length - headerRowIndex - 1)) * 100).toFixed(2) + '%',
                criticalFieldsCoverage: validation.coverage
            }
        };
    }

    findHeaderRow(data, format) {
        const expectedHeaders = {
            qualys: ['cve', 'title', 'severity', 'qid'],
            tenable: ['cve', 'name', 'severity', 'plugin id'],
            wiz: ['cve', 'title', 'severity', 'issue id']
        };

        const headers = expectedHeaders[format] || expectedHeaders.qualys;

        for (let i = 0; i < Math.min(10, data.length); i++) {
            const row = data[i];
            if (Array.isArray(row)) {
                const rowStr = row.join('|').toLowerCase();
                const matchCount = headers.filter(h => rowStr.includes(h)).length;
                if (matchCount >= 3) {
                    return i;
                }
            }
        }
        return -1;
    }

    buildHeaderMap(headers, format) {
        const map = {};

        // Universal field mappings (works across all formats)
        const fieldMappings = {
            // Identifiers
            qid: ['qid', 'vuln id', 'vulnerability id', 'plugin id', 'issue id'],
            title: ['title', 'vulnerability', 'vuln name', 'vulnerability name', 'name'],
            cve: ['cve', 'cve id', 'cve-id', 'cve identifier'],
            
            // Risk and severity
            severity: ['severity', 'risk', 'severity level', 'risk rating'],
            cvssV2: ['cvssv2 base (nvd)', 'cvss v2', 'cvss2', 'cvss base score'],
            cvssV3: ['cvssv3.1 base (nvd)', 'cvss v3', 'cvss3', 'cvssv3'],
            
            // Status and lifecycle
            status: ['status', 'vuln status', 'finding status', 'state'],
            firstDetected: ['first detected', 'first detection', 'first detection date', 'detection date', 'first seen'],
            lastDetected: ['last detected', 'last detection', 'last detection date', 'last seen'],
            
            // Asset information
            assetName: ['asset name', 'hostname', 'host', 'dns', 'asset', 'device name'],
            assetId: ['asset id', 'asset identifier', 'assetid', 'device id'],
            ipv4: ['asset ipv4', 'ipv4', 'ip', 'ip address', 'asset ip', 'ipv4 address'],
            ipv6: ['asset ipv6', 'ipv6', 'ipv6 address'],
            operatingSystem: ['operating system', 'os', 'platform', 'os name'],
            
            // Network information
            port: ['port', 'service port', 'port number'],
            protocol: ['protocol', 'service protocol', 'network protocol'],
            
            // Remediation
            solution: ['solution', 'remediation', 'fix', 'recommendation'],
            description: ['cve-description', 'description', 'vuln description', 'synopsis'],
            results: ['results', 'evidence', 'finding details', 'output'],
            
            // Classification
            category: ['category', 'vuln category', 'plugin family'],
            threat: ['threat', 'threat level', 'exploit available'],
            patchable: ['vuln patchable', 'patchable', 'patch available'],
            
            // Flags
            ignored: ['ignored', 'is ignored', 'accepted'],
            disabled: ['disabled', 'is disabled'],
            
            // Dates
            publishedDate: ['published date', 'published', 'cve published', 'publication date'],
            patchReleased: ['patch released', 'patch date', 'patch publication date'],
            
            // Scores and metrics
            qvsScore: ['qvs score', 'qvs'],
            detectionAge: ['detection age', 'age', 'age in days'],
            assetCriticalScore: ['asset critical score', 'asset criticality'],
            truRiskScore: ['trurisk score', 'trurisk'],
            vpr: ['vpr', 'vulnerability priority rating'],
            timesDetected: ['times detected', 'detection count', 'occurrence count'],
            
            // Additional metadata
            assetTags: ['asset tags', 'tags', 'labels'],
            kbSeverity: ['kb severity', 'kb', 'microsoft kb']
        };

        // Build reverse lookup
        headers.forEach((header, index) => {
            if (!header) return;
            const normalized = header.toLowerCase().trim();

            for (const [standardField, variations] of Object.entries(fieldMappings)) {
                // Use exact match first, then substring match for compound headers
                const exactMatch = variations.some(v => normalized === v);
                const substringMatch = variations.some(v => v.length > 3 && normalized.includes(v));
                
                if (exactMatch || substringMatch) {
                    // Prefer exact matches - don't override if already mapped
                    if (!map[standardField] || exactMatch) {
                        map[standardField] = index;
                    }
                    if (exactMatch) break;
                }
            }
        });

        return map;
    }

    validateHeaders(headerMap, format) {
        const criticalFields = {
            qualys: ['qid', 'title', 'severity'],
            tenable: ['qid', 'title', 'severity'],
            wiz: ['qid', 'title', 'severity']
        };

        const required = criticalFields[format] || criticalFields.qualys;
        const missing = required.filter(field => !headerMap[field]);

        return {
            valid: missing.length === 0,
            missing,
            coverage: ((required.length - missing.length) / required.length * 100).toFixed(2) + '%'
        };
    }

    parseRows(data, headerRowIndex, headers, headerMap, format) {
        const findings = [];
        let parsed = 0;
        let skipped = {
            empty: 0,
            noIdentifier: 0,
            normalizationFailed: 0
        };

        for (let i = headerRowIndex + 1; i < data.length; i++) {
            const rowArray = data[i];

            // Skip empty rows
            if (!rowArray || rowArray.length === 0) {
                continue;
            }

            const hasAnyData = rowArray.some(cell => cell && cell.toString().trim() !== '');
            if (!hasAnyData) {
                skipped.empty++;
                continue;
            }

            // Map row to standard fields
            const row = this.mapRowToStandardFields(rowArray, headers, headerMap);

            // Validate row has identifier
            const hasQID = row.qid && row.qid.trim() !== '';
            const hasTitle = row.title && row.title.trim() !== '';
            if (!hasQID && !hasTitle) {
                skipped.noIdentifier++;
                continue;
            }

            // Normalize row based on format
            const finding = this.normalizeFinding(row, format);
            if (finding) {
                findings.push(finding);
                parsed++;
            } else {
                skipped.normalizationFailed++;
            }
        }

        console.log(`\n   📊 PARSING RESULTS:`);
        console.log(`      ✅ Parsed: ${parsed}`);
        console.log(`      ⏭️  Skipped (empty): ${skipped.empty}`);
        console.log(`      ⏭️  Skipped (no ID): ${skipped.noIdentifier}`);
        console.log(`      ❌ Failed normalization: ${skipped.normalizationFailed}`);

        return { findings, parsed, skipped };
    }

    mapRowToStandardFields(rowArray, headers, headerMap) {
        const row = {};

        // Map original headers (backward compatibility)
        headers.forEach((header, index) => {
            if (header) {
                row[header] = rowArray[index];
            }
        });

        // Map standard fields
        for (const [standardField, columnIndex] of Object.entries(headerMap)) {
            row[standardField] = rowArray[columnIndex];
        }

        return row;
    }

    normalizeFinding(row, format) {
        try {
            // Format-specific normalization
            if (format === 'qualys') {
                return this.normalizeQualysFinding(row);
            } else if (format === 'tenable') {
                return this.normalizeTenableFinding(row);
            } else if (format === 'wiz') {
                return this.normalizeWizFinding(row);
            }
            return null;
        } catch (error) {
            console.warn('⚠️ Normalization failed:', error.message);
            return null;
        }
    }

    normalizeQualysFinding(row) {
        // Extract CVEs, QIDs, KBs
        const cveList = this.extractCVEs(row.cve || row['CVE']);
        const qidList = this.extractQIDs(row.qid || row['QID']);
        const kbList = this.extractKBs(row.kbSeverity || row['KB Severity'] || '');

        // Parse dates
        const firstDetected = this.parseQualysDate(row.firstDetected || row['First Detected']);
        const lastDetected = this.parseQualysDate(row.lastDetected || row['Last Detected']);

        return {
            // Core fields
            title: (row.title || row['Title'] || '').trim() || 'Unknown Vulnerability',
            qid: qidList,
            cve: cveList,
            kb: kbList,
            
            // Asset
            host: (row.assetName || row['Asset Name'] || row.assetId || row['Asset Id'] || '').trim() || 'unknown',
            ip: (row.ipv4 || row['Asset IPV4'] || '').trim() || '',
            operatingSystem: (row.operatingSystem || row['Operating System'] || '').trim() || '',
            
            // Risk
            severity: (row.severity || row['Severity'] || '').trim() || 'unknown',
            cvss: {
                v2: parseFloat(row.cvssV2 || row['CVSSv2 Base (nvd)']) || null,
                v3: parseFloat(row.cvssV3 || row['CVSSv3.1 Base (nvd)']) || null
            },
            
            // Details
            description: (row.description || row['CVE-Description'] || row['Description'] || '').trim() || '',
            solution: (row.solution || row['Solution'] || '').trim() || '',
            results: (row.results || row['Results'] || '').trim() || '',
            
            // Status (default to ACTIVE if not present, matching original engine)
            status: (row.status || row['Status'] || '').trim() || 'ACTIVE',
            firstDetected,
            lastDetected,
            
            // Raw for reference
            raw: row
        };
    }

    normalizeTenableFinding(row) {
        // Tenable-specific normalization
        return {
            title: (row.title || row['Name'] || '').trim() || 'Unknown Vulnerability',
            qid: [(row.qid || row['Plugin ID'] || '').trim()],
            cve: this.extractCVEs(row.cve || row['CVE']),
            host: (row.assetName || row['Host'] || '').trim() || 'unknown',
            severity: (row.severity || row['Severity'] || '').trim() || 'unknown',
            status: (row.status || row['State'] || '').trim() || 'ACTIVE',
            raw: row
        };
    }

    normalizeWizFinding(row) {
        // Wiz-specific normalization
        return {
            title: (row.title || row['Title'] || '').trim() || 'Unknown Vulnerability',
            qid: [(row.qid || row['Issue ID'] || '').trim()],
            cve: this.extractCVEs(row.cve || row['CVE']),
            host: (row.assetName || row['Resource'] || '').trim() || 'unknown',
            severity: (row.severity || row['Severity'] || '').trim() || 'unknown',
            status: (row.status || row['Status'] || '').trim() || 'ACTIVE',
            raw: row
        };
    }

    extractCVEs(cveField) {
        if (!cveField) return [];
        return cveField.split(',').map(cve => cve.trim()).filter(cve => cve.startsWith('CVE-'));
    }

    extractQIDs(qidField) {
        if (!qidField) return [];
        return qidField.split(',').map(qid => qid.trim()).filter(qid => qid.length > 0);
    }

    extractKBs(kbField) {
        if (!kbField) return [];
        const kbMatches = kbField.match(/KB\d+/g);
        return kbMatches || [];
    }

    parseQualysDate(dateField) {
        if (!dateField) return null;
        const dateRegex = /(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/;
        const match = dateField.match(dateRegex);
        if (match) {
            const [, month, day, year, hour, minute] = match;
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${minute.padStart(2, '0')}:00Z`;
        }
        return null;
    }

    async validate(data, type) {
        if (type === 'input') {
            const errors = [];
            if (!data.csvData || !Array.isArray(data.csvData)) {
                errors.push('csvData must be an array');
            }
            if (data.csvData && data.csvData.length === 0) {
                errors.push('csvData cannot be empty');
            }
            return { valid: errors.length === 0, errors };
        }

        if (type === 'output') {
            const errors = [];
            if (!data.findings || !Array.isArray(data.findings)) {
                errors.push('findings must be an array');
            }
            if (!data.metadata) {
                errors.push('metadata is required');
            }
            return { valid: errors.length === 0, errors };
        }

        return { valid: true, errors: [] };
    }

    async getTestCases() {
        return [
            {
                name: 'Parse simple Qualys CSV',
                input: {
                    csvData: [
                        ['CVE', 'QID', 'Title', 'Severity', 'Asset Name'],
                        ['CVE-2024-1234', '12345', 'Test Vuln', '4', 'server01']
                    ],
                    format: 'qualys'
                },
                validate: (result) => {
                    return result.success && 
                           result.data.findings.length === 1 &&
                           result.data.findings[0].title === 'Test Vuln';
                }
            }
        ];
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = CSVParserSkill;
}
