// CSV Format Processors
// Handles different vulnerability scanner formats (Qualys, Wiz, etc.)

class CSVFormatProcessor {
    constructor() {
        this.processors = new Map([
            ['qualys', new QualysProcessor()],
            ['wiz', new WizProcessor()],
            ['auto', new AutoDetector()] // Auto-detects format
        ]);
    }

    async processCSV(csvContent, filename, format = 'auto') {
        console.log(`📋 Processing CSV with format: ${format}`);
        
        const processor = this.processors.get(format);
        if (!processor) {
            throw new Error(`Unsupported CSV format: ${format}`);
        }

        return await processor.process(csvContent, filename);
    }

    detectFormat(csvContent) {
        const detector = this.processors.get('auto');
        return detector.detect(csvContent);
    }
}

// Qualys CSV Processor
class QualysProcessor {
    constructor() {
        this.name = 'Qualys';
        this.expectedHeaders = [
            'CVE', 'CVE-Description', 'CVSSv2 Base (nvd)', 'CVSSv3.1 Base (nvd)',
            'QID', 'Title', 'Severity', 'KB Severity', 'Type Detected',
            'Last Detected', 'First Detected', 'Protocol', 'Port', 'Status',
            'Asset Id', 'Asset Name', 'Asset IPV4', 'Asset IPV6', 'Solution',
            'Asset Tags', 'Disabled', 'Ignored', 'QVS Score', 'Detection AGE',
            'Published Date', 'Patch Released', 'Category', 'CVSS Rating Labels',
            'RTI', 'Operating System', 'Last Fixed', 'Last Reopened',
            'Times Detected', 'Threat', 'Vuln Patchable', 'Asset Critical Score',
            'TruRisk Score', 'Vulnerability Tags', 'Results', ''
        ];
    }

    async process(csvContent, filename) {
        console.log(`🔍 Processing Qualys CSV: ${filename}`);
        
        // Parse CSV WITHOUT headers first (Qualys has ORGDATA rows before headers)
        const parseResult = await new Promise((resolve, reject) => {
            Papa.parse(csvContent, {
                header: false, // Don't treat first row as header
                skipEmptyLines: true,
                complete: resolve,
                error: reject
            });
        });

        console.log(`📊 Parsed ${parseResult.data.length} rows from CSV`);

        // Find header row (Qualys typically has headers at row 4, after ORGDATA rows)
        const headerRowIndex = this.findHeaderRow(parseResult.data);
        if (headerRowIndex === -1) {
            console.error('❌ Could not find Qualys header row. First 5 rows:', parseResult.data.slice(0, 5));
            throw new Error('Could not find Qualys header row');
        }

        console.log(`✅ Found Qualys headers at row ${headerRowIndex + 1}`);

        // Extract vulnerability data
        const vulnerabilities = this.extractVulnerabilities(parseResult.data, headerRowIndex);
        
        console.log(`📊 Qualys Parse result: headerRow=${headerRowIndex + 1}, rowCount=${vulnerabilities.length}, columns=${Object.keys(vulnerabilities[0] || {}).length}`);
        
        return {
            format: 'qualys',
            source: 'Qualys',
            vulnerabilities: vulnerabilities,
            metadata: {
                filename: filename,
                headerRow: headerRowIndex + 1,
                totalRows: parseResult.data.length,
                processedAt: new Date().toISOString()
            }
        };
    }

    buildHeaderMap(headers) {
        // Map actual headers to standardized field names
        // Handles variations: 'First Detected' vs 'First Detection Date' vs 'firstDetected'
        const map = {};
        
        const fieldMappings = {
            qid: ['qid', 'vuln id', 'vulnerability id'],
            title: ['title', 'vulnerability', 'vuln name', 'vulnerability name'],
            cve: ['cve', 'cve id', 'cve-id'],
            severity: ['severity', 'risk', 'severity level'],
            status: ['status', 'vuln status', 'finding status'],
            firstDetected: ['first detected', 'first detection', 'first detection date', 'detection date'],
            lastDetected: ['last detected', 'last detection', 'last detection date'],
            assetName: ['asset name', 'hostname', 'host', 'dns', 'asset'],
            assetId: ['asset id', 'asset identifier', 'assetid'],
            ipv4: ['asset ipv4', 'ipv4', 'ip', 'ip address', 'asset ip'],
            ipv6: ['asset ipv6', 'ipv6'],
            operatingSystem: ['operating system', 'os', 'platform'],
            port: ['port', 'service port'],
            protocol: ['protocol', 'service protocol'],
            solution: ['solution', 'remediation', 'fix'],
            description: ['cve-description', 'description', 'vuln description'],
            results: ['results', 'evidence', 'finding details'],
            category: ['category', 'vuln category'],
            threat: ['threat', 'threat level'],
            patchable: ['vuln patchable', 'patchable'],
            ignored: ['ignored', 'is ignored'],
            disabled: ['disabled', 'is disabled'],
            publishedDate: ['published date', 'published', 'cve published'],
            patchReleased: ['patch released', 'patch date'],
            cvssV2: ['cvssv2 base (nvd)', 'cvss v2', 'cvss2'],
            cvssV3: ['cvssv3.1 base (nvd)', 'cvss v3', 'cvss3'],
            qvsScore: ['qvs score', 'qvs'],
            detectionAge: ['detection age', 'age'],
            assetCriticalScore: ['asset critical score', 'asset criticality'],
            truRiskScore: ['turisk score', 'trurisk'],
            timesDetected: ['times detected', 'detection count'],
            assetTags: ['asset tags', 'tags'],
            kbSeverity: ['kb severity', 'kb']
        };
        
        // Build reverse lookup: header name -> standard field
        headers.forEach((header, index) => {
            if (!header) return;
            const normalized = header.toLowerCase().trim();
            
            // Find matching standard field
            for (const [standardField, variations] of Object.entries(fieldMappings)) {
                if (variations.some(v => normalized === v || normalized.includes(v))) {
                    map[standardField] = index;
                    break;
                }
            }
        });
        
        return map;
    }
    
