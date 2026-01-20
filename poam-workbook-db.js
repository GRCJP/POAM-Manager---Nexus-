class POAMWorkbookDatabase {
  constructor() {
    this.dbName = 'POAMWorkbookDB';
    this.version = 2;
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
        const tx = event.target.transaction;

        if (!db.objectStoreNames.contains('poamWorkbookItems')) {
          const items = db.createObjectStore('poamWorkbookItems', { keyPath: 'id' });
          items.createIndex('systemId', 'systemId', { unique: false });

          // IMPORTANT: IndexedDB keyPaths cannot contain spaces.
          // We keep workbook columns as-is, but index via safe derived fields.
          items.createIndex('itemNumber', ['systemId', 'itemNumberNumeric'], { unique: false });
          items.createIndex('severity', 'severityValue', { unique: false });
          items.createIndex('status', 'statusValue', { unique: false });
          items.createIndex('vulnName', 'vulnerabilityName', { unique: false });
          items.createIndex('scheduledCompletion', 'scheduledCompletionDate', { unique: false });
        }

        // If the store already existed from a prior version, ensure the safe indexes exist.
        if (db.objectStoreNames.contains('poamWorkbookItems')) {
          const items = tx.objectStore('poamWorkbookItems');
          if (!items.indexNames.contains('systemId')) {
            items.createIndex('systemId', 'systemId', { unique: false });
          }
          if (!items.indexNames.contains('itemNumber')) {
            items.createIndex('itemNumber', ['systemId', 'itemNumberNumeric'], { unique: false });
          }
          if (!items.indexNames.contains('severity')) {
            items.createIndex('severity', 'severityValue', { unique: false });
          }
          if (!items.indexNames.contains('status')) {
            items.createIndex('status', 'statusValue', { unique: false });
          }
          if (!items.indexNames.contains('vulnName')) {
            items.createIndex('vulnName', 'vulnerabilityName', { unique: false });
          }
          if (!items.indexNames.contains('scheduledCompletion')) {
            items.createIndex('scheduledCompletion', 'scheduledCompletionDate', { unique: false });
          }

          // Migrate existing records to include derived fields used by indexes.
          try {
            const cursorReq = items.openCursor();
            cursorReq.onsuccess = (e) => {
              const cursor = e.target.result;
              if (!cursor) return;
              const value = cursor.value || {};
              const migrated = this._withDerivedFields(value);
              cursor.update(migrated);
              cursor.continue();
            };
          } catch (e) {
            // ignore migration errors during upgrade
          }
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

    const poamIdFormat = await this.getLookup('poamIdFormat');
    if (!poamIdFormat) {
      await this.putLookup('poamIdFormat', 'POAM-{system}-{n:4}');
    }

    const defaultSystem = await this.getSystemById('default');
    if (!defaultSystem) {
      await this.saveSystem({
        id: 'default',
        name: 'Default System',
        description: 'Workbook system'
      });
    }

    // Seed sample systems (only if they do not already exist)
    const sampleSystems = [
      { id: 'sys-alpha', name: 'Enclave Alpha', description: 'Security Control Monitoring system' },
      { id: 'sys-bravo', name: 'Enclave Bravo', description: 'Security Control Monitoring system' },
      { id: 'sys-charlie', name: 'Enclave Charlie', description: 'Security Control Monitoring system' },
      { id: 'sys-delta', name: 'Enclave Delta', description: 'Security Control Monitoring system' }
    ];

    for (const s of sampleSystems) {
      const existingSystem = await this.getSystemById(s.id);
      if (!existingSystem) {
        await this.saveSystem(s);
      }
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

    const toSave = this._withDerivedFields(item);
    return new Promise((resolve, reject) => {
      const req = store.put(toSave);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  _withDerivedFields(item) {
    const out = { ...(item || {}) };
    const rawItemNumber = out['Item number'];

    const parsedItemNumber = (() => {
      if (typeof rawItemNumber === 'number') return rawItemNumber;
      const s = String(rawItemNumber || '').trim();
      if (!s) return NaN;
      // Support formatted IDs like POAM-SYS-0001 by extracting the last digit group.
      const m = s.match(/(\d+)(?!.*\d)/);
      if (m) return parseInt(m[1], 10);
      return parseInt(s, 10);
    })();

    out.itemNumberNumeric = Number.isFinite(parsedItemNumber) ? parsedItemNumber : 0;

    out.severityValue = String(out['Severity Value'] || '').trim();
    out.statusValue = String(out['Status'] || '').trim();
    out.vulnerabilityName = String(out['Vulnerability Name'] || '').trim();
    out.scheduledCompletionDate = String(out['Scheduled Completion Date'] || '').trim();
    return out;
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

  async getItemBySystemAndItemNumber(systemId, itemNumber) {
    if (!this.db) await this.init();
    const tx = this.db.transaction(['poamWorkbookItems'], 'readonly');
    const store = tx.objectStore('poamWorkbookItems');
    const idx = store.index('itemNumber');
    const n = typeof itemNumber === 'number' ? itemNumber : parseInt(String(itemNumber || '').trim(), 10);
    const key = [systemId, Number.isFinite(n) ? n : 0];
    return new Promise((resolve, reject) => {
      const req = idx.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async upsertItemBySystemAndItemNumber(systemId, itemNumber, data) {
    if (!systemId) throw new Error('Missing systemId');
    const n = typeof itemNumber === 'number' ? itemNumber : parseInt(String(itemNumber || '').trim(), 10);
    if (!Number.isFinite(n) || n <= 0) throw new Error('Invalid Item number');

    const existing = await this.getItemBySystemAndItemNumber(systemId, n);
    const now = new Date().toISOString();

    const base = existing || {
      id: `WB-${systemId}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      systemId,
      createdAt: now
    };

    const merged = {
      ...base,
      ...data,
      id: base.id,
      systemId,
      createdAt: base.createdAt || now,
      updatedAt: now
    };

    await this.saveItem(merged);
    return { id: merged.id, created: !existing };
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
        const n = typeof v === 'number' ? v : parseInt(String(v || '').replace(/[^0-9]/g, ''), 10);
        const fallback = Number.isFinite(n) ? n : 0;
        const derived = typeof i.itemNumberNumeric === 'number' ? i.itemNumberNumeric : 0;
        return derived > 0 ? derived : fallback;
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
