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
        
        // Process data rows (skip header row)
        for (let i = headerRowIndex + 1; i < data.length; i++) {
            const rowArray = data[i];
            
            // Skip empty rows
            if (!rowArray || rowArray.length === 0 || !rowArray[0]) {
                continue;
            }
            
            // Convert array to object using headers
            const row = {};
            headers.forEach((header, index) => {
                row[header] = rowArray[index];
            });
            
            // Skip rows without CVE (first column check)
            if (!row['CVE'] || row['CVE'].trim() === '') {
                continue;
            }

            const vulnerability = this.normalizeQualysRow(row);
            if (vulnerability) {
                vulnerabilities.push(vulnerability);
            }
        }

        return vulnerabilities;
    }

    normalizeQualysRow(row) {
        try {
            // Extract and normalize Qualys-specific fields
            const cveList = this.extractCVEs(row['CVE']);
            const qidList = this.extractQIDs(row['QID']);
            const kbList = this.extractKBs(row['KB Severity'] || '');
            
            // Map Qualys severity to normalized risk level
            const severity = this.normalizeSeverity(row['Severity']);
            
            // Parse dates (Qualys format: "1/13/2026 22:51")
            const firstDetected = this.parseQualysDate(row['First Detected']);
            const lastDetected = this.parseQualysDate(row['Last Detected']);
            const publishedDate = this.parseQualysDate(row['Published Date']);
            const patchReleased = this.parseQualysDate(row['Patch Released']);

            return {
                // Core vulnerability data
                title: row['Title']?.trim() || 'Unknown Vulnerability',
                host: row['Asset Name']?.trim() || row['Asset Id']?.trim() || 'unknown',
                asset: {
                    hostname: row['Asset Name']?.trim() || row['Asset Id']?.trim() || 'unknown',
                    assetId: row['Asset Id']?.trim() || 'unknown',
                    ipv4: row['Asset IPV4']?.trim() || '',
                    ipv6: row['Asset IPV6']?.trim() || '',
                    operatingSystem: row['Operating System']?.trim() || 'unknown',
                    tags: this.parseAssetTags(row['Asset Tags'])
                },
                ip: row['Asset IPV4']?.trim() || '',
                
                // Risk and severity
                severity: severity,
                risk: this.mapSeverityToRisk(severity),
                
                // Vulnerability details
                description: row['CVE-Description']?.trim() || row['Title']?.trim() || 'No description available',
                solution: row['Solution']?.trim() || 'No solution available',
                results: row['Results']?.trim() || '',
                
                // CVSS scores
                cvss: {
                    v2: this.parseCVSS(row['CVSSv2 Base (nvd)']),
                    v3: this.parseCVSS(row['CVSSv3.1 Base (nvd)'])
                },
                
                // Identifiers
                cve: cveList,
                qid: qidList,
                kb: kbList,
                port: row['Port']?.trim() || '',
                protocol: row['Protocol']?.trim() || '',
                
                // Detection information
                firstDetected: firstDetected,
                lastDetected: lastDetected,
                publishedOn: publishedDate,
                patchReleased: patchReleased,
                timesDetected: parseInt(row['Times Detected']) || 1,
                
                // Classification
                category: row['Category']?.trim() || 'unknown',
                threat: row['Threat']?.trim() || 'unknown',
                type: row['Type Detected']?.trim() || 'vulnerability',
                
                // Status and flags
                status: row['Status']?.trim() || 'unknown',
                disabled: row['Disabled']?.trim() === 'Yes',
                ignored: row['Ignored']?.trim() === 'Yes',
                patchable: row['Vuln Patchable']?.trim() === 'Yes',
                
                // Scores and metrics
                qvsScore: parseFloat(row['QVS Score']) || 0,
                detectionAge: parseInt(row['Detection AGE']) || 0,
                assetCriticalScore: parseFloat(row['Asset Critical Score']) || 0,
                truRiskScore: parseFloat(row['TruRisk Score']) || 0,
                
                // Additional metadata
                identifiers: {
                    cve: cveList,
                    qid: qidList,
                    kb: kbList
                },
                text: row['Title']?.trim() || '',
                evidence: row['Results']?.trim() || '',
                
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
            if (num >= 4) return 'high';
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
            case '5':
            case 'high':
            case 'critical':
                return 'high';
            default:
                return 'unknown';
        }
    }

    mapSeverityToRisk(severity) {
        switch (severity) {
            case 'low': return 'low';
            case 'medium': return 'medium';
            case 'high': return 'high';
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
            return new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${minute.padStart(2, '0')}:00Z`);
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
