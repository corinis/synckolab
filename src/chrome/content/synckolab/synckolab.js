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
 * Copyright (c) Niko Berger  2005-2012
 * Copyright (c) Kolab Systems 2012
 * Author: Niko Berger <niko.berger(at)corinis.com>
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
"use strict";
if(!synckolab) var synckolab={};


//synckolab interface
synckolab.main = {
	timer: Components.classes["@mozilla.org/timer;1"].createInstance(Components.interfaces.nsITimer),
	backgroundTimer: Components.classes["@mozilla.org/timer;1"].createInstance(Components.interfaces.nsITimer),
	/************************
	 * Global Variables
	 */
	// this is the timer function.. will call itself once a minute and check the configs
	config: null,
	syncConfigs: null, // the configuration array
	curConfig: 0, // the current configuration counter
	
	forceConfig: null, // per default go through ALL configurations
	forceConfigType: null, // specify "contact"/"calendar"/"task" for only one special type of config
	doHideWindow: false,
	hideFolder: false, // true if we "hide" the folder and show the calendar/abook instead

	gTmpFile: null // temp file for writing stuff into

};


/**
 * runs periodically and checks if there is anything to do
 */
synckolab.main.syncKolabTimer = function () {
	synckolab.tools.logMessage("sync timer starting", synckolab.global.LOG_DEBUG);
	synckolab.config.readConfiguration();
	
	/*@deprecated: listener works better
	var i;
	// check and load config
		
	// only continue timer if nothing is running right now and if we have any configs!
	if (synckolab.main.forceConfig === null && synckolab.main.syncConfigs)
	{
		// go through all configs
		for (i=0; i < synckolab.main.syncConfigs.length; i++)
		{
			var curConfig = synckolab.main.syncConfigs[i];

			// skip all configurations which dont have autorun
			if (!curConfig || curConfig.autoRun === 0)
			{
				continue;
			}

			synckolab.tools.logMessage("synctimer: checking: "+curConfig.name+" ("+synckolab.main.syncConfigs[i].gAutoRun+")....", synckolab.global.LOG_DEBUG);

			curConfig.syncTimer++;
			
			// lets start (make sure no other auto config is running right now)
			if (curConfig.syncTimer >= curConfig.autoRun)
			{
				synckolab.tools.logMessage("running syncKolab configuration "+curConfig.name+" ("+curConfig.autoRun+")", synckolab.global.LOG_INFO);
				curConfig.syncTimer = 0;
				// hide the window 
				synckolab.main.doHideWindow = curConfig.autoHideWindow;
				synckolab.main.forceConfig = curConfig.name;
				synckolab.main.sync("timer");

				// make sure, that we do not start another config right now
				break;
			}

		}
	}
	else {
		synckolab.tools.logMessage("sync with config "+synckolab.main.forceConfig +" is still running...", synckolab.global.LOG_DEBUG);
	}

*/
	// refresh all mail folders configured to trigger auto-sync
	if(synckolab.main.syncConfigs) {
		for(var j = 0; j < synckolab.main.syncConfigs.length; j++) {
			if(synckolab.main.syncConfigs[j]) {
				var curConfig = synckolab.main.syncConfigs[j];
				synckolab.tools.logMessage("sync timer: checking config " + curConfig.name, synckolab.global.LOG_DEBUG);

				if(curConfig.syncListener && curConfig.folder)
				{
					synckolab.tools.logMessage("refreshing " + curConfig.folderMsgURI + "...", synckolab.global.LOG_DEBUG);
					try {
						curConfig.folder.updateFolder(null);
					} catch (ex) {
						synckolab.tools.logMessage("unable to refresh " + curConfig.folderMsgURI + ": " + ex, synckolab.global.LOG_WARNING);
					}
				}
			}
		}
	}
	
	// wait a minute
	synckolab.tools.logMessage("sync timer: sleep for 30s minute", synckolab.global.LOG_INFO);
	
	synckolab.main.backgroundTimer.initWithCallback({
		notify:
			function () {
			synckolab.main.syncKolabTimer();
		}
	}, 30000, 0);
};

synckolab.main.initGroupwareActions = function() {
	// detect and disable event listener for seamonkey
	try {
		if((Components.classes["@mozilla.org/xre/app-info;1"].getService(Components.interfaces.nsIXULAppInfo)).name === "SeaMonkey")
		{
			return;
		}
	} catch (ex) { /* ignore */ }  

	// make sure configuration is already available
	synckolab.config.readConfiguration(); 

	synckolab.main.timer.initWithCallback({
		notify:
			function (){
			window.document.getElementById('folderTree').addEventListener("click", synckolab.main.groupwareActions, true);
		}
	}, synckolab.config.SWITCH_TIME, 0);	
};

/**
 * Executed when the user clicks on a folder. 
 * This checks the config if we want to hide that folder and open the address book or calendar view instead.
 */
synckolab.main.groupwareActions = function () {

	// make sure we have an up to date and valid configuration
	synckolab.config.readConfiguration(); 
	
	// only do that if we really have to
	if(!synckolab.main.config.hideFolder)
	{
		return;
	}
	
	synckolab.tools.logMessage("Starting groupware Actions function", synckolab.global.LOG_DEBUG);

	// Grab the selected folder and figure out what the INBOX is so we can switch to that later
	var selected_foldername = gFolderDisplay.displayedFolder.URI; // gFolderDisplay is defined in messenger
	var index = selected_foldername.indexOf('INBOX',0);
	var email_account = selected_foldername.substring(0, index);
	var inbox = email_account.concat('INBOX');

	var versionChecker = Components.classes["@mozilla.org/xpcom/version-comparator;1"].getService(Components.interfaces.nsIVersionComparator);  

	var i;

	synckolab.tools.logMessage("In groupware Actions function folder name is " + selected_foldername, synckolab.global.LOG_DEBUG);

	for (i=0; i < synckolab.main.syncConfigs.length; i++)
	{
		var curConfig = synckolab.main.syncConfigs[i];
		if(!curConfig)
		{
			continue;
		}
		
		if (selected_foldername === curConfig.folderPath) {

			switch(curConfig.type) {
				case "calendar":
					synckolab.tools.logMessage("In groupware Actions selected Calendar folder", synckolab.global.LOG_DEBUG);
					if (versionChecker.compare(Application.version, "3.0b4") >= 0) {
						document.getElementById('tabmail').openTab('calendar', { title: document.getElementById('calendar-tab-button').getAttribute('tooltiptext') });
						SelectFolder(inbox);
					}
					break;
				case "task":
					synckolab.tools.logMessage("In groupware Actions selected Task folder", synckolab.global.LOG_DEBUG);

					if (versionChecker.compare(Application.version, "3.0b4") >= 0) {
						document.getElementById('tabmail').openTab('tasks', { title: document.getElementById('task-tab-button').getAttribute('tooltiptext') });
						SelectFolder(inbox);
					}
					break;
				case "contact":
					synckolab.tools.logMessage("In groupware Actions selected Contacts folder", synckolab.global.LOG_DEBUG);
					if (versionChecker.compare(Application.version, "3.0b4") >= 0) {
						document.getElementById('tabmail').openTab('contentTab', {contentPage: 'chrome://messenger/content/addressbook/addressbook.xul'});
						SelectFolder(inbox);
					}
					break;
			}
			return;
		}
	}
};

