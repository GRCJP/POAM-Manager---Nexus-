#!/usr/bin/env node

/**
 * Node.js test runner to simulate CSV import with test data
 * This runs the skills architecture flow and captures errors
 */

const fs = require('fs');
const path = require('path');

// Mock browser globals for Node.js environment
global.window = {
    USE_SKILLS_ARCHITECTURE: true,
    skillsIntegration: null
};
global.console = console;

// Load the skills files
const skillsDir = path.join(__dirname, 'skills');
const files = [
    'base-skill.js',
    'sla-calculator-skill.js', 
    'classification-skill.js',
    'grouping-skill.js',
    'poam-builder-skill.js',
    'search-skill.js',
    'skill-orchestrator.js'
];

console.log('📦 Loading skills...\n');

// Simple eval-based loader for testing
files.forEach(file => {
    const filePath = path.join(skillsDir, file);
    if (fs.existsSync(filePath)) {
        const code = fs.readFileSync(filePath, 'utf8');
        try {
            eval(code);
            console.log(`✅ Loaded ${file}`);
        } catch (err) {
            console.error(`❌ Failed to load ${file}:`, err.message);
        }
    }
});

// Load skills integration
const integrationPath = path.join(__dirname, 'skills-integration.js');
if (fs.existsSync(integrationPath)) {
    const code = fs.readFileSync(integrationPath, 'utf8');
    eval(code);
    console.log('✅ Loaded skills-integration.js\n');
}

// Test data from test-data-scrubbed.csv
const testFindings = [
    {
        ip: '10.1.1.100',
        host: 'server01.test.local',
        operatingSystem: 'Windows Server 2019',
        os: 'Windows Server 2019',
        status: 'Active',
        qid: ['91234'],
        title: 'Microsoft Windows KB5034441 Security Update',
        severity: '5',
        risk: 'critical',
        solution: 'Install KB5034441 from Microsoft Update.',
        cve: ['CVE-2024-21351'],
        firstDetected: '2024-01-15',
        lastDetected: '2024-03-11'
    },
    {
        ip: '10.1.1.101',
        host: 'server02.test.local',
        operatingSystem: 'Windows Server 2019',
        os: 'Windows Server 2019',
        status: 'Active',
        qid: ['91234'],
        title: 'Microsoft Windows KB5034441 Security Update',
        severity: '5',
        risk: 'critical',
        solution: 'Install KB5034441 from Microsoft Update.',
        cve: ['CVE-2024-21351'],
        firstDetected: '2024-01-15',
        lastDetected: '2024-03-11'
    },
    {
        ip: '10.1.1.103',
        host: 'webserver01.test.local',
        operatingSystem: 'Windows Server 2019',
        os: 'Windows Server 2019',
        status: 'Active',
        qid: ['92456'],
        title: 'Apache Tomcat 9.0.85 or Earlier Multiple Vulnerabilities',
        severity: '4',
        risk: 'high',
        solution: 'Upgrade to Apache Tomcat 9.0.86 or later.',
        cve: ['CVE-2024-23672'],
        firstDetected: '2024-02-01',
        lastDetected: '2024-03-11'
    }
];

async function runTest() {
    console.log('🧪 Starting CSV Import Simulation\n');
    console.log(`📋 Test findings: ${testFindings.length}\n`);
    
    try {
        // Initialize skills
        if (!global.window.skillsIntegration) {
            console.error('❌ skillsIntegration not initialized');
            return;
        }
        
        await global.window.skillsIntegration.init();
        console.log('✅ Skills initialized\n');
        
        // Step 1: Classification
        console.log('📋 Step 1: Classification');
        const classificationSkill = global.window.skillsIntegration.orchestrator.skills.get('classification');
        
        if (!classificationSkill) {
            console.error('❌ ClassificationSkill not found');
            return;
        }
        
        const classResult = await classificationSkill.execute({ findings: testFindings });
        
        if (!classResult.success) {
            console.error('❌ Classification failed:', classResult.errors);
            return;
        }
        
        const classified = classResult.data.findings;
        console.log(`✅ Classified ${classified.length} findings`);
        
        // Check remediation
        const firstFinding = classified[0];
        console.log(`\n🔍 First finding remediation:`);
        console.log(`   Present: ${firstFinding.remediation ? 'YES ✅' : 'NO ❌'}`);
        
        if (firstFinding.remediation) {
            console.log(`   Component: ${firstFinding.remediation.component}`);
            console.log(`   Type: ${firstFinding.remediation.remediationType}`);
            console.log(`   Platform: ${firstFinding.remediation.platform}`);
        } else {
            console.error('❌ CRITICAL: Classification did not add remediation!');
            return;
        }
        
        // Step 2: Grouping
        console.log('\n📋 Step 2: Grouping');
        const groupingSkill = global.window.skillsIntegration.orchestrator.skills.get('grouping');
        
        if (!groupingSkill) {
            console.error('❌ GroupingSkill not found');
            return;
        }
        
        const groupResult = await groupingSkill.execute({ findings: classified });
        
        if (!groupResult.success) {
            console.error('❌ Grouping failed:', groupResult.errors);
            return;
        }
        
        const groups = groupResult.data.groups;
        console.log(`✅ Created ${groups.length} groups`);
        
        // Check group remediation
        const firstGroup = groups[0];
        console.log(`\n🔍 First group remediation:`);
        console.log(`   Present: ${firstGroup.remediation ? 'YES ✅' : 'NO ❌'}`);
        
        if (firstGroup.remediation) {
            console.log(`   Component: ${firstGroup.remediation.component}`);
            console.log(`   Type: ${firstGroup.remediation.remediationType}`);
        } else {
            console.error('❌ CRITICAL: Group missing remediation!');
            console.log(`   Group keys: ${Object.keys(firstGroup).join(', ')}`);
            return;
        }
        
        // Step 3: Map conversion
        console.log('\n📋 Step 3: Map Conversion');
        const groupsMap = new Map();
        
        groups.forEach(group => {
            if (group && group.signature) {
                const groupWithSets = {
                    ...group,
                    assets: new Set(group.assets || []),
                    cves: new Set(group.cves || []),
                    qids: new Set(group.qids || []),
                    advisoryIds: new Set()
                };
                groupsMap.set(group.signature, groupWithSets);
            }
        });
        
        console.log(`✅ Converted to Map: ${groupsMap.size} groups`);
        
        const firstMapGroup = groupsMap.values().next().value;
        console.log(`\n🔍 First map group remediation:`);
        console.log(`   Present: ${firstMapGroup.remediation ? 'YES ✅' : 'NO ❌'}`);
        
        if (!firstMapGroup.remediation) {
            console.error('❌ CRITICAL: Remediation lost during Map conversion!');
            return;
        }
        
        console.log('\n✅ ALL TESTS PASSED - Skills architecture working correctly!');
        
    } catch (error) {
        console.error('\n❌ Test failed with error:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

// Run the test
runTest().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
