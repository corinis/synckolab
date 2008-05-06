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

/**
 * The main synckolab functions. 
 *
 */
// global variables 


// print debug information out to console
var consoleService = Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService);
// for rdf content
var rdf = Components.classes["@mozilla.org/rdf/rdf-service;1"].getService(Components.interfaces.nsIRDFService);
// IO service
var ios = Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService);
// folder data source
var gFolderDatasource = Components.classes["@mozilla.org/rdf/datasource;1?name=mailnewsfolders"].createInstance(Components.interfaces.nsIRDFDataSource);
// imap message service
var gSyncKolabMessageService=Components.classes["@mozilla.org/messenger/messageservice;1?type=imap"].getService(Components.interfaces.nsIMsgMessageService); 

// save the Version of synckolab
var gSyncKolabVersion = "0.6.2";

// holds required content

var fileContent; // holds the file content
var lines;	// the file content as lines
var addLines; // an array that saves the added lines one the content
var addLinesNum; // element is where to add the line (Number)

// hold window elements
var gWnd; 	// the message window
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
// string bundle use: strBundle.getString("KEYNAME")
var strBundle;

// Global debug setting (on)
var DEBUG_SYNCKOLAB = true;
// set this to true to also print timing information
var PERFLOG_SYNCKOLAB = true;

var LOG_ERROR = 0;
var LOG_WARNING = 1;
var LOG_INFO = 2;
var LOG_DEBUG = 3;
var LOG_CAL = 4;
var LOG_AB = 8;
var LOG_ALL = 12;

var DEBUG_SYNCKOLAB_LEVEL = LOG_ALL + LOG_DEBUG;
var SWITCH_TIME = 20; //wait 20ms

// set this to true and on every error there will be a pause so you can check the logs
var PAUSE_ON_ERROR = false;
 
// this is the timer function.. will call itself once a minute and check the configs
var gSyncTimer = -1;
var gAutoRun = -1;
var gAutoHideWindow = false;
var doHideWindow = false;

function syncKolabTimer ()
{
	gSyncTimer++;
	
	// no valid configuration or not yet read... lets see
	if (gAutoRun == null || gAutoRun <= 0)
	{
		try {
		    var pref = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
			gAutoRun = pref.getCharPref("SyncKolab.autoSync");
			gAutoHideWindow = pref.getBoolPref("SyncKolab.hiddenWindow");
		} catch(e) {
		}
	}
	else
	// lets start
	if (gSyncTimer >= gAutoRun)
	{
		logMessage("running syncKolab and resetting timer....", LOG_INFO);
		gSyncTimer = -1;
		// hide the window 
		if (gAutoHideWindow)
			doHideWindow = true;
		syncKolab();		
		doHideWindow = false;
	}
	// wait a minute
	window.setTimeout(syncKolabTimer, 60000);		 
}
  
function syncKolab(event) {

	strBundle = document.getElementById("synckolabBundle");

	if (doHideWindow)
		gWnd = null;
	else
		gWnd = window.open("chrome://synckolab/content/progressWindow.xul", "bmarks", "chrome,width=350,height=350,resizable=1");
	
	try {
	    var pref = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
		gCloseWnd = pref.getBoolPref("SyncKolab.closeWindow");
	} catch(e) {
	}
	// wait until loaded
	window.setTimeout(goWindow, SWITCH_TIME, gWnd);		 
}

