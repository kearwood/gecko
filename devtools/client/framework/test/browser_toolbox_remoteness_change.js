/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

var {Toolbox} = require("devtools/client/framework/toolbox");

const URL_1 = "about:robots";
const URL_2 = "data:text/html;charset=UTF-8," +
  encodeURIComponent("<div id=\"remote-page\">foo</div>");

add_task(async function () {
  info("Open a tab on a URL supporting only running in parent process");
  let tab = await addTab(URL_1);
  is(tab.linkedBrowser.currentURI.spec, URL_1, "We really are on the expected document");
  is(tab.linkedBrowser.getAttribute("remote"), "", "And running in parent process");

  let toolbox = await openToolboxForTab(tab);

  let onToolboxDestroyed = toolbox.once("destroyed");
  let onToolboxCreated = gDevTools.once("toolbox-created");

  info("Navigate to a URL supporting remote process");
  let onLoaded = BrowserTestUtils.browserLoaded(tab.linkedBrowser);
  gBrowser.loadURI(URL_2);
  await onLoaded;

  is(tab.linkedBrowser.getAttribute("remote"), "true", "Navigated to a data: URI and switching to remote");

  info("Waiting for the toolbox to be destroyed");
  await onToolboxDestroyed;

  info("Waiting for a new toolbox to be created");
  toolbox = await onToolboxCreated;

  info("Waiting for the new toolbox to be ready");
  await toolbox.once("ready");

  info("Veryify we are inspecting the new document");
  let console = await toolbox.selectTool("webconsole");
  let { jsterm } = console.hud;
  let url = await jsterm.execute("document.location.href");
  // Uses includes as the old console frontend prints a timestamp
  ok(url.textContent.includes(URL_2), "The console inspects the second document");
});
