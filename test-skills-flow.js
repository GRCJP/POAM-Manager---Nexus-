/**
 * Test script to verify skills architecture is working correctly
 * Run this in browser console after loading the app
 */

async function testSkillsFlow() {
    console.log('🧪 TESTING SKILLS FLOW\n');
    
    // Sample finding data
    const sampleFindings = [
        {
            title: 'Microsoft Visual C++ Redistributable Installer Elevation of Privilege Vulnerability',
            host: 'server01.example.com',
            ip: '192.168.1.10',
            severity: 'high',
            status: 'ACTIVE',
            solution: 'Customers are advised to update to latest version of Microsoft Visual C++ Redistributable.',
            qid: ['12345'],
            cve: ['CVE-2024-1234'],
            firstDetected: null,
            operatingSystem: 'Windows Server 2019'
        },
        {
            title: 'VMware Tools Authentication Bypass Vulnerability',
            host: 'server02.example.com',
            ip: '192.168.1.11',
            severity: 'low',
            status: 'ACTIVE',
            solution: 'Upgrade VMware Tools to version 12.3.0 or later',
            qid: ['67890'],
            cve: ['CVE-2023-5678'],
            firstDetected: null,
            operatingSystem: 'VMware ESXi'
        }
    ];
    
    console.log('📋 Step 1: Test ClassificationSkill');
    console.log('Input findings:', sampleFindings.length);
    
    if (!window.skillsIntegration) {
        console.error('❌ skillsIntegration not available');
        return;
    }
    
    await window.skillsIntegration.init();
    
    const classificationSkill = window.skillsIntegration.orchestrator.skills.get('classification');
    if (!classificationSkill) {
        console.error('❌ ClassificationSkill not found');
        return;
    }
    
    const classResult = await classificationSkill.execute({ findings: sampleFindings });
    console.log('Classification result:', classResult.success ? '✅ SUCCESS' : '❌ FAILED');
    
    if (classResult.success) {
        const classified = classResult.data.findings;
        console.log('Classified findings:', classified.length);
        console.log('First finding has remediation?', classified[0].remediation ? '✅ YES' : '❌ NO');
        if (classified[0].remediation) {
            console.log('Remediation object:', {
                remediationType: classified[0].remediation.remediationType,
                component: classified[0].remediation.component,
                platform: classified[0].remediation.platform,
                targetingStrategy: classified[0].remediation.targetingStrategy
            });
        }
        
        console.log('\n📋 Step 2: Test GroupingSkill');
        const groupingSkill = window.skillsIntegration.orchestrator.skills.get('grouping');
        if (!groupingSkill) {
            console.error('❌ GroupingSkill not found');
            return;
        }
        
        const groupResult = await groupingSkill.execute({ findings: classified });
        console.log('Grouping result:', groupResult.success ? '✅ SUCCESS' : '❌ FAILED');
        
        if (groupResult.success) {
            const groups = groupResult.data.groups;
            console.log('Groups created:', groups.length);
            console.log('First group has remediation?', groups[0].remediation ? '✅ YES' : '❌ NO');
            if (groups[0].remediation) {
                console.log('Group remediation object:', {
                    remediationType: groups[0].remediation.remediationType,
                    component: groups[0].remediation.component,
                    platform: groups[0].remediation.platform
                });
            } else {
                console.error('❌ CRITICAL: Group missing remediation object!');
                console.log('Group structure:', Object.keys(groups[0]));
            }
            
            console.log('\n📋 Step 3: Test Map Conversion (Pipeline Step)');
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
            
            console.log('Map size:', groupsMap.size);
            const firstMapGroup = groupsMap.values().next().value;
            console.log('First map group has remediation?', firstMapGroup.remediation ? '✅ YES' : '❌ NO');
            if (firstMapGroup.remediation) {
                console.log('Map group remediation:', {
                    remediationType: firstMapGroup.remediation.remediationType,
                    component: firstMapGroup.remediation.component
                });
            } else {
                console.error('❌ CRITICAL: Remediation lost during Map conversion!');
            }
            
            console.log('\n✅ SKILLS FLOW TEST COMPLETE');
            return {
                classificationWorks: classResult.success && classified[0].remediation !== undefined,
                groupingWorks: groupResult.success && groups[0].remediation !== undefined,
                mapConversionWorks: firstMapGroup.remediation !== undefined
            };
        }
    }
}

// Auto-run if in browser
if (typeof window !== 'undefined') {
    console.log('💡 Run testSkillsFlow() in console to test skills architecture');
}
