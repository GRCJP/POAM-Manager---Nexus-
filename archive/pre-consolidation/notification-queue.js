// ═══════════════════════════════════════════════════════════════
// NOTIFICATION QUEUE SYSTEM
// ═══════════════════════════════════════════════════════════════
// Tracks new POAMs and batches them for weekly delivery by POC team

console.log('📬 Notification Queue System Loading...');

class NotificationQueue {
    constructor() {
        this.db = null;
        this.initPromise = this.init();
    }

    async init() {
        // Extend POAMDatabase with notification queue store
        if (!window.poamDB?.db) {
            console.warn('⚠️ POAMDatabase not ready, waiting...');
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        this.db = window.poamDB?.db;
        
        if (!this.db) {
            console.error('❌ Failed to initialize notification queue: POAMDatabase unavailable');
            return;
        }

        // Check if notificationQueue store exists
        if (!this.db.objectStoreNames.contains('notificationQueue')) {
            console.warn('⚠️ notificationQueue store not found - will be created on next DB upgrade');
        }

        // Listen for POAM batch save events
        window.addEventListener('poam-batch-saved', (event) => this.handlePOAMBatchSaved(event));

        console.log('✅ Notification Queue initialized');
    }

    // Handle POAM batch saved event
    async handlePOAMBatchSaved(event) {
        if (!window.isFeatureEnabled('notifications')) {
            return; // Feature disabled
        }

        await this.initPromise;

        try {
            const { poams, isBaseline } = event.detail;

            // Skip baseline imports (don't notify on initial 400 POAMs)
            if (isBaseline && window.NOTIFICATION_CONFIG?.queue?.excludeBaseline) {
                console.log('📭 Skipping notifications for baseline import');
                return;
            }

            // Detect new POAMs
            const newPOAMs = await this.detectNewPOAMs(poams);
            
            if (newPOAMs.length === 0) {
                console.log('📭 No new POAMs to notify');
                return;
            }

            console.log(`📬 Detected ${newPOAMs.length} new POAMs for notification`);

            // Queue notifications
            await this.queueNotifications(newPOAMs);

        } catch (error) {
            console.error('❌ Failed to handle POAM batch save:', error);
            window.trackFeatureError('notifications', error);
        }
    }

    // Detect new POAMs (not in previous imports)
    async detectNewPOAMs(poams) {
        // For now, treat all POAMs in a non-baseline import as "new"
        // In production, you could track previously seen POAM IDs
        const newPOAMs = [];

        for (const poam of poams) {
            // Check if this POAM was created recently (within last hour)
            const createdDate = new Date(poam.createdDate || Date.now());
            const hourAgo = new Date(Date.now() - 60 * 60 * 1000);

            if (createdDate > hourAgo) {
                newPOAMs.push(poam);
            }
        }

        return newPOAMs;
    }

    // Queue notifications for new POAMs
    async queueNotifications(poams) {
        const queued = [];

        for (const poam of poams) {
            const notification = {
                id: `notif-${poam.id}-${Date.now()}`,
                poamId: poam.id,
                pocTeam: poam.pocTeam || poam.poc || 'Unassigned',
                severity: poam.risk || 'medium',
                createdDate: new Date().toISOString(),
                notificationStatus: 'pending', // pending, sent, acknowledged, failed
                batchId: null,
                sentDate: null,
                acknowledgedDate: null,
                feedbackData: null,
                retryCount: 0,
                lastError: null
            };

            try {
                await this.addToQueue(notification);
                queued.push(notification);
            } catch (error) {
                console.error(`❌ Failed to queue notification for POAM ${poam.id}:`, error);
            }
        }

        console.log(`✅ Queued ${queued.length} notifications`);

        // Trigger immediate processing if not batching
        if (!window.NOTIFICATION_CONFIG?.queue?.batchWeekly) {
            await this.processQueue();
        }
    }

    // Add notification to queue
    async addToQueue(notification) {
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction(['notificationQueue'], 'readwrite');
                const store = transaction.objectStore('notificationQueue');
                const request = store.add(notification);

                request.onsuccess = () => resolve(notification);
                request.onerror = () => reject(request.error);
            } catch (error) {
                // Store might not exist yet
                console.warn('⚠️ notificationQueue store not available:', error);
                resolve(notification);
            }
        });
    }

    // Get pending notifications
    async getPendingNotifications() {
        if (!this.db) {
            return [];
        }

        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction(['notificationQueue'], 'readonly');
                const store = transaction.objectStore('notificationQueue');
                const index = store.index('notificationStatus');
                const request = index.getAll('pending');

                request.onsuccess = () => resolve(request.result || []);
                request.onerror = () => reject(request.error);
            } catch (error) {
                console.warn('⚠️ Failed to get pending notifications:', error);
                resolve([]);
            }
        });
    }

    // Group notifications by POC team
    groupByPOCTeam(notifications) {
        const grouped = {};

        for (const notification of notifications) {
            const team = notification.pocTeam || 'Unassigned';
            if (!grouped[team]) {
                grouped[team] = [];
            }
            grouped[team].push(notification);
        }

        return grouped;
    }

    // Group notifications by severity
    groupBySeverity(notifications) {
        const grouped = {
            critical: [],
            high: [],
            medium: [],
            low: []
        };

        for (const notification of notifications) {
            const severity = (notification.severity || 'medium').toLowerCase();
            if (grouped[severity]) {
                grouped[severity].push(notification);
            } else {
                grouped.medium.push(notification);
            }
        }

        return grouped;
    }

    // Process notification queue
    async processQueue() {
        if (!window.isFeatureEnabled('notifications')) {
            return;
        }

        try {
            const pending = await this.getPendingNotifications();
            
            if (pending.length === 0) {
                console.log('📭 No pending notifications to process');
                return;
            }

            console.log(`📬 Processing ${pending.length} pending notifications`);

            // Group by POC team
            const byPOC = this.groupByPOCTeam(pending);
            const batchId = `BATCH-${Date.now()}`;

            // Send notifications for each POC team
            for (const [pocTeam, notifications] of Object.entries(byPOC)) {
                await this.sendBatchNotification(pocTeam, notifications, batchId);
            }

        } catch (error) {
            console.error('❌ Failed to process notification queue:', error);
            window.trackFeatureError('notifications', error);
        }
    }

    // Send batch notification for a POC team
    async sendBatchNotification(pocTeam, notifications, batchId) {
        console.log(`📧 Sending batch notification to ${pocTeam}: ${notifications.length} POAMs`);

        try {
            // Get full POAM details
            const poams = [];
            for (const notification of notifications) {
                const poam = await window.poamDB.getPOAM(notification.poamId);
                if (poam) {
                    poams.push(poam);
                }
            }

            // Send email if enabled
            if (window.isFeatureEnabled('emailDelivery')) {
                await window.emailDelivery.sendDigest(pocTeam, poams, batchId);
            }

            // Create Jira tickets if enabled
            if (window.isFeatureEnabled('jiraIntegration')) {
                for (const poam of poams) {
                    await window.jiraIntegration.createTicket(poam);
                }
            }

            // Mark notifications as sent
            for (const notification of notifications) {
                notification.notificationStatus = 'sent';
                notification.batchId = batchId;
                notification.sentDate = new Date().toISOString();
                await this.updateNotification(notification);
            }

            console.log(`✅ Batch notification sent to ${pocTeam}`);

        } catch (error) {
            console.error(`❌ Failed to send batch notification to ${pocTeam}:`, error);
            
            // Mark as failed and increment retry count
            for (const notification of notifications) {
                notification.retryCount = (notification.retryCount || 0) + 1;
                notification.lastError = error.message;
                
                if (notification.retryCount >= (window.NOTIFICATION_CONFIG?.queue?.maxRetries || 3)) {
                    notification.notificationStatus = 'failed';
                } else {
                    notification.notificationStatus = 'pending'; // Retry later
                }
                
                await this.updateNotification(notification);
            }
        }
    }

    // Update notification status
    async updateNotification(notification) {
        if (!this.db) {
            return;
        }

        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction(['notificationQueue'], 'readwrite');
                const store = transaction.objectStore('notificationQueue');
                const request = store.put(notification);

                request.onsuccess = () => resolve(notification);
                request.onerror = () => reject(request.error);
            } catch (error) {
                console.warn('⚠️ Failed to update notification:', error);
                resolve(notification);
            }
        });
    }

    // Schedule weekly batch processing
    scheduleWeeklyBatch() {
        if (!window.NOTIFICATION_CONFIG?.queue?.batchWeekly) {
            return;
        }

        const config = window.NOTIFICATION_CONFIG.email.batchSchedule;
        const now = new Date();
        
        // Calculate next batch time
        const nextBatch = this.getNextBatchTime(config.dayOfWeek, config.hour, config.minute);
        const delay = nextBatch - now;

        console.log(`📅 Next batch scheduled for ${nextBatch.toLocaleString()} (in ${Math.round(delay / 1000 / 60)} minutes)`);

        // Schedule batch processing
        setTimeout(async () => {
            console.log('⏰ Weekly batch time - processing queue...');
            await this.processQueue();
            
            // Reschedule for next week
            this.scheduleWeeklyBatch();
        }, delay);
    }

    // Calculate next batch time
    getNextBatchTime(dayOfWeek, hour, minute) {
        const now = new Date();
        const next = new Date(now);
        
        // Set to target day of week
        const currentDay = now.getDay();
        const daysUntilTarget = (dayOfWeek - currentDay + 7) % 7;
        next.setDate(now.getDate() + (daysUntilTarget || 7)); // If today, schedule for next week
        
        // Set time
        next.setHours(hour, minute, 0, 0);
        
        // If time has passed today, schedule for next week
        if (next <= now) {
            next.setDate(next.getDate() + 7);
        }
        
        return next;
    }

    // Get queue statistics
    async getQueueStats() {
        const pending = await this.getPendingNotifications();
        const byPOC = this.groupByPOCTeam(pending);
        const bySeverity = this.groupBySeverity(pending);

        return {
            totalPending: pending.length,
            byPOCTeam: Object.entries(byPOC).map(([team, notifs]) => ({
                team,
                count: notifs.length
            })),
            bySeverity: {
                critical: bySeverity.critical.length,
                high: bySeverity.high.length,
                medium: bySeverity.medium.length,
                low: bySeverity.low.length
            }
        };
    }

    // Clear old notifications (cleanup)
    async cleanupOldNotifications() {
        const retentionDays = window.NOTIFICATION_CONFIG?.queue?.retentionDays || 90;
        const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

        if (!this.db) {
            return 0;
        }

        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction(['notificationQueue'], 'readwrite');
                const store = transaction.objectStore('notificationQueue');
                const request = store.openCursor();
                let deleted = 0;

                request.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (cursor) {
                        const notification = cursor.value;
                        const createdDate = new Date(notification.createdDate);
                        
                        if (createdDate < cutoffDate && notification.notificationStatus !== 'pending') {
                            cursor.delete();
                            deleted++;
                        }
                        
                        cursor.continue();
                    } else {
                        console.log(`🗑️ Cleaned up ${deleted} old notifications`);
                        resolve(deleted);
                    }
                };

                request.onerror = () => reject(request.error);
            } catch (error) {
                console.warn('⚠️ Failed to cleanup notifications:', error);
                resolve(0);
            }
        });
    }
}

// Initialize global instance
window.notificationQueue = new NotificationQueue();

// Start weekly batch scheduler if enabled
if (window.NOTIFICATION_CONFIG?.queue?.batchWeekly) {
    window.notificationQueue.initPromise.then(() => {
        window.notificationQueue.scheduleWeeklyBatch();
    });
}

// Manual queue processing (for testing)
window.processNotificationQueue = async function() {
    console.log('🔄 Manually processing notification queue...');
    await window.notificationQueue.processQueue();
};

// Get queue stats (for dashboard)
window.getNotificationQueueStats = async function() {
    const stats = await window.notificationQueue.getQueueStats();
    console.log('📊 Notification Queue Stats:', stats);
    return stats;
};

console.log('✅ Notification Queue System Ready');
console.log('💡 Use window.processNotificationQueue() to manually process queue');
console.log('💡 Use window.getNotificationQueueStats() to view queue statistics');
