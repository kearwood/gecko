/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */
"use strict";

/**
 * Tests that when a recording overlaps the circular buffer, that
 * a class is assigned to the recording notices.
 */

const { SIMPLE_URL } = require("devtools/client/performance/test/helpers/urls");
const { PROFILER_BUFFER_SIZE_PREF } = require("devtools/client/performance/test/helpers/prefs");
const { pmmLoadFrameScripts, pmmStopProfiler, pmmClearFrameScripts } = require("devtools/client/performance/test/helpers/profiler-mm-utils");
const { initPerformanceInNewTab, teardownToolboxAndRemoveTab } = require("devtools/client/performance/test/helpers/panel-utils");
const { startRecording, stopRecording } = require("devtools/client/performance/test/helpers/actions");
const { waitUntil } = require("devtools/client/performance/test/helpers/wait-utils");
const { once } = require("devtools/client/performance/test/helpers/event-utils");

add_task(async function() {
  // Make sure the profiler module is stopped so we can set a new buffer limit.
  pmmLoadFrameScripts(gBrowser);
  await pmmStopProfiler();

  // Keep the profiler's buffer small, to get to 100% really quickly.
  Services.prefs.setIntPref(PROFILER_BUFFER_SIZE_PREF, 10000);

  let { panel } = await initPerformanceInNewTab({
    url: SIMPLE_URL,
    win: window
  });

  let { gFront, EVENTS, $, PerformanceController, PerformanceView } = panel.panelWin;

  // Set a fast profiler-status update interval
  await gFront.setProfilerStatusInterval(10);

  let DETAILS_CONTAINER = $("#details-pane-container");
  let NORMAL_BUFFER_STATUS_MESSAGE = $("#recording-notice .buffer-status-message");
  let gPercent;

  // Start a manual recording.
  await startRecording(panel);

  await waitUntil(async function() {
    [, gPercent] = await once(PerformanceView,
                              EVENTS.UI_RECORDING_PROFILER_STATUS_RENDERED,
                              { spreadArgs: true });
    return gPercent == 100;
  });

  ok(true, "Buffer percentage increased in display.");

  let bufferUsage = PerformanceController.getBufferUsageForRecording(
    PerformanceController.getCurrentRecording());
  ok(bufferUsage, 1, "Buffer is full for this recording.");
  ok(DETAILS_CONTAINER.getAttribute("buffer-status"), "full",
    "Container has [buffer-status=full].");
  ok(NORMAL_BUFFER_STATUS_MESSAGE.value.includes(gPercent + "%"),
    "Buffer status text has correct percentage.");

  // Stop the manual recording.
  await stopRecording(panel);

  await teardownToolboxAndRemoveTab(panel);

  pmmClearFrameScripts();
});
