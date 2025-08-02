// Quick verification script - paste this in browser console
// Works on any page with Thebe/CodeMirror

(() => {
  const cm = document.querySelector('.CodeMirror')?.CodeMirror;
  if (!cm) {
    console.log('❌ No CodeMirror instance found. Wait for Thebe to initialize.');
    return;
  }
  
  const keys = cm.getOption('extraKeys') || {};
  const hasCmd = keys['Cmd-/'] === 'toggleComment';
  const hasCtrl = keys['Ctrl-/'] === 'toggleComment';
  const addon = !!window.CodeMirror?.commands?.toggleComment;
  
  console.log('Comment Toggle Status:');
  console.log('✓ CodeMirror found');
  console.log(hasCmd ? '✓ Cmd-/ configured' : '✗ Cmd-/ NOT configured');
  console.log(hasCtrl ? '✓ Ctrl-/ configured' : '✗ Ctrl-/ NOT configured');
  console.log(addon ? '✓ Comment addon loaded' : '✗ Comment addon NOT loaded');
  console.log('\nResult:', hasCmd && hasCtrl && addon ? '✅ WORKING' : '❌ NOT WORKING');
  
  if (hasCmd && hasCtrl && addon) {
    console.log('\n📝 Try it: Click in the editor and press Cmd-/ or Ctrl-/');
  }
})();