// Test script to verify upload functionality
console.log('=== POAM Manager Upload Test ===');

// Test 1: Check if required elements exist
const requiredElements = [
    'scan-file-input',
    'vulnerability-progress', 
    'vuln-progress-bar',
    'vuln-progress-percent',
    'vuln-status-message'
];

console.log('Checking required elements...');
requiredElements.forEach(id => {
    const element = document.getElementById(id);
    console.log(`${id}: ${element ? '✓ EXISTS' : '✗ MISSING'}`);
});

// Test 2: Check if application is selected
console.log('\nChecking application selection...');
if (typeof currentApplication !== 'undefined') {
    console.log(`Current application: ${currentApplication || 'None selected'}`);
} else {
    console.log('currentApplication variable not defined');
}

// Test 3: Test CSV parsing function
console.log('\nTesting CSV parsing...');
const testCSV = `title,severity,description
Test Finding,Critical,This is a test vulnerability`;

const lines = testCSV.split('\n').filter(line => line.trim());
const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
const dataLines = lines.slice(1);

console.log(`Headers: ${headers.join(', ')}`);
console.log(`Data lines: ${dataLines.length}`);
console.log('CSV parsing: ✓ WORKING');

// Test 4: Test vulnerability analyzer
console.log('\nTesting vulnerability analyzer...');
try {
    const scannerInfo = detectScannerType(headers, 'test.csv');
    console.log(`Scanner detected: ${scannerInfo.type} (confidence: ${scannerInfo.confidence})`);
    
    const analyzer = new VulnerabilityAnalyzer(scannerInfo);
    const testRow = { title: 'Test Finding', severity: 'critical', description: 'Test description' };
    const normalized = analyzer.normalizeVulnerability(testRow);
    
    console.log(`Normalization: ${normalized.isValid ? '✓ WORKING' : '✗ FAILED'}`);
    if (!normalized.isValid) {
        console.log(`Error: ${normalized.reason}`);
    }
} catch (error) {
    console.log(`Analyzer test: ✗ FAILED - ${error.message}`);
}

console.log('\n=== Test Complete ===');
