/* -*- indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* vim: set ft=javascript ts=2 et sw=2 tw=80: */
/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

/* import-globals-from head.js */

/*
 * Hide Browser Console JS input field if devtools.chrome.enabled is false.
 *
 * when devtools.chrome.enabled then:
 *   - browser console jsterm should be enabled
 *   - browser console object inspector properties should be set.
 *   - webconsole jsterm should be enabled
 *   - webconsole object inspector properties should be set.
 *
 * when devtools.chrome.enabled === false then
 *   - browser console jsterm should be disabled
 *   - browser console object inspector properties should be set (we used to not
 *     set them but there is no reason not to do so as the input is disabled).
 *   - webconsole jsterm should be enabled
 *   - webconsole object inspector properties should be set.
 */

"use strict";

add_task(async function() {
  let browserConsole, webConsole, objInspector;

  // We don't use `pushPref()` because we need to revert the same pref later
  // in the test.
  Services.prefs.setBoolPref("devtools.chrome.enabled", true);

  browserConsole = await HUDService.toggleBrowserConsole();
  objInspector = await getObjectInspector(browserConsole);
  testJSTermIsVisible(browserConsole);
  await testObjectInspectorPropertiesAreSet(objInspector);

  let browserTab = await addTab("data:text/html;charset=utf8,hello world");
  webConsole = await openConsole(browserTab);
  objInspector = await getObjectInspector(webConsole);
  testJSTermIsVisible(webConsole);
  await testObjectInspectorPropertiesAreSet(objInspector);
  await closeConsole(browserTab);

  await HUDService.toggleBrowserConsole();
  Services.prefs.setBoolPref("devtools.chrome.enabled", false);

  browserConsole = await HUDService.toggleBrowserConsole();
  objInspector = await getObjectInspector(browserConsole);
  testJSTermIsNotVisible(browserConsole);

  webConsole = await openConsole(browserTab);
  objInspector = await getObjectInspector(webConsole);
  testJSTermIsVisible(webConsole);
  await testObjectInspectorPropertiesAreSet(objInspector);
  await closeConsole(browserTab);
});

/**
 * Returns either the Variables View or Object Inspector depending on which is
 * currently in use.
 */
async function getObjectInspector(hud) {
  let { ui, jsterm } = hud;

  // Filter out other messages to ensure ours stays visible.
  ui.filterBox.value = "browser_console_hide_jsterm_test";

  jsterm.clearOutput();
  jsterm.execute("new Object({ browser_console_hide_jsterm_test: true })");

  let message = await waitFor(
    () => findMessage(hud, "Object { browser_console_hide_jsterm_test: true }")
  );

  let objInspector = message.querySelector(".tree");
  return objInspector;
}

function testJSTermIsVisible(hud) {
  let inputContainer = hud.ui.window.document
                                    .querySelector(".jsterm-input-container");
  isnot(inputContainer.style.display, "none", "input is visible");
}

async function testObjectInspectorPropertiesAreSet(objInspector) {
  let onMutation = waitForNodeMutation(objInspector, {
    childList: true
  });

  let arrow = objInspector.querySelector(".arrow");
  arrow.click();
  await onMutation;

  ok(arrow.classList.contains("expanded"),
    "The arrow of the root node of the tree is expanded after clicking on it");

  let nameNode = objInspector.querySelector(".node:not(.lessen) .object-label");
  let container = nameNode.parentNode;
  let name = nameNode.textContent;
  let value = container.querySelector(".objectBox").textContent;

  is(name, "browser_console_hide_jsterm_test", "name is set correctly");
  is(value, "true", "value is set correctly");
}

function testJSTermIsNotVisible(hud) {
  let inputContainer = hud.ui.window.document
                                    .querySelector(".jsterm-input-container");
  is(inputContainer.style.display, "none", "input is not visible");
}