function goWindow (wnd)
{
	// wait until the window is loaded
	if (wnd != null)
	{
		var statusMsg1 = wnd.document.getElementById('current-action');
		if (statusMsg1 == null || !statusMsg1)
		{
			window.setTimeout(goWindow, SWITCH_TIME, wnd);		 
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
	
	if (isCalendarAvailable ())
	{
		logMessage("Calendar available", LOG_INFO);
		include("chrome://calendar/content/importExport.js");
		include("chrome://calendar/content/calendar.js");
	}
	else
		logMessage("Calendar not available - disabling", LOG_INFO);
	
	window.setTimeout(startSync, SWITCH_TIME);		 
}

var gTmpFile;
var syncConfigs; // the configuration array

var curConConfig; // the current addressbook config
var curCalConfig; // the current calendar config
var curTaskConfig; // the current task config

function startSync(event) {
	meter.setAttribute("value", "0%");
	if (gWnd != null)
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
	}
	
	// all initialized, lets run
	window.setTimeout(nextSync, SWITCH_TIME);	
}

// this function is called after everything is done
function nextSync()
{

	if (gWnd != null)
		totalMeter.setAttribute("value", (((curConConfig+curCalConfig+curTaskConfig)*100)/(syncConfigs.length*3)) +"%");

	if (curConConfig < syncConfigs.length)
	{
		// skip problematic configs :)
		if (syncConfigs[curConConfig].length <= 0)
		{
			curConConfig++;
			window.setTimeout(nextSync, SWITCH_TIME);	
			return;
		}

		logMessage("Trying adressbook config " + syncConfigs[curConConfig], LOG_DEBUG);
		
		if (processMsg != null)
			processMsg.value ="AddressBook Configuration " + syncConfigs[curConConfig];
		// sync the address book
		syncAddressBook.init(syncConfigs[curConConfig]);	
		curConConfig++;		
		
		// maybe we do not want to sync contacts in this config
		if (!syncAddressBook.gSync)
		{
			logMessage("Skipping adressbook config " + syncConfigs[curConConfig], LOG_DEBUG);
			window.setTimeout(nextSync, SWITCH_TIME);	
			return;
		}
		else
		{
			// get and set the message folder
			syncAddressBook.folder = getMsgFolder(syncAddressBook.serverKey, syncAddressBook.folderPath);
			syncAddressBook.folderMsgURI = syncAddressBook.folder.baseMessageURI;
			syncAddressBook.email = getAccountEMail(syncAddressBook.serverKey);
			syncAddressBook.name = getAccountName(syncAddressBook.serverKey);
						
			// display stuff
			if (gWnd != null)
			{
				syncAddressBook.itemList = itemList;
				syncAddressBook.doc = gWnd.document;
			}
			else
			{
				syncAddressBook.itemList = null;
				syncAddressBook.doc = document;
			}
			
			
			logMessage("Contacts: got folder: " + syncAddressBook.folder.URI + 
				"\nMessage Folder: " + syncAddressBook.folderMsgURI, LOG_DEBUG);
				
			// remember the sync class
			gSync = syncAddressBook;
				
			window.setTimeout(prepareContent, SWITCH_TIME);	
		}	
	}
	else
	if (isCalendarAvailable () && curCalConfig < syncConfigs.length)
	{
		logMessage("Trying calendar config " + syncConfigs[curCalConfig], LOG_DEBUG);

		// skip problematic configs :)
		if (syncConfigs[curCalConfig].length <= 0)
		{
			curCalConfig++;
			window.setTimeout(nextSync, SWITCH_TIME);	
			return;
		}
		try
		{
		
			if (processMsg != null)
				processMsg.value ="Calendar Configuration " + syncConfigs[curCalConfig];
			// make sure not to sync tasks
			syncCalendar.syncTasks = false;
			syncCalendar.init(syncConfigs[curCalConfig]);
			
			// maybe we do not want to sync calendar in this config
			if (!syncCalendar.gSync)
			{
				logMessage("Skipping calendar config " + syncConfigs[curCalConfig], LOG_DEBUG);
				curCalConfig++;
				window.setTimeout(nextSync, SWITCH_TIME, syncCalendar);	
				return;
			}
			else
			{		
				curCalConfig++;
				syncCalendar.folder = getMsgFolder(syncCalendar.serverKey, syncCalendar.folderPath);		
				syncCalendar.folderMsgURI = syncCalendar.folder.baseMessageURI;
				syncCalendar.email = getAccountEMail(syncCalendar.serverKey);
				syncCalendar.name = getAccountName(syncCalendar.serverKey);
				
		
				// display stuff
				if (gWnd != null)
				{
					syncCalendar.itemList = itemList;
					syncCalendar.doc = gWnd.document;
				}
				else
				{
					syncCalendar.itemList = null;
					syncCalendar.doc = document;
				}
		
				logMessage("Calendar: got calendar: " + syncCalendar.gCalendar.name + 
					"\nMessage Folder: " + syncCalendar.folderMsgURI, LOG_DEBUG);

				// remember the sync class
				gSync = syncCalendar;
				
				// the init2 does the goon for us		
				syncCalendar.init2(prepareContent, syncCalendar);

				window.setTimeout(prepareContent, SWITCH_TIME, syncCalendar);
				return;
	        }
	    }
	    catch (ex)
	    {
	    	// if an exception is found print it and continue
			logMessage("Error setting calendar config: " + ex, LOG_DEBUG);
			curCalConfig++;
			window.setTimeout(nextSync, SWITCH_TIME);	
			return;
	    }
	}
	else
	if (isCalendarAvailable () && curTaskConfig < syncConfigs.length)
	{

		logMessage("Trying task config " +curTaskConfig+ ": " + syncConfigs[curTaskConfig], LOG_DEBUG);
		// skip problematic configs :)
		if (syncConfigs[curTaskConfig].length <= 0)
		{
			curTaskConfig++;
			window.setTimeout(nextSync, SWITCH_TIME);	
			return;
		}
		
		try
		{
			if (processMsg != null)
				processMsg.value ="Task Configuration " + syncConfigs[curTaskConfig];
			// sync tasks
			syncCalendar.syncTasks = true;
			syncCalendar.init(syncConfigs[curTaskConfig]);
			curTaskConfig++;
			
			// maybe we do not want to sync calendar in this config
			if (!syncCalendar.gSync)
			{
				logMessage("skipping task config " + syncConfigs[curTaskConfig], LOG_DEBUG);
				window.setTimeout(nextSync, SWITCH_TIME, syncCalendar);	
				return;
			}
			else
			{		
				syncCalendar.folder = getMsgFolder(syncCalendar.serverKey, syncCalendar.folderPath);		
				syncCalendar.folderMsgURI = syncCalendar.folder.baseMessageURI;
				syncCalendar.email = getAccountEMail(syncCalendar.serverKey);
				syncCalendar.name = getAccountName(syncCalendar.serverKey);
				
		
				// display stuff
				if (gWnd != null)
				{
					syncCalendar.itemList = itemList;
					syncCalendar.doc = gWnd.document;
				}
				else
				{
					syncCalendar.itemList = null;
					syncCalendar.doc = document;
				}
		
				logMessage("Calendar: got calendar: " + syncCalendar.gCalendar.name + 
					"\nMessage Folder: " + syncCalendar.folderMsgURI, LOG_DEBUG);

				// remember the sync class
				gSync = syncCalendar;

				// the init2 does the goon for us		
				syncCalendar.init2(prepareContent, syncCalendar);

				window.setTimeout(prepareContent, SWITCH_TIME, syncCalendar);
				return;
	        }
	    }
	    catch (ex)
	    {
	    	// if an exception is found print it and continue
			dump("Error setting task config: " + ex + "\n");
			curTaskConfig++;
			window.setTimeout(nextSync, SWITCH_TIME);	
			return;
	    }
	}
	else //done
	{
		if (gWnd != null)
			totalMeter.setAttribute("value", "100%");
		
		meter.setAttribute("value", "100%");
		if (gWnd != null)
			statusMsg.value = strBundle.getString("syncfinished");
		else
			statusMsg.setAttribute("label", strBundle.getString("syncfinished"));
		
		if (gWnd != null)
			gWnd.document.getElementById('cancel-button').label = strBundle.getString("close"); 
		// delete the temp file
		var sfile = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
		sfile.initWithPath(gTmpFile);
		if (sfile.exists()) 
			sfile.remove(true);
			
		// close the status window
		if (gCloseWnd && gWnd != null)
			gWnd.close();

		// remove all status bar elements
		if (gWnd == null)
		{
			var sb = document.getElementById("status-bar");
		
			sb.removeChild(meter);
			sb.removeChild(statusMsg);
			sb.removeChild(curCounter);
		}
			
		return;
	}
	
	// Step 3
	if (gWnd != null)
	{
		statusMsg.value = strBundle.getString("getContent");
	}
	else
	{
		statusMsg.setAttribute("label", strBundle.getString("getContent"));
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

// this function is being called just before the content parsing starts
// its sole purpose is to make sure all messages are downloaded and refreshed
function prepareContent ()
{
	// update folder information from imap and make sure we got everything
	gSync.folder.updateFolder (msgWindow);
	// my UrlListener calls getContent
	gSync.folder.compact (syncKolabUrlListener, msgWindow); // this should take care of refreshes
	
}

// start with the sync with the sync class
// saves the contact folder into fileContent
function getContent ()
{	
	// check if folder REALLY exists
	gSync.folder.clearNewMessages ();

	// get the number of messages to go through
	totalMessages = gSync.folder.getTotalMessages(false);
	logMessage("Have to sync " + totalMessages + " messages for the folder.", LOG_INFO);
	
	// fix bug #16848 and ask before deleting everything :P
	if (totalMessages == 0 && gSync.itemCount() > 0)
	{
		if (window.confirm("No items have been found on the server, but there are local items.\nDo you want to copy all items to the server?"))
			gSync.forceServerCopy = true;
	}
	else
	if (totalMessages > 0 && gSync.itemCount() == 0)
	{
		if (window.confirm("No items have been found locally, but there are items on the server.\nDo you want to copy all items from the server?"))
			gSync.forceLocalCopy = true;
	}
	
		
	// get the message keys
	gMessages = gSync.folder.getMessages(null);	 // dont need the msgWindow use null
	
	// get the message database (a file with uid:size:date:localfile)
	syncMessageDb = readDataBase(gSync.dbFile);
		
	curMessage = 0;
	updateMessages = new Array(); // saves the the message url to delete
	updateMessagesContent = new Array(); // saves the card to use to update
	
	if (gWnd != null)
		statusMsg.value = strBundle.getString("syncEntries");
	else
		statusMsg.setAttribute("label", strBundle.getString("syncEntries"));
	meter.setAttribute("value", "5%");
	window.setTimeout(getMessage, SWITCH_TIME);	
}

var gLastMessageDBHdr; // save last message header

// Get the current message into a string and then go to parseMessageRunner
function getMessage ()
{
	// pause sync...
	if (gWnd != null && gWnd.gPauseSync)
	{
		window.setTimeout(getMessage, SWITCH_TIME);
		return;
	}
	if (gWnd != null && gWnd.gStopSync)
	{
		alert("Stopped SyncKolab...");
		return;
	}
		
 	var cur = null
 	try
 	{
 		if (gMessages.hasMoreElements ())
			cur = gMessages.getNext().QueryInterface(Components.interfaces.nsIMsgDBHdr);
		else
		{
			// done with messages go on...
			parseFolderToAddressFinish ();
	    	return;
		}					
	}
	catch (ex)
	{
    	logMessage("skipping read of messages - since there are none :)", LOG_INFO);
		updateContentAfterSave ();
    	return;
	}
	
	// check message flags (based on mailnews\base\public\nsMsgMessageFlags.h -> deleted=0x200000
	logMessage("Message " + cur.mime2DecodedSubject + " (dateInSeconds: " + cur.dateInSeconds + ") has flags: " + cur.flags + " flag imap_deleted? " + (cur.flags&0x200000), LOG_DEBUG);
	var skipCMessage = false;
	
	if (cur.flags&0x200000)
	{
		logMessage("Message " + cur.mime2DecodedSubject + " has been DELETED on imap!", LOG_INFO);
		// skip current and process next nessage	
		skipCMessage = true;
		
	}
	
	// check if we can ignore this message because its too old (0=take all into accout)	
	if(gSync.gSyncTimeFrame > 0 && skipCMessage != true)
	{
		logMessage("Checking if message might be too old for now " + (new Date()).getTime(), LOG_DEBUG);

		// now get the correct startdate (convert in milliseconds)
		if ((cur.dateInSeconds + (gSync.gSyncTimeFrame * 86400))*1000 < (new Date()).getTime())
		{
			logMessage("Message " + cur.mime2DecodedSubject + " will be ignored (too old) Now: " + (new Date()).getTime(), LOG_INFO);
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
			if (gWnd != null)
				curCounter.setAttribute("value", curMessage + "/" + totalMessages);
			else
				curCounter.setAttribute("label", curMessage + "/" + totalMessages);
			
			// next message
			window.setTimeout(getMessage, SWITCH_TIME);	
		}
		else
		{
			window.setTimeout(parseFolderToAddressFinish, SWITCH_TIME);	
		}
		return;
	}
//	PRTime?
//	cur.date
	
	
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
	gSyncFileKey = getDbEntryIdx(cur.mime2DecodedSubject, syncMessageDb);

	gSyncKeyInfo = cur.mime2DecodedSubject;
	if (gSyncFileKey > -1)
	{
		logMessage("we have " + cur.mime2DecodedSubject + " already locally...", LOG_DEBUG);
		// check if the message has changed
		if (cur.messageSize == syncMessageDb[gSyncFileKey][1] && cur.date == syncMessageDb[gSyncFileKey][2])
		{
			// get the content from the cached file and ignore the imap
			logMessage("taking content from: " + syncMessageDb[gSyncFileKey][3] + "/" + syncMessageDb[gSyncFileKey][4], LOG_INFO);
			fileContent = readSyncDBFile(getSyncDbFile(syncMessageDb[gSyncFileKey][3], gSync.getType(), syncMessageDb[gSyncFileKey][4]));

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
			syncMessageDb[gSyncFileKey][0] = '';
			syncMessageDb[gSyncFileKey][1] = cur.messageSize;
			syncMessageDb[gSyncFileKey][2] = cur.date;			
		}
	}
	else
	{
		// remember the info
		gSyncFileKey = syncMessageDb.length; 
		syncMessageDb[gSyncFileKey] = {};
		syncMessageDb[gSyncFileKey][0] = '';
		syncMessageDb[gSyncFileKey][1] = cur.messageSize;
		syncMessageDb[gSyncFileKey][2] = cur.date;			
	}
	
	
	// get the message content into fileContent
	// parseMessageRunner is called when we got the message
	fileContent = "";
	gCurMessageKey = cur.messageKey;
	var aurl = new Object();	
	gSyncKolabMessageService.CopyMessage(
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
		logMessage("Finished folder frefresh; ONSTOP="+exitCode+" : " + url, LOG_DEBUG );
		getContent();
	}
}

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
    logMessage("got Message [" + gSync.folderMsgURI +"#"+gCurMessageKey + "]:\n" + fileContent, LOG_DEBUG);
    
    // remove the header of the content
    fileContent = stripMailHeader(fileContent);
    
    // stop here for testing
    parseMessageRunner ();
 }
};
    
/**
 * we now got the message content. this needs to parsed and checked 
 */
function parseMessageRunner ()
{
	// pause sync...
	if (gWnd != null && gWnd.gPauseSync)
	{
		window.setTimeout(parseMessageRunner, SWITCH_TIME);	
		return;
	}
	if (gWnd != null && gWnd.gStopSync)
	{
		alert("Stopped SyncKolab...");
		return;
	}

	
   	logMessage("parsing message... ", LOG_DEBUG);
	
	// fix the message for line truncs (last char in line is =)
	fileContent = fileContent.replace(/=\n/g, "");
	
	var content = gSync.parseMessage(fileContent, updateMessagesContent);
	
	// just to make sure there REALLY isnt any content left :)
	fileContent = "";
	if (content != null)
	{
		if (content == "DELETEME")
			logMessage("updating and/or deleting [" + gSync.folderMsgURI +"#"+gCurMessageKey + "]", LOG_INFO);
		else
			logMessage("updating [" + gSync.folderMsgURI +"#"+gCurMessageKey + "]", LOG_INFO);
		// adding message to list of to-delete messages - gSync.folderMsgURI +"#"+
		updateMessages.push(gLastMessageDBHdr); 
		updateMessagesContent.push(content); 
		logMessage("changed msg #" + updateMessages.length, LOG_INFO);
	}
	// no change... remember that :)
	else
	{
		// get the sync db file
		syncMessageDb[gSyncFileKey][0] = gSyncKeyInfo;
		syncMessageDb[gSyncFileKey][3] = gSync.gConfig;
		syncMessageDb[gSyncFileKey][4] = gSync.gCurUID;
	}

	// process next nessage	
	curMessage++;
	if (curMessage <= totalMessages)
	{
		var curpointer = 5 + (55*(curMessage/totalMessages));
		meter.setAttribute("value", curpointer + "%");
		if (gWnd != null)
			curCounter.setAttribute("value", curMessage + "/" + totalMessages);
		else
			curCounter.setAttribute("label", curMessage + "/" + totalMessages);

		if (curMessage%20 == 0)
		{
			// save the sync db file every 20 messages.. should speed up sync if canceled
		    logMessage("Writing message snyc-db", LOG_DEBUG);
	    
		    // write the db file back
		    if (syncMessageDb == null)
			    logMessage("syncMessageDB is null: " + gSync.dbFile, LOG_ERROR);
		    else
			    writeDataBase(gSync.dbFile, syncMessageDb);
		}
				
		// next message
		window.setTimeout(getMessage, SWITCH_TIME);	
	}
	else
	{
		window.setTimeout(parseFolderToAddressFinish, SWITCH_TIME);	
	}
}


var cards;
var writeDone;

function parseFolderToAddressFinish ()
{
	// do step 5
	curStep = 5;
	writeDone = false;
    logMessage("parseFolderToAddressFinish (Writing message db)", LOG_DEBUG);
    
    // write the db file back
    if (syncMessageDb == null)
	    logMessage("syncMessageDB is null: " + gSync.dbFile, LOG_ERROR);
    else
	    writeDataBase(gSync.dbFile, syncMessageDb);

	meter.setAttribute("value", "60%");
	if (gWnd != null)
	{
		statusMsg.value = strBundle.getString("writeChangedEntries");
		curCounter.setAttribute("value", "0/0");
	}
	else
	{
		statusMsg.setAttribute("label", strBundle.getString("writeChangedEntries"));
		curCounter.setAttribute("label", "0/0");
	}
	
	
	window.setTimeout(updateContent, SWITCH_TIME);	
}


/* Remove all messages which needs to be updated or deleted.
 * The replacement messages are created in updateContentWrite().
 */
function updateContent()
{
	// pause sync...
	if (gWnd != null && gWnd.gPauseSync)
	{
		window.setTimeout(updateContent, SWITCH_TIME);	
		return;
	}
		
	if (gWnd != null && gWnd.gStopSync)
	{
		alert("Stopped SyncKolab...");
		return;
	}

    logMessage("updating content:", LOG_DEBUG);
	// first lets delete the old messages
	if (gSync.gSaveImap && updateMessages.length > 0) 
	{
		try
		{
			logMessage("deleting changed messages..", LOG_INFO);
			var list = Components.classes["@mozilla.org/supports-array;1"].createInstance(Components.interfaces.nsISupportsArray);
			for (var i = 0; i < updateMessages.length; i++)
			{
				logMessage("deleting [" + updateMessages[i] + "]");
				//var hdr = gSyncKolabMessageService.messageURIToMsgHdr(updateMessages[i]);
				list.AppendElement(updateMessages[i]);	
		    
			}
			gSync.folder.deleteMessages (list, msgWindow, true, false, null, true);		
		}
		catch (ex)
		{
		    logMessage("Exception while deleting - skipping", LOG_ERROR);
		}
	}
	curMessage = -1;
	// now write the new ones
	window.setTimeout(updateContentWrite, SWITCH_TIME);	
}

/* Write all changed messages back to the folder. Skip
 * the messages which were to be deleted from the server.
 */
function updateContentWrite ()
{
	// pause sync...
	if (gWnd != null && gWnd.gPauseSync)
	{
		window.setTimeout(updateContentWrite, SWITCH_TIME);	
		return;
	}
		
	if (gWnd != null && gWnd.gStopSync)
	{
		alert("Stopped SyncKolab...");
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
			logMessage("adding [" + content + "] to messages", LOG_DEBUG);
			// temp path
			sfile.initWithPath(gTmpFile);
			if (sfile.exists()) 
				sfile.remove(true);
			sfile.create(sfile.NORMAL_FILE_TYPE, 0666);
		  
			// make the message rfc compatible (make sure all lines en with \r\n)
			content = content.replace(/\r\n|\n|\r/g, "\r\n");
			
			// create a new message in there
		 	var stream = Components.classes['@mozilla.org/network/file-output-stream;1'].createInstance(Components.interfaces.nsIFileOutputStream);
		 	stream.init(sfile, 2, 0x200, false); // open as "write only"
			stream.write(content, content.length);
			stream.close();
			
			// write the temp file back to the original directory
			copyToFolder (gTmpFile, gSync.folder); 
			//copyToFolder (gTmpFile, tempFolderUri); // to the temp folder for testing!!!
		}
		else
			updateContentWrite ();
	}
	else
		updateContentAfterSave ();
	
}