    mapRowToStandardFields(rowArray, headers, headerMap) {
        // Create object with both standard field names AND original header names
        const row = {};
        
        // First, map using original headers (for backward compatibility)
        headers.forEach((header, index) => {
            if (header) {
                row[header] = rowArray[index];
            }
        });
        
        // Then, add standard field mappings
        for (const [standardField, columnIndex] of Object.entries(headerMap)) {
            row[standardField] = rowArray[columnIndex];
        }
        
        return row;
    }
    
    findHeaderRow(data) {
        // Data is array of arrays, look for row containing 'CVE', 'Title', 'Severity'
        for (let i = 0; i < Math.min(10, data.length); i++) {
            const row = data[i];
            if (Array.isArray(row)) {
                // Check if this row contains the expected Qualys headers
                const rowStr = row.join('|').toLowerCase();
                if (rowStr.includes('cve') && rowStr.includes('title') && rowStr.includes('severity') && rowStr.includes('qid')) {
                    console.log(`🔍 Found header row at index ${i}:`, row.slice(0, 5));
                    return i;
                }
            }
        }
        return -1;
    }

    extractVulnerabilities(data, headerRowIndex) {
        const vulnerabilities = [];
        
        // Get headers from the header row
        const headers = data[headerRowIndex];
        console.log(`📋 Using ${headers.length} headers from row ${headerRowIndex + 1}`);
        
        // Build flexible header map to handle variations and API vs CSV differences
        const headerMap = this.buildHeaderMap(headers);
        console.log(`📋 Mapped ${Object.keys(headerMap).length} standard fields from headers`);
        
        // Validate critical headers are present
        const criticalFields = ['qid', 'title', 'severity'];
        const missingCritical = criticalFields.filter(field => !headerMap[field]);
        if (missingCritical.length > 0) {
            console.warn(`⚠️  Missing critical headers: ${missingCritical.join(', ')}`);
        }
        
        // Process data rows (skip header row)
        console.log(`\n📊 CSV PARSING DIAGNOSTICS:`);
        console.log(`   Total rows in CSV: ${data.length}`);
        console.log(`   Header row index: ${headerRowIndex}`);
        console.log(`   Data rows to process: ${data.length - headerRowIndex - 1}`);
        
        let skippedEmpty = 0;
        let skippedNoIdentifier = 0;
        let skippedNormalizationFailed = 0;
        let parsed = 0;
        
        for (let i = headerRowIndex + 1; i < data.length; i++) {
            const rowArray = data[i];
            
            // Skip truly empty rows (all cells blank)
            // Do NOT check rowArray[0] alone — CVE column is often empty for non-CVE findings
            if (!rowArray || rowArray.length === 0) {
                continue;
            }
            const hasAnyData = rowArray.some(cell => cell && cell.toString().trim() !== '');
            if (!hasAnyData) {
                skippedEmpty++;
                continue;
            }
            
            // Convert array to object using flexible header mapping
            const row = this.mapRowToStandardFields(rowArray, headers, headerMap);
            
            // Skip rows with no meaningful identifier (need at least QID or Title)
            // CVE is optional — many valid findings (config issues, potential vulns) have no CVE
            const hasQID = row.qid && row.qid.trim() !== '';
            const hasTitle = row.title && row.title.trim() !== '';
            if (!hasQID && !hasTitle) {
                skippedNoIdentifier++;
                if (skippedNoIdentifier <= 3) {
                    console.log(`   ⚠️ Row ${i} skipped (no QID/Title):`, {
                        QID: row['QID'],
                        Title: row['Title'],
                        firstFewCells: rowArray.slice(0, 5)
                    });
                }
                continue;
            }

            const vulnerability = this.normalizeQualysRow(row);
            if (vulnerability) {
                vulnerabilities.push(vulnerability);
                parsed++;
            } else {
                skippedNormalizationFailed++;
                if (skippedNormalizationFailed <= 3) {
                    console.log(`   ⚠️ Row ${i} normalization failed`);
                }
            }
        }
        
        console.log(`\n📊 CSV PARSING SUMMARY:`);
        console.log(`   ✅ Successfully parsed: ${parsed}`);
        console.log(`   ⏭️  Skipped (empty rows): ${skippedEmpty}`);
        console.log(`   ⏭️  Skipped (no QID/Title): ${skippedNoIdentifier}`);
        console.log(`   ❌ Skipped (normalization failed): ${skippedNormalizationFailed}`);
        
        if (parsed > 0) {
            const sample = vulnerabilities[0];
            console.log(`\n🔬 First parsed finding:`, {
                title: sample.title,
                qid: sample.qid,
                cve: sample.cve,
                severity: sample.severity,
                status: sample.status,
                host: sample.host,
                firstDetected: sample.firstDetected
            });
        }

        return vulnerabilities;
    }