//progress variables 
synckolab.main.curStep = 0;

//hold window elements
synckolab.main.processMsg = null; //process message
synckolab.main.curCounter = null; // counter
synckolab.main.meter = null; // the progress meter
synckolab.main.totalMeter = null; // the total progress meter
synckolab.main.statusMsg = null; // the status message
synckolab.main.itemList = null; // display all processed items

synckolab.main.fileContent = null; // holds the file content

//	sync message db
synckolab.main.syncMessageDb = null;
synckolab.main.gSyncFileKey = null;
synckolab.main.gSyncKeyInfo = null;
synckolab.main.gLastMessageDBHdr = null; // save last message header

/**
 * Start a sync.
 * @param event containing the type of sync (i.e. "timer")
 * @param syncconfig an optional configuration to sync directly (i.e. for "trigger")
 */
synckolab.main.sync =  function (event, syncconfig) 
{
	synckolab.global.consoleService.logStringMessage("running SyncKolab "+synckolab.config.version+" with debug level " + synckolab.config.DEBUG_SYNCKOLAB_LEVEL + " in " + event + " mode (hideWindow: " + synckolab.main.doHideWindow +")");
	
	// avoid race condition with manual switch (only timer has a this.forceConfig)
	if (synckolab.global.running === true)
	{
		synckolab.tools.logMessage("Ignoring run - there is already an instance!", synckolab.global.LOG_WARNING);
		return;
	}
	synckolab.global.running = true;

	// in case this wasnt called via timer - its a manual sync
	if (event !== "timer" && event !== "trigger")
	{
		synckolab.main.forceConfig = "MANUAL-SYNC";
		synckolab.main.forceConfigType = null;
	}

	synckolab.global.strBundle = document.getElementById("synckolabBundle");

	if (synckolab.main.doHideWindow) {
		synckolab.global.wnd = null;
	} else {
		synckolab.global.wnd = window.openDialog("chrome://synckolab/content/progressWindow.xul", "bmarks", "chrome,width=500,height=350,resizable=yes,alwaysRaised=yes,dependent=yes,modal=no");
	}

	// reset variables
	synckolab.main.totalMessages = 0;
	synckolab.main.curMessage = null; 
	synckolab.main.currentMessage = null;
	synckolab.main.updateMessages = null;
	synckolab.main.updateMessagesContent = null;
	synckolab.main.writeDone = false;

	synckolab.main.gMessages = null;
	synckolab.main.gSync = null;

	synckolab.main.gLaterMessages = null; // for lists - we have to wait until we got everything - then start

	// wait until loaded
	synckolab.main.timer.initWithCallback({
		notify:
			function (){
			synckolab.main.goWindow(synckolab.global.wnd);
		}
	}, synckolab.config.SWITCH_TIME, 0);
};

synckolab.main.goWindow = function(wnd)
{
	// wait until the window is loaded (might need a little)
	if (wnd)
	{
		var statusMsg1 = wnd.document.getElementById('current-action');
		if (statusMsg1 === null || !statusMsg1)
		{
			synckolab.main.timer.initWithCallback({notify:function (){synckolab.main.goWindow(wnd);}}, synckolab.config.SWITCH_TIME, 0);
			return;
		}
	}

	if (wnd)
	{
		// some window elements for displaying the status
		synckolab.main.meter = wnd.document.getElementById('progress');
		synckolab.main.totalMeter = wnd.document.getElementById('totalProgress');
		synckolab.main.statusMsg = wnd.document.getElementById('current-action');
		synckolab.main.processMsg = wnd.document.getElementById('current-process');
		synckolab.main.curCounter = wnd.document.getElementById('current-counter');
		synckolab.main.itemList = wnd.document.getElementById('itemList');
	}
	else
	{
		var sb = document.getElementById("status-bar");

		if(wnd) {
			wnd.gStopSync = false;
			wnd.gPauseSync = false;
		}
		synckolab.main.statusMsg = document.getElementById('current-action-sk');		
		if (synckolab.main.statusMsg === null) {
			synckolab.main.statusMsg = document.createElement("statusbarpanel");
			synckolab.main.statusMsg.setAttribute("id", "current-action-sk");
			sb.appendChild(synckolab.main.statusMsg);
		}

		synckolab.main.meter = document.getElementById('progress');
		if (synckolab.main.meter === null) {
			synckolab.main.meter = document.createElement("progressmeter");
			sb.appendChild(synckolab.main.meter);
			synckolab.main.meter.setAttribute("id", "progress-sk");
		}
		synckolab.main.meter.setAttribute("mode", "determined");
		synckolab.main.meter.setAttribute("value", "0");
		synckolab.main.meter.setAttribute("style", "width:100px");


		synckolab.main.curCounter = document.getElementById('current-counter-sk');		
		if (synckolab.main.curCounter === null) {
			synckolab.main.curCounter = document.createElement("statusbarpanel");
			synckolab.main.curCounter.setAttribute("id", "current-counter-sk");
			sb.appendChild(synckolab.main.curCounter);
		}
		synckolab.main.curCounter.setAttribute("label", "-/-");

		synckolab.main.processMsg = null;
		synckolab.main.totalMeter = null;
		synckolab.main.itemList = null;
	}

	if (synckolab.calendarTools.isCalendarAvailable())
	{
		synckolab.tools.logMessage("Calendar available", synckolab.global.LOG_INFO);
	}
	else {
		synckolab.tools.logMessage("Calendar not available - disabling", synckolab.global.LOG_INFO);
	}

	synckolab.main.timer.initWithCallback({notify:function (){synckolab.main.startSync();}}, synckolab.config.SWITCH_TIME, 0);
};


