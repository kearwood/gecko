/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Tests if very large response contents are just displayed as plain text.
 */

const HTML_LONG_URL = CONTENT_TYPE_SJS + "?fmt=html-long";

add_task(async function() {
  let { tab, monitor } = await initNetMonitor(CUSTOM_GET_URL);
  info("Starting test... ");

  // This test could potentially be slow because over 100 KB of stuff
  // is going to be requested and displayed in the source editor.
  requestLongerTimeout(2);

  let { document, store, windowRequire } = monitor.panelWin;
  let Actions = windowRequire("devtools/client/netmonitor/src/actions/index");
  let {
    getDisplayedRequests,
    getSortedRequests,
  } = windowRequire("devtools/client/netmonitor/src/selectors/index");

  store.dispatch(Actions.batchEnable(false));

  let wait = waitForNetworkEvents(monitor, 1);
  await ContentTask.spawn(tab.linkedBrowser, HTML_LONG_URL, async function(url) {
    content.wrappedJSObject.performRequests(1, url);
  });
  await wait;

  let requestItem = document.querySelector(".request-list-item");
  requestItem.scrollIntoView();
  let requestsListStatus = requestItem.querySelector(".requests-list-status");
  EventUtils.sendMouseEvent({ type: "mouseover" }, requestsListStatus);
  await waitUntil(() => requestsListStatus.title);

  verifyRequestItemTarget(
    document,
    getDisplayedRequests(store.getState()),
    getSortedRequests(store.getState()).get(0),
    "GET",
    CONTENT_TYPE_SJS + "?fmt=html-long",
    {
      status: 200,
      statusText: "OK"
    });

  wait = waitForDOM(document, "#response-panel .CodeMirror-code");
  EventUtils.sendMouseEvent({ type: "click" },
    document.querySelector(".network-details-panel-toggle"));
  EventUtils.sendMouseEvent({ type: "click" },
    document.querySelector("#response-tab"));
  await wait;

  let text = document.querySelector(".CodeMirror-line").textContent;

  ok(text.match(/^<p>/), "The text shown in the source editor is incorrect.");

  await teardown(monitor);

  // This test uses a lot of memory, so force a GC to help fragmentation.
  info("Forcing GC after netmonitor test.");
  Cu.forceGC();
});