function updateContentAfterSave ()
{
	logMessage("starting update content...", LOG_INFO);
	curStep = 6;
	writeDone = false;
	
	if (!gSync.initUpdate())
	{
		logMessage("Nothing there to update...", LOG_INFO);
		writeContentAfterSave ();
	}

	meter.setAttribute("value", "80%");
	if (gWnd != null)
	{
		statusMsg.value = strBundle.getString("writeNewEntries");
		curCounter.setAttribute("value", "...");
	}
	else
	{
		statusMsg.setAttribute("label", strBundle.getString("writeNewEntries"));
		curCounter.setAttribute("label", "...");
	}
	
	window.setTimeout(writeContent, SWITCH_TIME);	
}

// Step 6  10%
// write everything thats not yet in the message folder
function writeContent ()
{
	// pause sync...
	if (gWnd != null && gWnd.gPauseSync)
	{
		window.setTimeout(writeContent, SWITCH_TIME);	
		return;
	}
		
	if (gWnd != null && gWnd.gStopSync)
	{
		alert("Stopped SyncKolab...");
		return;
	}

	// if there happens an exception, we are done
	var content = gSync.nextUpdate();
	if (content == "done")
	{
			writeContentAfterSave ();
			return;
	}
	
	if (content == null)
	{
		window.setTimeout(writeContent, SWITCH_TIME);	
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
		sfile.create(sfile.NORMAL_FILE_TYPE, 0666);
	  
		// make the message rfc compatible (make sure all lines en with \r\n)
    	content = content.replace(/\r\n|\n\r|\n|\r/g, "\r\n");

		// create a new message in there
	 	var stream = Components.classes['@mozilla.org/network/file-output-stream;1'].createInstance(Components.interfaces.nsIFileOutputStream);
	 	stream.init(sfile, 2, 0x200, false); // open as "write only"
		stream.write(content, content.length);
		stream.close();
		
		// write the temp file back to the original directory
		logMessage("WriteContent Writing...", LOG_INFO);
		copyToFolder (gTmpFile, gSync.folder); 
	}
	else
			writeContentAfterSave ();

}


