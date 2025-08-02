/**
 * Thebe Configuration for Memo
 * Follows Thebe best practices from documentation
 */

(function () {
  "use strict";

  // Cache DOM queries
  const DOM = {
    getStatusWidget: () => document.querySelector(".thebe-status"),
    getControlsContainer: () => document.querySelector(".thebe-controls"),
    getActionsContainer: () => document.querySelector(".thebe-actions"),
    getRunButtons: () => document.querySelectorAll(".thebe-button.thebe-run-button"),
    getCells: () => document.querySelectorAll(".thebe-cell"),
    getSourceCells: () => document.querySelectorAll("div.sourceCode pre")
  };

  // ---------- UTILITY FUNCTIONS ----------
  const utils = {
    loadCSS(href) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      document.head.appendChild(link);
      return Promise.resolve();
    },

    debounce(func, wait) {
      let timeout;
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(timeout);
          func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    },

    waitForElement(selector, timeout = 5000) {
      return new Promise((resolve, reject) => {
        const startTime = Date.now();
        const checkElement = () => {
          const element = document.querySelector(selector);
          if (element) {
            resolve(element);
          } else if (Date.now() - startTime > timeout) {
            reject(new Error(`Element ${selector} not found after ${timeout}ms`));
          } else {
            requestAnimationFrame(checkElement);
          }
        };
        checkElement();
      });
    }
  };


  // ---------- BOOTSTRAP & INITIALIZATION ----------
  async function bootstrapThebe() {
    try {
      // Load CodeMirror theme CSS
      await utils.loadCSS("https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.2/theme/neo.min.css");
      
      // Load CodeMirror comment addon for toggle comment functionality
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.2/addon/comment/comment.min.js';
      document.head.appendChild(script);
      await new Promise((resolve) => {
        script.onload = resolve;
        script.onerror = () => {
          console.warn('Failed to load CodeMirror comment addon, comment toggling may not work');
          resolve();
        };
      });
      
      // Ensure comment addon is fully loaded before proceeding
      await new Promise((resolve) => {
        const checkAddon = () => {
          if (window.CodeMirror && window.CodeMirror.commands && window.CodeMirror.commands.toggleComment) {
            console.log('✅ CodeMirror comment addon loaded successfully');
            resolve();
          } else {
            setTimeout(checkAddon, 50);
          }
        };
        checkAddon();
      });
      
      // Set up observer to manage UI elements
      setupMutationObserver();
      
      // Get Thebe configuration from the script tag
      const configScript = document.querySelector('script[type="text/x-thebe-config"]');
      const thebeConfig = configScript ? JSON.parse(configScript.textContent) : {};
      
      console.log('🚀 Starting Thebe bootstrap with config:', thebeConfig);
      
      // Bootstrap Thebe using the configuration
      const thebe = await window.thebe.bootstrap(thebeConfig);
      
      console.log('✅ Thebe bootstrap completed:', thebe);
      
      // Store the thebe instance globally
      window.thebeInstance = thebe;
      
      // Mount status widget if configured
      if (thebeConfig.mountStatusWidget) {
        console.log('🎛️ Mounting status widget...');
        window.thebe.mountStatusWidget();
      }

      // Set up event listeners for Thebe events
      setupThebeEventListeners(thebe);
      
      // Set up button functionality
      setupThebeButtons();
      
      // Start API-based monitoring instead of DOM parsing
      monitorThebeStatus();
      
      return thebe;
    } catch (err) {
      console.error("Thebe bootstrap failed:", err);
      
      // Check if it's a CORS error
      if (err.message?.includes('CORS') || err.message?.includes('cors') || 
          err.toString().includes('CORS') || err.toString().includes('Access-Control')) {
        console.error('❌ CORS Error: Cannot connect to Binder from localhost');
        console.log('💡 Solutions:');
        console.log('  1. Use JupyterLite (set useJupyterLite: true)');
        console.log('  2. Deploy to a server instead of localhost');
        console.log('  3. Use a CORS proxy');
        updateStatusWidget('cors-error');
      } else {
        updateStatusWidget('failed');
      }
      
      throw err;
    }
  }

  function setupMutationObserver() {
    const observer = new MutationObserver(utils.debounce((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check if this is a run button being added
            if (node.classList?.contains('thebe-run-button')) {
              console.log('🔍 Run button detected - checking if we should show it');
              
              // If we can see busy/idle kernel activity, the kernel is ready
              const hasKernelActivity = window.thebeInstance?.session?.kernel;
              if (hasKernelActivity) {
                console.log('✅ Kernel detected - showing run button');
                node.style.display = '';
                node.style.visibility = 'visible';
                node.style.opacity = '1';
                
                // Also update our state
                thebeState.isKernelReady = true;
                updateConnectionState();
              } else {
                console.log('❌ No kernel - hiding run button');
                node.style.display = 'none';
              }
            }
            
            // Check for run buttons within added nodes
            const runButtons = node.querySelectorAll?.('.thebe-button.thebe-run-button');
            runButtons?.forEach(btn => {
              console.log('🔍 Run button found in added node');
              const hasKernelActivity = window.thebeInstance?.session?.kernel;
              if (hasKernelActivity) {
                console.log('✅ Kernel active - showing run button');
                btn.style.display = '';
                btn.style.visibility = 'visible';
                btn.style.opacity = '1';
                thebeState.isKernelReady = true;
                updateConnectionState();
              } else {
                btn.style.display = 'none';
              }
            });
          }
        });
      });
    }, 100));
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    return observer;
  }

  // Track Thebe state using official API
  let thebeState = {
    server: null,
    session: null, 
    kernel: null,
    isServerReady: false,
    isSessionReady: false,
    isKernelReady: false,
    startupPhase: true
  };

  function setupThebeEventListeners(thebe) {
    console.log('Setting up official Thebe event listeners');
    
    // Store reference to thebe instance
    window.thebeInstance = thebe;
    
    // Listen for structured Thebe status events
    if (thebe.events) {
      thebe.events.on('status', (event, data) => {
        handleThebeStatusEvent(data);
      });
      
      thebe.events.on('error', (event, data) => {
        handleThebeErrorEvent(data);
      });
    }
    
    // Store references to server and session when available
    if (thebe.server) {
      thebeState.server = thebe.server;
      
      // Wait for server to be ready
      thebe.server.ready.then(() => {
        console.log('✅ Thebe server is ready');
        thebeState.isServerReady = true;
        updateConnectionState();
      }).catch(err => {
        console.error('❌ Thebe server failed:', err);
      });
    }
    
    // Monitor for session creation using the correct API
    const checkForSession = async () => {
      try {
        // Check if we already have a session from the thebe instance
        if (thebe.session && !thebeState.session) {
          console.log('📡 Session found in thebe instance');
          thebeState.session = thebe.session;
          thebeState.isSessionReady = true;
          setupKernelMonitoring(thebe.session);
          updateConnectionState();
          return;
        }
        
        // Try to get session from sessionManager if available
        if (thebe.server?.sessionManager) {
          try {
            // Different Thebe versions may have different APIs
            let sessions = [];
            if (typeof thebe.server.sessionManager.running === 'function') {
              const result = thebe.server.sessionManager.running();
              // Handle both async and sync returns
              sessions = result.then ? await result : result;
            }
            
            if (sessions && sessions.length > 0 && !thebeState.session) {
              console.log('📡 Session detected via sessionManager');
              setupSessionMonitoring(thebe);
            }
          } catch (err) {
            console.log('Note: sessionManager.running() not available or failed:', err.message);
          }
        }
        
        // Keep checking until we find a session
        if (!thebeState.session) {
          setTimeout(checkForSession, 1000);
        }
      } catch (err) {
        console.log('Session check error (continuing):', err.message);
        setTimeout(checkForSession, 2000);
      }
    };
    
    checkForSession();
  }
  
  function handleThebeStatusEvent(data) {
    console.log(`Thebe event - Subject: ${data.subject}, Status: ${data.status}, Message: ${data.message}`);
    
    // Handle server status events
    if (data.subject === 'server') {
      if (data.status === 'server-ready') {
        thebeState.isServerReady = true;
        console.log('🚀 Server ready via event');
      } else if (data.status === 'closed') {
        thebeState.isServerReady = false;
        console.log('🔌 Server closed');
      }
    }
    
    // Handle session status events  
    if (data.subject === 'session') {
      if (data.status === 'ready') {
        thebeState.isSessionReady = true;
        console.log('🎯 Session ready via event');
        
        // Try to access the session object
        if (data.object) {
          thebeState.session = data.object;
          setupKernelMonitoring(data.object);
        }
      } else if (data.status === 'shutdown') {
        thebeState.isSessionReady = false;
        thebeState.isKernelReady = false;
        console.log('🛑 Session shutdown');
      }
    }
    
    // Handle kernel status events
    if (data.subject === 'kernel') {
      if (data.status === 'ready') {
        thebeState.isKernelReady = true;
        console.log('⚡ Kernel ready via event');
        
        if (data.object) {
          thebeState.kernel = data.object;
        }
      } else if (data.status === 'shutdown' || data.status === 'dead') {
        thebeState.isKernelReady = false;
        console.log('💀 Kernel shutdown/dead');
      }
    }
    
    updateConnectionState();
  }
  
  function handleThebeErrorEvent(data) {
    console.error(`Thebe error - Subject: ${data.subject}, Status: ${data.status}, Message: ${data.message}`);
    
    if (data.subject === 'server') {
      thebeState.isServerReady = false;
    } else if (data.subject === 'session') {
      thebeState.isSessionReady = false;
    } else if (data.subject === 'kernel') {
      thebeState.isKernelReady = false;
    }
    
    updateConnectionState();
  }
  
  function setupSessionMonitoring(thebe) {
    // First check if we already have a session from thebe instance
    if (thebe.session) {
      thebeState.session = thebe.session;
      thebeState.isSessionReady = true;
      console.log('🔗 Using session from thebe instance');
      
      if (thebe.session.kernel) {
        setupKernelMonitoring(thebe.session);
      }
      updateConnectionState();
      return;
    }
    
    // Try multiple ways to get the session
    if (thebe.server?.sessionManager) {
      try {
        const runningCall = thebe.server.sessionManager.running;
        if (typeof runningCall === 'function') {
          const result = runningCall();
          
          // Handle both promise and direct return
          const handleSessions = (sessions) => {
            if (sessions && sessions.length > 0) {
              // Get the first session
              const sessionModel = sessions[0];
              console.log(`📋 Found session: ${sessionModel.id}`);
              
              // Try to get the actual session object
              if (thebe.server.sessionManager.connectTo) {
                const connectResult = thebe.server.sessionManager.connectTo(sessionModel);
                
                const handleSession = (session) => {
                  thebeState.session = session;
                  thebeState.isSessionReady = true;
                  console.log('🔗 Connected to existing session');
                  
                  if (session.kernel) {
                    setupKernelMonitoring(session);
                  }
                  
                  updateConnectionState();
                };
                
                if (connectResult?.then) {
                  connectResult.then(handleSession);
                } else {
                  handleSession(connectResult);
                }
              }
            }
          };
          
          if (result?.then) {
            result.then(handleSessions);
          } else {
            handleSessions(result);
          }
        }
      } catch (err) {
        console.log('Session monitoring setup failed (continuing):', err.message);
      }
    }
  }
  
  function setupKernelMonitoring(session) {
    if (session.kernel) {
      thebeState.kernel = session.kernel;
      
      // Check current kernel status
      const kernelStatus = session.kernel.status;
      thebeState.isKernelReady = (kernelStatus === 'idle' || kernelStatus === 'ready');
      
      console.log(`🔍 Kernel status: ${kernelStatus}, ready: ${thebeState.isKernelReady}`);
      
      // If kernel is already idle, it's ready
      if (kernelStatus === 'idle') {
        console.log('⚡ Kernel is idle - marking as ready');
        thebeState.isKernelReady = true;
        updateConnectionState();
      }
      
      // Listen for kernel status changes
      session.kernel.statusChanged.connect((kernel, status) => {
        console.log(`🔄 Kernel status changed: ${status}`);
        
        // Mark as ready when we see idle status (which means kernel is connected and working)
        if (status === 'idle') {
          thebeState.isKernelReady = true;
          console.log('✅ Kernel idle - marking as ready');
        } else if (status === 'dead' || status === 'disconnected') {
          console.error(`💀 Kernel ${status}`);
          thebeState.isKernelReady = false;
        }
        
        updateConnectionState();
      });
    }
  }
  
  function updateConnectionState() {
    const wasReady = thebeState.isKernelReady;
    const isReady = checkKernelReady();
    
    console.log(`🔍 Connection state check: Server=${thebeState.isServerReady}, Session=${thebeState.isSessionReady}, Kernel=${thebeState.isKernelReady}, Overall=${isReady}`);
    
    if (isReady && !wasReady) {
      console.log('🎉 Kernel is ready - updating UI!');
      onKernelReady();
    } else if (!isReady && wasReady) {
      console.log('⚠️ Kernel no longer ready');
      onKernelNotReady();
    }
  }
  
  function checkKernelReady() {
    // Use official API to check readiness
    const serverReady = thebeState.server?.isReady || thebeState.isServerReady;
    const sessionReady = thebeState.session?.kernel != null || thebeState.isSessionReady;
    const kernelReady = thebeState.isKernelReady;
    
    return serverReady && sessionReady && kernelReady;
  }
  
  function onKernelReady() {
    const controlsContainer = DOM.getControlsContainer();
    const statusWidget = DOM.getStatusWidget();
    
    updateUIForStatus('ready', controlsContainer, statusWidget);
    runInitializationCells();
    
    // End startup phase after 30 seconds
    if (thebeState.startupPhase) {
      setTimeout(() => {
        thebeState.startupPhase = false;
        console.log('✅ Startup phase complete');
      }, 30000);
    }
  }
  
  function onKernelNotReady() {
    const controlsContainer = DOM.getControlsContainer();
    const statusWidget = DOM.getStatusWidget();
    
    updateUIForStatus('loading', controlsContainer, statusWidget);
  }

  function runInitializationCells() {
    // Run any cells marked with 'thebe-init' class
    const initCells = document.querySelectorAll('.thebe-init');
    initCells.forEach((cell) => {
      const runButton = cell.querySelector('.thebe-run-button');
      if (runButton) {
        setTimeout(() => runButton.click(), 100);
      }
    });
  }

  // ---------- STATUS MANAGEMENT ----------
  let statusUpdateTimeout = null;
  
  function isStatusLoading(status) {
    return ['loading', 'server-connecting', 'session-starting', 'kernel-starting', 'cors-error'].includes(status);
  }
  
  function isStatusReady(status) {
    return status === 'ready';
  }
  
  function updateStatusWidget(status) {
    // Debounce status widget updates
    if (statusUpdateTimeout) {
      clearTimeout(statusUpdateTimeout);
    }
    
    statusUpdateTimeout = setTimeout(() => {
      const statusWidget = DOM.getStatusWidget();
      if (statusWidget) {
        // Remove all status classes
        statusWidget.className = statusWidget.className
          .split(' ')
          .filter(c => !c.startsWith('thebe-status-'))
          .join(' ');
        
        // Add new status class
        statusWidget.classList.add(`thebe-status-${status}`);
        
        // Update loading state
        if (isStatusLoading(status)) {
          statusWidget.classList.add('loading');
        } else {
          statusWidget.classList.remove('loading');
        }
        
        // Update ready state
        if (isStatusReady(status)) {
          statusWidget.classList.add('ready');
        } else {
          statusWidget.classList.remove('ready');
        }
      }
    }, 50); // Debounce by 50ms
  }

  // ---------- THEBE ACTION FUNCTIONS ----------
  const thebeActions = {
    clearAllOutputs() {
      // Use Thebe API if available
      if (window.thebeInstance?.clearAllOutputs) {
        window.thebeInstance.clearAllOutputs();
        return;
      }
      
      // Fallback: manually clear outputs
      DOM.getCells().forEach(cell => {
        const outputArea = cell.querySelector('.thebe-output');
        if (outputArea) {
          outputArea.innerHTML = '';
        }
        cell.classList.remove('thebe-error', 'error');
      });
    },

    async runAllCells() {
      // Use Thebe API if available
      if (window.thebeInstance?.renderAllCells) {
        window.thebeInstance.renderAllCells();
        return;
      }
      
      // Fallback: click all run buttons with staggered timing
      const runButtons = DOM.getRunButtons();
      for (let i = 0; i < runButtons.length; i++) {
        runButtons[i].click();
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    },

    restartKernel() {
      const kernel = getKernelConnection();
      if (kernel) {
        console.log('🔄 Restarting kernel via official API');
        return kernel.restart();
      }
      console.warn('No kernel available to restart');
    },

    async restartAndRunAll() {
      await this.restartKernel();
      // Wait for kernel to be ready
      await new Promise(resolve => setTimeout(resolve, 2000));
      await this.runAllCells();
    },

    toggleRunButtons(show) {
      // Get all run buttons, including those that might have been hidden
      const runButtons = document.querySelectorAll('.thebe-button.thebe-run-button, .thebe-run-button');
      
      // Track if any buttons were actually changed
      let changedCount = 0;
      
      runButtons.forEach(btn => {
        const currentlyHidden = btn.style.display === 'none' || getComputedStyle(btn).display === 'none';
        
        if (show && currentlyHidden) {
          btn.style.display = '';
          btn.style.visibility = 'visible';
          btn.style.opacity = '1';
          changedCount++;
        } else if (!show && !currentlyHidden) {
          btn.style.display = 'none';
          changedCount++;
        }
      });
      
      // Always log button changes to track UI state
      if (changedCount > 0) {
        console.log(`Buttons: Changed ${changedCount}/${runButtons.length} to ${show ? 'visible' : 'hidden'}`);
      } else if (runButtons.length > 0 && Math.random() < 0.05) { // Log 5% of no-ops
        console.log(`Buttons: No change needed (${runButtons.length} already ${show ? 'visible' : 'hidden'})`);
      }
    },

    executeCode(code) {
      const kernel = getKernelConnection();
      if (kernel) {
        console.log('⚡ Executing code via official API');
        return kernel.requestExecute({ code });
      }
      console.warn('No kernel available to execute code');
    }
  };

  function setupThebeButtons() {
    // Set up button event listeners
    const buttons = {
      'thebe-run-all': thebeActions.runAllCells,
      'thebe-restart': thebeActions.restartKernel,
      'thebe-restart-run-all': thebeActions.restartAndRunAll
    };
    
    Object.entries(buttons).forEach(([id, handler]) => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          handler.call(thebeActions);
        });
      }
    });

    // Set up keyboard shortcuts
    setupKeyboardShortcuts();
  }

  function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + Shift + Enter: Run all cells
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Enter') {
        e.preventDefault();
        thebeActions.runAllCells();
      }
      
      // Ctrl/Cmd + Shift + 0: Restart kernel
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === '0') {
        e.preventDefault();
        thebeActions.restartKernel();
      }
    });
    
    // Set up CodeMirror comment toggling
    setupCodeMirrorCommentToggle();
  }
  
  function setupCodeMirrorCommentToggle() {
    // Wait a bit for CodeMirror instances to be created
    setTimeout(() => {
      configureAllCodeMirrorInstances();
    }, 1000);
    
    // Also set up observer for future CodeMirror instances
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check if this is or contains a CodeMirror element
            if (node.classList?.contains('CodeMirror')) {
              configureCodeMirrorInstance(node);
            } else if (node.querySelectorAll) {
              node.querySelectorAll('.CodeMirror').forEach(configureCodeMirrorInstance);
            }
          }
        });
      });
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
  
  function configureAllCodeMirrorInstances() {
    document.querySelectorAll('.CodeMirror').forEach(configureCodeMirrorInstance);
  }
  
  function configureCodeMirrorInstance(element) {
    if (element.CodeMirror && !element.dataset.commentToggleConfigured) {
      const cm = element.CodeMirror;
      
      // Verify comment addon is available
      if (!window.CodeMirror || !window.CodeMirror.commands || !window.CodeMirror.commands.toggleComment) {
        console.warn('CodeMirror comment addon not available for instance configuration');
        return;
      }
      
      try {
        // Get current extraKeys and preserve existing shortcuts
        const currentExtraKeys = cm.getOption('extraKeys') || {};
        
        // Add comment toggle shortcuts
        cm.setOption('extraKeys', {
          ...currentExtraKeys,
          'Cmd-/': 'toggleComment',
          'Ctrl-/': 'toggleComment'
        });
        
        element.dataset.commentToggleConfigured = 'true';
        
        // Verify configuration was applied
        const verifyKeys = cm.getOption('extraKeys') || {};
        if (verifyKeys['Cmd-/'] === 'toggleComment' && verifyKeys['Ctrl-/'] === 'toggleComment') {
          console.log('✅ Comment toggle configured for CodeMirror instance');
        } else {
          console.error('❌ Failed to configure comment toggle - extraKeys not set properly');
        }
      } catch (error) {
        console.error('❌ Error configuring CodeMirror instance:', error);
      }
    }
  }

  // ---------- STATUS HELPERS (Using Official API) ----------
  function isThebeReady() {
    return checkKernelReady();
  }
  
  function getThebeStatus() {
    if (!thebeState.isServerReady) {
      return 'server-connecting';
    }
    if (!thebeState.isSessionReady) {
      return 'session-starting';
    }
    if (!thebeState.isKernelReady) {
      return 'kernel-starting';
    }
    return 'ready';
  }
  
  function getKernelConnection() {
    return thebeState.kernel || thebeState.session?.kernel || window.thebeInstance?.session?.kernel;
  }
  
  function getThebeSession() {
    return thebeState.session || window.thebeInstance?.session;
  }
  
  function getThebeServer() {
    return thebeState.server || window.thebeInstance?.server;
  }

  // Track last UI status to avoid redundant updates
  let lastUIStatus = null;
  let redundantUpdateCount = 0;

  function updateUIForStatus(status, controlsContainer, statusWidget) {
    if (!controlsContainer || !statusWidget) return;
    
    // Track redundant updates
    if (status === lastUIStatus) {
      redundantUpdateCount++;
      if (redundantUpdateCount % 10 === 0) {
        console.warn(`⚠️ Redundant UI update attempted ${redundantUpdateCount} times for status: ${status}`);
      }
      return;
    }
    
    redundantUpdateCount = 0;
    console.log(`UI status: ${lastUIStatus} → ${status}`);
    lastUIStatus = status;
    
    // Determine status booleans
    const isReady = status === 'ready';
    const isLoading = status === 'loading';
    const isFailed = status === 'failed';
    
    // Update controls container
    controlsContainer.classList.toggle('ready', isReady);
    controlsContainer.classList.toggle('loading', isLoading);
    controlsContainer.classList.toggle('failed', isFailed);
    
    // Update status widget - remove incorrect loading class when ready
    if (isReady) {
      statusWidget.classList.remove('loading', 'thebe-status-loading');
      statusWidget.classList.add('ready');
    } else if (isLoading) {
      statusWidget.classList.add('loading');
      statusWidget.classList.remove('ready');
    } else {
      statusWidget.classList.remove('loading', 'ready');
    }
    
    // Show/hide run buttons based on status
    thebeActions.toggleRunButtons(isReady);
    
    // Add/remove ready class to cell controls for CSS-based visibility
    const cellControls = document.querySelectorAll('.thebe-cell .thebe-controls');
    cellControls.forEach(ctrl => {
      if (isReady) {
        ctrl.classList.add('ready');
      } else {
        ctrl.classList.remove('ready');
      }
    });
    
    // Update actions container visibility
    const actionsContainer = DOM.getActionsContainer();
    if (actionsContainer) {
      actionsContainer.style.display = isReady ? 'flex' : 'none';
    }
  }

  function monitorThebeStatus() {
    // Monitor using official Thebe API instead of DOM parsing
    console.log('Starting Thebe status monitoring via official API');
    
    // Check status periodically using official API
    const statusChecker = setInterval(() => {
      const thebeReady = isThebeReady();
      const currentStatus = getThebeStatus();
      
      // Update UI based on official API status
      const controlsContainer = DOM.getControlsContainer();
      const statusWidget = DOM.getStatusWidget();
      
      if (thebeReady) {
        updateUIForStatus('ready', controlsContainer, statusWidget);
        
        // Stop checking once ready and stable
        setTimeout(() => {
          if (isThebeReady()) {
            console.log('✅ Thebe stable, reducing status checks');
            clearInterval(statusChecker);
          }
        }, 10000); // Wait 10 seconds to ensure stability
      } else {
        const uiStatus = currentStatus.includes('server') ? 'loading' : 
                        currentStatus.includes('session') ? 'loading' : 
                        currentStatus.includes('kernel') ? 'loading' : 'loading';
        updateUIForStatus(uiStatus, controlsContainer, statusWidget);
      }
    }, 1000); // Check every second
  }


  // ---------- TESTING FUNCTIONS ----------
  function testCommentToggleFunctionality() {
    const results = {
      addonLoaded: !!window.CodeMirror?.commands?.toggleComment,
      instances: [],
      summary: { total: 0, configured: 0, working: 0 }
    };
    
    const cmElements = document.querySelectorAll('.CodeMirror');
    results.summary.total = cmElements.length;
    
    cmElements.forEach((el, index) => {
      if (el.CodeMirror) {
        const cm = el.CodeMirror;
        const extraKeys = cm.getOption('extraKeys') || {};
        const hasCommentToggle = extraKeys['Cmd-/'] === 'toggleComment' && 
                                extraKeys['Ctrl-/'] === 'toggleComment';
        
        const instanceData = {
          index,
          configured: hasCommentToggle,
          extraKeys: Object.keys(extraKeys),
          hasCommentCommand: !!cm.commands?.toggleComment
        };
        
        results.instances.push(instanceData);
        
        if (hasCommentToggle) results.summary.configured++;
        if (hasCommentToggle && window.CodeMirror?.commands?.toggleComment) results.summary.working++;
      }
    });
    
    console.group('Comment Toggle Test Results');
    console.log('Addon loaded:', results.addonLoaded);
    console.log('Instances:', `${results.summary.working}/${results.summary.total} working`);
    console.table(results.instances);
    console.groupEnd();
    
    return results;
  }
  
  // Expose for debugging
  window.testCommentToggle = testCommentToggleFunctionality;

  // ---------- PUBLIC API ----------
  window.bootstrapThebe = bootstrapThebe;
  
  window.thebeAPI = {
    // Core functions
    bootstrapThebe,
    
    // Action functions
    ...thebeActions,
    
    // Status helpers (Official API)
    isThebeReady,
    getThebeStatus,
    getKernelConnection,
    getThebeSession,
    getThebeServer,
    checkKernelReady,
    
    // UI functions
    updateUIForStatus,
    
    // Utility functions
    utils,
    
    // DOM helpers
    DOM,
    
    // State access
    getThebeState: () => thebeState
  };

  // ---------- API-BASED STATE CHECKER ----------
  function startThebeStateChecker() {
    console.log('🔍 Starting API-based Thebe state checker');
    
    let checksWithoutChanges = 0;
    
    const intervalId = setInterval(() => {
      // Stop checking if stable for a while
      if (checksWithoutChanges > 15) {
        console.log('✅ Thebe state checker: Stopping (system stable)');
        clearInterval(intervalId);
        return;
      }
      
      // Use official API to check state
      const thebeReady = isThebeReady();
      const controlsContainer = DOM.getControlsContainer();
      const statusWidget = DOM.getStatusWidget();
      
      if (thebeReady && controlsContainer && statusWidget) {
        let changesMade = false;
        
        // Ensure UI reflects ready state
        if (!controlsContainer.classList.contains('ready')) {
          controlsContainer.classList.add('ready');
          controlsContainer.classList.remove('loading');
          changesMade = true;
        }
        
        if (statusWidget.classList.contains('loading')) {
          statusWidget.classList.remove('loading', 'thebe-status-loading');
          statusWidget.classList.add('ready');
          changesMade = true;
        }
        
        // Ensure run buttons are visible
        const runButtons = document.querySelectorAll('.thebe-button.thebe-run-button, .thebe-run-button');
        runButtons.forEach(btn => {
          if (btn.style.display === 'none') {
            btn.style.display = '';
            btn.style.visibility = 'visible';
            btn.style.opacity = '1';
            changesMade = true;
          }
        });
        
        // Ensure navbar actions are visible
        const actionsContainer = DOM.getActionsContainer();
        if (actionsContainer && actionsContainer.style.display === 'none') {
          actionsContainer.style.display = 'flex';
          changesMade = true;
        }
        
        if (changesMade) {
          console.warn('🔧 Fixed UI state based on Thebe API');
          checksWithoutChanges = 0;
        } else {
          checksWithoutChanges++;
        }
      } else {
        checksWithoutChanges++;
      }
    }, 2000);
  }

  // ---------- INITIALIZATION ----------
  function initializeThebe() {
    // Mark code cells as executable
    DOM.getSourceCells().forEach((pre) => {
      pre.setAttribute("data-executable", "true");
      pre.setAttribute("data-language", "python");
    });

    // Set up activate buttons
    document.querySelectorAll("[data-thebe-activate]").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        
        // Update UI state
        const controlsContainer = btn.closest('.thebe-controls');
        if (controlsContainer) {
          controlsContainer.classList.add('activated');
        }
        
        // Hide the activate button
        btn.style.display = 'none';
        
        // Bootstrap Thebe
        try {
          await bootstrapThebe();
          // Start the API-based state checker after bootstrap
          startThebeStateChecker();
        } catch (err) {
          console.error('Failed to bootstrap Thebe:', err);
          // Show the button again on failure
          btn.style.display = '';
          if (controlsContainer) {
            controlsContainer.classList.remove('activated');
          }
        }
      });
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeThebe);
  } else {
    // DOM is already loaded
    initializeThebe();
  }
})();
