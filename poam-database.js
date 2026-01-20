console.log('📦 poam-database.js loading...');

// ═══════════════════════════════════════════════════════════════
// POAM DATABASE - ENHANCED FOR FORMAL POAM REPORTING
// ═══════════════════════════════════════════════════════════════

class POAMDatabase {
    constructor() {
        this.dbName = 'POAMDatabase';
        this.version = 8;
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
                
                console.log('✅ Database upgrade complete');
            };
        });
    }

    async addPOAMsBatch(poams) {
        if (!this.db) {
            await this.init();
        }

        const transaction = this.db.transaction(['poams'], 'readwrite');
        const store = transaction.objectStore('poams');

        // Transform each POAM to formal structure
        const formalPOAMs = poams.map(poam => this.transformToFormalPOAM(poam));

        return new Promise((resolve, reject) => {
            let completed = 0;
            let errors = [];

            formalPOAMs.forEach(poam => {
                const request = store.put(poam);
                request.onsuccess = () => {
                    completed++;
                    if (completed === formalPOAMs.length) {
                        if (errors.length > 0) {
                            console.warn('⚠️ Some POAMs failed to save:', errors);
                        }
                        console.log(`✅ Saved ${completed - errors.length} POAMs to database`);
                        resolve({ saved: completed - errors.length, errors });
                    }
                };
                request.onerror = () => {
                    errors.push({ poam: poam.id, error: request.error });
                    completed++;
                    if (completed === formalPOAMs.length) {
                        console.warn('⚠️ Some POAMs failed to save:', errors);
                        resolve({ saved: completed - errors.length, errors });
                    }
                };
            });
        });
    }

    transformToFormalPOAM(poam) {
        return {
            // Core identification
            id: poam.id,
            findingIdentifier: poam.findingIdentifier || poam.id,
            
            // Classification
            controlFamily: poam.controlFamily || this.inferControlFamily(poam),
            vulnerabilityName: poam.vulnerabilityName || poam.title || poam.vulnerability,
            findingDescription: poam.findingDescription || poam.description || poam.vulnerability,
            findingSource: poam.findingSource || 'Vulnerability Scan',
            
            // Responsibility
            poc: poam.poc || poam.pocTeam || '',
            pocTeam: poam.pocTeam || poam.poc || '',
            resourcesRequired: poam.resourcesRequired || '',
            
            // Scheduling
            dueDate: poam.dueDate || poam.initialScheduledCompletionDate || this.calculateDueDate(poam),
            initialScheduledCompletionDate: poam.initialScheduledCompletionDate || poam.dueDate || this.calculateDueDate(poam),
            updatedScheduledCompletionDate: poam.updatedScheduledCompletionDate || poam.dueDate || this.calculateDueDate(poam),
            actualCompletionDate: poam.actualCompletionDate || null,
            
            // Status and risk
            findingStatus: poam.findingStatus || poam.status || 'Open',
            riskLevel: poam.riskLevel || poam.risk || 'medium',
            
            // Mitigation
            mitigation: poam.mitigation || '',
            
            // Metadata
            createdDate: poam.createdDate || new Date().toISOString(),
            lastModifiedDate: new Date().toISOString(),
            scanId: poam.scanId || null,
            needsReview: poam.needsReview || false,
            notes: poam.notes || '',
            
            // Data preservation (Critical Fix: Phase 6.20)
            affectedAssets: poam.affectedAssets ? this.transformAssetsWithMetadata(poam.affectedAssets) : [],
            totalAffectedAssets: poam.totalAffectedAssets || poam.affectedAssets?.length || 0,
            rawFindings: poam.rawFindings || [],

            // Milestones (embedded on POAM for POAM Detail view)
            milestones: Array.isArray(poam.milestones) ? poam.milestones : []
        };
    }

    transformAssetsWithMetadata(assets) {
        return assets.map(asset => ({
            id: asset.id || asset.assetId || asset.asset_id || asset.name || 'Unknown',
            name: asset.name || asset.assetName || asset.asset_name || asset.assetId || 'Unknown Asset',
            asset_id: asset.asset_id || asset.assetId || asset.id || 'Unknown',
            asset_name: asset.asset_name || asset.assetName || asset.name || 'Unknown Asset',
            ipv4: asset.ipv4 || asset.ip || asset.asset_ipv4 || '',
            os: asset.os || asset.operatingSystem || 'Unknown',
            source_field: asset.source_field || '',
            status: asset.status || 'affected',
            firstDetected: asset.firstDetected || asset.scanDate || new Date().toISOString().split('T')[0],
            lastDetected: asset.lastDetected || asset.scanDate || new Date().toISOString().split('T')[0],
            result: asset.result || asset.vulnerability || 'Scan metadata not available for this asset',
            solution: asset.solution || asset.remediation || 'Scan metadata not available for this asset',
            raw: asset.raw || asset.rawData || 'No raw scan data available',
            ip: asset.ip || asset.ipv4 || asset.asset_ipv4 || '',
            port: asset.port || '',
            protocol: asset.protocol || '',
            operatingSystem: asset.operatingSystem || asset.os || 'Unknown'
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

        const transaction = this.db.transaction(['poams'], 'readonly');
        const store = transaction.objectStore('poams');

        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
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

        const transaction = this.db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        
        return new Promise((resolve, reject) => {
            const request = store.put(scanRun);
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