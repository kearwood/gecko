"use strict";

ChromeUtils.import("resource://testing-common/PromiseTestUtils.jsm");

PromiseTestUtils.whitelistRejectionsGlobally(/WebExtension context not found/);

const server = createHttpServer({hosts: ["example.com"]});
server.registerDirectory("/data/", do_get_file("data"));

// Copied from toolkit/components/extensions/test/xpcshell/test_ext_storage.js.
// The storage API in content scripts should behave identical to the storage API
// in background pages.
const STORAGE_SYNC_PREF = "webextensions.storage.sync.enabled";

/**
 * Utility function to ensure that all supported APIs for getting are
 * tested.
 *
 * @param {string} areaName
 *        either "local" or "sync" according to what we want to test
 * @param {string} prop
 *        "key" to look up using the storage API
 * @param {Object} value
 *        "value" to compare against
 */
async function checkGetImpl(areaName, prop, value) {
  let storage = browser.storage[areaName];

  let data = await storage.get(null);
  browser.test.assertEq(value, data[prop], `null getter worked for ${prop} in ${areaName}`);

  data = await storage.get(prop);
  browser.test.assertEq(value, data[prop], `string getter worked for ${prop} in ${areaName}`);

  data = await storage.get([prop]);
  browser.test.assertEq(value, data[prop], `array getter worked for ${prop} in ${areaName}`);

  data = await storage.get({[prop]: undefined});
  browser.test.assertEq(value, data[prop], `object getter worked for ${prop} in ${areaName}`);
}

