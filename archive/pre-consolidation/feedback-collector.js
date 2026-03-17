// ═══════════════════════════════════════════════════════════════
// FEEDBACK COLLECTION SYSTEM
// ═══════════════════════════════════════════════════════════════
// Handles user acknowledgment and extension requests for POAMs

console.log('📝 Feedback Collection System Loading...');

class FeedbackCollector {
    constructor() {
        this.config = window.NOTIFICATION_CONFIG?.feedback || {};
    }

    // Show feedback form for POAM
    showFeedbackForm(poamId, action = 'acknowledge') {
        if (!window.isFeatureEnabled('feedbackCollection')) {
            console.log('📝 Feedback collection disabled');
            return;
        }

        // Get POAM details
        window.poamDB.getPOAM(poamId).then(poam => {
            if (!poam) {
                console.error(`❌ POAM ${poamId} not found`);
                return;
            }

            this.renderFeedbackModal(poam, action);
        });
    }

    // Render feedback modal
    renderFeedbackModal(poam, action) {
        const modal = document.createElement('div');
        modal.id = 'feedback-modal';
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-50 flex items-center justify-center p-4';

        const formHTML = this.generateFeedbackForm(poam, action);
        modal.innerHTML = formHTML;

        document.body.appendChild(modal);

        // Attach event listeners
        this.attachEventListeners(poam, action);
    }

