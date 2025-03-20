chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "notify") {
    // Create notification
    let notificationOptions = {
      type: "basic",
      iconUrl: "icons/icon128.png",
      title: "Threshold Exceeded!",
      message: `Value increased from ${message.oldValue} to ${message.newValue}`
    };
    chrome.notifications.create(notificationOptions);

    // Get email from storage and send notification
    chrome.storage.local.get("email", (data) => {
      if (data.email) {
        fetch("https://your-email-api.com/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: data.email,
            message: `Monitored value increased from ${message.oldValue} to ${message.newValue}`
          })
        });
      }
    });
  }

  if (message.type === "startSelection") {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const tab = tabs[0];
      
      // Inject CSS first
      await chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        files: ['selector.css']
      });

      // Then inject the content script
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });

      // Finally, send message to the content script
      setTimeout(() => {
        chrome.tabs.sendMessage(tab.id, { action: "startSelection" });
      }, 100);
    });
  }
}); 