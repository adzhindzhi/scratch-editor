const test = require('tap').test;
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const {usesUrlDelivery} = require('../src/sandbox/uses-url-delivery');

const SOURCE = fs.readFileSync(path.resolve(__dirname, '../src/sandbox/uses-url-delivery.js'), 'utf8');

/**
 * Load the module into a fresh context with only the given globals, the way a
 * browser runs a bundle whose bundler left `process.env.NODE_ENV` in place.
 * @param {object} globals Globals for the context, such as `window`.
 * @returns {function(): boolean} That context's `usesUrlDelivery`.
 */
const loadInBrowserLikeContext = globals => {
    const module = {exports: {}};
    vm.runInNewContext(SOURCE, {...globals, module});
    return module.exports.usesUrlDelivery;
};

// Assigning undefined to an env var stores the string 'undefined', so unset it instead.
const setNodeEnv = value => {
    if (typeof value === 'undefined') {
        delete process.env.NODE_ENV;
    } else {
        process.env.NODE_ENV = value;
    }
};

const withHost = (t, {protocol, nodeEnv}) => {
    const originalWindow = global.window;
    const originalNodeEnv = process.env.NODE_ENV;
    global.window = {location: {protocol}};
    setNodeEnv(nodeEnv);
    t.teardown(() => {
        global.window = originalWindow;
        setNodeEnv(originalNodeEnv);
    });
};

test('production build on http(s) delivers by URL', t => {
    withHost(t, {protocol: 'http:', nodeEnv: 'production'});
    t.equal(usesUrlDelivery(), true);
    global.window.location.protocol = 'https:';
    t.equal(usesUrlDelivery(), true);
    t.end();
});

test('production build on file: delivers inline', t => {
    withHost(t, {protocol: 'file:', nodeEnv: 'production'});
    t.equal(usesUrlDelivery(), false);
    t.end();
});

test('development build on http(s) delivers inline', t => {
    withHost(t, {protocol: 'http:', nodeEnv: 'development'});
    t.equal(usesUrlDelivery(), false);
    global.window.location.protocol = 'https:';
    t.equal(usesUrlDelivery(), false);
    t.end();
});

test('build with NODE_ENV unset on http(s) delivers by URL', t => {
    withHost(t, {protocol: 'https:'});
    t.equal(usesUrlDelivery(), true);
    t.end();
});

test('build with any other NODE_ENV on http(s) delivers by URL', t => {
    withHost(t, {protocol: 'https:', nodeEnv: 'test'});
    t.equal(usesUrlDelivery(), true);
    t.end();
});

test('browser bundle without a process global delivers by URL on http(s)', t => {
    const usesUrlDeliveryInBrowser = loadInBrowserLikeContext({window: {location: {protocol: 'https:'}}});
    t.equal(usesUrlDeliveryInBrowser(), true);
    t.end();
});

test('browser bundle with a process global but no env delivers by URL on http(s)', t => {
    const usesUrlDeliveryInBrowser = loadInBrowserLikeContext({
        process: {},
        window: {location: {protocol: 'https:'}}
    });
    t.equal(usesUrlDeliveryInBrowser(), true);
    t.end();
});
