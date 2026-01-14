// POAM Database - IndexedDB Wrapper for Vulnerability POAMs
// Provides unlimited storage for vulnerability scan POAMs

console.log('📦 poam-database.js loading...');

class POAMDatabase {
    constructor() {
        this.dbName = 'POAMVulnerabilityDB';
        this.version = 1;
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => {
                console.error('Failed to open IndexedDB:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log('✅ POAM Database initialized successfully');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Create POAMs object store if it doesn't exist
                if (!db.objectStoreNames.contains('poams')) {
                    const objectStore = db.createObjectStore('poams', { keyPath: 'id' });
                    
                    // Create indexes for efficient querying
                    objectStore.createIndex('status', 'status', { unique: false });
                    objectStore.createIndex('risk', 'risk', { unique: false });
                    objectStore.createIndex('poc', 'poc', { unique: false });
                    objectStore.createIndex('dueDate', 'dueDate', { unique: false });
                    objectStore.createIndex('createdDate', 'createdDate', { unique: false });
                    
                    console.log('✅ POAM object store created');
                }
            };
        });
    }

    async addPOAMsBatch(poams) {
        if (!this.db) {
            await this.init();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['poams'], 'readwrite');
            const objectStore = transaction.objectStore('poams');
            let successCount = 0;

            transaction.oncomplete = () => {
                resolve(successCount);
            };

            transaction.onerror = () => {
                console.error('Transaction error:', transaction.error);
                reject(transaction.error);
            };

            poams.forEach(poam => {
                const request = objectStore.put(poam);
                request.onsuccess = () => {
                    successCount++;
                };
                request.onerror = () => {
                    console.error('Failed to add POAM:', request.error);
                };
            });
        });
    }

    async savePOAM(poam) {
        if (!this.db) {
            await this.init();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['poams'], 'readwrite');
            const objectStore = transaction.objectStore('poams');
            const request = objectStore.put(poam);

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                console.error('Failed to save POAM:', request.error);
                reject(request.error);
            };
        });
    }

    async getPOAM(poamId) {
        if (!this.db) {
            await this.init();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['poams'], 'readonly');
            const objectStore = transaction.objectStore('poams');
            const request = objectStore.get(poamId);

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                console.error('Failed to get POAM:', request.error);
                reject(request.error);
            };
        });
    }

    async getAllPOAMs() {
        if (!this.db) {
            await this.init();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['poams'], 'readonly');
            const objectStore = transaction.objectStore('poams');
            const request = objectStore.getAll();

            request.onsuccess = () => {
                resolve(request.result || []);
            };

            request.onerror = () => {
                console.error('Failed to get all POAMs:', request.error);
                reject(request.error);
            };
        });
    }

    async countPOAMs() {
        if (!this.db) {
            await this.init();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['poams'], 'readonly');
            const objectStore = transaction.objectStore('poams');
            const request = objectStore.count();

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                console.error('Failed to count POAMs:', request.error);
                reject(request.error);
            };
        });
    }

    async deletePOAM(poamId) {
        if (!this.db) {
            await this.init();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['poams'], 'readwrite');
            const objectStore = transaction.objectStore('poams');
            const request = objectStore.delete(poamId);

            request.onsuccess = () => {
                resolve();
            };

            request.onerror = () => {
                console.error('Failed to delete POAM:', request.error);
                reject(request.error);
            };
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

    async getPOAMsByRisk(risk) {
        if (!this.db) {
            await this.init();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['poams'], 'readonly');
            const objectStore = transaction.objectStore('poams');
            const index = objectStore.index('risk');
            const request = index.getAll(risk);

            request.onsuccess = () => {
                resolve(request.result || []);
            };

            request.onerror = () => {
                console.error('Failed to get POAMs by risk:', request.error);
                reject(request.error);
            };
        });
    }
}

// Initialize global database instance
const poamDB = new POAMDatabase();

console.log('📦 poamDB created:', poamDB);
console.log('📦 poamDB.getPOAM exists:', typeof poamDB.getPOAM);
console.log('📦 poamDB.getAllPOAMs exists:', typeof poamDB.getAllPOAMs);
console.log('📦 poamDB.savePOAM exists:', typeof poamDB.savePOAM);

// Initialize database on page load
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await poamDB.init();
        console.log('✅ POAM Database ready - getPOAM:', typeof poamDB.getPOAM);
    } catch (error) {
        console.error('Failed to initialize POAM database:', error);
    }
});
