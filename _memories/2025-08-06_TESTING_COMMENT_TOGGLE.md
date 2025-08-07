# Testing CodeMirror Comment Toggle (cmd-/)

## Summary

The cmd-/ comment toggle functionality is **fully implemented** in the codebase. This document provides testing procedures and debugging commands to verify it works correctly.

## Implementation Status ✅

- **Static Configuration**: Defined in `/src/includes/thebe.html` with proper extraKeys
- **Dynamic Enhancement**: Implemented in `/src/assets/js/thebe-config.js`
- **Comment Addon Loading**: Automatically loads from CDN when Thebe initializes
- **Instance Configuration**: MutationObserver detects and configures new editors
- **Test Infrastructure**: Comprehensive debugging and testing functions available

## Testing Environments

### 1. Local Test Page (No Thebe Required)

Open the test page in your browser:
```bash
# Build the site first
quarto render

# Open the test page
open docs/test-codemirror-comment.html
```

This page works without Thebe/Binder and allows you to:
- Test cmd-/ (Mac) or Ctrl-/ (Windows/Linux) directly
- Run automated tests
- Debug configuration issues

### 2. Production Site (With Thebe)

Deploy to a web server (GitHub Pages, Netlify, etc.) because:
- **CORS prevents Thebe from connecting to Binder on localhost**
- Full functionality requires a deployed environment

Steps:
1. Deploy the site
2. Click "Activate" to start Thebe
3. Run a code cell to create CodeMirror editor
4. Use cmd-/ to toggle comments

## Browser Console Commands

### Quick Tests

```javascript
// Basic test - check if everything is configured
window.testCommentToggle()

// Quick functional test
window.quickCommentTest()

// Run comprehensive test suite
window.runCommentToggleTests()
```

### Debugging Commands

```javascript
// Check environment setup
window.debugCommentToggle.checkEnvironment()

// Check all CodeMirror instances
window.debugCommentToggle.checkInstances()

// Force reconfiguration of all instances
window.debugCommentToggle.forceReconfigure()

// Test comment on specific instance (0 = first)
window.debugCommentToggle.testComment(0)

// Monitor for new instances (useful during Thebe initialization)
window.debugCommentToggle.monitorNewInstances(10000) // 10 seconds
```

## Troubleshooting

### Issue: "No CodeMirror instances found"

**On localhost:**
- This is expected! Thebe cannot connect to Binder from localhost due to CORS
- Use the test page: `docs/test-codemirror-comment.html`

**On deployed site:**
1. Make sure you clicked "Activate" to start Thebe
2. Run at least one code cell to create an editor
3. Check console for errors

### Issue: "Comment addon not loaded"

Run in console:
```javascript
// Check if addon is loaded
window.CodeMirror?.commands?.toggleComment
// Should return a function, not undefined

// Force reload the addon
window.debugCommentToggle.forceReconfigure()
```

### Issue: "Keyboard shortcut doesn't work"

1. Check configuration:
```javascript
window.debugCommentToggle.checkInstances()
```

2. Verify extraKeys are set:
```javascript
document.querySelector('.CodeMirror').CodeMirror.getOption('extraKeys')
// Should show: {'Cmd-/': 'toggleComment', 'Ctrl-/': 'toggleComment'}
```

3. Force reconfiguration:
```javascript
window.debugCommentToggle.forceReconfigure()
```

### Issue: "Works sometimes but not consistently"

This usually indicates timing issues. The implementation already handles this with:
- MutationObserver for dynamic detection
- Delayed configuration attempts
- Instance monitoring

To debug:
```javascript
// Monitor new instances as they're created
window.debugCommentToggle.monitorNewInstances(30000) // 30 seconds
```

## Expected Behavior

When working correctly:

1. **Single Line**: Places cursor on a line and press cmd-/ 
   - Adds `# ` at the beginning (Python)
   - Adds `// ` at the beginning (JavaScript)
   - Pressing again removes the comment

2. **Multiple Lines**: Select lines and press cmd-/
   - Comments/uncomments all selected lines
   - Preserves indentation

3. **Empty Lines**: Handles gracefully without adding unnecessary comments

## Test Checklist

- [ ] Test page loads without errors
- [ ] CodeMirror instances are created
- [ ] cmd-/ works on Mac
- [ ] Ctrl-/ works on Windows/Linux
- [ ] Single line commenting works
- [ ] Multi-line commenting works
- [ ] Comment removal works
- [ ] Indentation is preserved
- [ ] Works with Python code
- [ ] Works with JavaScript code (if applicable)

## Success Criteria

Run this in the browser console on a deployed site:
```javascript
await window.runCommentToggleTests()
```

You should see:
- ✅ All environment tests pass
- ✅ All configuration tests pass
- ✅ All functionality tests pass
- ✅ All keyboard shortcut tests pass
- Success rate: 100%

## Additional Notes

- The implementation uses CodeMirror 5.65.2's comment addon
- Configuration is applied both statically (Thebe config) and dynamically (JavaScript)
- The system is resilient with multiple fallback strategies
- CORS prevents local testing with Thebe - this is expected behavior

## Quick Start for Testing

1. **Local Testing (Recommended)**:
   ```bash
   quarto render
   open docs/test-codemirror-comment.html
   ```

2. **Production Testing**:
   - Deploy to GitHub Pages
   - Open any demo page
   - Click "Activate"
   - Run a code cell
   - Press cmd-/ in the editor

3. **Verify Success**:
   ```javascript
   // In browser console
   window.quickCommentTest()
   ```

If all tests pass, the feature is working correctly!