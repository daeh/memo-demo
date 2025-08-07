// Test script for minimal-codemirror.html
// Paste this in the browser console on http://localhost:4200/minimal-codemirror.html

(function() {
    console.clear();
    console.log('Testing minimal CodeMirror cmd-/ functionality...\n');
    
    // Check if CodeMirror is loaded
    if (typeof CodeMirror === 'undefined') {
        console.error('❌ CodeMirror is not loaded!');
        return false;
    }
    console.log('✅ CodeMirror library is loaded');
    
    // Check if comment command exists
    if (!CodeMirror.commands.toggleComment) {
        console.error('❌ toggleComment command not found!');
        return false;
    }
    console.log('✅ toggleComment command is available');
    
    // Find CodeMirror instance
    const cmElement = document.querySelector('.CodeMirror');
    if (!cmElement || !cmElement.CodeMirror) {
        console.error('❌ No CodeMirror instance found!');
        return false;
    }
    console.log('✅ CodeMirror instance found');
    
    const editor = cmElement.CodeMirror;
    
    // Check extraKeys configuration
    const extraKeys = editor.getOption('extraKeys') || {};
    const hasCmdSlash = extraKeys['Cmd-/'] === 'toggleComment';
    const hasCtrlSlash = extraKeys['Ctrl-/'] === 'toggleComment';
    
    console.log(`✅ Cmd-/ configured: ${hasCmdSlash}`);
    console.log(`✅ Ctrl-/ configured: ${hasCtrlSlash}`);
    
    // Test actual toggle functionality
    console.log('\nTesting toggle functionality...');
    const cursor = editor.getCursor();
    const lineBefore = editor.getLine(cursor.line);
    console.log(`Line before: "${lineBefore}"`);
    
    // Execute toggle
    CodeMirror.commands.toggleComment(editor);
    const lineAfter = editor.getLine(cursor.line);
    console.log(`Line after: "${lineAfter}"`);
    
    // Check if it worked
    const toggleWorked = lineBefore !== lineAfter;
    if (toggleWorked) {
        console.log('✅ Toggle worked! Line was modified.');
        // Toggle back
        CodeMirror.commands.toggleComment(editor);
        console.log('✅ Toggled back to original.');
    } else {
        console.log('❌ Toggle did not modify the line.');
    }
    
    // Summary
    console.log('\n=== SUMMARY ===');
    const allGood = hasCmdSlash && hasCtrlSlash && toggleWorked;
    if (allGood) {
        console.log('✅ cmd-/ is FULLY FUNCTIONAL in this minimal qmd file!');
        console.log('\nThis proves that qmd files CAN have working cmd-/ without Thebe.');
    } else {
        console.log('❌ Something is not working correctly.');
    }
    
    return allGood;
})();