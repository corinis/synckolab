
// global variables 


// these should be setup in config
var gContactFolderPath = "Inbox/office/contact";
var gIncomingServerKey = "server2";
var gAddressBook = "abook-1.mab";

// print debug information out to console
var consoleService = Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService);
// for rdf content
var rdf = Components.classes["@mozilla.org/rdf/rdf-service;1"].getService(Components.interfaces.nsIRDFService);
// IO service
var ios = Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService);
// folder data source
var gFolderDatasource = Components.classes["@mozilla.org/rdf/datasource;1?name=mailnewsfolders"].createInstance(Components.interfaces.nsIRDFDataSource);

// holds required content
var gContactFolder; // the contact folder type nsIMsgFolder
var book;	// the address book

var fileContent; // holds the file content
var lines;	// the file content as lines
var addLines; // an array that saves the added lines one the content
var addLinesNum; // element is where to add the line (Number)

var gTmpFile; // uses trashfolder + filename for temp reading/writing

// hold window elements
var wnd; 	// the message window
var meter;	// the progress meter
var statusMsg;	// the status message

// some statics
var trashFolderUri = "mailbox://nobody@Local%20Folders/Trash";
// var tempFolderUri = "mailbox://nobody@Local%20Folders/Trash/delAtttemP"; // we only need this for testing, so we dont overwrite the original stuff

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

	var wnd = window.open("chrome://synckolab/content/progressWindow.xul", "bmarks", "chrome,width=350,height=100");
	try {
    var pref = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
		gContactFolderPath = pref.getCharPref("SyncKolab.ContactFolderPath");
		gIncomingServerKey = pref.getCharPref("SyncKolab.IncomingServerKey");
		gAddressBook = pref.getCharPref("SyncKolab.AddressBook");
	} catch(e) {
    pref.setBoolPref("hdrtools.debug", HTglobals.doDebugging);
	}
	
	
	// wait until loaded
	window.setTimeout(goWindow, 100, wnd);		 
}


function startSync(event) {
	// get the temp filename
  var trashFolder = RDF.GetResource(trashFolderUri).QueryInterface(Components.interfaces.nsIMsgFolder);
	gTmpFile = trashFolder.path.nativePath + ".tmp";

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
	/* ok we do not need this now - for config only to get the incoming server key
	alert (gAccountManager.allServers.Count());
	for (var i = 0; i < gAccountManager.allServers.Count(); i++)
	{
		var account = gAccountManager.allServers.GetElementAt(i);
		alert (account.key);
	}
	*/

	// type nsIMsgIncomingServer: get the right server
	var gInc = gAccountManager.getIncomingServer(gIncomingServerKey);

	// now lets find the contact folder - split the path to get the right one
	var folderPath = gContactFolderPath.split("/");
	
	gContactFolder = gInc.rootFolder;
	
	for (var i = 0; i < folderPath.length; i++)
	{
		consoleService.logStringMessage("got folder: " + gContactFolder.prettiestName );
		gContactFolder = gContactFolder.FindSubFolder(folderPath[i]);
	}
	// Step 3
	statusMsg.value ="Getting Content for "+gContactFolderPath+"...";
	meter.setAttribute("value", "5%");

	window.setTimeout(getContactsContent, 100);	
}
// globals for step3
var fileScriptableIO;
var fileInputStream;
var fsize;
var cfsize;


// Step 3 15%
// saves the contact folder into fileContent
function getContactsContent ()
{
	consoleService.logStringMessage("got folder (final): " + gContactFolder.URI );

	var folderNativePath = gContactFolder.path.nativePath;
	//var numMsgs = gContactFolder.dBTransferInfo.NumMessages;
	// we need to download the messages before we can get the offline stream -HOWTO DO THAT CORRECT???
	
	var list = Components.classes["@mozilla.org/supports-array;1"].createInstance(Components.interfaces.nsISupportsArray);
	var msgs = gContactFolder.getMessages(null);	
	while (msgs.hasMoreElements())
	{
		// i get an data:no exception here -on linux machines only ???
		var cur = msgs.getNext();
		list.AppendElement (cur);
	}
	
	// yeap I want to download the list, but I cant get the messages	
	gContactFolder.DownloadMessagesForOffline(list, null);

	// the file content
	fileContent = "";
	
	// see if there are any messages in this folder 
	var msgs = gContactFolder.getMessages(null);	

	// since we do not need to get the content if there is none skip this
	if (msgs.hasMoreElements())
	{
		var cur = null
		cur = msgs.getNext().QueryInterface(Components.interfaces.nsIMsgDBHdr);
		
		fileScriptableIO = Components.classes["@mozilla.org/scriptableinputstream;1"].createInstance(Components.interfaces.nsIScriptableInputStream);
		var foffset = new Object();
		fsize = new Object();
		fileInputStream = gContactFolder.getOfflineFileStream(cur.messageKey, foffset, fsize);
		fileScriptableIO.init(fileInputStream);
	
		// save the total filesize (+- something.. doesnt matter, we read until end of stream)
		fsize = fileScriptableIO.available();
		if (foffset.value > fsize)
			fsize = foffset.value ;
		cfsize = 0;
		window.setTimeout(getContactsContentRunner, 100, fileScriptableIO, fileInputStream);	
	}
	else
	{ 
		// do step 4
		statusMsg.value ="Parsing addresses...";
		meter.setAttribute("value", "20%");
		window.setTimeout(parseFolderToAddress, 100);	
	}
}

