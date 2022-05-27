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
});

document.addEventListener("DOMContentLoaded", async () => {
    // eslint-disable-next-line no-undef
    const db = new Dexie("pixelhunt");

    await db.open();
    const viz = document.getElementById("viz")
    const journeys = await db.table("fbpixelhunt-journey");
    const pixels = await db.table("fbpixelhunt-pixel");

    const pixelPageIds = new Set();
    await pixels.each(a => {
        const pixelPageId = a.facebook_pixel_pixel_page_id;
        pixelPageIds.add(pixelPageId);
    });

    const results = {};
    await journeys.each(a => {
        const pageId = a.user_journey_page_id;
        if (pixelPageIds.has(pageId)) {
            const url = new URL(a.user_journey_url);
            if (url.origin in results) {
                let count = results[url.origin];
                results[url.origin] = ++count;
            } else {
                results[url.origin] = 1;
            }
        }
    });

    for (const [url, count] of Object.entries(results).sort((a, b) => b[1] - a[1])) {
        const p = document.createElement("p");
        p.appendChild(document.createTextNode(`${url}: ${count}`));
        viz.appendChild(p);
    }
});