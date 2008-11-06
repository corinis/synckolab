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
 * Contributor(s):	Niko Berger <niko.berger@corinis.com>
 *               	Andreas Gungl <a.gungl@gmx.de>
 *					Arsen Stasic <arsen.stasic@wu-wien.ac.at>
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

////////////////////////////////// HELP FUNCTIONS /////////////////////////////////////////

var LOG_ERROR = 0;
var LOG_WARNING = 1;
var LOG_INFO = 2;
var LOG_DEBUG = 3;
var LOG_CAL = 4;
var LOG_AB = 8;
var LOG_ALL = 12;

function checkExist (value)
{
	return (value != null && value != "");
}

/**
 * Some accounts have special characters in their name which do not mix well with configs
 */
function accountNameFix (name)
{
	return name.replace(/[ :@\%\'\"-\?\#+\*\.;$\\\/]/g, "");
}

/**
 * Takes a string which should have an xml in there,
 * and applies a few things to make sure its parseable
 */
function fixString4XmlParser (s)
{
	t = s.replace(/version=.0/g, "version=\"1.0");
	return t.replace(/&/g, "&amp;").replace(/amp;amp;/g, "amp;")
}

/**
 * remove possible problematic chars from a name
 */
function fixNameToMiniCharset (name)
{
	var ret = "";
	var placeHolder = false;
	for (var i = 0; i < name.length; i++)
	{
		switch (name.charAt(i))
		{
			// character replaces... better this way
			case 'Ä':
			case 'Â':
			case 'À':
			case 'Á':
				placeHolder = false;
				ret += 'A';
				break;
				
			case 'ä':
			case 'â':
			case 'á':
			case 'à':
				placeHolder = false;
				ret += 'a';
				break;
			case 'Ö':
			case 'Ò':
			case 'Ó':
			case 'Ô':
				placeHolder = false;
				ret += 'O';
				break;
			case 'ö':
			case 'ô':
			case 'ó':
			case 'ò':
				placeHolder = false;
				ret += 'o';
				break;
			case 'Ü':
			case 'Û':
			case 'Ú':
			case 'Ù':
				placeHolder = false;
				ret += 'U';
				break;
			case 'ü':
			case 'û':
			case 'ú':
			case 'ù':
				placeHolder = false;
				ret += 'u';
				break;
			case 'î':
			case 'ì':
			case 'í':
				placeHolder = false;
				ret += 'i';
				break;
			case 'Î':
			case 'Í':
			case 'Ì':
				placeHolder = false;
				ret += 'I';
				break;
			case 'ß':
				placeHolder = false;
				ret += 's';
				break;

			// chars which are no problem just stay
			case '~':
			case '-':
			case '.':
				placeHolder = false;
				ret += name.charAt(i);
				break;
				
			default:
				var c = name.charAt(i);
				if ((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' &&
						c <= '9'))
				{
					placeHolder = false;
					ret += c;
				}
				else
				{
					if (!placeHolder)
					{
						ret += '_';
						placeHolder = true;
					}
				}
		}
	}
	return ret;
}

/**
 * Returns a file class for the given sync db file
 * this also creates the required subdirectories if not yet existant
 * you can use the .exists() function to check if we go this one already
 */
function getSyncDbFile (config, type, id)
{
	if (id == null)
	{
    	logMessage("Error: entry has no id (" +config + ": " + type + ")", LOG_ERROR);	
		return null;
	}
		
	id = id.replace(/[ :.;$\\\/]/g, "_");
	var file = Components.classes["@mozilla.org/file/directory_service;1"].
	   getService(Components.interfaces.nsIProperties).
	   get("ProfD", Components.interfaces.nsIFile);
	file.append("synckolab");
	if (!file.exists())
		file.create(1, 0775);
		
	file.append(type);
	
	if (!file.exists())
		file.create(1, 0775);

	file.append(config);
	if (!file.exists())
		file.create(1, 0775);
	file.append(id);
	return file;
}


/**
 * writes a sync file
 */
function writeSyncDBFile(file, content)
{
	if (content == null)
		return;
		
	if (file.exists()) 
		file.remove(true);
	file.create(file.NORMAL_FILE_TYPE, 0666);
 	var stream = Components.classes['@mozilla.org/network/file-output-stream;1'].createInstance(Components.interfaces.nsIFileOutputStream);
 	stream.init(file, 2, 0x200, false); // open as "write only"
	stream.write(content, content.length);
	stream.close();
}


/**
 * reads a given sync file
 */
function readSyncDBFile (file)
{	
	if (file == null)
	{
		logMessage("readSyncDBFile ERROR: file is null");
		return null;
	}
	
	if ((!file.exists()) || (!file.isReadable()))
		return null;
	
	 // setup the input stream on the file
	var istream = Components.classes["@mozilla.org/network/file-input-stream;1"]
		.createInstance(Components.interfaces.nsIFileInputStream);
	istream.init(file, 0x01, 4, null);
	var fileScriptableIO = Components.classes["@mozilla.org/scriptableinputstream;1"].createInstance(Components.interfaces.nsIScriptableInputStream); 
	fileScriptableIO.init(istream);
	// parse the xml into our internal document
	istream.QueryInterface(Components.interfaces.nsILineInputStream); 
	var fileContent = "";
	var csize = 0; 
	while ((csize = fileScriptableIO.available()) != 0)
	{
		fileContent += fileScriptableIO.read( csize );
	}
	fileScriptableIO.close(); 	
	istream.close();

	return trim(fileContent);
}



/**
 * Removes a possible mail header and extracts only the "real" content.
 * This also trims the message and removes some common problems (like -- at the end)
 */
function stripMailHeader (content)
{
	if (content == null)
		return null;
	
	var capBoundary = false;
	var isMultiPart = content.indexOf('boundary=') != -1;
	// boundary might be uppercase
	if (!isMultiPart && content.indexOf('BOUNDARY=') != -1)
	{
		capBoundary = true;
		isMultiPart = true;
	}
	
	
 	// seems we go us a vcard/ical when no xml is found
	if (!isMultiPart)
 	{
		var startPos = content.indexOf("\r\n\r\n");
		if (startPos == -1 || startPos > content.length - 10)
			startPos = content.indexOf("\n\n");

		if (startPos == -1 || startPos > content.length - 10)
			startPos = 0;			

		return trim(content.substring(startPos, content.length));
	}

	// we got a multipart message - strip it apart

	// XXXboundary="XXX" or XXXboundary=XXX\n
	var boundary = null;
	boundary = content.substring(content.indexOf(capBoundary?'BOUNDARY=':'boundary=')+9);

	// lets trim boundary (in case we have whitespace after the =
	boundary = trim(boundary);

	// if the boundary string starts with "... we look for an end
	if (boundary.charAt(0) == '"')
	{
		// get rid of the first "
		boundary = boundary.substring(1);
		// find the second "
		boundary = boundary.substring(0, boundary.indexOf('"'));
	}
	else
	{
		// cut away at \n or \r or space.. whichever comes first
		var cutWS = boundary.indexOf(' ');		
		var ws = boundary.indexOf('\n');
		if (ws != -1 && ws < cutWS)
			cutWS = ws;
		ws = boundary.indexOf('\t');
		if (ws != -1 && ws < cutWS)
			cutWS = ws;
		ws = boundary.indexOf('\r');
		if (ws != -1 && ws < cutWS)
			cutWS = ws;
		boundary = boundary.substring(0, cutWS);
	}
	// try to get the start of the card part
	
	// check kolab XML first
	var contentIdx = -1;
	var contTypeIdx = content.indexOf('Content-Type: application/x-vnd.kolab.');
	if (contTypeIdx != -1)
	{
		content = content.substring(contTypeIdx); // cut everything before this part
		// there might be a second boundary... remove that as well
		var endcontentIdx = content.indexOf(boundary);
		if (endcontentIdx != -1)
			content = content.substring(0, endcontentIdx);
		if ((new RegExp ("--$")).test(content))
			content = content.substring(0, content.length - 2);
			
		contentIdx = content.indexOf("<?xml");
	}
	else
	{
		// check for vcard | ical
		contTypeIdx = content.indexOf('Content-Type: text/x-vcard');
		if (contTypeIdx == -1)
			contTypeIdx = content.indexOf('Content-Type: text/x-ical');
		if (contTypeIdx == -1)
			contTypeIdx = content.indexOf('Content-Type: text/calendar');
			
		if (contTypeIdx != -1)
		{
			content = content.substring(contTypeIdx); // cut everything before this part
			// there might be a second boundary... remove that as well
			var endcontentIdx = content.indexOf(boundary);
			if (endcontentIdx != -1)
				content = content.substring(0, endcontentIdx);
			if ((new RegExp ("--$")).test(content))
				content = content.substring(0, content.length - 2);
			
			contentIdx = content.indexOf("BEGIN:");
		}
	}
	 

	// if we did not find a decoded card, it might be base64
	if (contentIdx == -1)
	{
		var isQP = content.search(/Content-Transfer-Encoding: quoted-printable/i);
		var isBase64 = content.search(/Content-Transfer-Encoding: base64/i);
		
		if (isBase64 != -1)
		{
			logMessage("Base64 Decoding message. (Boundary: "+boundary+")", LOG_INFO);
			// get rid of the header
			content = content.substring(isBase64, content.length);
			var startPos = content.indexOf("\r\n\r\n");
			var startPos2 = content.indexOf("\n\n");
			if (startPos2 != -1 && (startPos2 < startPos || startPos == -1))
				startPos = startPos2;

			var endPos = content.indexOf("--"); // we could check for "--"+boundary but its not necessary since base64 doesnt allow it anyways
			// we probably removed the -- already, but to make sure
			if (endPos == -1)
				endPos = content.length;
				
			content = trim(content.substring(startPos, endPos).replace(/[\r\n]/g, ""));

			logMessage("Base64 message: " + content, LOG_DEBUG);
			
			// for base64 we use a two storied approach
			// first: use atob 
			// if that gives us an outofmemoryexception use the slow but working javascript
			// engine
			try {
				content = atob(content)
			} catch (e) {
				// out of memory error... this can be handled :)
				if (e.result == Components.results.NS_ERROR_OUT_OF_MEMORY)
				{
					var base64 = new JavaScriptBase64;
				 	base64.JavaScriptBase64(content);					
					content = base64.decode();
					logMessage("decoded base64: " + content, LOG_DEBUG);
				
				}
				else
				{
					logMessage("Error decoding base64 (" + e + "): " + content, LOG_ERROR);
					return null;
				}
			}
		}
		else
		if (isQP != -1)
		{
			content = content.substring(isQP, content.length);
			content = content.replace(/=[\r\n]+/g, "").replace(/=[0-9A-F]{2}/gi,
			                        function(v){ return String.fromCharCode(parseInt(v.substr(1),16)); });
		}
		else
		{
			// so this message has no <xml>something</xml> area
			logMessage("Error parsing this message: no xml segment found\n" + content, LOG_ERROR);
			return null;
		}
	}
	else
	{
		content = content.substring(contentIdx);
		// until the boundary = end of xml|vcard/ical
		if (content.indexOf(boundary) != -1)
			content = content.substring(0, content.indexOf("--"+boundary));
	}
	
	return trim(content);
}


/**
 * Retrieves a file in the user profile dir which includes the config database
 * make sure to add .cal, .con or .task at the config so there are no duplicate names
 */
function getHashDataBaseFile (config)
{
	var file = Components.classes["@mozilla.org/file/directory_service;1"].
	   getService(Components.interfaces.nsIProperties).
	   get("ProfD", Components.interfaces.nsIFile);
	
	file.append(config+".hdb");
	return file;
}

/**
 * reads a database in a twodim array
 */
function readDataBase (dbf)
{
	var db = new Array();
	
	if (dbf == null || !dbf.exists() || !dbf.isReadable())
		return db;
	
	 // setup the input stream on the file
	var istream = Components.classes["@mozilla.org/network/file-input-stream;1"]
		.createInstance(Components.interfaces.nsIFileInputStream);
	istream.init(dbf, 0x01, 4, null);
	var fileScriptableIO = Components.classes["@mozilla.org/scriptableinputstream;1"].createInstance(Components.interfaces.nsIScriptableInputStream); 
	fileScriptableIO.init(istream);
	// parse the xml into our internal document
	istream.QueryInterface(Components.interfaces.nsILineInputStream); 
	var fileContent = "";
	var csize = 0; 
	while ((csize = fileScriptableIO.available()) != 0)
	{
		fileContent += fileScriptableIO.read( csize );
	}
	fileScriptableIO.close(); 	
	istream.close();
	
	var lines = fileContent.split("\n");
	for (var i = 0; i < lines.length; i++)
		if (lines[i].indexOf(":") != -1)
		{
			db[i] = trim(lines[i]).split(":");
	    }
	return db;
}

/**
 * Gets rid of whitespace at the beginning and the end of a string
 */
function trim(s) {
  while (isWhiteSpace(s.charAt(0)))
    s = s.substring(1);
  
  while (isWhiteSpace(s.charAt(s.length-1)))
    s = s.substring(0,s.length-1);
    
  return s;
}


function isWhiteSpace (c)
{
	return c == ' ' || c == '\n' || c == '\r' || c == '\t';
}

/**
 * returns the position of this entry in the db
 */
function getDbEntryIdx (key, db)
{
 	for (var i = 0; db[i]; i++)
 	{
		if (db[i] && key == db[i][0])
			return i;
	}
	return -1;	
}

/**
 * writes a database file (key:hashvalue:h2)
 */
function writeDataBase(dbf, db)
{
	logMessage("Writing database file: " + dbf.path, LOG_INFO);
	if (dbf.exists()) 
		dbf.remove(true);
	dbf.create(dbf.NORMAL_FILE_TYPE, 0640);
 	var stream = Components.classes['@mozilla.org/network/file-output-stream;1'].createInstance(Components.interfaces.nsIFileOutputStream);
 	stream.init(dbf, 2, 0x200, false); // open as "write only"
 	for (var i = 0; i < db.length; i++)
 	{
 		if (db[i][0] != "" && db[i][0] != null)
 		{
 			var s = db[i][0];
 			for (var j = 1; db[i][j]; j++)
 				s += ":" + db[i][j];
 			s += "\n";
			stream.write(s, s.length);
		}
	}
	s = "\n\n";
	stream.write(s, s.length);
	stream.close();

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
 * @param vId string - the custom4 field (card id)
 */
function findCard (cards, vId, directory)
{
	// nothing found - try mailing lists
	var card = cards.get(vId);
	if (card != null)
		return card;
	
	if (directory != null)
	{
		var cn = directory.childNodes;
		var ABook = cn.getNext();
		while (ABook != null)
		{
			var cur = ABook.QueryInterface(Components.interfaces.nsIAbDirectory);
			if (cur.listNickName == vId)
			{
				return cur;
			}
			ABook = cn.getNext();
		}
	}

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
 * @return the account name
 */
function getAccountName (accountKey)
{
	var accountManager = Components.classes['@mozilla.org/messenger/account-manager;1'].getService(Components.interfaces.nsIMsgAccountManager);
	var gInc = null;
	for (var i = 0; i < accountManager.allServers.Count(); i++)
	{
		var account = accountManager.allServers.GetElementAt(i).QueryInterface(Components.interfaces.nsIMsgIncomingServer);
		if (account.rootMsgFolder.baseMessageURI == accountKey || accountNameFix(account.rootMsgFolder.baseMessageURI) == accountKey)
		{
			return accountManager.getFirstIdentityForServer (account).fullName;
		}
	}
}


/** 
 * @param accountKey the key for the account (baseMessageURI)
 * @return the email address
 */
function getAccountEMail (accountKey)
{
	var accountManager = Components.classes['@mozilla.org/messenger/account-manager;1'].getService(Components.interfaces.nsIMsgAccountManager);
	var gInc = null;
	for (var i = 0; i < accountManager.allServers.Count(); i++)
	{
		var account = accountManager.allServers.GetElementAt(i).QueryInterface(Components.interfaces.nsIMsgIncomingServer);
		if (account.rootMsgFolder.baseMessageURI == accountKey || accountNameFix(account.rootMsgFolder.baseMessageURI) == accountKey)
		{
			return accountManager.getFirstIdentityForServer (account).email;
		}
	}
}


/**
 * @param accountKey the key for the account (baseMessageURI)
 * @param path the path of the folder
 * @return the nsIMsgFolder for the given account and path
 */
function getMsgFolder (accountKey, path)
{

	logMessage("trying to get folder: '" +  path + "' for account " + accountKey, LOG_DEBUG);

	var accountManager = Components.classes['@mozilla.org/messenger/account-manager;1'].getService(Components.interfaces.nsIMsgAccountManager);
	var gInc = null;
	for (var i = 0; i < accountManager.allServers.Count(); i++)
	{
		var account = accountManager.allServers.GetElementAt(i).QueryInterface(Components.interfaces.nsIMsgIncomingServer);
		if (account.rootMsgFolder.baseMessageURI == accountKey || accountNameFix(account.rootMsgFolder.baseMessageURI) == accountKey)
		{
			gInc = account;
		}
	}
	
	// no account
	if (gInc == null)
	{
		alert("Mailaccount '"+accountKey+"'not found!\nPlease Check configuration");
		return null;
	}
	
	var cFolder = gInc.rootFolder;
	while (cFolder != null)
	{
		var subfolders = cFolder.GetSubFolders ();
		cFolder = null;
		try
		{
			subfolders.first ();
		}
		catch (ex)
		{
			alert("NOTHING " +ex+ " : " + msgFolder.prettyName);
			return;
		}
		while (subfolders != null)
		{
			var cur = subfolders.currentItem().QueryInterface(Components.interfaces.nsIMsgFolder);
			// we found it
			if (path == cur.URI)
			{
				logMessage("we found our path!!!: " + cur.URI, LOG_DEBUG);
				return cur;
			}
				
			// if the current path is the start of what we are lookiong for, go deeper
			var cp = path.substring(0, path.indexOf('/', cur.URI.length));
			
			if (cp == cur.URI)
			{
				logMessage("got subpath: " + cur.URI, LOG_DEBUG);
			
				cFolder = cur;
				break;
			}
			
			if (subfolders.isDone())
				break;
			try
			{
				subfolders.next();
			}
			catch (ex)
			{
				break;
			}
		}
		// we didnt found the path somehow
		if (cFolder == null)
		{
			alert("Folder '"+path+"' not found!\nPlease Check configuration");
			return null;
		}
	}
	
	// get the folder
	return null;
//	return gInc.getMsgFolderFromURI(gInc.rootFolder, path);
}


/* ------ convenience functions to deal with an XML DOM tree ------------- */

/**
 * return the content of a child node with name "name" of the node "node"
 * or the given default "def" if no such node exists
 */
function getXmlResult (node, name, def)
{
	var cur = node.firstChild;
	while(cur != null)
	{
		if (cur.nodeName.toUpperCase() == name.toUpperCase())
		{
			if (cur.hasChildNodes())
			{
				var value = cur.firstChild.nodeValue;
				// decode the value
				if (value != null)
					return decode4XML(value);
			}
		}
		cur = cur.nextSibling;
	}
	return def;
}


/**
 * return a direct child node with the name "name" of the node "node"
 */
function getXmlChildNode (node, name)
{
	var cur = node.firstChild;
	while(cur != null)
	{
		if (cur.nodeName.toUpperCase() == name.toUpperCase())
		{
			return cur;
		}
		cur = cur.nextSibling;
	}
	return null;
}


/**
 * return the value of the attribute with name "attrName" of the node "node"
 * or null, if no attribute with that name exists
 */
function getXmlAttributeValue (node, attrName)
{
	if (node.hasAttributes())
	{
		var attrList = node.attributes;
		var node = attrList.getNamedItem(attrName);
		if (node != null)
			return node.nodeValue;
		else consoleService.logStringMessage("attribute not found: " + attrName);
	}
	else
		consoleService.logStringMessage("node has no attributes");
	return null;
}

function nodeWithContent (nodeName, nodeValue, createNonExist)
{
	if (!createNonExist && !checkExist (nodeValue))
		return "";
	return "<"+nodeName+">" + (checkExist (nodeValue)?encode4XML(nodeValue):"") + "</"+nodeName+">\n";
}


/* ------ functions for date / string conversions ------------------------ */

// takes: 2005-03-30T15:28:52Z or 2005-03-30 15:28:52
function string2DateTime (val)
{
	// in case its a date without time
	if (val.indexOf(":") == -1)
		return string2Date(val);
		
	var s = val.replace('T', ' ');
	s = s.replace('Z', '');
	var both = s.split(' ');
	var cdate = both[0].split('-');
	var ctime = both[1].split(':');
	return new Date(cdate[0], cdate[1]-1, cdate[2], ctime[0], ctime[1], ctime[2]);

}

// takes: 2005-03-30T15:28:52Z or 2005-03-30 15:28:52
function string2CalDateTime (val, useUTC)
{
	// in case its a date without time fall back to string2CalDate()
	if (val.indexOf(":") == -1)
		return string2CalDate(val);
		
	var s = val.replace('T', ' ');
	s = s.replace('Z', '');
	var both = s.split(' ');
	var cdate = both[0].split('-');
	var ctime = both[1].split(':');
    var calDateTime = null;
    // lightning 0.9pre fix (uses createDateTime)
	if (createDateTime)
		calDateTime = new createDateTime();
	else
		calDateTime = new CalDateTime();
  
    var jsDate = null;
    if (useUTC)
        jsDate = new Date(Date.UTC(cdate[0], cdate[1]-1, cdate[2], ctime[0], ctime[1], ctime[2]));
    else
        jsDate = new Date(cdate[0], cdate[1]-1, cdate[2], ctime[0], ctime[1], ctime[2]);
    calDateTime.jsDate = jsDate
	return calDateTime;
}

// produces: 2005-03-30
function date2String (cdate)
{
	if (!cdate)
		return '';
	return cdate.getFullYear() + "-" + (cdate.getMonth()+1 < 10?"0":"") + (cdate.getMonth()+1) + "-" +
		(cdate.getDate() < 10?"0":"") + cdate.getDate();
}
// produces 15:28:52
function time2String (cdate)
{
	return (cdate.getHours()<10?"0":"") + cdate.getHours() + ":" + (cdate.getMinutes()<10?"0":"") + cdate.getMinutes() + ":" +
		(cdate.getSeconds()<10?"0":"") + cdate.getSeconds();
}

// produces: 2005-03-30T15:28:52Z for allday = false,
// produces: 2005-03-30 for allday = true
function calDateTime2String (val, allday)
{
	if (val == null)
		return "";
	
    var datetime = (val instanceof Date) ? val : val.jsDate;
    var string = date2String(datetime);
    if (!allday)
    {
        string = datetime.getUTCFullYear() + "-" + 
                (datetime.getUTCMonth()+1 < 10 ? "0" : "") + (datetime.getUTCMonth()+1) + "-" +
                (datetime.getUTCDate() < 10 ? "0" : "") + datetime.getUTCDate();
        string += 'T';
        string += (datetime.getUTCHours() < 10 ? "0" : "") + datetime.getUTCHours() + ":" + 
                  (datetime.getUTCMinutes() < 10 ? "0" : "") + datetime.getUTCMinutes() + ":" +
                  (datetime.getUTCSeconds() < 10 ? "0" : "") + datetime.getUTCSeconds();
        string += 'Z';
    }
	return string;
}

// takes: 2005-03-30
function string2Date (val)
{
	var s = val.replace('T', '');
	var cdate = s.split('-');
	return new Date(cdate[0], cdate[1]-1, cdate[2]);
}

// takes: 2005-03-30
function string2CalDate (val)
{
	var s = val.replace('T', '');
	var cdate = s.split('-');
    var calDateTime = null;
    // lightning 0.9pre fix (uses createDateTime)
	if (createDateTime)
		calDateTime = new createDateTime();
	else
		calDateTime = new CalDateTime();
		
    calDateTime.jsDate = new Date(Date.UTC(cdate[0], cdate[1]-1, cdate[2], 0, 0, 0));
    calDateTime.isDate = true;
	return calDateTime;
}

// Create a duration object for an alarm time
function createDuration (minutes)
{
    var duration = Components.classes["@mozilla.org/calendar/duration;1"]
                             .createInstance(Components.interfaces.calIDuration);
    if (minutes > 0)
    {
        minutes = minutes * -1;
    }
    duration.inSeconds = minutes * 60;
    duration.normalize();
    return duration;
}


var SKIP = 202;
var NOSKIP = 'A';


var hexmap = new Array(
     SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,
     SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,
     SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,
     SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,
     SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,
     SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,
      0 ,    1 ,    2 ,    3 ,    4 ,    5 ,    6 ,    7 ,
      8 ,    9 ,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,
     SKIP,    10,    11,    12,    13,    14,    15,   SKIP,
     SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,
     SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,
     SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,
     SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,
     SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,
     SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,
     SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,
     SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,
     SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,
     SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,
     SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,
     SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,
     SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,
     SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,
     SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,
     SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,
     SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,
     SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,
     SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,
     SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,
     SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,
     SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,
     SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP
);

var QpEncodeMap = new Array(
     SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,
     SKIP,   SKIP,   NOSKIP,   SKIP,   SKIP,   NOSKIP,   SKIP,   SKIP,
     SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,
     SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,
     NOSKIP,   SKIP,   SKIP,   SKIP,   SKIP,   NOSKIP,   NOSKIP,   NOSKIP,
     NOSKIP,   NOSKIP,   NOSKIP,   NOSKIP,   NOSKIP,   NOSKIP,   NOSKIP,   NOSKIP,
     NOSKIP,   NOSKIP,   NOSKIP,   NOSKIP,   NOSKIP,   NOSKIP,   NOSKIP,   NOSKIP,
     NOSKIP,   NOSKIP,   NOSKIP,   NOSKIP,   NOSKIP,   SKIP,   NOSKIP,   NOSKIP,
     SKIP,   NOSKIP,   NOSKIP,   NOSKIP,   NOSKIP,   NOSKIP,   NOSKIP,   NOSKIP,
     NOSKIP,   NOSKIP,   NOSKIP,   NOSKIP,   NOSKIP,   NOSKIP,   NOSKIP,   NOSKIP,
     NOSKIP,   NOSKIP,   NOSKIP,   NOSKIP,   NOSKIP,   NOSKIP,   NOSKIP,   NOSKIP,
     NOSKIP,   NOSKIP,   NOSKIP,   SKIP,   SKIP,   SKIP,   SKIP,   NOSKIP,
     SKIP,   NOSKIP,   NOSKIP,   NOSKIP,   NOSKIP,   NOSKIP,   NOSKIP,   NOSKIP,
     NOSKIP,   NOSKIP,   NOSKIP,   NOSKIP,   NOSKIP,   NOSKIP,   NOSKIP,   NOSKIP,
     NOSKIP,   NOSKIP,   NOSKIP,   NOSKIP,   NOSKIP,   NOSKIP,   NOSKIP,   NOSKIP,
     NOSKIP,   NOSKIP,   NOSKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,
     SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,
     SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,
     SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,
     SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,
     SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,
     SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,
     SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,
     SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,
     SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,
     SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,
     SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,
     SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,
     SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,
     SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,
     SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,
     SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP
);


function DecodeQuoted(s)
{
	var p = 0, i;
  var result = '';
  while (p < s.length) //loop through the entire string...
  {
    if (s.charAt(p) == '=') //woops, needs to be decoded...
    {
      for (i = 0; i < 3; i++) //is s more than 3 chars long...
      {
        if (p+i == s.length)
        {
          //error in the decoding...
          return result;
        }
      }
      
      var mid = "";
      
      p++; //move past the "="
      //let's put the hex part into mid...
      var ok = true;
      for (i = 0; i < 2; i++)
      {
        if (hexmap[s.charCodeAt(p+i)] == SKIP)
        {
          //we have an error, or a linebreak, in the encoding...
          ok = false;
          if (s.charAt(p+i) == '\r' && s.charAt(p+i+1) == '\n')
          {
            p += 2;
            break;
          }
          else
          {
            //we have an error in the encoding...
            //s--;
            result += "=";
            break;
          }
        }
        mid += s.charAt(p+i);
      }
      //now we just have to convert the hex string to an char...
      if (ok)
      {
        p += 2;
        var m = hexmap[mid.charCodeAt(0)];
        m <<= 4;
        m |= hexmap[mid.charCodeAt(1)];
        result += String.fromCharCode(m);
      }
    }
    else
    {
      result += s.charAt(p);
      p++;
    }
  }

  return result;
}


function decode_utf8(utftext) {
   var plaintext = ""; var i=0; var c=c1=c2=0;

   while(i<utftext.length)
   {
       c = utftext.charCodeAt(i);
       if (c<128) {
           plaintext += String.fromCharCode(c);
           i++;}
       else if((c>191) && (c<224)) {
           c2 = utftext.charCodeAt(i+1);
           plaintext += String.fromCharCode(((c&31)<<6) | (c2&63));
           i+=2;}
       else {
           c2 = utftext.charCodeAt(i+1); c3 = utftext.charCodeAt(i+2);
           plaintext += String.fromCharCode(((c&15)<<12) | ((c2&63)<<6) | (c3&63));
           i+=3;}
   }
   return plaintext;
}

function encode4XML(s)
{
	if (s == null)
		return "";
	if (!s.replace)
		return s;
	
	return s.replace( /(\r?\n|\r){1,2}/g,'\\n' ).replace(/&/g, "&amp;").replace(/</g,
        "&lt;").replace(/>/g, "&gt;").replace(/amp;amp;/g, "amp;").replace(/=/g, "&#61;");
}

function decode4XML(s)
{
	if (s == null)
		return "";
	if (!s.replace)
		return s;
  // numeric replace
  t = s.replace(/&#(\d+);/g,
  function(wholematch, parenmatch1) {
  return String.fromCharCode(+parenmatch1);
  });
  // same for hex
  t = t.replace(/&#x([0-9a-fA-F]+);/g,
  function(wholematch, parenmatch1) {
  return String.fromCharCode(parseInt(parenmatch1,16));
  });
  
  // final
	return t.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

function encode_utf8(rohtext) {
	if (rohtext == null)
		return null;
		
   // check for newline
   rohtext = rohtext.replace(/\r\n/g,"\n");
   var utftext = "";
   for(var n=0; n<rohtext.length; n++)
       {
       // get the unicode
       var c=rohtext.charCodeAt(n);
       // all chars from 0-127 => 1byte
       if (c<128)
           utftext += String.fromCharCode(c);
       // all chars from 127 bis 2047 => 2byte
       else if((c>127) && (c<2048)) {
           utftext += String.fromCharCode((c>>6)|192);
           utftext += String.fromCharCode((c&63)|128);}
       // all chars from 2048 bis 66536 => 3byte
       else {
           utftext += String.fromCharCode((c>>12)|224);
           utftext += String.fromCharCode(((c>>6)&63)|128);
           utftext += String.fromCharCode((c&63)|128);}
       }
   return utftext;
}


var QpEncodeMap = new Array(
     SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,
     SKIP,   SKIP,   NOSKIP,   SKIP,   SKIP,   NOSKIP,   SKIP,   SKIP,
     SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,
     SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,
     NOSKIP,   SKIP,   SKIP,   SKIP,   SKIP,   NOSKIP,   NOSKIP,   NOSKIP,
     NOSKIP,   NOSKIP,   NOSKIP,   NOSKIP,   NOSKIP,   NOSKIP,   NOSKIP,   NOSKIP,
     NOSKIP,   NOSKIP,   NOSKIP,   NOSKIP,   NOSKIP,   NOSKIP,   NOSKIP,   NOSKIP,
     NOSKIP,   NOSKIP,   NOSKIP,   NOSKIP,   NOSKIP,   SKIP,   NOSKIP,   NOSKIP,
     SKIP,   NOSKIP,   NOSKIP,   NOSKIP,   NOSKIP,   NOSKIP,   NOSKIP,   NOSKIP,
     NOSKIP,   NOSKIP,   NOSKIP,   NOSKIP,   NOSKIP,   NOSKIP,   NOSKIP,   NOSKIP,
     NOSKIP,   NOSKIP,   NOSKIP,   NOSKIP,   NOSKIP,   NOSKIP,   NOSKIP,   NOSKIP,
     NOSKIP,   NOSKIP,   NOSKIP,   SKIP,   SKIP,   SKIP,   SKIP,   NOSKIP,
     SKIP,   NOSKIP,   NOSKIP,   NOSKIP,   NOSKIP,   NOSKIP,   NOSKIP,   NOSKIP,
     NOSKIP,   NOSKIP,   NOSKIP,   NOSKIP,   NOSKIP,   NOSKIP,   NOSKIP,   NOSKIP,
     NOSKIP,   NOSKIP,   NOSKIP,   NOSKIP,   NOSKIP,   NOSKIP,   NOSKIP,   NOSKIP,
     NOSKIP,   NOSKIP,   NOSKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,
     SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,
     SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,
     SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,
     SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,
     SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,
     SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,
     SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,
     SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,
     SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,
     SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,
     SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,
     SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,
     SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,
     SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,
     SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,
     SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP,   SKIP
);

function encodeQuoted(s)
{
	// sometime we just do not want a new message :)
	if (s == null)
		return null;
		
	var fresult = "";
	var cur = 0;
	var LineLen = 0;

  for (cur = 0; cur < s.length; cur++)
  {
    //convert the signed char to an unsigned char...
    var mid = s.charCodeAt(cur);
    //should we reset the linelength...
    if (s.charCodeAt(cur) == '\n')
      LineLen = 0; //we are starting on a new line...
    if (QpEncodeMap[mid] == SKIP)
    {
      //we need to encode this char...
      //is the line too long...
      /*
      if (LineLen >= MaxLineLength - 4)
      {
        //wrap the line...
        finalresult = ExpandBuffer(finalresult, UsedSize, &BufSize, false);
        *(fresult++) = '=';
        *(fresult++) = '\r';
        *(fresult++) = '\n';
        UsedSize += 3;
        LineLen = 0;
      }
      */
      
      //add the hex value for the char...
      fresult += "=";
			fresult += mid.toString(16).toUpperCase();
    }
    else
    {
      //just add the char...
      //is the line too long...
      /*
      if (LineLen >= MaxLineLength - 4)
      {
        //wrap the line...
        *(fresult++) = '=';
        *(fresult++) = '\r';
        *(fresult++) = '\n';
        UsedSize += 3;
        LineLen = 0;
      }
      */
      //check buffersize...
      fresult += s.charAt(cur);
    }
  }
  return fresult;
}

/**
 * Create a message to be stored on the Kolab server
 *
 * cid: the id of the card/event
 * adsubject: optional additional subject (iCal or vCard)
 * mime: the mime type (application/x-vnd.kolab.contact, application/x-vnd.kolab.event, application/x-vnd.kolab.task, application/x-vnd.kolab.journal, text/x-vcard, text/calendar)
 * part: true if this is a multipart message
 * content: the content for the message
 * hr: human Readable Part (optional)
 */
function generateMail (cid, mail, adsubject, mime, part, content, hr)
{
	// sometime we just do not want a new message :)
	if (content == null)
		return null;
		
	var msg = "";
	var bound = get_randomVcardId();
	var cdate = new Date();
	var sTime = (cdate.getHours()<10?"0":"") + cdate.getHours() + ":" + (cdate.getMinutes()<10?"0":"") + cdate.getMinutes() + ":" +
		(cdate.getSeconds()<10?"0":"") + cdate.getSeconds();		
	var sdate = "Date: " + getDayString(cdate.getDay()) + ", " + cdate.getDate() + " " +
           getMonthString (cdate.getMonth()) + " " + cdate.getFullYear() + " " + sTime
          + " " + ((cdate.getTimezoneOffset() < 0)?"+":"-") +
          (Math.abs(cdate.getTimezoneOffset()/60)<10?"0":"") + Math.abs(cdate.getTimezoneOffset()/60) +"00\n"; 
 
	msg += "From: " + mail + "\n";
	msg += "Reply-To: \n";
	msg += "Bcc: \n";
	msg += "To: synckolab@no.tld\n";
	
	msg += "Subject: "; 
	if (!part)
		msg += adsubject+" ";
	msg += cid + "\n";
 
	msg += sdate;
	if (!part)
		msg += 'Content-Type: '+mime+';\n  charset="utf-8"\n';
	else
		msg += 'Content-Type: Multipart/Mixed;boundary="Boundary-00='+bound+'"\n';
	// card/ical are encoded quoted printable
	if (!part)
		msg += "Content-Transfer-Encoding: quoted-printable\n";
	msg += "User-Agent: SyncKolab " + gSyncKolabVersion + "\n";
	if (part)
		msg += "X-Kolab-Type: "+mime+"\n";
	msg += "\n"
	if (part)
	{
		msg += '--Boundary-00='+bound+'\n';
		msg += 'Content-Type: Text/Plain;\ncharset="us-ascii"\n';
		msg += 'Content-Transfer-Encoding: 7bit\n\n';

		msg += 'This is a Kolab Groupware object.\n';
		msg += 'To view this object you will need an email client that can understand the Kolab Groupware format.\n';
		msg += 'For a list of such email clients please visit\n';
		msg += 'http://www.kolab.org/kolab2-clients.html\n';

		/* Changed: human readable content beacuse other clients dont understand it
			and dont update it (ie. a contact/event is different in its attachment 
			than in the message. The notice for exactly this case
		*/
		if (hr != null)
		{
			msg += "---\n";
			msg += hr;
			msg += "---\n";
			msg += '\nNotice:\nThe information above is only valid, if no other client than synckolab updated this message. (ie. a client that updates the attachment but not the message)\n';
		}
			
		msg += '\n--Boundary-00='+bound+'\n'
		msg += 'Content-Type: '+mime+';\n name="kolab.xml"\n';
		msg += 'Content-Transfer-Encoding: quoted-printable\n'
		msg += 'Content-Disposition: attachment;\n filename="kolab.xml"\n\n';
	}
	msg += content + '\n';
	if (part)
		msg += '--Boundary-00='+bound+'--\n';
	else
		msg += '\n';
	
	return msg;
}

var start = -1;
var lastmsg = -1;
 

/**
 * Prints out debug messages to the cosole if the global variable DEBUG_SYNCKOLAB is set to true
 * Also prints out performance related stuff
 */
function logMessage (msg, level)
{
    if (!level)
        level = LOG_INFO;
	
	var infolvl = DEBUG_SYNCKOLAB_LEVEL%4;
	var infostate = DEBUG_SYNCKOLAB_LEVEL - infolvl;
	var clvl = level%4;
	var cstate = level - clvl;
	
	// check if we are talking about the same loglevle: ERROR|WARN|INFO|DEBUG
	if (clvl > infolvl)
		return;
		
	// now lets see if we want the same type of error NORMAL|CALENDAR|ADRESSBOOK|ALL		
	
	// if the two states are diffeent and infostate != LOG_ALL we want outta here
	if (infostate != cstate && infostate != LOG_ALL)
		return;

	if (DEBUG_SYNCKOLAB || clvl == LOG_ERROR)
	{
		if (PERFLOG_SYNCKOLAB == true)
		{
			if (start == -1)
			{
				start = (new Date()).getTime();
				lastmsg = start;
			}
			var cTime = (new Date()).getTime();
			if (cTime - lastmsg != 0)
			{			
				msg = (cTime - lastmsg) + " - " + msg;
				lastmsg = cTime;
			}
		}
		consoleService.logStringMessage(msg);		
	}
	
	// pause the sync on error if defined by globals
	if (PAUSE_ON_ERROR && clvl == LOG_ERROR)
		if (gWnd && gWnd.pauseSync)
			gWnd.pauseSync();
}

/**
 * Adds a new name/value to a given array
 */
function addField (a, name, value)
{
	if (a != null)
		a.push(new Array(name, value));
}


/**
 * Returns a file class for the given sync field file
 * this also creates the required subdirectories if not yet existant
 * you can use the .exists() function to check if we go this one already
 */
function getSyncFieldFile (config, type, id)
{
	id = id.replace(/[ :.;$\\\/]/g, "_");
	var file = Components.classes["@mozilla.org/file/directory_service;1"].
	   getService(Components.interfaces.nsIProperties).
	   get("ProfD", Components.interfaces.nsIFile);
	file.append("synckolab");
	if (!file.exists())
		file.create(1, 0775);
	file.append(type);
	if (!file.exists())
		file.create(1, 0775);

	file.append(config);
	if (!file.exists())
		file.create(1, 0775);
	file.append(id + ".field");
	return file;
}

/**
 * Launch a url
 */
function LaunchUrl(url)
{
  var uri = Components.classes["@mozilla.org/network/io-service;1"]
                      .getService(Components.interfaces.nsIIOService).newURI(url, null, null);

  var protocolSvc = Components.classes["@mozilla.org/uriloader/external-protocol-service;1"]
                              .getService(Components.interfaces.nsIExternalProtocolService);
  protocolSvc.loadUrl(uri);
}

function getLangString(bundle, name)
{
	return bundle.getString(name);
}


/*
 * Base 64 decoder
 * Usage:
 	var base64 = new JavaScriptBase64;
 	base64.JavaScriptBase64(STRING);
 	result = base64.decode(); / encode();
 */
 
function JavaScriptBase64()
{
    var string;
    var base64;

    this.JavaScriptBase64 = function(string)
    {
        this.string = new String(string);
        this.base64 = new Array('A','B','C','D','E','F','G','H',
                                'I','J','K','L','M','N','O','P',
                                'Q','R','S','T','U','V','W','X',
                                'Y','Z','a','b','c','d','e','f',
                                'g','h','i','j','k','l','m','n',
                                'o','p','q','r','s','t','u','v',
                                'w','x','y','z','0','1','2','3',
                                '4','5','6','7','8','9','*','/');
    }
    
    this.encode = function()
    {
        var binary = new String();
        var result = new String();
        for(i = 0; i < this.string.length; i++)
        {
            binary += String("00000000" + this.string.charCodeAt(i).toString(2)).substring(this.string.charCodeAt(i).toString(2).length);
        }
        for(i = 0; i < binary.length; i+=6)
        {
            var number = new Number();
            var counter = new Number();
            for(j = 0; j < binary.substring(i, i+6).length; j++)
            {
                for(k = 32; k >= 1; k-=(k/2))
                {
                    if(binary.substring(i, i+6).charAt(counter++) == "1")
                    {
                        number += k;
                    }
                }
            }
            result += this.base64[number];
        }
        return result;
    }

    this.decode = function()
    {
        var binary = new String();
        var result = new String();
        for(i = 0; i < this.string.length; i++)
        {
            for(j = 0; j < this.base64.length; j++)
            {
                if(this.string.charAt(i) == this.base64[j])
                {
                    binary += String("000000" + j.toString(2)).substring(j.toString(2).length);
                }
            }
        }
        for(i = 0; i < binary.length; i+=8)
        {
            var number = new Number();
            var counter = new Number();
            for(j = 0; j < binary.substring(i, i+8).length; j++)
            {
                for(k = 128; k >= 1; k-=(k/2))
                {
                    if(binary.substring(i, i+8).charAt(counter++) == "1")
                    {
                        number += k;
                    }
                }
            }
            result += String.fromCharCode(number);
        }
        return result;
    }
}


/**
 * HashMap class to speed up searches
 */ 
function SKKeyValue( key, value )
{
    this.key = key;
    this.value = value;
}

/**
 * Initial pime number used as seed: 521
 */
function SKMap()
{
    this.len = 0;
	this.seed = 521;
    this.array = new Array(this.seed);    
    // fill the array
    for (var k = 0; k < this.seed; k++)
    	this.array[k] = new Array();
}

SKMap.prototype.getIKey = function (key)
{
	var sum = 0;
	for (var k = 0; k < key.length; k++)
		sum += key.charCodeAt(k);
	return sum;
}

SKMap.prototype.put = function( key, value )
{
    if( ( typeof key != "undefined" ) && ( typeof value != "undefined" ) )
    {
    	// get a key
    	var ikey = this.getIKey(key) % this.seed;
    	var car = this.array[ikey];
        car[car.length] = new SKKeyValue( key, value );
        this.len++;
    }
}

SKMap.prototype.clear = function ()
{
    for (var k = 0; k < this.seed; k++)
    	this.array[k] = new Array();
    this.len = 0;		
}

SKMap.prototype.remove = function( key )
{
   	// get a key
   	var ikey = this.getIKey(key) % this.seed;
   	var car = this.array[ikey];
   	
    for( var k = 0 ; k < car.length ; k++ )
    {
        if( car[k].key == key ) {
        	car[k].splice(k, 1);
	        this.len--;
            return true;
        }
    }
    return false;
}

SKMap.prototype.get = function( key )
{
   	// get a key
   	var ikey = this.getIKey(key) % this.seed;   	
   	var car = this.array[ikey];
   	
    for( var k = 0 ; k < car.length ; k++ )
    {
        if( car[k].key == key ) {
            return car[k].value;
        }
    }
    return null;
}

SKMap.prototype.length = function()
{
    return this.len;
}
 
