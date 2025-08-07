/**
 * Custom Navbar with Headroom-like behavior
 * Follows modern JavaScript best practices
 */

(function () {
  "use strict";

  // Configuration constants
  const CONFIG = {
    tolerance: 5, // pixels of scroll before triggering
    statusCheckInterval: 200, // ms between status checks
    maxStatusCheckAttempts: 50,
    animationDuration: 300, // ms for transitions
  };

  const CSS_CLASSES = {
    navbar: "custom-navbar headroom fixed-top headroom--top headroom--bottom",
    headroom: {
      pinned: "headroom--pinned",
      unpinned: "headroom--unpinned",
      top: "headroom--top",
      bottom: "headroom--bottom",
      notTop: "headroom--not-top",
      notBottom: "headroom--not-bottom",
    },
    thebe: {
      activated: "activated",
      ready: "ready",
      loading: "loading",
    },
  };

  class CustomNavbar {
    constructor() {
      this.navbar = null;
      this.lastScrollY = 0;
      this.statusMoveAttempts = 0;
      this.scrollRAF = null;

      // Bind methods to preserve context
      this.handleScroll = this.handleScroll.bind(this);
      this.handleResize = this.handleResize.bind(this);

      this.init();
    }

    init() {
      this.createNavbar();
      this.bindEvents();
      this.updateScrollPosition();
    }

    createNavbar() {
      // Create navbar element
      this.navbar = this.createElement("header", {
        id: "custom-navbar",
        className: CSS_CLASSES.navbar,
        innerHTML: this.getNavbarHTML(),
      });

      // Insert at beginning of body
      document.body.insertBefore(this.navbar, document.body.firstChild);

      // Initialize components
      this.initializeComponents();
    }

    getNavbarHTML() {
      return `
        <nav class="custom-nav custom-nav-expand-lg" data-bs-theme="dark">
          <div class="navbar-container container-fluid">
            <div class="thebe-status-container">
              <!-- Status widget will be moved here after Thebe creates it -->
            </div>
            
            <div class="custom-navbar-tools">
              <div class="thebe-controls">
                <div class="thebe-actions" style="display: none;">
                  <button id="navbar-run-all" class="thebe-action-button" title="Run All Cells">
                    <span class="btn-text-full">▶▶ Run All</span>
                    <span class="btn-text-medium">▶▶ Run</span>
                    <span class="btn-text-small">▶▶</span>
                  </button>
                  <button id="navbar-restart" class="thebe-action-button" title="Restart Kernel">
                    <span class="btn-text-full">↻ Restart</span>
                    <span class="btn-text-medium">↻ Rst</span>
                    <span class="btn-text-small">↻</span>
                  </button>
                  <button id="navbar-restart-run-all" class="thebe-action-button" title="Restart & Run All">
                    <span class="btn-text-full">↻ Restart & Run All</span>
                    <span class="btn-text-medium">↻ R&R</span>
                    <span class="btn-text-small">↻▶</span>
                  </button>
                </div>
              </div>
              <div class="tool-divider"></div>
              <button class="btn btn-primary activate-btn" data-thebe-activate aria-label="Activate Thebe Kernel">
                <span class="btn-text-full">🔌 Activate Kernel</span>
                <span class="btn-text-medium">🔌 Activate</span>
                <span class="btn-text-small">🔌</span>
              </button>
            </div>
          </div>
        </nav>
      `;
    }

    initializeComponents() {
      this.setupActivateButton();
      this.setupNavbarActionButtons();
      // Re-enable moving status widget to navbar
      this.moveStatusToNavbar();
    }

    moveStatusToNavbar() {
      // Function to attempt moving the status widget
      const attemptMove = () => {
        const statusDisplay = this.findThebeStatus();
        const statusContainer = this.navbar.querySelector(
          ".thebe-status-container"
        );

        if (
          statusDisplay &&
          statusContainer &&
          !statusContainer.contains(statusDisplay)
        ) {
          // Move it immediately - don't wait for content
          statusContainer.appendChild(statusDisplay);
          
          // Make it visible now that it's in the navbar
          statusDisplay.style.display = '';
          
          console.log('✅ Moved Thebe status widget to navbar immediately');
          console.log('Widget content:', statusDisplay.textContent);
          console.log('Widget classes:', statusDisplay.className);
          
          // Apply responsive text sizing
          this.updateResponsiveStatusText();
          
          this.checkForThebeButtons();
          
          return true; // Successfully moved
        }
        return false; // Not yet moved
      };

      // Try to move immediately
      if (attemptMove()) {
        return; // Success, we're done
      }

      // If not found yet, set up observer to watch for it
      const observer = new MutationObserver((mutations) => {
        if (attemptMove()) {
          // Successfully moved, stop observing
          observer.disconnect();
        }
      });
      
      // Start observing the entire document for changes
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['class']
      });
      
      // Also set up a polling mechanism as a fallback
      let pollCount = 0;
      const pollInterval = setInterval(() => {
        pollCount++;
        
        if (attemptMove()) {
          // Successfully moved
          clearInterval(pollInterval);
          observer.disconnect();
        } else if (pollCount > 50) {
          // Stop after 5 seconds (100ms * 50)
          clearInterval(pollInterval);
          console.warn('⚠️ Could not find Thebe status widget after 5 seconds');
        }
      }, 100);
      
      // Hide any status widget found outside navbar immediately
      const statusDisplay = this.findThebeStatus();
      if (statusDisplay) {
        statusDisplay.style.display = 'none';
      }
    }

    findThebeStatus() {
      // Look for Thebe's status widget that it creates automatically
      // Important: exclude any that are already in our navbar
      const statusElements = document.querySelectorAll('.thebe-status');
      
      for (const element of statusElements) {
        // Skip if it's already in our navbar
        if (this.navbar.contains(element)) continue;
        
        // Return the first status widget found outside our navbar
        // Thebe will have created this with mountStatusWidget: true
        return element;
      }

      return null;
    }

    checkForThebeButtons() {
      const buttons = {
        runAll: document.querySelector("#thebe-run-all"),
        restart: document.querySelector("#thebe-restart"),
        restartRunAll: document.querySelector("#thebe-restart-run-all"),
      };

      // Show navbar actions if any original buttons exist
      if (Object.values(buttons).some((btn) => btn)) {
        const actionsDiv = this.navbar.querySelector(".thebe-actions");
        if (actionsDiv) {
          actionsDiv.style.display = "flex";
        }
      }

      return buttons;
    }

    setupActivateButton() {
      const activateBtn = this.navbar.querySelector("[data-thebe-activate]");
      if (!activateBtn) return;

      activateBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        await this.handleActivateClick(activateBtn);
      });
    }

    async handleActivateClick(button) {
      try {
        // Update UI state
        const controlsContainer = this.navbar.querySelector(".thebe-controls");
        if (controlsContainer) {
          controlsContainer.classList.add(CSS_CLASSES.thebe.activated);
        }

        // Disable button during activation
        button.disabled = true;
        // Update all text spans for activating state
        button.querySelector('.btn-text-full').textContent = "⏳ Activating...";
        button.querySelector('.btn-text-medium').textContent = "⏳ Activating";
        button.querySelector('.btn-text-small').textContent = "⏳";

        // Bootstrap Thebe
        await this.waitForThebeAPI();
        await window.thebeAPI.bootstrapThebe();

        // Hide button on success
        button.style.display = "none";
      } catch (error) {
        console.error("Failed to activate Thebe:", error);

        // Restore button state on error
        button.disabled = false;
        // Restore original text spans
        button.querySelector('.btn-text-full').textContent = "🔌 Activate Kernel";
        button.querySelector('.btn-text-medium').textContent = "🔌 Activate";
        button.querySelector('.btn-text-small').textContent = "🔌";

        const controlsContainer = this.navbar.querySelector(".thebe-controls");
        if (controlsContainer) {
          controlsContainer.classList.remove(CSS_CLASSES.thebe.activated);
        }
      }
    }

    async waitForThebeAPI(timeout = 5000) {
      const startTime = Date.now();

      while (Date.now() - startTime < timeout) {
        if (window.thebeAPI?.bootstrapThebe) {
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      throw new Error("thebeAPI not available after timeout");
    }

    setupNavbarActionButtons() {
      const buttonConfigs = [
        {
          navbarId: "#navbar-run-all",
          thebeId: "#thebe-run-all",
          apiMethod: "runAllCells",
        },
        {
          navbarId: "#navbar-restart",
          thebeId: "#thebe-restart",
          apiMethod: "restartKernel",
        },
        {
          navbarId: "#navbar-restart-run-all",
          thebeId: "#thebe-restart-run-all",
          apiMethod: "restartAndRunAll",
        },
      ];

      buttonConfigs.forEach((config) => {
        const navbarBtn = this.navbar.querySelector(config.navbarId);
        if (navbarBtn) {
          navbarBtn.addEventListener("click", (e) => {
            e.preventDefault();
            this.delegateButtonClick(config.thebeId, config.apiMethod);
          });
        }
      });
    }

    delegateButtonClick(thebeButtonId, apiMethod) {
      // Try to click the actual Thebe button first
      const thebeBtn = document.querySelector(thebeButtonId);
      if (thebeBtn) {
        thebeBtn.click();
        return;
      }

      // Fallback to API method
      if (window.thebeAPI?.[apiMethod]) {
        window.thebeAPI[apiMethod]();
      } else {
        console.warn(
          `Unable to execute ${apiMethod}: button not found and API not available`
        );
      }
    }

    updateResponsiveStatusText() {
      const statusElement = this.navbar?.querySelector('.thebe-status');
      if (!statusElement) return;
      
      const width = window.innerWidth;
      
      // Store original text if not already stored
      if (!statusElement.dataset.originalText) {
        statusElement.dataset.originalText = statusElement.textContent.trim();
      }
      
      const originalText = statusElement.dataset.originalText;
      if (!originalText) return;
      
      let newText = originalText;
      
      if (width <= 480) {
        // Extra small: Show only status value, 8 chars max
        if (originalText.includes('Status:')) {
          const statusValue = originalText.split('Status:')[1]?.trim() || originalText;
          newText = statusValue.length > 8 ? statusValue.substring(0, 8) + '…' : statusValue;
        } else {
          newText = originalText.length > 8 ? originalText.substring(0, 8) + '…' : originalText;
        }
      } else if (width <= 768) {
        // Small: Show only status value, 12 chars max  
        if (originalText.includes('Status:')) {
          const statusValue = originalText.split('Status:')[1]?.trim() || originalText;
          newText = statusValue.length > 12 ? statusValue.substring(0, 12) + '…' : statusValue;
        } else {
          newText = originalText.length > 12 ? originalText.substring(0, 12) + '…' : originalText;
        }
      } else if (width <= 1024) {
        // Medium: Truncate at 20 characters
        newText = originalText.length > 20 ? originalText.substring(0, 20) + '…' : originalText;
      } else {
        // Large: Show full text
        newText = originalText;
      }
      
      // Only update if text actually changed to avoid unnecessary DOM manipulation
      if (statusElement.textContent !== newText) {
        statusElement.textContent = newText;
      }
    }

    bindEvents() {
      // Use passive event listeners for better performance
      window.addEventListener("scroll", this.handleScroll, { passive: true });
      window.addEventListener("resize", this.handleResize, { passive: true });
    }

    handleScroll() {
      // Cancel any pending animation frame
      if (this.scrollRAF) {
        cancelAnimationFrame(this.scrollRAF);
      }

      // Request new animation frame
      this.scrollRAF = requestAnimationFrame(() => {
        this.updateScrollPosition();
        this.scrollRAF = null;
      });
    }

    handleResize() {
      this.updateScrollPosition();
      this.updateResponsiveStatusText();
    }

    updateScrollPosition() {
      const currentScrollY = window.pageYOffset || window.scrollY;
      const scrollDelta = Math.abs(currentScrollY - this.lastScrollY);

      // Only update if scroll exceeds tolerance
      if (scrollDelta >= CONFIG.tolerance) {
        const scrollDirection =
          currentScrollY > this.lastScrollY ? "down" : "up";
        this.updateNavbarClasses(currentScrollY, scrollDirection);
        this.lastScrollY = currentScrollY;
      }
    }

    updateNavbarClasses(scrollY, direction) {
      const isTop = scrollY <= CONFIG.tolerance;
      const isBottom =
        scrollY >=
        document.body.scrollHeight - window.innerHeight - CONFIG.tolerance;

      // Update position classes
      this.navbar.classList.toggle(CSS_CLASSES.headroom.top, isTop);
      this.navbar.classList.toggle(CSS_CLASSES.headroom.notTop, !isTop);
      this.navbar.classList.toggle(CSS_CLASSES.headroom.bottom, isBottom);
      this.navbar.classList.toggle(CSS_CLASSES.headroom.notBottom, !isBottom);

      // Update visibility classes
      const shouldPin = direction === "up" || isTop;
      this.navbar.classList.toggle(CSS_CLASSES.headroom.pinned, shouldPin);
      this.navbar.classList.toggle(
        CSS_CLASSES.headroom.unpinned,
        !shouldPin && !isTop
      );
    }

    // Utility methods
    createElement(tag, options = {}) {
      const element = document.createElement(tag);
      Object.entries(options).forEach(([key, value]) => {
        if (key === "innerHTML") {
          element.innerHTML = value;
        } else if (key === "className") {
          element.className = value;
        } else {
          element[key] = value;
        }
      });
      return element;
    }

    destroy() {
      // Cancel any pending animation frames
      if (this.scrollRAF) {
        cancelAnimationFrame(this.scrollRAF);
      }

      // Remove event listeners
      window.removeEventListener("scroll", this.handleScroll);
      window.removeEventListener("resize", this.handleResize);

      // Remove navbar from DOM
      if (this.navbar) {
        this.navbar.remove();
        this.navbar = null;
      }
    }
  }

  // Initialize when DOM is ready
  function initializeNavbar() {
    // Only initialize once
    if (!window.customNavbar) {
      window.customNavbar = new CustomNavbar();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeNavbar);
  } else {
    // DOM is already loaded
    initializeNavbar();
  }
})();
