/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * Contributor(s): Niko Berger <niko.berger@corinis.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

if(!com) var com={};
if(!com.synckolab) com.synckolab={};


// synckolab interface
com.synckolab.main = {
	
	timer: Components.classes["@mozilla.org/timer;1"].createInstance(Components.interfaces.nsITimer),
	/************************
	 * Global Variables
	 */
	// this is the timer function.. will call itself once a minute and check the configs
	syncConfigs: null,
	forceConfig: null, // per default go through ALL configurations
	doHideWindow: false,

	syncKolabTimer: function ()	{
		this.logMessage = com.synckolab.tools.logMessage;
		
		this.logMessage("sync timer: Checking for tasks", com.synckolab.global.LOG_DEBUG);
		var pref = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);

		// no valid configuration or not yet read... lets see
		if (this.syncConfigs == null || this.syncConfigs.length == 0)
		{
			com.synckolab.tools.logMessage("sync timer: Reading configurations...", com.synckolab.global.LOG_DEBUG);

			// set the debug level
			try {
				
				com.synckolab.config.DEBUG_SYNCKOLAB_LEVEL = com.synckolab.global.LOG_ALL + pref.getIntPref("SyncKolab.debugLevel");
			} catch (ex) {
				com.synckolab.tools.logMessage("WARNING: Reading 'SyncKolab.debugLevel' failed - setting default: " + ex, com.synckolab.global.LOG_WARNING);
				com.synckolab.config.DEBUG_SYNCKOLAB_LEVEL = com.synckolab.global.LOG_ALL + com.synckolab.global.LOG_WARNING;
				pref.setIntPref("SyncKolab.debugLevel", com.synckolab.config.DEBUG_SYNCKOLAB_LEVEL);
			};

			// create a thread for each configuration
			var configs = new Array();
			try {
				var Config = pref.getCharPref("SyncKolab.Configs");
				configs = Config.split(';');
			} catch(ex) {
				com.synckolab.tools.logMessage("ERROR: Reading 'SyncKolab.Configs' failed: " + ex, com.synckolab.global.LOG_ERROR);
			}

			if (configs.length == 0)
			{
				return;
			}
			this.syncConfigs = new Array();
			
			// fill the configs
			for (var i=0; i < configs.length; i++)
			{
				// skip empty congis
				if (configs[i] == '')
					continue;
				this.syncConfigs[i] = new Object;
				this.syncConfigs[i].gSyncTimer = 0;
				try
				{
					this.syncConfigs[i].gAutoRun = pref.getIntPref("SyncKolab."+configs[i]+".autoSync");					
				}catch (ex)
				{
					com.synckolab.tools.logMessage("WARNING: Reading 'SyncKolab."+configs[i]+".autoSync' failed: " + ex, com.synckolab.global.LOG_WARNING);
					this.syncConfigs[i].gAutoRun = 0;
				}

				try
				{
					this.syncConfigs[i].gAutoHideWindow = pref.getBoolPref("SyncKolab."+configs[i]+".hiddenWindow");
				}catch (ex)
				{
					com.synckolab.tools.logMessage("WARNING: Reading 'SyncKolab."+configs[i]+".hiddenWindow' failed: " + ex, com.synckolab.global.LOG_WARNING);
					this.syncConfigs[i].gAutoHideWindow = false;
				}
				this.syncConfigs[i].startOnce = false;
				try
				{
					if(pref.getBoolPref("SyncKolab."+configs[i]+".syncOnStart") == true)
					{
						com.synckolab.tools.logMessage("Run on Startup for "+configs[i], com.synckolab.global.LOG_DEBUG);
						// hide the window 
						this.doHideWindow = this.syncConfigs[i].gAutoHideWindow;
						com.synckolab.main.forceConfig = this.syncConfigs[i].configName;
						com.synckolab.main.sync("timer");
					}
				}catch (ex)
				{
					com.synckolab.tools.logMessage("WARNING: Reading 'SyncKolab."+configs[i]+".syncOnStart' failed: " + ex, com.synckolab.global.LOG_WARNING);
					this.syncConfigs[i].gAutoHideWindow = false;
				}


				this.syncConfigs[i].configName = configs[i];
			}
		}
		else
		// only continue timer if nothing is running right now!
		if (com.synckolab.main.forceConfig == null)
		{
			// go through all configs
			for (var i=0; i < this.syncConfigs.length; i++)
			{
				// re-read the settings
				try
				{
					this.syncConfigs[i].gAutoRun = pref.getIntPref("SyncKolab."+this.syncConfigs[i].configName+".autoSync");
				}catch (ex)
				{
					com.synckolab.tools.logMessage("WARNING: Reading 'SyncKolab."+this.syncConfigs[i].configName+".autoSync' failed: " + ex, com.synckolab.global.LOG_WARNING);
					this.syncConfigs[i].gAutoRun = 0;
				}

				try
				{
					this.syncConfigs[i].gAutoHideWindow = pref.getBoolPref("SyncKolab."+this.syncConfigs[i].configName+".hiddenWindow");
				}catch (ex)
				{
					com.synckolab.tools.logMessage("WARNING: Reading 'SyncKolab."+this.syncConfigs[i].configName+".hiddenWindow' failed: " + ex, com.synckolab.global.LOG_WARNING);
					this.syncConfigs[i].gAutoHideWindow = false;
				}

				com.synckolab.tools.logMessage("synctimer: checking: "+this.syncConfigs[i].configName+" ("+this.syncConfigs[i].gAutoRun+")....", com.synckolab.global.LOG_DEBUG);

				// skip all configurations which dont have autorun
				if (this.syncConfigs[i].gAutoRun == 0)
				{
					continue;
				}
				
				this.syncConfigs[i].gSyncTimer++;
				// lets start (make sure no other auto config is running right now)
				if (this.syncConfigs[i].gSyncTimer >= this.syncConfigs[i].gAutoRun)
				{
					com.synckolab.tools.logMessage("running syncKolab configuration "+this.syncConfigs[i].configName+" ("+this.syncConfigs[i].gAutoRun+")", com.synckolab.global.LOG_INFO);
					this.syncConfigs[i].gSyncTimer = 0;
					// hide the window 
					this.doHideWindow = this.syncConfigs[i].gAutoHideWindow;
					com.synckolab.main.forceConfig = this.syncConfigs[i].configName;
					com.synckolab.main.sync("timer");
					
					// make sure, that we do not start another config right now
					break;
				}
				
			}
		}
		else
			com.synckolab.tools.logMessage("sync with config "+com.synckolab.main.forceConfig +" is still running...", com.synckolab.global.LOG_DEBUG);
		
		// wait a minute
		com.synckolab.tools.logMessage("sync timer: sleep for one minute", com.synckolab.global.LOG_DEBUG);
		com.synckolab.main.timer.initWithCallback({notify:function(){com.synckolab.main.syncKolabTimer();}}, 60000, 0);
	}

};


var groupwareContactFolders = new Array();
var groupwareCalendarFolders = new Array();
var groupwareTaskFolders = new Array();
var groupwareNoteFolders = new Array();
var groupwareConfigs = new Array();

