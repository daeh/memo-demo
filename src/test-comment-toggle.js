// Comprehensive test suite for CodeMirror comment toggle functionality
// Run this in the browser console to test if cmd-/ is working

(function() {
  console.clear();
  console.log('🧪 Running Comment Toggle Test Suite...\n');
  
  // Wait for CodeMirror instances to be ready
  function waitForCodeMirror(callback, maxAttempts = 20) {
    let attempts = 0;
    const check = () => {
      const instances = document.querySelectorAll('.CodeMirror');
      if (instances.length > 0 && window.CodeMirror) {
        callback();
      } else if (attempts < maxAttempts) {
        attempts++;
        setTimeout(check, 500);
      } else {
        console.error('❌ No CodeMirror instances found after ' + (maxAttempts * 0.5) + ' seconds');
      }
    };
    check();
  }
  
  // Main test function
  function runTests() {
    const results = {
      environment: {
        codeAddonLoaded: !!window.CodeMirror?.commands?.toggleComment,
        thebeLoaded: !!window.thebe,
        thebeBootstrapped: !!window.thebeInstance,
        codemirrorVersion: window.CodeMirror?.version || 'unknown'
      },
      instances: [],
      summary: {
        total: 0,
        configured: 0,
        working: 0,
        errors: []
      }
    };
    
    // Test each CodeMirror instance
    const cmElements = document.querySelectorAll('.CodeMirror');
    results.summary.total = cmElements.length;
    
    cmElements.forEach((el, index) => {
      if (el.CodeMirror) {
        const cm = el.CodeMirror;
        let extraKeys = {};
        let error = null;
        
        try {
          extraKeys = cm.getOption('extraKeys') || {};
        } catch (e) {
          error = e.message;
        }
        
        const hasCmd = extraKeys['Cmd-/'] === 'toggleComment';
        const hasCtrl = extraKeys['Ctrl-/'] === 'toggleComment';
        const configured = hasCmd && hasCtrl;
        
        // Test if toggle actually works
        let toggleWorks = false;
        if (configured && window.CodeMirror?.commands?.toggleComment) {
          try {
            // Save current selection
            const cursor = cm.getCursor();
            const line = cm.getLine(cursor.line);
            
            // Try to toggle comment
            window.CodeMirror.commands.toggleComment(cm);
            const newLine = cm.getLine(cursor.line);
            
            // Check if line changed
            toggleWorks = line !== newLine;
            
            // Toggle back
            window.CodeMirror.commands.toggleComment(cm);
          } catch (e) {
            error = 'Toggle test failed: ' + e.message;
          }
        }
        
        const instanceData = {
          index,
          element: el,
          configured,
          hasCmd,
          hasCtrl,
          toggleWorks,
          extraKeysCount: Object.keys(extraKeys).length,
          error
        };
        
        results.instances.push(instanceData);
        
        if (configured) results.summary.configured++;
        if (toggleWorks) results.summary.working++;
        if (error) results.summary.errors.push(`Instance ${index}: ${error}`);
      }
    });
    
    // Display results
    console.group('📊 Test Results');
    
    console.group('Environment');
    console.table(results.environment);
    console.groupEnd();
    
    console.group('CodeMirror Instances');
    console.table(results.instances.map(i => ({
      index: i.index,
      'Cmd-/': i.hasCmd ? '✅' : '❌',
      'Ctrl-/': i.hasCtrl ? '✅' : '❌',
      configured: i.configured ? '✅' : '❌',
      working: i.toggleWorks ? '✅' : '❌',
      error: i.error || 'none'
    })));
    console.groupEnd();
    
    console.group('Summary');
    console.log(`Total instances: ${results.summary.total}`);
    console.log(`Configured: ${results.summary.configured}/${results.summary.total} (${Math.round(results.summary.configured/results.summary.total*100)}%)`);
    console.log(`Working: ${results.summary.working}/${results.summary.total} (${Math.round(results.summary.working/results.summary.total*100)}%)`);
    if (results.summary.errors.length > 0) {
      console.error('Errors:', results.summary.errors);
    }
    console.groupEnd();
    
    console.groupEnd();
    
    // Overall status
    const allWorking = results.summary.working === results.summary.total && results.summary.total > 0;
    if (allWorking) {
      console.log('\n✅ All tests passed! Comment toggle (cmd-/) is working correctly.');
    } else if (results.summary.working > 0) {
      console.log('\n⚠️ Partial success. Some instances are working but not all.');
    } else {
      console.log('\n❌ Comment toggle is not working. Check the detailed results above.');
    }
    
    // Provide manual test instructions
    console.log('\n📝 Manual Test Instructions:');
    console.log('1. Click in any code editor on the page');
    console.log('2. Press Cmd-/ (Mac) or Ctrl-/ (Windows/Linux)');
    console.log('3. The current line should toggle between commented/uncommented');
    console.log('4. Select multiple lines and press the shortcut to toggle all selected lines');
    
    return results;
  }
  
  // Run the tests
  waitForCodeMirror(() => {
    // Wait a bit more for Thebe to fully initialize
    setTimeout(runTests, 1000);
  });
})();

// Also expose simpler test function
window.quickCommentTest = function() {
  const cm = document.querySelector('.CodeMirror')?.CodeMirror;
  if (!cm) {
    console.error('No CodeMirror instance found');
    return false;
  }
  
  const keys = cm.getOption('extraKeys') || {};
  const configured = keys['Cmd-/'] === 'toggleComment' && keys['Ctrl-/'] === 'toggleComment';
  const addonLoaded = !!window.CodeMirror?.commands?.toggleComment;
  
  console.log('Quick test:', {
    configured,
    addonLoaded,
    ready: configured && addonLoaded
  });
  
  return configured && addonLoaded;
};