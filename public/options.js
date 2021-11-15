const RUNNING = "running";
const PAUSED = "paused";

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
browser.storage.local.get("state").then(storage => changeState(storage.state));

// Listen for state changes.
browser.storage.onChanged.addListener((changes) => {
    if (changes.state) {
        changeState(changes.state.newValue);
    }
});

document.getElementById("toggleEnabled").addEventListener("click", async event => {
    if (event.target.checked === true) {
        browser.runtime.sendMessage({ type: "rally-sdk.change-state", data: { state: "resume" } });
    } else {
        browser.runtime.sendMessage({ type: "rally-sdk.change-state", data: { state: "pause" } });
    }
});

document.getElementById("download").addEventListener("click", async () => {
    // Get all data from local storage.
    // FIXME glean should be storing in `pingLifetimeEvents`, figure out why it is not
    const data = (await browser.storage.local.get("testPings"))["testPings"];
    if (!data) {
        throw new Error("No test data present to export, yet");
    }

    console.debug("Converting JSON to CSV:", data);

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
    downloadLink.setAttribute("download", "facebook-pixel-hunt.csv");
    downloadLink.click();
});