    normalizeQualysRow(row) {
        try {
            // Extract and normalize Qualys-specific fields using flexible field access
            const cveList = this.extractCVEs(row.cve || row['CVE']);
            const qidList = this.extractQIDs(row.qid || row['QID']);
            const kbList = this.extractKBs(row.kbSeverity || row['KB Severity'] || '');
            
            // Map Qualys severity to normalized risk level
            const severity = this.normalizeSeverity(row.severity || row['Severity']);
            
            // Parse dates (Qualys format: "1/13/2026 22:51")
            const firstDetected = this.parseQualysDate(row.firstDetected || row['First Detected']);
            const lastDetected = this.parseQualysDate(row.lastDetected || row['Last Detected']);
            const publishedDate = this.parseQualysDate(row.publishedDate || row['Published Date']);
            const patchReleased = this.parseQualysDate(row.patchReleased || row['Patch Released']);

            // Extract OS value with flexible field access
            const osValue = (row.operatingSystem || row['Operating System'] || '').trim() || 'unknown';
            
            // Clean OS value: remove "OS: " prefix if present
            let cleanedOS = osValue;
            if (cleanedOS && cleanedOS !== 'unknown') {
                cleanedOS = cleanedOS.replace(/^OS:\s*/i, '').trim();
                // If after cleaning it's empty, set to empty string (not 'unknown')
                if (!cleanedOS) {
                    cleanedOS = '';
                }
            } else if (cleanedOS === 'unknown') {
                // Convert 'unknown' to empty string so checkOSRules can try inference
                cleanedOS = '';
            }
            
            return {
                // Core vulnerability data with flexible field access
                title: (row.title || row['Title'] || '').trim() || 'Unknown Vulnerability',
                host: (row.assetName || row['Asset Name'] || row.assetId || row['Asset Id'] || '').trim() || 'unknown',
                operatingSystem: cleanedOS,
                asset: {
                    hostname: (row.assetName || row['Asset Name'] || row.assetId || row['Asset Id'] || '').trim() || 'unknown',
                    assetId: (row.assetId || row['Asset Id'] || '').trim() || 'unknown',
                    ipv4: (row.ipv4 || row['Asset IPV4'] || '').trim() || '',
                    ipv6: (row.ipv6 || row['Asset IPV6'] || '').trim() || '',
                    operatingSystem: cleanedOS,
                    tags: this.parseAssetTags(row.assetTags || row['Asset Tags'])
                },
                ip: (row.ipv4 || row['Asset IPV4'] || '').trim() || '',
                
                // Risk and severity
                severity: severity,
                risk: this.mapSeverityToRisk(severity),
                
                // Vulnerability details with flexible field access
                description: (row.description || row['CVE-Description'] || row['Description'] || row.title || row['Title'] || '').trim() || 'No description available',
                solution: (row.solution || row['Solution'] || '').trim() || 'No solution available',
                results: (row.results || row['Results'] || '').trim() || '',
                
                // CVSS scores with flexible field access
                cvss: {
                    v2: this.parseCVSS(row.cvssV2 || row['CVSSv2 Base (nvd)']),
                    v3: this.parseCVSS(row.cvssV3 || row['CVSSv3.1 Base (nvd)'])
                },
                
                // Identifiers
                cve: cveList,
                qid: qidList,
                kb: kbList,
                port: (row.port || row['Port'] || '').trim() || '',
                protocol: (row.protocol || row['Protocol'] || '').trim() || '',
                
                // Detection information
                firstDetected: firstDetected,
                lastDetected: lastDetected,
                publishedOn: publishedDate,
                patchReleased: patchReleased,
                timesDetected: parseInt(row.timesDetected || row['Times Detected']) || 1,
                
                // Classification with flexible field access
                category: (row.category || row['Category'] || '').trim() || 'unknown',
                threat: (row.threat || row['Threat'] || '').trim() || 'unknown',
                type: (row.type || row['Type Detected'] || '').trim() || 'vulnerability',
                
                // Status and flags with flexible field access
                status: (row.status || row['Status'] || '').trim() || 'unknown',
                disabled: (row.disabled || row['Disabled'] || '').trim() === 'Yes',
                ignored: (row.ignored || row['Ignored'] || '').trim() === 'Yes',
                patchable: (row.patchable || row['Vuln Patchable'] || '').trim() === 'Yes',
                
                // Scores and metrics with flexible field access
                qvsScore: parseFloat(row.qvsScore || row['QVS Score']) || 0,
                detectionAge: parseInt(row.detectionAge || row['Detection AGE']) || 0,
                assetCriticalScore: parseFloat(row.assetCriticalScore || row['Asset Critical Score']) || 0,
                truRiskScore: parseFloat(row.truRiskScore || row['TruRisk Score']) || 0,
                
                // Additional metadata
                identifiers: {
                    cve: cveList,
                    qid: qidList,
                    kb: kbList
                },
                text: (row.title || row['Title'] || '').trim() || '',
                evidence: (row.results || row['Results'] || '').trim() || '',
                
                // Raw data for reference
                raw: row
            };
        } catch (error) {
            console.warn('⚠️ Error normalizing Qualys row:', error, row);
            return null;
        }
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
        // Extract KB numbers from strings like "KB5068781_KB5072014"
        const kbMatches = kbField.match(/KB\d+/g);
        return kbMatches || [];
    }

