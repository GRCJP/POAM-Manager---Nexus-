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
            kbSeverity: ['kb severity', 'kb'],
            poc: ['poc', 'point of contact', 'owner', 'assigned to', 'assignee'],
            pocName: ['poc name', 'contact name', 'owner name'],
            pocEmail: ['poc email', 'contact email', 'owner email'],
            scheduledCompletionDate: ['scheduled completion date', 'completion date', 'due date', 'target date'],
            poamStatus: ['poam status', 'finding status', 'remediation status']
        };
        
        // Build reverse lookup: header name -> standard field
        // Prefer exact matches and avoid short substring collisions
        // (e.g., "TruRisk Score" incorrectly matching "risk" for severity)
        headers.forEach((header, index) => {
            if (!header) return;
            const normalized = header.toLowerCase().trim();
            
            for (const [standardField, variations] of Object.entries(fieldMappings)) {
                const exactMatch = variations.some(v => normalized === v);
                const substringMatch = variations.some(v => v.length > 3 && normalized.includes(v));
                
                if (exactMatch || substringMatch) {
                    // Keep existing exact mapping unless this is a new exact match
                    if (!map[standardField] || exactMatch) {
                        map[standardField] = index;
                    }
                    if (exactMatch) break;
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
                
                // Dates
                firstDetected: firstDetected,
                lastDetected: lastDetected,
                publishedDate: publishedDate,
                patchReleased: patchReleased,
                scheduledCompletionDate: this.parseQualysDate(row.scheduledCompletionDate || row['Scheduled Completion Date'] || row['Due Date']),
                
                // POC information (individual name if present)
                poc: (row.poc || row['POC'] || row.pocName || row['POC Name'] || '').trim() || null,
                pocEmail: (row.pocEmail || row['POC Email'] || '').trim() || null,
                timesDetected: parseInt(row.timesDetected || row['Times Detected']) || 1,
                
                // Classification with flexible field access
                category: (row.category || row['Category'] || '').trim() || 'unknown',
                threat: (row.threat || row['Threat'] || '').trim() || 'unknown',
                type: (row.type || row['Type Detected'] || '').trim() || 'vulnerability',
                
                // Status and flags with flexible field access
                status: (row.status || row['Status'] || '').trim() || 'ACTIVE',
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
        
        const dateStr = String(dateField).trim();
        if (!dateStr) return null;
        
        // Try multiple date formats (OR logic for flexibility)
        
        // Format 1: M/D/YYYY HH:MM or MM/DD/YYYY HH:MM (with timestamp)
        const withTimeRegex = /(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/;
        let match = dateStr.match(withTimeRegex);
        if (match) {
            const [, month, day, year, hour, minute] = match;
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${minute.padStart(2, '0')}:00Z`;
        }
        
        // Format 2: M/D/YYYY or MM/DD/YYYY (date only, no timestamp)
        const dateOnlyRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
        match = dateStr.match(dateOnlyRegex);
        if (match) {
            const [, month, day, year] = match;
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00Z`;
        }
        
        // Format 3: YYYY-MM-DD (ISO format)
        const isoRegex = /^(\d{4})-(\d{1,2})-(\d{1,2})/;
        match = dateStr.match(isoRegex);
        if (match) {
            const [, year, month, day] = match;
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00Z`;
        }
        
        // Format 4: Try JavaScript Date parser as last resort
        try {
            const parsed = new Date(dateStr);
            if (!isNaN(parsed.getTime())) {
                return parsed.toISOString();
            }
        } catch (e) {
            // Parsing failed, continue to return null
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
// ═══════════════════════════════════════════════════════════════
// VULNERABILITY INTELLIGENCE MODULE
// ═══════════════════════════════════════════════════════════════
// Enriches POAMs with authoritative vulnerability data from NVD, MITRE, and NIST

console.log('🧠 Vulnerability Intelligence Module Loading...');

class VulnerabilityIntelligence {
    constructor() {
        this.cache = new Map();
        this.cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours
        this.nistMapping = null;
        this.initPromise = this.init();
    }

    async init() {
        // Load NIST control mapping
        try {
            const response = await fetch('config/nist-control-mapping.json');
            this.nistMapping = await response.json();
            console.log('✅ NIST control mapping loaded');
        } catch (error) {
            console.error('❌ Failed to load NIST mapping:', error);
            this.nistMapping = { mappings: [], defaultMapping: {} };
        }
    }

    // Main enrichment function
    async enrichPOAM(poam) {
        if (!window.isFeatureEnabled('vulnerabilityIntelligence')) {
            return poam; // Feature disabled, return unchanged
        }

        await this.initPromise;

        try {
            const enrichedData = {
                cveDetails: {},
                mitreAttack: [],
                nistControls: [],
                patchAvailable: false,
                estimatedEffort: 'medium',
                recommendedMilestones: 'CM'
            };

            // Enrich CVE data
            if (poam.cves && poam.cves.length > 0) {
                for (const cve of poam.cves.slice(0, 5)) { // Limit to 5 CVEs
                    const cveData = await this.getCVEData(cve);
                    if (cveData) {
                        enrichedData.cveDetails[cve] = cveData;
                        
                        // Extract MITRE ATT&CK techniques
                        if (cveData.mitreAttack) {
                            enrichedData.mitreAttack.push(...cveData.mitreAttack);
                        }
                        
                        // Check patch availability
                        if (cveData.patchAvailable) {
                            enrichedData.patchAvailable = true;
                        }
                    }
                }
            }

            // Map to NIST controls
            const nistMapping = this.mapToNISTControls(poam);
            enrichedData.nistControls = nistMapping.controls;
            enrichedData.recommendedMilestones = nistMapping.milestoneTemplate;
            enrichedData.estimatedEffort = nistMapping.estimatedEffort;

            // Attach enriched data to POAM
            poam.enrichedData = enrichedData;
            
            console.log(`✅ Enriched POAM ${poam.id} with intelligence data`);
            return poam;

        } catch (error) {
            console.error(`❌ Failed to enrich POAM ${poam.id}:`, error);
            window.trackFeatureError('vulnerabilityIntelligence', error);
            return poam; // Return unchanged on error
        }
    }

    // Get CVE data from NVD API
    async getCVEData(cveId) {
        if (!cveId || !cveId.startsWith('CVE-')) {
            return null;
        }

        // Check cache first
        const cached = this.getCachedData(cveId);
        if (cached) {
            return cached;
        }

        try {
            let cveData;

            // Use DMZ proxy if enabled
            if (window.isFeatureEnabled('dmzProxy')) {
                cveData = await this.fetchViaDMZ(cveId);
            } else {
                // Mock data for testing (replace with actual API call when DMZ ready)
                cveData = await this.getMockCVEData(cveId);
            }

            // Cache the result
            this.setCachedData(cveId, cveData);

            return cveData;

        } catch (error) {
            console.error(`❌ Failed to fetch CVE data for ${cveId}:`, error);
            return null;
        }
    }

    // Fetch CVE data via DMZ proxy
    async fetchViaDMZ(cveId) {
        const proxyUrl = window.FEATURE_FLAGS.dmzProxyUrl;
        const response = await fetch(`${proxyUrl}/api/nvd/cve/${cveId}`, {
            headers: {
                'Authorization': `Bearer ${this.getAPIKey()}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`DMZ proxy returned ${response.status}`);
        }

        const data = await response.json();
        return this.parseNVDResponse(data);
    }

    // Parse NVD API response
    parseNVDResponse(nvdData) {
        // Extract relevant fields from NVD API response
        const cve = nvdData.vulnerabilities?.[0]?.cve;
        if (!cve) return null;

        const metrics = cve.metrics?.cvssMetricV31?.[0] || cve.metrics?.cvssMetricV2?.[0];
        
        return {
            cveId: cve.id,
            description: cve.descriptions?.find(d => d.lang === 'en')?.value || '',
            cvssScore: metrics?.cvssData?.baseScore || 0,
            severity: metrics?.cvssData?.baseSeverity || 'UNKNOWN',
            publishedDate: cve.published,
            lastModifiedDate: cve.lastModified,
            references: cve.references?.map(r => ({
                url: r.url,
                source: r.source,
                tags: r.tags || []
            })) || [],
            patchAvailable: this.detectPatchAvailability(cve),
            mitreAttack: this.extractMITREAttack(cve),
            weaknesses: cve.weaknesses?.map(w => w.description?.[0]?.value) || []
        };
    }

    // Mock CVE data for testing (before DMZ is ready)
    async getMockCVEData(cveId) {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 100));

        // Return mock data based on CVE ID pattern
        const year = cveId.match(/CVE-(\d{4})/)?.[1] || '2024';
        const num = parseInt(cveId.match(/CVE-\d{4}-(\d+)/)?.[1] || '0');
        
        const severities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
        const severity = severities[num % 4];
        const score = severity === 'CRITICAL' ? 9.8 : severity === 'HIGH' ? 7.5 : severity === 'MEDIUM' ? 5.0 : 2.0;

        return {
            cveId,
            description: `Mock vulnerability description for ${cveId}. This is a ${severity.toLowerCase()} severity vulnerability affecting multiple systems.`,
            cvssScore: score,
            severity,
            publishedDate: `${year}-01-15T00:00:00.000Z`,
            lastModifiedDate: new Date().toISOString(),
            references: [
                { url: `https://nvd.nist.gov/vuln/detail/${cveId}`, source: 'NVD', tags: ['Vendor Advisory'] },
                { url: `https://cve.mitre.org/cgi-bin/cvename.cgi?name=${cveId}`, source: 'MITRE', tags: [] }
            ],
            patchAvailable: num % 3 === 0, // 1/3 have patches
            mitreAttack: num % 2 === 0 ? ['T1190', 'T1210'] : [], // Some have MITRE mappings
            weaknesses: ['CWE-79', 'CWE-89']
        };
    }

    // Detect patch availability from CVE references
    detectPatchAvailability(cve) {
        const patchKeywords = ['patch', 'update', 'hotfix', 'security update', 'advisory'];
        const references = cve.references || [];
        
        return references.some(ref => {
            const url = ref.url?.toLowerCase() || '';
            const tags = ref.tags?.map(t => t.toLowerCase()) || [];
            return patchKeywords.some(keyword => 
                url.includes(keyword) || tags.some(tag => tag.includes(keyword))
            );
        });
    }

    // Extract MITRE ATT&CK techniques from CVE data
    extractMITREAttack(cve) {
        // Look for MITRE ATT&CK references in CVE data
        const references = cve.references || [];
        const mitreRefs = references.filter(ref => 
            ref.url?.includes('attack.mitre.org') || 
            ref.source?.toLowerCase().includes('mitre')
        );

        const techniques = [];
        mitreRefs.forEach(ref => {
            const match = ref.url?.match(/T\d{4}(\.\d{3})?/g);
            if (match) {
                techniques.push(...match);
            }
        });

        return [...new Set(techniques)]; // Deduplicate
    }

    // Map vulnerability to NIST controls
    mapToNISTControls(poam) {
        if (!this.nistMapping) {
            return this.nistMapping?.defaultMapping || {
                controls: ['CM-6'],
                milestoneTemplate: 'CM',
                estimatedEffort: 'medium'
            };
        }

        // Analyze POAM title and description
        const text = `${poam.title} ${poam.findingDescription || poam.description || ''}`.toLowerCase();

        // Find matching vulnerability type
        for (const mapping of this.nistMapping.mappings) {
            const keywords = mapping.keywords || [];
            if (keywords.some(keyword => text.includes(keyword.toLowerCase()))) {
                return {
                    controls: mapping.controls,
                    controlFamily: mapping.controlFamily,
                    milestoneTemplate: mapping.milestoneTemplate,
                    estimatedEffort: mapping.estimatedEffort,
                    description: mapping.description
                };
            }
        }

        // Return default if no match
        return this.nistMapping.defaultMapping;
    }

    // Cache management
    getCachedData(key) {
        const cached = this.cache.get(key);
        if (!cached) return null;

        const now = Date.now();
        if (now - cached.timestamp > this.cacheExpiry) {
            this.cache.delete(key);
            return null;
        }

        return cached.data;
    }

    setCachedData(key, data) {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });

        // Persist to IndexedDB for longer-term caching
        this.persistToIndexedDB(key, data);
    }

    async persistToIndexedDB(key, data) {
        try {
            if (!window.poamDB?.db) return;

            const transaction = window.poamDB.db.transaction(['cveCache'], 'readwrite');
            const store = transaction.objectStore('cveCache');
            
            await store.put({
                cveId: key,
                data,
                timestamp: Date.now()
            });
        } catch (error) {
            // IndexedDB caching is optional, don't fail on error
            console.warn('Failed to persist CVE cache:', error);
        }
    }

    getAPIKey() {
        // Get API key from config or environment
        return localStorage.getItem('nvd_api_key') || '';
    }

    // Clear cache
    clearCache() {
        this.cache.clear();
        console.log('✅ CVE cache cleared');
    }

    // Get cache statistics
    getCacheStats() {
        return {
            size: this.cache.size,
            entries: Array.from(this.cache.keys())
        };
    }
}

