// Browser-based test script to verify cmd-/ functionality
// This simulates and tests CodeMirror comment toggle in the browser environment

const puppeteer = require('puppeteer');

async function testCommentToggle() {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    // Enable console logging
    page.on('console', msg => console.log('Browser console:', msg.text()));
    page.on('pageerror', error => console.error('Page error:', error));
    
    try {
        // Test the direct CodeMirror page
        console.log('Testing test-codemirror-direct.html...');
        await page.goto('http://localhost:4200/test-codemirror-direct.html', { 
            waitUntil: 'networkidle2',
            timeout: 30000 
        });
        
        // Wait for CodeMirror to initialize
        await page.waitForTimeout(2000);
        
        // Run tests in browser context
        const testResults = await page.evaluate(() => {
            // Check if CodeMirror is loaded
            if (typeof CodeMirror === 'undefined') {
                return { error: 'CodeMirror not loaded' };
            }
            
            // Check if comment command exists
            if (!CodeMirror.commands.toggleComment) {
                return { error: 'toggleComment command not available' };
            }
            
            // Get first CodeMirror instance
            const cmElement = document.querySelector('.CodeMirror');
            if (!cmElement || !cmElement.CodeMirror) {
                return { error: 'No CodeMirror instance found' };
            }
            
            const cm = cmElement.CodeMirror;
            
            // Check extraKeys configuration
            const extraKeys = cm.getOption('extraKeys');
            const hasCmd = extraKeys && extraKeys['Cmd-/'] === 'toggleComment';
            const hasCtrl = extraKeys && extraKeys['Ctrl-/'] === 'toggleComment';
            
            // Test toggle functionality
            const cursor = cm.getCursor();
            const lineBefore = cm.getLine(cursor.line);
            
            // Execute toggle
            CodeMirror.commands.toggleComment(cm);
            const lineAfter = cm.getLine(cursor.line);
            
            // Toggle back
            CodeMirror.commands.toggleComment(cm);
            const lineRestored = cm.getLine(cursor.line);
            
            return {
                success: true,
                codemirrorLoaded: true,
                commandAvailable: true,
                extraKeysConfigured: hasCmd && hasCtrl,
                toggleWorked: lineBefore !== lineAfter,
                restoreWorked: lineBefore === lineRestored,
                details: {
                    hasCmd,
                    hasCtrl,
                    lineBefore: lineBefore.substring(0, 50),
                    lineAfter: lineAfter.substring(0, 50)
                }
            };
        });
        
        console.log('\nTest Results for test-codemirror-direct.html:');
        console.log(JSON.stringify(testResults, null, 2));
        
        // Now test the Thebe-integrated page
        console.log('\n\nTesting test-codemirror-static.html (with Thebe)...');
        await page.goto('http://localhost:4200/test-codemirror-static.html', { 
            waitUntil: 'networkidle2',
            timeout: 30000 
        });
        
        // Wait for potential Thebe initialization
        await page.waitForTimeout(3000);
        
        // Check if Thebe created any CodeMirror instances
        const thebeResults = await page.evaluate(() => {
            const cmElements = document.querySelectorAll('.CodeMirror');
            
            if (cmElements.length === 0) {
                // No CodeMirror instances - check for Thebe
                return {
                    codemirrorInstances: 0,
                    thebeLoaded: typeof window.thebe !== 'undefined',
                    thebeInstance: typeof window.thebeInstance !== 'undefined',
                    textareas: document.querySelectorAll('textarea[data-executable="true"]').length,
                    error: 'No CodeMirror instances created by Thebe'
                };
            }
            
            // Test first instance
            const cm = cmElements[0].CodeMirror;
            const extraKeys = cm.getOption('extraKeys');
            
            return {
                codemirrorInstances: cmElements.length,
                extraKeysConfigured: extraKeys && extraKeys['Cmd-/'] === 'toggleComment',
                thebeLoaded: typeof window.thebe !== 'undefined'
            };
        });
        
        console.log('\nTest Results for test-codemirror-static.html:');
        console.log(JSON.stringify(thebeResults, null, 2));
        
        // Final summary
        const directPageWorks = testResults.success && testResults.extraKeysConfigured && testResults.toggleWorked;
        console.log('\n========== SUMMARY ==========');
        console.log(`Direct CodeMirror page (no Thebe): ${directPageWorks ? '✅ WORKING' : '❌ NOT WORKING'}`);
        console.log(`Thebe-integrated page: ${thebeResults.codemirrorInstances > 0 ? 'Has instances' : 'No instances (expected locally)'}`);
        
        return directPageWorks;
        
    } catch (error) {
        console.error('Test error:', error);
        return false;
    } finally {
        await browser.close();
    }
}

// Run the test if this file is executed directly
if (require.main === module) {
    testCommentToggle().then(success => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = testCommentToggle;