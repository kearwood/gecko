/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { reloadPageAndLog } = require("chrome://damp/content/tests/head");

exports.reloadInspectorAndLog = async function(label, toolbox) {
  let onReload = async function() {
    let inspector = toolbox.getPanel("inspector");
    // First wait for markup view to be loaded against the new root node
    await inspector.once("new-root");
    // Then wait for inspector to be updated
    await inspector.once("inspector-updated");
  };

  await reloadPageAndLog(label + ".inspector", toolbox, onReload);
};
