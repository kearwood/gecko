/* Any copyright is dedicated to the Public Domain.
http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

// Tests changing viewport device pixel ratio
const TEST_URL = "data:text/html;charset=utf-8,DevicePixelRatio list test";
const DEFAULT_DPPX = window.devicePixelRatio;
const VIEWPORT_DPPX = DEFAULT_DPPX + 2;
const Types = require("devtools/client/responsive.html/types");

const testDevice = {
  "name": "Fake Phone RDM Test",
  "width": 320,
  "height": 470,
  "pixelRatio": 5.5,
  "userAgent": "Mozilla/5.0 (Mobile; rv:39.0) Gecko/39.0 Firefox/39.0",
  "touch": true,
  "firefoxOS": true,
  "os": "custom",
  "featured": true,
};

// Add the new device to the list
addDeviceForTest(testDevice);

addRDMTask(TEST_URL, async function({ ui, manager }) {
  await waitStartup(ui);

  await testDefaults(ui);
  await testChangingDevice(ui);
  await testResetWhenResizingViewport(ui);
  await testChangingDevicePixelRatio(ui);
});

async function waitStartup(ui) {
  let { store } = ui.toolWindow;

  // Wait until the viewport has been added and the device list has been loaded
  await waitUntilState(store, state => state.viewports.length == 1
    && state.devices.listState == Types.loadableState.LOADED);
}

async function testDefaults(ui) {
  info("Test Defaults");

  let dppx = await getViewportDevicePixelRatio(ui);
  is(dppx, DEFAULT_DPPX, "Content has expected devicePixelRatio");
  testViewportDevicePixelRatioSelect(ui, {
    value: DEFAULT_DPPX,
    disabled: false,
  });
  testViewportDeviceSelectLabel(ui, "no device selected");
}

async function testChangingDevice(ui) {
  info("Test Changing Device");

  await selectDevice(ui, testDevice.name);
  await waitForViewportResizeTo(ui, testDevice.width, testDevice.height);
  let dppx = await waitForDevicePixelRatio(ui, testDevice.pixelRatio);
  is(dppx, testDevice.pixelRatio, "Content has expected devicePixelRatio");
  testViewportDevicePixelRatioSelect(ui, {
    value: testDevice.pixelRatio,
    disabled: true,
  });
  testViewportDeviceSelectLabel(ui, testDevice.name);
}

async function testResetWhenResizingViewport(ui) {
  info("Test reset when resizing the viewport");

  let deviceRemoved = once(ui, "device-association-removed");
  await testViewportResize(ui, ".viewport-vertical-resize-handle",
    [-10, -10], [testDevice.width, testDevice.height - 10], [0, -10], ui);
  await deviceRemoved;

  let dppx = await waitForDevicePixelRatio(ui, DEFAULT_DPPX);
  is(dppx, DEFAULT_DPPX, "Content has expected devicePixelRatio");

  testViewportDevicePixelRatioSelect(ui, {
    value: DEFAULT_DPPX,
    disabled: false,
  });
  testViewportDeviceSelectLabel(ui, "no device selected");
}

async function testChangingDevicePixelRatio(ui) {
  info("Test changing device pixel ratio");

  await selectDevicePixelRatio(ui, VIEWPORT_DPPX);
  let dppx = await waitForDevicePixelRatio(ui, VIEWPORT_DPPX);
  is(dppx, VIEWPORT_DPPX, "Content has expected devicePixelRatio");
  testViewportDevicePixelRatioSelect(ui, {
    value: VIEWPORT_DPPX,
    disabled: false,
  });
  testViewportDeviceSelectLabel(ui, "no device selected");
}

function testViewportDevicePixelRatioSelect(ui, expected) {
  info("Test viewport's DevicePixelRatio Select");

  let select =
    ui.toolWindow.document.querySelector("#global-device-pixel-ratio-selector");
  is(select.value, expected.value,
     `DevicePixelRatio Select value should be: ${expected.value}`);
  is(select.disabled, expected.disabled,
    `DevicePixelRatio Select should be ${expected.disabled ? "disabled" : "enabled"}.`);
}

function waitForDevicePixelRatio(ui, expected) {
  return ContentTask.spawn(ui.getViewportBrowser(), { expected }, function(args) {
    let initial = content.devicePixelRatio;
    info(`Listening for pixel ratio change ` +
         `(current: ${initial}, expected: ${args.expected})`);
    return new Promise(resolve => {
      let mql = content.matchMedia(`(resolution: ${args.expected}dppx)`);
      if (mql.matches) {
        info(`Ratio already changed to ${args.expected}dppx`);
        resolve(content.devicePixelRatio);
        return;
      }
      mql.addListener(function listener() {
        info(`Ratio changed to ${args.expected}dppx`);
        mql.removeListener(listener);
        resolve(content.devicePixelRatio);
      });
    });
  });
}
