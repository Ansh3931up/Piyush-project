let isSelecting = false;

function showStatus(message, type = 'success') {
    const status = document.getElementById('status');
    status.textContent = message;
    status.className = `status ${type}`;
    setTimeout(() => {
        status.style.display = 'none';
    }, 3000);
}

function toggleLoading(loading) {
    const spinner = document.getElementById('saveSpinner');
    const saveText = document.getElementById('saveText');
    const saveButton = document.getElementById('save');
    
    spinner.style.display = loading ? 'inline-block' : 'none';
    saveButton.disabled = loading;
    saveText.textContent = loading ? 'Saving...' : 'Save Settings';
}

function validateInputs() {
    const threshold = parseInt(document.getElementById('threshold').value);
    const email = document.getElementById('email').value;
    const interval = parseInt(document.getElementById('interval').value);

    if (!threshold || threshold < 1) {
        showStatus('Please enter a valid threshold value', 'error');
        return false;
    }

    if (!email || !email.includes('@')) {
        showStatus('Please enter a valid email address', 'error');
        return false;
    }

    if (!interval || interval < 1 || interval > 3600) {
        showStatus('Please enter a valid interval (1-3600 seconds)', 'error');
        return false;
    }

    return true;
}

document.addEventListener('DOMContentLoaded', () => {
    const selectButton = document.getElementById('selectArea');
    
    selectButton.addEventListener('click', async () => {
        try {
            // Send message to background script
            chrome.runtime.sendMessage({ type: "startSelection" });
            // Close the popup
            window.close();
        } catch (error) {
            console.error('Error:', error);
        }
    });
});

function injectSelector() {
    // This function will be injected into the page
    if (window.areaSelector) {
        return;
    }

    // Create and dispatch a custom event
    const event = new CustomEvent('startAreaSelection');
    document.dispatchEvent(event);
}

document.getElementById("save").addEventListener("click", async () => {
    if (!validateInputs()) return;

    toggleLoading(true);

    const threshold = parseInt(document.getElementById("threshold").value);
    const email = document.getElementById("email").value;
    const interval = parseInt(document.getElementById("interval").value);

    try {
        await chrome.storage.local.set({ 
            threshold,
            email,
            interval
        });

        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, {
                action: "updateSettings",
                settings: { threshold, interval }
            });
        });

        showStatus('Settings saved successfully');
    } catch (error) {
        showStatus('Failed to save settings', 'error');
    } finally {
        toggleLoading(false);
    }
});

// Load saved settings
window.addEventListener('load', async () => {
    try {
        const data = await chrome.storage.local.get(["threshold", "email", "interval"]);
        if (data.threshold) {
            document.getElementById("threshold").value = data.threshold;
        }
        if (data.email) {
            document.getElementById("email").value = data.email;
        }
        if (data.interval) {
            document.getElementById("interval").value = data.interval;
        }
    } catch (error) {
        showStatus('Failed to load settings', 'error');
    }
}); 