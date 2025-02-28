/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const TEST_QUOTA_USAGE_HOST = "example.com";
const TEST_QUOTA_USAGE_ORIGIN = "https://" + TEST_QUOTA_USAGE_HOST;
const TEST_QUOTA_USAGE_URL = TEST_QUOTA_USAGE_ORIGIN + "/browser/browser/components/preferences/in-content/tests/site_data_test.html";
const TEST_OFFLINE_HOST = "example.org";
const TEST_OFFLINE_ORIGIN = "https://" + TEST_OFFLINE_HOST;
const TEST_OFFLINE_URL = TEST_OFFLINE_ORIGIN + "/browser/browser/components/preferences/in-content/tests/offline/offline.html";
const TEST_SERVICE_WORKER_URL = TEST_OFFLINE_ORIGIN + "/browser/browser/components/preferences/in-content/tests/service_worker_test.html";
const REMOVE_DIALOG_URL = "chrome://browser/content/preferences/siteDataRemoveSelected.xul";

const { NetUtil } = ChromeUtils.import("resource://gre/modules/NetUtil.jsm", {});
const { DownloadUtils } = ChromeUtils.import("resource://gre/modules/DownloadUtils.jsm", {});
const { SiteDataManager } = ChromeUtils.import("resource:///modules/SiteDataManager.jsm", {});
const { OfflineAppCacheHelper } = ChromeUtils.import("resource:///modules/offlineAppCache.jsm", {});

function getPersistentStoragePermStatus(origin) {
  let uri = NetUtil.newURI(origin);
  let principal = Services.scriptSecurityManager.createCodebasePrincipal(uri, {});
  return Services.perms.testExactPermissionFromPrincipal(principal, "persistent-storage");
}

// Test listing site using quota usage or site using appcache
// This is currently disabled because of bug 1414751.
add_task(async function() {
  await SpecialPowers.pushPrefEnv({set: [["browser.storageManager.enabled", true]]});

  // Open a test site which would save into appcache
  await BrowserTestUtils.openNewForegroundTab(gBrowser, TEST_OFFLINE_URL);
  await BrowserTestUtils.removeTab(gBrowser.selectedTab);

  // Open a test site which would save into quota manager
  BrowserTestUtils.openNewForegroundTab(gBrowser, TEST_QUOTA_USAGE_URL);
  await BrowserTestUtils.waitForContentEvent(
    gBrowser.selectedBrowser, "test-indexedDB-done", false, null, true);
  await BrowserTestUtils.removeTab(gBrowser.selectedTab);

  let updatedPromise = promiseSiteDataManagerSitesUpdated();
  await openPreferencesViaOpenPreferencesAPI("privacy", { leaveOpen: true });
  await updatedPromise;
  await openSiteDataSettingsDialog();
  // eslint-disable-next-line mozilla/no-cpows-in-tests
  let dialog = content.gSubDialog._topDialog;
  let dialogFrame = dialog._frame;
  let frameDoc = dialogFrame.contentDocument;

  let siteItems = frameDoc.getElementsByTagName("richlistitem");
  is(siteItems.length, 2, "Should list sites using quota usage or appcache");

  let appcacheSite = frameDoc.querySelector(`richlistitem[host="${TEST_OFFLINE_HOST}"]`);
  ok(appcacheSite, "Should list site using appcache");

  let qoutaUsageSite = frameDoc.querySelector(`richlistitem[host="${TEST_QUOTA_USAGE_HOST}"]`);
  ok(qoutaUsageSite, "Should list site using quota usage");

  // Always remember to clean up
  OfflineAppCacheHelper.clear();
  await new Promise(resolve => {
    let principal = Services.scriptSecurityManager
                            .createCodebasePrincipalFromOrigin(TEST_QUOTA_USAGE_ORIGIN);
    let request = Services.qms.clearStoragesForPrincipal(principal, null, true);
    request.callback = resolve;
  });

  await SiteDataManager.removeAll();
  await BrowserTestUtils.removeTab(gBrowser.selectedTab);
}).skip(); // Bug 1414751

