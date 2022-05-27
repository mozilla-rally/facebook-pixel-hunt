const RUNNING = "Running";
const PAUSED = "Paused";

function changeState(state) {
    console.debug("state:", state);
    if (state === RUNNING) {
        document.getElementById("status").textContent = "Running";
        document.getElementById("toggleEnabled").checked = true;
        document.getElementById("status").classList.remove("bg-red-500");
        document.getElementById("status").classList.add("bg-green-500");
    } else if (state === PAUSED || state === undefined) {
        document.getElementById("status").textContent = "Paused";
        document.getElementById("toggleEnabled").checked = false;
        document.getElementById("status").classList.remove("bg-green-500");
        document.getElementById("status").classList.add("bg-red-500");
    } else {
        console.error("Unknown state:", state);
    }
}

// Update UI to current state.
browser.storage.local.get("state").then(storage => changeState(storage.state));

// Listen for state changes.
browser.storage.onChanged.addListener((changes) => {
    if (changes.state) {
        changeState(changes.state.newValue);
    }
});

document.getElementById("toggleEnabled").addEventListener("click", async event => {
    if (event.target.checked === true) {
        browser.runtime.sendMessage({ type: "rally-sdk.change-state", data: { state: "Running" } });
    } else {
        browser.runtime.sendMessage({ type: "rally-sdk.change-state", data: { state: "Paused" } });
    }
});

document.getElementById("download").addEventListener("click", async () => {
    // Clear any outstanding browser badge text.
    browser.action.setBadgeText({ text: "" });
    // Get all data from local storage.
    // TODO we can pull this from glean more directly in the future.
    const storage = await browser.storage.local.get(null);

    const pings = {};

    for (const [key, value] of Object.entries(storage)) {
        if (key.includes("-ping")) {
            const ping = JSON.parse(value);
            const result = {};
            for (const [_type, kv] of Object.entries(ping.metrics)) {
                console.debug("CSV export discarding type:", _type, "for value:", kv);
                Object.assign(result, kv);
            }

            const pingType = key.substring(0, key.indexOf('-ping'));
            if (!(pingType in pings)) {
                pings[pingType] = [];
            }
            pings[pingType].push(result);
            await browser.storage.local.remove(key);
        }
    }

    if (Object.keys(pings).length === 0) {
        throw new Error("No test data present to export, yet");
    }

    exportDataAsCsv(pings);
});

function exportDataAsCsv(pings) {
    let csvData = "";

    for (const pingType in pings) {
        const data = pings[pingType]

        if (data.length === 0) {
            continue;
        }

        // Extract all keys from the first object present, to use as CSV headers.
        const headerSet = new Set();
        for (const header of Object.keys(data[0])) {
            headerSet.add(header);
        }
        const headers = Array.from(headerSet);

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

        csvData += `\n`;
        csvData += `\n`;
    }



    const dataUrl = (`data:text/csv,${encodeURIComponent(csvData)}`);

    const downloadLink = document.getElementById("downloadLink");
    downloadLink.setAttribute("href", dataUrl);
    downloadLink.setAttribute("download", `facebook-pixel-hunt-${name}.csv`);
    downloadLink.click();
}
