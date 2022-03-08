(function () {
    'use strict';

    /**
     * This module facilitates timestamping events, using a standardized clock.
     * When supported by the browser, WebScience uses the shared monotonic clock
     * specified by the W3C High Resolution Time recommendation. Otherwise,
     * WebScience uses the system clock.
     * 
     * ## Web Browser Clocks
     * There are two clocks supported in modern web browsers.
     *   * __System Clock__ (`Date.now()` or `new Date`). The system clock is
     *     the ordinary time provided by the operating system. Using the
     *     system clock to timestamp events poses a risk: the user or operating
     *     system can adjust the clock at any time, for any reason, without any
     *     notice, to any value. The user might manually adjust the clock, for
     *     example, or the operating system might synchronize the clock to account
     *     for clock skew (e.g., NTP time sync). These adjustments can be large and
     *     non-monotonic, breaking assumptions that WebScience makes about timestamp
     *     proximity and ordering. A clock change during study execution could
     *     introduce subtle bugs or other unexpected behavior.
     *   * __Shared Monotonic Clock__
     *    (`performance.timeOrigin + performance.now()`). The W3C High Resolution
     *    Time recommendation specifies a shared monotonic clock. This clock
     *    should have the following properties:
     *      * strictly monotonic;
     *      * not subject to large or non-monotonic adjustments from any source;
     *      * consistent across cores, processes, threads, and globals down to the
     *        hardware level; and
     *      * synchronized to the system clock just once, on browser startup.
     *      
     * Our goal is to migrate WebScience and Rally studies to the shared monotonic
     * clock, because it does not have clock change risks like the system clock.
     * Unfortunately, browser implementations of High Resolution Time currently
     * depart from the W3C recommendation in significant ways that prevent reliance
     * on the shared monotonic clock. We will update this module as browsers correct
     * their implementations.
     * 
     * ## Additional Notes
     *   * The High Resolution Time spec describes a shared monotonic clock (which
     *     must be used to generate `performance.timeOrigin` for each global) and
     *     per-global monotonic clocks (which tick for  `performance.now()` and other
     *     uses of `DOMHighResTimeStamp`). Monotonic clocks on modern hardware are
     *     synchronized across cores, processes, and threads, so we treat
     *     `performance.timeOrigin + performance.now()` as the current time on the
     *     shared monotonic clock, even though the W3C spec doesn't _quite_ say that.
     *   * Firefox and Chrome currently depart from the High Resolution Time
     *     spec in significant ways: `performance.timeOrigin` is sometimes set from
     *     the system clock rather than the shared monotonic clock, and
     *     `performance.now()` (and other uses of `DOMHighResTimeStamp`) do not
     *     tick during system sleep on certain platforms.
     *  
     * @see {@link https://www.w3.org/TR/hr-time-2/}
     * @see {@link https://github.com/mdn/content/issues/4713}
     * @see {@link https://github.com/w3c/hr-time/issues/65}
     * @module timing
     */

    /**
     * Get the current time, in milliseconds since the epoch, using a
     * standardized clock.
     * @returns {number} The current time, in milliseconds since the epoch.
     */
    function now() {
        return Date.now();
    }

    /**
     * Content script for the pageNavigation module.
     *
     * # Known Issues
     *   * When sending page data during a page visit stop event, sometimes
     *     Firefox generates an error ("Promise resolved while context is inactive")
     *     because the content script execution environment is terminating while the
     *     message sending Promise remains open. This error does not affect functionality,
     *     because we do not depend on resolving the Promise (i.e., a response to the
     *     page visit stop message).
     * @module pageNavigation.content
     */

    // Function encapsulation to wait for pageManager load
    const pageNavigation = function () {

        // If the pageNavigation content script is already running on this page, no need for this instance
        if("webScience" in window) {
            if("pageNavigationActive" in window.webScience) {
                return;
            }
            window.webScience.pageNavigationActive = true;
        }
        else {
            window.webScience = {
                pageNavigationActive: true
            };
        }

        const pageManager = window.webScience.pageManager;

        /**
         * How long the page has had the user's attention.
         * @type {number}
         */
        let attentionDuration = 0;

        /**
         * When the page attention state was last updated.
         * @type {number}
         */
        let lastAttentionUpdateTime = 0;

        /**
         * How long the page has played audio.
         * @type {number}
         */
        let audioDuration = 0;

        /**
         * When the page last began playing audio.
         * @type {number}
         */
        let lastAudioUpdateTime = 0;

        /**
         * How long the page has simultaneously had attention and played audio. This value is
         * a useful approximation of video viewing time.
         * @type {number}
         */
        let attentionAndAudioDuration = 0;

        /**
         * How often (in milliseconds) to check maximum page scroll depth.
         * @constant {number}
         */
        const scrollDepthUpdateInterval = 1000;

        /**
         * How often (in milliseconds) after the first time the page gains attention (or after
         * page visit start if `scrollDepthWaitForAttention` is `false`) to begin checking the
         * maximum relative scroll depth. A delay is helpful because some pages have placeholder
         * content while loading (e.g., on YouTube) or lazily load contnt (e.g., on Twitter).
         * @constant {number}
         */
        const scrollDepthUpdateDelay = 2000;

        /**
         * The minimum page height required (in pixels, using the maximum of `document.documentElement.offsetHeight`
         * and `window.scrollY`) to check the maximum relative scroll depth. A minimum height is helpful because some
         * pages have placeholder content while loading (e.g., on YouTube) or lazily load content (e.g., on Twitter).
         * We use `document.documentElement.offsetHeight` because it typically measures the vertical height of document
         * content, and we use `window.scrollY` as a backstop of real user scrolling because in unusual layouts (e.g.,
         * YouTube) the value of `document.documentElement.offsetHeight` is 0. We do not use `scrollHeight` or
         * `clientHeight` because those values are clamped to screen size.
         * @constant {number}
         */
        const scrollDepthMinimumHeight = 50;

        /**
         * Whether to wait until the first time the page gains attention before checking the maximum relative
         * scroll depth. Delaying until the first instance of attention is helpful because some pages have
         * placeholder content while loading (e.g., on YouTube) or lazily load contnt (e.g., on Twitter).
         * @constant {boolean}
         */
        const scrollDepthWaitForAttention = true;

        /**
         * The first time the page had attention, or 0 if the page has never had attention.
         * @type {number}
         */
        let firstAttentionTime = 0;

        /**
         * The maximum relative scroll depth, defined as the depth of the bottom of
         * the content window divided by the depth of the page:
         * (`window.scrollY` + `document.documentElement.clientHeight`) / `document.documentElement.scrollHeight`.
         * Note that `document.documentElement.clientHeight` and `document.documentElement.scrollHeight`
         * include padding but not margin or border.
         * @type {number}
         */
        let maxRelativeScrollDepth = 0;

        /**
         * An interval timer ID for checking scroll depth.
         * @type {number}
         */
        let scrollDepthIntervalId = 0;

        /**
         * A timer tick callback function that updates the maximum relative scroll depth on the page.
         */
        function updateMaxRelativeScrollDepth() {
            const nowTimeStamp = now();
            /* Don't measure scroll depth if:
             *   * The page doesn't have the user's attention
             *   * Scroll depth measurement doesn't wait on attention and the page load is too recent
             *   * Scroll depth measurement does wait on attention and either the first attention hasn't happened or is too recent
             *   * The content height and user scrolling are below a minimum amount
             */
            if(!pageManager.pageHasAttention ||
                (!scrollDepthWaitForAttention ) || 
                (((firstAttentionTime <= 0) || ((nowTimeStamp - firstAttentionTime) < scrollDepthUpdateDelay))) ||
                (Math.max(document.documentElement.offsetHeight, window.scrollY) < scrollDepthMinimumHeight)) {
                return;
            }
            // Set the maximum relative scroll depth
            maxRelativeScrollDepth = Math.min(
                Math.max(maxRelativeScrollDepth, (window.scrollY + document.documentElement.clientHeight) / document.documentElement.scrollHeight),
                1);
        }

        /**
         * A callback function for pageManager.onPageVisitStart.
         * @param {Object} details
         * @param {number} details.timeStamp 
         */
        function pageVisitStart ({ timeStamp }) {
            // Reset page attention and page audio tracking
            attentionDuration = 0;
            lastAttentionUpdateTime = timeStamp;
            firstAttentionTime = pageManager.pageHasAttention ? timeStamp : 0;
            audioDuration = 0;
            lastAudioUpdateTime = timeStamp;
            attentionAndAudioDuration = 0;
            scrollDepthIntervalId = 0;

            // Reset scroll depth tracking and, if the page has attention, set an interval timer for checking scroll depth
            maxRelativeScrollDepth = 0;
            if(pageManager.pageHasAttention) {
                scrollDepthIntervalId = setInterval(updateMaxRelativeScrollDepth, scrollDepthUpdateInterval);
            }
        }
        if(pageManager.pageVisitStarted) {
            pageVisitStart({ timeStamp: pageManager.pageVisitStartTime });
        }
        pageManager.onPageVisitStart.addListener(pageVisitStart);

        pageManager.onPageVisitStop.addListener(({ timeStamp }) => {
            // Update the attention and audio durations
            if(pageManager.pageHasAttention)
                attentionDuration += timeStamp - lastAttentionUpdateTime;
            if(pageManager.pageHasAudio)
                audioDuration += timeStamp - lastAudioUpdateTime;
            if(pageManager.pageHasAttention && pageManager.pageHasAudio)
                attentionAndAudioDuration += timeStamp - Math.max(lastAttentionUpdateTime, lastAudioUpdateTime);

            // Clear the interval timer for checking scroll depth
            clearInterval(scrollDepthIntervalId);

            // Send page engagement data to the background script
            pageManager.sendMessage({
                type: "webScience.pageNavigation.pageData",
                pageId: pageManager.pageId,
                url: pageManager.url,
                referrer: pageManager.referrer,
                pageVisitStartTime: pageManager.pageVisitStartTime,
                pageVisitStopTime: timeStamp,
                attentionDuration,
                audioDuration,
                attentionAndAudioDuration,
                maxRelativeScrollDepth,
                privateWindow: browser.extension.inIncognitoContext
            });
        });

        pageManager.onPageAttentionUpdate.addListener(({ timeStamp }) => {
            // If the page just gained attention, start the timer, and if this
            // was the first user attention store the timestamp
            if(pageManager.pageHasAttention) {
                if(scrollDepthIntervalId <= 0) {
                    scrollDepthIntervalId = setInterval(updateMaxRelativeScrollDepth, scrollDepthUpdateInterval);
                }
                if(firstAttentionTime < pageManager.pageVisitStartTime) {
                    firstAttentionTime = timeStamp;
                }
            }

            // If the page just lost attention, add to the attention duration
            // and possibly the attention and audio duration, and stop the timer
            if(!pageManager.pageHasAttention) {
                attentionDuration += timeStamp - lastAttentionUpdateTime;
                if(pageManager.pageHasAudio) {
                    attentionAndAudioDuration += timeStamp - Math.max(lastAttentionUpdateTime, lastAudioUpdateTime);
                }
                clearInterval(scrollDepthIntervalId);
                scrollDepthIntervalId = 0;
            }
            lastAttentionUpdateTime = timeStamp;
        });

        pageManager.onPageAudioUpdate.addListener(({ timeStamp }) => {
            // If the page just lost audio, add to the audio duration
            // and possibly the attention and audio duration
            if(!pageManager.pageHasAudio) {
                audioDuration += timeStamp - lastAudioUpdateTime;
                if(pageManager.pageHasAttention) {
                    attentionAndAudioDuration += timeStamp - Math.max(lastAttentionUpdateTime, lastAudioUpdateTime);
                }
            }
            lastAudioUpdateTime = timeStamp;
        });
    };

    // Wait for pageManager load
    if (("webScience" in window) && ("pageManager" in window.webScience)) {
        pageNavigation();
    }
    else {
        if(!("pageManagerHasLoaded" in window)) {
            window.pageManagerHasLoaded = [];
        }
        window.pageManagerHasLoaded.push(pageNavigation);
    }

})();