function  getContactsContentRunner (fileScriptableIO, fileInputStream)
{
		var csize;
		if ((csize = fileScriptableIO.available()) != 0)
		{
			// we want to have a few pixels - up to 15%
			if (csize > fsize/15)
				csize = fsize/15;
			cfsize += csize;
			
			fileContent += fileScriptableIO.read( csize );
			
			var curpointer = 5 + (15*(cfsize/fsize));
			meter.setAttribute("value", curpointer + "%");
			window.setTimeout(getContactsContentRunner, 50, fileScriptableIO, fileInputStream);	
		}
		else
		{
			window.setTimeout(getcontactsContentFinish, 100, fileScriptableIO, fileInputStream);	
			return;
		}
}

function getcontactsContentFinish (fileScriptableIO, fileInputStream)
{
 	fileScriptableIO.close();
	fileInputStream.close();

	// do step 4
	statusMsg.value ="Syncing addresses...";
	meter.setAttribute("value", "20%");
	window.setTimeout(parseFolderToAddress, 100);	
}

var curAddressProgress;
var sCards; // the cards as strings
var lastCard;

// Step 4 60%
// lets do some parsing action
function parseFolderToAddress ()
{

	// we got the whole content		
	// lets parse it

	// split into lines for easier parsing
	sCards = fileContent.split("\nFrom - ");
	
	// why do we have twice the cards the second run??
	lastCard = sCards.length;

	// an ugly hack for an ugly problem
	if (lastCard > 1)
		if (sCards[0].substring(sCards[0].indexOf("BEGIN"), sCards[0].indexOf("END") == 
			sCards[sCards.length/2].substring(sCards[sCards.length/2].indexOf("BEGIN"), sCards[sCards.length/2].indexOf("END")))
			)
			lastCard /= 2;
	
	curAddressProgress = 0;
	// remember the step, so the listener know what to call
	curStep = 4;
	// the unique id is in second token in the mail subject (f.e. pas-id-3EF6F3700000002E) and
	// saved in the custom4 field of the card (is there an id field??)
	window.setTimeout(parseFolderToAddressRunner, 100);	
}

function parseFolderToAddressRunner ()
{
	var cards = book.childCards;
	
	var newCard = Components.classes["@mozilla.org/addressbook/cardproperty;1"].createInstance(Components.interfaces.nsIAbCard);	
	message2Card (sCards[curAddressProgress], newCard);

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
		// create the new message
		{
			sCards[curAddressProgress] = card2Message(acard);
		}
	}

	// bogus card - skip
	if (sCards[curAddressProgress] == null)
	{
		parseFolderToAddressRunnerAfterSave ();
		return;
	}
	
	// no UID - cannot happen at this point (or its a bogus)
	if (sCards[curAddressProgress].indexOf("UID:") == -1)
	{
		parseFolderToAddressRunnerAfterSave ();
		return;
	}
	

	// add the "From - " if missing
	if (sCards[curAddressProgress].indexOf("From -") != -1)
		sCards[curAddressProgress] = sCards[curAddressProgress].substring(0, sCards[curAddressProgress].lastIndexOf("\n"));
	else
		sCards[curAddressProgress] = "From - " + sCards[curAddressProgress].substring(0, sCards[curAddressProgress].lastIndexOf("\n"));
		
	// no END:VCARD - cannot happen either - so bogus
	if (sCards[curAddressProgress].indexOf("END:VCARD") == -1)
	{
		parseFolderToAddressRunnerAfterSave ();
		return;
	}
	
	
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
	stream.write(sCards[curAddressProgress], sCards[curAddressProgress].length-1);
	stream.close();
	alert (curAddressProgress + " CUR: " + sCards[curAddressProgress]);
	// write the temp file back to the original directory
	copyToFolder (gTmpFile, gContactFolder.folderURL);
	//copyToFolder (gTmpFile, tempFolderUri); // to the temp folder for testing!!!
	
}

function parseFolderToAddressRunnerAfterSave ()
{
	curAddressProgress ++;
	if (curAddressProgress < lastCard)
	{
		var curpointer = 20 + (90*(curAddressProgress/lastCard));
		meter.setAttribute("value", curpointer + "%");
		window.setTimeout(parseFolderToAddressRunner, 20);	
	}
	else
	{
		window.setTimeout(parseFolderToAddressFinish, 100);	
	}
}
// for step 5
var cards;

