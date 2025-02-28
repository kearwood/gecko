/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Tests if copying a request's url works.
 */

add_task(async function() {
  let { tab, monitor } = await initNetMonitor(CUSTOM_GET_URL);
  info("Starting test... ");

  let { document, store, windowRequire } = monitor.panelWin;
  let {
    getSortedRequests,
  } = windowRequire("devtools/client/netmonitor/src/selectors/index");

  let wait = waitForNetworkEvents(monitor, 1);
  await ContentTask.spawn(tab.linkedBrowser, {}, async function() {
    content.wrappedJSObject.performRequests(1);
  });
  await wait;

  EventUtils.sendMouseEvent({ type: "mousedown" },
    document.querySelectorAll(".request-list-item")[0]);
  EventUtils.sendMouseEvent({ type: "contextmenu" },
    document.querySelectorAll(".request-list-item")[0]);

  let requestItem = getSortedRequests(store.getState()).get(0);

  await waitForClipboardPromise(function setup() {
    monitor.panelWin.parent.document
      .querySelector("#request-list-context-copy-url").click();
  }, requestItem.url);

  await teardown(monitor);
});
