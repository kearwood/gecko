/* -*- indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* vim: set ft=javascript ts=2 et sw=2 tw=80: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

define(function(require, exports, module) {
  const { render } = require("devtools/client/shared/vendor/react-dom");
  const { createFactories } = require("devtools/client/shared/react-utils");
  const { MainTabbedArea } = createFactories(require("./components/MainTabbedArea"));
  const TreeViewClass = require("devtools/client/shared/components/tree/TreeView");

  const AUTO_EXPAND_MAX_SIZE = 100 * 1024;
  const AUTO_EXPAND_MAX_LEVEL = 7;

  let prettyURL;

  // Application state object.
  let input = {
    jsonText: JSONView.json,
    jsonPretty: null,
    headers: JSONView.headers,
    tabActive: 0,
    prettified: false
  };

  /**
   * Application actions/commands. This list implements all commands
   * available for the JSON viewer.
   */
  input.actions = {
    onCopyJson: function() {
      let text = input.prettified ? input.jsonPretty : input.jsonText;
      copyString(text.textContent);
    },

    onSaveJson: function() {
      if (input.prettified && !prettyURL) {
        prettyURL = URL.createObjectURL(new window.Blob([input.jsonPretty.textContent]));
      }
      dispatchEvent("save", input.prettified ? prettyURL : null);
    },

    onCopyHeaders: function() {
      let value = "";
      let isWinNT = document.documentElement.getAttribute("platform") === "win";
      let eol = isWinNT ? "\r\n" : "\n";

      let responseHeaders = input.headers.response;
      for (let i = 0; i < responseHeaders.length; i++) {
        let header = responseHeaders[i];
        value += header.name + ": " + header.value + eol;
      }

      value += eol;

      let requestHeaders = input.headers.request;
      for (let i = 0; i < requestHeaders.length; i++) {
        let header = requestHeaders[i];
        value += header.name + ": " + header.value + eol;
      }

      copyString(value);
    },

    onSearch: function(value) {
      theApp.setState({searchFilter: value});
    },

    onPrettify: function(data) {
      if (input.json instanceof Error) {
        // Cannot prettify invalid JSON
        return;
      }
      if (input.prettified) {
        theApp.setState({jsonText: input.jsonText});
      } else {
        if (!input.jsonPretty) {
          input.jsonPretty = new Text(JSON.stringify(input.json, null, "  "));
        }
        theApp.setState({jsonText: input.jsonPretty});
      }

      input.prettified = !input.prettified;
    },
  };

  /**
   * Helper for copying a string to the clipboard.
   *
   * @param {String} string The text to be copied.
   */
  function copyString(string) {
    document.addEventListener("copy", event => {
      event.clipboardData.setData("text/plain", string);
      event.preventDefault();
    }, {once: true});

    document.execCommand("copy", false, null);
  }

  /**
   * Helper for dispatching an event. It's handled in chrome scope.
   *
   * @param {String} type Event detail type
   * @param {Object} value Event detail value
   */
  function dispatchEvent(type, value) {
    let data = {
      detail: {
        type,
        value,
      }
    };

    let contentMessageEvent = new CustomEvent("contentMessage", data);
    window.dispatchEvent(contentMessageEvent);
  }

  /**
   * Render the main application component. It's the main tab bar displayed
   * at the top of the window. This component also represents ReacJS root.
   */
  let content = document.getElementById("content");
  let promise = (async function parseJSON() {
    if (document.readyState == "loading") {
      // If the JSON has not been loaded yet, render the Raw Data tab first.
      input.json = {};
      input.expandedNodes = new Set();
      input.tabActive = 1;
      return new Promise(resolve => {
        document.addEventListener("DOMContentLoaded", resolve, {once: true});
      }).then(parseJSON).then(() => {
        // Now update the state and switch to the JSON tab.
        theApp.setState({
          tabActive: 0,
          json: input.json,
          expandedNodes: input.expandedNodes,
        });
      });
    }

    // If the JSON has been loaded, parse it immediately before loading the app.
    let jsonString = input.jsonText.textContent;
    try {
      input.json = JSON.parse(jsonString);
    } catch (err) {
      input.json = err;
    }

    // Expand the document by default if its size isn't bigger than 100KB.
    if (!(input.json instanceof Error) && jsonString.length <= AUTO_EXPAND_MAX_SIZE) {
      input.expandedNodes = TreeViewClass.getExpandedNodes(
        input.json,
        {maxLevel: AUTO_EXPAND_MAX_LEVEL}
      );
    }
    return undefined;
  })();

  let theApp = render(MainTabbedArea(input), content);

  // Send readyState change notification event to the window. Can be useful for
  // tests as well as extensions.
  JSONView.readyState = "interactive";
  window.dispatchEvent(new CustomEvent("AppReadyStateChange"));

  promise.then(() => {
    // Another readyState change notification event.
    JSONView.readyState = "complete";
    window.dispatchEvent(new CustomEvent("AppReadyStateChange"));
  });
});