synckolab.main.startSync = function(event) {
	synckolab.main.meter.setAttribute("value", "0%");
	if (synckolab.global.wnd) {
		synckolab.main.totalMeter.setAttribute("value", "0%");
	}

	// get temp file
	var file = Components.classes["@mozilla.org/file/directory_service;1"].getService(Components.interfaces.nsIProperties).get("TmpD", Components.interfaces.nsIFile);
	file.append("syncKolab.tmp");
	file.createUnique(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 600);
	synckolab.main.gTmpFile = file.path;

	// check if the configuration is available and up to date
	synckolab.config.readConfiguration(); 
	
	if(synckolab.main.syncConfigs) {
		synckolab.tools.logMessage("Starting sync with " + synckolab.main.syncConfigs.length + " configurations.", synckolab.global.LOG_DEBUG);
	}
	
	// reset the config counter
	synckolab.main.curConfig = 0;

	// all initialized, lets run
	synckolab.main.timer.initWithCallback({notify:function (){synckolab.main.nextSync();}}, synckolab.config.SWITCH_TIME, 0);
};

/**
 * Start a new sync loop. This will iterate through all configurations and sync accordingly.
 * Calls prepareContent or itself.
 */
synckolab.main.nextSync = function()
{
	// remember the current configuation
	var curConfig = null;
		
	if (synckolab.global.wnd) {
		synckolab.main.totalMeter.setAttribute("value", ((synckolab.main.curConfig*100)/(synckolab.main.syncConfigs.length)) +"%");
	}

	if (synckolab.main.curConfig < synckolab.main.syncConfigs.length)
	{
		// empty or invalid config
		if(!synckolab.main.syncConfigs[synckolab.main.curConfig]) {
			synckolab.main.curConfig++;
			synckolab.main.timer.initWithCallback({notify:function (){synckolab.main.nextSync();}}, synckolab.config.SWITCH_TIME, 0);	
			return;
		}
		
		// contact config
		curConfig = synckolab.main.syncConfigs[synckolab.main.curConfig];
		
		// skip problematic configs or if we don't want to sync this
		if (!curConfig || !curConfig.enabled)
		{
			synckolab.main.curConfig++;
			synckolab.main.timer.initWithCallback({notify:function (){synckolab.main.nextSync();}}, synckolab.config.SWITCH_TIME, 0);	
			return;
		}

		// if we were called from timer - forceConfig defines one config which is loaded - skip the rest then
		if (synckolab.main.forceConfig && synckolab.main.forceConfig !== "MANUAL-SYNC") {
			// check if we skip that: name and type must match
			if (synckolab.main.forceConfig !== curConfig.name || 
					(synckolab.main.forceConfigType && synckolab.main.forceConfigType !== "contact"))
			{
				synckolab.main.curConfig++;
				synckolab.main.timer.initWithCallback({notify:function (){synckolab.main.nextSync();}}, synckolab.config.SWITCH_TIME, 0);	
				return;
			}
		}

		synckolab.main.gConfig = curConfig;
		synckolab.tools.logMessage("Trying configuration " + curConfig.name, synckolab.global.LOG_DEBUG);

		if (synckolab.main.processMsg) {
			synckolab.main.processMsg.value ="Configuration " + curConfig.name;
		}
		
		// run the init callback
		synckolab.main.curConfig++;

		// remember the sync class
		synckolab.main.gSync = curConfig.syncClass;

		// display stuff
		if (synckolab.global.wnd)
		{
			curConfig.syncClass.init(curConfig, synckolab.main.itemList, synckolab.global.wnd.document);
		}
		else
		{
			curConfig.syncClass.init(curConfig, null, document);
		}

		synckolab.tools.logMessage("got folder: " + curConfig.folder.URI + 
				"\nMessage Folder: " + curConfig.folderMsgURI, synckolab.global.LOG_DEBUG);

		// the init2 does the goon for us		
		if(curConfig.syncClass.init2) {
			synckolab.tools.logMessage("runnint init2 on " + curConfig.name, synckolab.global.LOG_DEBUG);
			curConfig.syncClass.init2(synckolab.main.prepareContent, curConfig.syncClass);
		}

		synckolab.main.timer.initWithCallback({notify:function (){synckolab.main.prepareContent();}}, synckolab.config.SWITCH_TIME, 0);
		//synckolab.main.timer.initWithCallback({notify:function (){synckolab.main.prepareContent(synckolab.Calendar);}}, synckolab.config.SWITCH_TIME, 0);
	}
	else //done
	{
		synckolab.tools.logMessage("Done syncing resetting ui." , synckolab.global.LOG_DEBUG);

		if(synckolab.global.wnd && !synckolab.global.wnd.document) {
			synckolab.global.wnd = null;
		}
		
		if (synckolab.global.wnd) {
			synckolab.main.totalMeter.setAttribute("value", "100%");
		}

		synckolab.main.meter.setAttribute("value", "100%");
		if (synckolab.global.wnd) {
			synckolab.main.statusMsg.value = synckolab.global.strBundle.getString("syncfinished");
		} else {
			synckolab.main.statusMsg.setAttribute("label", synckolab.global.strBundle.getString("syncfinished"));
		}

		if (synckolab.global.wnd) {
			synckolab.global.wnd.document.getElementById('cancel-button').label = synckolab.global.strBundle.getString("close");
		}

		// delete the temp file
		var sfile = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
		sfile.initWithPath(synckolab.main.gTmpFile);
		if (sfile.exists()) { 
			sfile.remove(true);
		}

		// close the status window
		var pref = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
		if (synckolab.tools.getConfigValue(pref, "closeWindow", synckolab.tools.CONFIG_TYPE_BOOL, false) && synckolab.global.wnd) {
			synckolab.global.wnd.close();
		}

		// remove all status bar elements
		try {
			if (synckolab.global.wnd === null)
			{
				var sb = document.getElementById("status-bar");
				if(sb) {
					sb.removeChild(synckolab.main.meter);
					sb.removeChild(synckolab.main.statusMsg);
					sb.removeChild(synckolab.main.curCounter);
				}
			}
		} catch (sbEx) {
			// ignore
		}

		// done autorun
		if (synckolab.main.forceConfig)
		{
			synckolab.tools.logMessage("finished autorun of config " + synckolab.main.forceConfig, synckolab.global.LOG_INFO);
			synckolab.main.forceConfig = null;
			synckolab.main.doHideWindow = false;
		}

		// set running state to done
		synckolab.global.running = false;
		return;
	}

	// Step 3
	if (synckolab.global.wnd)
	{
		synckolab.main.statusMsg.value = synckolab.global.strBundle.getString("getContent");
	}
	else
	{
		synckolab.main.statusMsg.setAttribute("label", synckolab.global.strBundle.getString("getContent"));
	}

	synckolab.main.meter.setAttribute("value", "5%");
};

