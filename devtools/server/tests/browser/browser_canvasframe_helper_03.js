/* vim: set ft=javascript ts=2 et sw=2 tw=80: */
/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

// Test the CanvasFrameAnonymousContentHelper event handling mechanism.

const TEST_URL = "data:text/html;charset=utf-8,CanvasFrameAnonymousContentHelper test";

add_task(async function() {
  let browser = await addTab(TEST_URL);
  await ContentTask.spawn(browser, null, async function() {
    const {require} = ChromeUtils.import("resource://devtools/shared/Loader.jsm", {});
    const {HighlighterEnvironment} = require("devtools/server/actors/highlighters");
    const {
      CanvasFrameAnonymousContentHelper
    } = require("devtools/server/actors/highlighters/utils/markup");
    let doc = content.document;

    let nodeBuilder = () => {
      let root = doc.createElement("div");
      let child = doc.createElement("div");
      child.style = "pointer-events:auto;width:200px;height:200px;background:red;";
      child.id = "child-element";
      child.className = "child-element";
      root.appendChild(child);
      return root;
    };

    info("Building the helper");
    let env = new HighlighterEnvironment();
    env.initFromWindow(doc.defaultView);
    let helper = new CanvasFrameAnonymousContentHelper(env, nodeBuilder);

    let el = helper.getElement("child-element");

    info("Adding an event listener on the inserted element");
    let mouseDownHandled = 0;
    function onMouseDown(e, id) {
      is(id, "child-element", "The mousedown event was triggered on the element");
      ok(!e.originalTarget, "The originalTarget property isn't available");
      mouseDownHandled++;
    }
    el.addEventListener("mousedown", onMouseDown);

    function once(target, event) {
      return new Promise(done => {
        target.addEventListener(event, done, { once: true });
      });
    }

    info("Synthesizing an event on the inserted element");
    let onDocMouseDown = once(doc, "mousedown");
    synthesizeMouseDown(100, 100, doc.defaultView);
    await onDocMouseDown;

    is(mouseDownHandled, 1, "The mousedown event was handled once on the element");

    info("Synthesizing an event somewhere else");
    onDocMouseDown = once(doc, "mousedown");
    synthesizeMouseDown(400, 400, doc.defaultView);
    await onDocMouseDown;

    is(mouseDownHandled, 1, "The mousedown event was not handled on the element");

    info("Removing the event listener");
    el.removeEventListener("mousedown", onMouseDown);

    info("Synthesizing another event after the listener has been removed");
    // Using a document event listener to know when the event has been synthesized.
    onDocMouseDown = once(doc, "mousedown");
    synthesizeMouseDown(100, 100, doc.defaultView);
    await onDocMouseDown;

    is(mouseDownHandled, 1,
      "The mousedown event hasn't been handled after the listener was removed");

    info("Adding again the event listener");
    el.addEventListener("mousedown", onMouseDown);

    info("Destroying the helper");
    env.destroy();
    helper.destroy();

    info("Synthesizing another event after the helper has been destroyed");
    // Using a document event listener to know when the event has been synthesized.
    onDocMouseDown = once(doc, "mousedown");
    synthesizeMouseDown(100, 100, doc.defaultView);
    await onDocMouseDown;

    is(mouseDownHandled, 1,
      "The mousedown event hasn't been handled after the helper was destroyed");

    function synthesizeMouseDown(x, y, win) {
      // We need to make sure the inserted anonymous content can be targeted by the
      // event right after having been inserted, and so we need to force a sync
      // reflow.
      win.document.documentElement.offsetWidth;
      // Minimal environment for EventUtils to work.
      let EventUtils = {
        window: content,
        parent: content,
        _EU_Ci: Ci,
        _EU_Cc: Cc,
      };
      Services.scriptloader.loadSubScript("chrome://mochikit/content/tests/SimpleTest/EventUtils.js", EventUtils);
      EventUtils.synthesizeMouseAtPoint(x, y, {type: "mousedown"}, win);
    }
  });

  gBrowser.removeCurrentTab();
});