com.synckolab.main.groupwareActions = function () {
	this.logMessage = com.synckolab.tools.logMessage;
	this.logMessage("Starting groupware Actions function", com.synckolab.global.LOG_DEBUG);

   // Grab the selected folder and figure out what the INBOX is so we can switch to that later
	var selected_foldername = gFolderDisplay.displayedFolder.URI;
	var index = selected_foldername.indexOf('INBOX',0);
	var email_account = selected_foldername.substring(0, index);
	var inbox = email_account.concat('INBOX');

	var versionChecker = Components.classes["@mozilla.org/xpcom/version-comparator;1"].getService(Components.interfaces.nsIVersionComparator);  
		
	var currentConfigs = new Array();
	var syncConfigs = new Array();
	var configChanged = 0;
	
	try {
		var syncConfig = pref.getCharPref("SyncKolab.Configs");
		syncConfigs = syncConfig.split(';');
		syncConfigs.sort;
	} catch(ex) {
		com.synckolab.tools.logMessage("ERROR: Reading 'SyncKolab.Configs' failed: " + ex, com.synckolab.global.LOG_ERROR);
		return;
	}
	
	com.synckolab.tools.logMessage("Groupware Actions groupware Configs " + groupwareConfigs.length, com.synckolab.global.LOG_DEBUG);
	com.synckolab.tools.logMessage("Groupware Actions sync Configs " + syncConfigs.length, com.synckolab.global.LOG_DEBUG);

	// Check our previous configs against the current list of configs.
	if (groupwareConfigs.length != (syncConfigs.length - 1)) {
		com.synckolab.tools.logMessage("Groupware Actions configs are not the same length.", com.synckolab.global.LOG_DEBUG);
		configChanged = 1;
	}

	// The length of the configs did not change but the configs themselves might have
	if (!configChanged) {
		// Compare both arrays to make sure the details are the same
		com.synckolab.tools.logMessage("Groupware Actions comparing the config names", com.synckolab.global.LOG_DEBUG);

		for (var i = 0; i < (syncConfigs.length - 1); i++) {
		   com.synckolab.tools.logMessage("Groupware Actions sync config names:" + syncConfigs[i], com.synckolab.global.LOG_DEBUG);
		   com.synckolab.tools.logMessage("Groupware Actions groupware config names:" + groupwareConfigs[i], com.synckolab.global.LOG_DEBUG);
			if (syncConfigs[i] != groupwareConfigs[i]) {
				configChanged = 1;
				break;
			}			
		}
	}

	if (configChanged) {		
		// The configs have changed so we need to check them out
		com.synckolab.tools.logMessage("Groupware Actions the configs have changed", com.synckolab.global.LOG_DEBUG);
		var currentConfig = 0;
		
		// re-initialize groupwareConfigs
		groupwareConfigs.length = 0;
				

		// Loop through the Configs getting all the Contact folder paths.
		for (currentConfig = 0; currentConfig < (syncConfigs.length - 1); currentConfig++) {
			com.synckolab.tools.logMessage("Reading of config in groupwareActions " + syncConfigs[currentConfig], com.synckolab.global.LOG_DEBUG);
			// skip problematic configs :)
			if (syncConfigs[currentConfig].length <= 0) {
				com.synckolab.tools.logMessage("Skipping problem config " + syncConfigs[currentConfig], com.synckolab.global.LOG_DEBUG);
				break;
			} else {

				// We found a valid config so save it.
				groupwareConfigs.push(syncConfigs[currentConfig]);
			
				// initialize the address book
				com.synckolab.AddressBook.init(syncConfigs[currentConfig]);	
				com.synckolab.tools.logMessage("Done Contact init... in groupwareActions", com.synckolab.global.LOG_DEBUG);

				// maybe we do not want to sync contacts in this config
				if (!com.synckolab.AddressBook.gSync) {
					com.synckolab.tools.logMessage("Skipping adressbook config " + syncConfigs[currentConfig], com.synckolab.global.LOG_DEBUG);
				} else {
					groupwareContactFolders.push(com.synckolab.AddressBook.folderPath);
				}

				if (com.synckolab.calendarTools.isCalendarAvailable()) {

					// initialize the Calendar
					com.synckolab.Calendar.init(syncConfigs[currentConfig]);	
					com.synckolab.tools.logMessage("Done Calendar init... in groupwareActions", com.synckolab.global.LOG_DEBUG);

					// maybe we do not want to sync calendar in this config
					if (!com.synckolab.Calendar.gSync) {
						com.synckolab.tools.logMessage("Skipping calendar config " + syncConfigs[currentConfig], com.synckolab.global.LOG_DEBUG);
					} else {
						groupwareCalendarFolders.push(com.synckolab.Calendar.folderPath);
					}
					
					// Now grab the Task configuration
					com.synckolab.Calendar.syncTasks = true;
					com.synckolab.Calendar.init(syncConfigs[currentConfig]);
					if (!com.synckolab.Calendar.gSync) {
						com.synckolab.tools.logMessage("Skipping Task config " + syncConfigs[currentConfig], com.synckolab.global.LOG_DEBUG);
					} else {
						groupwareTaskFolders.push(com.synckolab.Calendar.folderPath);
					}
				}
			}
		}
	} else {
		com.synckolab.tools.logMessage("Configs have not changed" + syncConfigs[currentConfig], com.synckolab.global.LOG_DEBUG);
	}	

	this.logMessage("In groupware Actions function folder name is " + selected_foldername, com.synckolab.global.LOG_DEBUG);
	
	for (var i = 0; i < groupwareContactFolders.length; i++) {
		this.logMessage("In groupware Actions function Contact folder name is " + groupwareContactFolders[i], com.synckolab.global.LOG_DEBUG);
	}

	for (var i = 0; i < groupwareCalendarFolders.length; i++) {
		this.logMessage("In groupware Actions function Calendar folder name is " + groupwareCalendarFolders[i], com.synckolab.global.LOG_DEBUG);
	}	

	for (var i = 0; i < groupwareTaskFolders.length; i++) {
		this.logMessage("In groupware Actions function Task folder name is " + groupwareTaskFolders[i], com.synckolab.global.LOG_DEBUG);
	}	
	
	for (var i = 0; i < groupwareCalendarFolders.length; i++) {
		if (selected_foldername == groupwareCalendarFolders[i]) {
		this.logMessage("In groupware Actions selected Calendar folder", com.synckolab.global.LOG_DEBUG);

			if (versionChecker.compare(Application.version, "3.0b4") >= 0) {
				document.getElementById('tabmail').openTab('calendar', { title: document.getElementById('calendar-tab-button').getAttribute('tooltiptext') });
				SelectFolder(inbox);
			}

			return;
		} else {
		this.logMessage("In groupware Actions did NOT select Calendar folder", com.synckolab.global.LOG_DEBUG);
		}			
	}

	for (var i = 0; i < groupwareTaskFolders.length; i++) {
		if (selected_foldername == groupwareTaskFolders[i]) {
		this.logMessage("In groupware Actions selected Task folder", com.synckolab.global.LOG_DEBUG);

			if (versionChecker.compare(Application.version, "3.0b4") >= 0) {
				document.getElementById('tabmail').openTab('tasks', { title: document.getElementById('task-tab-button').getAttribute('tooltiptext') });
				SelectFolder(inbox);
			}

			return;
		} else {
		this.logMessage("In groupware Actions did NOT select Task folder", com.synckolab.global.LOG_DEBUG);
		}
	}

	for (var i = 0; i < groupwareContactFolders.length; i++) {
		if (selected_foldername == groupwareContactFolders[i]) {
		this.logMessage("In groupware Actions selected Contacts folder", com.synckolab.global.LOG_DEBUG);
			if (versionChecker.compare(Application.version, "3.0b4") >= 0) {
				document.getElementById('tabmail').openTab('contentTab', {contentPage: 'chrome://messenger/content/addressbook/addressbook.xul'});
				SelectFolder(inbox);
			}

			return;
		} else {
		this.logMessage("In groupware Actions did NOT select Contact folder", com.synckolab.global.LOG_DEBUG);
		}
	}

};


/**
 * The main synckolab functions. 
 */