    // Generate feedback form HTML
    generateFeedbackForm(poam, action) {
        const daysUntilDue = this.calculateDaysUntilDue(poam.dueDate);
        const dueDateFormatted = this.formatDate(poam.dueDate);

        return `
            <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div class="p-6 border-b border-slate-200 dark:border-slate-700">
                    <div class="flex items-center justify-between">
                        <h2 class="text-2xl font-bold text-slate-900 dark:text-slate-100">POAM Acknowledgment</h2>
                        <button onclick="closeFeedbackModal()" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                            <i class="fas fa-times text-xl"></i>
                        </button>
                    </div>
                    <p class="text-sm text-slate-600 dark:text-slate-400 mt-2">${poam.id}</p>
                </div>

                <div class="p-6">
                    <!-- POAM Summary -->
                    <div class="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 mb-6">
                        <h3 class="font-semibold text-slate-900 dark:text-slate-100 mb-2">${this.escapeHTML(poam.title || poam.vulnerabilityName)}</h3>
                        <div class="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span class="text-slate-600 dark:text-slate-400">Severity:</span>
                                <span class="ml-2 font-semibold ${this.getSeverityColor(poam.risk)}">${(poam.risk || 'medium').toUpperCase()}</span>
                            </div>
                            <div>
                                <span class="text-slate-600 dark:text-slate-400">Affected Assets:</span>
                                <span class="ml-2 font-semibold text-slate-900 dark:text-slate-100">${poam.totalAffectedAssets || 0}</span>
                            </div>
                            <div>
                                <span class="text-slate-600 dark:text-slate-400">Due Date:</span>
                                <span class="ml-2 font-semibold ${daysUntilDue < 7 ? 'text-red-600' : 'text-slate-900 dark:text-slate-100'}">${dueDateFormatted} (${daysUntilDue} days)</span>
                            </div>
                            <div>
                                <span class="text-slate-600 dark:text-slate-400">Milestones:</span>
                                <span class="ml-2 font-semibold text-slate-900 dark:text-slate-100">${(poam.milestones || []).length} steps</span>
                            </div>
                        </div>
                    </div>

                    <!-- Feedback Form -->
                    <form id="feedback-form" class="space-y-6">
                        <div>
                            <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Response</label>
                            <div class="space-y-2">
                                <label class="flex items-start p-3 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900">
                                    <input type="radio" name="response" value="acknowledged" class="mt-1 mr-3" ${action === 'acknowledge' ? 'checked' : ''}>
                                    <div>
                                        <div class="font-medium text-slate-900 dark:text-slate-100">I acknowledge receipt of this POAM</div>
                                        <div class="text-sm text-slate-600 dark:text-slate-400">I have reviewed the POAM and understand the requirements</div>
                                    </div>
                                </label>
                                
                                <label class="flex items-start p-3 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900">
                                    <input type="radio" name="response" value="can-meet-deadline" class="mt-1 mr-3">
                                    <div>
                                        <div class="font-medium text-slate-900 dark:text-slate-100">I can meet the scheduled completion date</div>
                                        <div class="text-sm text-slate-600 dark:text-slate-400">I confirm the remediation will be completed by ${dueDateFormatted}</div>
                                    </div>
                                </label>
                                
                                <label class="flex items-start p-3 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900">
                                    <input type="radio" name="response" value="need-extension" class="mt-1 mr-3" ${action === 'extension' ? 'checked' : ''}>
                                    <div>
                                        <div class="font-medium text-slate-900 dark:text-slate-100">I need an extension</div>
                                        <div class="text-sm text-slate-600 dark:text-slate-400">Requires justification and approval</div>
                                    </div>
                                </label>
                            </div>
                        </div>

                        <!-- Extension Request Fields (shown when "need-extension" selected) -->
                        <div id="extension-fields" class="space-y-4 hidden">
                            <div>
                                <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Requested Completion Date</label>
                                <input type="date" id="requested-date" class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" min="${this.getTomorrowDate()}" max="${this.getMaxExtensionDate(poam.dueDate)}">
                                <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Maximum extension: ${this.config.extensionWorkflow?.maxExtensionDays || 90} days</p>
                            </div>

                            <div>
                                <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Justification <span class="text-red-500">*</span></label>
                                <textarea id="justification" rows="4" class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" placeholder="Please provide a detailed justification for the extension request..." required></textarea>
                                <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">This will be reviewed by the Security Team</p>
                            </div>
                        </div>

                        <!-- Comments (optional) -->
                        <div>
                            <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Additional Comments (Optional)</label>
                            <textarea id="comments" rows="3" class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" placeholder="Any additional information or concerns..."></textarea>
                        </div>

                        <!-- Submit Buttons -->
                        <div class="flex gap-3 pt-4">
                            <button type="submit" class="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors">
                                Submit Response
                            </button>
                            <button type="button" onclick="closeFeedbackModal()" class="px-6 py-3 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-semibold rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
    }

    // Attach event listeners to form
    attachEventListeners(poam, action) {
        const form = document.getElementById('feedback-form');
        const extensionFields = document.getElementById('extension-fields');
        const radioButtons = document.querySelectorAll('input[name="response"]');

        // Show/hide extension fields based on selection
        radioButtons.forEach(radio => {
            radio.addEventListener('change', (e) => {
                if (e.target.value === 'need-extension') {
                    extensionFields.classList.remove('hidden');
                } else {
                    extensionFields.classList.add('hidden');
                }
            });
        });

        // Handle form submission
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.submitFeedback(poam);
        });

        // Trigger initial state
        if (action === 'extension') {
            extensionFields.classList.remove('hidden');
        }
    }

    // Submit feedback
    async submitFeedback(poam) {
        const response = document.querySelector('input[name="response"]:checked')?.value;
        const requestedDate = document.getElementById('requested-date')?.value;
        const justification = document.getElementById('justification')?.value;
        const comments = document.getElementById('comments')?.value;

        if (!response) {
            alert('Please select a response option');
            return;
        }

        if (response === 'need-extension' && !justification) {
            alert('Please provide a justification for the extension request');
            return;
        }

        const feedbackData = {
            poamId: poam.id,
            response,
            requestedDate: response === 'need-extension' ? requestedDate : null,
            justification: response === 'need-extension' ? justification : null,
            comments,
            submittedBy: 'current-user', // TODO: Get from auth system
            submittedAt: new Date().toISOString(),
            status: response === 'need-extension' ? 'pending_approval' : 'acknowledged'
        };

        try {
            // Save feedback
            await this.saveFeedback(feedbackData);

            // Update notification status
            await this.updateNotificationStatus(poam.id, 'acknowledged');

            // If extension requested, update POAM status
            if (response === 'need-extension') {
                poam.status = 'extended';
                poam.extensionRequested = true;
                poam.extensionRequestDate = new Date().toISOString();
                poam.requestedCompletionDate = requestedDate;
                await window.poamDB.savePOAM(poam);
            }

            // Close modal and show success
            this.closeFeedbackModal();
            this.showSuccessMessage(response);

        } catch (error) {
            console.error('❌ Failed to submit feedback:', error);
            alert('Failed to submit feedback. Please try again.');
        }
    }

    // Save feedback to database
    async saveFeedback(feedbackData) {
        if (!window.poamDB?.db) {
            throw new Error('Database not initialized');
        }

        return new Promise((resolve, reject) => {
            try {
                const transaction = window.poamDB.db.transaction(['feedbackResponses'], 'readwrite');
                const store = transaction.objectStore('feedbackResponses');
                const request = store.add({
                    id: `feedback-${Date.now()}`,
                    ...feedbackData
                });

                request.onsuccess = () => resolve(feedbackData);
                request.onerror = () => reject(request.error);
            } catch (error) {
                console.warn('⚠️ feedbackResponses store not available:', error);
                resolve(feedbackData);
            }
        });
    }

    // Update notification status
    async updateNotificationStatus(poamId, status) {
        if (!window.notificationQueue) {
            return;
        }

        // Find and update notification
        const pending = await window.notificationQueue.getPendingNotifications();
        const notification = pending.find(n => n.poamId === poamId);

        if (notification) {
            notification.notificationStatus = status;
            notification.acknowledgedDate = new Date().toISOString();
            await window.notificationQueue.updateNotification(notification);
        }
    }

    // Close feedback modal
    closeFeedbackModal() {
        const modal = document.getElementById('feedback-modal');
        if (modal) {
            modal.remove();
        }
    }

    // Show success message
    showSuccessMessage(response) {
        const messages = {
            'acknowledged': 'Thank you for acknowledging this POAM.',
            'can-meet-deadline': 'Thank you for confirming you can meet the deadline.',
            'need-extension': 'Your extension request has been submitted for approval.'
        };

        const message = messages[response] || 'Feedback submitted successfully.';

        if (typeof showAlert === 'function') {
            showAlert(message, 'success');
        } else {
            alert(message);
        }
    }

    // Helper functions
    calculateDaysUntilDue(dueDate) {
        if (!dueDate) return 0;
        const due = new Date(dueDate);
        const now = new Date();
        const diff = due - now;
        return Math.ceil(diff / (1000 * 60 * 60 * 24));
    }

    formatDate(dateString) {
        if (!dateString) return 'Not set';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    }

    getTomorrowDate() {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow.toISOString().split('T')[0];
    }

    getMaxExtensionDate(currentDueDate) {
        const maxDays = this.config.extensionWorkflow?.maxExtensionDays || 90;
        const due = new Date(currentDueDate || Date.now());
        due.setDate(due.getDate() + maxDays);
        return due.toISOString().split('T')[0];
    }

    getSeverityColor(severity) {
        const colors = {
            critical: 'text-red-600',
            high: 'text-orange-600',
            medium: 'text-yellow-600',
            low: 'text-green-600'
        };
        return colors[severity?.toLowerCase()] || 'text-slate-600';
    }

    escapeHTML(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}

// Initialize global instance
window.feedbackCollector = new FeedbackCollector();

// Global functions for modal
window.closeFeedbackModal = function() {
    window.feedbackCollector.closeFeedbackModal();
};

window.showFeedbackForm = function(poamId, action = 'acknowledge') {
    window.feedbackCollector.showFeedbackForm(poamId, action);
};

console.log('✅ Feedback Collection System Ready');
console.log('💡 Use window.showFeedbackForm(poamId, action) to show feedback form');
