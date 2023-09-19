import _ from "lodash";
import { Matches } from "webdriverio";
import PageLoader from "../../utils/page-loader";

interface Browser {
    publicAPI: WebdriverIO.Browser;
    config: {
        desiredCapabilities: {
            browserName: string;
        };
        automationProtocol: "webdriver" | "devtools";
        pageLoadTimeout: number;
        openAndWaitOpts: {
            timeout?: number;
            waitNetworkIdle: boolean;
            waitNetworkIdleTimeout: number;
            failOnNetworkError: boolean;
            ignoreNetworkErrorsPatterns: Array<RegExp | string>;
        };
    };
}

interface WaitOpts {
    selector?: string | string[];
    predicate?: () => boolean;
    waitNetworkIdle?: boolean;
    waitNetworkIdleTimeout?: number;
    failOnNetworkError?: boolean;
    shouldThrowError?: (match: Matches) => boolean;
    ignoreNetworkErrorsPatterns?: Array<RegExp | string>;
    timeout?: number;
}

const emptyPageUrl = "about:blank";

const is: Record<string, (match: Matches) => boolean> = {
    image: match => match.headers?.Accept?.includes("image"),
    stylesheet: match => match.headers?.Accept?.includes("text/css"),
    font: match => _.isString(match.url) && [".ttf", ".woff", ".woff2"].some(ext => match.url.endsWith(ext)),
    favicon: match => _.isString(match.url) && match.url.endsWith("/favicon.ico"),
};

export = (browser: Browser): void => {
    const { publicAPI: session, config } = browser;
    const { openAndWaitOpts } = config;
    const isChrome = config.desiredCapabilities.browserName === "chrome";
    const isCDP = config.automationProtocol === "devtools";

    function openAndWait(
        uri: string,
        {
            selector = [],
            predicate,
            waitNetworkIdle = openAndWaitOpts?.waitNetworkIdle,
            waitNetworkIdleTimeout = openAndWaitOpts?.waitNetworkIdleTimeout,
            failOnNetworkError = openAndWaitOpts?.failOnNetworkError,
            shouldThrowError = shouldThrowErrorDefault,
            ignoreNetworkErrorsPatterns = openAndWaitOpts?.ignoreNetworkErrorsPatterns,
            timeout = openAndWaitOpts?.timeout || config?.pageLoadTimeout,
        }: WaitOpts = {},
    ): Promise<string | void> {
        waitNetworkIdle &&= isChrome || isCDP;

        if (!uri || uri === emptyPageUrl) {
            return new Promise(resolve => {
                session.url(uri).then(() => resolve());
            });
        }

        const selectors = typeof selector === "string" ? [selector] : selector;

        const pageLoader = new PageLoader(session, {
            selectors,
            predicate,
            timeout,
            waitNetworkIdle,
            waitNetworkIdleTimeout,
        });

        let selectorsResolved = !selectors.length;
        let predicateResolved = !predicate;
        let networkResolved = !waitNetworkIdle;

        return new Promise<void>((resolve, reject) => {
            const handleError = (err: Error): void => {
                reject(new Error(`url: ${err.message}`));
            };

            const checkLoaded = (): void => {
                if (selectorsResolved && predicateResolved && networkResolved) {
                    resolve();
                }
            };

            const goToPage = async (): Promise<void> => {
                await session.url(uri);
            };

            pageLoader.on("pageLoadError", handleError);
            pageLoader.on("selectorsError", handleError);
            pageLoader.on("predicateError", handleError);
            pageLoader.on("networkError", match => {
                if (!failOnNetworkError) {
                    return;
                }

                const shouldIgnore = isMatchPatterns(ignoreNetworkErrorsPatterns, match.url);

                if (!shouldIgnore && shouldThrowError(match)) {
                    reject(new Error(`url: couldn't get content from ${match.url}: ${match.statusCode}`));
                }
            });
            pageLoader.on("selectorsExist", () => {
                selectorsResolved = true;
                checkLoaded();
            });

            pageLoader.on("predicateResolved", () => {
                predicateResolved = true;
                checkLoaded();
            });

            pageLoader.on("networkResolved", () => {
                networkResolved = true;
                checkLoaded();
            });

            pageLoader.load(goToPage).then(checkLoaded);
        }).finally(() => pageLoader.unsubscribe());
    }

    session.addCommand("openAndWait", openAndWait);
};

function isMatchPatterns(patterns: Array<RegExp | string> = [], str: string): boolean {
    return patterns.some(pattern => (_.isString(pattern) ? str.includes(pattern) : pattern.exec(str)));
}

function shouldThrowErrorDefault(match: Matches): boolean {
    if (is.favicon(match)) {
        return false;
    }

    return is.image(match) || is.stylesheet(match) || is.font(match);
}