/**
 * this function is being called just before the content parsing starts
 * its sole purpose is to make sure all messages/contacts are downloaded and refreshed
 */
synckolab.main.prepareContent = function() {
	
	// wait for the data (special case for calendar - they need a time to init)
	if (synckolab.main.gSync.dataReady() === false)
	{
		synckolab.main.timer.initWithCallback({notify:function (){synckolab.main.prepareContent();}}, synckolab.config.SWITCH_TIME, 0);
		return;
	}
	
	
	// update folder information from imap and make sure we got everything
	synckolab.main.gConfig.folder.updateFolder(msgWindow);
	// my UrlListener calls getContent
	synckolab.main.gConfig.folder.compact({
		OnStartRunningUrl: function ( url )
		{	
		},

		OnStopRunningUrl: function ( url, exitCode )
		{	
			synckolab.tools.logMessage("Finished folder frefresh; ONSTOP="+exitCode+" : " + url, synckolab.global.LOG_DEBUG );
			synckolab.main.getContent();
		}
	}, msgWindow); // this should take care of refreshes
};

synckolab.main.syncKolabCompact = function() {
	// update folder and compact - this prevents event triggereing
	synckolab.main.gConfig.folder.updateFolder(msgWindow);
	// compact folder
	try { 
		synckolab.main.gConfig.folder.compact(null, null);  
	} catch(e) {
		synckolab.tools.logMessage("ERROR: Running compact: " + e, synckolab.global.LOG_ERROR);
	}

	synckolab.main.gSync.doneParsing();
	synckolab.tools.logMessage("nextSync", synckolab.global.LOG_INFO);
	synckolab.main.timer.initWithCallback({notify:function (){synckolab.main.nextSync();}}, synckolab.config.SWITCH_TIME, 0);	
};


/**
 * start with the sync with the sync class
 * saves the contact folder into fileContent
 */
synckolab.main.getContent = function()
{	
	// check if folder REALLY exists
	synckolab.main.gConfig.folder.clearNewMessages();

	// get the number of messages to go through
	synckolab.main.totalMessages = synckolab.main.gConfig.folder.getTotalMessages(false);
	synckolab.tools.logMessage("Have to sync " + synckolab.main.totalMessages + " messages for the folder.", synckolab.global.LOG_INFO);

	// fix bug #16848 and ask before deleting everything :P
	if (synckolab.main.totalMessages === 0 && synckolab.main.gSync.itemCount() > 0)
	{
		if (window.confirm(synckolab.global.strBundle.getString("syncCopyToServer"))) {
			synckolab.main.gSync.forceServerCopy = true;
		}
	}
	else if (synckolab.main.totalMessages > 0 && synckolab.main.gSync.itemCount() === 0)
		{
			if (window.confirm(synckolab.global.strBundle.getString("syncCopyToClient"))) {
				synckolab.main.gSync.forceLocalCopy = true;
			}
		}

	// prepare empty later list
	synckolab.main.gLaterMessages = {
			msgs: [],
			pointer: 0
	};

	// get the message keys
	if (synckolab.main.gConfig.folder.getMessages) {
		synckolab.main.gMessages = synckolab.main.gConfig.folder.getMessages(null);	 // dont need the msgWindow use null
	} else {
		synckolab.main.gMessages = synckolab.main.gConfig.folder.messages; // tbird 3 uses an enumerator property instead of a function
	}

	// get the message database (a file with uid:size:date:localfile)
	synckolab.main.syncMessageDb = new synckolab.dataBase(synckolab.main.gConfig.dbFile);
	
	synckolab.main.curMessage = 0;
	synckolab.main.updateMessages = []; // saves the the message url to delete
	synckolab.main.updateMessagesContent = []; // saves the card to use to update

	if (synckolab.global.wnd) {
		synckolab.main.statusMsg.value = synckolab.global.strBundle.getString("syncEntries");
	} else {
		synckolab.main.statusMsg.setAttribute("label", synckolab.global.strBundle.getString("syncEntries"));
	}
	synckolab.main.meter.setAttribute("value", "5%");
	synckolab.main.timer.initWithCallback({notify:function (){synckolab.main.getMessage();}}, synckolab.config.SWITCH_TIME, 0);
};


/**
 * Get the current message into a string and then go to parseMessageRunner
 */
