
// global variables 


// these should be setup in config
var gContactFolderPath = "";
var gContactFolderMsgPath = "";
var gAddressBook = "abook-1.mab";
var gSaveImap = true;

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

// holds required content
var gContactFolder; // the contact folder type nsIMsgFolder
var book;	// the address book

var gSyncContact; // sync the contacts
var gSyncCalendar; // sync the calendar

var fileContent; // holds the file content
var lines;	// the file content as lines
var addLines; // an array that saves the added lines one the content
var addLinesNum; // element is where to add the line (Number)

// hold window elements
var gWnd; 	// the message window
var meter;	// the progress meter
var statusMsg;	// the status message

// progress variables 
var curStep;

// taken from mailCommands.js
function DoRDFCommand(dataSource, command, srcArray, argumentArray)
{
  var commandResource = rdf.GetResource(command);
  if (commandResource) {
    try {
      if (!argumentArray)
        argumentArray = Components.classes["@mozilla.org/supports-array;1"]
                        .createInstance(Components.interfaces.nsISupportsArray);

        if (argumentArray)
          argumentArray.AppendElement(msgWindow);
	dataSource.DoCommand(srcArray, commandResource, argumentArray);
    }
    catch(e) { 
      if (command == "http://home.netscape.com/NC-rdf#NewFolder") {
        throw(e); // so that the dialog does not automatically close.
      }
      dump("Exception : In mail commands\n");
    }
  }
}


function syncKolab(event) {
	// copy a file to a folder
	// call external func
	gWnd = window.open("chrome://synckolab/content/progressWindow.xul", "bmarks", "chrome,width=350,height=100");
	try {
    var pref = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
		gContactFolderPath = pref.getCharPref("SyncKolab.ContactFolderPath");
		gIncomingServerKey = pref.getCharPref("SyncKolab.ContactIncomingServer");
		gAddressBook = pref.getCharPref("SyncKolab.AddressBook");
		gSaveImap = pref.getBoolPref("SyncKolab.saveToContactImap");
		gSyncContact = pref.getBoolPref("SyncKolab.syncContacts");
		gSyncCalendar = pref.getBoolPref("SyncKolab.syncCalendar");

	} catch(e) {
	}
	
	// wait until loaded
	window.setTimeout(goWindow, 100, gWnd);		 
}

function goWindow (wnd)
{
		var statusMsg1 = wnd.document.getElementById('current-action');
		if (statusMsg1 == null || !statusMsg1)
		{
			window.setTimeout(goWindow, 100, wnd);		 
		}
		else
		{
				// some window elements for displaying the status
				meter = wnd.document.getElementById('progress');
				statusMsg = wnd.document.getElementById('current-action');
				window.setTimeout(startSync, 100);		 
		}
}

var gTmpFile;

function startSync(event) {
	// get temp file
	var file = Components.classes["@mozilla.org/file/directory_service;1"].
	   getService(Components.interfaces.nsIProperties).
	   get("TmpD", Components.interfaces.nsIFile);
	file.append("syncKolab.tmp");
	file.createUnique(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 0664);
	gTmpFile = file.path;
	
	// sync the address book
	syncAddressBook.init();	
	// get and set the message folder
	syncAddressBook.folder = getMsgFolder(syncAddressBook.serverKey, syncAddressBook.folderPath);
	syncAddressBook.folderMsgURI = syncAddressBook.folder.baseMessageURI;
	consoleService.logStringMessage("got folder: " + syncAddressBook.folder.URI + 
		"\nMessage Folder: " + syncAddressBook.folderMsgURI);

	// Step 3
	statusMsg.value ="Getting Content ...";
	meter.setAttribute("value", "5%");

	// all initialized, lets run
	window.setTimeout(getContent, 100, syncAddressBook);	
}

// globals for step3
var totalMessages;
var curMessage; 
var gCurMessageKey;
var updateMessages;
var updateMessagesContent;

var folderMessageUids;

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
	sync.folder.downloadAllForOffline (myUrlListener, msgWindow);

	// get the number of messages to go through
	totalMessages = sync.folder.getTotalMessages(false);
		
	// get the message keys
	gMessages = sync.folder.getMessages(msgWindow);	
		
	curMessage = 0;
	updateMessages = new Array(); // saves the the message url to delete
	updateMessagesContent = new Array(); // saves the card to use to update
	folderMessageUids = new Array(); // the checked uids - for better sync
	
	
	curStep = 4;
	statusMsg.value = "Syncing addresses...";
	meter.setAttribute("value", "5%");
	window.setTimeout(getMessage, 100);	
	// the unique id is in second token in the mail subject (f.e. pas-id-3EF6F3700000002E) and
	// saved in the custom4 field of the card (is there an id field??)
}


// Get the current message into a string and then go to parseMessageRunner
function getMessage ()
{
 	var cur = null
 	try
 	{
		cur = gMessages.getNext().QueryInterface(Components.interfaces.nsIMsgDBHdr);
	}
	catch (ex)
	{
    consoleService.logStringMessage("skipping read of messages - since there are none :)");
		updateContentAfterSave ();
    return;
	}
	// get the message content into fileContent
	// parseMessageRunner is called when we got the message
	fileContent = "";
	gCurMessageKey = cur.messageKey;
	var aurl = new Object();	
	gMessageService.CopyMessage(
        gSync.folderMsgURI +"#"+cur.messageKey,
        myStreamListener, false, null, msgWindow, aurl
        ); 
}

var myUrlListener = {
	OnStartRunningUrl: function ( url )
	{
    consoleService.logStringMessage("myUrlListener:startrunning ["+url.prePath  + "/" + url.path + "]:\n");
	},
	
	OnStopRunningUrl: function ( url, exitCode )
	{
    consoleService.logStringMessage("myUrlListener:stoprunning ["+url+"]:\n");
	}
}