com.synckolab.main.sync =  function (event) 
{


// holds required content
var fileContent; // holds the file content
var lines;	// the file content as lines
var addLines; // an array that saves the added lines one the content
var addLinesNum; // element is where to add the line (Number)

// hold window elements
var meter;	// the progress meter
var totalMeter; // the total progress meter
var statusMsg;	// the status message
var processMsg; // process message
var curCounter;
var itemList; // display all processed items
var gCloseWnd; // true if we want to close the window when sync is done

// sync message db
var syncMessageDb;
var gSyncFileKey;
var gSyncKeyInfo;

// progress variables 
var curStep;

var timer = Components.classes["@mozilla.org/timer;1"].createInstance(Components.interfaces.nsITimer);


/*contains:
{
		gSyncTimer: 0,
		gAutoRun: -1,
		gAutoHideWindow: false,
		configName: null
};
*/
	com.synckolab.global.consoleService.logStringMessage("running synckolab V "+com.synckolab.config.version+" with debug level " + com.synckolab.config.DEBUG_SYNCKOLAB_LEVEL);

  

	// avoid race condition with manual switch (only timer has a this.forceConfig)
	if (com.synckolab.global.running == true)
	{
		com.synckolab.tools.logMessage("Ignoring run - there is already an instance!", com.synckolab.global.LOG_WARNING);
		return;
	}
	
	com.synckolab.global.running = true;

	// in case this wasnt called via timer - its a manual sync
	if (event != "timer")
	{
		com.synckolab.main.forceConfig = "MANUAL-SYNC";
	}
	
	com.synckolab.global.strBundle = document.getElementById("synckolabBundle");

	if (this.doHideWindow)
		com.synckolab.global.wnd = null;
	else
		com.synckolab.global.wnd = window.open("chrome://synckolab/content/progressWindow.xul", "bmarks", "chrome,width=500,height=350,resizable=1");
	
	// remember it global as well
	com.synckolab.global.wnd = com.synckolab.global.wnd;
	
	try {
		var pref = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
		gCloseWnd = pref.getBoolPref("SyncKolab.closeWindow");
		
		try {
			com.synckolab.config.DEBUG_SYNCKOLAB_LEVEL = com.synckolab.global.LOG_ALL + pref.getIntPref("SyncKolab.debugLevel");
		} catch (ex) {
			// maybe it was a String pref
			try {
				com.synckolab.config.DEBUG_SYNCKOLAB_LEVEL = Number(pref.getCharPref("SyncKolab.debugLevel"));
				if (com.synckolab.config.DEBUG_SYNCKOLAB_LEVEL == 'NaN')
				{
					com.synckolab.config.DEBUG_SYNCKOLAB_LEVEL = com.synckolab.global.LOG_ALL + com.synckolab.global.LOG_WARNING;
				}
				// update to int
				pref.clearUserPref("SyncKolab.debugLevel");
				pref.setIntPref("SyncKolab.debugLevel", com.synckolab.config.DEBUG_SYNCKOLAB_LEVEL);
				
			}
			catch (ex) {
				com.synckolab.tools.logMessage("WARNING: Reading 'SyncKolab.debugLevel' failed: " + ex, com.synckolab.global.LOG_WARNING);
				com.synckolab.config.DEBUG_SYNCKOLAB_LEVEL = com.synckolab.global.LOG_ALL + com.synckolab.global.LOG_WARNING;
			}
		};				
	} catch(e) {
		com.synckolab.tools.logMessage("WARNING: Reading 'SyncKolab.closeWindow' failed: " + e, com.synckolab.global.LOG_WARNING);
	}

	com.synckolab.tools.logMessage("Debug Level set to: " + com.synckolab.config.DEBUG_SYNCKOLAB_LEVEL, com.synckolab.global.LOG_WARNING);

	// wait until loaded
	timer.initWithCallback({notify:function(){goWindow(com.synckolab.global.wnd);}}, com.synckolab.config.SWITCH_TIME, 0);
	


function goWindow (wnd)
{
	// wait until the window is loaded
	if (wnd != null)
	{
		var statusMsg1 = wnd.document.getElementById('current-action');
		if (statusMsg1 == null || !statusMsg1)
		{
			timer.initWithCallback({notify:function(){goWindow(wnd);}}, com.synckolab.config.SWITCH_TIME, 0);
			return;
		}
	}

	if (wnd != null)
	{
		// some window elements for displaying the status
		meter = wnd.document.getElementById('progress');
		totalMeter = wnd.document.getElementById('totalProgress');
		statusMsg = wnd.document.getElementById('current-action');
		processMsg = wnd.document.getElementById('current-process');
		curCounter = wnd.document.getElementById('current-counter');
		itemList = wnd.document.getElementById('itemList');
	}
	else
	{
		var sb = document.getElementById("status-bar");


		meter = document.getElementById('progress');
		if (meter == null)
			meter = document.createElement("progressmeter");
		meter.setAttribute("mode", "determined");
		meter.setAttribute("value", "0");
		meter.setAttribute("style", "width:100px");
		meter.setAttribute("id", "progress");

		wnd.gStopSync = false;
		wnd.gPauseSync = false;

		statusMsg = document.getElementById('current-action');		
		if (statusMsg == null)
			statusMsg = document.createElement("statusbarpanel");
		statusMsg.setAttribute("id", "current-action");

		curCounter = document.getElementById('current-counter');		
		if (curCounter == null)
			curCounter = document.createElement("statusbarpanel");
		curCounter.setAttribute("id", "current-counter");
		curCounter.setAttribute("label", "-/-");
		
		sb.appendChild(statusMsg);
		sb.appendChild(meter);
		sb.appendChild(curCounter);
		
		processMsg = null;
		totalMeter = null;
		itemList = null;
	}
	
	if (com.synckolab.calendarTools.isCalendarAvailable())
	{
		com.synckolab.tools.logMessage("Calendar available", com.synckolab.global.LOG_INFO);
	}
	else
		com.synckolab.tools.logMessage("Calendar not available - disabling", com.synckolab.global.LOG_INFO);
	
	timer.initWithCallback({notify:function(){startSync();}}, com.synckolab.config.SWITCH_TIME, 0);
}

var gTmpFile;
var syncConfigs; // the configuration array

var curConConfig; // the current addressbook config
var curCalConfig; // the current calendar config
var curTaskConfig; // the current task config

function startSync(event) {
	
	
	meter.setAttribute("value", "0%");
	if (com.synckolab.global.wnd != null)
		totalMeter.setAttribute("value", "0%");

	// get temp file
	var file = Components.classes["@mozilla.org/file/directory_service;1"].
	   getService(Components.interfaces.nsIProperties).
	   get("TmpD", Components.interfaces.nsIFile);
	file.append("syncKolab.tmp");
	file.createUnique(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 0600);
	gTmpFile = file.path;
	
	syncConfigs = new Array();
	curConConfig = 0;
	curCalConfig = 0;
	curTaskConfig = 0;
	
	try {
		var syncConfig = pref.getCharPref("SyncKolab.Configs");
		syncConfigs = syncConfig.split(';');
	} catch(ex) 
	{
		com.synckolab.tools.logMessage("ERROR: Reading 'SyncKolab.Configs' failed: " + ex, com.synckolab.global.LOG_ERROR);
	}
	
	// called from timer - we force ONE configuration
	if (com.synckolab.main.forceConfig != null && com.synckolab.main.forceConfig != "MANUAL-SYNC")
	{
		syncConfigs = new Array();
		syncConfigs.push(com.synckolab.main.forceConfig);
	}

	
	// all initialized, lets run
	timer.initWithCallback({notify:function(){nextSync();}}, com.synckolab.config.SWITCH_TIME, 0);
}

// this function is called after everything is done
function nextSync()
{

	if (com.synckolab.global.wnd != null)
		totalMeter.setAttribute("value", (((curConConfig+curCalConfig+curTaskConfig)*100)/(syncConfigs.length*3)) +"%");

	if (curConConfig < syncConfigs.length)
	{
		// skip problematic configs :)
		if (syncConfigs[curConConfig].length <= 0)
		{
			curConConfig++;
			timer.initWithCallback({notify:function(){nextSync();}}, com.synckolab.config.SWITCH_TIME, 0);	
			return;
		}

		com.synckolab.tools.logMessage("Trying adressbook config " + syncConfigs[curConConfig], com.synckolab.global.LOG_DEBUG);
		
		if (processMsg != null)
			processMsg.value ="AddressBook Configuration " + syncConfigs[curConConfig];
		// sync the address book
		com.synckolab.AddressBook.init(syncConfigs[curConConfig]);	
		curConConfig++;		
		
		// maybe we do not want to sync contacts in this config
		if (!com.synckolab.AddressBook.gSync)
		{
			com.synckolab.tools.logMessage("Skipping adressbook config " + syncConfigs[curConConfig], com.synckolab.global.LOG_DEBUG);
			timer.initWithCallback({notify:function(){nextSync();}}, com.synckolab.config.SWITCH_TIME, 0);	
			return;
		}
		else
		{
			// get and set the message folder
			com.synckolab.AddressBook.folder = com.synckolab.tools.getMsgFolder(com.synckolab.AddressBook.serverKey, com.synckolab.AddressBook.folderPath);
			com.synckolab.AddressBook.folderMsgURI = com.synckolab.AddressBook.folder.baseMessageURI;
			com.synckolab.AddressBook.email = com.synckolab.tools.getAccountEMail(com.synckolab.AddressBook.serverKey);
			com.synckolab.AddressBook.name = com.synckolab.tools.getAccountName(com.synckolab.AddressBook.serverKey);
						
			// display stuff
			if (com.synckolab.global.wnd != null)
			{
				com.synckolab.AddressBook.itemList = itemList;
				com.synckolab.AddressBook.doc = com.synckolab.global.wnd.document;
			}
			else
			{
				com.synckolab.AddressBook.itemList = null;
				com.synckolab.AddressBook.doc = document;
			}
			
			
			com.synckolab.tools.logMessage("Contacts: got folder: " + com.synckolab.AddressBook.folder.URI + 
				"\nMessage Folder: " + com.synckolab.AddressBook.folderMsgURI, com.synckolab.global.LOG_DEBUG);
				
			// remember the sync class
			gSync = com.synckolab.AddressBook;
				
			timer.initWithCallback({notify:function(){prepareContent();}}, com.synckolab.config.SWITCH_TIME, 0);
		}	
	}
	else
	if (com.synckolab.calendarTools.isCalendarAvailable() && curCalConfig < syncConfigs.length)
	{
		com.synckolab.tools.logMessage("Trying calendar config " + syncConfigs[curCalConfig], com.synckolab.global.LOG_DEBUG);

		// skip problematic configs :)
		if (syncConfigs[curCalConfig].length <= 0)
		{
			curCalConfig++;
			timer.initWithCallback({notify:function(){nextSync();}}, com.synckolab.config.SWITCH_TIME, 0);	
			return;
		}
		//try
		{
		
			if (processMsg != null)
				processMsg.value ="Calendar Configuration " + syncConfigs[curCalConfig];
			// make sure not to sync tasks
			com.synckolab.Calendar.syncTasks = false;
			com.synckolab.Calendar.init(syncConfigs[curCalConfig]);
			
			com.synckolab.tools.logMessage("Done Calendar init...", com.synckolab.global.LOG_DEBUG);

			// maybe we do not want to sync calendar in this config
			if (!com.synckolab.Calendar.gSync)
			{
				com.synckolab.tools.logMessage("Skipping calendar config " + syncConfigs[curCalConfig], com.synckolab.global.LOG_DEBUG);
				curCalConfig++;
				timer.initWithCallback({notify:function(){nextSync(com.synckolab.Calendar);}}, com.synckolab.config.SWITCH_TIME, 0);
				return;
			}
			else
			{
				curCalConfig++;
				com.synckolab.Calendar.folder = com.synckolab.tools.getMsgFolder(com.synckolab.Calendar.serverKey, com.synckolab.Calendar.folderPath);		
				com.synckolab.Calendar.folderMsgURI = com.synckolab.Calendar.folder.baseMessageURI;
				com.synckolab.Calendar.email = com.synckolab.tools.getAccountEMail(com.synckolab.Calendar.serverKey);
				com.synckolab.Calendar.name = com.synckolab.tools.getAccountName(com.synckolab.Calendar.serverKey);
				
				com.synckolab.tools.logMessage("Calendar: getting calendar: " + com.synckolab.Calendar.gCalendar.name + 
						"\nMessage Folder: " + com.synckolab.Calendar.folderMsgURI, com.synckolab.global.LOG_DEBUG);

				// display stuff
				if (com.synckolab.global.wnd != null)
				{
					com.synckolab.Calendar.itemList = itemList;
					com.synckolab.Calendar.doc = com.synckolab.global.wnd.document;
				}
				else
				{
					com.synckolab.Calendar.itemList = null;
					com.synckolab.Calendar.doc = document;
				}
		
				com.synckolab.tools.logMessage("Calendar: got calendar: " + com.synckolab.Calendar.gCalendar.name + 
					"\nMessage Folder: " + com.synckolab.Calendar.folderMsgURI, com.synckolab.global.LOG_DEBUG);

				// remember the sync class
				gSync = com.synckolab.Calendar;
				
				// the init2 does the goon for us		
				com.synckolab.Calendar.init2(prepareContent, com.synckolab.Calendar);

				timer.initWithCallback({notify:function(){prepareContent(com.synckolab.Calendar);}}, com.synckolab.config.SWITCH_TIME, 0);
				return;
			}
		}
		/*
		catch (ex)
		{
			// if an exception is found print it and continue
			com.synckolab.tools.logMessage("Error setting calendar config: " + ex, com.synckolab.global.LOG_ERROR);
			curCalConfig++;
			timer.initWithCallback({notify:function(){nextSync();}}, com.synckolab.config.SWITCH_TIME, 0);	
			return;
		}
		*/
	}
	else
	if (com.synckolab.calendarTools.isCalendarAvailable() && curTaskConfig < syncConfigs.length)
	{

		com.synckolab.tools.logMessage("Trying task config " +curTaskConfig+ ": " + syncConfigs[curTaskConfig], com.synckolab.global.LOG_DEBUG);
		// skip problematic configs :)
		if (syncConfigs[curTaskConfig].length <= 0)
		{
			curTaskConfig++;
			timer.initWithCallback({notify:function(){nextSync();}}, com.synckolab.config.SWITCH_TIME, 0);	
			return;
		}
		
		try
		{
			if (processMsg != null)
				processMsg.value ="Task Configuration " + syncConfigs[curTaskConfig];
			// sync tasks
			com.synckolab.Calendar.syncTasks = true;
			com.synckolab.Calendar.init(syncConfigs[curTaskConfig]);
			curTaskConfig++;
			
			// maybe we do not want to sync calendar in this config
			if (!com.synckolab.Calendar.gSync)
			{
				com.synckolab.tools.logMessage("Skipping task config " + syncConfigs[curTaskConfig], com.synckolab.global.LOG_DEBUG);
				timer.initWithCallback({notify:function(){nextSync(com.synckolab.Calendar);}}, com.synckolab.config.SWITCH_TIME, 0);
				return;
			}
			else
			{		
				com.synckolab.Calendar.folder = com.synckolab.tools.getMsgFolder(com.synckolab.Calendar.serverKey, com.synckolab.Calendar.folderPath);		
				com.synckolab.Calendar.folderMsgURI = com.synckolab.Calendar.folder.baseMessageURI;
				com.synckolab.Calendar.email = com.synckolab.tools.getAccountEMail(com.synckolab.Calendar.serverKey);
				com.synckolab.Calendar.name = com.synckolab.tools.getAccountName(com.synckolab.Calendar.serverKey);
				
		
				// display stuff
				if (com.synckolab.global.wnd != null)
				{
					com.synckolab.Calendar.itemList = itemList;
					com.synckolab.Calendar.doc = com.synckolab.global.wnd.document;
				}
				else
				{
					com.synckolab.Calendar.itemList = null;
					com.synckolab.Calendar.doc = document;
				}
		
				com.synckolab.tools.logMessage("Calendar: got calendar: " + com.synckolab.Calendar.gCalendar.name + 
					"\nMessage Folder: " + com.synckolab.Calendar.folderMsgURI, com.synckolab.global.LOG_DEBUG);

				// remember the sync class
				gSync = com.synckolab.Calendar;

				// the init2 does the goon for us		
				com.synckolab.Calendar.init2(prepareContent, com.synckolab.Calendar);

				timer.initWithCallback({notify:function(){prepareContent(com.synckolab.Calendar);}}, com.synckolab.config.SWITCH_TIME, 0);
				return;
			}
		}
		catch (ex)
		{
			// if an exception is found print it and continue
			com.synckolab.tools.logMessage("Error setting task config: " + ex, com.synckolab.global.LOG_ERROR);
			curTaskConfig++;
			timer.initWithCallback({notify:function(){nextSync();}}, com.synckolab.config.SWITCH_TIME, 0);
			return;
		}
	}
	else //done
	{
		com.synckolab.tools.logMessage("Done syncing resetting" , com.synckolab.global.LOG_DEBUG);
		
		if (com.synckolab.global.wnd != null)
			totalMeter.setAttribute("value", "100%");
		
		meter.setAttribute("value", "100%");
		if (com.synckolab.global.wnd != null)
			statusMsg.value = com.synckolab.global.strBundle.getString("syncfinished");
		else
			statusMsg.setAttribute("label", com.synckolab.global.strBundle.getString("syncfinished"));
		
		if (com.synckolab.global.wnd != null)
			com.synckolab.global.wnd.document.getElementById('cancel-button').label = com.synckolab.global.strBundle.getString("close");
		
		// delete the temp file
		var sfile = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
		sfile.initWithPath(gTmpFile);
		if (sfile.exists()) 
			sfile.remove(true);
			
		// close the status window
		if (gCloseWnd && com.synckolab.global.wnd != null)
			com.synckolab.global.wnd.close();

		// remove all status bar elements
		if (com.synckolab.global.wnd == null)
		{
			var sb = document.getElementById("status-bar");
		
			sb.removeChild(meter);
			sb.removeChild(statusMsg);
			sb.removeChild(curCounter);
		}
		
		// done autorun
		if (com.synckolab.main.forceConfig != null)
		{
			com.synckolab.tools.logMessage("finished autorun of config " + com.synckolab.main.forceConfig, com.synckolab.global.LOG_INFO);
			com.synckolab.main.forceConfig = null;
			this.doHideWindow = false;
		}
		
		// set running state to done
		com.synckolab.global.running = false;
		return;
	}
	
	// Step 3
	if (com.synckolab.global.wnd != null)
	{
		statusMsg.value = com.synckolab.global.strBundle.getString("getContent");
	}
	else
	{
		statusMsg.setAttribute("label", com.synckolab.global.strBundle.getString("getContent"));
	}
	
	meter.setAttribute("value", "5%");
}


// globals for step3
var totalMessages;
var curMessage; 
var gCurMessageKey;
var updateMessages;
var updateMessagesContent;


var gMessages;
var gSync;


function waitForAsyncGetItems () {
	prepareContent();
}


/**
 * this function is being called just before the content parsing starts
 * its sole purpose is to make sure all messages/contacts are downloaded and refreshed
 */
function prepareContent ()
{
	// wait for the data
	if (gSync.dataReady() == false)
	{
		timer.initWithCallback({notify:function(){prepareContent();}}, com.synckolab.config.SWITCH_TIME, 0);
		return;
	}
	// update folder information from imap and make sure we got everything
	gSync.folder.updateFolder (msgWindow);
	// my UrlListener calls getContent
	gSync.folder.compact (syncKolabUrlListener, msgWindow); // this should take care of refreshes
	
}

var gLaterMessages; // for lists - we have to wait until we got everything - then start

/**
 * start with the sync with the sync class
 * saves the contact folder into fileContent
 */
function getContent ()
{	
	// check if folder REALLY exists
	gSync.folder.clearNewMessages ();

	// get the number of messages to go through
	totalMessages = gSync.folder.getTotalMessages(false);
	com.synckolab.tools.logMessage("Have to sync " + totalMessages + " messages for the folder.", com.synckolab.global.LOG_INFO);
	
	// fix bug #16848 and ask before deleting everything :P
	if (totalMessages == 0 && gSync.itemCount() > 0)
	{
		if (window.confirm(com.synckolab.global.strBundle.getString("syncCopyToServer")))
			gSync.forceServerCopy = true;
	}
	else
	if (totalMessages > 0 && gSync.itemCount() == 0)
	{
		if (window.confirm(com.synckolab.global.strBundle.getString("syncCopyToClient")))
			gSync.forceLocalCopy = true;
	}
	
	// prepare empty later list
	gLaterMessages = {};
	gLaterMessages.msgs = new Array();
	gLaterMessages.pointer = 0;
	
	// get the message keys
	if (gSync.folder.getMessages)	
		gMessages = gSync.folder.getMessages(null);	 // dont need the msgWindow use null
	else
		gMessages = gSync.folder.messages; // tbird 3 uses an enumerator property instead of a function
	
	// get the message database (a file with uid:size:date:localfile)
	syncMessageDb = new com.synckolab.dataBase(gSync.dbFile);
		
	curMessage = 0;
	updateMessages = new Array(); // saves the the message url to delete
	updateMessagesContent = new Array(); // saves the card to use to update
	
	if (com.synckolab.global.wnd != null)
		statusMsg.value = com.synckolab.global.strBundle.getString("syncEntries");
	else
		statusMsg.setAttribute("label", com.synckolab.global.strBundle.getString("syncEntries"));
	meter.setAttribute("value", "5%");
	timer.initWithCallback({notify:function(){getMessage();}}, com.synckolab.config.SWITCH_TIME, 0);
}

var gLastMessageDBHdr; // save last message header

// Get the current message into a string and then go to parseMessageRunner
function getMessage ()
{
	// pause sync...
	if (com.synckolab.global.wnd != null && com.synckolab.global.wnd.gPauseSync)
	{
		timer.initWithCallback({notify:function(){getMessage();}}, com.synckolab.config.SWITCH_TIME, 0);
		return;
	}
	
	if (com.synckolab.global.wnd != null && (com.synckolab.global.wnd.document == null || com.synckolab.global.wnd.gStopSync == true))
	{
		alert("Stopped SyncKolab...");
		com.synckolab.global.running = false;
		return;
	}
	
	var cur = null;
	try
	{
		if (gMessages.hasMoreElements () && gLaterMessages.pointer == 0)
			cur = gMessages.getNext().QueryInterface(Components.interfaces.nsIMsgDBHdr);
	}
	catch (ex)
	{
		com.synckolab.tools.logMessage("skipping read of messages - since there are none :)", com.synckolab.global.LOG_INFO);
		updateContentAfterSave ();
		return;
	}

	var laterMsg = null;
	
	// get the messages we skipped
	if (cur == null)
	{
		if (gLaterMessages.pointer >= gLaterMessages.msgs.length)
		{
			gLaterMessages.msgs = new Array();
			// done with messages go on...
			parseFolderToAddressFinish ();
			return;
		}

		com.synckolab.tools.logMessage("msg:" + gLaterMessages.pointer + " vs. " + gLaterMessages.msgs.length, com.synckolab.global.LOG_INFO);

		laterMsg = gLaterMessages.msgs[gLaterMessages.pointer++];
		cur = laterMsg.hdr;
	}
	else
	{
		// check message flags (based on mailnews\base\public\nsMsgMessageFlags.h -> deleted=0x200000
		com.synckolab.tools.logMessage("Message " + cur.mime2DecodedSubject + " (dateInSeconds: " + cur.dateInSeconds + ") has flags: " + cur.flags + " flag imap_deleted? " + (cur.flags&0x200000), com.synckolab.global.LOG_DEBUG);
		var skipCMessage = false;
		
		if (cur.flags&0x200000)
		{
			com.synckolab.tools.logMessage("Message " + cur.mime2DecodedSubject + " has been DELETED on imap!", com.synckolab.global.LOG_INFO);
			// skip current and process next nessage	
			skipCMessage = true;
			
		}
		
		// check if we can ignore this message because its too old (0=take all into accout)	
		if(gSync.gSyncTimeFrame > 0 && skipCMessage != true)
		{
			com.synckolab.tools.logMessage("Checking if message might be too old for now " + (new Date()).getTime(), com.synckolab.global.LOG_DEBUG);
	
			// now get the correct startdate (convert in milliseconds)
			if ((cur.dateInSeconds + (gSync.gSyncTimeFrame * 86400))*1000 < (new Date()).getTime())
			{
				com.synckolab.tools.logMessage("Message " + cur.mime2DecodedSubject + " will be ignored (too old) Now: " + (new Date()).getTime(), com.synckolab.global.LOG_INFO);
				// skip current and process next nessage	
				skipCMessage = true;
			}
		}
		
		
		if (skipCMessage == true)
		{
			curMessage++;
			if (curMessage <= totalMessages)
			{
				var curpointer = 5 + (55*(curMessage/totalMessages));
				meter.setAttribute("value", curpointer + "%");
				if (com.synckolab.global.wnd != null)
					curCounter.setAttribute("value", curMessage + "/" + totalMessages);
				else
					curCounter.setAttribute("label", curMessage + "/" + totalMessages);
				
				// next message
				timer.initWithCallback({notify:function(){getMessage();}}, com.synckolab.config.SWITCH_TIME, 0);
			}
			else
			{
				timer.initWithCallback({notify:function(){parseFolderToAddressFinish();}}, com.synckolab.config.SWITCH_TIME, 0);
			}
			return;
		}
	} // this part only for the first run
	
	// check if we actually have to process this message, or if this is already known
	
	/*
	 check based on:
	 key:
	 cur.messageKey ?
	 cur.messageId  ?
	 mime2DecodedSubject ?

	 check if equals:
	 cur.messageSize 
	 cur.date (PRTime) ?
	*/
	gLastMessageDBHdr = cur;
	gSyncFileKey = syncMessageDb.get(cur.mime2DecodedSubject);
	
	gSyncKeyInfo = cur.mime2DecodedSubject;
	if (laterMsg != null) {
		com.synckolab.tools.logMessage("getting " + cur.mime2DecodedSubject + " from fist round...", com.synckolab.global.LOG_DEBUG);
		fileContent = laterMsg.content;
		gSyncFileKey = laterMsg.fileKey;
		parseMessageRunner ();
		return;
	}
	else
	if (gSyncFileKey != null)
	{
		com.synckolab.tools.logMessage("we have " + cur.mime2DecodedSubject + " already locally...", com.synckolab.global.LOG_DEBUG);
		// check if the message has changed
		if (cur.messageSize == gSyncFileKey[1] && cur.date == gSyncFileKey[2])
		{
			// get the content from the cached file and ignore the imap
			com.synckolab.tools.logMessage("taking content from: " + gSyncFileKey[3] + "/" + gSyncFileKey[4], com.synckolab.global.LOG_DEBUG);
			fileContent = com.synckolab.tools.readSyncDBFile(com.synckolab.tools.file.getSyncDbFile(gSyncFileKey[3], gSync.getType(), gSyncFileKey[4]));

			// make sure we dont read an empty file
			if (fileContent != null && fileContent != "")
			{
				parseMessageRunner ();
				return;
			}
		}
		else
		{
			// some change happened... remove this entry (+ some update :P )
			syncMessageDb.remove(gSyncFileKey);
			
			// new netry
			// remember the info
			gSyncFileKey = {}; // we not yet know the id
			gSyncFileKey[0] = '';
			gSyncFileKey[1] = cur.messageSize;
			gSyncFileKey[2] = cur.date;
			
		}
	}
	else
	{
		// remember the info
		gSyncFileKey = {}; // we not yet know the id
		gSyncFileKey[0] = '';
		gSyncFileKey[1] = cur.messageSize;
		gSyncFileKey[2] = cur.date;
	}
	
	
	// get the message content into fileContent
	// parseMessageRunner is called when we got the message
	fileContent = "";
	gCurMessageKey = cur.messageKey;
	var aurl = new Object();
	com.synckolab.global.messageService.CopyMessage(
        gSync.folderMsgURI +"#"+gCurMessageKey,
        syncKolabStreamListener, false, null, msgWindow, aurl
        );
}

var syncKolabUrlListener = {
	OnStartRunningUrl: function ( url )
	{	
	},
	
	OnStopRunningUrl: function ( url, exitCode )
	{	
		com.synckolab.tools.logMessage("Finished folder frefresh; ONSTOP="+exitCode+" : " + url, com.synckolab.global.LOG_DEBUG );
		getContent();
	}
};

// nsIStreamListener
var syncKolabStreamListener = {
	onDataAvailable: function(request, context, inputStream, offset, count){
		try
		{
			var sis=Components.classes["@mozilla.org/scriptableinputstream;1"].createInstance(Components.interfaces.nsIScriptableInputStream);
			sis.init(inputStream);
			fileContent += sis.read(count);
		}
		catch(ex)
		{
			alert("exception caught: "+ex.message+"\n");
		}
	},
	onStartRequest: function(request, context) {
	},
	onStopRequest: function(aRequest, aContext, aStatusCode) {
		com.synckolab.tools.logMessage("got Message [" + gSync.folderMsgURI +"#"+gCurMessageKey + "]:\n" + fileContent, com.synckolab.global.LOG_DEBUG);

		// remove the header of the content
		fileContent = com.synckolab.tools.stripMailHeader(fileContent);

		parseMessageRunner ();
	}
};

/**
 * we now got the message content. this needs to parsed and checked 
 */
function parseMessageRunner ()
{
	// pause sync...
	if (com.synckolab.global.wnd != null && com.synckolab.global.wnd.gPauseSync)
	{
		timer.initWithCallback({notify:function(){parseMessageRunner();}}, com.synckolab.config.SWITCH_TIME, 0);
		return;
	}
	
	if (com.synckolab.global.wnd != null && (com.synckolab.global.wnd.document == null || com.synckolab.global.wnd.gStopSync == true))
	{
		alert("Stopped SyncKolab...");
		com.synckolab.global.running = false;
		return;
	}

	
	com.synckolab.tools.logMessage("parsing message... ", com.synckolab.global.LOG_DEBUG);
	
	// fix the message for line truncs (last char in line is =)
	fileContent = fileContent.replace(/=\n(\S)/g, "$1");
	
	var content = null;

	content = gSync.parseMessage(fileContent, updateMessagesContent, (gLaterMessages.pointer == 0));
	
	
	if (content == "LATER") {
		var cMsg = {};
		cMsg.content = fileContent;
		cMsg.hdr = gLastMessageDBHdr;
		cMsg.fileKey = gSyncFileKey;
//		cMsg.messageKey = gCurMessageKey;
		gLaterMessages.msgs.push(cMsg);
	}
	else {
		// just to make sure there REALLY isnt any content left :)
		fileContent = "";
		if (content != null)
		{
			if (content == "DELETEME")
				com.synckolab.tools.logMessage("updating and/or deleting [" + gSync.folderMsgURI +"#"+gCurMessageKey + "]", com.synckolab.global.LOG_INFO);
			else
				com.synckolab.tools.logMessage("updating [" + gSync.folderMsgURI +"#"+gCurMessageKey + "]", com.synckolab.global.LOG_INFO);
			// adding message to list of to-delete messages - gSync.folderMsgURI +"#"+
			updateMessages.push(gLastMessageDBHdr); 
			updateMessagesContent.push(content); 
			com.synckolab.tools.logMessage("changed msg #" + updateMessages.length, com.synckolab.global.LOG_INFO);
		}
		// no change... remember that :)
		else
		{
			// fill info about the file and re-add it 
			gSyncFileKey[0] = gSyncKeyInfo;
			gSyncFileKey[3] = gSync.gConfig;
			gSyncFileKey[4] = gSync.gCurUID;
			// Add the key
			syncMessageDb.add(gSyncFileKey);
		}
	}
	
	// process next nessage	
	curMessage++;
	if (curMessage <= totalMessages || gLaterMessages.pointer < gLaterMessages.msgs.length)
	{
		var curpointer = 5 + (55*((curMessage + gLaterMessages.pointer)/(totalMessages + gLaterMessages.msgs.length)));
		meter.setAttribute("value", curpointer + "%");

		curCounter.setAttribute((com.synckolab.global.wnd != null)?"value":"label", (curMessage + gLaterMessages.pointer) + "/" + (totalMessages + gLaterMessages.msgs.length));

		if (curMessage%20 == 0)
		{
			// save the sync db file every 20 messages.. should speed up sync if canceled
			com.synckolab.tools.logMessage("Writing message snyc-db", com.synckolab.global.LOG_DEBUG);
			
			// write the db file back
			syncMessageDb.write();
		}
				
		// next message
		timer.initWithCallback({notify:function(){getMessage();}}, com.synckolab.config.SWITCH_TIME, 0);
	}
	else
	{
		timer.initWithCallback({notify:function(){parseFolderToAddressFinish();}}, com.synckolab.config.SWITCH_TIME, 0);
	}
}


var cards;
var writeDone;

function parseFolderToAddressFinish ()
{
	// do step 5
	curStep = 5;
	writeDone = false;
	com.synckolab.tools.logMessage("parseFolderToAddressFinish (Writing message db)", com.synckolab.global.LOG_DEBUG);
	
	// write the db file back
	syncMessageDb.write();

	meter.setAttribute("value", "60%");
	if (com.synckolab.global.wnd != null)
	{
		statusMsg.value = com.synckolab.global.strBundle.getString("writeChangedEntries");
		curCounter.setAttribute("value", "0/0");
	}
	else
	{
		statusMsg.setAttribute("label", com.synckolab.global.strBundle.getString("writeChangedEntries"));
		curCounter.setAttribute("label", "0/0");
	}
	
	
	timer.initWithCallback({notify:function(){updateContent();}}, com.synckolab.config.SWITCH_TIME, 0);
}


/* Remove all messages which needs to be updated or deleted.
 * The replacement messages are created in updateContentWrite().
 */
function updateContent()
{
	// pause sync...
	if (com.synckolab.global.wnd != null && com.synckolab.global.wnd.gPauseSync)
	{
		timer.initWithCallback({notify:function(){updateContent();}}, com.synckolab.config.SWITCH_TIME, 0);
		return;
	}
		
	if (com.synckolab.global.wnd != null && (com.synckolab.global.wnd.document == null || com.synckolab.global.wnd.gStopSync == true))
	{
		alert("Stopped SyncKolab...");
		com.synckolab.global.running = false;
		return;
	}
	
	com.synckolab.tools.logMessage("updating content:", com.synckolab.global.LOG_DEBUG);
	// first lets delete the old messages
	if (gSync.gSaveImap && updateMessages.length > 0) 
	{
		try
		{
			com.synckolab.tools.logMessage("deleting changed messages..", com.synckolab.global.LOG_INFO);
			
			var list = null;
			// tbird 3 uses mutablearray
			if (com.synckolab.global.isTbird3)
			{
				list = Components.classes["@mozilla.org/array;1"].createInstance(Components.interfaces.nsIMutableArray);
				for (var i = 0; i < updateMessages.length; i++)
				{
					com.synckolab.tools.logMessage("deleting [" + updateMessages[i] + "]");
					//var hdr = com.synckolab.global.messageService.messageURIToMsgHdr(updateMessages[i]);
					list.appendElement(updateMessages[i], false);	
				}
				gSync.folder.deleteMessages (list, msgWindow, true, false, null, true);
			}
			else
			{
				list = Components.classes["@mozilla.org/supports-array;1"].createInstance(Components.interfaces.nsISupportsArray);
				for (var i = 0; i < updateMessages.length; i++)
				{
					com.synckolab.tools.logMessage("deleting [" + updateMessages[i] + "]");
					//var hdr = com.synckolab.global.messageService.messageURIToMsgHdr(updateMessages[i]);
					list.AppendElement(updateMessages[i]);	
				}
				gSync.folder.deleteMessages (list, msgWindow, true, false, null, true);
			}
		}
		catch (ex)
		{
			com.synckolab.tools.logMessage("Exception while deleting - skipping: " + ex, com.synckolab.global.LOG_ERROR);
		}
	}
	curMessage = -1;
	// now write the new ones
	timer.initWithCallback({notify:function(){updateContentWrite();}}, com.synckolab.config.SWITCH_TIME, 0);
}

/* Write all changed messages back to the folder. Skip
 * the messages which were to be deleted from the server.
 */
function updateContentWrite ()
{
	// pause sync...
	if (com.synckolab.global.wnd != null && com.synckolab.global.wnd.gPauseSync)
	{
		timer.initWithCallback({notify:function(){updateContentWrite();}}, com.synckolab.config.SWITCH_TIME, 0);
		return;
	}
		
	if (com.synckolab.global.wnd != null && (com.synckolab.global.wnd.document == null || com.synckolab.global.wnd.gStopSync == true))
	{
		alert("Stopped SyncKolab...");
		com.synckolab.global.running = false;
		return;
	}
	curCounter.setAttribute("value", curMessage + "/" + updateMessagesContent.length);

	curMessage++;
	if (curMessage < updateMessagesContent.length)
	{
		var content = updateMessagesContent[curMessage];
		// write the message
		if (gSync.gSaveImap && content != "DELETEME" && content != null && content.length > 1)
		{
			// write the message in the temp file
			var sfile = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
			com.synckolab.tools.logMessage("adding [" + content + "] to messages", com.synckolab.global.LOG_DEBUG);
			// temp path
			sfile.initWithPath(gTmpFile);
			if (sfile.exists()) 
				sfile.remove(true);
			sfile.create(sfile.NORMAL_FILE_TYPE, 0600);
		
			// make the message rfc compatible (make sure all lines en with \r\n)
			content = content.replace(/\r\n|\n|\r/g, "\r\n");
			
			// create a new message in there
			var stream = Components.classes['@mozilla.org/network/file-output-stream;1'].createInstance(Components.interfaces.nsIFileOutputStream);
			stream.init(sfile, 2, 0x200, false); // open as "write only"
			stream.write(content, content.length);
			stream.close();
			
			// write the temp file back to the original directory
			copyToFolder (gTmpFile, gSync.folder); 
		}
		else
			updateContentWrite ();
	}
	else
		updateContentAfterSave ();
	
}

function updateContentAfterSave ()
{
	com.synckolab.tools.logMessage("starting update content...", com.synckolab.global.LOG_INFO);
	curStep = 6;
	writeDone = false;
	
	if (!gSync.initUpdate())
	{
		com.synckolab.tools.logMessage("Nothing there to update...", com.synckolab.global.LOG_INFO);
		writeContentAfterSave ();
	}

	meter.setAttribute("value", "80%");
	if (com.synckolab.global.wnd != null)
	{
		statusMsg.value = com.synckolab.global.strBundle.getString("writeNewEntries");
		curCounter.setAttribute("value", "...");
	}
	else
	{
		statusMsg.setAttribute("label", com.synckolab.global.strBundle.getString("writeNewEntries"));
		curCounter.setAttribute("label", "...");
	}
	
	timer.initWithCallback({notify:function(){writeContent();}}, com.synckolab.config.SWITCH_TIME, 0);
}

// Step 6  10%
// write everything thats not yet in the message folder but is in the local db
function writeContent ()
{
	// pause sync...
	if (com.synckolab.global.wnd != null && com.synckolab.global.wnd.gPauseSync)
	{
		timer.initWithCallback({notify:function(){writeContent();}}, com.synckolab.config.SWITCH_TIME, 0);
		return;
	}
		
	if (com.synckolab.global.wnd != null && (com.synckolab.global.wnd.document == null || com.synckolab.global.wnd.gStopSync == true))
	{
		alert("Stopped SyncKolab...");
		com.synckolab.global.running = false;
		return;
	}
	
	// if there happens an exception, we are done
	var content = gSync.nextUpdate();
	if (content == "done")
	{
		com.synckolab.tools.logMessage("content is 'done'", com.synckolab.global.LOG_INFO);
		writeContentAfterSave ();
		return;
	}
	
	if (content == null)
	{
		com.synckolab.tools.logMessage("content is null - continue", com.synckolab.global.LOG_WARNING);
		timer.initWithCallback({notify:function(){writeContent();}}, com.synckolab.config.SWITCH_TIME, 0);
		return;
	}
	
	if (gSync.gSaveImap)
	{
		// write the message in the temp file
		var sfile = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
		// temp path
		sfile.initWithPath(gTmpFile);
		if (sfile.exists()) 
			sfile.remove(true);
		sfile.create(sfile.NORMAL_FILE_TYPE, 0600);
	
		// make the message rfc compatible (make sure all lines en with \r\n)
		content = content.replace(/\r\n|\n\r|\n|\r/g, "\r\n");

		// create a new message in there
	 	var stream = Components.classes['@mozilla.org/network/file-output-stream;1'].createInstance(Components.interfaces.nsIFileOutputStream);
	 	stream.init(sfile, 2, 0x200, false); // open as "write only"
		stream.write(content, content.length);
		stream.close();
		
		// write the temp file back to the original directory
		com.synckolab.tools.logMessage("WriteContent Writing...", com.synckolab.global.LOG_INFO);
		copyToFolder (gTmpFile, gSync.folder); 
	}
	else
		writeContentAfterSave ();

}


// done this time
function writeContentAfterSave ()
{
	// pause sync...
	if (com.synckolab.global.wnd != null && com.synckolab.global.wnd.gPauseSync)
	{
		timer.initWithCallback({notify:function(){writeContentAfterSave();}}, com.synckolab.config.SWITCH_TIME, 0);
		return;
	}
	
	if (com.synckolab.global.wnd != null && (com.synckolab.global.wnd.document == null || com.synckolab.global.wnd.gStopSync == true))
	{
		alert("Stopped SyncKolab...");
		com.synckolab.global.running = false;
		return;
	}
	
	com.synckolab.tools.logMessage("Setting all messages to read...", com.synckolab.global.LOG_INFO);
	// before done, set all unread messages to read in the sync folder
	if (gSync.folder.getMessages)
	{
		com.synckolab.global.isTbird3 = false;
		gMessages = gSync.folder.getMessages(msgWindow);
	}
	else
	{
		com.synckolab.global.isTbird3 = true;
		gMessages = gSync.folder.messages; // tbird 3 uses an enumerator property instead of a function
	}

	while (gMessages.hasMoreElements ())
	{
		cur = gMessages.getNext().QueryInterface(Components.interfaces.nsIMsgDBHdr);
		if (!cur.isRead)
		{
			cur.markRead(true);
		}
	}	
	gMessages = null;
	

	com.synckolab.tools.logMessage("Running compact", com.synckolab.global.LOG_INFO);
	timer.initWithCallback({notify:function(){syncKolabCompact();}}, 2000, 0); // wait for a second or two
}

function syncKolabCompact() {
	// compact folder
	try { 
		gSync.folder.compact(null, null);  
	} catch(e) {
		com.synckolab.tools.logMessage("ERROR: Running compact: " + e, com.synckolab.global.LOG_ERROR);
	}
	
	gSync.doneParsing();
	com.synckolab.tools.logMessage("nextSync", com.synckolab.global.LOG_INFO);
	timer.initWithCallback({notify:function(){nextSync();}}, com.synckolab.config.SWITCH_TIME, 0);	
}


/**
 * Copies a local file into any mail folder.
 * In order to be displayed correct, make sure to create a complete message file!!!
 * fileName string - the file to copy(+path)
 * folderUri string - the Uri/Url of the folder we want this in
 */
function copyToFolder (fileName, folderUri)
{
	var mailFolder = folderUri;
	var fileSpec;
	if (Components.interfaces.nsIFileSpec)
	{
		fileSpec = Components.classes["@mozilla.org/filespec;1"].createInstance(Components.interfaces.nsIFileSpec);	
		fileSpec.nativePath = fileName;

		// at this pont, check the content, we do not write a load of bogus messages in the imap folder
		copyservice = Components.classes["@mozilla.org/messenger/messagecopyservice;1"].getService(Components.interfaces.nsIMsgCopyService);
		// in order to be able to REALLY copy the message setup a listener
		// and mark as read
		copyservice.CopyFileMessage(fileSpec, mailFolder, null, false, 0x000001, kolabCopyServiceListener, null); // dont need a msg window
	}
	else
	//tbird 3
	{
		fileSpec = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
		//alert("file: " + fileName);
		fileSpec.initWithPath(fileName);

		// at this pont, check the content, we do not write a load of bogus messages in the imap folder
		//alert ("File content:" + fileSpec.fileContents);
		
		copyservice = Components.classes["@mozilla.org/messenger/messagecopyservice;1"].getService(Components.interfaces.nsIMsgCopyService);
		// in order to be able to REALLY copy the message setup a listener
		// and mark as read
		copyservice.CopyFileMessage(fileSpec, mailFolder, null, false, 0x000001, null, kolabCopyServiceListener, null); // dont need a msg window
	}

}

var kolabCopyServiceListener = {
	OnProgress: function(progress, progressMax) { 
	},
	OnStartCopy: function() { 
	},
	SetMessageKey: function(key) { 
	},
	OnStopCopy: function(status) {
		if (curStep == 5)
			timer.initWithCallback({notify:function(){updateContentWrite();}}, com.synckolab.config.SWITCH_TIME, 0);
		if (curStep == 6)
			timer.initWithCallback({notify:function(){writeContent();}}, com.synckolab.config.SWITCH_TIME, 0);
	}
};



};

