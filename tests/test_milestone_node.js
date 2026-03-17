// Simple test for milestone generation
// Copy the generateMilestonesForControlFamily function here for testing

function generateMilestonesForControlFamily(controlFamily, startDate, dueDate) {
    if (!startDate || !dueDate) {
        console.warn('⚠️ Missing start or due date for milestone generation');
        return [];
    }
    
    const start = new Date(startDate);
    const end = new Date(dueDate);
    const totalDays = Math.floor((end - start) / (1000 * 60 * 60 * 24));
    
    if (totalDays <= 0) {
        console.warn('⚠️ Due date must be after start date for milestone generation');
        return [];
    }
    
    console.log(`📅 Generating ${controlFamily} milestones: ${totalDays} days from ${start.toISOString().split('T')[0]} to ${end.toISOString().split('T')[0]}`);
    
    let milestones = [];
    
    if (controlFamily === 'SI') {
        // SI-2 (Flaw Remediation) milestones - patch-focused
        const milestone1Date = new Date(start);
        milestone1Date.setDate(milestone1Date.getDate() + Math.floor(totalDays * 0.1)); // 10% in
        
        const milestone2Date = new Date(start);
        milestone2Date.setDate(milestone2Date.getDate() + Math.floor(totalDays * 0.3)); // 30% in
        
        const milestone3Date = new Date(start);
        milestone3Date.setDate(milestone3Date.getDate() + Math.floor(totalDays * 0.7)); // 70% in
        
        const milestone4Date = new Date(end); // Due date
        
        milestones = [
            {
                name: 'Identify and obtain patch',
                description: 'Research, identify, and obtain the appropriate security patch or update',
                targetDate: milestone1Date.toISOString().split('T')[0],
                status: 'pending',
                weight: 10
            },
            {
                name: 'Test patch in staging environment',
                description: 'Deploy and test the patch in a non-production environment to verify compatibility',
                targetDate: milestone2Date.toISOString().split('T')[0],
                status: 'pending',
                weight: 20
            },
            {
                name: 'Deploy patch to production',
                description: 'Deploy the tested patch to production systems using standard change management procedures',
                targetDate: milestone3Date.toISOString().split('T')[0],
                status: 'pending',
                weight: 30
            },
            {
                name: 'Verify remediation and close',
                description: 'Verify the vulnerability is remediated and update POAM status to completed',
                targetDate: milestone4Date.toISOString().split('T')[0],
                status: 'pending',
                weight: 40
            }
        ];
        
    } else if (controlFamily === 'CM') {
        // CM-6 (Configuration Management) milestones - config-focused
        const milestone1Date = new Date(start);
        milestone1Date.setDate(milestone1Date.getDate() + Math.floor(totalDays * 0.15)); // 15% in
        
        const milestone2Date = new Date(start);
        milestone2Date.setDate(milestone2Date.getDate() + Math.floor(totalDays * 0.4)); // 40% in
        
        const milestone3Date = new Date(start);
        milestone3Date.setDate(milestone3Date.getDate() + Math.floor(totalDays * 0.75)); // 75% in
        
        const milestone4Date = new Date(end); // Due date
        
        milestones = [
            {
                name: 'Assess current configuration',
                description: 'Review and document the current system configuration against security baselines',
                targetDate: milestone1Date.toISOString().split('T')[0],
                status: 'pending',
                weight: 15
            },
            {
                name: 'Plan configuration changes',
                description: 'Develop detailed plan for required configuration changes and obtain approvals',
                targetDate: milestone2Date.toISOString().split('T')[0],
                status: 'pending',
                weight: 25
            },
            {
                name: 'Apply configuration updates',
                description: 'Implement the planned configuration changes following change management procedures',
                targetDate: milestone3Date.toISOString().split('T')[0],
                status: 'pending',
                weight: 35
            },
            {
                name: 'Test and validate configuration',
                description: 'Test configuration changes and validate compliance with security requirements',
                targetDate: milestone4Date.toISOString().split('T')[0],
                status: 'pending',
                weight: 25
            }
        ];
        
    } else {
        // Default milestones for other control families
        const milestoneDates = [
            new Date(start.getTime() + (totalDays * 0.2 * 24 * 60 * 60 * 1000)),
            new Date(start.getTime() + (totalDays * 0.5 * 24 * 60 * 60 * 1000)),
            new Date(start.getTime() + (totalDays * 0.8 * 24 * 60 * 60 * 1000)),
            new Date(end)
        ];
        
        milestones = [
            {
                name: 'Analyze vulnerability and requirements',
                description: 'Complete detailed analysis of the vulnerability and remediation requirements',
                targetDate: milestoneDates[0].toISOString().split('T')[0],
                status: 'pending',
                weight: 20
            },
            {
                name: 'Develop remediation plan',
                description: 'Create comprehensive remediation plan with resource requirements and timeline',
                targetDate: milestoneDates[1].toISOString().split('T')[0],
                status: 'pending',
                weight: 30
            },
            {
                name: 'Implement remediation',
                description: 'Execute the remediation plan and apply necessary changes or patches',
                targetDate: milestoneDates[2].toISOString().split('T')[0],
                status: 'pending',
                weight: 30
            },
            {
                name: 'Validate and close',
                description: 'Validate remediation effectiveness and update POAM status to completed',
                targetDate: milestoneDates[3].toISOString().split('T')[0],
                status: 'pending',
                weight: 20
            }
        ];
    }
    
    console.log(`✅ Generated ${milestones.length} milestones for ${controlFamily} control family`);
    return milestones;
}

// Run tests
console.log('=== Testing Milestone Generation ===\n');

// Test 1: SI Control - 30 days
console.log('Test 1: SI Control - 30 days');
const siMilestones = generateMilestonesForControlFamily('SI', '2026-01-20', '2026-02-19');
console.log('Result:', siMilestones.length, 'milestones');
siMilestones.forEach((m, i) => {
    console.log(`  ${i+1}. ${m.name}: ${m.targetDate} (weight: ${m.weight}%)`);
});

console.log('\n');

// Test 2: CM Control - 90 days
console.log('Test 2: CM Control - 90 days');
const cmMilestones = generateMilestonesForControlFamily('CM', '2026-01-20', '2026-04-20');
console.log('Result:', cmMilestones.length, 'milestones');
cmMilestones.forEach((m, i) => {
    console.log(`  ${i+1}. ${m.name}: ${m.targetDate} (weight: ${m.weight}%)`);
});

console.log('\n');

// Test 3: Edge case - Missing dates
console.log('Test 3: Edge case - Missing start date');
const edgeMilestones = generateMilestonesForControlFamily('SI', null, '2026-02-20');
console.log('Result:', edgeMilestones.length, 'milestones');

console.log('\n=== Test Complete ===');