// Initialize global instance
window.vulnerabilityIntelligence = new VulnerabilityIntelligence();

// Batch enrichment function
window.enrichPOAMsBatch = async function(poams) {
    if (!window.isFeatureEnabled('vulnerabilityIntelligence')) {
        return poams;
    }

    console.log(`🧠 Enriching ${poams.length} POAMs with intelligence data...`);
    
    const enriched = [];
    for (const poam of poams) {
        const enrichedPOAM = await window.vulnerabilityIntelligence.enrichPOAM(poam);
        enriched.push(enrichedPOAM);
    }

    console.log(`✅ Enriched ${enriched.length} POAMs`);
    return enriched;
};

console.log('✅ Vulnerability Intelligence Module Ready');
console.log('💡 Use window.vulnerabilityIntelligence.enrichPOAM(poam) to enrich POAMs');
console.log('💡 Use window.enrichPOAMsBatch(poams) for batch enrichment');
// Evidence Vault Functions with POAM Integration and Chain of Custody

// Initialize evidence vault when module loads
function loadEvidenceFiles() {
    console.log('Loading evidence vault...');
    
    // Set today's date as default
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('evidence-date').value = today;
    
    // Populate POAM dropdown
    populatePOAMDropdown();
    
    // Load and display existing evidence
    displayEvidenceRepository();
}