    normalizeSeverity(severityField) {
        if (!severityField) return 'unknown';
        
        const severity = severityField.toString().trim();
        
        // Qualys numeric severity (1-5)
        if (/^[1-5]$/.test(severity)) {
            const num = parseInt(severity);
            if (num <= 2) return 'low';
            if (num === 3) return 'medium';
            if (num === 4) return 'high';
            if (num === 5) return 'critical';
        }
        
        // Qualys text severity
        switch (severity.toLowerCase()) {
            case '1':
            case '2':
            case 'low':
                return 'low';
            case '3':
            case 'medium':
                return 'medium';
            case '4':
            case 'high':
                return 'high';
            case '5':
            case 'critical':
                return 'critical';
            default:
                return 'unknown';
        }
    }

    mapSeverityToRisk(severity) {
        switch (severity) {
            case 'low': return 'low';
            case 'medium': return 'medium';
            case 'high': return 'high';
            case 'critical': return 'critical';
            default: return 'unknown';
        }
    }

    parseQualysDate(dateField) {
        if (!dateField) return null;
        
        // Qualys format: "1/13/2026 22:51" or "1/7/2025 15:27"
        const dateRegex = /(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/;
        const match = dateField.match(dateRegex);
        
        if (match) {
            const [, month, day, year, hour, minute] = match;
            // Return ISO string for compatibility with analysis engine's parseDate
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${minute.padStart(2, '0')}:00Z`;
        }
        
        return null;
    }

    parseCVSS(cvssField) {
        if (!cvssField || cvssField === "'-") return null;
        const score = parseFloat(cvssField);
        return isNaN(score) ? null : score;
    }

    parseAssetTags(tagsField) {
        if (!tagsField) return [];
        return tagsField.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
    }
}

// Wiz CSV Processor (placeholder for future implementation)
class WizProcessor {
    constructor() {
        this.name = 'Wiz';
        // Wiz-specific headers and processing logic will go here
    }

    async process(csvContent, filename) {
        console.log(`🔍 Processing Wiz CSV: ${filename}`);
        // TODO: Implement Wiz-specific parsing logic
        throw new Error('Wiz processor not yet implemented');
    }
}

// Auto-detects CSV format
class AutoDetector {
    detect(csvContent) {
        // Look for Qualys-specific headers
        if (csvContent.includes('CVE-Description') && csvContent.includes('QID') && csvContent.includes('Asset IPV4')) {
            return 'qualys';
        }
        
        // Look for Wiz-specific headers
        if (csvContent.includes('wiz') || csvContent.includes('cloud')) {
            return 'wiz';
        }
        
        // Default to Qualys for now
        return 'qualys';
    }
}

// Export for use in main application
window.CSVFormatProcessor = CSVFormatProcessor;
window.QualysProcessor = QualysProcessor;
window.WizProcessor = WizProcessor;
