/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/* exported initialize, destroy, Promise */

"use strict";

const BrowserLoaderModule = {};
ChromeUtils.import("resource://devtools/client/shared/browser-loader.js", BrowserLoaderModule);
const { require } = BrowserLoaderModule.BrowserLoader({
  baseURI: "resource://devtools/client/memory/",
  window
});
const { createFactory, createElement } = require("devtools/client/shared/vendor/react");
const ReactDOM = require("devtools/client/shared/vendor/react-dom");
const { Provider } = require("devtools/client/shared/vendor/react-redux");
const App = createFactory(require("devtools/client/memory/app"));
const Store = require("devtools/client/memory/store");
const { assert } = require("devtools/shared/DevToolsUtils");
const Promise = require("Promise");

/**
 * The current target, toolbox, MemoryFront, and HeapAnalysesClient,
 * set by this tool's host.
 */
var gToolbox, gFront, gHeapAnalysesClient;

/**
 * Variables set by `initialize()`
 */
var gStore, gRoot, gApp, gProvider, unsubscribe, isHighlighted;

var initialize = async function() {
  gRoot = document.querySelector("#app");
  gStore = Store();
  gApp = createElement(App,
    { toolbox: gToolbox, front: gFront, heapWorker: gHeapAnalysesClient });
  gProvider = createElement(Provider, { store: gStore }, gApp);
  ReactDOM.render(gProvider, gRoot);
  unsubscribe = gStore.subscribe(onStateChange);
};

var destroy = async function() {
  const ok = ReactDOM.unmountComponentAtNode(gRoot);
  assert(ok, "Should successfully unmount the memory tool's top level React component");

  unsubscribe();

  gStore = gRoot = gApp = gProvider = unsubscribe = isHighlighted = null;
};

/**
 * Fired on any state change, currently only handles toggling
 * the highlighting of the tool when recording allocations.
 */
function onStateChange() {
  let isRecording = gStore.getState().allocations.recording;
  if (isRecording === isHighlighted) {
    return;
  }

  if (isRecording) {
    gToolbox.highlightTool("memory");
  } else {
    gToolbox.unhighlightTool("memory");
  }

  isHighlighted = isRecording;
}
