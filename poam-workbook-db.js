class POAMWorkbookDatabase {
  constructor() {
    this.dbName = 'POAMWorkbookDB';
    this.version = 1;
    this.db = null;
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

        if (!db.objectStoreNames.contains('poamWorkbookItems')) {
          const items = db.createObjectStore('poamWorkbookItems', { keyPath: 'id' });
          items.createIndex('systemId', 'systemId', { unique: false });
          items.createIndex('itemNumber', ['systemId', 'Item number'], { unique: false });
          items.createIndex('severity', 'Severity Value', { unique: false });
          items.createIndex('status', 'Status', { unique: false });
          items.createIndex('vulnName', 'Vulnerability Name', { unique: false });
          items.createIndex('scheduledCompletion', 'Scheduled Completion Date', { unique: false });
        }

        if (!db.objectStoreNames.contains('poamWorkbookSystems')) {
          const systems = db.createObjectStore('poamWorkbookSystems', { keyPath: 'id' });
          systems.createIndex('name', 'name', { unique: false });
        }

        if (!db.objectStoreNames.contains('poamWorkbookLookups')) {
          const lookups = db.createObjectStore('poamWorkbookLookups', { keyPath: 'key' });
        }
      };
    });
  }

  hasStore(storeName) {
    return !!(this.db && this.db.objectStoreNames && this.db.objectStoreNames.contains(storeName));
  }

  async seedDefaultsIfNeeded() {
    if (!this.db) await this.init();

    const existing = await this.getLookup('pocs');
    if (!existing) {
      await this.putLookup('pocs', [
        'Unassigned',
        'Windows Systems Team',
        'Linux Systems Team',
        'Network Engineering Team',
        'Application Development Team'
      ]);
    }

    const controls = await this.getLookup('securityControls');
    if (!controls) {
      await this.putLookup('securityControls', {
        families: ['AC', 'AU', 'CM', 'IA', 'IR', 'SC', 'SI', 'PE', 'AT'],
        controls: ['SI-2', 'CM-6', 'AC-2', 'IA-2', 'AU-2', 'SC-7', 'IR-4']
      });
    }

    const detectingSources = await this.getLookup('detectingSources');
    if (!detectingSources) {
      await this.putLookup('detectingSources', window.POAM_WORKBOOK_ENUMS?.detectingSources || []);
    }

    const severityValues = await this.getLookup('severityValues');
    if (!severityValues) {
      await this.putLookup('severityValues', window.POAM_WORKBOOK_ENUMS?.severityValues || []);
    }

    const statusValues = await this.getLookup('statusValues');
    if (!statusValues) {
      await this.putLookup('statusValues', window.POAM_WORKBOOK_ENUMS?.statusValues || []);
    }

    const defaultSystem = await this.getSystemById('default');
    if (!defaultSystem) {
      await this.saveSystem({
        id: 'default',
        name: 'Default System',
        description: 'Workbook system'
      });
    }
  }

  async putLookup(key, value) {
    if (!this.db) await this.init();
    const tx = this.db.transaction(['poamWorkbookLookups'], 'readwrite');
    const store = tx.objectStore('poamWorkbookLookups');
    return new Promise((resolve, reject) => {
      const req = store.put({ key, value });
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  async getLookup(key) {
    if (!this.db) await this.init();
    const tx = this.db.transaction(['poamWorkbookLookups'], 'readonly');
    const store = tx.objectStore('poamWorkbookLookups');
    return new Promise((resolve, reject) => {
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ? req.result.value : null);
      req.onerror = () => reject(req.error);
    });
  }

  async saveSystem(system) {
    if (!this.db) await this.init();
    const tx = this.db.transaction(['poamWorkbookSystems'], 'readwrite');
    const store = tx.objectStore('poamWorkbookSystems');
    return new Promise((resolve, reject) => {
      const req = store.put(system);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async getSystems() {
    if (!this.db) await this.init();
    const tx = this.db.transaction(['poamWorkbookSystems'], 'readonly');
    const store = tx.objectStore('poamWorkbookSystems');
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async getSystemById(id) {
    if (!this.db) await this.init();
    const tx = this.db.transaction(['poamWorkbookSystems'], 'readonly');
    const store = tx.objectStore('poamWorkbookSystems');
    return new Promise((resolve, reject) => {
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async saveItem(item) {
    if (!this.db) await this.init();
    const tx = this.db.transaction(['poamWorkbookItems'], 'readwrite');
    const store = tx.objectStore('poamWorkbookItems');
    return new Promise((resolve, reject) => {
      const req = store.put(item);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async getItem(id) {
    if (!this.db) await this.init();
    const tx = this.db.transaction(['poamWorkbookItems'], 'readonly');
    const store = tx.objectStore('poamWorkbookItems');
    return new Promise((resolve, reject) => {
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async getItemsBySystem(systemId) {
    if (!this.db) await this.init();
    const tx = this.db.transaction(['poamWorkbookItems'], 'readonly');
    const store = tx.objectStore('poamWorkbookItems');
    const idx = store.index('systemId');
    return new Promise((resolve, reject) => {
      const req = idx.getAll(systemId);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async getAllItems() {
    if (!this.db) await this.init();
    const tx = this.db.transaction(['poamWorkbookItems'], 'readonly');
    const store = tx.objectStore('poamWorkbookItems');
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async deleteItem(id) {
    if (!this.db) await this.init();
    const tx = this.db.transaction(['poamWorkbookItems'], 'readwrite');
    const store = tx.objectStore('poamWorkbookItems');
    return new Promise((resolve, reject) => {
      const req = store.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  async getNextItemNumber(systemId) {
    const items = await this.getItemsBySystem(systemId);
    const nums = items
      .map(i => {
        const v = i['Item number'];
        const n = typeof v === 'number' ? v : parseInt(String(v || '').trim(), 10);
        return Number.isFinite(n) ? n : 0;
      })
      .filter(n => n > 0);
    const max = nums.length ? Math.max(...nums) : 0;
    return max + 1;
  }
}

window.poamWorkbookDB = new POAMWorkbookDatabase();

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await window.poamWorkbookDB.init();
    if (typeof window.poamWorkbookDB.seedDefaultsIfNeeded === 'function') {
      await window.poamWorkbookDB.seedDefaultsIfNeeded();
    }
  } catch (e) {
    console.error('Failed to init POAMWorkbookDB', e);
  }
});