function parseFolderToAddressFinish ()
{
	// do step 5
	curStep = 5;
	cards = book.childCards;
	cards.first();

	meter.setAttribute("value", "90%");
	statusMsg.value ="Writing new Cards...";
	window.setTimeout(writeContent, 100);	
}

// Step 5  10%
// write everything in a temp folder
function writeContent ()
{
	if (cards.currentItem())
	{
		var cur = cards.currentItem().QueryInterface(Components.interfaces.nsIAbCard);
		if (cur.custom4.length < 2)
		{
			// look a new card
			// generate a unique id (will random be enough for the future?)
			cur.custom4 = "pas-id-" + get_randomVcardId();
			cur.editCardToDatabase ("moz-abmdbdirectory://"+gAddressBook);
			
			// and write the message
			var content = card2Message(cur);
			if (content == null)
			{
				writeContentAfterSave ();
				return;
			}
			
				
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
			//copyToFolder (gTmpFile, tempFolderUri); // to the temp folder for testing!!!
			
		}
	}

}


function writeContentAfterSave ()
{
	try
	{
		cards.next();
		window.setTimeout(writeContent, 100);	
		return;
	}
	catch (ex)
	{
		// done
	}

	// delete the temp file
	var sfile = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
	sfile.initWithPath(gTmpFile);
	if (sfile.exists()) 
		sfile.remove(true);

	meter.setAttribute("value", "100%");
	statusMsg.value ="Done. You can close this window now!";
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
	alert (fileSpec.fileContents);
	
	copyservice = Components.classes["@mozilla.org/messenger/messagecopyservice;1"].getService(Components.interfaces.nsIMsgCopyService);
	// in order to be able to REALLY copy the message setup a listener
  copyservice.CopyFileMessage(fileSpec, mailFolder, null, false, kolabCopyServiceListener, null);
}

var kolabCopyServiceListener = {
	OnProgress: function(progress, progressMax) { },
	OnStartcopy: function() { },
	SetMessageKey: function(key) { },
	OnStopCopy: function(status) {
		// on step 4 we gotta finish up
		if (curStep == 4)
			window.setTimeout(parseFolderToAddressRunnerAfterSave, 1);	
		if (curStep == 5)
			window.setTimeout(writeContentAfterSave, 1);	
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

	// no update it
	for (var i = 0; i < lines.length; i++)
	{
		var vline = lines[i];
		
		// strip the \n at the end
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
			// N:firstName;LastName;Nickname
			case "N":
				var cur = tok[1].split(";");
				card.firstName = cur[0];
				card.lastName = cur[1];
				card.nickName = cur[3];
			break;
			case "TITLE":
				card.jobTitle = tok[1];
				break;
			case "EMAIL;INTERNET":
			case "EMAIL":
				card.primaryEmail = tok[1];
		    break;
		  case "FN":
		  	card.displayName = tok[1];
		  	break;
		  case "ORG":
		  	card.company = tok[1];
		  	break;
			// these two are the same
		  case "TEL;TYPE=CELL":
		  case "TEL;TYPE=CELL;TYPE=VOICE":
		  case "TEL;TYPE=VOICE;TYPE=CELL":
		  	card.cellularNumber = tok[1];
		  	break;
		  	
		  case "TEL;TYPE=VOICE;TYPE=HOME":
		  case "TEL;TYPE=HOME;TYPE=VOICE":
		  case "TEL;TYPE=VOICE":
		  case "TEL;TYPE=HOME":
		  	card.homePhone = tok[1];
		  	break;
		  case "TEL;TYPE=FAX":
		  	card.faxNumber = tok[1];
		  	break;
		  case "TEL;TYPE=WORK":
		  case "TEL;TYPE=WORK;TYPE=VOICE":
		  case "TEL;TYPE=VOICE;TYPE=WORK":
		  	card.workPhone = tok[1];
		  	break;
		  case "TEL;TYPE=PAGE":
		  	card.pagerNumber = tok[1];
		  	break;
		  case "ADDR;TYPE=WORK":
		  	card.workAddress = tok[1];
		  	break;
		  case "NOTE":
		  	card.notes = tok[1];
		  	break;
		  case "UID":
		  	card.custom4 = tok[1];
		  	break;
		} // end switch
	}
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
	msg += "User-Agent: SyncKolab\n\n";

	msg += "BEGIN:VCARD\n";
	// N:firstName;LastName;Nickname
	if (checkExist (card.firstName) || checkExist (card.lastName) || checkExist (card.nickName))
		msg += "N:"+card.firstName+";"+card.lastName+";"+card.nickName+"\n";
	if (checkExist (card.jobTitle))
		msg += "TITLE:"+card.jobTitle + "\n";
	if (checkExist (card.primaryEmail))
		msg += "EMAIL:"+card.primaryEmail + "\n";
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
	if (checkExist (card.workAddress))
		msg += "ADDR;TYPE=WORK:"+card.workAddress + "\n";
	// yeap one than more line (or something like that :P)
	if (checkExist (card.notes))
		msg += "NOTE:"+card.notes.replace (/\n/g, "\\n"); + "\n";
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
