/* -*- indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* vim: set ft=javascript ts=2 et sw=2 tw=80: */
/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

// Test that when the toolbox is displayed in a bottom host, that host can be
// minimized to just the tabbar height, and maximized again.
// Also test that while minimized, switching to a tool, clicking on the
// settings, or clicking on the selected tool's tab maximizes the toolbox again.
// Finally test that the minimize button doesn't exist in other host types.

const URL = "data:text/html;charset=utf8,test page";
const {Toolbox} = require("devtools/client/framework/toolbox");

add_task(async function () {
  info("Create a test tab and open the toolbox");
  let tab = await addTab(URL);
  let target = TargetFactory.forTab(tab);
  let toolbox = await gDevTools.showToolbox(target, "webconsole");

  let button = toolbox.doc.querySelector("#toolbox-dock-bottom-minimize");
  ok(button, "The minimize button exists in the default bottom host");

  info("Try to minimize the toolbox");
  await minimize(toolbox);
  ok(parseInt(toolbox._host.frame.style.marginBottom, 10) < 0,
     "The toolbox host has been hidden away with a negative-margin");

  info("Try to maximize again the toolbox");
  await maximize(toolbox);
  ok(parseInt(toolbox._host.frame.style.marginBottom, 10) == 0,
     "The toolbox host is shown again");

  info("Try to minimize again using the keyboard shortcut");
  await minimizeWithShortcut(toolbox);
  ok(parseInt(toolbox._host.frame.style.marginBottom, 10) < 0,
     "The toolbox host has been hidden away with a negative-margin");

  info("Try to maximize again using the keyboard shortcut");
  await maximizeWithShortcut(toolbox);
  ok(parseInt(toolbox._host.frame.style.marginBottom, 10) == 0,
     "The toolbox host is shown again");

  info("Minimize again and switch to another tool");
  await minimize(toolbox);
  let onMaximized = toolbox._host.once("maximized");
  await toolbox.selectTool("inspector");
  await onMaximized;

  info("Minimize again and click on the tab of the current tool");
  await minimize(toolbox);
  onMaximized = toolbox._host.once("maximized");
  let tabButton = toolbox.doc.querySelector("#toolbox-tab-inspector");
  EventUtils.synthesizeMouseAtCenter(tabButton, {}, toolbox.win);
  await onMaximized;

  info("Minimize again and click on the settings tab");
  await minimize(toolbox);
  onMaximized = toolbox._host.once("maximized");
  let settingsButton = toolbox.doc.querySelector("#toolbox-tab-options");
  EventUtils.synthesizeMouseAtCenter(settingsButton, {}, toolbox.win);
  await onMaximized;

  info("Switch to a different host");
  await toolbox.switchHost(Toolbox.HostType.SIDE);
  button = toolbox.doc.querySelector("#toolbox-dock-bottom-minimize");
  ok(!button, "The minimize button doesn't exist in the side host");

  Services.prefs.clearUserPref("devtools.toolbox.host");
  await toolbox.destroy();
  gBrowser.removeCurrentTab();
});

async function minimize(toolbox) {
  let button = toolbox.doc.querySelector("#toolbox-dock-bottom-minimize");
  let onMinimized = toolbox._host.once("minimized");
  EventUtils.synthesizeMouseAtCenter(button, {}, toolbox.win);
  await onMinimized;
}

async function minimizeWithShortcut(toolbox) {
  let key = toolbox.doc.getElementById("toolbox-minimize-key")
                       .getAttribute("key");
  let onMinimized = toolbox._host.once("minimized");
  EventUtils.synthesizeKey(key, {accelKey: true, shiftKey: true},
                           toolbox.win);
  await onMinimized;
}

async function maximize(toolbox) {
  let button = toolbox.doc.querySelector("#toolbox-dock-bottom-minimize");
  let onMaximized = toolbox._host.once("maximized");
  EventUtils.synthesizeMouseAtCenter(button, {}, toolbox.win);
  await onMaximized;
}

async function maximizeWithShortcut(toolbox) {
  let key = toolbox.doc.getElementById("toolbox-minimize-key")
                       .getAttribute("key");
  let onMaximized = toolbox._host.once("maximized");
  EventUtils.synthesizeKey(key, {accelKey: true, shiftKey: true},
                           toolbox.win);
  await onMaximized;
}
