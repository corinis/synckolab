////////////////////////////////// HELP FUNCTIONS /////////////////////////////////////////


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

/**
 * @param accountKey the key for the account (baseMessageURI)
 * @param path the path of the folder
 * @return the nsIMsgFolder for the given account and path
 */
function getMsgFolder (accountKey, path)
{
	var accountManager = Components.classes['@mozilla.org/messenger/account-manager;1'].getService(Components.interfaces.nsIMsgAccountManager);
	var gInc = null;
	for (var i = 0; i < accountManager.allServers.Count(); i++)
	{
		var account = accountManager.allServers.GetElementAt(i).QueryInterface(Components.interfaces.nsIMsgIncomingServer);
		if (account.rootMsgFolder.baseMessageURI == accountKey)
		{
			gInc = account;
		}
	}
	
	if (gInc == null)
		return null;
	
	return gInc.getMsgFolderFromURI(gInc.rootFolder, path);
}
