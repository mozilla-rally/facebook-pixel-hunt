(function () {
  'use strict';

  // Unique ID creation requires a high quality random # generator. In the browser we therefore
  // require the crypto API and do not support built-in fallback to lower quality random number
  // generators (like Math.random()).
  var getRandomValues;
  var rnds8 = new Uint8Array(16);
  function rng() {
    // lazy load so that environments that need to polyfill have a chance to do so
    if (!getRandomValues) {
      // getRandomValues needs to be invoked in a context where "this" is a Crypto implementation. Also,
      // find the complete implementation of crypto (msCrypto) on IE11.
      getRandomValues = typeof crypto !== 'undefined' && crypto.getRandomValues && crypto.getRandomValues.bind(crypto) || typeof msCrypto !== 'undefined' && typeof msCrypto.getRandomValues === 'function' && msCrypto.getRandomValues.bind(msCrypto);

      if (!getRandomValues) {
        throw new Error('crypto.getRandomValues() not supported. See https://github.com/uuidjs/uuid#getrandomvalues-not-supported');
      }
    }

    return getRandomValues(rnds8);
  }

  var REGEX = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000)$/i;

  function validate(uuid) {
    return typeof uuid === 'string' && REGEX.test(uuid);
  }

  /**
   * Convert array of 16 byte values to UUID string format of the form:
   * XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX
   */

  var byteToHex = [];

  for (var i = 0; i < 256; ++i) {
    byteToHex.push((i + 0x100).toString(16).substr(1));
  }

  function stringify(arr) {
    var offset = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
    // Note: Be careful editing this code!  It's been tuned for performance
    // and works in ways you may not expect. See https://github.com/uuidjs/uuid/pull/434
    var uuid = (byteToHex[arr[offset + 0]] + byteToHex[arr[offset + 1]] + byteToHex[arr[offset + 2]] + byteToHex[arr[offset + 3]] + '-' + byteToHex[arr[offset + 4]] + byteToHex[arr[offset + 5]] + '-' + byteToHex[arr[offset + 6]] + byteToHex[arr[offset + 7]] + '-' + byteToHex[arr[offset + 8]] + byteToHex[arr[offset + 9]] + '-' + byteToHex[arr[offset + 10]] + byteToHex[arr[offset + 11]] + byteToHex[arr[offset + 12]] + byteToHex[arr[offset + 13]] + byteToHex[arr[offset + 14]] + byteToHex[arr[offset + 15]]).toLowerCase(); // Consistency check for valid UUID.  If this throws, it's likely due to one
    // of the following:
    // - One or more input array values don't map to a hex octet (leading to
    // "undefined" in the uuid)
    // - Invalid input values for the RFC `version` or `variant` fields

    if (!validate(uuid)) {
      throw TypeError('Stringified UUID is invalid');
    }

    return uuid;
  }

  function v4(options, buf, offset) {
    options = options || {};
    var rnds = options.random || (options.rng || rng)(); // Per 4.4, set bits for version and `clock_seq_hi_and_reserved`

    rnds[6] = rnds[6] & 0x0f | 0x40;
    rnds[8] = rnds[8] & 0x3f | 0x80; // Copy bytes to buffer, if provided

    if (buf) {
      offset = offset || 0;

      for (var i = 0; i < 16; ++i) {
        buf[offset + i] = rnds[i];
      }

      return buf;
    }

    return stringify(rnds);
  }

  /**
   * This module provides functionality for generating random identifiers.
   * Studies can use these identifiers to uniquely label events and other
   * items of interest.
   * @module id
   */

  /**
   * Generate a random (v4) UUID, consistent with RFC4122. These values
   * include 122 bits of cryptographic randomness.
   * @returns {string} The new UUID.
   */
  function generateId() {
      return v4();
  }

  /**
   * This module provides functionality for constructing events similar to
   * WebExtensions `events.Event` objects.
   *
   * @module events
   */

  /**
   * A callback function that is called immediately before a listener is added.
   * @callback addListenerCallback
   * @param {Function} listener - The listener that is being added.
   * @param {Object} options - The options for the listener.
   */

  /**
   * A callback function that is called immediately after a listener is removed.
   * @callback removeListenerCallback
   * @param {Function} listener - The listener that was removed.
   * @param {Object} options - The options that the listener was added with.
   */

  /**
   * A callback function that is called when a listener may be notified via
   * `notifyListeners()`.
   * @callback notifyListenersCallback
   * @param {Function} listener - The listener that may be called.
   * @param {Array} listenerArguments - The arguments that would be passed to the listener
   * function.
   * @param {Options} options - The options that the listener was added with.
   * @returns {boolean} Whether to call the listener.
   */

  /**
   * A class that provides an event API similar to WebExtensions `events.Event` objects.
   * Use the `createEvent` function to create an `Event` object.
   * @hideconstructor
   */
  class Event {
      /**
       * Creates an event instance similar to WebExtensions `events.Event` objects.
       * @param {Object} [options] - A set of options for the event.
       * @param {name} [options.name] - The name of the event.
       * @param {addListenerCallback} [options.addListenerCallback] - A function that is
       * called when a listener is added.
       * @param {removeListenerCallback} [options.removeListenerCallback] - A function
       * that is called when a listener is removed.
       * @param {notifyListenersCallback} [options.notifyListenersCallback] - A function
       * that is called before a listener is notified and can filter the notification.
       */
      constructor({
          name = null,
          addListenerCallback = null,
          removeListenerCallback = null,
          notifyListenersCallback = null
      } = {
          name: null,
          addListenerCallback: null,
          removeListenerCallback: null,
          notifyListenersCallback: null
      }) {
          this.name = name;
          this.addListenerCallback = addListenerCallback;
          this.removeListenerCallback = removeListenerCallback;
          this.notifyListenersCallback = notifyListenersCallback;
          this.listeners = new Map();
      }

      /**
       * Add an event listener with the specified options. If the listener has
       * previously been added for the event, the listener's options will be
       * updated.
       * @param {Function} listener - The listener to call when the event fires.
       * @param {Object} options - Options for when the listener should be called.
       */
      addListener(listener, options) {
          if(this.addListenerCallback !== null) {
              this.addListenerCallback(listener, options);
          }
          this.listeners.set(listener, options);
          // If the event has a name, annotate the listener with the name
          if(typeof this.name === "string") {
              listener.webScienceEventName = this.name;
          }
      }

      /**
       * Remove an event listener.
       * @param {Function} listener - The listener to remove.
       */
      removeListener(listener) {
          if(this.removeListenerCallback !== null) {
              this.removeListenerCallback(listener, this.listeners.get(listener));
          }
          this.listeners.delete(listener);
      }

      /**
       * Check whether a particular event listener has been added.
       * @param {EventCallbackFunction} listener - The listener to check.
       * @returns {boolean} Whether the listener has been added.
       */
      hasListener(listener) {
          return this.listeners.has(listener);
      }

      /**
       * Check whether there are any listeners for the event.
       * @returns {boolean} Whether there are any listeners for the event.
       */
      hasAnyListeners() {
          return this.listeners.size > 0;
      }

      /**
       * Notify the listeners for the event.
       * @param {Array} [listenerArguments=[]] - The arguments that will be passed to the
       * listeners.
       */
      notifyListeners(listenerArguments = []) {
          this.listeners.forEach((options, listener) => {
              try {
                  if((this.notifyListenersCallback === null) || this.notifyListenersCallback(listener, listenerArguments, options)) {
                      listener.apply(null, listenerArguments);
                  }
              }
              catch(error) {
              }
          });
      }
  }

  /**
   * An extension of the Event class that permits only one listener at a time.
   * @template EventCallbackFunction
   * @template EventOptions
   * @extends {Event<EventCallbackFunction, EventOptions>}
   * @private
   */
  class EventSingleton extends Event {
      /**
       * A function that adds an event listener, with optional parameters. If the
       * listener has previously been added for the event, the listener's options
       * (if any) will be updated.
       * @param {EventCallbackFunction} listener - The function to call when the event fires.
       * @param {EventOptions} options - Options for when the listener should be called.
       * The supported option(s) depend on the event type.
       * @throws {Error} This function throws an Error if there is already a listener for
       * the event.
       */
      addListener(listener, options) {
          if(this.listeners.size > 0)
              throw new Error("Error: cannot add more than one listener to EventSingleton event.");
          super.addListener(listener, options);
      }
  }

  /**
   * Create a new Event object that implements WebExtensions event syntax, with the
   * provided options.
   * @param {Object} [options] - The options for the event.
   * @param {string} options.name - The name of the event.
   * @param {addListenerCallback} [options.addListenerCallback] - A function that is
   * called when a listener is added.
   * @param {removeListenerCallback} [options.removeListenerCallback] - A function
   * that is called when a listener is removed.
   * @param {notifyListenersCallback} [options.notifyListenersCallback] - A function
   * that is called before a listener is notified and can filter the notification.
   * @param {boolean} [options.singleton = false] - Whether to allow only one listener
   * for the event.
   * @returns {Event} - The created `Event` object.
   */
   function createEvent({
      name = null,
      addListenerCallback = null,
      removeListenerCallback = null,
      notifyListenersCallback = null,
      singleton = false
  } = {
      name: null,
      addListenerCallback: null,
      removeListenerCallback: null,
      notifyListenersCallback: null,
      singleton: false
  }) {
      if(singleton) {
          return /*@__PURE__*/new EventSingleton({
              name,
              addListenerCallback,
              removeListenerCallback,
              notifyListenersCallback
          });
      }
      return /*@__PURE__*/new Event({
          name,
          addListenerCallback,
          removeListenerCallback,
          notifyListenersCallback
      });
  }

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
   * Convert a timestamp on the shared monotonic clock to a timestamp
   * on the standardized clock. Use this function only where strictly
   * necessary, and where it can be used immediately after the timestamp
   * on the monotonic clock. There is a risk that the system clock will
   * have changed between the timestamp and now or that the monotonic
   * clock was affected by an implementation bug.
   * @param {number} timeStamp - A timestamp, in milliseconds since the
   * epoch, on the shared monotonic clock.
   * @param {boolean} relativeToTimeOrigin - Whether the timestamp
   * is relative to a time origin (e.g., a DOM event or Performance API
   * timestamp), or the time origin has already been added to the
   * timestamp (e.g., `performance.timeOrigin` or
   * `performance.timeOrigin + performance.now()`).
   * @returns {number} A timestamp, in milliseconds since the epoch, on
   * the standardized clock.
   * @example
   * const monotonicTimeStamp = performance.timeOrigin;
   * const standardizedTimeStamp = webScience.timing.fromMonotonicClock(monotonicTimeStamp, false);
   * @example
   * const monotonicTimeStamp = performance.timeOrigin + performance.now();
   * const standardizedTimeStamp = webScience.timing.fromMonotonicClock(monotonicTimeStamp, false);
   * @example
   * const relativeMonotonicTimeStamp = performance.now();
   * const standardizedTimeStamp = webScience.timing.fromMonotonicClock(relativeMonotonicTimeStamp, true);
   */
  function fromMonotonicClock(timeStamp, relativeToTimeOrigin) {
      if(relativeToTimeOrigin) {
          return timeStamp - window.performance.now() + Date.now();
      }
      return timeStamp - window.performance.now() - window.performance.timeOrigin + Date.now();
  }

  /**
   * Content script for the pageManager module. This script provides a
   * `webScience.pageManager` API with global scope in the content script environment.
   * The API includes the following features.
   *   * Page Tracking
   *     * `pageId` - A unique ID for the page.
   *     * `url` - The URL of the page, omitting any hash.
   *     * `referrer` - The HTTP referrer for the page. Note that, when a page loads via
   *       the History API, the referrer is unchanged because there is no document-level
   *       HTTP request. 
   *     * `isHistoryChange` - Whether the page visit was caused by a change via the
   *       History API rather than ordinary web navigation.
   *     * `webNavigationTimeStamp` - If the page visit was caused by a change via the
   *       History API, the timestamp on the system clock for the
   *       webNavigation.onHistoryStateUpdated event. Otherwise, 0. 
   *   * Page Events
   *     * `onPageVisitStart` - An event that fires when a page visit begins. Note that
   *       the page visit start event may have already fired by the time another
   *       content script attaches (see discussion below).
   *     * `onPageVisitStop` - An event that fires when a page visit ends.
   *     * `onPageAttentionUpdate` - An event that fires when the page's attention state
   *     changes.
   *     * `onPageAudioUpdate` - An event that fires when the page's audio state changes.
   *   * Page Properties
   *     * `pageHasAttention` - Whether the page currently has the user's attention.
   *     * `pageHasAudio - Whether there is currently audio playing on the page.
   *     * `pageVisitStarted` - Whether the page visit start event has completed firing,
   *     such that all listeners have been notified.
   *     * `pageVisitStartTime` - The time that the page visit started.
   *
   * # Events
   * See the documentation in the pageManager module for detail on the event types.
   *
   * Each event implements the standard WebExtensions event features.
   *   * addListener
   *   * removeListener
   *   * hasListener
   *
   * Event listeners receive an object with the following property.
   *   * timeStamp - The time that the underlying browser event fired.
   *
   * Listeners for the page visit start event receive an object with the following
   * additional property.
   *   * isHistoryChange - Whether the page visit was caused by a change via the History API.
   *
   * Example usage:
   * ```
   * webScience.pageManager.onPageVisitStop.addListener(({timeStamp}) => {
   *     console.log(`Page visit stopped at ${timeStamp} with page ID ${pageManager.pageId}`);
   * });
   *
   * webScience.pageManager.onPageAttentionUpdate.addListener(({timeStamp}) => {
   *     console.log(`Page attention update at ${timeStamp} with attention state ${pageManager.pageHasAttention}.`);
   * });
   * ```
   *
   * # Content Script Load Ordering
   * ## Executing a Content Script After the pageManager API Has Loaded
   * Note that the WebExtensions content script model does not guarantee execution
   * order for content scripts, so it is possible that the API will not have loaded
   * when a content script that depends on the API loads. As a workaround, this
   * content script checks the global `pageManagerHasLoaded` for an array of
   * functions to call after the content script has executed, but before the content
   * script has fired the page visit start event.
   *
   * Example usage:
   * ```
   * function main() {
   *     // Content script logic goes here
   * }
   *
   * if(("webScience" in window) && ("pageManager" in window.webScience))
   *     main();
   * else {
   *     if(!("pageManagerHasLoaded" in window))
   *         window.pageManagerHasLoaded = [];
   *     window.pageManagerHasLoaded.push(main);
   * }
   * ```
   *
   * ## Listening for the Page Visit Start Event
   * Because the order of content script execution is not guaranteed, a content
   * script that uses the pageManager API might miss a page visit start event. For
   * example, the pageManager content script might attach and fire the page visit
   * start event, then another content script attaches and begins listening for
   * the event. The pageManager API addresses this limitation by providing a
   * `pageVisitStarted` boolean reflecting whether the page visit start event has
   * already completed firing (i.e., all listeners have been notified). Content scripts
   * that use the page visit start event will commonly want to call their own page visit
   * start listener if `pageVisitStarted` is `true`.
   *
   * Example usage:
   * ```
   * function pageVisitStartListener({timeStamp}) {
   *     // Page visit start logic goes here
   * }
   * webScience.pageManager.onPageVisitStart.addListener(pageVisitStartListener);
   * if(webScience.pageManager.pageVisitStarted)
   *     pageVisitStartListener({ timeStamp: pageManager.pageVisitStartTime });
   * ```
   *
   * # Known Issues
   *   * When sending a page visit stop message to the background script, sometimes
   *     Firefox generates an error ("Promise resolved while context is inactive")
   *     because the content script execution environment is terminating while the
   *     message sending Promise remains open. This error does not affect functionality,
   *     because we do not depend on resolving the Promise (i.e., a response to the
   *     page visit stop message).
   * @module pageManager.content
   */

  // IIFE wrapper to allow early return
  (function () {

      // Check if the pageManager content script has already run on this page
      // If it has, bail out
      if(("webScience" in window) && ("pageManager" in window.webScience)) {
          return;
      }

      // Construct a webScience.pageManager object on the `window` global
      // All the public pageManager functionality that is available in the content
      // script environment is exposed through this object
      if(!("webScience" in window)) {
          window.webScience = { };
      }
      window.webScience.pageManager = { };
      const pageManager = window.webScience.pageManager;

      /**
       * Returns a copy of the URL string from `window.location.href`, without any
       * hash at the end. We canonicalize URLs without the hash because jumping
       * between parts of a page (as indicated by a hash) should not be considered page
       * navigation.
       * @returns {string}
       */
      function locationHrefWithoutHash() {
          const urlObj = new URL(window.location.href);
          urlObj.hash = "";
          return urlObj.href;
      }

      /**
       * Log a debugging message to `console.debug` in a standardized format.
       * @param {string} message - The debugging message.
       */
      function debugLog(message) {
          console.debug(`webScience.pageManager.content: ${message}`);
      }

      /**
       * Additional information about an event, containing only a time stamp.
       * @typedef {Object} TimeStampDetails
       * @property {number} timeStamp - The time when the underlying event occurred.
       */

      /**
       * A callback function with a time stamp parameter.
       * @callback callbackWithTimeStamp
       * @param {TimeStampDetails} details - Additional information about the event.
       */

      /**
       * Additional information about a page visit start event.
       * @typedef {Object} PageVisitStartDetails
       * @property {number} timeStamp - The time when the underlying event occurred.
       * @property {boolean} isHistoryChange - Whether the page visit was caused by a change via the History API.
       */

      /**
       * A callback function for the page visit start event.
       * @callback pageVisitStartCallback
       * @param {PageVisitStartDetails} details - Additional information about the event.
       */

      /**
       * @callback PageManagerAddListener
       * @template {ListenerFunction}
       * @param {ListenerFunction} listener
       */

      /**
       * @callback PageManagerRemoveListener
       * @template {ListenerFunction}
       * @param {ListenerFunction} listener
       */

      /**
       * @callback PageManagerHasListener
       * @template {ListenerFunction}
       * @param {ListenerFunction} listener
       */

      /**
       * @callback PageManagerHasAnyListeners
       * @returns {boolean}
       */

      /**
       * @typedef {Object} PageManagerEvent
       * @template {ListenerFunction}
       * @property {PageManagerAddListener<ListenerFunction>} addListener - Add a listener for the event.
       * @property {PageManagerRemoveListener<ListenerFunction>} removeListener - Remove a listener for the event.
       * @property {PageManagerHasListener<ListenerFunction>} hasListener - Whether a listener has been added for the event.
       * @property {PageManagerHasAnyListeners} hasAnyListeners - Whether any listeners have been added for the event.
       */

      /**
       * An event that is fired when a page visit starts.
       * @type {PageManagerEvent<pageVisitStartCallback>}
       */
      pageManager.onPageVisitStart = createEvent();

      /**
       * An event that is fired when a page visit stops.
       * @type {PageManagerEvent<callbackWithTimeStamp>}
       */
      pageManager.onPageVisitStop = createEvent();

      /**
       * An event that is fired when the page attention state changes.
       * @type {PageManagerEvent<callbackWithTimeStamp>}
       */
      pageManager.onPageAttentionUpdate = createEvent();

      /**
       * An event that is fired when the page attention state changes.
       * @type {PageManagerEvent<callbackWithTimeStamp>}
       */
      pageManager.onPageAudioUpdate = createEvent();

      /**
       * Send a message to the background page, with a catch because errors can
       * occur in `browser.runtime.sendMessage` when the page is unlooading.
       * @param {object} message - The message to send, which should be an object with
       * a type string.
       */
      pageManager.sendMessage = function(message) {
          try {
              browser.runtime.sendMessage(message).catch((reason) => {
                  debugLog(`Error when sending message from content script to background page: ${JSON.stringify(message)}`);
              });
          }
          catch(error) {
              debugLog(`Error when sending message from content script to background page: ${JSON.stringify(message)}`);
          }
      };

      /**
       * The function for firing the page visit start event, which runs whenever a new page
       * loads. A page load might be because of ordinary web navigation (i.e., loading a new
       * HTML document with a base HTTP(S) request) or because the URL changed via the History
       * API.
       * @private
       * @param {number} timeStamp - The time when the underlying event fired.
       * @param {boolean} [isHistoryChange=false] - Whether this page load was caused by the
       * History API.
       * @param {number} [webNavigationTimeStamp=0] - If this is a History API change, the
       * timestamp for the webNavigation.onHistoryStateUpdated event.
       */
      function pageVisitStart(timeStamp, isHistoryChange = false, webNavigationTimeStamp = 0) {
          // Assign a new page ID
          pageManager.pageId = generateId();
          // Store a copy of the URL, because we use it to check for History API page loads
          pageManager.url = locationHrefWithoutHash();
          // Store a copy of the referrer for convenience
          pageManager.referrer = document.referrer.repeat(1);
          pageManager.pageVisitStartTime = timeStamp;
          // If this is a History API page load, persist the states for attention and audio
          pageManager.pageHasAttention = isHistoryChange ? pageManager.pageHasAttention : false;
          pageManager.pageHasAudio = isHistoryChange ? pageManager.pageHasAudio : false;
          // Store whether the page visit event has completed firing
          pageManager.pageVisitStarted = false;
          // Store whether the page visit is a History API change
          pageManager.isHistoryChange = isHistoryChange;
          // Store the webNavigation timestamp
          pageManager.webNavigationTimeStamp = webNavigationTimeStamp;

          // Send the page visit start event to the background page
          pageManager.sendMessage({
              type: "webScience.pageManager.pageVisitStart",
              pageId: pageManager.pageId,
              url: pageManager.url,
              referrer: pageManager.referrer,
              timeStamp: pageManager.pageVisitStartTime,
              privateWindow: browser.extension.inIncognitoContext,
              isHistoryChange
          });

          // Notify the page visit start event listeners in the content script environment
          pageManager.onPageVisitStart.notifyListeners([{
              timeStamp,
              isHistoryChange
          }]);

          pageManager.pageVisitStarted = true;
      }

      /**
       * The function for firing the page visit stop event, which runs whenever a page closes.
       * That could be because of browser exit, tab closing, tab navigation to a new page, or
       * a new page loading via the History API.
       * @private
       * @param {number} timeStamp - The time when the underlying event fired.
       */
      function pageVisitStop(timeStamp) {
          // Send the page visit stop event to the background page
          pageManager.sendMessage({
              type: "webScience.pageManager.pageVisitStop",
              pageId: pageManager.pageId,
              url: pageManager.url,
              referrer: pageManager.referrer,
              timeStamp,
              pageVisitStartTime: pageManager.pageVisitStartTime,
              privateWindow: browser.extension.inIncognitoContext
          });

          // Notify the page visit stop event listeners in the content script environment
          pageManager.onPageVisitStop.notifyListeners([{
              timeStamp
          }]);
      }

      /**
       * The function for firing the page attention update event, which runs whenever the
       * page attention state might have changed. The function contains logic to verify
       * that the attention state actually changed before firing the event.
       * @param {number} timeStamp - The time when the underlying event fired.
       * @param {boolean} pageHasAttention - The latest attention state, according to the
       * pageManager module running in the background page.
       */
      function pageAttentionUpdate(timeStamp, pageHasAttention) {
          if(pageManager.pageHasAttention === pageHasAttention)
              return;

          pageManager.pageHasAttention = pageHasAttention;

          // Notify the page attention update event listeners in the content script environment
          pageManager.onPageAttentionUpdate.notifyListeners([{
              timeStamp
          }]);
      }

      /**
       * The function for firing the page audio update event, which runs whenever the
       * page audio state might have changed. The function contains logic to verify
       * that the audio state actually changed before firing the event.
       * @param {number} timeStamp - The time when the underlying event fired.
       * @param {boolean} pageHasAudio - The latest audio state, according to the
       * pageManager module running in the background page.
       */
      function pageAudioUpdate(timeStamp, pageHasAudio) {
          if(pageManager.pageHasAudio === pageHasAudio)
              return;

          pageManager.pageHasAudio = pageHasAudio;

          // Notify the page audio update event listeners in the content script environment
          pageManager.onPageAudioUpdate.notifyListeners([{
              timeStamp
          }]);
      }

      // Handle events sent from the background page
      browser.runtime.onMessage.addListener((message) => {
          if(message.type === "webScience.pageManager.pageAttentionUpdate") {
              pageAttentionUpdate(message.timeStamp, message.pageHasAttention);
              return;
          }

          // If the background page detected a URL change, this could be a page
          // load via the History API. If the `window.location` URL does not
          // match the pageManager URL, and if the new URL from the background
          // page does match the `window.location` URL, then we have a page
          // load via the History API. We need to check the background page
          // URL against the `window.location` URL to make sure we're
          // using the right timestamp, which is important for syncing
          // pageManager.onPageVisitStart history API events with
          // pageTransition.onPageTransitionData history API events.
          if(message.type === "webScience.pageManager.urlChanged") {
              const windowLocationHrefWithoutHash = locationHrefWithoutHash();
              const messageUrlObj = new URL(message.url);
              messageUrlObj.hash = "";
              const messageUrl = messageUrlObj.href;
              if((windowLocationHrefWithoutHash !== pageManager.url) &&
                 (windowLocationHrefWithoutHash === messageUrl)) {
                  pageVisitStop(message.timeStamp);
                  pageVisitStart(message.timeStamp, true, message.webNavigationTimeStamp);
                  return;
              }
          }

          if(message.type === "webScience.pageManager.pageAudioUpdate") {
              pageAudioUpdate(message.timeStamp, message.pageHasAudio);
              return;
          }
      });

      // If there are any other content scripts that are waiting for the API to load,
      // execute the callbacks for those content scripts
      if("pageManagerHasLoaded" in window) {
          if(Array.isArray(window.pageManagerHasLoaded))
              for(const callback of window.pageManagerHasLoaded)
                  if(typeof callback === "function") {
                      try {
                          callback();
                      }
                      catch(error) {
                          debugLog(`Error in callback for pageManager load: ${error}`);
                      }
                  }
          delete window.pageManagerHasLoaded;
      }

      // Send the page visit start event for the first time
      pageVisitStart(fromMonotonicClock(window.performance.timeOrigin, false));

      // Send the page visit stop event on the window unload event,
      // using the timestamp for the unload event on the global
      // monotonic clock 
      window.addEventListener("unload", (event) => {
          pageVisitStop(fromMonotonicClock(event.timeStamp, true));
      });
      
  })();

})();
