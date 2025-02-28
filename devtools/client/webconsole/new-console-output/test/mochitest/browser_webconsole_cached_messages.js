/* -*- indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* vim: set ft=javascript ts=2 et sw=2 tw=80: */
/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

/* import-globals-from head.js */

// Test to see if the cached messages are displayed when the console UI is
// opened.

"use strict";

const TEST_URI = "http://example.com/browser/devtools/client/webconsole/" +
                 "new-console-output/test/mochitest/" +
                 "test-webconsole-error-observer.html";

add_task(async function() {
  // On e10s, the exception is triggered in child process
  // and is ignored by test harness
  if (!Services.appinfo.browserTabsRemoteAutostart) {
    expectUncaughtException();
  }
  // Enable CSS filter for the test.
  await pushPref("devtools.webconsole.filter.css", true);

  await addTab(TEST_URI);

  info("Open the console");
  let hud = await openConsole();
  testMessagesVisibility(hud);

  info("Close the toolbox");
  await closeToolbox();

  info("Open the console again");
  hud = await openConsole();
  testMessagesVisibility(hud);
});

function testMessagesVisibility(hud) {
  let message = findMessage(hud, "log Bazzle", ".message.log");
  ok(message, "console.log message is visible");

  message = findMessage(hud, "error Bazzle", ".message.error");
  ok(message, "console.error message is visible");

  message = findMessage(hud, "bazBug611032", ".message.error");
  ok(message, "exception message is visible");

  message = findMessage(hud, "cssColorBug611032", ".message.warn.css");
  ok(message, "css warning message is visible");
}