// nsIStreamListener
var myStreamListener = {
 onDataAvailable: function(request, context, inputStream, offset, count){
    consoleService.logStringMessage("myStreamListener:myOnDataAvailable ["+offset+":"+count+"]:\n");
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
    consoleService.logStringMessage("got Message [" + gSync.folderMsgURI +"#"+gCurMessageKey + "]:\n" + fileContent);
    // stop here for testing
    parseMessageRunner ();
 }
};
    
/**
 * we now got the message content. this needs to parsed and checked 
 */
function parseMessageRunner ()
{
	var content = gSync.parseMessage(fileContent, updateMessagesContent);
	if (content != null)
	{
	    consoleService.logStringMessage("updating [" + gSync.folderMsgURI +"#"+gCurMessageKey + "]");
			updateMessages.push(gSync.folderMsgURI +"#"+gCurMessageKey); 
			updateMessagesContent.push(content); 
	}
	
	
	curMessage++;
	if (curMessage < totalMessages)
	{
		var curpointer = 5 + (55*(curMessage/totalMessages));
		meter.setAttribute("value", curpointer + "%");
		// next message
		window.setTimeout(getMessage, 20);	
	}
	else
	{
		window.setTimeout(parseFolderToAddressFinish, 100);	
	}
}


var cards;
var writeDone;

function parseFolderToAddressFinish ()
{
	// do step 5
	curStep = 5;
	writeDone = false;

	meter.setAttribute("value", "60%");
	statusMsg.value = "Writing changed cards...";
	window.setTimeout(updateContent, 100);	
}

function updateContent()
{
	// first lets delete the old messages
	if (updateMessages.length > 0)
	{
		try
		{
			var list = Components.classes["@mozilla.org/supports-array;1"].createInstance(Components.interfaces.nsISupportsArray);
			for (var i = 0; i < updateMessages.length; i++)
			{
		    consoleService.logStringMessage("deleting [" + updateMessages[i] + "]");
				var hdr = gMessageService.messageURIToMsgHdr(updateMessages[i]);
				list.AppendElement(hdr);		
		    
			}
			gSync.folder.deleteMessages (list, msgWindow, true, false, null, false);		
		}
		catch (ex)
		{
		    consoleService.logStringMessage("Exception while deleting - skipping");
		}
	}
	curMessage = -1;
	// now write the new ones
	window.setTimeout(updateContentWrite, 100);	
}

// write all changed contacts
function updateContentWrite ()
{
	curMessage++;
	if (curMessage < updateMessagesContent.length)
	{
		var content = updateMessagesContent[i];
		// write the message

		if (gSaveImap)
		{
			// write the message in the temp file
			var sfile = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
	    consoleService.logStringMessage("adding [" + content + "] to messages");
			// temp path
			sfile.initWithPath(gTmpFile);
			if (sfile.exists()) 
				sfile.remove(true);
			sfile.create(sfile.NORMAL_FILE_TYPE, 0666);
		  
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
				updateContentAfterSave ();
	}
	else
			updateContentAfterSave ();
	
}

function updateContentAfterSave ()
{
  consoleService.logStringMessage("starting update content...");
	curStep = 6;
	writeDone = false;
	
	if (!gSync.initUpdate())
	{
    consoleService.logStringMessage("Nothing there to update...");
		writeContentAfterSave ();
	}

	meter.setAttribute("value", "80%");
	statusMsg.value = "Writing new cards...";
	window.setTimeout(writeContent, 100);	
}

// Step 6  10%
// write all everything thats not yet in the message folder
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
		window.setTimeout(writeContent, 50);	
		return;
	}
	
	
	
	
	if (gSaveImap)
	{
		// write the message in the temp file
		var sfile = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
		// temp path
		sfile.initWithPath(gTmpFile);
		if (sfile.exists()) 
			sfile.remove(true);
		sfile.create(sfile.NORMAL_FILE_TYPE, 0666);
	  
		// create a new message in there
	 	var stream = Components.classes['@mozilla.org/network/file-output-stream;1'].createInstance(Components.interfaces.nsIFileOutputStream);
	 	stream.init(sfile, 2, 0x200, false); // open as "write only"
		stream.write(content, content.length);
		stream.close();
		
		// write the temp file back to the original directory
		copyToFolder (gTmpFile, gSync.folder.folderURL);
	}
	else
			writeContentAfterSave ();

}


function writeContentAfterSave ()
{
	meter.setAttribute("value", "100%");
	statusMsg.value ="Done. You can close this window now!";

	// delete the temp file
	var sfile = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
	sfile.initWithPath(gTmpFile);
	if (sfile.exists()) 
		sfile.remove(true);
		
	// close the status window
	gWnd.close();

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
	//alert (fileSpec.fileContents);
	
	copyservice = Components.classes["@mozilla.org/messenger/messagecopyservice;1"].getService(Components.interfaces.nsIMsgCopyService);
	// in order to be able to REALLY copy the message setup a listener
  copyservice.CopyFileMessage(fileSpec, mailFolder, null, false, kolabCopyServiceListener, null);
}

var kolabCopyServiceListener = {
	OnProgress: function(progress, progressMax) { },
	OnStartCopy: function() { },
	SetMessageKey: function(key) { },
	OnStopCopy: function(status) {
		// on step 4 we gotta finish up
		if (curStep == 4)
			window.setTimeout(parseMessageRunnerAfterSave, 1);	
		if (curStep == 5)
			window.setTimeout(updateContentWrite, 100);	
		if (curStep == 6)
			window.setTimeout(writeContent, 100);	
	}  
};