// Test buttons are disabled and loading message shown while updating sites
add_task(async function() {
  await SpecialPowers.pushPrefEnv({set: [["browser.storageManager.enabled", true]]});
  let updatedPromise = promiseSiteDataManagerSitesUpdated();
  await openPreferencesViaOpenPreferencesAPI("privacy", { leaveOpen: true });
  await updatedPromise;
  let cacheSize = await SiteDataManager.getCacheSize();

  let actual = null;
  let expected = null;
  let doc = gBrowser.selectedBrowser.contentDocument;
  let clearBtn = doc.getElementById("clearSiteDataButton");
  let settingsButton = doc.getElementById("siteDataSettings");
  let prefStrBundle = doc.getElementById("bundlePreferences");
  let totalSiteDataSizeLabel = doc.getElementById("totalSiteDataSize");
  is(clearBtn.disabled, false, "Should enable clear button after sites updated");
  is(settingsButton.disabled, false, "Should enable settings button after sites updated");
  await SiteDataManager.getTotalUsage()
                       .then(usage => {
                         actual = totalSiteDataSizeLabel.textContent;
                         expected = prefStrBundle.getFormattedString(
                           "totalSiteDataSize2", DownloadUtils.convertByteUnits(usage + cacheSize));
                          is(actual, expected, "Should show the right total site data size");
                       });

  Services.obs.notifyObservers(null, "sitedatamanager:updating-sites");
  is(clearBtn.disabled, true, "Should disable clear button while updating sites");
  is(settingsButton.disabled, true, "Should disable settings button while updating sites");
  actual = totalSiteDataSizeLabel.textContent;
  expected = prefStrBundle.getString("loadingSiteDataSize1");
  is(actual, expected, "Should show the loading message while updating");

  Services.obs.notifyObservers(null, "sitedatamanager:sites-updated");
  is(clearBtn.disabled, false, "Should enable clear button after sites updated");
  is(settingsButton.disabled, false, "Should enable settings button after sites updated");
  cacheSize = await SiteDataManager.getCacheSize();
  await SiteDataManager.getTotalUsage()
                       .then(usage => {
                         actual = totalSiteDataSizeLabel.textContent;
                         expected = prefStrBundle.getFormattedString(
                           "totalSiteDataSize2", DownloadUtils.convertByteUnits(usage + cacheSize));
                          is(actual, expected, "Should show the right total site data size");
                       });

  await BrowserTestUtils.removeTab(gBrowser.selectedTab);
});

// Test clearing service wroker through the settings panel
add_task(async function() {
  await SpecialPowers.pushPrefEnv({set: [["browser.storageManager.enabled", true]]});
  // Register a test service worker
  await loadServiceWorkerTestPage(TEST_SERVICE_WORKER_URL);
  await openPreferencesViaOpenPreferencesAPI("privacy", { leaveOpen: true });
  // Test the initial states
  await promiseServiceWorkerRegisteredFor(TEST_SERVICE_WORKER_URL);
  // Open the Site Data Settings panel and remove the site
  await openSiteDataSettingsDialog();
  let acceptRemovePromise = promiseAlertDialogOpen("accept");
  let updatePromise = promiseSiteDataManagerSitesUpdated();
  ContentTask.spawn(gBrowser.selectedBrowser, { TEST_OFFLINE_HOST }, args => {
    let host = args.TEST_OFFLINE_HOST;
    let frameDoc = content.gSubDialog._topDialog._frame.contentDocument;
    let sitesList = frameDoc.getElementById("sitesList");
    let site = sitesList.querySelector(`richlistitem[host="${host}"]`);
    if (site) {
      let removeBtn = frameDoc.getElementById("removeSelected");
      let saveBtn = frameDoc.getElementById("save");
      site.click();
      removeBtn.doCommand();
      saveBtn.doCommand();
    } else {
      ok(false, `Should have one site of ${host}`);
    }
  });
  await acceptRemovePromise;
  await updatePromise;
  await promiseServiceWorkersCleared();
  await SiteDataManager.removeAll();
  await BrowserTestUtils.removeTab(gBrowser.selectedTab);
});

