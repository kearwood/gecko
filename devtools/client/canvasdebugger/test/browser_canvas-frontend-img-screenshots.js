/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

/**
 * Tests if screenshots are properly displayed in the UI.
 */

async function ifTestingSupported() {
  let { target, panel } = await initCanvasDebuggerFrontend(SIMPLE_CANVAS_URL);
  let { window, $, EVENTS, SnapshotsListView } = panel.panelWin;

  await reload(target);

  let recordingFinished = once(window, EVENTS.SNAPSHOT_RECORDING_FINISHED);
  let callListPopulated = once(window, EVENTS.CALL_LIST_POPULATED);
  let screenshotDisplayed = once(window, EVENTS.CALL_SCREENSHOT_DISPLAYED);
  SnapshotsListView._onRecordButtonClick();
  await promise.all([recordingFinished, callListPopulated, screenshotDisplayed]);

  is($("#screenshot-container").hidden, false,
    "The screenshot container should now be visible.");

  is($("#screenshot-dimensions").getAttribute("value"), "128" + "\u00D7" + "128",
    "The screenshot dimensions label has the expected value.");

  is($("#screenshot-image").getAttribute("flipped"), "false",
    "The screenshot element should not be flipped vertically.");

  ok(window.getComputedStyle($("#screenshot-image")).backgroundImage.includes("#screenshot-rendering"),
    "The screenshot element should have an offscreen canvas element as a background.");

  await teardown(panel);
  finish();
}
