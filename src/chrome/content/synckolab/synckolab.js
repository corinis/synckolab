
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
var gMsgService=Components.classes["@mozilla.org/messenger/messageservice;1?type=imap"].getService(Components.interfaces.nsIMsgMessageService); 

// holds required content
var gContactFolder; // the contact folder type nsIMsgFolder
var book;	// the address book

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


function syncKolab(event) {
	// copy a file to a folder
	// call external func
	gWnd = window.open("chrome://synckolab/content/progressWindow.xul", "bmarks", "chrome,width=350,height=100");
	try {
    var pref = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
		gContactFolderPath = pref.getCharPref("SyncKolab.ContactFolderPath");
		gIncomingServerKey = pref.getCharPref("SyncKolab.IncomingServer");
		gAddressBook = pref.getCharPref("SyncKolab.AddressBook");
		gSaveImap = pref.getBoolPref("SyncKolab.saveToImap");
	} catch(e) {
	}
	
	
	// wait until loaded
	window.setTimeout(goWindow, 100, gWnd);		 
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
	
	getAddressBook ();
}



// Step 1
// get the address book
function getAddressBook ()
{
	statusMsg.value ="Getting Address Book...";

	// get the rdf for the Addresbook list
	// for configuration
	var directory = rdf.GetResource("moz-abdirectory://").QueryInterface(Components.interfaces.nsIAbDirectory);
	
	var cn = directory.childNodes;
	var ABook = cn.getNext();
	
	book = null;
	while (ABook != null)
	{
		var cur = ABook.QueryInterface(Components.interfaces.nsIAbDirectory);
		if (cur.directoryProperties.fileName == gAddressBook)
		{
			book = cur;
			break;
		}
		ABook = cn.getNext();
	}
	// we got the address book in cur
	// Step 2
	statusMsg.value ="Getting Contact Message Folder...";
	// easy 2% go on
	meter.setAttribute("value", "2%");
	window.setTimeout(getContactMsgFolder, 100);	
}

// Step 2
// gets the contact folder and saves it in gcontactFolder
function getContactMsgFolder ()
{
	
	var gAccountManager = Components.classes['@mozilla.org/messenger/account-manager;1'].getService(Components.interfaces.nsIMsgAccountManager);
	var gInc = null;
	for (var i = 0; i < gAccountManager.allServers.Count(); i++)
	{
		var account = gAccountManager.allServers.GetElementAt(i).QueryInterface(Components.interfaces.nsIMsgIncomingServer);
		if (account.rootMsgFolder.baseMessageURI == gIncomingServerKey)
		{
			gInc = account;
		}
	}
	
	if (gInc == null)
	{
		alert("You have to set the Account and Folder first!");
		// close the status window
		gWnd.close();

		return;
	}
	
	gContactFolder = gInc.getMsgFolderFromURI(gInc.rootFolder, gContactFolderPath);
	gContactFolderMsgPath = gContactFolder.baseMessageURI;
	consoleService.logStringMessage("got folder: " + gContactFolder.URI + "\nMessage Folder: " + gContactFolderMsgPath);

	// check if folder REALLY exists
	gContactFolder.clearNewMessages ();
	
	// Step 3
	statusMsg.value ="Getting Content ...";
	meter.setAttribute("value", "5%");

	window.setTimeout(getContactsContent, 100);	
}

// globals for step3
var totalMessages;
var curMessage;
var updateMessages;
var updateMessagesCard;

var folderMessageUids;

var consumer=Components.classes["@mozilla.org/network/async-stream-listener;1"].createInstance(Components.interfaces.nsIAsyncStreamListener);
var msgs;

// Step 3 15%
// saves the contact folder into fileContent
// 		gContactFolder.downloadAllForOffline (myUrlListener, msgWindow);
function getContactsContent ()
{
	// get the number of messages to go through
	totalMessages = gContactFolder.getTotalMessages(false);
		
	// get the message keys
	msgs = gContactFolder.getMessages(msgWindow);	
		
	curMessage = 0;
	updateMessages = new Array(); // saves the the message url to delete
	updateMessagesCard = new Array(); // saves the card to use to update
	folderMessageUids = new Array(); // the checked uids - for better sync
	
	// the file content
  consumer.init(myStreamListener, null); 
	
	curStep = 4;
	statusMsg.value = "Syncing addresses...";
	meter.setAttribute("value", "20%");
	window.setTimeout(getCardMessage, 100);	
	// the unique id is in second token in the mail subject (f.e. pas-id-3EF6F3700000002E) and
	// saved in the custom4 field of the card (is there an id field??)
}


