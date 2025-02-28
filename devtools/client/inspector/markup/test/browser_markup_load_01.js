/* vim: set ts=2 et sw=2 tw=80: */
/* Any copyright is dedicated to the Public Domain.
 http://creativecommons.org/publicdomain/zero/1.0/ */
/* eslint-disable mozilla/no-arbitrary-setTimeout */

"use strict";

// Tests that selecting an element with the 'Inspect Element' context
// menu during a page reload doesn't cause the markup view to become empty.
// See https://bugzilla.mozilla.org/show_bug.cgi?id=1036324

const server = createTestHTTPServer();

// Register a slow image handler so we can simulate a long time between
// a reload and the load event firing.
server.registerContentType("gif", "image/gif");
server.registerPathHandler("/slow.gif", function(metadata, response) {
  info("Image has been requested");
  response.processAsync();
  setTimeout(() => {
    info("Image is responding");
    response.finish();
  }, 500);
});

// Test page load events.
const TEST_URL = "data:text/html," +
  "<!DOCTYPE html>" +
  "<head><meta charset='utf-8' /></head>" +
  "<body>" +
  "<p>Slow script</p>" +
  "<img src='http://localhost:" + server.identity.primaryPort + "/slow.gif' />" +
  "</body>" +
  "</html>";

add_task(function* () {
  let {inspector, testActor, tab} = yield openInspectorForURL(TEST_URL);

  let domContentLoaded = waitForLinkedBrowserEvent(tab, "DOMContentLoaded");
  let pageLoaded = waitForLinkedBrowserEvent(tab, "load");

  ok(inspector.markup, "There is a markup view");

  // Select an element while the tab is in the middle of a slow reload.
  testActor.eval("location.reload()");

  info("Wait for DOMContentLoaded");
  yield domContentLoaded;

  info("Inspect element via context menu");
  let markupLoaded = inspector.once("markuploaded");
  yield chooseWithInspectElementContextMenu("img", tab);

  info("Wait for load");
  yield pageLoaded;

  info("Wait for markup-loaded after element inspection");
  yield markupLoaded;
  info("Wait for multiple children updates after element inspection");
  yield waitForMultipleChildrenUpdates(inspector);

  ok(inspector.markup, "There is a markup view");
  is(inspector.markup._elt.children.length, 1, "The markup view is rendering");
});

function* chooseWithInspectElementContextMenu(selector, tab) {
  yield BrowserTestUtils.synthesizeMouseAtCenter(selector, {
    type: "contextmenu",
    button: 2
  }, tab.linkedBrowser);

  yield EventUtils.sendString("Q");
}

function waitForLinkedBrowserEvent(tab, event) {
  return BrowserTestUtils.waitForContentEvent(tab.linkedBrowser, event, true);
}
