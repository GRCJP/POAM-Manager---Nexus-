console.log('📦 poam-database.js loading...');

// ═══════════════════════════════════════════════════════════════
// POAM DATABASE - ENHANCED FOR FORMAL POAM REPORTING
// ═══════════════════════════════════════════════════════════════

class POAMDatabase {
    constructor() {
        this.dbName = 'POAMVulnerabilityDB';
        this.version = 2;
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('POAMDatabase', 2);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                const oldVersion = event.oldVersion;
                
                // Create POAMs object store
                if (!db.objectStoreNames.contains('poams')) {
                    const poamStore = db.createObjectStore('poams', { keyPath: 'id' });
                    poamStore.createIndex('status', 'status', { unique: false });
                    poamStore.createIndex('risk', 'risk', { unique: false });
                    poamStore.createIndex('dueDate', 'dueDate', { unique: false });
                    poamStore.createIndex('controlFamily', 'controlFamily', { unique: false });
                    poamStore.createIndex('poc', 'poc', { unique: false });
                }
                
                // Create scan results object store
                if (!db.objectStoreNames.contains('scanResults')) {
                    const scanStore = db.createObjectStore('scanResults', { keyPath: 'id', autoIncrement: true });
                    scanStore.createIndex('poamId', 'poamId', { unique: false });
                    scanStore.createIndex('scanDate', 'scanDate', { unique: false });
                    scanStore.createIndex('assetId', 'assetId', { unique: false });
                }
                
                // Create milestones object store
                if (!db.objectStoreNames.contains('milestones')) {
                    const milestoneStore = db.createObjectStore('milestones', { keyPath: 'id', autoIncrement: true });
                    milestoneStore.createIndex('poamId', 'poamId', { unique: false });
                    milestoneStore.createIndex('targetDate', 'targetDate', { unique: false });
                }
                
                // Create comments object store
                if (!db.objectStoreNames.contains('comments')) {
                    const commentStore = db.createObjectStore('comments', { keyPath: 'id', autoIncrement: true });
                    commentStore.createIndex('poamId', 'poamId', { unique: false });
                    commentStore.createIndex('timestamp', 'timestamp', { unique: false });
                }
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
            poc: poam.poc || '',
            resourcesRequired: poam.resourcesRequired || '',
            
            // Scheduling
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
            
            // Asset information
            totalAffectedAssets: poam.totalAffectedAssets || poam.assets?.length || 0,
            breachedAssets: poam.breachedAssets || 0,
            
            // Additional fields
            confidenceLevel: poam.confidenceLevel || '',
            needsReview: poam.needsReview || false,
            
            // Asset details with scan metadata
            assets: this.transformAssetsWithMetadata(poam.assets || [])
        };
    }

    transformAssetsWithMetadata(assets) {
        return assets.map(asset => ({
            id: asset.id || asset.assetId || asset.name || 'Unknown',
            name: asset.name || asset.assetId || 'Unknown Asset',
            status: asset.status || 'affected',
            firstDetected: asset.firstDetected || asset.scanDate || new Date().toISOString().split('T')[0],
            lastDetected: asset.lastDetected || asset.scanDate || new Date().toISOString().split('T')[0],
            result: asset.result || asset.vulnerability || 'Scan metadata not available for this asset',
            solution: asset.solution || asset.remediation || 'Scan metadata not available for this asset',
            raw: asset.raw || asset.rawData || 'No raw scan data available',
            ip: asset.ip || '',
            port: asset.port || '',
            protocol: asset.protocol || ''
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
}

// Initialize global database instance
const poamDB = new POAMDatabase();

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