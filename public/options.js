const RUNNING = 0;
const PAUSED = 1;

function changeState(state) {
    if (state === RUNNING) {
        document.getElementById("status").textContent = "RUNNING";
        document.getElementById("toggleEnabled").checked = true;
        document.getElementById("status").classList.remove("bg-red-300");
        document.getElementById("status").classList.add("bg-green-300");
    } else if (state === PAUSED || state === undefined) {
        document.getElementById("status").textContent = "PAUSED";
        document.getElementById("toggleEnabled").checked = false;
        document.getElementById("status").classList.remove("bg-green-300");
        document.getElementById("status").classList.add("bg-red-300");
    } else {
        console.error("Unknown state:", state);
    }
}

// Update UI to current state.
chrome.storage.local.get("state").then(storage => changeState(storage.state));

// Listen for state changes.
chrome.storage.onChanged.addListener((changes) => {
    if (changes.state) {
        changeState(changes.state.newValue);
    }
});

document.getElementById("toggleEnabled").addEventListener("click", async event => {
    if (event.target.checked === true) {
        chrome.runtime.sendMessage({ type: "rally-sdk.change-state", data: { state: "resume" } });
    } else {
        chrome.runtime.sendMessage({ type: "rally-sdk.change-state", data: { state: "pause" } });
    }
});

document.getElementById("download").addEventListener("click", async () => {
    // Get all data from local storage.
    // TODO we can pull this from glean more directly in the future.
    const storage = await chrome.storage.local.get(null);

    const pageNavigationData = [];
    const pixelData = [];

    for (const [key, value] of Object.entries(storage)) {
        if (key.startsWith("pageNavigationPing")) {
            pageNavigationData.push(value);
            await chrome.storage.local.remove(key);
        } else if (key.startsWith("pixelPing")) {
            pixelData.push(value);
            await chrome.storage.local.remove(key);
        }
    }

    if (!(pixelData && pageNavigationData)) {
        throw new Error("No test data present to export, yet");
    }

    console.debug("Converting pixel data JSON to CSV:", pixelData);
    console.debug("Converting page navigation JSON to CSV:", pageNavigationData);

    exportDataAsCsv(pageNavigationData, "pageNavigations");
    exportDataAsCsv(pixelData, "pixels");
});

function exportDataAsCsv(data, name) {
    // Extract all keys from the first object present, to use as CSV headers.
    // TODO if we want to bundle different types of pings in the same CSV, then we should iterate over all objects.
    // TODO if not, then we should figure out how to bundle different types of pings into different CSVs.
    const headerSet = new Set();
    for (const header of Object.keys(data[0])) {
        headerSet.add(header);
    }
    const headers = Array.from(headerSet);

    let csvData = "";

    // Print one line with each header.
    for (const [i, header] of headers.entries()) {
        csvData += `${header}`;
        if (i == headers.length - 1) {
            csvData += `\n`;
        } else {
            csvData += `,`;
        }
    }

    // Print the value for each measurement, in the same order as the headers on the first line.
    for (const ping of data) {
        for (const [i, header] of headers.entries()) {
            const value = ping[header];
            csvData += JSON.stringify(value);
            if (i == headers.length - 1) {
                csvData += `\n`;
            } else {
                csvData += `,`;
            }
        }
    }

    const dataUrl = (`data:text/csv,${encodeURIComponent(csvData)}`);

    const downloadLink = document.getElementById("downloadLink");
    downloadLink.setAttribute("href", dataUrl);
    downloadLink.setAttribute("download", `facebook-pixel-hunt-${name}.csv`);
    downloadLink.click();
}
