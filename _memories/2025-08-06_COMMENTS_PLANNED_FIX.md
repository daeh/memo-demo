# Planned Fix: Robust CodeMirror Comment Toggle Implementation

## Design Principles

### 1. Embrace Thebe's Architecture
- Accept that CodeMirror is bundled and not global
- Work with DOM elements as the source of truth
- Don't fight the framework, adapt to it

### 2. Self-Contained Implementation
- No external CDN dependencies
- All functionality implemented locally
- Zero assumptions about global availability

### 3. Progressive Enhancement
- Start working as soon as first editor appears
- Continue working as new editors are added
- Gracefully handle all edge cases

## Implementation Strategy

### Phase 1: Early Detection and Setup

```javascript
// New approach: Start monitoring immediately after Thebe bootstrap
async function setupCommentToggleSystem() {
  console.log('🚀 Initializing comment toggle system...');
  
  // Create a dedicated observer that starts immediately
  const observer = new MutationObserver((mutations) => {
    // Look for CodeMirror instances being added to DOM
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          // Check if this is a CodeMirror element
          if (node.classList?.contains('CodeMirror')) {
            processNewCodeMirrorInstance(node);
          }
          // Check children for CodeMirror elements
          if (node.querySelectorAll) {
            const editors = node.querySelectorAll('.CodeMirror');
            editors.forEach(processNewCodeMirrorInstance);
          }
        }
      }
    }
  });
  
  // Start observing immediately
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // Also process any existing instances
  document.querySelectorAll('.CodeMirror').forEach(processNewCodeMirrorInstance);
  
  return observer;
}
```

### Phase 2: Instance Processing

```javascript
// Process each CodeMirror instance as it appears
function processNewCodeMirrorInstance(element) {
  // Skip if already processed
  if (element.dataset.commentToggleProcessed === 'true') {
    return;
  }
  
  // Wait a tick for CodeMirror to fully initialize
  setTimeout(() => {
    if (!element.CodeMirror) {
      console.warn('Element does not have CodeMirror instance yet');
      return;
    }
    
    const cm = element.CodeMirror;
    
    // First time seeing CodeMirror? Set up the global
    if (!window.CodeMirrorConstructor) {
      window.CodeMirrorConstructor = cm.constructor;
      setupCommentToggleCommand();
      console.log('✅ CodeMirror constructor captured and command created');
    }
    
    // Configure this instance
    configureInstance(cm);
    element.dataset.commentToggleProcessed = 'true';
    console.log('✅ Configured CodeMirror instance for comment toggle');
  }, 50);
}
```

### Phase 3: Command Implementation

