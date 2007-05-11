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
var gMessageService=Components.classes["@mozilla.org/messenger/messageservice;1?type=imap"].getService(Components.interfaces.nsIMsgMessageService); 

// save the Version of synckolab
var gVersion = "0.4.33";

// holds required content
var gSyncContact; // sync the contacts
var gSyncCalendar; // sync the calendar

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

// progress variables 
var curStep;


// Global debug setting (on)
var DEBUG_SYNCKOLAB = true;
var DEBUG_SYNCKOLAB_LEVEL = 3;
var SWITCH_TIME = 50;
 
function syncKolab(event) {
	// copy a file to a folder
	// call external func
	//Copart, added resizeable property to allow user to enlarge window when needed
	gWnd = window.open("chrome://synckolab/content/progressWindow.xul", "bmarks", "chrome,width=350,height=350,resizable=1");
	
	try {
    var pref = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
		gSyncContact = pref.getBoolPref("SyncKolab.syncContacts");
		gSyncCalendar = pref.getBoolPref("SyncKolab.syncCalendar");
		gCloseWnd = pref.getBoolPref("SyncKolab.closeWindow");
	} catch(e) {
	}
	// wait until loaded
	window.setTimeout(goWindow, SWITCH_TIME, gWnd);		 
}

function goWindow (wnd)
{
		var statusMsg1 = wnd.document.getElementById('current-action');
		if (statusMsg1 == null || !statusMsg1)
		{
			window.setTimeout(goWindow, SWITCH_TIME, wnd);		 
		}
		else
		{
				// some window elements for displaying the status
				meter = wnd.document.getElementById('progress');
				totalMeter = wnd.document.getElementById('totalProgress');
				statusMsg = wnd.document.getElementById('current-action');
				processMsg = wnd.document.getElementById('current-process');
				curCounter = wnd.document.getElementById('current-counter');
				itemList = wnd.document.getElementById('itemList');
				if (isCalendarAvailable ())
				{
					logMessage("Calendar available", 1);
					include("chrome://calendar/content/importExport.js");
					include("chrome://calendar/content/calendar.js");
				}
				else
					logMessage("Calendar not available - disabling", 1);
				
				window.setTimeout(startSync, SWITCH_TIME);		 
		}
}

var gTmpFile;
var conConfigs; // the addressbook configuration array
var calConfigs; // the calendar configuration array
var curConConfig; // the current addressbook config
var curCalConfig; // the current calendar config

function startSync(event) {
	meter.setAttribute("value", "0%");
	totalMeter.setAttribute("value", "0%");

	// get temp file
	var file = Components.classes["@mozilla.org/file/directory_service;1"].
	   getService(Components.interfaces.nsIProperties).
	   get("TmpD", Components.interfaces.nsIFile);
	file.append("syncKolab.tmp");
	file.createUnique(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 0664);
	gTmpFile = file.path;
	
	conConfigs = new Array();
	calConfigs = new Array();		
	curConConfig = 0;
	curCalConfig = 0;
	
	try {
		var conConfig = pref.getCharPref("SyncKolab.AddressBookConfigs");
		conConfigs = conConfig.split(';');
	} catch(ex) 
	{
	}
	
	if (isCalendarAvailable ())
	{
		try {
			var calConfig = pref.getCharPref("SyncKolab.CalendarConfigs");
			calConfigs = calConfig.split(';');
		}
		catch(ex) {}
	}

	// all initialized, lets run
	window.setTimeout(nextSync, SWITCH_TIME);	
}

