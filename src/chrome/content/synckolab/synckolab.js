
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

// hold window elements
var wnd; 	// the message window
var meter;	// the progress meter
var statusMsg;	// the status message

// some statics
var tempFolderName = 'delAtttemP';
var tempFolderUri = "mailbox://nobody@Local%20Folders/Trash/" + tempFolderName;
var trashFolderUri = "mailbox://nobody@Local%20Folders/Trash";

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
	    alert('AttachmentTools: error erasing the temp folder files >' + e);
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
		
	getAddressBook ();
	
	// lets go for the messages...
	// getContactMsgFolder ();
	// gContactFolder is filled
	// we go the right folder, now get all the messages and sync em with the address book
	

	//getContactsContent();	
	//parseFolderToAddress ();

  
  //writeContent ();


}

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
/**
 * Seaches for a specific line token
 * @param lines String[] - the content of the card
 * @param start int - where to start
 * @param end int - where to end
 * @param tokebn string - the token to search for
 */
function findLine (lines, start, end, token)
{
	for (var i = start; i < end; i++)
	{
		var vline = lines[i];
		var tok = vline.split(":");
		if (tok[0].toUpperCase() == token)
			return i;
	}
	return -1;
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
/*
acard.secondEmail = doc.getElementById('SecondEmail').value;
acard.aimScreenName = doc.getElementById('ScreenName').value;

acard.preferMailFormat = popup.value;

acard.homeAddress = doc.getElementById('HomeAddress').value;
acard.homeAddress2 = doc.getElementById('HomeAddress2').value;
acard.homeCity = doc.getElementById('HomeCity').value;
acard.homeState = doc.getElementById('HomeState').value;
acard.homeZipCode = doc.getElementById('HomeZipCode').value;
acard.homeCountry = doc.getElementById('HomeCountry').value;
acard.webPage2 = CleanUpWebPage(doc.getElementById('WebPage2').value);

acard.department = doc.getElementById('Department').value;
acard.workAddress = doc.getElementById('WorkAddress').value;
acard.workAddress2 = doc.getElementById('WorkAddress2').value;
acard.workCity = doc.getElementById('WorkCity').value;
acard.workState = doc.getElementById('WorkState').value;
acard.workZipCode = doc.getElementById('WorkZipCode').value;
acard.workCountry = doc.getElementById('WorkCountry').value;
acard.webPage1 = CleanUpWebPage(doc.getElementById('WebPage1').value);

acard.custom1 = doc.getElementById('Custom1').value;
acard.custom2 = doc.getElementById('Custom2').value;
acard.custom3 = doc.getElementById('Custom3').value;
acard.notes = doc.getElementById('Notes').value;
*/

/**
 * Looks in the the given adress book child cards for the given card,
 * if found, the card is returned, otherwise null
 */
function findABCard (unique, book)
{
	var cards = book.childCards;
	cards.first();
	while (cards.currentItem())
	{
		var cur = cards.currentItem().QueryInterface(Components.interfaces.nsIAbCard);
		if (cur.custom4 == unique)
			return cur;

		try
		{
			cards.next();
		}
		catch (ex)
		{
			return null;
		}
	}
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

function doneCopyMessages ()
{
	alert ("ONE COPYING!!!");
}

// Step 3 15%
// saves the contact folder into fileContent
function getContactsContent ()
{
	
	// first we gotta copy the messages to  our "temp" folder
	consoleService.logStringMessage("got folder (final): " + gContactFolder.URI );

	// delete Temp folder if exist
//	deleteTempFolders();
/*	
	// create Temp folder
	var folderArray = Components.classes["@mozilla.org/supports-array;1"].
		createInstance(Components.interfaces.nsISupportsArray);
	var nameArray = Components.classes["@mozilla.org/supports-array;1"].
		createInstance(Components.interfaces.nsISupportsArray);        
	folderArray.AppendElement(rdf.GetResource(trashFolderUri));
	nameArray.AppendElement(rdf.GetLiteral(tempFolderName));
	try {
		DoRDFCommand(GetCompositeDataSource("NewFolder"),
			"http://home.netscape.com/NC-rdf#NewFolder", folderArray, nameArray);
	} catch(e) {
	}
*/	
//	copyAllMessages (gContactFolder.URI, tempFolderUri);

	var folderNativePath = gContactFolder.path.nativePath;
	//var numMsgs = gContactFolder.dBTransferInfo.NumMessages;
	// we need to download the messages before we can get the offline stream
	var list = Components.classes["@mozilla.org/supports-array;1"].createInstance(Components.interfaces.nsISupportsArray);
	var msgs = gContactFolder.getMessages(null);	
	while (msgs.hasMoreElements())
	{
		// i get an data:no exception here -on linux machines only ???
		var cur = msgs.getNext();
		list.AppendElement (cur);
	}

	
	// yeap I want to download the list, but I cant get the messages	
	gContactFolder.DownloadMessagesForOffline(list, msgWindow);


	// the file content
	fileContent = "";
	
	// see if there are any messages in this folder 
	var msgs = gContactFolder.getMessages(null);	

	// since we do not need to get the content if there is none skip this
	if (msgs.hasMoreElements())
	{
		var cur = null
//		try {
			cur = msgs.getNext().QueryInterface(Components.interfaces.nsIMsgDBHdr);
  		
		
		
			fileScriptableIO = Components.classes["@mozilla.org/scriptableinputstream;1"].createInstance(Components.interfaces.nsIScriptableInputStream);
			var foffset = new Object();
			fsize = new Object();
			fileInputStream = gContactFolder.getOfflineFileStream(cur.messageKey, foffset, fsize);
			fileScriptableIO.init(fileInputStream);
		
			// save the total filesize (+- something.. doesnt matter)
			fsize = fileScriptableIO.available();
			if (foffset.value > fsize)
				fsize = foffset.value ;
			cfsize = 0;
/*		}
		catch (ex)
		{
			consoleService.logStringMessage("Exception when getting offline stream");
		}*/
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
	statusMsg.value ="Parsing addresses...";
	meter.setAttribute("value", "20%");
	window.setTimeout(parseFolderToAddress, 100);	
}
var curAddressProgress;

// Step 4 60%
// lets do some parsing action
function parseFolderToAddress ()
{

	// we got the whole content		
	// lets parse it

	// an array that saves the added lines
	addLines = new Array();
	addLinesNum = new Array();

	// split into lines for easier parsing
	lines = fileContent.split("\n");

	curAddressProgress = 0;
	// the unique id is in second token in the mail subject (f.e. pas-id-3EF6F3700000002E) and
	// saved in the custom4 field of the card (is there an id field??)
	window.setTimeout(parseFolderToAddressRunner, 100);	
}

function parseFolderToAddressRunner ()
{
	var i = curAddressProgress;
	
	var cards = book.childCards;
	if (i < lines.length)
	{
		var x;
		for (x = 0; i < lines.length && x < lines.length/60; i++, x++)
		{
			// go on until we found a vcard
			var ctok = lines[i].split(":");
			if (ctok[0].toUpperCase() == "SUBJECT")
			{
				// ok we found one - lets get the id
				var vId = ctok[1].substring(1, ctok[1].length-1);
	
				// now check if we already got a card with this id (see custom4 field)
				var acard = findCard (cards, vId);
				
				// if we did not find one, add it
				var addCard = (acard==null);
				
				// until now our card is newer than the message - se we update the message
				var updateCard = false;
				var dateEmail = 0;
				
				// we did not find one - create a new vcard
				if (acard == null)
				{
					acard = Components.classes["@mozilla.org/addressbook/cardproperty;1"].createInstance(Components.interfaces.nsIAbCard);	
					// ok a new card means the message is up-to-date -> let's give in... :)
					updateCard = true;
				}
				else
				{
					// now we gotta check times... convert the message first
					var dateService = Components.classes["@mozilla.org/intl/scriptabledateformat;1"].getService(Components.interfaces.nsIScriptableDateFormat);
					// the date is in the next line -------- is it always?
					// Date: Fri, 17 Dec 2004 15:06:42 +0100
					var msgDate = new Date(Date.parse(lines[i+1].substring(lines[i+1].indexOf(":")+1, lines[i+1].length)));
	
					// save the date for later (in microsecs)
					dateEmail = msgDate.getTime() / 1000;
					
					// card date is in microsconds instead of millisecs 					
					if (dateEmail > acard.lastModifiedDate)
						updateCard = true;
					else
						updateCard = false;
					
				}
					
				// let's fill/update the card or the strings, increasing the linepointer on our way
	
				// we gotta update the message
				if (!updateCard)
				{
					// we need to update the message, so get the end of this one
					for (j=i; j < lines.length; j++)
					{
						// break out at the end of the vcard
						if (lines[j].toUpperCase().indexOf("END:VCARD") != -1)
							break;
					}
					// ok i is the beginning, j is the end, no update EVERYTHING we know
	
					// N:firstName;LastName;Nickname
					var cur;
					var curs;
					cur = findLine(lines, i, j, "N");
					curs = "N:"+acard.firstName+";"+acard.lastName+";;"+acard.nickName;
					if (curs.length == 5)
						curs = null
					if (cur == -1)
					{
						if (curs != null)
						{
							addLinesNum.push(j);
							addLines.push(curs);
						}
					}
					else
						lines[cur] = curs;
	
					cur = findLine(lines, i, j, "TITLE");
					curs = "TITLE:"+acard.jobTitle;
					if (curs.length == 6)
						curs = null
					if (cur == -1)
					{
						if (curs != null)
						{
							addLinesNum.push(j);
							addLines.push(curs);
						}
					}
					else
						lines[cur] = curs;
	
					cur = findLine(lines, i, j, "EMAIL");
					if (cur == -1) 
						cur = findLine (lines, i, j, "EMAIL;INTERNET");
					curs = "EMAIL:"+acard.primaryEmail;
					if (curs.length == 6)
						curs = null
					if (cur == -1)
					{
						if (curs != null)
						{
							addLinesNum.push(j);
							addLines.push(curs);
						}
					}
					else
						lines[cur] = curs;
	
					cur = findLine(lines, i, j, "FN");
					curs = "FN:"+acard.displayName;
					if (curs.length == 3)
						curs = null
					if (cur == -1)
					{
						if (curs != null)
						{
							addLinesNum.push(j);
							addLines.push(curs);
						}
					}
					else
						lines[cur] = curs;
	
					cur = findLine(lines, i, j, "ORG");
					curs = "ORG:"+acard.company;
					if (curs.length == 4)
						curs = null
					if (cur == -1)
					{
						if (curs != null)
						{
							addLinesNum.push(j);
							addLines.push(curs);
						}
					}
					else
						lines[cur] = curs;
	
					cur = findLine (lines, i, j, "TEL;TYPE=CELL;TYPE=VOICE");
					if (cur == -1) 
						cur = findLine (lines, i, j, "TEL;TYPE=VOICE;TYPE=CELL");
					if (cur == -1) 
						cur = findLine(lines, i, j, "TEL;TYPE=CELL");
					curs = "TEL;TYPE=CELL;TYPE=VOICE:"+acard.cellularNumber;
					if (curs.length == 25)
						curs = null
					if (cur == -1)
					{
						if (curs != null)
						{
							addLinesNum.push(j);
							addLines.push(curs);
						}
					}
					else
						lines[cur] = curs;
	
					cur = findLine(lines, i, j, "TEL;TYPE=HOME;TYPE=VOICE");
					if (cur == -1)
						cur = findLine(lines, i, j, "TEL;TYPE=VOICE;TYPE=HOME");
					if (cur == -1)
						cur = findLine(lines, i, j, "TEL;TYPE=VOICE");
					if (cur == -1)
						cur = findLine(lines, i, j, "TEL;TYPE=HOME");
					curs = "TEL;TYPE=HOME;TYPE=VOICE:"+acard.homePhone;
					if (curs.length == 25)
						curs = null
					if (cur == -1)
					{
						if (curs != null)
						{
							addLinesNum.push(j);
							addLines.push(curs);
						}
					}
					else
						lines[cur] = curs;
	
					cur = findLine(lines, i, j, "TEL;TYPE=FAX");
					curs = "TEL;TYPE=FAX:"+acard.faxNumber;
					if (curs.length == 13)
						curs = null
					if (cur == -1)
					{
						if (curs != null)
						{
							addLinesNum.push(j);
							addLines.push(curs);
						}
					}
					else
						lines[cur] = curs;
	
					cur = findLine(lines, i, j, "TEL;TYPE=WORK;TYPE=VOICE");
					if (cur == -1)
						cur = findLine(lines, i, j, "TEL;TYPE=VOICE;TYPE=WORK");
					if (cur == -1)
						cur = findLine(lines, i, j, "TEL;TYPE=WORK");
					curs = "TEL;TYPE=WORK;TYPE=VOICE:"+acard.workPhone;
					if (curs.length == 25)
						curs = null
					if (cur == -1)
					{
						if (curs != null)
						{
							addLinesNum.push(j);
							addLines.push(curs);
						}
					}
					else
						lines[cur] = curs;
	
					cur = findLine(lines, i, j, "TEL;TYPE=PAGE");
					curs = "TEL;TYPE=PAGE:"+acard.pagerNumber;
					if (curs.length == 14)
						curs = null
					if (cur == -1)
					{
						if (curs != null)
						{
							addLinesNum.push(j);
							addLines.push(curs);
						}
					}
					else
						lines[cur] = curs;
	
					cur = findLine(lines, i, j, "ADDR;TYPE=WORK");
					curs = "ADDR;TYPE=WORK:"+acard.workAddress;
					if (curs.length == 15)
						curs = null
					if (cur == -1)
					{
						if (curs != null)
						{
							addLinesNum.push(j);
							addLines.push(curs);
						}
					}
					else
						lines[cur] = curs;
	
					cur = findLine(lines, i, j, "NOTE");
					curs = "NOTE:"+acard.notes;
					if (curs.length == 5)
						curs = null
					if (cur == -1)
					{
						if (curs != null)
						{
							addLinesNum.push(j);
							// hey, a note can hold quite a few lines :)
							curs = curs.replace (/\n/g, "\\n");
							addLines.push(curs);
						}
					}
					else
						lines[cur] = curs;
	
				}
				else
				// stopping either at the end or an END:VCARD
				for (; i < lines.length; i++)
				{
					var vline = lines[i];
					
					// break out at the end of the vcard
					if (vline.toUpperCase().indexOf("END:VCARD") != -1)
						break;
						
					// strip the \n at the end
					vline = vline.substring(0, vline.length-1);
					
					var tok = vline.split(":");
					switch (tok[0].toUpperCase())
					{
						// N:firstName;LastName;Nickname
						case "N":
							if (updateCard)
							{
								var cur = tok[1].split(";");
								acard.firstName = cur[0];
								acard.lastName = cur[1];
								acard.nickName = cur[3];
							}
							else
							{
								lines[i] = "N:"+acard.firstName+";"+acard.lastName+";;"+acard.nickName;
							}							
							break;
						case "TITLE":
							if (updateCard)
								acard.jobTitle = tok[1];
							else
								lines[i] = "TITLE:"+acard.jobTitle;
							break;
						case "EMAIL;INTERNET":
						case "EMAIL":
							if (updateCard)
								acard.primaryEmail = tok[1];
							else
								lines[i] = "EMAIL:"+acard.primaryEmail;
					    break;
					  case "FN":
							if (updateCard)
						  	acard.displayName = tok[1];
							else
								lines[i] = "FN:"+acard.displayName;
					  	break;
					  case "ORG":
							if (updateCard)
						  	acard.company = tok[1];
							else
								lines[i] = "ORG:"+acard.company;
					  	break;
						// these two are the same
					  case "TEL;TYPE=CELL":
					  case "TEL;TYPE=CELL;TYPE=VOICE":
					  case "TEL;TYPE=VOICE;TYPE=CELL":
							if (updateCard)
						  	acard.cellularNumber = tok[1];
							else
								lines[i] = "TEL;TYPE=CELL:"+acard.cellularNumber;
					  	break;
					  	
					  case "TEL;TYPE=VOICE;TYPE=HOME":
					  case "TEL;TYPE=HOME;TYPE=VOICE":
					  case "TEL;TYPE=VOICE":
					  case "TEL;TYPE=HOME":
							if (updateCard)
						  	acard.homePhone = tok[1];
							else
								lines[i] = "TEL;TYPE=VOICE:"+acard.homePhone;
					  	break;
					  case "TEL;TYPE=FAX":
							if (updateCard)
						  	acard.faxNumber = tok[1];
							else
								lines[i] = "TEL;TYPE=FAX:"+acard.faxNumber;
					  	break;
					  case "TEL;TYPE=WORK":
					  case "TEL;TYPE=WORK;TYPE=VOICE":
					  case "TEL;TYPE=VOICE;TYPE=WORK":
							if (updateCard)
						  	acard.workPhone = tok[1];
							else
								lines[i] = "TEL;TYPE=WORK:"+acard.workPhone;
					  	break;
					  case "TEL;TYPE=PAGE":
							if (updateCard)
						  	acard.pagerNumber = tok[1];
							else
								lines[i] = "TEL;TYPE=PAGE:"+acard.pagerNumber;
					  	break;
					  case "ADDR;TYPE=WORK":
							if (updateCard)
						  	acard.workAddress = tok[1];
							else
								lines[i] = "ADDR;TYPE=WORK:"+acard.workAddress;
					  	break;
					  case "NOTE":
							if (updateCard)
						  	acard.notes = tok[1];
							else
								lines[i] = "NOTE:"+acard.notes;
					  	break;
					} // end switch
				} // end for
	
				// lets add the new card (if we have to)				
				if (addCard)
				{
					acard.custom4 = vId;
					acard.lastModifiedDate = dateEmail;
					
					book.addCard (acard);
				}
				else
				if (updateCard)
				{
					acard.editCardToDatabase ("moz-abmdbdirectory://"+gAddressBook);
				}
			}
		}
		var curpointer = 20 + (60*(i/lines.length));
		meter.setAttribute("value", curpointer + "%");
		curAddressProgress = i;
		window.setTimeout(parseFolderToAddressRunner, 5);	
	}
	else
	{
		window.setTimeout(parseFolderToAddressFinish, 100);	
	}
}

function parseFolderToAddressFinish ()
{
	// do step 5
	meter.setAttribute("value", "80%");
	statusMsg.value ="Writing changed contacts...";
	window.setTimeout(writeContent, 100);	
}

// Step 5  10%
// write everything in a temp folder
function writeContent ()
{
  deleteTempFolders();

	// create the temp folder  
  var folderArray = Components.classes["@mozilla.org/supports-array;1"].
      createInstance(Components.interfaces.nsISupportsArray);
  var nameArray = Components.classes["@mozilla.org/supports-array;1"].
      createInstance(Components.interfaces.nsISupportsArray);        
  folderArray.AppendElement(rdf.GetResource(trashFolderUri));
  nameArray.AppendElement(rdf.GetLiteral(tempFolderName));
  try {
      DoRDFCommand(GetCompositeDataSource("NewFolder"),
          "http://home.netscape.com/NC-rdf#NewFolder", folderArray, nameArray);
  } catch(e) {
  }

  var destResource = rdf.GetResource(tempFolderUri);
  var destMsgFolder = destResource.QueryInterface(Components.interfaces.nsIMsgFolder);

	var fileName = destMsgFolder.path.nativePath;

	// delete the temp folder (otherwise the new folder cant be created and therefore the messages wont get reloaded)
	deleteTempFolders ()	
		
	// ok we are done checking everything, now we gotta save the changed contacts
	// back to the folder 
	var sfile = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
	// temp path
	sfile.initWithPath(fileName ); //(folderNativePath); 
	if (sfile.exists()) 
		sfile.remove(true);
	sfile.create(sfile.NORMAL_FILE_TYPE, 0666);
  
	// create a new message in there
  	var stream = Components.classes['@mozilla.org/network/file-output-stream;1'].createInstance(Components.interfaces.nsIFileOutputStream);
  	stream.init(sfile, 2, 0x200, false); // open as "write only"

	var curAddi = 0;
	var curAddLine = -1;
	if (addLines.length > 0)
		curAddLine = addLinesNum[0];
	
	for (var i = 0; i < lines.length; i++)
	{
			// check if we have to append a few lines now
			while (curAddLine == i)
			{
				var line = addLines[curAddi];
				if (line != null)
				{
					line = line + "\n";
		  		stream.write(line, line.length);
		  	}
	  		
				if (addLines.length > curAddi)
		  		curAddLine = addLinesNum[curAddi++];
		  	else
		  		curAddLine = -1;
			}
			if (lines[i] != null)
			{
				var line = lines[i]+"\n";
				// nasty bug with line 0, lets fix it up
				if (i == 0)
					line = "From -" + line;
  			stream.write(line, line.length);
  		}
  }
  // now we gotta write all contacts we didnt add yet...
  
	var cards = book.childCards;
	cards.first();
	while (cards.currentItem())
	{
		var cur = cards.currentItem().QueryInterface(Components.interfaces.nsIAbCard);
		if (cur.custom4.length < 2)
		{
			// look a new card
			// generate a unique id
			line = 'From - Thu Feb 17 22:18:55 2005\n';
 			stream.write(line, line.length);
			line = 'X-Mozilla-Status: 0001\n';
 			stream.write(line, line.length);
			line = 'X-Mozilla-Status2: 00000000\n';
 			stream.write(line, line.length);
			line = 'Content-Type: Text/X-VCard;\n';
 			stream.write(line, line.length);
			line = '  charset="utf-8"\n';
 			stream.write(line, line.length);
			line = 'Reply-To: \n';
 			stream.write(line, line.length);
			line = 'From: \n';
 			stream.write(line, line.length);
			line = 'Bcc: \n';
 			stream.write(line, line.length);
			line = 'To: \n';
 			stream.write(line, line.length);
			line = 'Subject: ' + cur.custom4 + '\n';
 			stream.write(line, line.length);
			line = 'Date: Fri, 17 Dec 2004 15:07:47 +0100\n';
 			stream.write(line, line.length);
			line = 'User-Agent: Generator\n\n';
 			stream.write(line, line.length);
			line = unescape(cur.convertToEscapedVCard());
			line = line.substring(0, line.length - 14)
			line = line + "\nUID:"+cur.custom4+"\nend:vcard\n\n\n";
 			stream.write(line, line.length);
 			
			cur.custom4 = "vCard pas-id-" + get_randomVcardId();
			cur.editCardToDatabase ("moz-abmdbdirectory://"+gAddressBook);
		}

		try
		{
			cards.next();
		}
		catch (ex)
		{
			break;
		}
	}
  stream.close();
  
  // dont know yet if we have to call the initWithPath again...
  var sfile = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
  sfile.initWithPath(fileName);

  curstep = 6;
  mailSession.AddFolderListener(syncFolderListener, Components.interfaces.nsIFolderListener.all);
  ChangeFolderByURI(gContactFolder.folderURL, 0, 0, 18, 0);  

   // now we are going to recreate the temp folder so that the msf file gets recreated
/*
  var trashFolder = RDF.GetResource(trashFolderUri).QueryInterface(Components.interfaces.nsIMsgFolder);
  var tempFolder = trashFolder.addSubfolder(tempFolderName);
  //var tempFolder = RDF.GetResource(tempFolderUri).QueryInterface(Components.interfaces.nsIMsgFolder);
  trashFolder.NotifyItemAdded(trashFolder,tempFolder,"Folder Added");
  tempFolder.updateSummaryTotals(true);
  curstep = 6;
  mailSession.AddFolderListener(syncFolderListener, Components.interfaces.nsIFolderListener.all);
  ChangeFolderByURI(tempFolderUri, 0, 0, 18, 0);  
*/  
/*  
  messenger.CopyMessages(GetFolderDatasource(), sourceResource, destResource, list, false);
	  
  // now copy the messages from the tmp folde to the original folder
  var sourceResource = rdf.GetResource(tempFolderUri);
  var destResource = rdf.GetResource(gContactFolder.URI);
  var list = Components.classes["@mozilla.org/supports-array;1"].createInstance(Components.interfaces.nsISupportsArray);
  
  // alist of all messages
  var sFolder = gContactFolder;//sourceResource.QueryInterface(Components.interfaces.nsIMsgFolder);
  var msgs = sFolder.getMessages(null);
	while (msgs.hasMoreElements())
	{
		var cur = msgs.getNext().QueryInterface(Components.interfaces.nsIMsgDBHdr);
	  list.AppendElement(cur);
	}
  //gmessenger.CopyMessages(gFolderDatasource, sourceResource, destResource, list, false);
  gContactFolder.copyMessages(sourceResource, list, false, null, null, false, false);
*/	  
}

function copyMessagesBack ()
{
	// original folder selected
	if (curstep == 6)
	{
		// select all messages
		var dbv = GetDBView();
		curstep = 7;
		mailSession.AddFolderListener(syncFolderListener, Components.interfaces.nsIFolderListener.all);
		dbv.doCommand(nsMsgViewCommandType.selectAll);
		// all original messages selected
		
		statusMsg.value ="Deleting original contacts...";
		// delete them
		dbv.doCommand(nsMsgViewCommandType.deleteMsg);
	}
	// original messages deleted
	if (curstep == 7)
	{
		// select new folder
	  var trashFolder = RDF.GetResource(trashFolderUri).QueryInterface(Components.interfaces.nsIMsgFolder);
	  var tempFolder = trashFolder.addSubfolder(tempFolderName);
	  trashFolder.NotifyItemAdded(trashFolder,tempFolder,"Folder Added");
	  tempFolder.updateSummaryTotals(true);
	  curstep = 8;
		statusMsg.value ="Selecting temp folder...";
	  mailSession.AddFolderListener(syncFolderListener, Components.interfaces.nsIFolderListener.all);
	  ChangeFolderByURI(tempFolderUri, 0, 0, 18, 0);  
	}
	// new folder selected
	if (curstep == 8)
	{
	  var tempDB = document.defaultView.gDBView.db; 
	  
	  var list = Components.classes["@mozilla.org/supports-array;1"].createInstance(Components.interfaces.nsISupportsArray);
	  var sourceResource = rdf.GetResource(tempFolderUri);
	  var destResource = rdf.GetResource(gContactFolder.URI);
	  var enumerator = tempDB.EnumerateMessages();
	  var count = 0;
	  if ( enumerator ) {
	    while ( enumerator.hasMoreElements() ) {
	        var header = enumerator.getNext();
	        header instanceof Components.interfaces.nsIMsgDBHdr;
	        list.AppendElement(header);
	        count++;
	    }
	  }

	  // we have more than one...
	  if (count != 0)
	  {
		curstep = 9;
		mailSession.AddFolderListener(syncFolderListener, Components.interfaces.nsIFolderListener.all);
        	messenger.CopyMessages(GetFolderDatasource(), sourceResource, destResource, list, false);
	  }
	statusMsg.value ="Copying contacts...";
	}
	// messages copied
	if (curstep == 9)
	{
		meter.setAttribute("value", "100%");
		statusMsg.value ="Done, you can close this box now!";
	}
	
}

var syncFolderListener = {
	OnItemAdded: function(parentItem, item) { },
	OnItemRemoved: function(parentItem, item) { },
	OnItemPropertyChanged: function(item, property, oldValue, newValue) { },
	OnItemIntPropertyChanged: function(item, property, oldValue, newValue) { },
	OnItemBoolPropertyChanged: function(item, property, oldValue, newValue) { },
	OnItemUnicharPropertyChanged: function(item, property, oldValue, newValue){ },
	OnItemPropertyFlagChanged: function(item, property, oldFlag, newFlag) { },
	OnItemEvent: function(folder, event) {
		var eventType = event.toString();
		mailSession.RemoveFolderListener(syncFolderListener );
		//mailSession.RemoveFolderListener(this);
		if (eventType == 'CompactCompleted') {
		}
		if (eventType == 'FolderLoaded') {
			copyMessagesBack();
		}
		if (eventType == 'DeleteOrMoveMsgCompleted') {
			copyMessagesBack();
		}
	}  
};



var copyMessageStep;
var copyMessageFromURI;
var copyMessageToUri;
/**
 * Copyies all messages from one folder to another
 * when finished doneCopyMessages () will be called
 */
function copyAllMessages (fromURI, toURI)
{
	copyMessageStep = 1;
	copyMessageFromURI = fromURI;
	copyMessageToUri = toURI;
	mailSession.AddFolderListener(copyFolderListener, Components.interfaces.nsIFolderListener.all);
	consoleService.logStringMessage("Change Folder " + copyMessageFromURI);
	ChangeFolderByURI(copyMessageFromURI, 0, 0, 18, 0);  
}

function copyMessagesWorker ()
{
	// original folder selected
	if (copyMessageStep == 1)
	{
		// select all messages
		var dbv = GetDBView();
		curstep = 2;
		dbv.doCommand(nsMsgViewCommandType.selectAll);
		
		var tempDB = document.defaultView.gDBView.db; 
		var sourceResource = rdf.GetResource(copyMessageFromURI);
		var destResource = rdf.GetResource(copyMessageToUri);

		var enumerator = tempDB.EnumerateMessages();
		var count = 0;
		if ( enumerator ) {
		while ( enumerator.hasMoreElements() ) {
			var header = enumerator.getNext();
			header instanceof Components.interfaces.nsIMsgDBHdr;
			list.AppendElement(header);
			count++;
		}
		}
	
		// we have more than one...
		if (count != 0)
		{
			curstep = 2;
			mailSession.AddFolderListener(copyFolderListener, Components.interfaces.nsIFolderListener.all);
			messenger.CopyMessages(GetFolderDatasource(), sourceResource, destResource, list, false);
		}
		
	}
	// everything copied
	if (curstep == 2 )
	{
		doneCopyMessages ();
	}	
}

var copyFolderListener = {
	OnItemAdded: function(parentItem, item) { },
	OnItemRemoved: function(parentItem, item) { },
	OnItemPropertyChanged: function(item, property, oldValue, newValue) { },
	OnItemIntPropertyChanged: function(item, property, oldValue, newValue) { },
	OnItemBoolPropertyChanged: function(item, property, oldValue, newValue) { },
	OnItemUnicharPropertyChanged: function(item, property, oldValue, newValue){ },
	OnItemPropertyFlagChanged: function(item, property, oldFlag, newFlag) { },
	OnItemEvent: function(folder, event) {
		var eventType = event.toString();
		mailSession.RemoveFolderListener(copyFolderListener );
		//mailSession.RemoveFolderListener(this);
		if (eventType == 'CompactCompleted') {
		}
		if (eventType == 'FolderLoaded') {
			copyMessagesWorker();
		}
		if (eventType == 'DeleteOrMoveMsgCompleted') {
			copyMessagesWorker();
		}
	}  
};
