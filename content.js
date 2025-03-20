let lastValue = null;
let threshold = 5;
let selectedArea = null;
let isSelecting = false;
let startX, startY;

// Flag to track if the script is already injected
window.areaMonitorInjected = window.areaMonitorInjected || false;

if (!window.areaMonitorInjected) {
    window.areaMonitorInjected = true;

    class AreaSelector {
        constructor() {
            this.isSelecting = false;
            this.startX = 0;
            this.startY = 0;
            this.currentX = 0;
            this.currentY = 0;
            this.overlay = null;
            this.selection = null;
            this.toolbar = null;
        }

        init() {
            console.log('Initializing area selector');
            this.createOverlay();
            this.createInstructions();
            this.attachEventListeners();
        }

        createOverlay() {
            // Remove any existing overlay
            const existingOverlay = document.querySelector('.selection-overlay');
            if (existingOverlay) {
                existingOverlay.remove();
            }

            this.overlay = document.createElement('div');
            this.overlay.className = 'selection-overlay';
            document.body.appendChild(this.overlay);
        }

        createInstructions() {
            const instructions = document.createElement('div');
            instructions.className = 'selection-instructions';
            instructions.textContent = 'Click and drag to select an area';
            this.overlay.appendChild(instructions);
        }

        createSelection() {
            if (this.selection) {
                this.selection.remove();
            }
            this.selection = document.createElement('div');
            this.selection.className = 'selection-area';
            document.body.appendChild(this.selection);
        }

        updateSelection() {
            if (!this.selection) return;

            const width = Math.abs(this.currentX - this.startX);
            const height = Math.abs(this.currentY - this.startY);
            const left = Math.min(this.currentX, this.startX);
            const top = Math.min(this.currentY, this.startY);

            this.selection.style.left = `${left}px`;
            this.selection.style.top = `${top}px`;
            this.selection.style.width = `${width}px`;
            this.selection.style.height = `${height}px`;
        }

        createToolbar() {
            if (this.toolbar) {
                this.toolbar.remove();
            }

            this.toolbar = document.createElement('div');
            this.toolbar.className = 'selection-toolbar';

            const confirmBtn = document.createElement('button');
            confirmBtn.textContent = 'Confirm';
            confirmBtn.style.cssText = `
                background: #2196F3;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 4px;
                cursor: pointer;
            `;

            const cancelBtn = document.createElement('button');
            cancelBtn.textContent = 'Cancel';
            cancelBtn.style.cssText = `
                background: #f5f5f5;
                color: #444;
                border: none;
                padding: 8px 16px;
                border-radius: 4px;
                cursor: pointer;
            `;

            confirmBtn.addEventListener('click', () => this.confirmSelection());
            cancelBtn.addEventListener('click', () => this.cleanup());

            this.toolbar.appendChild(confirmBtn);
            this.toolbar.appendChild(cancelBtn);
            document.body.appendChild(this.toolbar);

            // Position toolbar below selection
            const selectionRect = this.selection.getBoundingClientRect();
            this.toolbar.style.left = `${selectionRect.left}px`;
            this.toolbar.style.top = `${selectionRect.bottom + 10}px`;
        }

        attachEventListeners() {
            const mouseDown = (e) => {
                this.isSelecting = true;
                this.startX = e.clientX;
                this.startY = e.clientY;
                this.currentX = e.clientX;
                this.currentY = e.clientY;
                this.createSelection();
                this.updateSelection();
            };

            const mouseMove = (e) => {
                if (!this.isSelecting) return;
                this.currentX = e.clientX;
                this.currentY = e.clientY;
                this.updateSelection();
            };

            const mouseUp = (e) => {
                if (!this.isSelecting) return;
                this.isSelecting = false;
                this.currentX = e.clientX;
                this.currentY = e.clientY;
                this.updateSelection();
                this.createToolbar();
            };

            this.overlay.addEventListener('mousedown', mouseDown);
            document.addEventListener('mousemove', mouseMove);
            document.addEventListener('mouseup', mouseUp);
        }

        confirmSelection() {
            const rect = this.selection.getBoundingClientRect();
            const selectedArea = {
                left: rect.left,
                top: rect.top,
                width: rect.width,
                height: rect.height
            };

            console.log('Selected area:', selectedArea);

            // Create monitor box
            const monitor = new AreaMonitor();
            monitor.createMonitorBox(selectedArea);

            // Store selection
            chrome.storage.local.set({ 
                selectedArea,
                isMonitoring: true 
            }, () => {
                console.log('Selection saved');
            });

            this.cleanup();
        }

        cleanup() {
            if (this.selection) this.selection.remove();
            if (this.toolbar) this.toolbar.remove();
            if (this.overlay) this.overlay.remove();
        }
    }

    class AreaMonitor {
        constructor() {
            this.monitorBox = null;
            this.monitorInterval = null;
            this.area = null;
        }

        createMonitorBox(area) {
            this.area = area;
            this.monitorBox = document.createElement('div');
            this.monitorBox.className = 'monitor-box';
            this.monitorBox.style.left = `${area.left}px`;
            this.monitorBox.style.top = `${area.top}px`;
            this.monitorBox.style.width = `${area.width}px`;
            this.monitorBox.style.height = `${area.height}px`;

            // Create header
            const header = document.createElement('div');
            header.className = 'monitor-box-header';
            
            const valueDisplay = document.createElement('span');
            valueDisplay.className = 'monitor-box-value';
            valueDisplay.textContent = 'Monitoring...';
            
            const closeButton = document.createElement('span');
            closeButton.className = 'monitor-box-close';
            closeButton.textContent = '✕';
            closeButton.onclick = () => this.stopMonitoring();

            header.appendChild(valueDisplay);
            header.appendChild(closeButton);
            this.monitorBox.appendChild(header);

            document.body.appendChild(this.monitorBox);
            this.startMonitoring();
        }

        startMonitoring() {
            this.checkValue(); // Initial check
            this.monitorInterval = setInterval(() => {
                this.checkValue();
            }, 5000);
        }

        async checkValue() {
            try {
                const value = await this.extractNumber();
                if (value !== null) {
                    this.updateValue(value);
                }
            } catch (error) {
                console.error('Error checking value:', error);
            }
        }

        async extractNumber() {
            // Get all text nodes within the selected area
            const elements = document.elementsFromPoint(
                this.area.left + this.area.width / 2,
                this.area.top + this.area.height / 2
            );

            for (const element of elements) {
                // Get the text content
                const text = element.textContent.trim();
                
                // Try to find a number in the text
                const matches = text.match(/\d+(\.\d+)?/g);
                if (matches) {
                    const number = parseFloat(matches[0]);
                    if (!isNaN(number)) {
                        return number;
                    }
                }
            }

            return null;
        }

        updateValue(newValue) {
            const valueDisplay = this.monitorBox.querySelector('.monitor-box-value');
            valueDisplay.textContent = `Current: ${newValue}`;

            chrome.storage.local.get(['threshold', 'lastValue'], (data) => {
                const threshold = data.threshold || 5;
                const lastValue = data.lastValue;

                if (lastValue !== undefined && newValue >= lastValue + threshold) {
                    // Visual feedback
                    this.monitorBox.classList.add('threshold-exceeded');
                    
                    // Send notification
                    chrome.runtime.sendMessage({
                        type: "notify",
                        newValue: newValue,
                        oldValue: lastValue
                    });

                    // Reset visual feedback after 5 seconds
                    setTimeout(() => {
                        this.monitorBox.classList.remove('threshold-exceeded');
                    }, 5000);
                }

                // Store the new value
                chrome.storage.local.set({ lastValue: newValue });
            });
        }

        stopMonitoring() {
            clearInterval(this.monitorInterval);
            if (this.monitorBox && this.monitorBox.parentElement) {
                this.monitorBox.parentElement.removeChild(this.monitorBox);
            }
            chrome.storage.local.set({ isMonitoring: false });
        }
    }

    // Listen for messages
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log('Received message:', message);
        if (message.action === "startSelection") {
            console.log('Starting selection');
            new AreaSelector().init();
        }
    });

    // Log that the script has been loaded
    console.log('Area Monitor content script loaded');
}

// Listen for the custom event
document.addEventListener('startAreaSelection', () => {
    new AreaSelector().init();
});

// Add console logs to verify script loading
console.log('Content script loaded');

// Restore monitoring on page load
window.addEventListener('load', async () => {
    console.log('Page loaded, checking for existing monitor');
    try {
        const { isMonitoring, selectedArea } = await chrome.storage.local.get(['isMonitoring', 'selectedArea']);
        if (isMonitoring && selectedArea) {
            console.log('Restoring monitor');
            const monitor = new AreaMonitor();
            monitor.createMonitorBox(selectedArea);
        }
    } catch (error) {
        console.error('Error restoring monitor:', error);
    }
}); 