// this function is called after everything is done
function nextSync()
{
	totalMeter.setAttribute("value", (((curConConfig+curCalConfig)*100)/(conConfigs.length+calConfigs.length)) +"%");

	if (gSyncContact && curConConfig < conConfigs.length)
	{
		// skip problematic configs :)
		if (conConfigs[curConConfig].length <= 0)
		{
			curConConfig++;
			window.setTimeout(nextSync, SWITCH_TIME);	
			return;
		}
		
		processMsg.value ="AddressBook Configuration " + conConfigs[curConConfig];
		// sync the address book
		syncAddressBook.init(conConfigs[curConConfig]);	
		// get and set the message folder
		syncAddressBook.folder = getMsgFolder(syncAddressBook.serverKey, syncAddressBook.folderPath);
		syncAddressBook.folderMsgURI = syncAddressBook.folder.baseMessageURI;
		syncAddressBook.email = getAccountEMail(syncAddressBook.serverKey);
		syncAddressBook.name = getAccountName(syncAddressBook.serverKey);
		
		// display stuff
		syncAddressBook.itemList = itemList;
		
		logMessage("Contacts: got folder: " + syncAddressBook.folder.URI + 
			"\nMessage Folder: " + syncAddressBook.folderMsgURI, 1);
			
		curConConfig++;
		window.setTimeout(getContent, SWITCH_TIME, syncAddressBook);	
	}
	else
	if (isCalendarAvailable () && gSyncCalendar && curCalConfig < calConfigs.length)
	{

		// skip problematic configs :)
		if (calConfigs[curCalConfig].length <= 0)
		{
			curCalConfig++;
			window.setTimeout(nextSync, SWITCH_TIME);	
			return;
		}

		processMsg.value ="Calendar Configuration " + calConfigs[curCalConfig];
		syncCalendar.init(calConfigs[curCalConfig]);
		syncCalendar.folder = getMsgFolder(syncCalendar.serverKey, syncCalendar.folderPath);		
		syncCalendar.folderMsgURI = syncCalendar.folder.baseMessageURI;
		syncCalendar.email = getAccountEMail(syncCalendar.serverKey);
		syncCalendar.name = getAccountName(syncCalendar.serverKey);
		

		// display stuff
		syncCalendar.itemList = itemList;

		logMessage("Calendar: got calendar: " + syncCalendar.gCalendar.name + 
			"\nMessage Folder: " + syncCalendar.folderMsgURI, 1);
		curCalConfig++;

		syncCalendar.init2(getContent, syncCalendar);
        window.setTimeout(getContent, SWITCH_TIME, syncCalendar);		
	}
	else //done
	{
		totalMeter.setAttribute("value", "100%");
		meter.setAttribute("value", "100%");
		statusMsg.value ="Done. You can close this window now!";
		gWnd.document.getElementById('cancel-button').label = "Close"; //Added by Copart, a little bit more clear that it is now safe to close the window
		// delete the temp file
		var sfile = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
		sfile.initWithPath(gTmpFile);
		if (sfile.exists()) 
			sfile.remove(true);
			
		// close the status window
		if (gCloseWnd)
			gWnd.close();
		return;
	}
	
	
	// Step 3
	statusMsg.value ="Getting Content ...";
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

// start with the sync with the sync class
// saves the contact folder into fileContent
function getContent (sync)
{
	// remember the sync class
	gSync = sync;
	
	// check if folder REALLY exists
	sync.folder.clearNewMessages ();
	//sync.folder.downloadAllForOffline (myUrlListener, msgWindow);

	// get the number of messages to go through
	totalMessages = sync.folder.getTotalMessages(false);
	logMessage("Have to sync " + totalMessages + " messages for the folder.", 1);
	
	// fix bug #16848 and ask before deleting everything :P
	if (totalMessages == 0 && sync.itemCount() > 0)
	{
		if (window.confirm("No items have been found on the server, but there are local items.\nDo you want to copy all items to the server?"))
			sync.forceServerCopy = true;
	}
	else
	if (totalMessages > 0 && sync.itemCount() == 0)
	{
		if (window.confirm("No items have been found locally, but there are items on the server.\nDo you want to copy all items from the server?"))
			sync.forceLocalCopy = true;
	}
	
		
	// get the message keys
	gMessages = sync.folder.getMessages(msgWindow);	
		
	curMessage = 0;
	updateMessages = new Array(); // saves the the message url to delete
	updateMessagesContent = new Array(); // saves the card to use to update
	
	
	statusMsg.value = "Synchronizing entries...";
	meter.setAttribute("value", "5%");
	window.setTimeout(getMessage, SWITCH_TIME);	
	// the unique id is in second token in the mail subject (f.e. pas-id-3EF6F3700000002E) and
	// saved in the custom4 field of the card (is there an id field??)
}


// Get the current message into a string and then go to parseMessageRunner
function getMessage ()
{
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
    	logMessage("skipping read of messages - since there are none :)", 1);
		updateContentAfterSave ();
    	return;
	}
	// get the message content into fileContent
	// parseMessageRunner is called when we got the message
	fileContent = "";
	gCurMessageKey = cur.messageKey;
	var aurl = new Object();	
	gMessageService.CopyMessage(
        gSync.folderMsgURI +"#"+gCurMessageKey,
        myStreamListener, false, null, msgWindow, aurl
        ); 
}

var myUrlListener = {
	OnStartRunningUrl: function ( url )
	{	},
	
	OnStopRunningUrl: function ( url, exitCode )
	{	}
}

// nsIStreamListener
var myStreamListener = {
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
    //logMessage("got Message [" + gSync.folderMsgURI +"#"+gCurMessageKey + "]:\n" + fileContent, 3);
    // stop here for testing
    parseMessageRunner ();
 }
};
    
/**
 * we now got the message content. this needs to parsed and checked 
 */
