/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Tests if requests intercepted by service workers have the correct status code
 */

// Service workers only work on https
const URL = EXAMPLE_URL.replace("http:", "https:");

const TEST_URL = URL + "service-workers/status-codes.html";

add_task(async function() {
  let { tab, monitor } = await initNetMonitor(TEST_URL, true);
  info("Starting test... ");

  let { document, store, windowRequire, connector } = monitor.panelWin;
  let Actions = windowRequire("devtools/client/netmonitor/src/actions/index");
  let {
    getDisplayedRequests,
    getSortedRequests,
  } = windowRequire("devtools/client/netmonitor/src/selectors/index");

  store.dispatch(Actions.batchEnable(false));

  const REQUEST_DATA = [
    {
      method: "GET",
      uri: URL + "service-workers/test/200",
      details: {
        status: 200,
        statusText: "OK (service worker)",
        displayedStatus: "service worker",
        type: "plain",
        fullMimeType: "text/plain; charset=UTF-8"
      },
      stackFunctions: ["doXHR", "performRequests"]
    },
  ];

  info("Registering the service worker...");
  await ContentTask.spawn(tab.linkedBrowser, {}, async function() {
    await content.wrappedJSObject.registerServiceWorker();
  });

  info("Performing requests...");
  let wait = waitForNetworkEvents(monitor, REQUEST_DATA.length);
  await ContentTask.spawn(tab.linkedBrowser, {}, async function() {
    content.wrappedJSObject.performRequests();
  });
  await wait;

  // Fetch stack-trace data from the backend and wait till
  // all packets are received.
  let requests = getSortedRequests(store.getState());
  await Promise.all(requests.map(requestItem =>
    connector.requestData(requestItem.id, "stackTrace")));

  let requestItems = document.querySelectorAll(".request-list-item");
  for (let requestItem of requestItems) {
    requestItem.scrollIntoView();
    let requestsListStatus = requestItem.querySelector(".requests-list-status");
    EventUtils.sendMouseEvent({ type: "mouseover" }, requestsListStatus);
    await waitUntil(() => requestsListStatus.title);
  }

  let index = 0;
  for (let request of REQUEST_DATA) {
    let item = getSortedRequests(store.getState()).get(index);

    info(`Verifying request #${index}`);
    await verifyRequestItemTarget(
      document,
      getDisplayedRequests(store.getState()),
      item,
      request.method,
      request.uri,
      request.details
    );

    let { stacktrace } = item;
    let stackLen = stacktrace ? stacktrace.length : 0;

    ok(stacktrace, `Request #${index} has a stacktrace`);
    ok(stackLen >= request.stackFunctions.length,
      `Request #${index} has a stacktrace with enough (${stackLen}) items`);

    request.stackFunctions.forEach((functionName, j) => {
      is(stacktrace[j].functionName, functionName,
      `Request #${index} has the correct function at position #${j} on the stack`);
    });

    index++;
  }

  info("Unregistering the service worker...");
  await ContentTask.spawn(tab.linkedBrowser, {}, async function() {
    await content.wrappedJSObject.unregisterServiceWorker();
  });

  await teardown(monitor);
});
