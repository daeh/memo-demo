# Quick Fix for Comment Toggle

## The Fix Applied

I've fixed the timing issue where CodeMirror wasn't being detected properly. The changes include:

1. **Better CodeMirror Detection** - Checks multiple ways CodeMirror might be loaded
2. **Retry Mechanism** - Automatically retries loading the addon when CodeMirror becomes available
3. **Fallback Implementation** - Manual comment toggle implementation if the addon fails to load
4. **Direct Function Binding** - Binds functions directly to keys as a fallback

## Testing the Fix

After deploying the updated site:

### Quick Test
```javascript
// In browser console after activating Thebe and running a cell
window.quickCommentTest()
```

### If It's Still Not Working

Run this in the browser console to force configuration:

```javascript
// Force load the addon and configure all instances
(async function fixCommentToggle() {
  console.log('🔧 Forcing comment toggle fix...');
  
  // Step 1: Ensure CodeMirror is available globally
  const cmElements = document.querySelectorAll('.CodeMirror');
  if (cmElements.length > 0 && cmElements[0].CodeMirror && !window.CodeMirror) {
    window.CodeMirror = cmElements[0].CodeMirror.constructor;
    console.log('✅ Made CodeMirror global');
  }
  
  // Step 2: Implement manual toggle
  if (window.CodeMirror && (!window.CodeMirror.commands || !window.CodeMirror.commands.toggleComment)) {
    if (!window.CodeMirror.commands) window.CodeMirror.commands = {};
    
    window.CodeMirror.commands.toggleComment = function(cm) {
      const sel = cm.getSelection();
      const cursor = cm.getCursor();
      const line = cm.getLine(cursor.line);
      const mode = cm.getMode();
      const comment = mode.name === 'python' ? '# ' : '// ';
      
      if (sel) {
        // Toggle selection
        const lines = sel.split('\n');
        const toggled = lines.map(l => 
          l.trim().startsWith(comment.trim()) ? 
          l.replace(new RegExp('^\\s*' + comment.trim() + '\\s?'), '') : 
          comment + l
        ).join('\n');
        cm.replaceSelection(toggled);
      } else {
        // Toggle current line
        const toggled = line.trim().startsWith(comment.trim()) ?
          line.replace(new RegExp('^(\\s*)' + comment.trim() + '\\s?'), '$1') :
          line.replace(/^(\s*)/, '$1' + comment);
        cm.replaceRange(toggled, {line: cursor.line, ch: 0}, {line: cursor.line, ch: line.length});
      }
    };
    console.log('✅ Manual toggle implemented');
  }
  
  // Step 3: Configure all instances
  cmElements.forEach((el, i) => {
    if (el.CodeMirror) {
      const cm = el.CodeMirror;
      const extraKeys = cm.getOption('extraKeys') || {};
      
      // Use direct function binding
      const toggleFn = (cm) => {
        if (window.CodeMirror?.commands?.toggleComment) {
          window.CodeMirror.commands.toggleComment(cm);
        }
      };
      
      cm.setOption('extraKeys', {
        ...extraKeys,
        'Cmd-/': toggleFn,
        'Ctrl-/': toggleFn
      });
      
      console.log(`✅ Configured instance ${i + 1}`);
    }
  });
  
  console.log('✅ Comment toggle should now work! Try cmd-/ or Ctrl-/');
})();
```

## What Was Wrong

The original issue was that:
1. CodeMirror loads asynchronously through Thebe
2. The comment addon was trying to load before CodeMirror was available
3. The timing was inconsistent between different page loads

## What's Fixed Now

1. **Multiple detection methods** - Checks for CodeMirror in multiple places
2. **Retry logic** - Keeps checking until CodeMirror is found
3. **Fallback implementation** - Works even if the CDN addon fails
4. **Direct binding** - Binds functions directly to avoid string lookup issues

## Verify It's Working

After running the fix, test with:
1. Click in a CodeMirror editor
2. Press `Cmd-/` (Mac) or `Ctrl-/` (Windows/Linux)
3. The line should toggle between commented and uncommented

Or run:
```javascript
window.debugCommentToggle.testComment(0)
```

This will test the first editor and show you the results in the console.