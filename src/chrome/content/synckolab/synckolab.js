
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
/*deleteme?
var fileScriptableIO;

var fileInputStream;
var fsize;
var cfsize;
*/
var consumer=Components.classes["@mozilla.org/network/async-stream-listener;1"].createInstance(Components.interfaces.nsIAsyncStreamListener);

// Step 3 15%
// saves the contact folder into fileContent
function getContactsContent ()
{
	// get the number of messages to go through
	totalMessages = gContactFolder.getTotalMessages(false);
	curMessage = 0;
	updateMessages = new Array(); // saves the the message url to delete
	updateMessagesCard = new Array(); // saves the card to use to update
	
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
  
	fileContent = "";
	var aurl = new Object();	
	gMsgService.CopyMessage(
        gContactFolderMsgPath +"#"+curMessage,
        myStreamListener, false, null, msgWindow, aurl
        ); 

/*
	gMsgService.streamMessage(
//        "imap-message://myLogin@imap.host.fr/imapTest#1",
				 "imap-message://gargan%corinis.net@mail.corinis.net/INBOX/office/contact#1",
//        gContactFolderMsgPath +"#"+curMessage,
        consumer,
        msgWindow,  null,  true,  "nothing"
        ); 
*/        
}

var myUrlListener = {
	OnStartRunningUrl: function ( url )
	{
//    consoleService.logStringMessage("myUrlListener:startrunning ["+url.prePath  + "/" + url.path + "]:\n");
	},
	
	OnStopRunningUrl: function ( url, exitCode )
	{
//    consoleService.logStringMessage("myUrlListener:stoprunning ["+url+"]:\n");
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
//        consoleService.logStringMessage("myStreamListener:myOnDataAvailable ["+offset+":"+count+"]:\n"+fileContent+"");
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
    parseFolderToAddressRunner ();
 }
};
    
    
function parseFolderToAddressRunner ()
{
	var cards = book.childCards;
	
	var newCard = Components.classes["@mozilla.org/addressbook/cardproperty;1"].createInstance(Components.interfaces.nsIAbCard);	
	if (message2Card (fileContent, newCard))
	{

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
	if (curMessage < updateMessagesCard.length)
	{
		var content = null;
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
	curStep = 6;
	writeDone = false;
	cards = book.childCards;
	try
	{
		cards.first();
	}
	catch (ex)
	{
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
	// if there happens an exception, we are done
	try
	{
		cards.currentItem()
	}
	catch (ext)
	{
		writeDone = true;
	}
	
	
	if (!writeDone)
	{
		var content = null;
		var cur = cards.currentItem().QueryInterface(Components.interfaces.nsIAbCard);
    consoleService.logStringMessage("Card [" + cur.custom4 + "]");
		if (cur.custom4.length < 2)
		{
			// look a new card
			// generate a unique id (will random be enough for the future?)
			cur.custom4 = "pas-id-" + get_randomVcardId();
			cur.editCardToDatabase ("moz-abmdbdirectory://"+gAddressBook);
			// and write the message
			content = card2Message(cur);
	    consoleService.logStringMessage("New Card [" + content + "]");
		}

		try
		{
			// select the next card
			cards.next();
		}
		catch (ext)
		{
			writeDone = true;
		}
		
		if (content == null)
		{
			if (!writeDone)
				window.setTimeout(writeContent, 100);	
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
		}
		else
				writeContentAfterSave ();
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
			window.setTimeout(parseFolderToAddressRunnerAfterSave, 1);	
		if (curStep == 5)
			window.setTimeout(updateContentWrite, 100);	
		if (curStep == 6)
			window.setTimeout(writeContent, 100);	
	}  
};


////////////////////////////////// HELP FUNCTIONS /////////////////////////////////////////

/**
 * Parses a vcard message to a addressbook card.
 * This function ignores unused headers.
 * You can create a new card using:
 * newcard = Components.classes["@mozilla.org/addressbook/cardproperty;1"].createInstance(Components.interfaces.nsIAbCard);	
 * @param message string - a string with the vcard
 * @param card nsIAbCard - the card to update
 *
 */
function message2Card (message, card)
{
	// make an array of all lines for easier parsing
	var lines = message.split("\n");
	
	// reset the card
	card.aimScreenName = "";
	card.anniversaryDay = "";
	card.anniversaryMonth = "";
	card.anniversaryYear = "";
	card.birthDay = "";
	card.birthMonth = "";
	card.birthYear = "";
	card.cardType = "";
	card.category = "";
	card.cellularNumber = "";
	card.cellularNumberType = "";
	card.company = "";
	card.custom1 = "";
	card.custom2 = "";
	card.custom3 = "";
	card.custom4 = "";
	card.defaultAddress = "";
	card.defaultEmail = "";
	card.department = "";
	card.displayName = "";
	card.familyName = "";
	card.faxNumber = "";
	card.faxNumberType = "";
	card.firstName = "";
	card.homeAddress = "";
	card.homeAddress2 = "";
	card.homeCity = "";
	card.homeCountry = "";
	card.homePhone = "";
	card.homePhoneType = "";
	card.homeState = "";
	card.homeZipCode = "";
	card.jobTitle = "";
	card.lastModifiedDate = 0;
	card.lastName = "";
	card.nickName = "";
	card.notes = "";
	card.pagerNumber = "";
	card.pagerNumberType = "";
	card.phoneticFirstName = "";
	card.phoneticLastName = "";
	//PRUint32 preferMailFormat = "";
	card.primaryEmail = "";
	card.secondEmail = "";
	card.spouseName = "";
	card.webPage1 = ""; // WebPage1 is work web page
	card.webPage2 = ""; // WebPage2 is home web page
	card.workAddress = "";
	card.workAddress2 = "";
	card.workCity = "";
	card.workCountry = "";
	card.workPhone = "";
	card.workPhoneType = "";
	card.workState = "";
	card.workZipCode = "";

/*
	card.cardType = "";
	card.category = "";
	card.defaultAddress = "";
	card.phoneticFirstName = "";
	card.phoneticLastName = "";
	card.spouseName = "";
	//PRUint32 preferMailFormat = "";
	//card.secondEmail = "";
	//card.aimScreenName = "";
*/
	// now update it
	var found = false;
	
	for (var i = 0; i < lines.length; i++)
	{
		var vline = lines[i];
		
		// strip the \n at the end
		if (vline.charAt(vline.length-1) == '\r')
			vline = vline.substring(0, vline.length-1);
		
		var tok = vline.split(":");
		switch (tok[0].toUpperCase())
		{
			case "DATE":
					// now we gotta check times... convert the message first
					// save the date in microseconds
					// Date: Fri, 17 Dec 2004 15:06:42 +0100
					card.lastModifiedDate = (new Date(Date.parse(lines[i].substring(lines[i].indexOf(":")+1, lines[i].length)))).getTime() / 1000;
					break;						
			case "NICKNAME":
					card.nickName = tok[1];
					found = true;
					break;
			case "FN":
					card.displayName = tok[1];
					found = true;
					break;
			// N:firstName;LastName;Nickname
			case "N":
				var cur = tok[1].split(";");
				card.firstName = cur[0];
				card.lastName = cur[1];
					found = true;
			break;
			case "TITLE":
				card.jobTitle = tok[1];
				found = true;
				break;
			case "EMAIL;TYPE=PREF":
			case "EMAIL;TYPE=INTERNET,PREF":
				card.defaultEmail = tok[1];
				found = true;
				break;
			case "EMAIL;INTERNET":
			case "EMAIL":
				card.primaryEmail = tok[1];
				found = true;
		    break;
		  case "FN":
		  	card.displayName = tok[1];
				found = true;
		  	break;
		  case "TITLE":
		  	card.jobTitle = tok[1];
				found = true;
		  	break;
		  case "ORG":
		  	card.company = tok[1];
				found = true;
		  	break;
			// these two are the same
		  case "TEL;TYPE=CELL":
		  case "TEL;TYPE=CELL;TYPE=VOICE":
		  case "TEL;TYPE=VOICE;TYPE=CELL":
		  	card.cellularNumber = tok[1];
				found = true;
		  	break;
		  	
		  case "TEL;TYPE=VOICE;TYPE=HOME":
		  case "TEL;TYPE=HOME;TYPE=VOICE":
		  case "TEL;TYPE=VOICE":
		  case "TEL;TYPE=HOME":
		  	card.homePhone = tok[1];
				found = true;
		  	break;
		  case "TEL;TYPE=FAX":
		  	card.faxNumber = tok[1];
				found = true;
		  	break;
		  case "TEL;TYPE=WORK":
		  case "TEL;TYPE=WORK;TYPE=VOICE":
		  case "TEL;TYPE=VOICE;TYPE=WORK":
		  	card.workPhone = tok[1];
				found = true;
		  	break;
		  case "TEL;TYPE=PAGE":
		  	card.pagerNumber = tok[1];
				found = true;
		  	break;
		  case "BDAY":
				var cur = tok[1].split("-");
				card.birthYear = cur[0];
				card.birthMonth = cur[1];
				// BDAY:1987-09-27T08:30:00-06:00
		  	card.birthDay = (cur[2].indexOf("T") != -1)?cur[2].substring(0,cur[2].indexOf("T")):cur[2];
				found = true;
		  	break;
		  	// anniversary - not in vcard rfc??
		  case "ANNIVERSARY":
				var cur = tok[1].split("-");

				card.anniversaryYear = cur[0];
				card.anniversaryMonth = cur[1];
				// BDAY:1987-09-27T08:30:00-06:00
		  	card.anniversaryDay = (cur[2].indexOf("T") != -1)?cur[2].substring(0,cur[2].indexOf("T")):cur[2];
				found = true;
		  	break;
		  	
		  case "ADDR;TYPE=HOME,POSTAL":
		  case "ADDR;TYPE=HOME":
				var cur = tok[1].split(";");
				card.homeAddress2 = cur[1];
				card.homeAddress = cur[2];
				card.homeCity = cur[3];
				card.homeState = cur[4];
				card.homeZipCode = cur[5];
				card.homeCountry = cur[6];
				found = true;
		  	break;
		  case "ADDR;TYPE=WORK,POSTAL":
		  case "ADDR;TYPE=WORK":
				var cur = tok[1].split(";");
				card.workAddress2 = cur[1];
				card.workAddress = cur[2];
				card.workCity = cur[3];
				card.workState = cur[4];
				card.workZipCode = cur[5];
				card.workCountry = cur[6];
				found = true;
		  	break;
		  case "NOTE":
		  	card.notes = tok[1];
				found = true;
		  	break;
		  case "DEPT":
		  	card.department = tok[1];
				found = true;
		  	break;
		  case "CUSTOM1":
		  	card.custom1 = tok[1];
				found = true;
		  	break;
		  case "CUSTOM2":
		  	card.custom2 = tok[1];
				found = true;
		  	break;
		  case "CUSTOM3":
		  	card.custom3 = tok[1];
				found = true;
		  	break;

		  case "URL;TYPE=WORK":
		  case "URL":
		  	card.webPage1 = tok[1]; // WebPage1 is work web page
				found = true;
				break;
		  case "URL;TYPE=PRIVATE":
		  case "URL;TYPE=PERSONAL":
		  	card.webPage2 = tok[1]; // WebPage2 is home web page
				found = true;
				break;
		  case "UID":
		  	card.custom4 = tok[1];
		  	break;
		} // end switch
	}
	
	return found;
}

/**
 * Creates a vcard message out of a card.
 * This creates the WHOLE message including header
 */
function card2Message (card)
{
	if (card.custom4 == null || card.custom4.length < 2)
		return null;
	var msg = "";
	// save the date in microseconds
	// Date: Fri, 17 Dec 2004 15:06:42 +0100
	var cdate = new Date (card.lastModifiedDate*1000);
	var sTime = (cdate.getHours()<10?"0":"") + cdate.getHours() + ":" + (cdate.getMinutes()<10?"0":"") + cdate.getMinutes() + ":" +
		(cdate.getSeconds()<10?"0":"") + cdate.getSeconds();
	var sdate = "Date: " + getDayString(cdate.getDay()) + ", " + cdate.getDate() + " " +
		getMonthString (cdate.getMonth()) + " " + cdate.getFullYear() + " " + sTime
		 + " " + (((cdate.getTimezoneOffset()/60) < 0)?"-":"+") +
		(((cdate.getTimezoneOffset()/60) < 10)?"0":"") + cdate.getTimezoneOffset() + "00\n";
		
	msg += "From - " + getDayString(cdate.getDay()) + " " + getMonthString (cdate.getMonth()) + " " + 
		cdate.getDate()	+ " " + sTime + " " + cdate.getFullYear() + "\n";
	msg += "X-Mozilla-Status: 0001\n";
	msg += "X-Mozilla-Status2: 00000000\n";
	msg += "Content-Type: Text/X-VCard;\n";
  msg += '\tcharset="utf-8"\n';
	msg += "From: \n";
	msg += "Reply-To: \n";
	msg += "Bcc: \n";
	msg += "To: \n";
	msg += "Subject: vCard " + card.custom4 + "\n";
	msg += sdate;
	msg += "User-Agent: SyncKolab\n\r\n\r\n";

	msg += "BEGIN:VCARD\n";
	// N:firstName;LastName;Nickname
	if (checkExist (card.firstName) || checkExist (card.lastName))
		msg += "N:"+card.firstName+";"+card.lastName+";\n";
	if (checkExist (card.displayName))
		msg += "FN:"+card.displayName+"\n";
	if (checkExist (card.nickName))
		msg += "NICKNAME:"+card.nickName+"\n";
	if (checkExist (card.jobTitle))
		msg += "TITLE:"+card.jobTitle + "\n";
	if (checkExist (card.primaryEmail))
		msg += "EMAIL:"+card.primaryEmail + "\n";
	if (checkExist (card.defaultEmail))
		msg += "EMAIL;TYPE=INTERNET,PREF:" + card.defaultEmail +"\n";
	if (checkExist (card.displayName))
		msg += "FN:"+card.displayName + "\n";
	if (checkExist (card.company))
		msg += "ORG:"+card.company + "\n";
	if (checkExist (card.cellularNumber))
		msg += "TEL;TYPE=CELL:"+card.cellularNumber + "\n";
	if (checkExist (card.homePhone))
		msg += "TEL;TYPE=VOICE:"+card.homePhone + "\n";
	if (checkExist (card.faxNumber))
		msg += "TEL;TYPE=FAX:"+card.faxNumber + "\n";
	if (checkExist (card.workPhone))
		msg += "TEL;TYPE=WORK:"+card.workPhone + "\n";
	if (checkExist (card.pagerNumber))
		msg += "TEL;TYPE=PAGE:"+card.pagerNumber + "\n";
	if (checkExist (card.department))
		msg += "DEPT:"+card.department + "\n";
				// BDAY:1987-09-27T08:30:00-06:00
	if (checkExist(card.birthYear) ||checkExist(card.birthDay) ||checkExist(card.birthMonth))
		msg += "BDAY:" + card.birthYear + "-" + card.birthMonth + "-" + card.birthDay + "\n";
	if (checkExist(card.anniversaryYear) ||checkExist(card.anniversaryDay) ||checkExist(card.anniversaryMonth))
		msg += "ANNIVERSARY:" + card.anniversaryYear + "-" + card.anniversaryMonth + "-" + card.anniversaryDay + "\n";
	if (checkExist (card.webPage1))
		msg += "URL:"+card.webPage1 + "\n";
	if (checkExist (card.webPage2))
		msg += "URL;TYPE=PERSONAL:"+card.webPage2 + "\n";
	if (checkExist (card.workAddress) || checkExist (card.workCountry) || checkExist (card.workCity) || checkExist (card.workState))
	{
		msg += "ADDR;TYPE=WORK:;"+card.workAddress2 + ";" + card.workAddress + ";" +
			card.workCity + ";" + card.workState + ";" + card.workZipCode + ";" + card.workCountry + "\n";
	}
	if (checkExist (card.homeAddress) || checkExist (card.homeCountry) || checkExist (card.homeCity) || checkExist (card.homeState))
	{
		msg += "ADDR;TYPE=home:;"+card.homeAddress2 + ";" + card.homeAddress + ";" +
			card.homeCity + ";" + card.homeState + ";" + card.homeZipCode + ";" + card.homeCountry + "\n";
	}
	if (checkExist (card.custom1))
		msg += "CUSTOM1:"+card.custom1.replace (/\n/g, "\\n") + "\n";
	if (checkExist (card.custom2))
		msg += "CUSTOM2:"+card.custom2.replace (/\n/g, "\\n") + "\n";
	if (checkExist (card.custom3))
		msg += "CUSTOM3:"+card.custom3.replace (/\n/g, "\\n") + "\n";
	// yeap one than more line (or something like that :P)
	if (checkExist (card.notes))
		msg += "NOTE:"+card.notes.replace (/\n/g, "\\n") + "\n";
	msg += "UID:"+card.custom4 + "\n";	
	msg += "VERSION:3.0\n";
	msg += "END:VCARD\n\n";
	return msg;
}

function checkExist (value)
{
	return (value != null && value.length > 0)
}

function getMonthString (month)
{
	switch (month) {
		case 0: return "Jan";
		case 1: return "Feb";
		case 2: return "Mar";
		case 3: return "Apr";
		case 4: return "May";
		case 5: return "June";
		case 6: return "July";
		case 7: return "Aug";
		case 8: return "Sep";
		case 9: return "Oct";
		case 10: return "Nov";
		case 11: return "Dec";
	}
}

function getDayString (day)
{
	switch(day){
		case 0: return "Sun"; break;
		case 1: return "Mon"; break;
		case 2: return "Tue"; break;
		case 3: return "Wed"; break;
		case 4: return "Thu"; break;
		case 5: return "Fri"; break;
		case 6: return "Sat"; break;
	}
}


/**
 * Copies a local file into any mail folder.
 * In order to be displayed correct, make sure to create a complete message file!!!
 * fileName string - the file to copy(+path)
 * folderUri string - the Uri/Url of the folder we want this in
 */
function copyToLocalFolder (fileName, folderUri)
{
  var mailFolder = RDF.GetResource(folderUri).QueryInterface(Components.interfaces.nsIMsgFolder);
	// ok give out the folder info
	
	// ok now get the filespec
	var fileSpec = Components.classes["@mozilla.org/filespec;1"].createInstance(Components.interfaces.nsIFileSpec);
	
	fileSpec.nativePath = fileName;
	
	mailFolder.copyFileMessage (fileSpec, null, false, null, null);
}


/**
 * Looks for a card in the card list
 * @param cards childCards - the list of cards
 * @param vId	string - the custom4 field (card id)
 */
function findCard (cards, vId)
{
	var cards = book.childCards;
	// start from beginning
	try
	{
		cards.first();
	}
	catch (ex)
	{
		return null;
	}
	
	var card = null;
	while ((card = cards.currentItem ()) != null)
	{
		// get the right interface
		card = card.QueryInterface(Components.interfaces.nsIAbCard);
		
		if (card.custom4 == vId)
		{
			return card;
		}
			
		// cycle
		try
		{
			cards.next();
		}
		catch (ex)
		{
			return null;
		}
	}
	// nothing found
	return null;
}

/**
 * returns a 15 character hex id - random
 */ 
function get_randomVcardId()
{
	var hex = new Array(15);
	hex[0]="0";
	hex[1]="1";
	hex[2]="2";
	hex[3]="3";
	hex[4]="4";
	hex[5]="5";
	hex[5]="6";
	hex[6]="7";
	hex[7]="8";
	hex[8]="9";
	hex[9]="A";
	hex[10]="B";
	hex[11]="C";
	hex[12]="D";
	hex[13]="E";
	hex[14]="F";
	
	
	var cid="";
	for (i=0;i<16;i++){
		cid = cid + hex[Math.round(Math.random()*14)]
	}
	return cid;
}

function deleteTempFolders ()
{
	var tempFolderResource = rdf.GetResource(tempFolderUri);
	var tempFolder = tempFolderResource.QueryInterface(Components.interfaces.nsIMsgFolder);
	var np = tempFolder.path.nativePath;
	var deletedArray = Components.classes["@mozilla.org/supports-array;1"].createInstance(Components.interfaces.nsISupportsArray);        
	var parentArray = Components.classes["@mozilla.org/supports-array;1"].createInstance(Components.interfaces.nsISupportsArray);
	deletedArray.AppendElement(tempFolderResource);
	var parFolderResource = rdf.GetResource(trashFolderUri);
	parentArray.AppendElement(parFolderResource);
	try {
	    DoRDFCommand(gFolderDatasource, "http://home.netscape.com/NC-rdf#ReallyDelete", parentArray, deletedArray);  
	} catch(e) {
	    alert('AttachmentTools: error deleting the temp folder >' + e);
	}
	// lets just make sure the temp folder files are gone
	var sfile = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
	try{
	    sfile.initWithPath(np);
	    if (sfile.exists()) sfile.remove(true);
	    np = np + ".msf"
	    sfile.initWithPath(np);
	    if (sfile.exists()) sfile.remove(true);
	} catch(e) {
	    alert('error erasing the temp folder files >' + e);
	}
}

function URLDecode(encoded )
{
   // Replace + with ' '
   // Replace %xx with equivalent character
   // Put [ERROR] in output if %xx is invalid.
   var HEXCHARS = "0123456789ABCDEFabcdef"; 
   var plaintext = "";
   var i = 0;
   while (i < encoded.length) {
       var ch = encoded.charAt(i);
	   if (ch == "+") {
	       plaintext += " ";
		   i++;
	   } else if (ch == "%") {
			if (i < (encoded.length-2) 
					&& HEXCHARS.indexOf(encoded.charAt(i+1)) != -1 
					&& HEXCHARS.indexOf(encoded.charAt(i+2)) != -1 ) {
				plaintext += unescape( encoded.substr(i,3) );
				i += 3;
			} else {
				plaintext += "%[ERROR]";
				i++;
			}
		} else {
		   plaintext += ch;
		   i++;
		}
	} // while
   return plaintext;
};