// Populate POAM list from Workbook — open POAMs only
async function populatePOAMDropdown() {
    const openPOAMs = [];

    try {
        if (window.poamWorkbookDB) {
            await window.poamWorkbookDB.init();
            const systems = await window.poamWorkbookDB.getSystems();
            for (const sys of (systems || [])) {
                const items = await window.poamWorkbookDB.getItemsBySystem(sys.id);
                (items || []).forEach(item => {
                    const status = (item['Status'] || 'Open').toLowerCase();
                    if (status === 'completed' || status === 'closed' || status === 'risk accepted') return;
                    const title = item['Vulnerability Name'] || 'Workbook item';
                    const itemNum = item['Item number'] || item.id;
                    const control = item['Impacted Security Controls'] || item['Control Family'] || '';
                    openPOAMs.push({
                        id: item.id,
                        itemNum,
                        text: `${itemNum} — ${title.substring(0, 70)} [${sys.name}]`,
                        title,
                        systemName: sys.name,
                        control,
                        status,
                        risk: item['Severity Value'] || 'Medium',
                        due: item['Scheduled Completion Date'] || 'N/A',
                        source: 'workbook'
                    });
                });
            }
        }
    } catch (e) { console.warn('populatePOAMDropdown: workbook load failed', e); }

    // Store flat list for typeahead search
    window._evidencePOAMList = openPOAMs;
    console.log(`Evidence POAM list: ${openPOAMs.length} open workbook POAMs loaded`);
}

// ── POAM Typeahead Search ──

function filterPOAMSearchResults(query) {
    const dropdown = document.getElementById('poam-search-dropdown');
    if (!dropdown) return;
    const list = window._evidencePOAMList || [];
    const q = (query || '').toLowerCase().trim();

    if (!q) {
        // Show all (max 20)
        renderPOAMSearchResults(list.slice(0, 20), dropdown);
        dropdown.style.display = 'block';
        return;
    }

    const matches = list.filter(p =>
        (p.itemNum || '').toLowerCase().includes(q) ||
        (p.control || '').toLowerCase().includes(q) ||
        (p.title || '').toLowerCase().includes(q) ||
        (p.systemName || '').toLowerCase().includes(q) ||
        (p.risk || '').toLowerCase().includes(q)
    ).slice(0, 15);

    renderPOAMSearchResults(matches, dropdown);
    dropdown.style.display = 'block';
}

function renderPOAMSearchResults(matches, dropdown) {
    if (matches.length === 0) {
        dropdown.innerHTML = '<div style="padding:14px 16px;font-size:12px;color:#6B7280;text-align:center">No matching POAMs found</div>';
        return;
    }

    const sevColor = { critical: '#991B1B', high: '#B45309', medium: '#0D7377', moderate: '#0D7377', low: '#6B7280' };
    const statusColor = { open: '#0D7377', 'in-progress': '#92400E', 'in progress': '#92400E', delayed: '#991B1B', extended: '#92400E', 'risk-accepted': '#374151', 'risk accepted': '#374151' };

    dropdown.innerHTML = matches.map(p => {
        const sColor = sevColor[(p.risk || '').toLowerCase()] || '#6B7280';
        const stColor = statusColor[(p.status || '').toLowerCase()] || '#0D7377';
        const ctrl = p.control ? escapeHtml(p.control) : '';
        const num = escapeHtml(p.itemNum || p.id);
        return `
            <div onclick="selectPOAMFromSearch('${p.id}', '${p.source}')"
                 style="padding:10px 14px;cursor:pointer;border-bottom:1px solid #F3F4F6;transition:background 0.1s"
                 onmouseover="this.style.background='#F9FAFB'" onmouseout="this.style.background=''">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px">
                    <span style="font-size:12px;font-weight:700;color:#111827;font-family:monospace">${num}</span>
                    ${ctrl ? `<span style="font-size:10px;font-weight:700;color:#0D7377;background:#E6F7F7;padding:1px 6px;border-radius:3px">${ctrl}</span>` : ''}
                    <span style="font-size:10px;font-weight:600;color:${sColor};text-transform:capitalize">${p.risk}</span>
                    <span style="font-size:10px;color:#6B7280;margin-left:auto">${escapeHtml(p.systemName || '')}</span>
                </div>
                <div style="font-size:12px;color:#374151;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(p.text.split('—').pop().trim().substring(0,80))}</div>
            </div>`;
    }).join('');
}

function showPOAMSearchDropdown() {
    const input = document.getElementById('evidence-poam-search');
    filterPOAMSearchResults(input ? input.value : '');
}

function selectPOAMFromSearch(poamId, source) {
    const hidden = document.getElementById('evidence-poam-select');
    const input = document.getElementById('evidence-poam-search');
    const dropdown = document.getElementById('poam-search-dropdown');
    const list = window._evidencePOAMList || [];

    if (hidden) hidden.value = poamId;
    const match = list.find(p => p.id === poamId);
    if (input && match) input.value = match.text;
    if (dropdown) dropdown.style.display = 'none';

    // Update the POAM info card
    updateSelectedPOAMInfoFromData(match);
}

function clearPOAMSelection() {
    const hidden = document.getElementById('evidence-poam-select');
    const input = document.getElementById('evidence-poam-search');
    const info = document.getElementById('selected-poam-info');
    if (hidden) hidden.value = '';
    if (input) input.value = '';
    if (info) info.style.display = 'none';
}