async function contentScript(checkGet) {
  let globalChanges, gResolve;
  function clearGlobalChanges() {
    globalChanges = new Promise(resolve => { gResolve = resolve; });
  }
  clearGlobalChanges();
  let expectedAreaName;

  browser.storage.onChanged.addListener((changes, areaName) => {
    browser.test.assertEq(expectedAreaName, areaName,
                          "Expected area name received by listener");
    gResolve(changes);
  });

  async function checkChanges(areaName, changes, message) {
    function checkSub(obj1, obj2) {
      for (let prop in obj1) {
        browser.test.assertTrue(obj1[prop] !== undefined,
                                `checkChanges ${areaName} ${prop} is missing (${message})`);
        browser.test.assertTrue(obj2[prop] !== undefined,
                                `checkChanges ${areaName} ${prop} is missing (${message})`);
        browser.test.assertEq(obj1[prop].oldValue, obj2[prop].oldValue,
                              `checkChanges ${areaName} ${prop} old (${message})`);
        browser.test.assertEq(obj1[prop].newValue, obj2[prop].newValue,
                              `checkChanges ${areaName} ${prop} new (${message})`);
      }
    }

    const recentChanges = await globalChanges;
    checkSub(changes, recentChanges);
    checkSub(recentChanges, changes);
    clearGlobalChanges();
  }

  /* eslint-disable dot-notation */
  async function runTests(areaName) {
    expectedAreaName = areaName;
    let storage = browser.storage[areaName];
    // Set some data and then test getters.
    try {
      await storage.set({"test-prop1": "value1", "test-prop2": "value2"});
      await checkChanges(
        areaName,
        {"test-prop1": {newValue: "value1"}, "test-prop2": {newValue: "value2"}},
        "set (a)");

      await checkGet(areaName, "test-prop1", "value1");
      await checkGet(areaName, "test-prop2", "value2");

      let data = await storage.get({"test-prop1": undefined, "test-prop2": undefined, "other": "default"});
      browser.test.assertEq("value1", data["test-prop1"], "prop1 correct (a)");
      browser.test.assertEq("value2", data["test-prop2"], "prop2 correct (a)");
      browser.test.assertEq("default", data["other"], "other correct");

      data = await storage.get(["test-prop1", "test-prop2", "other"]);
      browser.test.assertEq("value1", data["test-prop1"], "prop1 correct (b)");
      browser.test.assertEq("value2", data["test-prop2"], "prop2 correct (b)");
      browser.test.assertFalse("other" in data, "other correct");

      // Remove data in various ways.
      await storage.remove("test-prop1");
      await checkChanges(areaName, {"test-prop1": {oldValue: "value1"}}, "remove string");

      data = await storage.get(["test-prop1", "test-prop2"]);
      browser.test.assertFalse("test-prop1" in data, "prop1 absent (remove string)");
      browser.test.assertTrue("test-prop2" in data, "prop2 present (remove string)");

      await storage.set({"test-prop1": "value1"});
      await checkChanges(areaName, {"test-prop1": {newValue: "value1"}}, "set (c)");

      data = await storage.get(["test-prop1", "test-prop2"]);
      browser.test.assertEq(data["test-prop1"], "value1", "prop1 correct (c)");
      browser.test.assertEq(data["test-prop2"], "value2", "prop2 correct (c)");

      await storage.remove(["test-prop1", "test-prop2"]);
      await checkChanges(
        areaName,
        {"test-prop1": {oldValue: "value1"}, "test-prop2": {oldValue: "value2"}},
        "remove array");

      data = await storage.get(["test-prop1", "test-prop2"]);
      browser.test.assertFalse("test-prop1" in data, "prop1 absent (remove array)");
      browser.test.assertFalse("test-prop2" in data, "prop2 absent (remove array)");

      // test storage.clear
      await storage.set({"test-prop1": "value1", "test-prop2": "value2"});
      // Make sure that set() handler happened before we clear the
      // promise again.
      await globalChanges;

      clearGlobalChanges();
      await storage.clear();

      await checkChanges(
        areaName,
        {"test-prop1": {oldValue: "value1"}, "test-prop2": {oldValue: "value2"}},
        "clear");
      data = await storage.get(["test-prop1", "test-prop2"]);
      browser.test.assertFalse("test-prop1" in data, "prop1 absent (clear)");
      browser.test.assertFalse("test-prop2" in data, "prop2 absent (clear)");

      // Make sure we can store complex JSON data.
      // known previous values
      await storage.set({"test-prop1": "value1", "test-prop2": "value2"});

      // Make sure the set() handler landed.
      await globalChanges;

      let date = new Date(0);

      clearGlobalChanges();
      await storage.set({
        "test-prop1": {
          str: "hello",
          bool: true,
          null: null,
          undef: undefined,
          obj: {},
          arr: [1, 2],
          date: new Date(0),
          regexp: /regexp/,
        },
      });

      await browser.test.assertRejects(
        storage.set({
          window,
        }),
        /DataCloneError|cyclic object value/);

      await browser.test.assertRejects(
        storage.set({"test-prop2": function func() {}}),
        /DataCloneError/);

      const recentChanges = await globalChanges;

      browser.test.assertEq("value1", recentChanges["test-prop1"].oldValue, "oldValue correct");
      browser.test.assertEq("object", typeof(recentChanges["test-prop1"].newValue), "newValue is obj");
      clearGlobalChanges();

      data = await storage.get({"test-prop1": undefined, "test-prop2": undefined});
      let obj = data["test-prop1"];

      if (areaName === "local") {
        browser.test.assertEq(String(date), String(obj.date), "date part correct");
        browser.test.assertEq("/regexp/", obj.regexp.toSource(), "regexp part correct");
      } else {
        browser.test.assertEq("1970-01-01T00:00:00.000Z", String(obj.date), "date part correct");

        browser.test.assertEq("object", typeof obj.regexp, "regexp part is an object");
        browser.test.assertEq(0, Object.keys(obj.regexp).length, "regexp part is an empty object");
      }

      browser.test.assertEq("hello", obj.str, "string part correct");
      browser.test.assertEq(true, obj.bool, "bool part correct");
      browser.test.assertEq(null, obj.null, "null part correct");
      browser.test.assertEq(undefined, obj.undef, "undefined part correct");
      browser.test.assertEq(undefined, obj.window, "window part correct");
      browser.test.assertEq("object", typeof(obj.obj), "object part correct");
      browser.test.assertTrue(Array.isArray(obj.arr), "array part present");
      browser.test.assertEq(1, obj.arr[0], "arr[0] part correct");
      browser.test.assertEq(2, obj.arr[1], "arr[1] part correct");
      browser.test.assertEq(2, obj.arr.length, "arr.length part correct");
    } catch (e) {
      browser.test.fail(`Error: ${e} :: ${e.stack}`);
      browser.test.notifyFail("storage");
    }
  }

  browser.test.onMessage.addListener(msg => {
    let promise;
    if (msg === "test-local") {
      promise = runTests("local");
    } else if (msg === "test-sync") {
      promise = runTests("sync");
    }
    promise.then(() => browser.test.sendMessage("test-finished"));
  });

  browser.test.sendMessage("ready");
}

let extensionData = {
  manifest: {
    content_scripts: [{
      "matches": ["http://example.com/data/file_sample.html"],
      "js": ["content_script.js"],
      "run_at": "document_idle",
    }],

    permissions: ["storage"],
  },

  files: {
    "content_script.js": `(${contentScript})(${checkGetImpl})`,
  },
};

add_task(async function test_contentscript() {
  await ExtensionTestUtils.startAddonManager();
  Services.prefs.setBoolPref(STORAGE_SYNC_PREF, true);


  let contentPage = await ExtensionTestUtils.loadContentPage(
    "http://example.com/data/file_sample.html");

  let extension = ExtensionTestUtils.loadExtension(extensionData);
  await extension.startup();
  await extension.awaitMessage("ready");

  extension.sendMessage("test-local");
  await extension.awaitMessage("test-finished");

  extension.sendMessage("test-sync");
  await extension.awaitMessage("test-finished");

  await extension.unload();
  await contentPage.close();
});
