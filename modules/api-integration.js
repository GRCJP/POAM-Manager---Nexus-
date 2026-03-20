// ═══════════════════════════════════════════════════════════════
// API INTEGRATION MODULE
// Handles scheduled scan imports via API connections
// ═══════════════════════════════════════════════════════════════

class APIIntegrationManager {
    constructor() {
        this.db = null;
        this.activeConnections = new Map();
        this.scheduledJobs = new Map();
    }

    async init() {
        if (!window.poamDB || !window.poamDB.db) {
            if (window.poamDB) {
                await window.poamDB.init();
            } else {
                throw new Error('POAMDatabase not available');
            }
        }
        this.db = window.poamDB;
        
        // Load saved API connections
        await this.loadConnections();
        
        // Start scheduled jobs
        await this.startScheduledJobs();
    }

    // ═══════════════════════════════════════════════════════════════
    // API CONNECTION MANAGEMENT
    // ═══════════════════════════════════════════════════════════════

    async saveConnection(connection) {
        // Validate required fields
        if (!connection.id || !connection.name || !connection.type) {
            throw new Error('Connection must have id, name, and type');
        }

        // Encrypt API credentials before storage
        const encrypted = await this.encryptCredentials(connection.credentials);
        
        const connectionRecord = {
            id: connection.id,
            name: connection.name,
            type: connection.type, // 'tenable', 'qualys', 'rapid7', 'custom'
            baseUrl: connection.baseUrl,
            credentials: encrypted,
            schedule: connection.schedule || null, // cron expression or interval
            enabled: connection.enabled !== false,
            lastSync: connection.lastSync || null,
            lastSyncStatus: connection.lastSyncStatus || null,
            createdAt: connection.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // Store in IndexedDB
        return new Promise((resolve, reject) => {
            const tx = this.db.db.transaction(['apiConnections'], 'readwrite');
            const store = tx.objectStore('apiConnections');
            const request = store.put(connectionRecord);

            request.onsuccess = () => {
                console.log(`✅ API connection saved: ${connection.name}`);
                this.activeConnections.set(connection.id, connectionRecord);
                resolve(connectionRecord);
            };

            request.onerror = () => {
                console.error('Failed to save API connection:', request.error);
                reject(request.error);
            };
        });
    }

    async loadConnections() {
        return new Promise((resolve, reject) => {
            const tx = this.db.db.transaction(['apiConnections'], 'readonly');
            const store = tx.objectStore('apiConnections');
            const request = store.getAll();

            request.onsuccess = () => {
                const connections = request.result || [];
                connections.forEach(conn => {
                    this.activeConnections.set(conn.id, conn);
                });
                console.log(`📡 Loaded ${connections.length} API connections`);
                resolve(connections);
            };

            request.onerror = () => {
                console.error('Failed to load API connections:', request.error);
                reject(request.error);
            };
        });
    }

    async deleteConnection(connectionId) {
        // Stop scheduled job if running
        if (this.scheduledJobs.has(connectionId)) {
            clearInterval(this.scheduledJobs.get(connectionId));
            this.scheduledJobs.delete(connectionId);
        }

        // Remove from IndexedDB
        return new Promise((resolve, reject) => {
            const tx = this.db.db.transaction(['apiConnections'], 'readwrite');
            const store = tx.objectStore('apiConnections');
            const request = store.delete(connectionId);

            request.onsuccess = () => {
                this.activeConnections.delete(connectionId);
                console.log(`✅ API connection deleted: ${connectionId}`);
                resolve();
            };

            request.onerror = () => {
                console.error('Failed to delete API connection:', request.error);
                reject(request.error);
            };
        });
    }

    // ═══════════════════════════════════════════════════════════════
    // CREDENTIAL ENCRYPTION (Basic - for production use proper encryption)
    // ═══════════════════════════════════════════════════════════════

    async encryptCredentials(credentials) {
        // For now, use base64 encoding
        // TODO: Implement proper encryption with Web Crypto API
        const jsonStr = JSON.stringify(credentials);
        return btoa(jsonStr);
    }

    async decryptCredentials(encrypted) {
        // For now, use base64 decoding
        // TODO: Implement proper decryption with Web Crypto API
        try {
            const jsonStr = atob(encrypted);
            return JSON.parse(jsonStr);
        } catch (e) {
            console.error('Failed to decrypt credentials:', e);
            return null;
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // SCHEDULED SYNC JOBS
    // ═══════════════════════════════════════════════════════════════

    async startScheduledJobs() {
        for (const [id, connection] of this.activeConnections) {
            if (connection.enabled && connection.schedule) {
                await this.scheduleSync(connection);
            }
        }
    }

    async scheduleSync(connection) {
        // Parse schedule (support interval in minutes for now)
        const intervalMinutes = this.parseSchedule(connection.schedule);
        
        if (!intervalMinutes) {
            console.warn(`Invalid schedule for ${connection.name}:`, connection.schedule);
            return;
        }

        // Clear existing job if any
        if (this.scheduledJobs.has(connection.id)) {
            clearInterval(this.scheduledJobs.get(connection.id));
        }

        // Schedule new job
        const intervalMs = intervalMinutes * 60 * 1000;
        const jobId = setInterval(async () => {
            console.log(`🔄 Running scheduled sync for ${connection.name}`);
            await this.syncConnection(connection.id);
        }, intervalMs);

        this.scheduledJobs.set(connection.id, jobId);
        console.log(`⏰ Scheduled sync for ${connection.name} every ${intervalMinutes} minutes`);
    }

    parseSchedule(schedule) {
        // Support formats: "30m", "1h", "daily", "hourly"
        if (!schedule) return null;

        const s = schedule.toLowerCase().trim();
        
        if (s.endsWith('m')) {
            return parseInt(s);
        }
        if (s.endsWith('h')) {
            return parseInt(s) * 60;
        }
        if (s === 'hourly') return 60;
        if (s === 'daily') return 1440;
        
        // Default: treat as minutes
        const num = parseInt(s);
        return isNaN(num) ? null : num;
    }

    // ═══════════════════════════════════════════════════════════════
    // SYNC EXECUTION
    // ═══════════════════════════════════════════════════════════════

    async syncConnection(connectionId, manual = false) {
        const connection = this.activeConnections.get(connectionId);
        if (!connection) {
            throw new Error(`Connection not found: ${connectionId}`);
        }

        console.log(`📡 Starting sync for ${connection.name} (${manual ? 'manual' : 'scheduled'})`);

        try {
            // Decrypt credentials
            const credentials = await this.decryptCredentials(connection.credentials);
            if (!credentials) {
                throw new Error('Failed to decrypt credentials');
            }

            // Fetch scan data based on connection type
            const scanData = await this.fetchScanData(connection, credentials);
            
            if (!scanData || !scanData.vulnerabilities || scanData.vulnerabilities.length === 0) {
                console.warn(`No vulnerabilities found for ${connection.name}`);
                await this.updateConnectionStatus(connectionId, 'success', 'No new vulnerabilities');
                return { success: true, vulnerabilities: 0 };
            }

            // Process through pipeline (same as CSV import)
            const result = await this.processScanDataThroughPipeline(scanData, connection);

            // Update connection status
            await this.updateConnectionStatus(connectionId, 'success', `Imported ${result.poamsCreated} POAMs`);

            // Trigger activity monitor refresh
            if (typeof window.refreshPOAMActivity === 'function') {
                await window.refreshPOAMActivity();
            }

            console.log(`✅ Sync complete for ${connection.name}: ${result.poamsCreated} POAMs created`);
            
            return result;

        } catch (error) {
            console.error(`❌ Sync failed for ${connection.name}:`, error);
            await this.updateConnectionStatus(connectionId, 'error', error.message);
            throw error;
        }
    }

    async updateConnectionStatus(connectionId, status, message) {
        const connection = this.activeConnections.get(connectionId);
        if (!connection) return;

        connection.lastSync = new Date().toISOString();
        connection.lastSyncStatus = { status, message, timestamp: connection.lastSync };
        connection.updatedAt = new Date().toISOString();

        await this.saveConnection(connection);
    }

    // ═══════════════════════════════════════════════════════════════
    // SCAN DATA FETCHING (Adapter Pattern)
    // ═══════════════════════════════════════════════════════════════

    async fetchScanData(connection, credentials) {
        switch (connection.type) {
            case 'tenable':
                return await this.fetchTenableData(connection, credentials);
            case 'qualys':
                return await this.fetchQualysData(connection, credentials);
            case 'rapid7':
                return await this.fetchRapid7Data(connection, credentials);
            case 'custom':
                return await this.fetchCustomData(connection, credentials);
            default:
                throw new Error(`Unsupported connection type: ${connection.type}`);
        }
    }

    async fetchTenableData(connection, credentials) {
        // Tenable.io API integration
        const baseUrl = connection.baseUrl || 'https://cloud.tenable.com';
        const headers = {
            'X-ApiKeys': `accessKey=${credentials.accessKey}; secretKey=${credentials.secretKey}`,
            'Content-Type': 'application/json'
        };

        try {
            // Fetch recent vulnerabilities
            const response = await fetch(`${baseUrl}/workbenches/vulnerabilities`, {
                method: 'GET',
                headers: headers
            });

            if (!response.ok) {
                throw new Error(`Tenable API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            
            // Transform Tenable format to our normalized format
            return this.transformTenableData(data);

        } catch (error) {
            console.error('Tenable API fetch failed:', error);
            throw error;
        }
    }

    async fetchQualysData(connection, credentials) {
        // Qualys API integration
        const baseUrl = connection.baseUrl || 'https://qualysapi.qualys.com';
        const auth = btoa(`${credentials.username}:${credentials.password}`);
        
        const headers = {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json'
        };

        try {
            // Fetch vulnerability list
            const response = await fetch(`${baseUrl}/api/2.0/fo/asset/host/vm/detection/`, {
                method: 'POST',
                headers: headers,
                body: 'action=list&status=New,Active,Re-Opened&output_format=json'
            });

            if (!response.ok) {
                throw new Error(`Qualys API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            
            // Transform Qualys format to our normalized format
            return this.transformQualysData(data);

        } catch (error) {
            console.error('Qualys API fetch failed:', error);
            throw error;
        }
    }

    async fetchRapid7Data(connection, credentials) {
        // Rapid7 InsightVM API integration
        const baseUrl = connection.baseUrl || 'https://us.api.insight.rapid7.com';
        
        const headers = {
            'X-Api-Key': credentials.apiKey,
            'Content-Type': 'application/json'
        };

        try {
            // Fetch vulnerabilities
            const response = await fetch(`${baseUrl}/vm/v4/vulnerabilities`, {
                method: 'GET',
                headers: headers
            });

            if (!response.ok) {
                throw new Error(`Rapid7 API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            
            // Transform Rapid7 format to our normalized format
            return this.transformRapid7Data(data);

        } catch (error) {
            console.error('Rapid7 API fetch failed:', error);
            throw error;
        }
    }

    async fetchCustomData(connection, credentials) {
        // Custom API endpoint
        const headers = {
            'Authorization': `Bearer ${credentials.token}`,
            'Content-Type': 'application/json'
        };

        try {
            const response = await fetch(connection.baseUrl, {
                method: 'GET',
                headers: headers
            });

            if (!response.ok) {
                throw new Error(`Custom API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            
            // Assume custom API returns data in our normalized format
            return data;

        } catch (error) {
            console.error('Custom API fetch failed:', error);
            throw error;
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // DATA TRANSFORMATION (Normalize to our format)
    // ═══════════════════════════════════════════════════════════════

    transformTenableData(data) {
        // Transform Tenable vulnerability data to our normalized format
        const vulnerabilities = [];
        
        if (data.vulnerabilities) {
            data.vulnerabilities.forEach(vuln => {
                vulnerabilities.push({
                    title: vuln.plugin_name,
                    severity: this.mapTenableSeverity(vuln.severity),
                    cve: vuln.cve || [],
                    host: vuln.asset?.hostname || vuln.asset?.ipv4 || 'Unknown',
                    ipv4: vuln.asset?.ipv4 || '',
                    port: vuln.port || '',
                    protocol: vuln.protocol || '',
                    firstDetected: vuln.first_found || new Date().toISOString(),
                    lastDetected: vuln.last_found || new Date().toISOString(),
                    status: vuln.state === 'FIXED' ? 'fixed' : 'active',
                    solution: vuln.solution || '',
                    description: vuln.description || '',
                    pluginId: vuln.plugin_id,
                    operatingSystem: vuln.asset?.operating_system || 'Unknown'
                });
            });
        }

        return {
            source: 'Tenable.io API',
            scanType: 'Tenable',
            vulnerabilities
        };
    }

    transformQualysData(data) {
        // Transform Qualys vulnerability data to our normalized format
        const vulnerabilities = [];
        
        if (data.HOST_LIST && data.HOST_LIST.HOST) {
            const hosts = Array.isArray(data.HOST_LIST.HOST) ? data.HOST_LIST.HOST : [data.HOST_LIST.HOST];
            
            hosts.forEach(host => {
                if (host.DETECTION_LIST && host.DETECTION_LIST.DETECTION) {
                    const detections = Array.isArray(host.DETECTION_LIST.DETECTION) 
                        ? host.DETECTION_LIST.DETECTION 
                        : [host.DETECTION_LIST.DETECTION];
                    
                    detections.forEach(detection => {
                        vulnerabilities.push({
                            title: detection.RESULTS || `QID ${detection.QID}`,
                            severity: this.mapQualysSeverity(detection.SEVERITY),
                            qid: detection.QID,
                            host: host.DNS || host.IP || 'Unknown',
                            ipv4: host.IP || '',
                            port: detection.PORT || '',
                            protocol: detection.PROTOCOL || '',
                            firstDetected: detection.FIRST_FOUND_DATETIME || new Date().toISOString(),
                            lastDetected: detection.LAST_FOUND_DATETIME || new Date().toISOString(),
                            status: detection.STATUS === 'Fixed' ? 'fixed' : 'active',
                            solution: detection.SOLUTION || '',
                            description: detection.RESULTS || '',
                            operatingSystem: host.OPERATING_SYSTEM || 'Unknown'
                        });
                    });
                }
            });
        }

        return {
            source: 'Qualys API',
            scanType: 'Qualys',
            vulnerabilities
        };
    }

    transformRapid7Data(data) {
        // Transform Rapid7 vulnerability data to our normalized format
        const vulnerabilities = [];
        
        if (data.resources) {
            data.resources.forEach(vuln => {
                vulnerabilities.push({
                    title: vuln.title,
                    severity: this.mapRapid7Severity(vuln.severity),
                    cve: vuln.cves || [],
                    host: vuln.assets?.[0]?.hostname || vuln.assets?.[0]?.ip || 'Unknown',
                    ipv4: vuln.assets?.[0]?.ip || '',
                    firstDetected: vuln.added || new Date().toISOString(),
                    lastDetected: vuln.modified || new Date().toISOString(),
                    status: vuln.status === 'remediated' ? 'fixed' : 'active',
                    solution: vuln.solution || '',
                    description: vuln.description || '',
                    operatingSystem: vuln.assets?.[0]?.os || 'Unknown'
                });
            });
        }

        return {
            source: 'Rapid7 InsightVM API',
            scanType: 'Rapid7',
            vulnerabilities
        };
    }

    // Severity mapping helpers
    mapTenableSeverity(severity) {
        const map = { 4: 'critical', 3: 'high', 2: 'medium', 1: 'low', 0: 'info' };
        return map[severity] || 'medium';
    }

    mapQualysSeverity(severity) {
        if (severity >= 4) return 'critical';
        if (severity === 3) return 'high';
        if (severity === 2) return 'medium';
        return 'low';
    }

    mapRapid7Severity(severity) {
        const s = (severity || '').toLowerCase();
        if (s === 'critical' || s === 'severe') return 'critical';
        if (s === 'high') return 'high';
        if (s === 'moderate' || s === 'medium') return 'medium';
        return 'low';
    }

    // ═══════════════════════════════════════════════════════════════
    // PIPELINE INTEGRATION
    // ═══════════════════════════════════════════════════════════════

    async processScanDataThroughPipeline(scanData, connection) {
        // Use the same pipeline as CSV imports
        if (typeof PipelineOrchestrator === 'undefined') {
            throw new Error('PipelineOrchestrator not available');
        }

        const scanMetadata = {
            scanId: `API-${connection.type}-${Date.now()}`,
            source: scanData.source || `${connection.name} API`,
            fileName: `API Import - ${connection.name}`,
            scanType: scanData.scanType || connection.type,
            connectionId: connection.id,
            isAPIImport: true
        };

        const pipeline = new PipelineOrchestrator();
        
        // Run through same pipeline as manual uploads
        const result = await pipeline.runImportPipeline(
            scanData.vulnerabilities,
            scanMetadata,
            (progress) => {
                // Optional: emit progress events for UI
                console.log(`Pipeline progress: ${Math.round(progress.overallProgress * 100)}%`);
            }
        );

        return result;
    }
}

// Export globally
window.APIIntegrationManager = APIIntegrationManager;
window.apiIntegrationManager = new APIIntegrationManager();
