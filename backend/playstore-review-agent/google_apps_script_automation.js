/**
 * ==============================================================================
 * NOVAIRA V2 - GOOGLE APPS SCRIPT CLOUD EXCEL & CRON AUTOMATION
 * ==============================================================================
 * PURPOSE:
 * 1. Automatically receives Play Store reviews from the Novaira backend.
 * 2. Creates Google Sheets organized neatly in Google Drive:
 *    My Drive > REVIEW_EXCELS > YYYY > MM > DD > [Task #1645] Pepperfry - Reviews (11-11-2026)
 * 3. Sets Google Sheet permission to PUBLIC ("Anyone with the link can view").
 * 4. Runs an automated daily Cron Trigger at 8:00 PM IST (Asia/Kolkata)
 *    that calls the Novaira Backend Trigger API to process all of today's live apps.
 *
 * HOW TO DEPLOY:
 * 1. Go to https://script.google.com and click "New Project".
 * 2. Paste this entire code into `Code.gs`.
 * 3. Update NOVAIRA_BACKEND_URL below (default is https://admin-v2-backend.onrender.com).
 * 4. Click "Deploy" > "New deployment" > Select type "Web app".
 *    - Description: "Novaira Live Review Sheets Automation"
 *    - Execute as: "Me"
 *    - Who has access: "Anyone"
 * 5. Click "Deploy", authorize permissions, and copy the Web App URL.
 * 6. (Optional) Run `setupDaily8pmTrigger()` once inside the Apps Script editor to activate the 8:00 PM IST daily cron!
 * ==============================================================================
 */

// Replace with your active backend URL (Render production or ngrok / cloud server)
var NOVAIRA_BACKEND_URL = "https://admin-v2-backend.onrender.com";
var ADMIN_API_KEY = "Novaira002@#";

/**
 * Handle POST requests from Novaira Backend to create a public Google Sheet
 */