function parseMessageRunner ()
{
   	logMessage("parsing message...", 2);
	
	// fix the message for line truncs (last char in line is =)
	fileContent = fileContent.replace(/=\n/g, "");
	
	var content = gSync.parseMessage(fileContent, updateMessagesContent);
	// just to make sure there REALLY isnt any content left :)
	fileContent = "";
	if (content != null)
	{
		if (content == "DELETEME")
			logMessage("updating and deleting [" + gSync.folderMsgURI +"#"+gCurMessageKey + "]", 1);
		else
			logMessage("updating [" + gSync.folderMsgURI +"#"+gCurMessageKey + "]", 1);
		updateMessages.push(gSync.folderMsgURI +"#"+gCurMessageKey); 
		updateMessagesContent.push(content); 
		logMessage("changed msg #" + updateMessages.length, 1);
	}
	
	
	curMessage++;
	if (curMessage <= totalMessages)
	{
		var curpointer = 5 + (55*(curMessage/totalMessages));
		meter.setAttribute("value", curpointer + "%");
		curCounter.setAttribute("value", curMessage + "/" + totalMessages);
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
    logMessage("parseFolderToAddressFinish", 1);

	meter.setAttribute("value", "60%");
	statusMsg.value = "Writing changed entries...";
	curCounter.setAttribute("value", "0/0");
	window.setTimeout(updateContent, SWITCH_TIME);	
}


/* Remove all messages which needs to be updated or deleted.
 * The replacement messages are created in updateContentWrite().
 */
function updateContent()
{
    logMessage("updating content:", 1);
	// first lets delete the old messages
	if (gSync.gSaveImap && updateMessages.length > 0) 
	{
		try
		{
			logMessage("deleting changed messages..", 1);
			var list = Components.classes["@mozilla.org/supports-array;1"].createInstance(Components.interfaces.nsISupportsArray);
			for (var i = 0; i < updateMessages.length; i++)
			{
				logMessage("deleting [" + updateMessages[i] + "]");
				var hdr = gMessageService.messageURIToMsgHdr(updateMessages[i]);
				list.AppendElement(hdr);		
		    
			}
			gSync.folder.deleteMessages (list, msgWindow, true, false, null, true);		
			logMessage("done..");
		}
		catch (ex)
		{
		    logMessage("Exception while deleting - skipping", 1);
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
	curCounter.setAttribute("value", curMessage + "/" + updateMessagesContent.length);

	curMessage++;
	if (curMessage < updateMessagesContent.length)
	{
		var content = updateMessagesContent[curMessage];
		// write the message
		if (gSync.gSaveImap && content != "DELETEME")
		{
			// write the message in the temp file
			var sfile = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
			logMessage("adding [" + content + "] to messages", 1);
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
			copyToFolder (gTmpFile, gSync.folder.folderURL);
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
	logMessage("starting update content...", 1);
	curStep = 6;
	writeDone = false;
	
	if (!gSync.initUpdate())
	{
		logMessage("Nothing there to update...", 1);
		writeContentAfterSave ();
	}

	meter.setAttribute("value", "80%");
	statusMsg.value = "Writing new entries...";
	curCounter.setAttribute("value", "...");
	window.setTimeout(writeContent, SWITCH_TIME);	
}

// Step 6  10%
// write everything thats not yet in the message folder
function writeContent ()
{
	// if there happens an exception, we are done
	content = gSync.nextUpdate();
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
		logMessage("WriteContent Writing...", 1);
		copyToFolder (gTmpFile, gSync.folder.folderURL);
	}
	else
			writeContentAfterSave ();

}


// done this time
function writeContentAfterSave ()
{
	gSync.doneParsing();
	window.setTimeout(nextSync, SWITCH_TIME, syncCalendar);	
}


/**
 * Copies a local file into any mail folder.
 * In order to be displayed correct, make sure to create a complete message file!!!
 * fileName string - the file to copy(+path)
 * folderUri string - the Uri/Url of the folder we want this in
 */
function copyToFolder (fileName, folderUri)
{
	var mailFolder = RDF.GetResource(folderUri).QueryInterface(Components.interfaces.nsIMsgFolder);
	var fileSpec = Components.classes["@mozilla.org/filespec;1"].createInstance(Components.interfaces.nsIFileSpec);	
	fileSpec.nativePath = fileName;

	// at this pont, check the content, we do not write a load of bogus messages in the imap folder
	//alert ("File content:" + fileSpec.fileContents);
	
	copyservice = Components.classes["@mozilla.org/messenger/messagecopyservice;1"].getService(Components.interfaces.nsIMsgCopyService);
	// in order to be able to REALLY copy the message setup a listener
	copyservice.CopyFileMessage(fileSpec, mailFolder, null, false, 0, kolabCopyServiceListener, msgWindow);
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