// done this time
function writeContentAfterSave ()
{
	// pause sync...
	if (gWnd != null && gWnd.gPauseSync)
	{
		window.setTimeout(writeContentAfterSave, SWITCH_TIME);	
		return;
	}
	if (gWnd != null && gWnd.gStopSync)
	{
		alert("Stopped SyncKolab...");
		return;
	}

	logMessage("Setting all messages to read...", LOG_INFO);
	// before done, set all unread messages to read in the sync folder
	gMessages = gSync.folder.getMessages(msgWindow);	
	while (gMessages.hasMoreElements ())
	{
		cur = gMessages.getNext().QueryInterface(Components.interfaces.nsIMsgDBHdr);
		if (!cur.isRead)
		{
			cur.markRead(true);
		}
	}	
	gMessages = null;
	

	logMessage("Running compact", LOG_INFO);
	window.setTimeout(compact, 2000);  // wait for a second
}

function compact() {
	// compact golder
	try { 
		gSync.folder.compact(null, null);  
	} catch(e) { }
	
	gSync.doneParsing();
	logMessage("nextSync", LOG_INFO);
	window.setTimeout(nextSync, SWITCH_TIME);	
}


/**
 * Copies a local file into any mail folder.
 * In order to be displayed correct, make sure to create a complete message file!!!
 * fileName string - the file to copy(+path)
 * folderUri string - the Uri/Url of the folder we want this in
 */
