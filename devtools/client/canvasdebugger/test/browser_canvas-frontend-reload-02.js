/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

/**
 * Tests that the frontend UI is properly reconfigured after reloading.
 */

async function ifTestingSupported() {
  let { target, panel } = await initCanvasDebuggerFrontend(SIMPLE_CANVAS_URL);
  let { window, $, $all, EVENTS, SnapshotsListView, CallsListView } = panel.panelWin;

  is(SnapshotsListView.itemCount, 0,
    "There should be no snapshots initially displayed in the UI.");
  is(CallsListView.itemCount, 0,
    "There should be no function calls initially displayed in the UI.");

  is($("#screenshot-container").hidden, true,
    "The screenshot should not be initially displayed in the UI.");
  is($("#snapshot-filmstrip").hidden, true,
    "There should be no thumbnails initially displayed in the UI (1).");
  is($all(".filmstrip-thumbnail").length, 0,
    "There should be no thumbnails initially displayed in the UI (2).");

  await reload(target);

  let recordingFinished = once(window, EVENTS.SNAPSHOT_RECORDING_FINISHED);
  let callListPopulated = once(window, EVENTS.CALL_LIST_POPULATED);
  let thumbnailsDisplayed = once(window, EVENTS.THUMBNAILS_DISPLAYED);
  let screenshotDisplayed = once(window, EVENTS.CALL_SCREENSHOT_DISPLAYED);
  SnapshotsListView._onRecordButtonClick();
  await promise.all([
    recordingFinished,
    callListPopulated,
    thumbnailsDisplayed,
    screenshotDisplayed
  ]);

  is(SnapshotsListView.itemCount, 1,
    "There should be one snapshot displayed in the UI.");
  is(CallsListView.itemCount, 8,
    "All the function calls should now be displayed in the UI.");

  is($("#screenshot-container").hidden, false,
    "The screenshot should now be displayed in the UI.");
  is($("#snapshot-filmstrip").hidden, false,
    "All the thumbnails should now be displayed in the UI (1).");
  is($all(".filmstrip-thumbnail").length, 4,
    "All the thumbnails should now be displayed in the UI (2).");

  let reset = once(window, EVENTS.UI_RESET);
  let navigated = reload(target);

  await reset;
  ok(true, "The UI was reset after the refresh button was clicked.");

  is(SnapshotsListView.itemCount, 0,
    "There should be no snapshots displayed in the UI after navigating.");
  is(CallsListView.itemCount, 0,
    "There should be no function calls displayed in the UI after navigating.");
  is($("#snapshot-filmstrip").hidden, true,
    "There should be no thumbnails displayed in the UI after navigating.");
  is($("#screenshot-container").hidden, true,
    "The screenshot should not be displayed in the UI after navigating.");

  await navigated;
  ok(true, "The target finished reloading.");

  await teardown(panel);
  finish();
}
