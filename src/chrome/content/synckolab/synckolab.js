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
if(!com) var com={};
if(!com.synckolab) com.synckolab={};


//synckolab interface
com.synckolab.main = {
	timer: Components.classes["@mozilla.org/timer;1"].createInstance(Components.interfaces.nsITimer),
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
com.synckolab.main.syncKolabTimer = function () {
/*@deprecated: listener works better
	com.synckolab.tools.logMessage("sync timer: check configuration", com.synckolab.global.LOG_DEBUG);
	var i;
	
	// check and load config
	com.synckolab.config.readConfiguration();
		
	// only continue timer if nothing is running right now and if we have any configs!
	if (com.synckolab.main.forceConfig === null && com.synckolab.main.syncConfigs)
	{
		// go through all configs
		for (i=0; i < com.synckolab.main.syncConfigs.length; i++)
		{
			var curConfig = com.synckolab.main.syncConfigs[i];

			// skip all configurations which dont have autorun
			if (!curConfig || curConfig.autoRun === 0)
			{
				continue;
			}

			com.synckolab.tools.logMessage("synctimer: checking: "+curConfig.name+" ("+com.synckolab.main.syncConfigs[i].gAutoRun+")....", com.synckolab.global.LOG_DEBUG);

			curConfig.syncTimer++;
			
			// lets start (make sure no other auto config is running right now)
			if (curConfig.syncTimer >= curConfig.autoRun)
			{
				com.synckolab.tools.logMessage("running syncKolab configuration "+curConfig.name+" ("+curConfig.autoRun+")", com.synckolab.global.LOG_INFO);
				curConfig.syncTimer = 0;
				// hide the window 
				com.synckolab.main.doHideWindow = curConfig.autoHideWindow;
				com.synckolab.main.forceConfig = curConfig.name;
				com.synckolab.main.sync("timer");

				// make sure, that we do not start another config right now
				break;
			}

		}
	}
	else {
		com.synckolab.tools.logMessage("sync with config "+com.synckolab.main.forceConfig +" is still running...", com.synckolab.global.LOG_DEBUG);
	}

	// wait a minute
	com.synckolab.tools.logMessage("sync timer: sleep for one minute", com.synckolab.global.LOG_DEBUG);
	com.synckolab.main.timer.initWithCallback({notify:function (){com.synckolab.main.syncKolabTimer();}}, 60000, 0);
*/
};

com.synckolab.main.initGroupwareActions = function() {
	// detect and disable event listener for seamonkey
	try {
		if((Components.classes["@mozilla.org/xre/app-info;1"].getService(Components.interfaces.nsIXULAppInfo)).name === "SeaMonkey")
		{
			return;
		}
	} catch (ex) { /* ignore */ }  

	// make sure configuration is already available
	com.synckolab.config.readConfiguration(); 

	com.synckolab.main.timer.initWithCallback({
		notify:
			function (){
			window.document.getElementById('folderTree').addEventListener("click", com.synckolab.main.groupwareActions, true);
		}
	}, com.synckolab.config.SWITCH_TIME, 0);	
};

/**
 * Executed when the user clicks on a folder. 
 * This checks the config if we want to hide that folder and open the address book or calendar view instead.
 */
com.synckolab.main.groupwareActions = function () {

	// make sure we have an up to date and valid configuration
	com.synckolab.config.readConfiguration(); 
	
	// only do that if we really have to
	if(!com.synckolab.main.config.hideFolder)
	{
		return;
	}
	
	com.synckolab.tools.logMessage("Starting groupware Actions function", com.synckolab.global.LOG_DEBUG);

	// Grab the selected folder and figure out what the INBOX is so we can switch to that later
	var selected_foldername = gFolderDisplay.displayedFolder.URI; // gFolderDisplay is defined in messenger
	var index = selected_foldername.indexOf('INBOX',0);
	var email_account = selected_foldername.substring(0, index);
	var inbox = email_account.concat('INBOX');

	var versionChecker = Components.classes["@mozilla.org/xpcom/version-comparator;1"].getService(Components.interfaces.nsIVersionComparator);  

	var i;

	com.synckolab.tools.logMessage("In groupware Actions function folder name is " + selected_foldername, com.synckolab.global.LOG_DEBUG);

	for (i=0; i < com.synckolab.main.syncConfigs.length; i++)
	{
		var curConfig = com.synckolab.main.syncConfigs[i];
		if(!curConfig)
		{
			continue;
		}
		
		if (selected_foldername === curConfig.folderPath) {

			switch(curConfig.type) {
				case "calendar":
					com.synckolab.tools.logMessage("In groupware Actions selected Calendar folder", com.synckolab.global.LOG_DEBUG);
					if (versionChecker.compare(Application.version, "3.0b4") >= 0) {
						document.getElementById('tabmail').openTab('calendar', { title: document.getElementById('calendar-tab-button').getAttribute('tooltiptext') });
						SelectFolder(inbox);
					}
					break;
				case "task":
					com.synckolab.tools.logMessage("In groupware Actions selected Task folder", com.synckolab.global.LOG_DEBUG);

					if (versionChecker.compare(Application.version, "3.0b4") >= 0) {
						document.getElementById('tabmail').openTab('tasks', { title: document.getElementById('task-tab-button').getAttribute('tooltiptext') });
						SelectFolder(inbox);
					}
					break;
				case "contact":
					com.synckolab.tools.logMessage("In groupware Actions selected Contacts folder", com.synckolab.global.LOG_DEBUG);
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
com.synckolab.main.curStep = 0;

//hold window elements
com.synckolab.main.processMsg = null; //process message
com.synckolab.main.curCounter = null; // counter
com.synckolab.main.meter = null; // the progress meter
com.synckolab.main.totalMeter = null; // the total progress meter
com.synckolab.main.statusMsg = null; // the status message
com.synckolab.main.itemList = null; // display all processed items

com.synckolab.main.fileContent = null; // holds the file content

//	sync message db
com.synckolab.main.syncMessageDb = null;
com.synckolab.main.gSyncFileKey = null;
com.synckolab.main.gSyncKeyInfo = null;
com.synckolab.main.gLastMessageDBHdr = null; // save last message header

/**
 * Start a sync.
 * @param event containing the type of sync (i.e. "timer")
 * @param syncconfig an optional configuration to sync directly (i.e. for "trigger")
 */
com.synckolab.main.sync =  function (event, syncconfig) 
{
	com.synckolab.global.consoleService.logStringMessage("running SyncKolab "+com.synckolab.config.version+" with debug level " + com.synckolab.config.DEBUG_SYNCKOLAB_LEVEL + " in " + event + " mode (hideWindow: " + com.synckolab.main.doHideWindow +")");
	
	// avoid race condition with manual switch (only timer has a this.forceConfig)
	if (com.synckolab.global.running === true)
	{
		com.synckolab.tools.logMessage("Ignoring run - there is already an instance!", com.synckolab.global.LOG_WARNING);
		return;
	}
	com.synckolab.global.running = true;

	// in case this wasnt called via timer - its a manual sync
	if (event !== "timer" && event !== "trigger")
	{
		com.synckolab.main.forceConfig = "MANUAL-SYNC";
		com.synckolab.main.forceConfigType = null;
	}

	com.synckolab.global.strBundle = document.getElementById("synckolabBundle");

	if (com.synckolab.main.doHideWindow) {
		com.synckolab.global.wnd = null;
	} else {
		com.synckolab.global.wnd = window.openDialog("chrome://synckolab/content/progressWindow.xul", "bmarks", "chrome,width=500,height=350,resizable=yes,alwaysRaised=yes,dependent=yes,modal=no");
	}

	// reset variables
	com.synckolab.main.totalMessages = 0;
	com.synckolab.main.curMessage = null; 
	com.synckolab.main.currentMessage = null;
	com.synckolab.main.updateMessages = null;
	com.synckolab.main.updateMessagesContent = null;
	com.synckolab.main.writeDone = false;

	com.synckolab.main.gMessages = null;
	com.synckolab.main.gSync = null;

	com.synckolab.main.gLaterMessages = null; // for lists - we have to wait until we got everything - then start

	// wait until loaded
	com.synckolab.main.timer.initWithCallback({
		notify:
			function (){
			com.synckolab.main.goWindow(com.synckolab.global.wnd);
		}
	}, com.synckolab.config.SWITCH_TIME, 0);
};

com.synckolab.main.goWindow = function(wnd)
{
	// wait until the window is loaded (might need a little)
	if (wnd)
	{
		var statusMsg1 = wnd.document.getElementById('current-action');
		if (statusMsg1 === null || !statusMsg1)
		{
			com.synckolab.main.timer.initWithCallback({notify:function (){com.synckolab.main.goWindow(wnd);}}, com.synckolab.config.SWITCH_TIME, 0);
			return;
		}
	}

	if (wnd)
	{
		// some window elements for displaying the status
		com.synckolab.main.meter = wnd.document.getElementById('progress');
		com.synckolab.main.totalMeter = wnd.document.getElementById('totalProgress');
		com.synckolab.main.statusMsg = wnd.document.getElementById('current-action');
		com.synckolab.main.processMsg = wnd.document.getElementById('current-process');
		com.synckolab.main.curCounter = wnd.document.getElementById('current-counter');
		com.synckolab.main.itemList = wnd.document.getElementById('itemList');
	}
	else
	{
		var sb = document.getElementById("status-bar");

		if(wnd) {
			wnd.gStopSync = false;
			wnd.gPauseSync = false;
		}
		com.synckolab.main.statusMsg = document.getElementById('current-action-sk');		
		if (com.synckolab.main.statusMsg === null) {
			com.synckolab.main.statusMsg = document.createElement("statusbarpanel");
			com.synckolab.main.statusMsg.setAttribute("id", "current-action-sk");
			sb.appendChild(com.synckolab.main.statusMsg);
		}

		com.synckolab.main.meter = document.getElementById('progress');
		if (com.synckolab.main.meter === null) {
			com.synckolab.main.meter = document.createElement("progressmeter");
			sb.appendChild(com.synckolab.main.meter);
			com.synckolab.main.meter.setAttribute("id", "progress-sk");
		}
		com.synckolab.main.meter.setAttribute("mode", "determined");
		com.synckolab.main.meter.setAttribute("value", "0");
		com.synckolab.main.meter.setAttribute("style", "width:100px");


		com.synckolab.main.curCounter = document.getElementById('current-counter-sk');		
		if (com.synckolab.main.curCounter === null) {
			com.synckolab.main.curCounter = document.createElement("statusbarpanel");
			com.synckolab.main.curCounter.setAttribute("id", "current-counter-sk");
			sb.appendChild(com.synckolab.main.curCounter);
		}
		com.synckolab.main.curCounter.setAttribute("label", "-/-");

		com.synckolab.main.processMsg = null;
		com.synckolab.main.totalMeter = null;
		com.synckolab.main.itemList = null;
	}

	if (com.synckolab.calendarTools.isCalendarAvailable())
	{
		com.synckolab.tools.logMessage("Calendar available", com.synckolab.global.LOG_INFO);
	}
	else {
		com.synckolab.tools.logMessage("Calendar not available - disabling", com.synckolab.global.LOG_INFO);
	}

	com.synckolab.main.timer.initWithCallback({notify:function (){com.synckolab.main.startSync();}}, com.synckolab.config.SWITCH_TIME, 0);
};


com.synckolab.main.startSync = function(event) {
	com.synckolab.main.meter.setAttribute("value", "0%");
	if (com.synckolab.global.wnd) {
		com.synckolab.main.totalMeter.setAttribute("value", "0%");
	}

	// get temp file
	var file = Components.classes["@mozilla.org/file/directory_service;1"].getService(Components.interfaces.nsIProperties).get("TmpD", Components.interfaces.nsIFile);
	file.append("syncKolab.tmp");
	file.createUnique(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 600);
	com.synckolab.main.gTmpFile = file.path;

	// check if the configuration is available and up to date
	com.synckolab.config.readConfiguration(); 
	
	if(com.synckolab.main.syncConfigs) {
		com.synckolab.tools.logMessage("Starting sync with " + com.synckolab.main.syncConfigs.length + " configurations.", com.synckolab.global.LOG_DEBUG);
	}
	
	// reset the config counter
	com.synckolab.main.curConfig = 0;

	// all initialized, lets run
	com.synckolab.main.timer.initWithCallback({notify:function (){com.synckolab.main.nextSync();}}, com.synckolab.config.SWITCH_TIME, 0);
};

/**
 * Start a new sync loop. This will iterate through all configurations and sync accordingly.
 * Calls prepareContent or itself.
 */
com.synckolab.main.nextSync = function()
{
	// remember the current configuation
	var curConfig = null;
		
	if (com.synckolab.global.wnd) {
		com.synckolab.main.totalMeter.setAttribute("value", ((com.synckolab.main.curConfig*100)/(com.synckolab.main.syncConfigs.length)) +"%");
	}

	if (com.synckolab.main.curConfig < com.synckolab.main.syncConfigs.length)
	{
		// empty or invalid config
		if(!com.synckolab.main.syncConfigs[com.synckolab.main.curConfig]) {
			com.synckolab.main.curConfig++;
			com.synckolab.main.timer.initWithCallback({notify:function (){com.synckolab.main.nextSync();}}, com.synckolab.config.SWITCH_TIME, 0);	
			return;
		}
		
		// contact config
		curConfig = com.synckolab.main.syncConfigs[com.synckolab.main.curConfig];
		
		// skip problematic configs or if we don't want to sync this
		if (!curConfig || !curConfig.enabled)
		{
			com.synckolab.main.curConfig++;
			com.synckolab.main.timer.initWithCallback({notify:function (){com.synckolab.main.nextSync();}}, com.synckolab.config.SWITCH_TIME, 0);	
			return;
		}

		// if we were called from timer - forceConfig defines one config which is loaded - skip the rest then
		if (com.synckolab.main.forceConfig && com.synckolab.main.forceConfig !== "MANUAL-SYNC") {
			// check if we skip that: name and type must match
			if (com.synckolab.main.forceConfig !== curConfig.name || 
					(com.synckolab.main.forceConfigType && com.synckolab.main.forceConfigType !== "contact"))
			{
				com.synckolab.main.curConfig++;
				com.synckolab.main.timer.initWithCallback({notify:function (){com.synckolab.main.nextSync();}}, com.synckolab.config.SWITCH_TIME, 0);	
				return;
			}
		}

		com.synckolab.main.gConfig = curConfig;
		com.synckolab.tools.logMessage("Trying configuration " + curConfig.name, com.synckolab.global.LOG_DEBUG);

		if (com.synckolab.main.processMsg) {
			com.synckolab.main.processMsg.value ="Configuration " + curConfig.name;
		}
		
		// run the init callback
		com.synckolab.main.curConfig++;

		// remember the sync class
		com.synckolab.main.gSync = curConfig.syncClass;

		// display stuff
		if (com.synckolab.global.wnd)
		{
			curConfig.syncClass.init(curConfig, com.synckolab.main.itemList, com.synckolab.global.wnd.document);
		}
		else
		{
			curConfig.syncClass.init(curConfig, null, document);
		}

		com.synckolab.tools.logMessage("got folder: " + curConfig.folder.URI + 
				"\nMessage Folder: " + curConfig.folderMsgURI, com.synckolab.global.LOG_DEBUG);

		// the init2 does the goon for us		
		if(curConfig.syncClass.init2) {
			com.synckolab.tools.logMessage("runnint init2 on " + curConfig.name, com.synckolab.global.LOG_DEBUG);
			curConfig.syncClass.init2(com.synckolab.main.prepareContent, curConfig.syncClass);
		}

		com.synckolab.main.timer.initWithCallback({notify:function (){com.synckolab.main.prepareContent();}}, com.synckolab.config.SWITCH_TIME, 0);
		//com.synckolab.main.timer.initWithCallback({notify:function (){com.synckolab.main.prepareContent(com.synckolab.Calendar);}}, com.synckolab.config.SWITCH_TIME, 0);
	}
	else //done
	{
		com.synckolab.tools.logMessage("Done syncing resetting ui." , com.synckolab.global.LOG_DEBUG);

		if(com.synckolab.global.wnd && !com.synckolab.global.wnd.document) {
			com.synckolab.global.wnd = null;
		}
		
		if (com.synckolab.global.wnd) {
			com.synckolab.main.totalMeter.setAttribute("value", "100%");
		}

		com.synckolab.main.meter.setAttribute("value", "100%");
		if (com.synckolab.global.wnd) {
			com.synckolab.main.statusMsg.value = com.synckolab.global.strBundle.getString("syncfinished");
		} else {
			com.synckolab.main.statusMsg.setAttribute("label", com.synckolab.global.strBundle.getString("syncfinished"));
		}

		if (com.synckolab.global.wnd) {
			com.synckolab.global.wnd.document.getElementById('cancel-button').label = com.synckolab.global.strBundle.getString("close");
		}

		// delete the temp file
		var sfile = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
		sfile.initWithPath(com.synckolab.main.gTmpFile);
		if (sfile.exists()) { 
			sfile.remove(true);
		}

		// close the status window
		var pref = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
		if (com.synckolab.tools.getConfigValue(pref, "closeWindow", com.synckolab.tools.CONFIG_TYPE_BOOL, false) && com.synckolab.global.wnd) {
			com.synckolab.global.wnd.close();
		}

		// remove all status bar elements
		try {
			if (com.synckolab.global.wnd === null)
			{
				var sb = document.getElementById("status-bar");
				if(sb) {
					sb.removeChild(com.synckolab.main.meter);
					sb.removeChild(com.synckolab.main.statusMsg);
					sb.removeChild(com.synckolab.main.curCounter);
				}
			}
		} catch (sbEx) {
			// ignore
		}

		// done autorun
		if (com.synckolab.main.forceConfig)
		{
			com.synckolab.tools.logMessage("finished autorun of config " + com.synckolab.main.forceConfig, com.synckolab.global.LOG_INFO);
			com.synckolab.main.forceConfig = null;
			com.synckolab.main.doHideWindow = false;
		}

		// set running state to done
		com.synckolab.global.running = false;
		return;
	}

	// Step 3
	if (com.synckolab.global.wnd)
	{
		com.synckolab.main.statusMsg.value = com.synckolab.global.strBundle.getString("getContent");
	}
	else
	{
		com.synckolab.main.statusMsg.setAttribute("label", com.synckolab.global.strBundle.getString("getContent"));
	}

	com.synckolab.main.meter.setAttribute("value", "5%");
};

/**
 * this function is being called just before the content parsing starts
 * its sole purpose is to make sure all messages/contacts are downloaded and refreshed
 */
com.synckolab.main.prepareContent = function() {
	
	// wait for the data (special case for calendar - they need a time to init)
	if (com.synckolab.main.gSync.dataReady() === false)
	{
		com.synckolab.main.timer.initWithCallback({notify:function (){com.synckolab.main.prepareContent();}}, com.synckolab.config.SWITCH_TIME, 0);
		return;
	}
	
	
	// update folder information from imap and make sure we got everything
	com.synckolab.main.gConfig.folder.updateFolder(msgWindow);
	// my UrlListener calls getContent
	com.synckolab.main.gConfig.folder.compact({
		OnStartRunningUrl: function ( url )
		{	
		},

		OnStopRunningUrl: function ( url, exitCode )
		{	
			com.synckolab.tools.logMessage("Finished folder frefresh; ONSTOP="+exitCode+" : " + url, com.synckolab.global.LOG_DEBUG );
			com.synckolab.main.getContent();
		}
	}, msgWindow); // this should take care of refreshes
};

com.synckolab.main.syncKolabCompact = function() {
	// update folder and compact - this prevents event triggereing
	com.synckolab.main.gConfig.folder.updateFolder(msgWindow);
	// compact folder
	try { 
		com.synckolab.main.gConfig.folder.compact(null, null);  
	} catch(e) {
		com.synckolab.tools.logMessage("ERROR: Running compact: " + e, com.synckolab.global.LOG_ERROR);
	}

	com.synckolab.main.gSync.doneParsing();
	com.synckolab.tools.logMessage("nextSync", com.synckolab.global.LOG_INFO);
	com.synckolab.main.timer.initWithCallback({notify:function (){com.synckolab.main.nextSync();}}, com.synckolab.config.SWITCH_TIME, 0);	
};


/**
 * start with the sync with the sync class
 * saves the contact folder into fileContent
 */
com.synckolab.main.getContent = function()
{	
	// check if folder REALLY exists
	com.synckolab.main.gConfig.folder.clearNewMessages();

	// get the number of messages to go through
	com.synckolab.main.totalMessages = com.synckolab.main.gConfig.folder.getTotalMessages(false);
	com.synckolab.tools.logMessage("Have to sync " + com.synckolab.main.totalMessages + " messages for the folder.", com.synckolab.global.LOG_INFO);

	// fix bug #16848 and ask before deleting everything :P
	if (com.synckolab.main.totalMessages === 0 && com.synckolab.main.gSync.itemCount() > 0)
	{
		if (window.confirm(com.synckolab.global.strBundle.getString("syncCopyToServer"))) {
			com.synckolab.main.gSync.forceServerCopy = true;
		}
	}
	else if (com.synckolab.main.totalMessages > 0 && com.synckolab.main.gSync.itemCount() === 0)
		{
			if (window.confirm(com.synckolab.global.strBundle.getString("syncCopyToClient"))) {
				com.synckolab.main.gSync.forceLocalCopy = true;
			}
		}

	// prepare empty later list
	com.synckolab.main.gLaterMessages = {
			msgs: [],
			pointer: 0
	};

	// get the message keys
	if (com.synckolab.main.gConfig.folder.getMessages) {
		com.synckolab.main.gMessages = com.synckolab.main.gConfig.folder.getMessages(null);	 // dont need the msgWindow use null
	} else {
		com.synckolab.main.gMessages = com.synckolab.main.gConfig.folder.messages; // tbird 3 uses an enumerator property instead of a function
	}

	// get the message database (a file with uid:size:date:localfile)
	com.synckolab.main.syncMessageDb = new com.synckolab.dataBase(com.synckolab.main.gConfig.dbFile);
	
	com.synckolab.main.curMessage = 0;
	com.synckolab.main.updateMessages = []; // saves the the message url to delete
	com.synckolab.main.updateMessagesContent = []; // saves the card to use to update

	if (com.synckolab.global.wnd) {
		com.synckolab.main.statusMsg.value = com.synckolab.global.strBundle.getString("syncEntries");
	} else {
		com.synckolab.main.statusMsg.setAttribute("label", com.synckolab.global.strBundle.getString("syncEntries"));
	}
	com.synckolab.main.meter.setAttribute("value", "5%");
	com.synckolab.main.timer.initWithCallback({notify:function (){com.synckolab.main.getMessage();}}, com.synckolab.config.SWITCH_TIME, 0);
};


/**
 * Get the current message into a string and then go to parseMessageRunner
 */
com.synckolab.main.getMessage = function()
{
	// pause sync...
	if (com.synckolab.global.wnd && com.synckolab.global.wnd.gPauseSync)
	{
		com.synckolab.main.timer.initWithCallback({notify:function (){com.synckolab.main.getMessage();}}, com.synckolab.config.SWITCH_TIME, 0);
		return;
	}

	if (com.synckolab.global.wnd && (com.synckolab.global.wnd.document === null || com.synckolab.global.wnd.gStopSync === true))
	{
		alert("Stopped SyncKolab...");
		com.synckolab.global.running = false;
		return;
	}

	
	var cur = null;
	// still in first run...
	if(com.synckolab.main.gLaterMessages.pointer === 0) {
		try
		{
			if (com.synckolab.main.gMessages.hasMoreElements()) {
				cur = com.synckolab.main.gMessages.getNext().QueryInterface(Components.interfaces.nsIMsgDBHdr);
			}
		}
		catch (ex)
		{
			com.synckolab.tools.logMessage("skipping read of messages - since there are none :)", com.synckolab.global.LOG_INFO);
			com.synckolab.main.updateContentAfterSave();
			return;
		}
	}

	var laterMsg = null;

	// get the messages we skipped
	if (!cur)
	{
		// done with the second run
		if (com.synckolab.main.gLaterMessages.pointer >= com.synckolab.main.gLaterMessages.msgs.length)
		{
			com.synckolab.main.gLaterMessages.msgs = [];
			// done with messages go on...
			com.synckolab.main.parseFolderToAddressFinish();
			return;
		}

		//process later message
		com.synckolab.tools.logMessage("second round process message: message " + com.synckolab.main.gLaterMessages.pointer + " of " + com.synckolab.main.gLaterMessages.msgs.length, com.synckolab.global.LOG_INFO);

		laterMsg = com.synckolab.main.gLaterMessages.msgs[com.synckolab.main.gLaterMessages.pointer++];
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
		
		if(!cur.mime2DecodedSubject || cur.mime2DecodedSubject.length < 3 || cur.mime2DecodedSubject.indexOf(" ") !== -1) {
			com.synckolab.tools.logMessage("Message '" + cur.mime2DecodedSubject + "' has an invalid subject!", com.synckolab.global.LOG_INFO);
			// skip current and process next nessage	
			skipCMessage = true;
		}

		// check if we can ignore this message because its too old (0=take all into accout)	
		if(com.synckolab.main.gConfig.type !== "contact" && com.synckolab.main.gConfig.timeFrame && com.synckolab.main.gConfig.timeFrame > 0 && skipCMessage !== true)
		{
			com.synckolab.tools.logMessage("Checking if message might be too old for now " + (new Date()).getTime(), com.synckolab.global.LOG_DEBUG);

			// now get the correct startdate (convert in milliseconds)
			if ((cur.dateInSeconds + (com.synckolab.main.gConfig.timeFrame * 86400))*1000 < (new Date()).getTime())
			{
				com.synckolab.tools.logMessage("Message " + cur.mime2DecodedSubject + " will be ignored (too old) Now: " + (new Date()).getTime(), com.synckolab.global.LOG_INFO);
				// skip current and process next nessage	
				skipCMessage = true;
			}
		}

		if (skipCMessage === true)
		{
			com.synckolab.main.curMessage++;
			if (com.synckolab.main.curMessage <= com.synckolab.main.totalMessages)
			{
				var curpointer = 5 + (55*(com.synckolab.main.curMessage/com.synckolab.main.totalMessages));
				com.synckolab.main.meter.setAttribute("value", curpointer + "%");
				if (com.synckolab.global.wnd) {
					com.synckolab.main.curCounter.setAttribute("value", com.synckolab.main.curMessage + "/" + com.synckolab.main.totalMessages);
				} else {
					com.synckolab.main.curCounter.setAttribute("label", com.synckolab.main.curMessage + "/" + com.synckolab.main.totalMessages);
				}

				// next message
				com.synckolab.main.timer.initWithCallback({notify:function (){com.synckolab.main.getMessage();}}, com.synckolab.config.SWITCH_TIME, 0);
			}
			else
			{
				com.synckolab.main.timer.initWithCallback({notify:function (){com.synckolab.main.parseFolderToAddressFinish();}}, com.synckolab.config.SWITCH_TIME, 0);
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
	com.synckolab.main.gLastMessageDBHdr = cur;
	com.synckolab.tools.logMessage("checking for synckey in local db: " + cur.mime2DecodedSubject, com.synckolab.global.LOG_DEBUG);
	com.synckolab.main.gSyncFileKey = com.synckolab.main.syncMessageDb.get(cur.mime2DecodedSubject);

	com.synckolab.main.gSyncKeyInfo = cur.mime2DecodedSubject;
	if (laterMsg) {
		com.synckolab.tools.logMessage("taking " + cur.mime2DecodedSubject + " from fist round...", com.synckolab.global.LOG_DEBUG);
		
		// get the message content into fileContent
		// parseMessageRunner is called when we got the message
		com.synckolab.main.currentMessage = {
				message: com.synckolab.main.gConfig.folderMsgURI +"#"+cur.messageKey,
				fileContent: laterMsg.content,
				nextFunc: com.synckolab.main.parseMessageRunner
		};
		com.synckolab.main.gSyncFileKey = laterMsg.fileKey;
		com.synckolab.main.parseMessageRunner();
		return;
	}
	else {
		if (com.synckolab.main.gSyncFileKey)
		{
			com.synckolab.tools.logMessage("we have " + cur.mime2DecodedSubject + " already locally...", com.synckolab.global.LOG_DEBUG);
			// check if the message has changed
			if (cur.messageSize === Number(com.synckolab.main.gSyncFileKey[1]) && cur.date === Number(com.synckolab.main.gSyncFileKey[2]))
			{
				// get the content from the cached file and ignore the imap
				com.synckolab.tools.logMessage("taking content from: " + com.synckolab.main.gSyncFileKey[3] + "/" + com.synckolab.main.gSyncFileKey[4], com.synckolab.global.LOG_DEBUG);
				
				var cachedFile = com.synckolab.tools.readSyncDBFile(com.synckolab.tools.file.getSyncDbFile(com.synckolab.main.gConfig, com.synckolab.main.gSyncFileKey[4]));
				// make sure we dont read an empty file
				if (cachedFile && cachedFile !== "" && cachedFile.synckolab)
				{
					com.synckolab.tools.logMessage("read cached file", com.synckolab.global.LOG_DEBUG);
					// parse the json
					com.synckolab.main.currentMessage = {
							fileContent: cachedFile
					};
					com.synckolab.main.parseMessageRunner();
					return;
				} else {
					com.synckolab.tools.logMessage("unable to read read cached file", com.synckolab.global.LOG_DEBUG);
					com.synckolab.main.syncMessageDb.remove(com.synckolab.main.gSyncFileKey);

					// new netry
					// remember the info
					com.synckolab.main.gSyncFileKey = {}; // we not yet know the id
					com.synckolab.main.gSyncFileKey[0] = '';
					com.synckolab.main.gSyncFileKey[1] = cur.messageSize;
					com.synckolab.main.gSyncFileKey[2] = cur.date;
					
				}
			}
			else
			{
				// some change happened... remove this entry (+ some update :P )
				com.synckolab.tools.logMessage("Cached message does not match - skipping cache read", com.synckolab.global.LOG_DEBUG);
				com.synckolab.main.syncMessageDb.remove(com.synckolab.main.gSyncFileKey);

				// new netry
				// remember the info
				com.synckolab.main.gSyncFileKey = {}; // we not yet know the id
				com.synckolab.main.gSyncFileKey[0] = '';
				com.synckolab.main.gSyncFileKey[1] = cur.messageSize;
				com.synckolab.main.gSyncFileKey[2] = cur.date;

			}
		}
		else
		{
			// remember the info
			com.synckolab.main.gSyncFileKey = {}; // we not yet know the id
			com.synckolab.main.gSyncFileKey[0] = '';
			com.synckolab.main.gSyncFileKey[1] = cur.messageSize;
			com.synckolab.main.gSyncFileKey[2] = cur.date;
		}
	}

	// get the message content into fileContent
	// parseMessageRunner is called when we got the message
	com.synckolab.main.currentMessage = {
			message: com.synckolab.main.gConfig.folderMsgURI +"#"+cur.messageKey,
			fileContent: "",
			nextFunc: com.synckolab.main.parseMessageRunner
	};
	com.synckolab.main.getMessageIntoContent(com.synckolab.main.currentMessage);
};

/**
 * 
 * @param content the content structure contianing the message key and the buffer for the content
 */
com.synckolab.main.getMessageIntoContent = function(content) {
	var aurl = {};
	com.synckolab.global.messageService.CopyMessage(
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
						com.synckolab.tools.logMessage("got Message [" + content.message + "]:\n" + content.fileContent, com.synckolab.global.LOG_DEBUG);

						// remove the header of the content
						content.fileContent = com.synckolab.tools.stripMailHeader(content.fileContent);
						
						// make sure we dont come into an endless loop here
						com.synckolab.global.triggerRunning = true;
						content.nextFunc(content);
						com.synckolab.global.triggerRunning = false;
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
com.synckolab.main.copyToFolder = function(fileName, folderUri, listener)
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
com.synckolab.main.parseMessageRunner = function()
{
	// pause sync...
	if (com.synckolab.global.wnd && com.synckolab.global.wnd.gPauseSync)
	{
		com.synckolab.main.timer.initWithCallback({notify:function (){com.synckolab.main.parseMessageRunner();}}, com.synckolab.config.SWITCH_TIME, 0);
		return;
	}

	if (com.synckolab.global.wnd && (com.synckolab.global.wnd.document === null || com.synckolab.global.wnd.gStopSync === true))
	{
		alert("Stopped SyncKolab...");
		com.synckolab.global.running = false;
		return;
	}

	var skcontent = null;
	// unparsable message... content is null and so it will skip
	if(com.synckolab.main.currentMessage && com.synckolab.main.currentMessage.fileContent) {
		com.synckolab.tools.logMessage("parsing message... ", com.synckolab.global.LOG_DEBUG);

		// fix the message for line truncs (last char in line is =)
		// content might be a preparsed json
		if(!com.synckolab.main.currentMessage.fileContent.synckolab) {
			com.synckolab.main.currentMessage.fileContent = com.synckolab.main.currentMessage.fileContent.replace(/\=\n(\S)/g, "$1");
		}
		skcontent = com.synckolab.main.gSync.parseMessage(com.synckolab.main.currentMessage.fileContent, com.synckolab.main.updateMessagesContent, (com.synckolab.main.gLaterMessages.pointer === 0));
	}

	if (skcontent === "LATER") {
		com.synckolab.tools.logMessage("keeping message for later (possible a mailing list): #" + com.synckolab.main.gLaterMessages.msgs.length, com.synckolab.global.LOG_DEBUG);
		var cMsg = {};
		cMsg.content = com.synckolab.main.currentMessage.fileContent;
		cMsg.hdr = com.synckolab.main.gLastMessageDBHdr;
		cMsg.fileKey = com.synckolab.main.gSyncFileKey;
		com.synckolab.main.gLaterMessages.msgs.push(cMsg);
	}
	else {
		// just to make sure there REALLY isnt any content left :)
		com.synckolab.main.currentMessage.fileContent = null;
		if (skcontent)
		{
			if (skcontent === "DELETEME") {
				com.synckolab.tools.logMessage("deleting [" + com.synckolab.main.currentMessage.message + "]", com.synckolab.global.LOG_INFO);
			} else {
				com.synckolab.tools.logMessage("updating [" + com.synckolab.main.currentMessage.message + "]", com.synckolab.global.LOG_INFO);
			}
			// adding message to list of to-delete messages - com.synckolab.main.gConfig.folderMsgURI +"#"+
			com.synckolab.main.updateMessages.push(com.synckolab.main.gLastMessageDBHdr); 
			com.synckolab.main.updateMessagesContent.push(skcontent); 
			com.synckolab.tools.logMessage("changed msg #" + com.synckolab.main.updateMessages.length, com.synckolab.global.LOG_INFO);
		}
		// no change... remember that :)
		else
		{
			// fill info about the file and re-add it 
			com.synckolab.main.gSyncFileKey[0] = com.synckolab.main.gSyncKeyInfo;
			com.synckolab.main.gSyncFileKey[3] = com.synckolab.main.gSync.gConfig.name;
			com.synckolab.main.gSyncFileKey[4] = com.synckolab.main.gSyncKeyInfo; //gSync.gCurUID;
			// Add the key
			com.synckolab.main.syncMessageDb.add(com.synckolab.main.gSyncFileKey);
		}
	}

	// process next nessage	
	com.synckolab.main.curMessage++;
	if (com.synckolab.main.curMessage <= com.synckolab.main.totalMessages || com.synckolab.main.gLaterMessages.pointer < com.synckolab.main.gLaterMessages.msgs.length)
	{
		var curpointer = 5 + (55*((com.synckolab.main.curMessage + com.synckolab.main.gLaterMessages.pointer)/(com.synckolab.main.totalMessages + com.synckolab.main.gLaterMessages.msgs.length)));
		com.synckolab.main.meter.setAttribute("value", curpointer + "%");

		com.synckolab.main.curCounter.setAttribute((com.synckolab.global.wnd)?"value":"label", (com.synckolab.main.curMessage + com.synckolab.main.gLaterMessages.pointer) + "/" + (com.synckolab.main.totalMessages + com.synckolab.main.gLaterMessages.msgs.length));

		if (com.synckolab.main.curMessage%20 === 0)
		{
			// save the sync db file every 20 messages.. should speed up sync if canceled
			com.synckolab.tools.logMessage("Writing message snyc-db", com.synckolab.global.LOG_DEBUG);

			// write the db file back
			com.synckolab.main.syncMessageDb.write();
		}

		// next message
		com.synckolab.main.timer.initWithCallback({notify:function (){com.synckolab.main.getMessage();}}, com.synckolab.config.SWITCH_TIME, 0);
	}
	else
	{
		com.synckolab.tools.logMessage("Done parsing " + (com.synckolab.main.totalMessages+com.synckolab.main.gLaterMessages.msgs.length), com.synckolab.global.LOG_DEBUG);
		com.synckolab.main.timer.initWithCallback({notify:function (){com.synckolab.main.parseFolderToAddressFinish();}}, com.synckolab.config.SWITCH_TIME, 0);
	}
};

//Step 6  10%
//write everything thats not yet in the message folder but is in the local db
com.synckolab.main.writeContent = function()
{
	// pause sync...
	if (com.synckolab.global.wnd && com.synckolab.global.wnd.gPauseSync)
	{
		com.synckolab.main.timer.initWithCallback({notify:function (){com.synckolab.main.writeContent();}}, com.synckolab.config.SWITCH_TIME, 0);
		return;
	}

	if (com.synckolab.global.wnd && (com.synckolab.global.wnd.document === null || com.synckolab.global.wnd.gStopSync === true))
	{
		alert("Stopped SyncKolab...");
		com.synckolab.global.running = false;
		return;
	}

	// if there happens an exception, we are done
	var skcontent = com.synckolab.main.gSync.nextUpdate();
	if (skcontent === "done")
	{
		com.synckolab.tools.logMessage("content is 'done'", com.synckolab.global.LOG_INFO);
		com.synckolab.main.writeContentAfterSave();
		return;
	}

	if (skcontent === null)
	{
		com.synckolab.tools.logMessage("content is null - continue", com.synckolab.global.LOG_WARNING);
		com.synckolab.main.timer.initWithCallback({notify:function (){com.synckolab.main.writeContent();}}, com.synckolab.config.SWITCH_TIME, 0);
		return;
	}

	if (com.synckolab.main.gConfig.saveToImap)
	{
		// write the temp file back to the original directory
		com.synckolab.tools.logMessage("WriteContent Writing...", com.synckolab.global.LOG_INFO);
		com.synckolab.main.writeImapMessage(skcontent, com.synckolab.main.gConfig, com.synckolab.main.kolabCopyServiceListener); 
	}
	else {
		com.synckolab.tools.logMessage("Skipping write to imap because of read only config...", com.synckolab.global.LOG_INFO);
		com.synckolab.main.writeContentAfterSave();
	}
};

com.synckolab.main.kolabCopyServiceListener = {
		OnProgress: function (progress, progressMax) { 
		},
		OnStartCopy: function () { 
		},
		SetMessageKey: function (key) { 
		},
		OnStopCopy: function (status) {
			if (com.synckolab.main.curStep === 5) {
				com.synckolab.main.timer.initWithCallback({notify:function (){com.synckolab.main.updateContentWrite();}}, com.synckolab.config.SWITCH_TIME, 0);
			}
			if (com.synckolab.main.curStep === 6) {
				com.synckolab.main.timer.initWithCallback({notify:function (){com.synckolab.main.writeContent();}}, com.synckolab.config.SWITCH_TIME, 0);
			}
		}
};

/**
 * write a content back to an imap folder
 * @param skcontent the content to write (an eml)
 * @param config the config to use (for the correct folder)
 * @param listener this is a callback that is used when the copy has been finished/failed
 */
com.synckolab.main.writeImapMessage = function(skcontent, config, listener) {
	// get temp file (might not yet be initialized)
	var file = Components.classes["@mozilla.org/file/directory_service;1"].getService(Components.interfaces.nsIProperties).get("TmpD", Components.interfaces.nsIFile);
	file.append("syncKolab.tmp");
	file.createUnique(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 600);
	com.synckolab.main.gTmpFile = file.path;
	
	// write the message in the temp file
	var sfile = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
	// temp path
	sfile.initWithPath(com.synckolab.main.gTmpFile);
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

	com.synckolab.tools.logMessage("Copy Message to Folder", com.synckolab.global.LOG_DEBUG);

	com.synckolab.main.copyToFolder(com.synckolab.main.gTmpFile, config.folder, listener); 
};


//done this time
com.synckolab.main.writeContentAfterSave = function()
{
	// pause sync...
	if (com.synckolab.global.wnd && com.synckolab.global.wnd.gPauseSync)
	{
		com.synckolab.main.timer.initWithCallback({notify:function (){com.synckolab.main.writeContentAfterSave();}}, com.synckolab.config.SWITCH_TIME, 0);
		return;
	}

	if (com.synckolab.global.wnd && (com.synckolab.global.wnd.document === null || com.synckolab.global.wnd.gStopSync === true))
	{
		alert("Stopped SyncKolab...");
		com.synckolab.global.running = false;
		return;
	}

	com.synckolab.tools.logMessage("Setting all messages to read...", com.synckolab.global.LOG_INFO);
	
	// before done, set all unread messages to read in the sync folder
	com.synckolab.main.gMessages = com.synckolab.main.gConfig.folder.messages; // tbird 3 uses an enumerator property instead of a function

	while (com.synckolab.main.gMessages.hasMoreElements())
	{
		var cur = com.synckolab.main.gMessages.getNext().QueryInterface(Components.interfaces.nsIMsgDBHdr);
		if (!cur.isRead)
		{
			cur.markRead(true);
		}
	}	
	com.synckolab.main.gMessages = null;


	com.synckolab.tools.logMessage("Running compact", com.synckolab.global.LOG_INFO);
	com.synckolab.main.timer.initWithCallback({notify:function (){com.synckolab.main.syncKolabCompact();}}, 2000, 0); // wait for a second or two
};


com.synckolab.main.parseFolderToAddressFinish = function()
{
	// do step 5
	com.synckolab.main.curStep = 5;
	com.synckolab.main.writeDone = false;
	com.synckolab.tools.logMessage("parseFolderToAddressFinish (Writing message db)", com.synckolab.global.LOG_DEBUG);

	// write the db file back
	com.synckolab.main.syncMessageDb.write();

	com.synckolab.main.meter.setAttribute("value", "60%");
	if (com.synckolab.global.wnd)
	{
		com.synckolab.main.statusMsg.value = com.synckolab.global.strBundle.getString("writeChangedEntries");
		com.synckolab.main.curCounter.setAttribute("value", "0/0");
	}
	else
	{
		com.synckolab.main.statusMsg.setAttribute("label", com.synckolab.global.strBundle.getString("writeChangedEntries"));
		com.synckolab.main.curCounter.setAttribute("label", "0/0");
	}


	com.synckolab.main.timer.initWithCallback({notify:function (){com.synckolab.main.updateContent();}}, com.synckolab.config.SWITCH_TIME, 0);
};


/* Remove all messages which needs to be updated or deleted.
 * The replacement messages are created in updateContentWrite().
 */
com.synckolab.main.updateContent = function()
{
	// pause sync...
	if (com.synckolab.global.wnd && com.synckolab.global.wnd.gPauseSync)
	{
		com.synckolab.main.timer.initWithCallback({notify:function (){com.synckolab.main.updateContent();}}, com.synckolab.config.SWITCH_TIME, 0);
		return;
	}

	if (com.synckolab.global.wnd && (com.synckolab.global.wnd.document === null || com.synckolab.global.wnd.gStopSync === true))
	{
		alert("Stopped SyncKolab...");
		com.synckolab.global.running = false;
		return;
	}

	com.synckolab.tools.logMessage("updating content:", com.synckolab.global.LOG_DEBUG);
	var i;
	// first lets delete the old messages
	if (com.synckolab.main.gConfig.saveToImap && com.synckolab.main.updateMessages.length > 0) 
	{
		try
		{
			com.synckolab.tools.logMessage("deleting changed messages..", com.synckolab.global.LOG_INFO);

			var list = null;
			// use mutablearray
			list = Components.classes["@mozilla.org/array;1"].createInstance(Components.interfaces.nsIMutableArray);
			for (i = 0; i < com.synckolab.main.updateMessages.length; i++)
			{
				com.synckolab.tools.logMessage("deleting [" + com.synckolab.main.updateMessages[i] + "]");
				//var hdr = com.synckolab.global.messageService.messageURIToMsgHdr(com.synckolab.main.updateMessages[i]);
				list.appendElement(com.synckolab.main.updateMessages[i], false);	
			}
			com.synckolab.main.gConfig.folder.deleteMessages(list, msgWindow, true, false, null, true);
		}
		catch (ex)
		{
			com.synckolab.tools.logMessage("Exception while deleting - skipping: " + ex, com.synckolab.global.LOG_ERROR);
		}
	}
	com.synckolab.main.curMessage = -1;
	// now write the new ones
	com.synckolab.main.timer.initWithCallback({notify:function (){com.synckolab.main.updateContentWrite();}}, com.synckolab.config.SWITCH_TIME, 0);
};

/* Write all changed messages back to the folder. Skip
 * the messages which were to be deleted from the server.
 */
com.synckolab.main.updateContentWrite = function()
{
	// pause sync...
	if (com.synckolab.global.wnd && com.synckolab.global.wnd.gPauseSync)
	{
		com.synckolab.main.timer.initWithCallback({notify:function (){com.synckolab.main.updateContentWrite();}}, com.synckolab.config.SWITCH_TIME, 0);
		return;
	}

	if (com.synckolab.global.wnd && (com.synckolab.global.wnd.document === null || com.synckolab.global.wnd.gStopSync === true))
	{
		alert("Stopped SyncKolab...");
		com.synckolab.global.running = false;
		return;
	}
	com.synckolab.main.curCounter.setAttribute("value", com.synckolab.main.curMessage + "/" + com.synckolab.main.updateMessagesContent.length);

	com.synckolab.main.curMessage++;
	if (com.synckolab.main.curMessage < com.synckolab.main.updateMessagesContent.length)
	{
		var skcontent = com.synckolab.main.updateMessagesContent[com.synckolab.main.curMessage];
		// write the message
		if (com.synckolab.main.gConfig.saveToImap && skcontent !== "DELETEME" && skcontent!== null && skcontent.length > 1)
		{
			com.synckolab.tools.logMessage("adding [" + skcontent + "] to messages", com.synckolab.global.LOG_DEBUG);
			com.synckolab.main.writeImapMessage(skcontent, com.synckolab.main.gConfig, com.synckolab.main.kolabCopyServiceListener);
		}
		else {
			com.synckolab.main.updateContentWrite();
		}
	}
	else {
		com.synckolab.main.updateContentAfterSave();
	}
};

com.synckolab.main.updateContentAfterSave =function ()
{
	com.synckolab.tools.logMessage("starting update content...", com.synckolab.global.LOG_INFO);
	com.synckolab.main.curStep = 6;
	com.synckolab.main.writeDone = false;

	if (!com.synckolab.main.gSync.initUpdate())
	{
		com.synckolab.tools.logMessage("Nothing there to update...", com.synckolab.global.LOG_INFO);
		com.synckolab.main.writeContentAfterSave();
	}

	com.synckolab.main.meter.setAttribute("value", "80%");
	if (com.synckolab.global.wnd)
	{
		com.synckolab.main.statusMsg.value = com.synckolab.global.strBundle.getString("writeNewEntries");
		com.synckolab.main.curCounter.setAttribute("value", "...");
	}
	else
	{
		com.synckolab.main.statusMsg.setAttribute("label", com.synckolab.global.strBundle.getString("writeNewEntries"));
		com.synckolab.main.curCounter.setAttribute("label", "...");
	}

	com.synckolab.main.timer.initWithCallback({notify:function (){com.synckolab.main.writeContent();}}, com.synckolab.config.SWITCH_TIME, 0);
};