function copyToFolder (fileName, folderUri)
{
	var mailFolder = folderUri; //RDF.GetResource(folderUri).QueryInterface(Components.interfaces.nsIMsgFolder);
	var fileSpec = Components.classes["@mozilla.org/filespec;1"].createInstance(Components.interfaces.nsIFileSpec);	
	fileSpec.nativePath = fileName;

	// at this pont, check the content, we do not write a load of bogus messages in the imap folder
	//alert ("File content:" + fileSpec.fileContents);
	
	copyservice = Components.classes["@mozilla.org/messenger/messagecopyservice;1"].getService(Components.interfaces.nsIMsgCopyService);
	// in order to be able to REALLY copy the message setup a listener
	// and mark as read
	copyservice.CopyFileMessage(fileSpec, mailFolder, null, false, 0x000001, kolabCopyServiceListener, null); // dont need a msg window
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
			window.setTimeout(updateContentWrite, SWITCH_TIME);	
		if (curStep == 6)
			window.setTimeout(writeContent, SWITCH_TIME);	
	}  
};


function scrollToBottom ()
{
	if (gWnd != null)
	{
		// select and deselect the newly appended item (makes it scroll to the bottom)				
		var lastItemPos = gWnd.document.getElementById('itemList').getRowCount() - 1;
		if (lastItemPos > 0)
		{
			gWnd.document.getElementById('itemList').scrollToIndex(lastItemPos);
			gWnd.document.getElementById('itemList').ensureIndexIsVisible(lastItemPos);
		}
	}
}
