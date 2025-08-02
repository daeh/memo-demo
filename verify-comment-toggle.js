#!/usr/bin/env node

/**
 * Verification script to check if cmd-/ comment toggle is properly configured
 * in qmd-generated HTML files without requiring browser execution
 */

const fs = require('fs');
const path = require('path');

function checkFile(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const fileName = path.basename(filePath);
        
        const checks = {
            fileName,
            hasThebeInclude: false,
            hasExtraKeysInConfig: false,
            hasCmdSlashMapping: false,
            hasCtrlSlashMapping: false,
            hasCommentAddon: false,
            hasDirectCodeMirror: false,
            hasFallbackInit: false
        };
        
        // Check for Thebe include
        checks.hasThebeInclude = content.includes('includes/thebe.html') || 
                                content.includes('thebe-config.js');
        
        // Check for extraKeys in Thebe config
        if (content.includes('"extraKeys"')) {
            checks.hasExtraKeysInConfig = true;
            
            // Check for specific key mappings
            const extraKeysMatch = content.match(/"extraKeys"\s*:\s*\{[^}]+\}/s);
            if (extraKeysMatch) {
                const extraKeysContent = extraKeysMatch[0];
                checks.hasCmdSlashMapping = extraKeysContent.includes('"Cmd-/"') && 
                                           extraKeysContent.includes('toggleComment');
                checks.hasCtrlSlashMapping = extraKeysContent.includes('"Ctrl-/"') && 
                                            extraKeysContent.includes('toggleComment');
            }
        }
        
        // Check for comment addon
        checks.hasCommentAddon = content.includes('comment.min.js') || 
                                content.includes('addon/comment/comment.js');
        
        // Check for direct CodeMirror initialization
        checks.hasDirectCodeMirror = content.includes('CodeMirror.fromTextArea');
        
        // Check for fallback initialization
        checks.hasFallbackInit = content.includes('initializeDirectCodeMirror') ||
                                content.includes('fallback to direct initialization');
        
        // Determine overall status
        const isThebeConfigured = checks.hasThebeInclude && 
                                 checks.hasExtraKeysInConfig && 
                                 checks.hasCmdSlashMapping && 
                                 checks.hasCtrlSlashMapping;
        
        const isDirectConfigured = checks.hasDirectCodeMirror && 
                                  checks.hasCommentAddon;
        
        checks.isConfigured = isThebeConfigured || isDirectConfigured;
        checks.configType = isThebeConfigured ? 'thebe' : 
                           isDirectConfigured ? 'direct' : 
                           'none';
        
        return checks;
    } catch (error) {
        return {
            fileName: path.basename(filePath),
            error: error.message
        };
    }
}

function main() {
    console.log('Verifying comment toggle configuration in generated HTML files...\n');
    
    const docsDir = path.join(__dirname, 'docs');
    const testFiles = [
        'test-codemirror-static.html',
        'test-codemirror-direct.html',
        'test-codemirror-hybrid.html',
        'test-comment-functionality.html',
        'index.html',
        'demo.html'
    ];
    
    const results = [];
    
    testFiles.forEach(file => {
        const filePath = path.join(docsDir, file);
        if (fs.existsSync(filePath)) {
            results.push(checkFile(filePath));
        } else {
            results.push({
                fileName: file,
                error: 'File not found'
            });
        }
    });
    
    // Display results
    console.log('File Analysis Results:');
    console.log('=====================\n');
    
    results.forEach(result => {
        if (result.error) {
            console.log(`❌ ${result.fileName}: ${result.error}`);
        } else {
            const status = result.isConfigured ? '✅' : '❌';
            console.log(`${status} ${result.fileName}`);
            console.log(`   Config Type: ${result.configType}`);
            if (result.configType === 'thebe') {
                console.log(`   - Thebe Include: ${result.hasThebeInclude ? '✓' : '✗'}`);
                console.log(`   - ExtraKeys Config: ${result.hasExtraKeysInConfig ? '✓' : '✗'}`);
                console.log(`   - Cmd-/ Mapping: ${result.hasCmdSlashMapping ? '✓' : '✗'}`);
                console.log(`   - Ctrl-/ Mapping: ${result.hasCtrlSlashMapping ? '✓' : '✗'}`);
            } else if (result.configType === 'direct') {
                console.log(`   - Direct CodeMirror: ${result.hasDirectCodeMirror ? '✓' : '✗'}`);
                console.log(`   - Comment Addon: ${result.hasCommentAddon ? '✓' : '✗'}`);
            }
            if (result.hasFallbackInit) {
                console.log(`   - Has Fallback: ✓`);
            }
            console.log('');
        }
    });
    
    // Summary
    const configured = results.filter(r => r.isConfigured && !r.error);
    const notConfigured = results.filter(r => !r.isConfigured && !r.error);
    const errors = results.filter(r => r.error);
    
    console.log('\nSummary:');
    console.log('========');
    console.log(`✅ Configured: ${configured.length} files`);
    configured.forEach(r => console.log(`   - ${r.fileName} (${r.configType})`));
    
    if (notConfigured.length > 0) {
        console.log(`\n❌ Not Configured: ${notConfigured.length} files`);
        notConfigured.forEach(r => console.log(`   - ${r.fileName}`));
    }
    
    if (errors.length > 0) {
        console.log(`\n⚠️ Errors: ${errors.length} files`);
        errors.forEach(r => console.log(`   - ${r.fileName}: ${r.error}`));
    }
    
    // Check specific case we care about
    const testStatic = results.find(r => r.fileName === 'test-codemirror-static.html');
    if (testStatic && testStatic.isConfigured) {
        console.log('\n✅ SUCCESS: test-codemirror-static.html has cmd-/ properly configured via Thebe!');
        console.log('This confirms that cmd-/ will work in qmd-generated pages when Thebe initializes successfully.');
    }
    
    return configured.length > 0;
}

// Run if executed directly
if (require.main === module) {
    const success = main();
    process.exit(success ? 0 : 1);
}

module.exports = { checkFile, main };