function doPost(e) {
  try {
    var rawData = e.postData ? e.postData.contents : "{}";
    var payload = JSON.parse(rawData);
    var action = payload.action || "create_sheet";

    if (action === "create_sheet") {
      var result = createLiveAppGoogleSheet(payload);
      return ContentService.createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    } else if (action === "trigger_daily_extraction") {
      var cronResult = runDailyTriggerJob();
      return ContentService.createTextOutput(JSON.stringify(cronResult))
        .setMimeType(ContentService.MimeType.JSON);
    } else {
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Unknown action" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Handle GET requests for testing or triggering
 */
function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "status";
  
  if (action === "trigger") {
    var cronResult = runDailyTriggerJob();
    return ContentService.createTextOutput(JSON.stringify(cronResult))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService.createTextOutput(JSON.stringify({
    status: "online",
    service: "Novaira Google Sheets Cloud Automation",
    timezone: "Asia/Kolkata",
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

function parseAppDate(dateStr) {
  if (!dateStr) return new Date();
  
  // Clean string
  var s = String(dateStr).trim();
  
  // Try YYYY-MM-DD or YYYY/MM/DD
  var isoMatch = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (isoMatch) {
    return new Date(parseInt(isoMatch[1], 10), parseInt(isoMatch[2], 10) - 1, parseInt(isoMatch[3], 10));
  }
  
  // Try DD-MM-YYYY or DD/MM/YYYY
  var ddmmyyyyMatch = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (ddmmyyyyMatch) {
    return new Date(parseInt(ddmmyyyyMatch[3], 10), parseInt(ddmmyyyyMatch[2], 10) - 1, parseInt(ddmmyyyyMatch[1], 10));
  }
  
  var parsed = new Date(s);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

/**
 * Creates or retrieves nested folder in Google Drive:
 * REVIEW_EXCELS / {YEAR} / {MONTH} / {DAY}
 * (Year, Month, Day correspond to the App's Release Date / app_date)
 */
function getOrCreateReviewFolder(dateObj) {
  var year = Utilities.formatDate(dateObj, "Asia/Kolkata", "yyyy");
  var month = Utilities.formatDate(dateObj, "Asia/Kolkata", "MM");
  var day = Utilities.formatDate(dateObj, "Asia/Kolkata", "dd");

  var rootFolderName = "REVIEW_EXCELS";
  var rootFolders = DriveApp.getFoldersByName(rootFolderName);
  var rootFolder = rootFolders.hasNext() ? rootFolders.next() : DriveApp.createFolder(rootFolderName);

  // Year folder
  var yearFolders = rootFolder.getFoldersByName(year);
  var yearFolder = yearFolders.hasNext() ? yearFolders.next() : rootFolder.createFolder(year);

  // Month folder
  var monthFolders = yearFolder.getFoldersByName(month);
  var monthFolder = monthFolders.hasNext() ? monthFolders.next() : yearFolder.createFolder(month);

  // Day folder
  var dayFolders = monthFolder.getFoldersByName(day);
  var dayFolder = dayFolders.hasNext() ? dayFolders.next() : monthFolder.createFolder(day);

  return dayFolder;
}

/**
 * Creates Google Spreadsheet for a given app's reviews and sets public view access
 */
function createLiveAppGoogleSheet(payload) {
  var taskId = payload.task_id || "0";
  var appName = payload.app_name || "Application";
  var appPackage = payload.app_package || "";
  var releaseDateStr = payload.app_date || "";
  var liveDateStr = payload.live_checking_date || Utilities.formatDate(new Date(), "Asia/Kolkata", "yyyy-MM-dd");
  var reviews = payload.reviews || [];

  // Important: Folder & File hierarchy is based strictly on App Release Date (app_date)
  var appReleaseDateObj = parseAppDate(releaseDateStr);
  var formattedAppDate = Utilities.formatDate(appReleaseDateObj, "Asia/Kolkata", "dd-MM-yyyy");
  var sheetTitle = "[Task #" + taskId + "] " + appName + " - Reviews (" + formattedAppDate + ")";

  // 1. Get destination folder in Drive matching App's Release Date: REVIEW_EXCELS / YYYY / MM / DD
  var targetFolder = getOrCreateReviewFolder(appReleaseDateObj);

  // 2. Create Spreadsheet
  var ss = SpreadsheetApp.create(sheetTitle);
  var sheet = ss.getActiveSheet();
  sheet.setName("Reviews");

  // Format Header Row
  var headers = [
    "Reviewer Name", 
    "Rating", 
    "Review Content", 
    "Helpful Votes", 
    "Review Date & Time", 
    "Country", 
    "Language"
  ];
  sheet.appendRow(headers);

  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground("#1a73e8");
  headerRange.setFontColor("#ffffff");
  headerRange.setFontWeight("bold");
  headerRange.setHorizontalAlignment("center");

  // Format Data Rows
  if (reviews && reviews.length > 0) {
    var rows = [];
    for (var i = 0; i < reviews.length; i++) {
      var r = reviews[i];
      rows.push([
        r.userName || "Anonymous",
        r.rating || 5,
        r.content || "",
        r.thumbsUpCount || 0,
        r.at || "",
        r.country || "IN",
        r.language || "en"
      ]);
    }
    
    // Batch append
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);

    // Center align rating, votes, country, date
    sheet.getRange(2, 2, rows.length, 1).setHorizontalAlignment("center");
    sheet.getRange(2, 4, rows.length, 1).setHorizontalAlignment("center");
    sheet.getRange(2, 5, rows.length, 1).setHorizontalAlignment("center");
    sheet.getRange(2, 6, rows.length, 2).setHorizontalAlignment("center");
  }

  // Auto-resize columns
  for (var col = 1; col <= headers.length; col++) {
    sheet.autoResizeColumn(col);
  }
  // Keep content column wide
  sheet.setColumnWidth(3, 450);

  SpreadsheetApp.flush();

  // 3. Move file into the structured Drive folder
  var file = DriveApp.getFileById(ss.getId());
  targetFolder.addFile(file);
  DriveApp.getRootFolder().removeFile(file);

  // 4. Set Public Viewing Permissions
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  var publicUrl = ss.getUrl();

  return {
    status: "success",
    task_id: taskId,
    app_name: appName,
    app_package: appPackage,
    total_reviews: reviews.length,
    spreadsheet_id: ss.getId(),
    sheet_url: publicUrl,
    folder_path: "REVIEW_EXCELS/" + Utilities.formatDate(appReleaseDateObj, "Asia/Kolkata", "yyyy/MM/dd")
  };
}

/**
 * Automation Cron Trigger: Calls Novaira Backend to run daily extraction at 8:00 PM IST
 */
function runDailyTriggerJob() {
  var url = NOVAIRA_BACKEND_URL + "/api/live-sheets/trigger-extraction";
  var options = {
    method: "post",
    contentType: "application/json",
    headers: {
      "x-admin-key": ADMIN_API_KEY,
      "Authorization": "Bearer " + ADMIN_API_KEY
    },
    payload: JSON.stringify({
      triggered_by: "GoogleAppsScript_8PM_Cron",
      timestamp: new Date().toISOString()
    }),
    muteHttpExceptions: true
  };

  try {
    var response = UrlFetchApp.fetch(url, options);
    var responseText = response.getContentText();
    Logger.log("Cron response: " + responseText);
    return { status: "success", backend_response: responseText };
  } catch (e) {
    Logger.log("Cron execution error: " + e.toString());
    return { status: "error", error: e.toString() };
  }
}

/**
 * Setup Daily 8:00 PM IST Trigger
 * Run this function once in Apps Script to set up the 8:00 PM daily schedule
 */
function setupDaily8pmTrigger() {
  // Delete existing triggers
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "runDailyTriggerJob") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  // Create new daily trigger at 20:00 (8:00 PM) in Asia/Kolkata timezone
  ScriptApp.newTrigger("runDailyTriggerJob")
    .timeBased()
    .everyDays(1)
    .atHour(20)
    .nearMinute(0)
    .inTimezone("Asia/Kolkata")
    .create();

  Logger.log("Successfully created daily 8:00 PM IST trigger for runDailyTriggerJob!");
}
