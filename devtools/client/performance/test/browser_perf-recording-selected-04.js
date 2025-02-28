/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */
"use strict";

/**
 * Tests that all components can get rerendered for a profile when switching.
 */

const { SIMPLE_URL } = require("devtools/client/performance/test/helpers/urls");
const { UI_ENABLE_MEMORY_PREF, UI_ENABLE_ALLOCATIONS_PREF } = require("devtools/client/performance/test/helpers/prefs");
const { initPerformanceInNewTab, teardownToolboxAndRemoveTab } = require("devtools/client/performance/test/helpers/panel-utils");
const { startRecording, stopRecording, waitForAllWidgetsRendered } = require("devtools/client/performance/test/helpers/actions");
const { setSelectedRecording } = require("devtools/client/performance/test/helpers/recording-utils");

add_task(async function() {
  let { panel } = await initPerformanceInNewTab({
    url: SIMPLE_URL,
    win: window
  });

  let { DetailsView, DetailsSubview } = panel.panelWin;

  // Enable memory to test the memory overview.
  Services.prefs.setBoolPref(UI_ENABLE_MEMORY_PREF, true);

  // Enable allocations to test the memory-calltree and memory-flamegraph.
  Services.prefs.setBoolPref(UI_ENABLE_ALLOCATIONS_PREF, true);

  await startRecording(panel);
  await stopRecording(panel);

  // Ållow widgets to be updated while hidden, to make testing easier.
  DetailsSubview.canUpdateWhileHidden = true;

  // Cycle through all the views to initialize them. The waterfall is shown
  // by default, but all the other views are created lazily, so won't emit
  // any events.
  await DetailsView.selectView("js-calltree");
  await DetailsView.selectView("js-flamegraph");
  await DetailsView.selectView("memory-calltree");
  await DetailsView.selectView("memory-flamegraph");

  await startRecording(panel);
  await stopRecording(panel);

  let rerender = waitForAllWidgetsRendered(panel);
  setSelectedRecording(panel, 0);
  await rerender;

  ok(true, "All widgets were rendered when selecting the first recording.");

  rerender = waitForAllWidgetsRendered(panel);
  setSelectedRecording(panel, 1);
  await rerender;

  ok(true, "All widgets were rendered when selecting the second recording.");

  await teardownToolboxAndRemoveTab(panel);
});
