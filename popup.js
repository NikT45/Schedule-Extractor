// Inject content.js dynamically and send a message for data download
document.getElementById("downloadButton").addEventListener("click", () => {
 

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTab = tabs[0];
        if (!activeTab) {
            console.error("No active tab found.");
            document.getElementById("result").textContent = "Failed to download schedule.";
            return;
        }

        // Inject content.js into the active tab
        chrome.scripting.executeScript(
            {
                target: { tabId: activeTab.id },
                files: ["content.js"],
            },
            () => {
                console.log("Content script injected.");
                // Send a message to the injected script
                chrome.tabs.sendMessage(
                    activeTab.id,
                    { action: "downloadData" },
                    (response) => {
                        if (response && response.success) {
                            console.log("Schedule download started.");
                            document.getElementById("result").textContent = "Downloading...";
                        } else {
                            console.error("Failed to download schedule.");
                            document.getElementById("result").textContent = "Failed to download schedule.";
                        }
                    }
                );
            }
        );
    });
});
