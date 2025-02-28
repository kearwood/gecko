/* -*- indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* vim: set ft=javascript ts=2 et sw=2 tw=80: */
/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

// See Bug 585991.

const TEST_URI = "data:text/html;charset=utf-8,<p>bug 585991 - autocomplete popup test";

add_task(async function() {
  const {jsterm} = await openNewTabAndConsole(TEST_URI);
  const {
    autocompletePopup: popup,
    inputNode: input,
  } = jsterm;

  let items = [
    {label: "item0", value: "value0"},
    {label: "item1", value: "value1"},
    {label: "item2", value: "value2"},
  ];

  ok(!popup.isOpen, "popup is not open");
  ok(!input.hasAttribute("aria-activedescendant"), "no aria-activedescendant");

  let onPopupOpen = popup.once("popup-opened");
  popup.openPopup(input);
  await onPopupOpen;

  ok(popup.isOpen, "popup is open");
  is(popup.itemCount, 0, "no items");
  ok(!input.hasAttribute("aria-activedescendant"), "no aria-activedescendant");

  popup.setItems(items);

  is(popup.itemCount, items.length, "items added");
  is(JSON.stringify(popup.getItems()), JSON.stringify(items),
    "getItems returns back the same items");
  is(popup.selectedIndex, 2, "Index of the first item from bottom is selected.");
  is(popup.selectedItem, items[2], "First item from bottom is selected");
  checkActiveDescendant(popup, input);

  popup.selectedIndex = 1;

  is(popup.selectedIndex, 1, "index 1 is selected");
  is(popup.selectedItem, items[1], "item1 is selected");
  checkActiveDescendant(popup, input);

  popup.selectedItem = items[2];

  is(popup.selectedIndex, 2, "index 2 is selected");
  is(popup.selectedItem, items[2], "item2 is selected");
  checkActiveDescendant(popup, input);

  is(popup.selectPreviousItem(), items[1], "selectPreviousItem() works");

  is(popup.selectedIndex, 1, "index 1 is selected");
  is(popup.selectedItem, items[1], "item1 is selected");
  checkActiveDescendant(popup, input);

  is(popup.selectNextItem(), items[2], "selectNextItem() works");

  is(popup.selectedIndex, 2, "index 2 is selected");
  is(popup.selectedItem, items[2], "item2 is selected");
  checkActiveDescendant(popup, input);

  ok(popup.selectNextItem(), "selectNextItem() works");

  is(popup.selectedIndex, 0, "index 0 is selected");
  is(popup.selectedItem, items[0], "item0 is selected");
  checkActiveDescendant(popup, input);

  items.push({label: "label3", value: "value3"});
  popup.appendItem(items[3]);

  is(popup.itemCount, items.length, "item3 appended");

  popup.selectedIndex = 3;
  is(popup.selectedItem, items[3], "item3 is selected");
  checkActiveDescendant(popup, input);

  popup.removeItem(items[2]);

  is(popup.selectedIndex, 2, "index2 is selected");
  is(popup.selectedItem, items[3], "item3 is still selected");
  checkActiveDescendant(popup, input);
  is(popup.itemCount, items.length - 1, "item2 removed");

  popup.clearItems();
  is(popup.itemCount, 0, "items cleared");
  ok(!input.hasAttribute("aria-activedescendant"), "no aria-activedescendant");

  const onPopupClose = popup.once("popup-closed");
  popup.hidePopup();
  await onPopupClose;
});

function stripNS(text) {
  return text.replace(RegExp(' xmlns="http://www.w3.org/1999/xhtml"', "g"), "");
}

function checkActiveDescendant(popup, input) {
  let activeElement = input.ownerDocument.activeElement;
  let descendantId = activeElement.getAttribute("aria-activedescendant");
  let popupItem = popup._tooltip.panel.querySelector("#" + descendantId);
  let cloneItem = input.ownerDocument.querySelector("#" + descendantId);

  ok(popupItem, "Active descendant is found in the popup list");
  ok(cloneItem, "Active descendant is found in the list clone");
  is(stripNS(popupItem.outerHTML), cloneItem.outerHTML,
    "Cloned item has the same HTML as the original element");
}
