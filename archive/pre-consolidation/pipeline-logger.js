// Pipeline Logger - Configurable logging system with log levels
// Eliminates console spam from hot loops

const LogLevel = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
    TRACE: 4
};

class PipelineLogger {
    constructor(name, level = LogLevel.INFO) {
        this.name = name;
        this.level = level;
    }

    setLevel(level) {
        this.level = level;
    }

    error(message, ...args) {
        if (this.level >= LogLevel.ERROR) {
            console.error(`❌ [${this.name}]`, message, ...args);
        }
    }

    warn(message, ...args) {
        if (this.level >= LogLevel.WARN) {
            console.warn(`⚠️ [${this.name}]`, message, ...args);
        }
    }

    info(message, ...args) {
        if (this.level >= LogLevel.INFO) {
            console.log(`ℹ️ [${this.name}]`, message, ...args);
        }
    }

    debug(message, ...args) {
        if (this.level >= LogLevel.DEBUG) {
            console.log(`🔍 [${this.name}]`, message, ...args);
        }
    }

    trace(message, ...args) {
        if (this.level >= LogLevel.TRACE) {
            console.log(`📍 [${this.name}]`, message, ...args);
        }
    }

    phaseStart(phaseName) {
        if (this.level >= LogLevel.INFO) {
            console.log(`\n🚀 ═══ ${phaseName} STARTED ═══`);
        }
    }

    phaseEnd(phaseName, stats = {}) {
        if (this.level >= LogLevel.INFO) {
            console.log(`✅ ═══ ${phaseName} COMPLETED ═══`);
            if (Object.keys(stats).length > 0) {
                console.log('   Stats:', stats);
            }
        }
    }

    phaseProgress(phaseName, progress, detail = '') {
        if (this.level >= LogLevel.DEBUG) {
            console.log(`⏳ [${phaseName}] ${progress}% ${detail}`);
        }
    }
}

// Export for use in other modules
window.LogLevel = LogLevel;
window.PipelineLogger = PipelineLogger;

console.log('✅ pipeline-logger.js loaded successfully');