```javascript
// Create the comment toggle command once
function setupCommentToggleCommand() {
  const CM = window.CodeMirrorConstructor;
  
  // Ensure commands object exists
  if (!CM.commands) {
    CM.commands = {};
  }
  
  // Implement robust comment toggle
  CM.commands.toggleComment = function(cm) {
    const mode = cm.getMode();
    const commentString = getCommentString(mode);
    
    cm.operation(() => {
      const selections = cm.listSelections();
      
      for (const selection of selections) {
        toggleCommentForSelection(cm, selection, commentString);
      }
    });
  };
}

// Get appropriate comment string for the mode
function getCommentString(mode) {
  const modeMap = {
    'python': '#',
    'javascript': '//',
    'typescript': '//',
    'jsx': '//',
    'tsx': '//',
    'java': '//',
    'c': '//',
    'cpp': '//',
    'csharp': '//',
    'ruby': '#',
    'shell': '#',
    'bash': '#',
    'yaml': '#',
    'r': '#',
    'julia': '#',
    'sql': '--',
    'lua': '--',
    'haskell': '--',
    'elm': '--',
    'rust': '//',
    'go': '//',
    'swift': '//',
    'kotlin': '//',
    'scala': '//',
    'php': '//',
    'perl': '#',
    'html': '<!--',
    'xml': '<!--',
    'css': '/*',
    'scss': '//',
    'less': '//',
    'markdown': '<!--'
  };
  
  const modeName = mode.name?.toLowerCase() || '';
  return modeMap[modeName] || '#';  // Default to # for unknown modes
}

// Toggle comments for a selection
function toggleCommentForSelection(cm, selection, commentString) {
  const from = selection.from();
  const to = selection.to();
  
  // Handle single cursor (no selection)
  if (from.line === to.line && from.ch === to.ch) {
    toggleCommentForLine(cm, from.line, commentString);
    return;
  }
  
  // Handle multi-line selection
  const startLine = from.line;
  const endLine = to.line;
  
  // Determine if we should comment or uncomment
  const shouldComment = shouldCommentRange(cm, startLine, endLine, commentString);
  
  // Apply the operation to all lines
  for (let line = startLine; line <= endLine; line++) {
    if (shouldComment) {
      addCommentToLine(cm, line, commentString);
    } else {
      removeCommentFromLine(cm, line, commentString);
    }
  }
}

// Determine if a range should be commented or uncommented
function shouldCommentRange(cm, startLine, endLine, commentString) {
  for (let line = startLine; line <= endLine; line++) {
    const text = cm.getLine(line);
    if (text.trim() && !text.trim().startsWith(commentString)) {
      return true;  // Found an uncommented line, so we should comment
    }
  }
  return false;  // All lines are commented, so we should uncomment
}

// Toggle comment for a single line
function toggleCommentForLine(cm, lineNum, commentString) {
  const text = cm.getLine(lineNum);
  const trimmed = text.trim();
  
  if (trimmed.startsWith(commentString)) {
    removeCommentFromLine(cm, lineNum, commentString);
  } else if (trimmed) {
    addCommentToLine(cm, lineNum, commentString);
  }
}

// Add comment to a line
function addCommentToLine(cm, lineNum, commentString) {
  const text = cm.getLine(lineNum);
  if (!text.trim()) return;  // Skip empty lines
  
  const indent = text.match(/^\s*/)[0];
  const content = text.slice(indent.length);
  const newText = indent + commentString + ' ' + content;
  
  cm.replaceRange(newText, 
    {line: lineNum, ch: 0}, 
    {line: lineNum, ch: text.length}
  );
}

// Remove comment from a line
function removeCommentFromLine(cm, lineNum, commentString) {
  const text = cm.getLine(lineNum);
  const regex = new RegExp(
    '^(\\s*)' + escapeRegex(commentString) + '\\s?'
  );
  const newText = text.replace(regex, '$1');
  
  if (newText !== text) {
    cm.replaceRange(newText,
      {line: lineNum, ch: 0},
      {line: lineNum, ch: text.length}
    );
  }
}

// Helper to escape regex special characters
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
```

### Phase 4: Instance Configuration

```javascript
// Configure a CodeMirror instance with keyboard shortcuts
function configureInstance(cm) {
  const currentKeys = cm.getOption('extraKeys') || {};
  
  // Create the toggle function for this instance
  const toggleFunction = function(cm) {
    if (window.CodeMirrorConstructor?.commands?.toggleComment) {
      window.CodeMirrorConstructor.commands.toggleComment(cm);
    }
  };
  
  // Set up keyboard shortcuts
  cm.setOption('extraKeys', {
    ...currentKeys,
    'Cmd-/': toggleFunction,      // macOS
    'Ctrl-/': toggleFunction,     // Windows/Linux
    'Cmd-7': toggleFunction,      // Nordic keyboards (where / is Shift-7)
    'Ctrl-7': toggleFunction      // Nordic keyboards Windows/Linux
  });
}
```

### Phase 5: Integration Points

```javascript
// Integration with Thebe bootstrap
async function bootstrapThebe() {
  try {
    // ... existing bootstrap code ...
    
    const thebe = await window.thebe.bootstrap(thebeConfig);
    window.thebeInstance = thebe;
    
    // Start comment toggle system immediately
    setupCommentToggleSystem();
    
    // ... rest of bootstrap ...
  } catch (err) {
    // ... error handling ...
  }
}
```

