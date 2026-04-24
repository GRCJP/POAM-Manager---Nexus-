console.log('📦 poam-database.js loading...');

// ═══════════════════════════════════════════════════════════════
// POAM DATABASE - ENHANCED FOR FORMAL POAM REPORTING
// ═══════════════════════════════════════════════════════════════

class POAMDatabase {
    constructor() {
        this.dbName = 'POAMDatabase';
        this.version = 13;
        this.db = null;
    }

    hasStore(storeName) {
        return !!(this.db && this.db.objectStoreNames && this.db.objectStoreNames.contains(storeName));
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                this.db.onversionchange = () => {
                    try {
                        this.db.close();
                    } catch (e) {
                        // ignore
                    }
                };
                resolve();
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                const oldVersion = event.oldVersion;
                
                console.log(`🔄 Upgrading database from version ${oldVersion} to ${db.version}`);
                
                // Create poams object store
                if (!db.objectStoreNames.contains('poams')) {
                    console.log('📦 Creating poams object store');
                    const poamStore = db.createObjectStore('poams', { keyPath: 'id' });
                    poamStore.createIndex('systemId', 'systemId', { unique: false });
                    poamStore.createIndex('findingStatus', 'findingStatus', { unique: false });
                    poamStore.createIndex('riskLevel', 'riskLevel', { unique: false });
                    poamStore.createIndex('status', 'status', { unique: false });
                    poamStore.createIndex('risk', 'risk', { unique: false });
                } else {
                    try {
                        const poamStore = event.target.transaction.objectStore('poams');
                        if (!poamStore.indexNames.contains('status')) {
                            poamStore.createIndex('status', 'status', { unique: false });
                        }
                        if (!poamStore.indexNames.contains('risk')) {
                            poamStore.createIndex('risk', 'risk', { unique: false });
                        }
                    } catch (e) {
                        // ignore
                    }
                }
                
                // Create scans object store
                if (!db.objectStoreNames.contains('scans')) {
                    console.log('📦 Creating scans object store');
                    const scanStore = db.createObjectStore('scans', { keyPath: 'id' });
                    scanStore.createIndex('timestamp', 'timestamp', { unique: false });
                    scanStore.createIndex('scanType', 'scanType', { unique: false });
                }

                // Create scanRuns object store (compat with code paths that use scanRuns)
                if (!db.objectStoreNames.contains('scanRuns')) {
                    console.log('📦 Creating scanRuns object store');
                    const scanRunStore = db.createObjectStore('scanRuns', { keyPath: 'id' });
                    scanRunStore.createIndex('timestamp', 'timestamp', { unique: false });
                    scanRunStore.createIndex('scanType', 'scanType', { unique: false });
                }
                
                // Create systems object store
                if (!db.objectStoreNames.contains('systems')) {
                    console.log('📦 Creating systems object store');
                    const systemStore = db.createObjectStore('systems', { keyPath: 'id' });
                    systemStore.createIndex('name', 'name', { unique: false });
                }

                // Create milestones object store
                if (!db.objectStoreNames.contains('milestones')) {
                    console.log('📦 Creating milestones object store');
                    const milestoneStore = db.createObjectStore('milestones', { keyPath: 'id', autoIncrement: true });
                    milestoneStore.createIndex('poamId', 'poamId', { unique: false });
                }

                // Create comments object store
                if (!db.objectStoreNames.contains('comments')) {
                    console.log('📦 Creating comments object store');
                    const commentStore = db.createObjectStore('comments', { keyPath: 'id', autoIncrement: true });
                    commentStore.createIndex('poamId', 'poamId', { unique: false });
                }

                // Create poamScanSummaries object store
                if (!db.objectStoreNames.contains('poamScanSummaries')) {
                    console.log('📦 Creating poamScanSummaries object store');
                    const summaryStore = db.createObjectStore('poamScanSummaries', { keyPath: 'id' });
                    summaryStore.createIndex('poamId', 'poamId', { unique: false });
                    summaryStore.createIndex('scanId', 'scanId', { unique: false });
                    summaryStore.createIndex('poamScanId', ['poamId', 'scanId'], { unique: true });
                }
                
                // Create phaseArtifacts object store for pipeline state management
                if (!db.objectStoreNames.contains('phaseArtifacts')) {
                    console.log('📦 Creating phaseArtifacts object store');
                    const artifactStore = db.createObjectStore('phaseArtifacts', { keyPath: 'id' });
                    artifactStore.createIndex('runId', 'runId', { unique: false });
                    artifactStore.createIndex('phaseIndex', 'phaseIndex', { unique: false });
                }

                // Create reports object store for executive report snapshots
                if (!db.objectStoreNames.contains('reports')) {
                    console.log('📦 Creating reports object store');
                    const reportStore = db.createObjectStore('reports', { keyPath: 'id' });
                    reportStore.createIndex('type', 'type', { unique: false });
                    reportStore.createIndex('generatedAt', 'generatedAt', { unique: false });
                }

                // Create criticalAssets object store for asset prioritization
                if (!db.objectStoreNames.contains('criticalAssets')) {
                    console.log('📦 Creating criticalAssets object store');
                    const caStore = db.createObjectStore('criticalAssets', { keyPath: 'id' });
                    caStore.createIndex('name', 'name', { unique: false });
                    caStore.createIndex('ip', 'ip', { unique: false });
                }
                
                // Create notificationQueue object store for AI assistant notifications
                if (!db.objectStoreNames.contains('notificationQueue')) {
                    console.log('📦 Creating notificationQueue object store');
                    const notifStore = db.createObjectStore('notificationQueue', { keyPath: 'id' });
                    notifStore.createIndex('poamId', 'poamId', { unique: false });
                    notifStore.createIndex('pocTeam', 'pocTeam', { unique: false });
                    notifStore.createIndex('notificationStatus', 'notificationStatus', { unique: false });
                    notifStore.createIndex('batchId', 'batchId', { unique: false });
                }
                
                // Create feedbackResponses object store for user acknowledgments
                if (!db.objectStoreNames.contains('feedbackResponses')) {
                    console.log('📦 Creating feedbackResponses object store');
                    const feedbackStore = db.createObjectStore('feedbackResponses', { keyPath: 'id' });
                    feedbackStore.createIndex('poamId', 'poamId', { unique: false });
                    feedbackStore.createIndex('status', 'status', { unique: false });
                    feedbackStore.createIndex('submittedAt', 'submittedAt', { unique: false });
                }
                
                // Create cveCache object store for vulnerability intelligence
                if (!db.objectStoreNames.contains('cveCache')) {
                    console.log('📦 Creating cveCache object store');
                    const cveStore = db.createObjectStore('cveCache', { keyPath: 'cveId' });
                    cveStore.createIndex('timestamp', 'timestamp', { unique: false });
                }
                
                // Create apiConnections object store for API integrations
                if (!db.objectStoreNames.contains('apiConnections')) {
                    console.log('📦 Creating apiConnections object store');
                    const apiStore = db.createObjectStore('apiConnections', { keyPath: 'id' });
                    apiStore.createIndex('type', 'type', { unique: false });
                    apiStore.createIndex('enabled', 'enabled', { unique: false });
                    apiStore.createIndex('lastSync', 'lastSync', { unique: false });
                }
                
                // Create scopes object store for import scope management
                if (!db.objectStoreNames.contains('scopes')) {
                    console.log('📦 Creating scopes object store');
                    const scopeStore = db.createObjectStore('scopes', { keyPath: 'id' });
                    scopeStore.createIndex('displayName', 'displayName', { unique: false });
                    scopeStore.createIndex('autoCreated', 'autoCreated', { unique: false });
                }

                // Add scopeId index to poams store if not present
                if (db.objectStoreNames.contains('poams')) {
                    try {
                        const poamStore = event.currentTarget.transaction.objectStore('poams');
                        if (!poamStore.indexNames.contains('scopeId')) {
                            poamStore.createIndex('scopeId', 'scopeId', { unique: false });
                        }
                    } catch (e) {
                        console.warn('📦 Could not add scopeId index (non-fatal):', e.message);
                    }
                }

                console.log('✅ Database upgrade complete');
            };
        });
    }

    async addPOAMsBatch(poams) {
        if (!this.db) {
            await this.init();
        }

        console.log('📦 addPOAMsBatch: Starting with', poams.length, 'POAMs');

        // ── Step 1: Clear the poams store ──
        // Pipeline already cleared non-essential stores. Clear poams here
        // so we write fresh data.
        if (this.db.objectStoreNames.contains('poams')) {
            await new Promise((resolve) => {
                const tx = this.db.transaction(['poams'], 'readwrite');
                tx.objectStore('poams').clear();
                tx.oncomplete = () => { console.log('📦 poams store cleared'); resolve(); };
                tx.onerror = () => resolve();
                tx.onabort = () => resolve();
            });
        }

        // Check available storage
        let availMB = Infinity;
        if (navigator.storage && navigator.storage.estimate) {
            const estimate = await navigator.storage.estimate();
            const usedMB = (estimate.usage / (1024 * 1024)).toFixed(2);
            const quotaMB = (estimate.quota / (1024 * 1024)).toFixed(2);
            availMB = (estimate.quota - estimate.usage) / (1024 * 1024);
            console.log(`📦 STORAGE: Used ${usedMB}MB / ${quotaMB}MB (${availMB.toFixed(2)}MB available)`);
        }

        // Request persistent storage
        try {
            if (navigator.storage && navigator.storage.persist) {
                await navigator.storage.persist();
            }
        } catch (e) {}

        // ── Step 2: Transform and measure ──
        const formalPOAMs = poams.map(poam => this.transformToFormalPOAM(poam));
        let totalBytes = formalPOAMs.reduce((sum, p) => sum + JSON.stringify(p).length, 0);
        const totalMB = totalBytes / (1024 * 1024);
        console.log(`📦 STORAGE: Total POAM data: ${totalMB.toFixed(2)}MB for ${formalPOAMs.length} POAMs (avg ${(totalBytes/formalPOAMs.length/1024).toFixed(1)}KB each)`);

        // ── Step 3: Always trim to fit — target max 50% of available quota ──
        const targetMB = Math.min(availMB * 0.5, 20); // never exceed 20MB
        if (totalMB > targetMB || totalMB > 2) {
            console.warn(`📦 Trimming POAM data (${totalMB.toFixed(1)}MB > target ${targetMB.toFixed(1)}MB)`);
            for (const p of formalPOAMs) {
                // Cap asset detail array but preserve the true count
                if (Array.isArray(p.affectedAssets) && p.affectedAssets.length > 50) {
                    p.totalAffectedAssets = p.totalAffectedAssets || p.affectedAssets.length;
                    p.assetCount = p.totalAffectedAssets;
                    p.affectedAssets = p.affectedAssets.slice(0, 50);
                }
                // Truncate text fields aggressively
                for (const field of ['findingDescription', 'description', 'mitigation', 'notes']) {
                    if (p[field] && p[field].length > 300) {
                        p[field] = p[field].substring(0, 300) + '...';
                    }
                }
                // Cap history and milestones
                if (Array.isArray(p.statusHistory) && p.statusHistory.length > 10) {
                    p.statusHistory = p.statusHistory.slice(-10);
                }
                if (Array.isArray(p.milestones) && p.milestones.length > 5) {
                    p.milestones = p.milestones.slice(0, 5);
                }
                // Remove CVE/QID arrays if very long
                if (Array.isArray(p.cves) && p.cves.length > 10) p.cves = p.cves.slice(0, 10);
                if (Array.isArray(p.qids) && p.qids.length > 10) p.qids = p.qids.slice(0, 10);
            }
            totalBytes = formalPOAMs.reduce((sum, p) => sum + JSON.stringify(p).length, 0);
            console.log(`📦 STORAGE: After trim: ${(totalBytes/1024/1024).toFixed(2)}MB`);
        }

        // If still won't fit, drop all non-essential fields
        if (totalBytes / (1024 * 1024) > targetMB) {
            console.warn('📦 STORAGE CRITICAL: Dropping asset details and history');
            for (const p of formalPOAMs) {
                // Preserve counts before dropping arrays
                p.totalAffectedAssets = p.totalAffectedAssets || p.affectedAssets?.length || 0;
                p.assetCount = p.totalAffectedAssets;
                p.affectedAssets = [];
                p.milestones = [];
                p.statusHistory = [];
                p.cves = [];
                p.qids = [];
            }
            totalBytes = formalPOAMs.reduce((sum, p) => sum + JSON.stringify(p).length, 0);
            console.log(`📦 STORAGE: After aggressive trim: ${(totalBytes/1024/1024).toFixed(2)}MB`);
        }

        // ── Step 4: Write in chunks ──
        const writeChunks = async (poamsToWrite) => {
            const CHUNK_SIZE = 10;
            const chunks = [];
            for (let i = 0; i < poamsToWrite.length; i += CHUNK_SIZE) {
                chunks.push(poamsToWrite.slice(i, i + CHUNK_SIZE));
            }
            console.log(`📦 Writing ${chunks.length} chunks of ${CHUNK_SIZE} POAMs each`);

            let saved = 0;
            let errors = [];
            for (const chunk of chunks) {
                const result = await this.addPOAMsChunk(chunk);
                saved += result.saved;
                errors = errors.concat(result.errors);
            }
            return { saved, errors };
        };

        try {
            const result = await writeChunks(formalPOAMs);
            console.log(`✅ addPOAMsBatch: Complete - saved ${result.saved} POAMs, ${result.errors.length} errors`);
            return result;
        } catch (err) {
            if (!err.message || !err.message.includes('Quota')) throw err;

            // ── QuotaExceededError fallback: nuke DB and retry ──
            console.warn('📦 QuotaExceededError — deleting database and retrying...');
            try {
                this.db.close();
                this.db = null;
                await new Promise((resolve) => {
                    const delReq = indexedDB.deleteDatabase(this.dbName);
                    delReq.onsuccess = () => resolve();
                    delReq.onerror = () => resolve();
                    delReq.onblocked = () => resolve();
                });
                await new Promise(r => setTimeout(r, 200));
                await this.init();
                console.log('📦 Fresh database ready — retrying write');
                const result = await writeChunks(formalPOAMs);
                console.log(`✅ addPOAMsBatch: Complete (after retry) - saved ${result.saved} POAMs`);
                return result;
            } catch (retryErr) {
                console.error('📦 Retry also failed:', retryErr.message);
                throw retryErr;
            }
        }
    }

    async addPOAMsChunk(poams) {
        return new Promise((resolve, reject) => {
            const BATCH_TIMEOUT = 30000; // 30 second timeout
            let timeoutId;
            let completed = 0;
            let errors = [];
            let transactionComplete = false;

            // Create transaction for this chunk
            const transaction = this.db.transaction(['poams'], 'readwrite');
            const store = transaction.objectStore('poams');

            // Handle transaction completion
            transaction.oncomplete = () => {
                transactionComplete = true;
                clearTimeout(timeoutId);
                resolve({ saved: completed - errors.length, errors });
            };

            transaction.onerror = (e) => {
                console.error('📦 addPOAMsChunk: Transaction error:', e.target.error);
                clearTimeout(timeoutId);
                reject(new Error('Transaction failed: ' + e.target.error?.message));
            };

            transaction.onabort = (e) => {
                console.error('📦 addPOAMsChunk: Transaction aborted:', e.target.error);
                clearTimeout(timeoutId);
                reject(new Error('Transaction aborted: ' + e.target.error?.message));
            };

            // Timeout protection
            timeoutId = setTimeout(() => {
                if (!transactionComplete) {
                    console.error('📦 addPOAMsChunk: TIMEOUT after', BATCH_TIMEOUT, 'ms');
                    try {
                        transaction.abort();
                    } catch (e) {
                        // ignore abort errors
                    }
                    reject(new Error(`Chunk save timeout - only ${completed} of ${poams.length} completed`));
                }
            }, BATCH_TIMEOUT);

            // Process each POAM in this chunk
            poams.forEach((poam) => {
                try {
                    const request = store.put(poam);
                    
                    request.onsuccess = () => {
                        completed++;
                    };
                    
                    request.onerror = (e) => {
                        console.error(`📦 addPOAMsChunk: Error saving POAM ${poam.id}:`, e.target.error);
                        errors.push({ poam: poam.id, error: e.target.error?.message });
                        completed++;
                    };
                } catch (err) {
                    console.error(`📦 addPOAMsChunk: Exception for POAM ${poam.id}:`, err);
                    errors.push({ poam: poam.id, error: err.message });
                    completed++;
                }
            });
        });
    }

    transformToFormalPOAM(poam) {
        // EXPLICIT field selection — truncate text fields to prevent storage bloat
        const cap = (val, max) => { const s = val || ''; return s.length > max ? s.substring(0, max) + '...' : s; };

        const vulnName = cap(poam.vulnerabilityName || poam.title || poam.vulnerability, 500);
        const desc = cap(poam.findingDescription || poam.description || '', 2000);
        const mitig = cap(poam.mitigation || '', 2000);

        return {
            id: poam.id,
            findingIdentifier: poam.findingIdentifier || poam.id,
            controlFamily: poam.controlFamily || this.inferControlFamily(poam),
            vulnerabilityName: vulnName,
            findingDescription: desc,
            findingSource: cap(poam.source || poam.findingSource || 'Vulnerability Scan', 200),
            source: cap(poam.source || poam.findingSource || 'Vulnerability Scan', 200),
            poc: poam.poc || poam.pocTeam || '',
            pocTeam: poam.pocTeam || poam.poc || '',
            resourcesRequired: poam.resourcesRequired || '',
            dueDate: poam.dueDate || poam.initialScheduledCompletionDate || this.calculateDueDate(poam),
            initialScheduledCompletionDate: poam.initialScheduledCompletionDate || poam.dueDate || this.calculateDueDate(poam),
            updatedScheduledCompletionDate: poam.updatedScheduledCompletionDate || poam.dueDate || this.calculateDueDate(poam),
            actualCompletionDate: poam.actualCompletionDate || null,
            findingStatus: poam.findingStatus || poam.status || 'Open',
            status: poam.status || poam.findingStatus || 'Open',
            riskLevel: poam.riskLevel || poam.risk || 'medium',
            risk: poam.risk || poam.riskLevel || 'medium',
            mitigation: mitig,
            createdDate: poam.createdDate || new Date().toISOString(),
            lastModifiedDate: poam.lastModifiedDate || new Date().toISOString(),
            scanId: poam.scanId || null,
            needsReview: poam.needsReview || false,
            notes: cap(poam.notes || '', 1000),
            title: vulnName,
            description: desc,
            cves: Array.isArray(poam.cves) ? poam.cves.slice(0, 20) : [],
            qids: Array.isArray(poam.qids) ? poam.qids.slice(0, 20) : [],
            remediationSignature: poam.remediationSignature || '',
            patchable: poam.patchable || false,
            confidenceScore: poam.confidenceScore || 0,
            isPriority: poam.isPriority || false,
            affectedAssets: Array.isArray(poam.affectedAssets) ? this.transformAssetsWithMetadata(poam.affectedAssets) : [],
            totalAffectedAssets: poam.totalAffectedAssets || poam.affectedAssets?.length || 0,
            milestones: Array.isArray(poam.milestones) ? poam.milestones.slice(0, 10) : [],
            statusHistory: Array.isArray(poam.statusHistory) ? poam.statusHistory.slice(-50) : [],
            lastScanDate: poam.lastScanDate || null,
            // Promotion tracking
            promotedToWorkbook: poam.promotedToWorkbook || false,
            promotedDate: poam.promotedDate || null,
            promotedSystemId: poam.promotedSystemId || null,
            promotedWorkbookItemId: poam.promotedWorkbookItemId || null,
            // Scope and tagging
            scopeId: poam.scopeId || null,
            scopeSource: poam.scopeSource || null,
            pcaCode: poam.pcaCode || '',
            wizTags: cap(poam.wizTags || '', 500),
            wizProjects: cap(poam.wizProjects || '', 200),
            subscriptionName: cap(poam.subscriptionName || '', 200),
            cloudPlatform: poam.cloudPlatform || '',
            assetRegion: poam.assetRegion || ''
        };
    }

    transformAssetsWithMetadata(assets) {
        // Store only essential asset identification — drop verbose results/evidence to save space
        // Cap at 100 sample assets per POAM — totalAffectedAssets preserves the real count
        const capped = assets.length > 100 ? assets.slice(0, 100) : assets;
        return capped.map(asset => ({
            id: asset.id || asset.assetId || asset.asset_id || asset.name || 'Unknown',
            name: asset.name || asset.assetName || asset.asset_name || asset.assetId || 'Unknown Asset',
            ipv4: asset.ipv4 || asset.ip || asset.asset_ipv4 || '',
            os: asset.os || asset.operatingSystem || 'Unknown',
            status: asset.status || 'affected',
            firstDetected: asset.firstDetected || asset.scanDate || new Date().toISOString().split('T')[0],
            lastDetected: asset.lastDetected || asset.scanDate || new Date().toISOString().split('T')[0]
        }));
    }

    inferControlFamily(poam) {
        const vulnerability = (poam.vulnerability || poam.title || '').toLowerCase();
        
        if (vulnerability.includes('access control') || vulnerability.includes('authentication')) return 'AC';
        if (vulnerability.includes('audit') || vulnerability.includes('logging')) return 'AU';
        if (vulnerability.includes('encryption') || vulnerability.includes('crypto')) return 'SC';
        if (vulnerability.includes('incident') || vulnerability.includes('response')) return 'IR';
        if (vulnerability.includes('identification') || vulnerability.includes('authentication')) return 'IA';
        if (vulnerability.includes('system') || vulnerability.includes('configuration')) return 'CM';
        if (vulnerability.includes('training') || vulnerability.includes('awareness')) return 'AT';
        if (vulnerability.includes('physical') || vulnerability.includes('environment')) return 'PE';
        
        return 'CM'; // Default to Configuration Management
    }

    calculateDueDate(poam) {
        const riskLevel = poam.riskLevel || poam.risk || 'medium';
        const days = {
            'critical': 15,
            'high': 30,
            'medium': 90,
            'low': 180
        };
        
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + (days[riskLevel] || 90));
        return dueDate.toISOString().split('T')[0];
    }

    async savePOAM(poam) {
        if (!this.db) {
            await this.init();
        }

        const transaction = this.db.transaction(['poams'], 'readwrite');
        const store = transaction.objectStore('poams');

        const formalPOAM = this.transformToFormalPOAM(poam);

        return new Promise((resolve, reject) => {
            const request = store.put(formalPOAM);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Batch save for performance (10-20x faster than individual saves)
    async savePOAMsBatch(poams) {
        if (!this.db) {
            await this.init();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['poams'], 'readwrite');
            const store = transaction.objectStore('poams');
            
            let completed = 0;
            const total = poams.length;
            
            for (const poam of poams) {
                const formalPOAM = this.transformToFormalPOAM(poam);
                const request = store.put(formalPOAM);
                
                request.onsuccess = () => {
                    completed++;
                    if (completed === total) {
                        resolve(completed);
                    }
                };
                
                request.onerror = () => {
                    reject(request.error);
                };
            }
            
            // Handle empty array case
            if (total === 0) {
                resolve(0);
            }
        });
    }

    async updatePOAM(id, updates) {
        if (!this.db) {
            await this.init();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['poams'], 'readwrite');
            const store = transaction.objectStore('poams');

            const getRequest = store.get(id);
            getRequest.onsuccess = () => {
                const poam = getRequest.result;
                if (!poam) {
                    reject(new Error(`POAM with ID ${id} not found`));
                    return;
                }

                // Merge updates and set last modified
                const updatedPoam = {
                    ...poam,
                    ...updates,
                    lastModifiedDate: new Date().toISOString()
                };

                const putRequest = store.put(updatedPoam);
                putRequest.onsuccess = () => resolve(putRequest.result);
                putRequest.onerror = () => reject(putRequest.error);
            };
            getRequest.onerror = () => reject(getRequest.error);
        });
    }

    async getPOAM(id) {
        if (!this.db) {
            await this.init();
        }

        const transaction = this.db.transaction(['poams'], 'readonly');
        const store = transaction.objectStore('poams');

        return new Promise((resolve, reject) => {
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getAllPOAMs() {
        if (!this.db) {
            await this.init();
        }

        console.log('📦 getAllPOAMs: Starting fetch...');

        return new Promise((resolve, reject) => {
            const FETCH_TIMEOUT = 10000; // 10 second timeout
            let timeoutId;
            let transactionComplete = false;

            try {
                const transaction = this.db.transaction(['poams'], 'readonly');
                const store = transaction.objectStore('poams');

                transaction.oncomplete = () => {
                    transactionComplete = true;
                    clearTimeout(timeoutId);
                };

                transaction.onerror = (e) => {
                    clearTimeout(timeoutId);
                    console.error('📦 getAllPOAMs: Transaction error:', e.target.error);
                    reject(new Error('Failed to fetch POAMs: ' + e.target.error?.message));
                };

                const request = store.getAll();
                
                request.onsuccess = () => {
                    clearTimeout(timeoutId);
                    console.log('📦 getAllPOAMs: Fetched', request.result.length, 'POAMs');
                    resolve(request.result);
                };
                
                request.onerror = (e) => {
                    clearTimeout(timeoutId);
                    console.error('📦 getAllPOAMs: Request error:', e.target.error);
                    reject(new Error('Failed to fetch POAMs: ' + e.target.error?.message));
                };

                // Timeout protection
                timeoutId = setTimeout(() => {
                    if (!transactionComplete) {
                        console.error('📦 getAllPOAMs: TIMEOUT after', FETCH_TIMEOUT, 'ms');
                        reject(new Error('Fetch POAMs timeout - database may be locked'));
                    }
                }, FETCH_TIMEOUT);

            } catch (err) {
                clearTimeout(timeoutId);
                console.error('📦 getAllPOAMs: Exception:', err);
                reject(new Error('Failed to fetch POAMs: ' + err.message));
            }
        });
    }

    async deletePOAM(id) {
        if (!this.db) {
            await this.init();
        }

        const transaction = this.db.transaction(['poams'], 'readwrite');
        const store = transaction.objectStore('poams');

        return new Promise((resolve, reject) => {
            const request = store.delete(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async clearAllPOAMs() {
        if (!this.db) {
            await this.init();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['poams'], 'readwrite');
            const objectStore = transaction.objectStore('poams');
            const request = objectStore.clear();

            request.onsuccess = () => {
                console.log('✅ All POAMs cleared from database');
                resolve();
            };

            request.onerror = () => {
                console.error('Failed to clear POAMs:', request.error);
                reject(request.error);
            };
        });
    }

    // ═══════════════════════════════════════════════════════════════
    // SYSTEM MANAGEMENT
    // ═══════════════════════════════════════════════════════════════

    async getSystems() {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['systems'], 'readonly');
            const store = transaction.objectStore('systems');
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }

    async addSystem(system) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['systems'], 'readwrite');
            const store = transaction.objectStore('systems');
            const request = store.put(system);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async deleteSystem(id) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['systems'], 'readwrite');
            const store = transaction.objectStore('systems');
            const request = store.delete(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // ═══════════════════════════════════════════════════════════════
    // CRITICAL ASSETS MANAGEMENT
    // ═══════════════════════════════════════════════════════════════

    async getCriticalAssets() {
        if (!this.db) await this.init();
        if (!this.hasStore('criticalAssets')) return [];
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['criticalAssets'], 'readonly');
            const store = tx.objectStore('criticalAssets');
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        });
    }

    async addCriticalAsset(asset) {
        if (!this.db) await this.init();
        if (!this.hasStore('criticalAssets')) throw new Error('criticalAssets store not available');
        const record = {
            id: asset.id || `ca-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
            name: asset.name || '',
            hostname: asset.hostname || asset.name || '',
            ip: asset.ip || '',
            tags: Array.isArray(asset.tags) ? asset.tags : [],
            notes: asset.notes || '',
            addedDate: asset.addedDate || new Date().toISOString(),
            addedBy: asset.addedBy || 'manual'
        };
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['criticalAssets'], 'readwrite');
            const store = tx.objectStore('criticalAssets');
            const req = store.put(record);
            req.onsuccess = () => resolve(record);
            req.onerror = () => reject(req.error);
        });
    }

    async updateCriticalAsset(asset) {
        return this.addCriticalAsset(asset);
    }

    async deleteCriticalAsset(id) {
        if (!this.db) await this.init();
        if (!this.hasStore('criticalAssets')) return;
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['criticalAssets'], 'readwrite');
            const store = tx.objectStore('criticalAssets');
            const req = store.delete(id);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }

    async countPOAMs() {
        if (!this.db) {
            await this.init();
        }
        
        const transaction = this.db.transaction(['poams'], 'readonly');
        const store = transaction.objectStore('poams');
        
        return new Promise((resolve, reject) => {
            const request = store.count();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getPOAMsByStatus(status) {
        if (!this.db) {
            await this.init();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['poams'], 'readonly');
            const objectStore = transaction.objectStore('poams');
            const index = objectStore.index('status');
            const request = index.getAll(status);

            request.onsuccess = () => {
                resolve(request.result || []);
            };

            request.onerror = () => {
                console.error('Failed to get POAMs by status:', request.error);
                reject(request.error);
            };
        });
    }

    async getPOAMsByRisk(riskLevel) {
        if (!this.db) {
            await this.init();
        }
        
        const transaction = this.db.transaction(['poams'], 'readonly');
        const store = transaction.objectStore('poams');
        const index = store.index('risk');
        
        return new Promise((resolve, reject) => {
            const request = index.getAll(riskLevel);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Milestone management
    async addMilestone(poamId, milestone) {
        if (!this.db) {
            await this.init();
        }

        if (!this.hasStore('milestones')) {
            console.warn('⚠️ milestones store missing; skipping milestone add');
            return null;
        }
        
        const transaction = this.db.transaction(['milestones'], 'readwrite');
        const store = transaction.objectStore('milestones');
        
        const milestoneData = {
            poamId: poamId,
            name: milestone.name,
            description: milestone.description || '',
            targetDate: milestone.targetDate,
            completed: milestone.completed || false,
            completionDate: milestone.completionDate || null,
            createdDate: new Date().toISOString(),
            changeLog: milestone.changeLog || []
        };
        
        return new Promise((resolve, reject) => {
            const request = store.add(milestoneData);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getMilestones(poamId) {
        if (!this.db) {
            await this.init();
        }

        if (!this.hasStore('milestones')) {
            console.warn('⚠️ milestones store missing; returning empty milestones');
            return [];
        }
        
        const transaction = this.db.transaction(['milestones'], 'readonly');
        const store = transaction.objectStore('milestones');
        const index = store.index('poamId');
        
        return new Promise((resolve, reject) => {
            const request = index.getAll(poamId);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async updateMilestone(milestoneId, updates) {
        if (!this.db) {
            await this.init();
        }

        if (!this.hasStore('milestones')) {
            console.warn('⚠️ milestones store missing; skipping milestone update');
            return null;
        }
        
        const transaction = this.db.transaction(['milestones'], 'readwrite');
        const store = transaction.objectStore('milestones');
        
        return new Promise((resolve, reject) => {
            const getRequest = store.get(milestoneId);
            getRequest.onsuccess = () => {
                const milestone = getRequest.result;
                if (milestone) {
                    // Add change log entry if target date is changing
                    if (updates.targetDate && updates.targetDate !== milestone.targetDate) {
                        const changeEntry = {
                            fieldName: 'targetDate',
                            oldValue: milestone.targetDate,
                            newValue: updates.targetDate,
                            changedDate: new Date().toISOString(),
                            changedBy: 'current_user' // Would come from auth
                        };
                        milestone.changeLog = milestone.changeLog || [];
                        milestone.changeLog.push(changeEntry);
                    }
                    
                    Object.assign(milestone, updates);
                    const updateRequest = store.put(milestone);
                    updateRequest.onsuccess = () => resolve(updateRequest.result);
                    updateRequest.onerror = () => reject(updateRequest.error);
                } else {
                    reject(new Error('Milestone not found'));
                }
            };
            getRequest.onerror = () => reject(getRequest.error);
        });
    }

    // Comment management
    async addComment(poamId, comment) {
        if (!this.db) {
            await this.init();
        }

        if (!this.hasStore('comments')) {
            console.warn('⚠️ comments store missing; skipping comment add');
            return null;
        }
        
        const transaction = this.db.transaction(['comments'], 'readwrite');
        const store = transaction.objectStore('comments');
        
        const commentData = {
            poamId: poamId,
            text: comment.text,
            author: comment.author || 'current_user', // Would come from auth
            timestamp: new Date().toISOString(),
            type: comment.type || 'general' // general, status_change, milestone_update
        };
        
        return new Promise((resolve, reject) => {
            const request = store.add(commentData);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getComments(poamId) {
        if (!this.db) {
            await this.init();
        }

        if (!this.hasStore('comments')) {
            console.warn('⚠️ comments store missing; returning empty comments');
            return [];
        }
        
        const transaction = this.db.transaction(['comments'], 'readonly');
        const store = transaction.objectStore('comments');
        const index = store.index('poamId');
        
        return new Promise((resolve, reject) => {
            const request = index.getAll(poamId);
            request.onsuccess = () => {
                const comments = request.result;
                // Sort by timestamp descending
                comments.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                resolve(comments);
            };
            request.onerror = () => reject(request.error);
        });
    }

    // ═══════════════════════════════════════════════════════════════
    // SCAN RUN MANAGEMENT
    // ═══════════════════════════════════════════════════════════════

    getScanRunStoreName() {
        if (!this.db) return 'scanRuns';
        if (this.db.objectStoreNames.contains('scanRuns')) return 'scanRuns';
        if (this.db.objectStoreNames.contains('scans')) return 'scans';
        return 'scanRuns';
    }

    async saveScanRun(scanRun) {
        if (!this.db) {
            await this.init();
        }

        const storeName = this.getScanRunStoreName();
        if (!this.db.objectStoreNames.contains(storeName)) {
            throw new Error(`Scan store '${storeName}' not found in IndexedDB`);
        }

        // Ensure record has both id and runId so it works regardless of store keyPath
        const record = { ...scanRun };
        if (record.id && !record.runId) record.runId = record.id;
        if (record.runId && !record.id) record.id = record.runId;

        const transaction = this.db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);

        return new Promise((resolve, reject) => {
            const request = store.put(record);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getScanRun(scanId) {
        if (!this.db) {
            await this.init();
        }

        const storeName = this.getScanRunStoreName();
        if (!this.db.objectStoreNames.contains(storeName)) {
            return null;
        }

        const transaction = this.db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        
        return new Promise((resolve, reject) => {
            const request = store.get(scanId);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getAllScanRuns() {
        if (!this.db) {
            await this.init();
        }

        const storeName = this.getScanRunStoreName();
        if (!this.db.objectStoreNames.contains(storeName)) {
            return [];
        }

        const transaction = this.db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => {
                const scanRuns = request.result;
                // Sort by importedAt descending
                scanRuns.sort((a, b) => new Date(b.importedAt) - new Date(a.importedAt));
                resolve(scanRuns);
            };
            request.onerror = () => reject(request.error);
        });
    }

    // ═══════════════════════════════════════════════════════════════
    // POAM SCAN SUMMARY MANAGEMENT
    // ═══════════════════════════════════════════════════════════════

    async savePoamScanSummary(summary) {
        if (!this.db) {
            await this.init();
        }
        
        const transaction = this.db.transaction(['poamScanSummaries'], 'readwrite');
        const store = transaction.objectStore('poamScanSummaries');
        
        return new Promise((resolve, reject) => {
            const request = store.put(summary);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getPoamScanSummary(poamId, scanId) {
        if (!this.db) {
            await this.init();
        }
        
        // Check if poamScanSummaries store exists
        if (!this.db.objectStoreNames.contains('poamScanSummaries')) {
            console.log('📸 poamScanSummaries store not found - database needs upgrade');
            return null;
        }
        
        try {
            const transaction = this.db.transaction(['poamScanSummaries'], 'readonly');
            const store = transaction.objectStore('poamScanSummaries');
            const index = store.index('poamScanId');
            
            return new Promise((resolve, reject) => {
                const request = index.get([poamId, scanId]);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.log('📸 Error accessing poamScanSummaries store:', error.message);
            return null;
        }
    }

    async getLatestPoamScanSummary(poamId) {
        if (!this.db) {
            await this.init();
        }
        
        // Check if poamScanSummaries store exists
        if (!this.db.objectStoreNames.contains('poamScanSummaries')) {
            console.log('📸 poamScanSummaries store not found - database needs upgrade');
            return null;
        }
        
        try {
            const transaction = this.db.transaction(['poamScanSummaries'], 'readonly');
            const store = transaction.objectStore('poamScanSummaries');
            const index = store.index('poamId');
            
            return new Promise((resolve, reject) => {
                const request = index.getAll(poamId);
                request.onsuccess = () => {
                    const summaries = request.result;
                    if (summaries.length === 0) {
                        resolve(null);
                        return;
                    }
                    // Get the latest summary by scanId (assuming scanIds are chronological)
                    const latest = summaries.sort((a, b) => b.scanId.localeCompare(a.scanId))[0];
                    resolve(latest);
                };
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.log('📸 Error accessing poamScanSummaries store:', error.message);
            return null;
        }
    }

    async getAllPoamScanSummariesForScan(scanId) {
        if (!this.db) {
            await this.init();
        }
        
        const transaction = this.db.transaction(['poamScanSummaries'], 'readonly');
        const store = transaction.objectStore('poamScanSummaries');
        const index = store.index('scanId');
        
        return new Promise((resolve, reject) => {
            const request = index.getAll(scanId);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    // ═══════════════════════════════════════════════════════════════
    // SCOPE MANAGEMENT
    // ═══════════════════════════════════════════════════════════════

    async getAllScopes() {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['scopes'], 'readonly');
            const store = tx.objectStore('scopes');
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }

    async getScope(scopeId) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['scopes'], 'readonly');
            const store = tx.objectStore('scopes');
            const request = store.get(scopeId);
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    }

    async saveScope(scope) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['scopes'], 'readwrite');
            const store = tx.objectStore('scopes');
            const request = store.put(scope);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async deleteScope(scopeId) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['scopes'], 'readwrite');
            const store = tx.objectStore('scopes');
            const request = store.delete(scopeId);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async getPOAMsByScope(scopeId) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['poams'], 'readonly');
            const store = tx.objectStore('poams');
            const allRequest = store.getAll();
            allRequest.onsuccess = () => {
                const results = (allRequest.result || []).filter(p => p.scopeId === scopeId);
                resolve(results);
            };
            allRequest.onerror = () => reject(allRequest.error);
        });
    }
}

// Initialize global database instance
const poamDB = new POAMDatabase();

// Expose to window object for global access
window.poamDB = poamDB;

console.log('📦 poamDB created:', poamDB);
console.log('📦 poamDB.getPOAM exists:', typeof poamDB.getPOAM);
console.log('📦 poamDB.getAllPOAMs exists:', typeof poamDB.getAllPOAMs);
console.log('📦 poamDB.savePOAM exists:', typeof poamDB.savePOAM);
console.log('📦 poamDB.countPOAMs exists:', typeof poamDB.countPOAMs);

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await poamDB.init();
        console.log('✅ POAM Database initialized successfully');
    } catch (error) {
        console.error('❌ Failed to initialize POAM Database:', error);
    }
});