synckolab.main.getMessage = function()
{
	// pause sync...
	if (synckolab.global.wnd && synckolab.global.wnd.gPauseSync)
	{
		synckolab.main.timer.initWithCallback({notify:function (){synckolab.main.getMessage();}}, synckolab.config.SWITCH_TIME, 0);
		return;
	}

	if (synckolab.global.wnd && (synckolab.global.wnd.document === null || synckolab.global.wnd.gStopSync === true))
	{
		alert("Stopped SyncKolab...");
		synckolab.global.running = false;
		return;
	}

	
	var cur = null;
	// still in first run...
	if(synckolab.main.gLaterMessages.pointer === 0) {
		try
		{
			if (synckolab.main.gMessages.hasMoreElements()) {
				cur = synckolab.main.gMessages.getNext().QueryInterface(Components.interfaces.nsIMsgDBHdr);
			}
		}
		catch (ex)
		{
			synckolab.tools.logMessage("skipping read of messages - since there are none :)", synckolab.global.LOG_INFO);
			synckolab.main.updateContentAfterSave();
			return;
		}
	}

	var laterMsg = null;

	// get the messages we skipped
	if (!cur)
	{
		// done with the second run
		if (synckolab.main.gLaterMessages.pointer >= synckolab.main.gLaterMessages.msgs.length)
		{
			synckolab.main.gLaterMessages.msgs = [];
			// done with messages go on...
			synckolab.main.parseFolderToAddressFinish();
			return;
		}

		//process later message
		synckolab.tools.logMessage("second round process message: message " + synckolab.main.gLaterMessages.pointer + " of " + synckolab.main.gLaterMessages.msgs.length, synckolab.global.LOG_INFO);

		laterMsg = synckolab.main.gLaterMessages.msgs[synckolab.main.gLaterMessages.pointer++];
		cur = laterMsg.hdr;
	}
	else
	{
		// check message flags (based on mailnews\base\public\nsMsgMessageFlags.h -> deleted=0x200000
		synckolab.tools.logMessage("Message " + cur.mime2DecodedSubject + " (dateInSeconds: " + cur.dateInSeconds + ") has flags: " + cur.flags + " flag imap_deleted? " + (cur.flags&0x200000), synckolab.global.LOG_DEBUG);
		var skipCMessage = false;

		if (cur.flags&0x200000)
		{
			synckolab.tools.logMessage("Message " + cur.mime2DecodedSubject + " has been DELETED on imap!", synckolab.global.LOG_INFO);
			// skip current and process next nessage	
			skipCMessage = true;

		}
		
		if(!cur.mime2DecodedSubject || cur.mime2DecodedSubject.length < 3) {
			synckolab.tools.logMessage("Message '" + cur.mime2DecodedSubject + "' has an invalid subject!", synckolab.global.LOG_INFO);
			// skip current and process next nessage	
			skipCMessage = true;
		}

		// check if we can ignore this message because its too old (0=take all into accout)	
		if(synckolab.main.gConfig.type !== "contact" && synckolab.main.gConfig.timeFrame && synckolab.main.gConfig.timeFrame > 0 && skipCMessage !== true)
		{
			synckolab.tools.logMessage("Checking if message might be too old for now " + (new Date()).getTime(), synckolab.global.LOG_DEBUG);

			// now get the correct startdate (convert in milliseconds)
			if ((cur.dateInSeconds + (synckolab.main.gConfig.timeFrame * 86400))*1000 < (new Date()).getTime())
			{
				synckolab.tools.logMessage("Message " + cur.mime2DecodedSubject + " will be ignored (too old) Now: " + (new Date()).getTime(), synckolab.global.LOG_INFO);
				// skip current and process next nessage	
				skipCMessage = true;
			}
		}

		if (skipCMessage === true)
		{
			synckolab.main.curMessage++;
			if (synckolab.main.curMessage <= synckolab.main.totalMessages)
			{
				var curpointer = 5 + (55*(synckolab.main.curMessage/synckolab.main.totalMessages));
				synckolab.main.meter.setAttribute("value", curpointer + "%");
				if (synckolab.global.wnd) {
					synckolab.main.curCounter.setAttribute("value", synckolab.main.curMessage + "/" + synckolab.main.totalMessages);
				} else {
					synckolab.main.curCounter.setAttribute("label", synckolab.main.curMessage + "/" + synckolab.main.totalMessages);
				}

				// next message
				synckolab.main.timer.initWithCallback({notify:function (){synckolab.main.getMessage();}}, synckolab.config.SWITCH_TIME, 0);
			}
			else
			{
				synckolab.main.timer.initWithCallback({notify:function (){synckolab.main.parseFolderToAddressFinish();}}, synckolab.config.SWITCH_TIME, 0);
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
	synckolab.main.gLastMessageDBHdr = cur;
	synckolab.tools.logMessage("checking for synckey in local db: " + synckolab.tools.getUidFromHeader(cur.mime2DecodedSubject), synckolab.global.LOG_DEBUG);
	synckolab.main.gSyncKeyInfo = synckolab.tools.getUidFromHeader(cur.mime2DecodedSubject);
	synckolab.main.gSyncFileKey = synckolab.main.syncMessageDb.get(synckolab.main.gSyncKeyInfo);

	if (laterMsg) {
		synckolab.tools.logMessage("taking " + synckolab.main.gSyncKeyInfo + " from fist round...", synckolab.global.LOG_DEBUG);
		
		// get the message content into fileContent
		// parseMessageRunner is called when we got the message
		synckolab.main.currentMessage = {
				message: synckolab.main.gConfig.folderMsgURI +"#"+cur.messageKey,
				fileContent: laterMsg.content,
				nextFunc: synckolab.main.parseMessageRunner
		};
		synckolab.main.gSyncFileKey = laterMsg.fileKey;
		synckolab.main.parseMessageRunner();
		return;
	}
	else {
		if (synckolab.main.gSyncFileKey)
		{
			synckolab.tools.logMessage("we have " + synckolab.main.gSyncKeyInfo + " already locally...", synckolab.global.LOG_DEBUG);
			// check if the message has changed
			if (cur.messageSize === Number(synckolab.main.gSyncFileKey[1]) && cur.date === Number(synckolab.main.gSyncFileKey[2]))
			{
				// get the content from the cached file and ignore the imap
				synckolab.tools.logMessage("taking content from: " + synckolab.main.gSyncFileKey[3] + "/" + synckolab.main.gSyncFileKey[4], synckolab.global.LOG_DEBUG);
				
				var cachedFile = synckolab.tools.readSyncDBFile(synckolab.tools.file.getSyncDbFile(synckolab.main.gConfig, synckolab.main.gSyncFileKey[4]));
				// make sure we dont read an empty file
				if (cachedFile && cachedFile !== "" && cachedFile.synckolab)
				{
					synckolab.tools.logMessage("read cached file", synckolab.global.LOG_DEBUG);
					// parse the json
					synckolab.main.currentMessage = {
							fileContent: cachedFile
					};
					synckolab.main.parseMessageRunner();
					return;
				} else {
					synckolab.tools.logMessage("unable to read read cached file", synckolab.global.LOG_DEBUG);
					synckolab.main.syncMessageDb.remove(synckolab.main.gSyncFileKey);

					// new netry
					// remember the info
					synckolab.main.gSyncFileKey = {}; // we not yet know the id
					synckolab.main.gSyncFileKey[0] = '';
					synckolab.main.gSyncFileKey[1] = cur.messageSize;
					synckolab.main.gSyncFileKey[2] = cur.date;
					
				}
			}
			else
			{
				// some change happened... remove this entry (+ some update :P )
				synckolab.tools.logMessage("Cached message does not match - skipping cache read", synckolab.global.LOG_DEBUG);
				synckolab.main.syncMessageDb.remove(synckolab.main.gSyncFileKey);

				// new netry
				// remember the info
				synckolab.main.gSyncFileKey = {}; // we not yet know the id
				synckolab.main.gSyncFileKey[0] = '';
				synckolab.main.gSyncFileKey[1] = cur.messageSize;
				synckolab.main.gSyncFileKey[2] = cur.date;

			}
		}
		else
		{
			// remember the info
			synckolab.main.gSyncFileKey = {}; // we not yet know the id
			synckolab.main.gSyncFileKey[0] = '';
			synckolab.main.gSyncFileKey[1] = cur.messageSize;
			synckolab.main.gSyncFileKey[2] = cur.date;
		}
	}

	// get the message content into fileContent
	// parseMessageRunner is called when we got the message
	synckolab.main.currentMessage = {
			message: synckolab.main.gConfig.folderMsgURI +"#"+cur.messageKey,
			fileContent: "",
			nextFunc: synckolab.main.parseMessageRunner
	};
	synckolab.main.getMessageIntoContent(synckolab.main.currentMessage);
};

/**
 * 
 * @param content the content structure contianing the message key and the buffer for the content
 */
synckolab.main.getMessageIntoContent = function(content) {
	var aurl = {};
	synckolab.global.messageService.CopyMessage(
			content.message, 
			/* nsIStreamListener */
			{
					onDataAvailable: function (request, context, inputStream, offset, count){
						try
						{
							var sis=Components.classes["@mozilla.org/scriptableinputstream;1"].createInstance(Components.interfaces.nsIScriptableInputStream);
							sis.init(inputStream);
							content.fileContent += sis.read(count);
						}
						catch(ex)
						{
							alert("exception caught: "+ex.message+"\n");
						}
					},
					onStartRequest: function (request, context) {
					},
					onStopRequest: function (aRequest, aContext, aStatusCode) {
						synckolab.tools.logMessage("got Message [" + content.message + "]:\n" + content.fileContent, synckolab.global.LOG_DEBUG);

						// remove the header of the content
						content.fileContent = synckolab.tools.stripMailHeader(content.fileContent);
						
						// make sure we dont come into an endless loop here
						synckolab.global.triggerRunning = true;
						content.nextFunc(content);
						synckolab.global.triggerRunning = false;
					}
			}, false, null, msgWindow, aurl
	);
};


/**
 * Copies a local file into any mail folder.
 * In order to be displayed correct, make sure to create a complete message file!!!
 * fileName string - the file to copy(+path)
 * folderUri string - the Uri/Url of the folder we want this in
 */
synckolab.main.copyToFolder = function(fileName, folderUri, listener)
{
	var mailFolder = folderUri;
	var fileSpec;
	var copyservice;
	if (Components.interfaces.nsIFileSpec)
	{
		fileSpec = Components.classes["@mozilla.org/filespec;1"].createInstance(Components.interfaces.nsIFileSpec);	
		fileSpec.nativePath = fileName;

		// at this pont, check the content, we do not write a load of bogus messages in the imap folder
		copyservice = Components.classes["@mozilla.org/messenger/messagecopyservice;1"].getService(Components.interfaces.nsIMsgCopyService);
		// in order to be able to REALLY copy the message setup a listener
		// and mark as read
		copyservice.CopyFileMessage(fileSpec, mailFolder, null, false, 0x000001, listener, null); // dont need a msg window
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
		copyservice.CopyFileMessage(fileSpec, mailFolder, null, false, 0x000001, null, listener, null); // dont need a msg window
	}
};

/**
 * we now got the message content. this needs to parsed and checked 
 */
synckolab.main.parseMessageRunner = function()
{
	// pause sync...
	if (synckolab.global.wnd && synckolab.global.wnd.gPauseSync)
	{
		synckolab.main.timer.initWithCallback({notify:function (){synckolab.main.parseMessageRunner();}}, synckolab.config.SWITCH_TIME, 0);
		return;
	}

	if (synckolab.global.wnd && (synckolab.global.wnd.document === null || synckolab.global.wnd.gStopSync === true))
	{
		alert("Stopped SyncKolab...");
		synckolab.global.running = false;
		return;
	}

	var skcontent = null;
	// unparsable message... content is null and so it will skip
	if(synckolab.main.currentMessage && synckolab.main.currentMessage.fileContent) {
		synckolab.tools.logMessage("parsing message... ", synckolab.global.LOG_DEBUG);

		// fix the message for line truncs (last char in line is =)
		// content might be a preparsed json
		if(!synckolab.main.currentMessage.fileContent.synckolab) {
			synckolab.main.currentMessage.fileContent = synckolab.main.currentMessage.fileContent.replace(/\=\n(\S)/g, "$1");
		}
		skcontent = synckolab.main.gSync.parseMessage(synckolab.main.currentMessage.fileContent, synckolab.main.updateMessagesContent, (synckolab.main.gLaterMessages.pointer === 0));
	}

	if (skcontent === "LATER") {
		synckolab.tools.logMessage("keeping message for later (possible a mailing list): #" + synckolab.main.gLaterMessages.msgs.length, synckolab.global.LOG_DEBUG);
		var cMsg = {};
		cMsg.content = synckolab.main.currentMessage.fileContent;
		cMsg.hdr = synckolab.main.gLastMessageDBHdr;
		cMsg.fileKey = synckolab.main.gSyncFileKey;
		synckolab.main.gLaterMessages.msgs.push(cMsg);
	}
	else {
		// just to make sure there REALLY isnt any content left :)
		synckolab.main.currentMessage.fileContent = null;
		if (skcontent)
		{
			if (skcontent === "DELETEME") {
				synckolab.tools.logMessage("deleting [" + synckolab.main.currentMessage.message + "]", synckolab.global.LOG_INFO);
			} else {
				synckolab.tools.logMessage("updating [" + synckolab.main.currentMessage.message + "]", synckolab.global.LOG_INFO);
			}
			// adding message to list of to-delete messages - synckolab.main.gConfig.folderMsgURI +"#"+
			synckolab.main.updateMessages.push(synckolab.main.gLastMessageDBHdr); 
			synckolab.main.updateMessagesContent.push(skcontent); 
			synckolab.tools.logMessage("changed msg #" + synckolab.main.updateMessages.length, synckolab.global.LOG_INFO);
		}
		// no change... remember that :)
		else
		{
			// fill info about the file and re-add it 
			synckolab.main.gSyncFileKey[0] = synckolab.main.gSyncKeyInfo;
			synckolab.main.gSyncFileKey[3] = synckolab.main.gSync.gConfig.name;
			synckolab.main.gSyncFileKey[4] = synckolab.main.gSyncKeyInfo; //gSync.gCurUID;
			// Add the key
			synckolab.main.syncMessageDb.add(synckolab.main.gSyncFileKey);
		}
	}

	// process next nessage	
	synckolab.main.curMessage++;
	if (synckolab.main.curMessage <= synckolab.main.totalMessages || synckolab.main.gLaterMessages.pointer < synckolab.main.gLaterMessages.msgs.length)
	{
		var curpointer = 5 + (55*((synckolab.main.curMessage + synckolab.main.gLaterMessages.pointer)/(synckolab.main.totalMessages + synckolab.main.gLaterMessages.msgs.length)));
		synckolab.main.meter.setAttribute("value", curpointer + "%");

		synckolab.main.curCounter.setAttribute((synckolab.global.wnd)?"value":"label", (synckolab.main.curMessage + synckolab.main.gLaterMessages.pointer) + "/" + (synckolab.main.totalMessages + synckolab.main.gLaterMessages.msgs.length));

		if (synckolab.main.curMessage%20 === 0)
		{
			// save the sync db file every 20 messages.. should speed up sync if canceled
			synckolab.tools.logMessage("Writing message snyc-db", synckolab.global.LOG_DEBUG);

			// write the db file back
			synckolab.main.syncMessageDb.write();
		}

		// next message
		synckolab.main.timer.initWithCallback({notify:function (){synckolab.main.getMessage();}}, synckolab.config.SWITCH_TIME, 0);
	}
	else
	{
		synckolab.tools.logMessage("Done parsing " + (synckolab.main.totalMessages+synckolab.main.gLaterMessages.msgs.length), synckolab.global.LOG_DEBUG);
		synckolab.main.timer.initWithCallback({notify:function (){synckolab.main.parseFolderToAddressFinish();}}, synckolab.config.SWITCH_TIME, 0);
	}
};

//Step 6  10%
//write everything thats not yet in the message folder but is in the local db
synckolab.main.writeContent = function()
{
	// pause sync...
	if (synckolab.global.wnd && synckolab.global.wnd.gPauseSync)
	{
		synckolab.main.timer.initWithCallback({notify:function (){synckolab.main.writeContent();}}, synckolab.config.SWITCH_TIME, 0);
		return;
	}

	if (synckolab.global.wnd && (synckolab.global.wnd.document === null || synckolab.global.wnd.gStopSync === true))
	{
		alert("Stopped SyncKolab...");
		synckolab.global.running = false;
		return;
	}

	// if there happens an exception, we are done
	var skcontent = synckolab.main.gSync.nextUpdate();
	if (skcontent === "done")
	{
		synckolab.tools.logMessage("content is 'done'", synckolab.global.LOG_INFO);
		synckolab.main.writeContentAfterSave();
		return;
	}

	if (skcontent === null)
	{
		synckolab.tools.logMessage("content is null - continue", synckolab.global.LOG_WARNING);
		synckolab.main.timer.initWithCallback({notify:function (){synckolab.main.writeContent();}}, synckolab.config.SWITCH_TIME, 0);
		return;
	}

	if (synckolab.main.gConfig.saveToImap)
	{
		// write the temp file back to the original directory
		synckolab.tools.logMessage("WriteContent Writing...", synckolab.global.LOG_INFO);
		synckolab.main.writeImapMessage(skcontent, synckolab.main.gConfig, synckolab.main.kolabCopyServiceListener); 
	}
	else {
		synckolab.tools.logMessage("Skipping write to imap because of read only config...", synckolab.global.LOG_INFO);
		synckolab.main.writeContentAfterSave();
	}
};

synckolab.main.kolabCopyServiceListener = {
		OnProgress: function (progress, progressMax) { 
		},
		OnStartCopy: function () { 
		},
		SetMessageKey: function (key) { 
		},
		OnStopCopy: function (status) {
			if (synckolab.main.curStep === 5) {
				synckolab.main.timer.initWithCallback({notify:function (){synckolab.main.updateContentWrite();}}, synckolab.config.SWITCH_TIME, 0);
			}
			if (synckolab.main.curStep === 6) {
				synckolab.main.timer.initWithCallback({notify:function (){synckolab.main.writeContent();}}, synckolab.config.SWITCH_TIME, 0);
			}
		}
};

/**
 * write a content back to an imap folder
 * @param skcontent the content to write (an eml)
 * @param config the config to use (for the correct folder)
 * @param listener this is a callback that is used when the copy has been finished/failed
 */
synckolab.main.writeImapMessage = function(skcontent, config, listener) {
	// get temp file (might not yet be initialized)
	var file = Components.classes["@mozilla.org/file/directory_service;1"].getService(Components.interfaces.nsIProperties).get("TmpD", Components.interfaces.nsIFile);
	file.append("syncKolab.tmp");
	file.createUnique(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 600);
	synckolab.main.gTmpFile = file.path;
	
	// write the message in the temp file
	var sfile = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
	// temp path
	sfile.initWithPath(synckolab.main.gTmpFile);
	if (sfile.exists()) {
		sfile.remove(true);
	}
	sfile.create(sfile.NORMAL_FILE_TYPE, parseInt("0600", 8));

	// make the message rfc compatible (make sure all lines en with \r\n)
	skcontent = skcontent.replace(/\r\n|\n\r|\n|\r/g, "\r\n");

	// create a new message in there
	var stream = Components.classes['@mozilla.org/network/file-output-stream;1'].createInstance(Components.interfaces.nsIFileOutputStream);
	stream.init(sfile, 2, 0x200, false); // open as "write only"
	stream.write(skcontent, skcontent.length);
	stream.close();

	synckolab.tools.logMessage("Copy Message to Folder", synckolab.global.LOG_DEBUG);

	synckolab.main.copyToFolder(synckolab.main.gTmpFile, config.folder, listener); 
};


//done this time
synckolab.main.writeContentAfterSave = function()
{
	// pause sync...
	if (synckolab.global.wnd && synckolab.global.wnd.gPauseSync)
	{
		synckolab.main.timer.initWithCallback({notify:function (){synckolab.main.writeContentAfterSave();}}, synckolab.config.SWITCH_TIME, 0);
		return;
	}

	if (synckolab.global.wnd && (synckolab.global.wnd.document === null || synckolab.global.wnd.gStopSync === true))
	{
		alert("Stopped SyncKolab...");
		synckolab.global.running = false;
		return;
	}

	synckolab.tools.logMessage("Setting all messages to read...", synckolab.global.LOG_INFO);
	
	// before done, set all unread messages to read in the sync folder
	synckolab.main.gMessages = synckolab.main.gConfig.folder.messages; // tbird 3 uses an enumerator property instead of a function

	while (synckolab.main.gMessages.hasMoreElements())
	{
		var cur = synckolab.main.gMessages.getNext().QueryInterface(Components.interfaces.nsIMsgDBHdr);
		if (!cur.isRead)
		{
			cur.markRead(true);
		}
	}	
	synckolab.main.gMessages = null;


	synckolab.tools.logMessage("Running compact", synckolab.global.LOG_INFO);
	synckolab.main.timer.initWithCallback({notify:function (){synckolab.main.syncKolabCompact();}}, 2000, 0); // wait for a second or two
};


synckolab.main.parseFolderToAddressFinish = function()
{
	// do step 5
	synckolab.main.curStep = 5;
	synckolab.main.writeDone = false;
	synckolab.tools.logMessage("parseFolderToAddressFinish (Writing message db)", synckolab.global.LOG_DEBUG);

	// write the db file back
	synckolab.main.syncMessageDb.write();

	synckolab.main.meter.setAttribute("value", "60%");
	if (synckolab.global.wnd)
	{
		synckolab.main.statusMsg.value = synckolab.global.strBundle.getString("writeChangedEntries");
		synckolab.main.curCounter.setAttribute("value", "0/0");
	}
	else
	{
		synckolab.main.statusMsg.setAttribute("label", synckolab.global.strBundle.getString("writeChangedEntries"));
		synckolab.main.curCounter.setAttribute("label", "0/0");
	}


	synckolab.main.timer.initWithCallback({notify:function (){synckolab.main.updateContent();}}, synckolab.config.SWITCH_TIME, 0);
};


/* Remove all messages which needs to be updated or deleted.
 * The replacement messages are created in updateContentWrite().
 */
synckolab.main.updateContent = function()
{
	// pause sync...
	if (synckolab.global.wnd && synckolab.global.wnd.gPauseSync)
	{
		synckolab.main.timer.initWithCallback({notify:function (){synckolab.main.updateContent();}}, synckolab.config.SWITCH_TIME, 0);
		return;
	}

	if (synckolab.global.wnd && (synckolab.global.wnd.document === null || synckolab.global.wnd.gStopSync === true))
	{
		alert("Stopped SyncKolab...");
		synckolab.global.running = false;
		return;
	}

	synckolab.tools.logMessage("updating content:", synckolab.global.LOG_DEBUG);
	var i;
	// first lets delete the old messages
	if (synckolab.main.gConfig.saveToImap && synckolab.main.updateMessages.length > 0) 
	{
		try
		{
			synckolab.tools.logMessage("deleting changed messages..", synckolab.global.LOG_INFO);

			var list = null;
			// use mutablearray
			list = Components.classes["@mozilla.org/array;1"].createInstance(Components.interfaces.nsIMutableArray);
			for (i = 0; i < synckolab.main.updateMessages.length; i++)
			{
				synckolab.tools.logMessage("deleting [" + synckolab.main.updateMessages[i] + "]");
				//var hdr = synckolab.global.messageService.messageURIToMsgHdr(synckolab.main.updateMessages[i]);
				list.appendElement(synckolab.main.updateMessages[i], false);	
			}
			synckolab.main.gConfig.folder.deleteMessages(list, msgWindow, true, false, null, true);
		}
		catch (ex)
		{
			synckolab.tools.logMessage("Exception while deleting - skipping: " + ex, synckolab.global.LOG_ERROR);
		}
	}
	synckolab.main.curMessage = -1;
	// now write the new ones
	synckolab.main.timer.initWithCallback({notify:function (){synckolab.main.updateContentWrite();}}, synckolab.config.SWITCH_TIME, 0);
};

/* Write all changed messages back to the folder. Skip
 * the messages which were to be deleted from the server.
 */
synckolab.main.updateContentWrite = function()
{
	// pause sync...
	if (synckolab.global.wnd && synckolab.global.wnd.gPauseSync)
	{
		synckolab.main.timer.initWithCallback({notify:function (){synckolab.main.updateContentWrite();}}, synckolab.config.SWITCH_TIME, 0);
		return;
	}

	if (synckolab.global.wnd && (synckolab.global.wnd.document === null || synckolab.global.wnd.gStopSync === true))
	{
		alert("Stopped SyncKolab...");
		synckolab.global.running = false;
		return;
	}
	synckolab.main.curCounter.setAttribute("value", synckolab.main.curMessage + "/" + synckolab.main.updateMessagesContent.length);

	synckolab.main.curMessage++;
	if (synckolab.main.curMessage < synckolab.main.updateMessagesContent.length)
	{
		var skcontent = synckolab.main.updateMessagesContent[synckolab.main.curMessage];
		// write the message
		if (synckolab.main.gConfig.saveToImap && skcontent !== "DELETEME" && skcontent!== null && skcontent.length > 1)
		{
			synckolab.tools.logMessage("adding [" + skcontent + "] to messages", synckolab.global.LOG_DEBUG);
			synckolab.main.writeImapMessage(skcontent, synckolab.main.gConfig, synckolab.main.kolabCopyServiceListener);
		}
		else {
			synckolab.main.updateContentWrite();
		}
	}
	else {
		synckolab.main.updateContentAfterSave();
	}
};

synckolab.main.updateContentAfterSave =function ()
{
	synckolab.tools.logMessage("starting update content...", synckolab.global.LOG_INFO);
	synckolab.main.curStep = 6;
	synckolab.main.writeDone = false;

	if (!synckolab.main.gSync.initUpdate())
	{
		synckolab.tools.logMessage("Nothing there to update...", synckolab.global.LOG_INFO);
		synckolab.main.writeContentAfterSave();
	}

	synckolab.main.meter.setAttribute("value", "80%");
	if (synckolab.global.wnd)
	{
		synckolab.main.statusMsg.value = synckolab.global.strBundle.getString("writeNewEntries");
		synckolab.main.curCounter.setAttribute("value", "...");
	}
	else
	{
		synckolab.main.statusMsg.setAttribute("label", synckolab.global.strBundle.getString("writeNewEntries"));
		synckolab.main.curCounter.setAttribute("label", "...");
	}

	synckolab.main.timer.initWithCallback({notify:function (){synckolab.main.writeContent();}}, synckolab.config.SWITCH_TIME, 0);
};