function updateSelectedPOAMInfoFromData(poam) {
    const infoDiv = document.getElementById('selected-poam-info');
    if (!infoDiv || !poam) { if (infoDiv) infoDiv.style.display = 'none'; return; }

    const idEl = document.getElementById('selected-poam-id');
    const statusEl = document.getElementById('selected-poam-status-badge');
    const descEl = document.getElementById('selected-poam-description');
    const riskEl = document.getElementById('selected-poam-risk');
    const dueEl = document.getElementById('selected-poam-due');

    if (idEl) idEl.textContent = poam.itemNum || poam.id;
    if (statusEl) statusEl.textContent = poam.status || 'open';
    if (descEl) descEl.textContent = (poam.title || '') + (poam.control ? ` [${poam.control}]` : '');
    if (riskEl) riskEl.textContent = poam.risk || 'medium';
    if (dueEl) dueEl.textContent = poam.due || 'N/A';

    infoDiv.style.display = 'block';
}

// Close dropdown when clicking outside
document.addEventListener('click', function(e) {
    const dropdown = document.getElementById('poam-search-dropdown');
    const input = document.getElementById('evidence-poam-search');
    if (dropdown && input && !input.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.style.display = 'none';
    }
});

// Legacy compat — old code may call updateSelectedPOAMInfo
function updateSelectedPOAMInfo() {
    const poamSelect = document.getElementById('evidence-poam-select');
    const infoDiv = document.getElementById('selected-poam-info');
    if (!poamSelect || !poamSelect.value) {
        if (infoDiv) infoDiv.style.display = 'none';
        return;
    }
    
    // Get POAM data
    const poamId = selectedOption.value;
    const poamData = JSON.parse(localStorage.getItem('poamData') || '{}');
    const poam = poamData[poamId];
    
    if (!poam) {
        infoDiv.style.display = 'none';
        return;
    }
    
    // Update info display
    document.getElementById('selected-poam-id').textContent = poamId;
    document.getElementById('selected-poam-description').textContent = poam.finding_description || 'No description available';
    document.getElementById('selected-poam-risk').textContent = (poam.risk_level || 'unknown').toUpperCase();
    document.getElementById('selected-poam-due').textContent = poam.scheduled_completion_date || 'Not set';
    
    // Update status badge
    const statusBadge = document.getElementById('selected-poam-status-badge');
    const status = poam.status || 'open';
    const statusColors = {
        'open': 'bg-red-100 text-red-700',
        'in_progress': 'bg-teal-50 text-teal-800',
        'completed': 'bg-slate-100 text-slate-600',
        'overdue': 'bg-amber-50 text-amber-800',
        'risk-accepted': 'bg-slate-100 text-slate-700'
    };
    statusBadge.className = `px-2 py-1 rounded text-xs font-semibold ${statusColors[status] || 'bg-slate-100 text-slate-700'}`;
    statusBadge.textContent = status.replace('_', ' ').toUpperCase();
    
    infoDiv.style.display = 'block';
}

// clearPOAMSelection defined above in typeahead section

// Handle evidence file upload
function handleEvidenceUpload(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    // Validate required fields
    const poamId = document.getElementById('evidence-poam-select').value;
    const evidenceType = document.getElementById('evidence-type-select').value;
    const owner = document.getElementById('evidence-owner').value.trim();
    const submitter = document.getElementById('evidence-submitter').value.trim();
    const date = document.getElementById('evidence-date').value;
    const description = document.getElementById('evidence-description').value.trim();
    
    if (!poamId) {
        alert('Please select a POAM to link this evidence to.');
        event.target.value = '';
        return;
    }
    
    if (!evidenceType) {
        alert('Please select an evidence category.');
        event.target.value = '';
        return;
    }
    
    if (!owner || !submitter || !date || !description) {
        alert('Please fill in all required fields:\n- Artifact Owner\n- Submitted By\n- Submission Date\n- Evidence Description');
        event.target.value = '';
        return;
    }
    
    // Show file preview
    displaySelectedFiles(files);
    
    // Process and save evidence
    saveEvidenceFiles(files);
}

// Display selected files preview
function displaySelectedFiles(files) {
    const preview = document.getElementById('selected-files-preview');
    const filesList = document.getElementById('selected-files-list');
    
    filesList.innerHTML = '';
    
    Array.from(files).forEach((file, index) => {
        const fileItem = document.createElement('div');
        fileItem.className = 'flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200';
        fileItem.innerHTML = `
            <div class="flex items-center gap-3">
                <i class="${getFileIcon(file.name)} text-xl"></i>
                <div>
                    <p class="text-sm font-medium text-slate-800">${file.name}</p>
                    <p class="text-xs text-slate-500">${(file.size / 1024).toFixed(1)} KB</p>
                </div>
            </div>
            <span class="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-semibold">Ready</span>
        `;
        filesList.appendChild(fileItem);
    });
    
    preview.style.display = 'block';
}

// Save evidence files to localStorage
function saveEvidenceFiles(files) {
    const poamId = document.getElementById('evidence-poam-select').value;
    const evidenceType = document.getElementById('evidence-type-select').value;
    const owner = document.getElementById('evidence-owner').value.trim();
    const submitter = document.getElementById('evidence-submitter').value.trim();
    const date = document.getElementById('evidence-date').value;
    const description = document.getElementById('evidence-description').value.trim();
    const email = document.getElementById('evidence-email').value.trim();
    const autoClose = document.getElementById('evidence-auto-close').checked;
    let reference = document.getElementById('evidence-reference').value.trim();
    
    // Generate reference ID if not provided
    if (!reference) {
        const evidenceData = JSON.parse(localStorage.getItem('evidenceVault') || '{}');
        const count = Object.keys(evidenceData).length + 1;
        reference = `EV-${new Date().getFullYear()}-${String(count).padStart(4, '0')}`;
    }
    
    // Get existing evidence vault
    const evidenceVault = JSON.parse(localStorage.getItem('evidenceVault') || '{}');
    
    // Process each file
    Array.from(files).forEach((file, index) => {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            const evidenceId = `${reference}-${index + 1}`;
            
            // Create evidence record
            const evidenceRecord = {
                id: evidenceId,
                linkedPOAM: poamId,
                evidenceType: evidenceType,
                filename: file.name,
                fileSize: file.size,
                fileData: e.target.result, // Base64 encoded file
                owner: owner,
                submitter: submitter,
                submissionDate: date,
                uploadDate: new Date().toISOString(),
                description: description,
                email: email,
                reference: reference,
                autoClose: autoClose
            };
            
            // Save to evidence vault
            evidenceVault[evidenceId] = evidenceRecord;
            localStorage.setItem('evidenceVault', JSON.stringify(evidenceVault));

            // Audit log: evidence uploaded
            if (typeof auditEvidenceUpload === 'function') {
                auditEvidenceUpload(poamId, file.name);
            }

            // Link evidence to the POAM in IndexedDB
            linkEvidenceToPOAM(poamId, evidenceId);

            // If this is the last file, trigger auto-close if enabled
            if (index === files.length - 1) {
                if (autoClose) {
                    closePOAMWithEvidence(poamId, evidenceId);
                }

                // Show success message
                showEvidenceUploadSuccess(files.length, poamId, autoClose);
                
                // Reset form
                resetEvidenceForm();
                
                // Refresh evidence display
                displayEvidenceRepository();
            }
        };
        
        reader.readAsDataURL(file);
    });
}