## Testing Strategy

### Automated Tests

```javascript
// Comprehensive test suite
class CommentToggleTestSuite {
  async runTests() {
    const tests = [
      this.testInstanceDetection,
      this.testCommandCreation,
      this.testSingleLineToggle,
      this.testMultiLineToggle,
      this.testMixedContentToggle,
      this.testIndentationPreservation,
      this.testEmptyLineHandling,
      this.testMultiModeSupport,
      this.testKeyboardShortcuts
    ];
    
    for (const test of tests) {
      await test.call(this);
    }
  }
  
  // Individual test methods...
}
```

### Manual Testing Checklist

- [ ] First editor appears → shortcuts work immediately
- [ ] Additional editors added → shortcuts work on new editors
- [ ] Python code → uses # comments
- [ ] JavaScript code → uses // comments
- [ ] Multi-language support → correct comment syntax
- [ ] Indentation preserved when commenting
- [ ] Empty lines handled gracefully
- [ ] Selection commenting works
- [ ] Single line commenting works
- [ ] Nordic keyboard layout support

## Migration Path

### 1. Remove Old Code
- Remove all `waitForCodeMirror` logic
- Remove CDN addon loading attempts
- Remove global CodeMirror polling

### 2. Add New Implementation
- Add the new detection system
- Add robust comment implementation
- Add comprehensive mode support

### 3. Maintain Backwards Compatibility
- Keep existing test functions
- Keep emergency fix function
- Keep debugging utilities

## Error Handling

### Graceful Degradation
```javascript
try {
  setupCommentToggleSystem();
} catch (error) {
  console.error('Comment toggle setup failed:', error);
  // System continues to work without comment shortcuts
}
```

### User Recovery
```javascript
// Emergency fix remains available
window.fixCommentToggle = function() {
  // Manual implementation as fallback
};
```

## Performance Considerations

### Optimizations
1. **Single Observer**: One MutationObserver for all instances
2. **Debounced Processing**: Batch instance processing
3. **Early Exit**: Skip already-processed elements
4. **Minimal DOM Queries**: Cache selectors where possible

### Memory Management
```javascript
// Clean up observer after reasonable time
setTimeout(() => {
  if (observer && allInstancesProcessed()) {
    observer.disconnect();
  }
}, 60000);  // 1 minute
```

## Documentation Updates

### User Documentation
- Update README with simplified instructions
- Remove "known issues" about localhost
- Add troubleshooting for edge cases

### Developer Documentation
- Document the Thebe bundling behavior
- Explain the DOM-based detection approach
- Provide examples for extending functionality

## Success Metrics

### Functional Requirements
- ✅ Works immediately when first editor appears
- ✅ Works for all subsequent editors
- ✅ No polling or waiting for globals
- ✅ No external dependencies

### Non-Functional Requirements
- ✅ < 100ms to configure each instance
- ✅ < 10KB additional JavaScript
- ✅ Zero console errors in normal operation
- ✅ Works offline (no CDN required)

## Implementation Timeline

### Phase 1: Core Implementation (2 hours)
- Detection system
- Command implementation
- Instance configuration

### Phase 2: Testing (1 hour)
- Automated tests
- Manual testing
- Edge case validation

### Phase 3: Documentation (30 minutes)
- Code comments
- User documentation
- Migration notes

## Summary

This approach represents a **paradigm shift** from waiting for global objects to **actively detecting and configuring instances** as they appear. It's more robust, faster, and better aligned with modern JavaScript bundling practices.

The solution is:
- **Framework-aware**: Works with Thebe's architecture
- **Self-contained**: No external dependencies
- **Progressive**: Enhances as it goes
- **Resilient**: Multiple fallback strategies
- **Performant**: Minimal overhead
- **Maintainable**: Clear, documented code