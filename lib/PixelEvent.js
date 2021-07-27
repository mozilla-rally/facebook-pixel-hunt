export default class PixelEvent {
    constructor(details) {
        // return attributes
        const parsePixel = (url) => {
            const attrs = {};
            url.searchParams.forEach((v,k) => { 
                if (attrs[k] != undefined) { console.log("Duplicate keys in", url); }
                attrs[k] = v;
            })
            return attrs;
        }

        // key should be something unique.  
        // details contains a `requestId` that is supposed to be unique per browsing session.
        // see https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/webRequest/onCompleted
        //
        // 
        this.requestId = details.requestId // ???
        this.url = new URL(details.url);
        if (!this.url) { debugger; }
        this.attributes = parsePixel(this.url);
        return this;
    }
}
