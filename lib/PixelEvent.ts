export default class PixelEvent {
    timeStamp: number;
    requestId: string;
    url: URL;
    attributes: {};
    details: any;
    constructor(details: browser.WebRequest.OnCompletedDetailsType) {
        // return attributes
        const parsePixel = (url: URL) => {
            const attrs: Record<string, any> = {};
            url.searchParams.forEach((v, k) => {
                if (k in attrs) {
                    console.log("Duplicate keys in", url);
                }
                attrs[k] = v;
            })
            return attrs;
        }

        // key should be something unique.  
        // details contains a `requestId` that is supposed to be unique per browsing session.
        // see https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/webRequest/onCompleted
        //
        // requests need to be inserted just based on time.
        // they need to be facetable by their origin
        this.timeStamp = details.timeStamp;
        this.requestId = details.requestId;

        this.url = new URL(details.url);
        this.attributes = parsePixel(this.url);
        this.details = details;

        return this;
    }

    key() { return `${this.timeStamp}:${this.requestId}`; }
    dump() {
        const plain = {
            tabId: this.details.tabId,
            url: this.url,
            status: this.details.status,
            frameId: this.details.frameId,
            timeStamp: this.timeStamp,
            requestId: this.requestId,
            version: '0.1',
            attributes: this.attributes
        };
        return plain;
    }
    toJSONString() { return JSON.stringify(this.dump()); }
}