// Test showing and removing sites with cookies.
add_task(async function() {
  // Add some test cookies.
  let uri = Services.io.newURI("https://example.com");
  let uri2 = Services.io.newURI("https://example.org");
  Services.cookies.add(uri.host, uri.pathQueryRef, "test1", "1",
    false, false, false, Date.now() + 1000 * 60 * 60);
  Services.cookies.add(uri.host, uri.pathQueryRef, "test2", "2",
    false, false, false, Date.now() + 1000 * 60 * 60);
  Services.cookies.add(uri2.host, uri2.pathQueryRef, "test1", "1",
    false, false, false, Date.now() + 1000 * 60 * 60);

  // Ensure that private browsing cookies are ignored.
  Services.cookies.add(uri.host, uri.pathQueryRef, "test3", "3",
    false, false, false, Date.now() + 1000 * 60 * 60, { privateBrowsingId: 1 });

  // Get the exact creation date from the cookies (to avoid intermittents
  // from minimal time differences, since we round up to minutes).
  let cookiesEnum1 = Services.cookies.getCookiesFromHost(uri.host);
  // We made two valid cookies for example.com.
  cookiesEnum1.getNext();
  let cookiesEnum2 = Services.cookies.getCookiesFromHost(uri2.host);
  let cookie1 = cookiesEnum1.getNext().QueryInterface(Ci.nsICookie2);
  let cookie2 = cookiesEnum2.getNext().QueryInterface(Ci.nsICookie2);

  let formatter = new Services.intl.DateTimeFormat(undefined, {
    dateStyle: "short", timeStyle: "short",
  });

  let creationDate1 = formatter.format(new Date(cookie1.lastAccessed / 1000));
  let creationDate2 = formatter.format(new Date(cookie2.lastAccessed / 1000));

  await openPreferencesViaOpenPreferencesAPI("privacy", { leaveOpen: true });

  // Open the site data manager and remove one site.
  await openSiteDataSettingsDialog();
  let removeDialogOpenPromise = promiseWindowDialogOpen("accept", REMOVE_DIALOG_URL);
  await ContentTask.spawn(gBrowser.selectedBrowser, {creationDate1, creationDate2}, function(args) {
    let frameDoc = content.gSubDialog._topDialog._frame.contentDocument;

    let siteItems = frameDoc.getElementsByTagName("richlistitem");
    is(siteItems.length, 2, "Should list two sites with cookies");
    let sitesList = frameDoc.getElementById("sitesList");
    let site1 = sitesList.querySelector(`richlistitem[host="example.com"]`);
    let site2 = sitesList.querySelector(`richlistitem[host="example.org"]`);

    let columns = site1.querySelectorAll(".item-box > label");
    is(columns[0].value, "example.com", "Should show the correct host.");
    is(columns[1].value, "2", "Should show the correct number of cookies.");
    is(columns[2].value, "", "Should show no site data.");
    is(columns[3].value, args.creationDate1, "Should show the correct date.");

    columns = site2.querySelectorAll(".item-box > label");
    is(columns[0].value, "example.org", "Should show the correct host.");
    is(columns[1].value, "1", "Should show the correct number of cookies.");
    is(columns[2].value, "", "Should show no site data.");
    is(columns[3].value, args.creationDate2, "Should show the correct date.");

    let removeBtn = frameDoc.getElementById("removeSelected");
    let saveBtn = frameDoc.getElementById("save");
    site2.click();
    removeBtn.doCommand();
    saveBtn.doCommand();
  });
  await removeDialogOpenPromise;

  await TestUtils.waitForCondition(() => Services.cookies.countCookiesFromHost(uri2.host) == 0, "Cookies from the first host should be cleared");
  is(Services.cookies.countCookiesFromHost(uri.host), 2, "Cookies from the second host should not be cleared");

  // Open the site data manager and remove another site.
  await openSiteDataSettingsDialog();
  let acceptRemovePromise = promiseAlertDialogOpen("accept");
  await ContentTask.spawn(gBrowser.selectedBrowser, {creationDate1}, function(args) {
    let frameDoc = content.gSubDialog._topDialog._frame.contentDocument;

    let siteItems = frameDoc.getElementsByTagName("richlistitem");
    is(siteItems.length, 1, "Should list one site with cookies");
    let sitesList = frameDoc.getElementById("sitesList");
    let site1 = sitesList.querySelector(`richlistitem[host="example.com"]`);

    let columns = site1.querySelectorAll(".item-box > label");
    is(columns[0].value, "example.com", "Should show the correct host.");
    is(columns[1].value, "2", "Should show the correct number of cookies.");
    is(columns[2].value, "", "Should show no site data.");
    is(columns[3].value, args.creationDate1, "Should show the correct date.");

    let removeBtn = frameDoc.getElementById("removeSelected");
    let saveBtn = frameDoc.getElementById("save");
    site1.click();
    removeBtn.doCommand();
    saveBtn.doCommand();
  });
  await acceptRemovePromise;

  await TestUtils.waitForCondition(() => Services.cookies.countCookiesFromHost(uri.host) == 0, "Cookies from the second host should be cleared");

  await openSiteDataSettingsDialog();

  ContentTask.spawn(gBrowser.selectedBrowser, null, function() {
    let frameDoc = content.gSubDialog._topDialog._frame.contentDocument;

    let siteItems = frameDoc.getElementsByTagName("richlistitem");
    is(siteItems.length, 0, "Should list no sites with cookies");
  });

  await BrowserTestUtils.removeTab(gBrowser.selectedTab);
});
