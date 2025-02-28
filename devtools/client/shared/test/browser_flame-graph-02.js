/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

// Tests that flame graph widgets may have a fixed width or height.

const {FlameGraph} = require("devtools/client/shared/widgets/FlameGraph");

add_task(async function() {
  await addTab("about:blank");
  await performTest();
  gBrowser.removeCurrentTab();
});

async function performTest() {
  let [host,, doc] = await createHost();
  doc.body.setAttribute("style",
                        "position: fixed; width: 100%; height: 100%; margin: 0;");

  let graph = new FlameGraph(doc.body);
  graph.fixedWidth = 200;
  graph.fixedHeight = 100;

  await graph.ready();
  testGraph(host, graph);

  await graph.destroy();
  host.destroy();
}

function testGraph(host, graph) {
  let bounds = host.frame.getBoundingClientRect();

  isnot(graph.width, bounds.width * window.devicePixelRatio,
    "The graph should not span all the parent node's width.");
  isnot(graph.height, bounds.height * window.devicePixelRatio,
    "The graph should not span all the parent node's height.");

  is(graph.width, graph.fixedWidth * window.devicePixelRatio,
    "The graph has the correct width.");
  is(graph.height, graph.fixedHeight * window.devicePixelRatio,
    "The graph has the correct height.");
}