// Get the current message into a string and then go to parseFolderToAddressRunner
function getCardMessage ()
{
 	var cur = null
 	try
 	{
		cur = msgs.getNext().QueryInterface(Components.interfaces.nsIMsgDBHdr);
	}
	catch (ex)
	{
    consoleService.logStringMessage("skipping read of messages - since there are none :)");
		updateContentAfterSave ();
    //parseFolderToAddressFinish ();
    return;
	}
	fileContent = "";
	var aurl = new Object();	
	gMsgService.CopyMessage(
        gContactFolderMsgPath +"#"+cur.messageKey,
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
    consoleService.logStringMessage("got Message [" + gContactFolderMsgPath + "#" + curMessage + "]:\n" + fileContent);
    // stop here for testing
    parseFolderToAddressRunner ();
 }
};
    
    
function parseFolderToAddressRunner ()
{
	var cards = book.childCards;
	
	var newCard = Components.classes["@mozilla.org/addressbook/cardproperty;1"].createInstance(Components.interfaces.nsIAbCard);	
	if (message2Card (fileContent, newCard))
	{
		// remember that we did this uid already
		folderMessageUids.push(newCard.custom4);
		
		// ok lets see if we have this one already (remember custom4=UID)
		var acard = findCard (cards, newCard.custom4);
	
		// a new card				
		if (acard == null)
		{
			book.addCard (newCard);
		}
		else
		{
			// we got that already, see which is newer and update the message or the card
			if (newCard.lastModifiedDate > acard.lastModifiedDate)
			{
				var list = Components.classes["@mozilla.org/supports-array;1"].createInstance(Components.interfaces.nsISupportsArray);
				list.AppendElement(acard);
				book.deleteCards(list)
				book.addCard (newCard);
			}
			else
			{
				// remember this message for update
		    consoleService.logStringMessage("updating [" + gContactFolderMsgPath + "#" + curMessage + "]");
				updateMessages.push(gContactFolderMsgPath +"#"+curMessage); 
				updateMessagesCard.push(acard); 
			}
		}
	}
	
	curMessage++;
	if (curMessage < totalMessages)
	{
		var curpointer = 20 + (60*(curMessage/totalMessages));
		meter.setAttribute("value", curpointer + "%");
		// next message
		window.setTimeout(getCardMessage, 20);	
	}
	else
	{
		window.setTimeout(parseFolderToAddressFinish, 100);	
	}
}

// for step 5
var cards;
var writeDone;

function parseFolderToAddressFinish ()
{
	// do step 5
	curStep = 5;
	writeDone = false;
	cards = book.childCards;
	try
	{
		cards.first();
	}
	// this will be called when there are no cards in the address book
	catch (ex)
	{
		window.setTimeout(writeContent, 100);	
	}
	

	meter.setAttribute("value", "80%");
	statusMsg.value = "Writing changed cards...";
	window.setTimeout(updateContent, 100);	
}

function updateContent()
{
	// first lets delete the old messages
	if (updateMessages.length > 0)
	{
		var list = Components.classes["@mozilla.org/supports-array;1"].createInstance(Components.interfaces.nsISupportsArray);
		for (var i = 0; i < updateMessages.length; i++)
		{
			var hdr = gMsgService.messageURIToMsgHdr(updateMessages[i]);
			list.AppendElement(hdr);		
	    consoleService.logStringMessage("deleting [" + updateMessages[i] + "]");
		}
		gContactFolder.deleteMessages (list, msgWindow, true, false, null, false);		
	}
	curMessage = -1;
	// now write the new ones
	window.setTimeout(updateContentWrite, 100);	

}

// write all changed contacts
function updateContentWrite ()
{
	curMessage++;
	var content = null;
	if (curMessage < updateMessagesCard.length)
	{
		var cur = updateMessagesCard[i].QueryInterface(Components.interfaces.nsIAbCard);
		// write the message
		content = card2Message(cur);

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
			copyToFolder (gTmpFile, gContactFolder.folderURL);
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
	cards = book.childCards;
	try
	{
		cards.first();
	}
	catch (ex)
	{
		consoleService.logStringMessage("no cards found...");
		writeContentAfterSave ();
	}
	

	meter.setAttribute("value", "90%");
	statusMsg.value = "Writing new cards...";
	window.setTimeout(writeContent, 100);	
}

// Step 6  10%
// write everything in a temp folder
function writeContent ()
{
	var content = null;
	// if there happens an exception, we are done
	try
	{
		cards.currentItem()
	}
	catch (ext)
	{
		consoleService.logStringMessage("currentitem exception...");
		writeDone = true;
	}
	
	
	if (!writeDone)
	{
		var cur = cards.currentItem().QueryInterface(Components.interfaces.nsIAbCard);
		var writeCur = false;
    
		if (cur.custom4.length < 2)
		{
			// look a new card
			// generate a unique id (will random be enough for the future?)
			cur.custom4 = "pas-id-" + get_randomVcardId();
			consoleService.logStringMessage("adding unsaved card: " + cur.custom4);
			writeCur = true;
			cur.editCardToDatabase ("moz-abmdbdirectory://"+gAddressBook);
		}
		else
		{
			writeCur = true;
			// check if we have this uid in the messages
			for (var i = 0; i < folderMessageUids.length; i++)
			{
				if (cur.custom4 == folderMessageUids[i])
				{
					consoleService.logStringMessage("adding card: " + cur.custom4);
					writeCur = false;
					break;
				}
			}
		}
		
		if (writeCur)
		{
			// and write the message
			content = card2Message(cur);
			consoleService.logStringMessage("Writing Message to Imap Folder:\n" + content);
		}

		try
		{
			// select the next card
			cards.next();
		}
		catch (ext)
		{
			writeDone = true;
			consoleService.logStringMessage("Nothing left... cards.next() threw Exception...");
			
		}
		
		if (content == null)
		{
			consoleService.logStringMessage("No content, next.");
			if (!writeDone)
			{
				window.setTimeout(writeContent, 100);	
			}
			else
				writeContentAfterSave ();
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
			copyToFolder (gTmpFile, gContactFolder.folderURL);
			// the continuing is in the runner!
			return;
		}
	}
	
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
			window.setTimeout(parseFolderToAddressRunnerAfterSave, 1);	
		if (curStep == 5)
			window.setTimeout(updateContentWrite, 100);	
		if (curStep == 6)
			window.setTimeout(writeContent, 100);	
	}  
};