// Auto-close POAM when evidence is submitted — updates the correct IndexedDB store
async function closePOAMWithEvidence(poamId, evidenceId) {
    const now = new Date().toISOString();
    let closed = false;

    // Try findings store (poamDB) first
    try {
        if (typeof poamDB !== 'undefined' && poamDB) {
            if (!poamDB.db) await poamDB.init();
            const poam = await poamDB.getPOAM(poamId);
            if (poam) {
                const prevStatus = poam.findingStatus || poam.status || 'open';
                poam.findingStatus = 'completed';
                poam.status = 'completed';
                poam.actualCompletionDate = now.split('T')[0];
                poam.closureEvidence = evidenceId;
                poam.autoClosed = true;
                poam.lastModifiedDate = now;
                if (!poam.evidenceLinks) poam.evidenceLinks = [];
                poam.evidenceLinks.push({ evidenceId, linkedDate: now });
                await poamDB.savePOAM(poam);
                closed = true;
                // Audit log
                if (typeof auditStatusChange === 'function') {
                    auditStatusChange(poamId, prevStatus, 'completed');
                }
                console.log(`Finding ${poamId} auto-closed with evidence ${evidenceId}`);
            }
        }
    } catch (e) { console.warn('closePOAMWithEvidence: findings update failed', e); }

    // Try workbook store (poamWorkbookDB) if not found in findings
    if (!closed) {
        try {
            if (window.poamWorkbookDB) {
                await window.poamWorkbookDB.init();
                const item = await window.poamWorkbookDB.getItem(poamId);
                if (item) {
                    const prevStatus = item['Status'] || 'Open';
                    item['Status'] = 'Completed';
                    item['Actual Completion Date'] = now.split('T')[0];
                    item['closure_evidence'] = evidenceId;
                    item.updatedAt = now;
                    if (!item.evidenceLinks) item.evidenceLinks = [];
                    item.evidenceLinks.push({ evidenceId, linkedDate: now });
                    await window.poamWorkbookDB.saveItem(item);
                    closed = true;
                    if (typeof auditStatusChange === 'function') {
                        auditStatusChange(poamId, prevStatus, 'Completed');
                    }
                    console.log(`Workbook POAM ${poamId} auto-closed with evidence ${evidenceId}`);
                }
            }
        } catch (e) { console.warn('closePOAMWithEvidence: workbook update failed', e); }
    }

    // Refresh displays
    if (closed) {
        if (typeof displayVulnerabilityPOAMs === 'function') displayVulnerabilityPOAMs();
        if (typeof renderWorkbookOverview === 'function') renderWorkbookOverview();
    }
}

// Link evidence to POAM in IndexedDB (bidirectional)
async function linkEvidenceToPOAM(poamId, evidenceId) {
    const now = new Date().toISOString();
    // Try findings DB
    try {
        if (typeof poamDB !== 'undefined' && poamDB) {
            if (!poamDB.db) await poamDB.init();
            const poam = await poamDB.getPOAM(poamId);
            if (poam) {
                if (!poam.evidenceLinks) poam.evidenceLinks = [];
                if (!poam.evidenceLinks.some(l => l.evidenceId === evidenceId)) {
                    poam.evidenceLinks.push({ evidenceId, linkedDate: now });
                    poam.lastModifiedDate = now;
                    await poamDB.savePOAM(poam);
                }
                return;
            }
        }
    } catch (e) { /* try workbook next */ }
    // Try workbook DB
    try {
        if (window.poamWorkbookDB) {
            await window.poamWorkbookDB.init();
            const item = await window.poamWorkbookDB.getItem(poamId);
            if (item) {
                if (!item.evidenceLinks) item.evidenceLinks = [];
                if (!item.evidenceLinks.some(l => l.evidenceId === evidenceId)) {
                    item.evidenceLinks.push({ evidenceId, linkedDate: now });
                    item.updatedAt = now;
                    await window.poamWorkbookDB.saveItem(item);
                }
            }
        }
    } catch (e) { console.warn('linkEvidenceToPOAM failed:', e); }
}

// Update POAM table row status
function updatePOAMTableRow(poamId) {
    const tableBody = document.getElementById('poam-table-body');
    if (!tableBody) return;
    
    const rows = tableBody.querySelectorAll('tr');
    rows.forEach(row => {
        const idCell = row.cells[0];
        if (idCell && idCell.textContent.trim() === poamId) {
            // Update status cell (index 7)
            const statusCell = row.cells[7];
            if (statusCell) {
                statusCell.innerHTML = '<span class="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-semibold">Completed</span>';
            }
        }
    });
}

// Show success message
function showEvidenceUploadSuccess(fileCount, poamId, autoClosed) {
    let message = `✅ Successfully uploaded ${fileCount} evidence file(s) for POAM ${poamId}`;
    
    if (autoClosed) {
        message += `\n\n🎉 POAM ${poamId} has been automatically marked as COMPLETED!`;
    }
    
    alert(message);
}

// Reset evidence form
function resetEvidenceForm() {
    document.getElementById('evidence-poam-select').value = '';
    var searchInput = document.getElementById('evidence-poam-search');
    if (searchInput) searchInput.value = '';
    document.getElementById('evidence-type-select').value = '';
    document.getElementById('evidence-owner').value = '';
    document.getElementById('evidence-submitter').value = '';
    document.getElementById('evidence-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('evidence-reference').value = '';
    document.getElementById('evidence-email').value = '';
    document.getElementById('evidence-description').value = '';
    document.getElementById('evidence-auto-close').checked = true;
    document.getElementById('evidence-file-upload').value = '';
    document.getElementById('selected-files-preview').style.display = 'none';
    document.getElementById('selected-poam-info').style.display = 'none';
}

// Display evidence repository
function displayEvidenceRepository() {
    const evidenceList = document.getElementById('evidence-list');
    if (!evidenceList) return;
    
    const evidenceVault = JSON.parse(localStorage.getItem('evidenceVault') || '{}');
    const evidenceArray = Object.values(evidenceVault).filter(e => !e.deleted);

    if (evidenceArray.length === 0) {
        evidenceList.innerHTML = `
            <div class="text-center py-12 text-slate-400">
                <i class="fas fa-folder-open text-5xl mb-4"></i>
                <p class="text-lg font-medium">No evidence uploaded yet</p>
                <p class="text-sm mt-1">Upload evidence files to link them to POAMs</p>
            </div>
        `;
        return;
    }
    
    // Sort by upload date (newest first)
    evidenceArray.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));
    
    evidenceList.innerHTML = evidenceArray.map(evidence => {
        const fileIcon = getFileIcon(evidence.filename);
        const uploadDate = new Date(evidence.uploadDate).toLocaleString();
        const submissionDate = new Date(evidence.submissionDate).toLocaleDateString();
        
        return `
            <div class="border border-slate-200 rounded-lg p-4 hover:bg-slate-50 transition-colors evidence-item" data-poam="${evidence.linkedPOAM}" data-type="${evidence.evidenceType}">
                <div class="flex items-start justify-between">
                    <div class="flex items-start gap-4 flex-1">
                        <i class="${fileIcon} text-3xl"></i>
                        <div class="flex-1">
                            <div class="flex items-center gap-2 mb-2">
                                <h4 class="font-semibold text-slate-800">${evidence.filename}</h4>
                                <span class="px-2 py-1 bg-teal-50 text-teal-800 rounded text-xs font-semibold">
                                    <i class="fas fa-link mr-1"></i>${evidence.linkedPOAM}
                                </span>
                                <span class="px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs font-semibold">
                                    ${evidence.evidenceType}
                                </span>
                            </div>
                            <p class="text-sm text-slate-600 mb-3">${evidence.description}</p>
                            <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-slate-500">
                                <div>
                                    <i class="fas fa-user text-slate-400 mr-1"></i>
                                    <strong>Owner:</strong> ${evidence.owner}
                                </div>
                                <div>
                                    <i class="fas fa-upload text-slate-400 mr-1"></i>
                                    <strong>Submitted By:</strong> ${evidence.submitter}
                                </div>
                                <div>
                                    <i class="fas fa-calendar text-slate-400 mr-1"></i>
                                    <strong>Submitted:</strong> ${submissionDate}
                                </div>
                                <div>
                                    <i class="fas fa-tag text-slate-400 mr-1"></i>
                                    <strong>Ref:</strong> ${evidence.reference}
                                </div>
                            </div>
                            ${evidence.email ? `<div class="text-xs text-slate-500 mt-2"><i class="fas fa-envelope text-slate-400 mr-1"></i>${evidence.email}</div>` : ''}
                        </div>
                    </div>
                    <div class="flex flex-col gap-2 ml-4">
                        <button onclick="viewEvidenceDetails('${evidence.id}')" class="px-3 py-1 text-sm bg-teal-50 text-teal-800 rounded-lg hover:bg-teal-50 transition-colors">
                            <i class="fas fa-eye mr-1"></i>View
                        </button>
                        <button onclick="downloadEvidence('${evidence.id}')" class="px-3 py-1 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors">
                            <i class="fas fa-download mr-1"></i>Download
                        </button>
                        <button onclick="deleteEvidence('${evidence.id}')" class="px-3 py-1 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors">
                            <i class="fas fa-trash mr-1"></i>Delete
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Filter evidence
function filterEvidence(filterType) {
    const evidenceItems = document.querySelectorAll('.evidence-item');
    
    evidenceItems.forEach(item => {
        const hasLinkedPOAM = item.dataset.poam && item.dataset.poam !== '';
        
        if (filterType === 'all') {
            item.style.display = 'block';
        } else if (filterType === 'linked' && hasLinkedPOAM) {
            item.style.display = 'block';
        } else if (filterType === 'unlinked' && !hasLinkedPOAM) {
            item.style.display = 'block';
        } else {
            item.style.display = 'none';
        }
    });
}

// Search evidence
function searchEvidence() {
    const searchTerm = document.getElementById('evidence-search').value.toLowerCase();
    const evidenceItems = document.querySelectorAll('.evidence-item');
    
    evidenceItems.forEach(item => {
        const text = item.textContent.toLowerCase();
        item.style.display = text.includes(searchTerm) ? 'block' : 'none';
    });
}

// Sort evidence
function sortEvidence() {
    const sortBy = document.getElementById('evidence-sort').value;
    const evidenceList = document.getElementById('evidence-list');
    const evidenceVault = JSON.parse(localStorage.getItem('evidenceVault') || '{}');
    let evidenceArray = Object.values(evidenceVault);
    
    switch(sortBy) {
        case 'date-desc':
            evidenceArray.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));
            break;
        case 'date-asc':
            evidenceArray.sort((a, b) => new Date(a.uploadDate) - new Date(b.uploadDate));
            break;
        case 'poam':
            evidenceArray.sort((a, b) => a.linkedPOAM.localeCompare(b.linkedPOAM));
            break;
        case 'type':
            evidenceArray.sort((a, b) => a.evidenceType.localeCompare(b.evidenceType));
            break;
    }
    
    // Re-render the list
    displayEvidenceRepository();
}

// View evidence details
function viewEvidenceDetails(evidenceId) {
    const evidenceVault = JSON.parse(localStorage.getItem('evidenceVault') || '{}');
    const evidence = evidenceVault[evidenceId];
    
    if (!evidence) {
        alert('Evidence not found');
        return;
    }
    
    // Get linked POAM data
    const poamData = JSON.parse(localStorage.getItem('poamData') || '{}');
    const linkedPOAM = poamData[evidence.linkedPOAM];
    
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
        <div class="bg-white rounded-2xl p-8 max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold text-slate-900">Evidence Details</h2>
                <button onclick="this.closest('.fixed').remove()" class="text-slate-400 hover:text-slate-600">
                    <i class="fas fa-times text-xl"></i>
                </button>
            </div>
            
            <div class="space-y-6">
                <!-- File Information -->
                <div class="bg-slate-50 rounded-lg p-4">
                    <h3 class="font-semibold text-slate-800 mb-3">File Information</h3>
                    <div class="grid grid-cols-2 gap-3 text-sm">
                        <div><strong>Filename:</strong> ${evidence.filename}</div>
                        <div><strong>Size:</strong> ${(evidence.fileSize / 1024).toFixed(1)} KB</div>
                        <div><strong>Category:</strong> ${evidence.evidenceType}</div>
                        <div><strong>Reference:</strong> ${evidence.reference}</div>
                    </div>
                </div>
                
                <!-- Linked POAM -->
                <div class="bg-teal-50 rounded-lg p-4">
                    <h3 class="font-semibold text-slate-800 mb-3">Linked POAM</h3>
                    <div class="text-sm">
                        <div class="mb-2"><strong>POAM ID:</strong> <span class="px-2 py-1 bg-teal-50 text-teal-800 rounded text-xs font-semibold">${evidence.linkedPOAM}</span></div>
                        ${linkedPOAM ? `
                            <div class="mb-2"><strong>Description:</strong> ${linkedPOAM.finding_description || 'N/A'}</div>
                            <div class="mb-2"><strong>Status:</strong> ${linkedPOAM.status || 'N/A'}</div>
                            <div><strong>Risk Level:</strong> ${linkedPOAM.risk_level || 'N/A'}</div>
                        ` : '<p class="text-slate-500">POAM details not available</p>'}
                    </div>
                </div>
                
                <!-- Chain of Custody -->
                <div class="bg-green-50 rounded-lg p-4">
                    <h3 class="font-semibold text-slate-800 mb-3">Chain of Custody</h3>
                    <div class="grid grid-cols-2 gap-3 text-sm">
                        <div><strong>Artifact Owner:</strong> ${evidence.owner}</div>
                        <div><strong>Submitted By:</strong> ${evidence.submitter}</div>
                        <div><strong>Submission Date:</strong> ${new Date(evidence.submissionDate).toLocaleDateString()}</div>
                        <div><strong>Upload Date:</strong> ${new Date(evidence.uploadDate).toLocaleString()}</div>
                        ${evidence.email ? `<div class="col-span-2"><strong>Contact:</strong> ${evidence.email}</div>` : ''}
                    </div>
                </div>
                
                <!-- Description -->
                <div class="bg-slate-50 rounded-lg p-4">
                    <h3 class="font-semibold text-slate-800 mb-3">Evidence Description</h3>
                    <p class="text-sm text-slate-600">${evidence.description}</p>
                </div>
                
                ${evidence.autoClose ? `
                <div class="bg-green-50 rounded-lg p-4 border border-green-200">
                    <p class="text-sm text-green-800"><i class="fas fa-check-circle text-green-600 mr-2"></i>This evidence triggered automatic POAM closure</p>
                </div>
                ` : ''}
            </div>
            
            <div class="mt-6 flex justify-end gap-3">
                <button onclick="downloadEvidence('${evidenceId}')" class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                    <i class="fas fa-download mr-2"></i>Download
                </button>
                <button onclick="this.closest('.fixed').remove()" class="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300">
                    Close
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// Download evidence
function downloadEvidence(evidenceId) {
    const evidenceVault = JSON.parse(localStorage.getItem('evidenceVault') || '{}');
    const evidence = evidenceVault[evidenceId];
    
    if (!evidence) {
        alert('Evidence not found');
        return;
    }
    
    // Create download link
    const link = document.createElement('a');
    link.href = evidence.fileData;
    link.download = evidence.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Delete evidence
function deleteEvidence(evidenceId) {
    if (!confirm('Are you sure you want to delete this evidence? This will archive the record but retain the audit trail.')) {
        return;
    }

    const evidenceVault = JSON.parse(localStorage.getItem('evidenceVault') || '{}');
    const evidence = evidenceVault[evidenceId];

    if (evidence) {
        // Soft-delete: mark as archived, remove file data but keep metadata
        evidence.deleted = true;
        evidence.deletedAt = new Date().toISOString();
        evidence.deletedBy = 'Current User';
        delete evidence.fileData; // free storage but keep the record
        evidenceVault[evidenceId] = evidence;

        // Audit log
        if (typeof recordAuditEvent === 'function') {
            recordAuditEvent({
                type: 'evidence_deleted',
                action: `Evidence archived: ${evidenceId}`,
                details: `File: ${evidence.filename || 'unknown'}, linked to POAM: ${evidence.linkedPOAM || 'none'}`,
                metadata: { evidenceId, poamId: evidence.linkedPOAM, filename: evidence.filename }
            });
        }
    } else {
        delete evidenceVault[evidenceId];
    }

    localStorage.setItem('evidenceVault', JSON.stringify(evidenceVault));
    displayEvidenceRepository();
    showUpdateFeedback('Evidence archived successfully', 'success');
}

// Get file icon based on filename
function getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    
    const iconMap = {
        'pdf': 'fas fa-file-pdf text-red-500',
        'doc': 'fas fa-file-word text-blue-500',
        'docx': 'fas fa-file-word text-blue-500',
        'xls': 'fas fa-file-excel text-green-500',
        'xlsx': 'fas fa-file-excel text-green-500',
        'ppt': 'fas fa-file-powerpoint text-orange-500',
        'pptx': 'fas fa-file-powerpoint text-orange-500',
        'jpg': 'fas fa-file-image text-slate-700',
        'jpeg': 'fas fa-file-image text-slate-700',
        'png': 'fas fa-file-image text-slate-700',
        'gif': 'fas fa-file-image text-slate-700',
        'txt': 'fas fa-file-alt text-slate-500',
        'csv': 'fas fa-file-csv text-green-600',
        'zip': 'fas fa-file-archive text-yellow-600',
        'rar': 'fas fa-file-archive text-yellow-600'
    };
    
    return iconMap[ext] || 'fas fa-file text-slate-500';
}

// ═══════════════════════════════════════════════════════════════
// EVIDENCE LIFECYCLE TEST SEEDER
// Exercises the full POAM lifecycle: creates evidence, links to
// real POAMs, transitions statuses, and builds an audit trail.
// Idempotent — skips if evidence already exists.
// ═══════════════════════════════════════════════════════════════

async function seedTestEvidence(options = {}) {
    const force = options.force === true;
    const vault = JSON.parse(localStorage.getItem('evidenceVault') || '{}');
    const activeRecords = Object.values(vault).filter(e => !e.deleted);
    if (activeRecords.length > 0 && !force) {
        console.log('[evidence-seeder] Evidence already exists. Use {force:true} to re-seed.');
        return { skipped: true, count: activeRecords.length };
    }

    // Gather open POAMs from Workbook only
    const poams = [];

    try {
        if (window.poamWorkbookDB) {
            await window.poamWorkbookDB.init();
            const systems = await window.poamWorkbookDB.getSystems();
            for (const sys of (systems || [])) {
                const items = await window.poamWorkbookDB.getItemsBySystem(sys.id);
                (items || []).forEach(item => {
                    const st = (item['Status'] || 'Open').toLowerCase();
                    if (st === 'completed' || st === 'closed' || st === 'risk accepted') return;
                    poams.push({
                        id: item.id,
                        title: item['Vulnerability Name'] || 'Workbook POAM',
                        itemNum: item['Item number'] || item.id,
                        systemName: sys.name,
                        status: st,
                        risk: item['Severity Value'] || 'Medium',
                        source: 'workbook',
                        ref: item
                    });
                });
            }
        }
    } catch (e) { console.warn('[evidence-seeder] workbook load:', e.message); }

    if (poams.length === 0) {
        console.warn('[evidence-seeder] No open POAMs found to link evidence to.');
        return { error: 'no_poams' };
    }

    console.log(`[evidence-seeder] Found ${poams.length} open POAMs. Seeding evidence...`);

    // Evidence templates — realistic remediation artifacts
    const evidenceTemplates = [
        {
            type: 'remediation',
            filename: 'patch-deployment-report.pdf',
            owner: 'J. Martinez — Systems Engineering',
            submitter: 'K. Davis — Security Operations',
            description: 'Patch deployment verification report showing successful application of critical security patches across all in-scope servers. Includes pre/post scan comparison.',
            fileSize: 245760
        },
        {
            type: 'validation',
            filename: 'nessus-rescan-validation.csv',
            owner: 'Security Operations Center',
            submitter: 'A. Patel — Vulnerability Management',
            description: 'Post-remediation Nessus rescan results confirming vulnerability is no longer detected on target hosts. Scan date matches remediation window.',
            fileSize: 183200
        },
        {
            type: 'screenshot',
            filename: 'gpo-mfa-enforcement-screenshot.png',
            owner: 'Identity Services Team',
            submitter: 'S. Okafor — IAM Lead',
            description: 'Screenshot of Group Policy Object showing MFA enforcement enabled for all VPN authentication paths. No password-only fallback permitted.',
            fileSize: 524288
        },
        {
            type: 'remediation',
            filename: 'stig-compliance-scan-results.xlsx',
            owner: 'Configuration Management Team',
            submitter: 'R. Chen — CM Analyst',
            description: 'STIG compliance scan results showing all 23 previously drifted servers now meeting approved baseline. Zero critical deviations.',
            fileSize: 412672
        },
        {
            type: 'validation',
            filename: 'firewall-rule-audit-report.pdf',
            owner: 'Network Security Team',
            submitter: 'T. Brown — Network Engineer',
            description: 'Firewall rule audit report documenting removal of 12 overly permissive rules. New deny-by-default policy verified by independent review.',
            fileSize: 198400
        },
        {
            type: 'remediation',
            filename: 'ids-signature-update-verification.txt',
            owner: 'SOC Watch Floor',
            submitter: 'M. Johnson — SOC Analyst',
            description: 'IDS signature database update confirmation showing current signatures as of today. Daily update pipeline restored and monitored.',
            fileSize: 12800
        },
        {
            type: 'screenshot',
            filename: 'account-lifecycle-automation.png',
            owner: 'IAM Operations',
            submitter: 'S. Okafor — IAM Lead',
            description: 'Screenshot of automated account lifecycle workflow showing 90-day inactivity disable rule active and processing. 3 dormant accounts auto-disabled this cycle.',
            fileSize: 389120
        },
        {
            type: 'validation',
            filename: 'mtls-service-mesh-config.yaml',
            owner: 'Platform Engineering',
            submitter: 'L. Park — DevSecOps',
            description: 'Service mesh configuration showing mTLS enforced for all internal microservice communications. Certificate rotation set to 24h automatic.',
            fileSize: 8192
        }
    ];

    const newVault = force ? {} : { ...vault };
    const now = new Date();
    let created = 0;
    let closed = 0;

    // Pick up to 8 POAMs for evidence, prioritize variety
    const picks = poams.slice(0, Math.min(8, poams.length));

    for (let i = 0; i < picks.length; i++) {
        const poam = picks[i];
        const tmpl = evidenceTemplates[i % evidenceTemplates.length];
        const daysAgo = Math.floor(Math.random() * 14) + 1;
        const uploadDate = new Date(now.getTime() - daysAgo * 86400000);
        const refId = `EV-${uploadDate.getFullYear()}-${String(uploadDate.getMonth()+1).padStart(2,'0')}-${String(created+1).padStart(3,'0')}`;
        const evidenceId = `${refId}-1`;

        const record = {
            id: evidenceId,
            linkedPOAM: poam.id,
            evidenceType: tmpl.type,
            filename: tmpl.filename,
            fileSize: tmpl.fileSize,
            fileData: null, // No actual file data for seeds — just metadata
            owner: tmpl.owner,
            submitter: tmpl.submitter,
            submissionDate: uploadDate.toISOString().split('T')[0],
            uploadDate: uploadDate.toISOString(),
            description: tmpl.description,
            email: tmpl.submitter.split('—')[0].trim().toLowerCase().replace(/\s/g, '.').replace(/[^a-z.]/g, '') + '@agency.gov',
            reference: refId,
            autoClose: false,
            chainOfCustody: {
                submitted: { by: tmpl.submitter, date: uploadDate.toISOString().split('T')[0], timestamp: uploadDate.toISOString() },
                processed: { by: 'TRACE System', date: uploadDate.toISOString().split('T')[0], timestamp: uploadDate.toISOString() },
                verified: i < 4, // First 4 are verified
                verificationDate: i < 4 ? new Date(uploadDate.getTime() + 86400000).toISOString().split('T')[0] : null,
                verifiedBy: i < 4 ? 'ISSM — J. Lee' : null
            }
        };

        newVault[evidenceId] = record;
        created++;

        // Audit log: evidence upload
        if (typeof auditEvidenceUpload === 'function') {
            auditEvidenceUpload(poam.id, tmpl.filename);
        }

        // Link evidence to POAM in IndexedDB
        await linkEvidenceToPOAM(poam.id, evidenceId);

        // Close first 3 POAMs with evidence (full lifecycle demo)
        if (i < 3) {
            await closePOAMWithEvidence(poam.id, evidenceId);
            closed++;
            console.log(`[evidence-seeder] CLOSED: ${poam.id} — "${poam.title.substring(0,50)}" with ${tmpl.filename}`);
        } else {
            // For the rest: transition to 'in-progress' if currently 'open'
            if (poam.status === 'open' && window.poamWorkbookDB) {
                try {
                    const item = await window.poamWorkbookDB.getItem(poam.id);
                    if (item) {
                        const prev = item['Status'] || 'Open';
                        item['Status'] = 'In Progress';
                        item.updatedAt = new Date().toISOString();
                        await window.poamWorkbookDB.saveItem(item);
                        if (typeof auditStatusChange === 'function') auditStatusChange(poam.id, prev, 'In Progress');
                    }
                } catch (e) { /* non-critical */ }
            }
            console.log(`[evidence-seeder] LINKED: ${poam.id} — evidence attached, status in-progress`);
        }
    }

    // Save all evidence to localStorage
    localStorage.setItem('evidenceVault', JSON.stringify(newVault));

    // Refresh evidence display
    if (typeof displayEvidenceRepository === 'function') displayEvidenceRepository();
    if (typeof populatePOAMDropdown === 'function') populatePOAMDropdown();

    const summary = `Seeded ${created} evidence records, closed ${closed} POAMs, ${created - closed} in-progress with evidence attached`;
    console.log(`[evidence-seeder] ${summary}`);

    return { created, closed, inProgress: created - closed, total: created };
}

// Expose globally
window.seedTestEvidence = seedTestEvidence;
