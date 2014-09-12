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
 * Copyright (c) Niko Berger 2005-2012
 * Author: Niko Berger <niko.berger(at)corinis.com>
 * Contributor(s):	Andreas Gungl <a.gungl(at)gmx.de>
 *					Arsen Stasic <arsen.stasic(at)wu-wien.ac.at>
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

//////////////////////////////////HELP FUNCTIONS /////////////////////////////////////////
"use strict";
if(!synckolab) var synckolab={};

try {
	Components.utils.import("resource://calendar/modules/calUtils.jsm");
	Components.utils.import("resource://calendar/modules/calProviderUtils.jsm");
} catch (importEx) {
	// ignore exception if lightning is not installed
}
try {
Components.utils.import("resource:///modules/iteratorUtils.jsm");
} catch (ex) {
	
}
synckolab.tools = {

	logStart: -1,
	lastmsg: -1,

/**
 * @return a stack trace or an empty string
 */
trace: function() {
	try {
		throw new Error("myError");
	}
	catch(e) {
		return e.stack;
	}	
	return "";
},
	/**
	 * Prints out debug messages to the cosole if the global variable DEBUG_SYNCKOLAB is set to true
	 * Also prints out performance related stuff
	 */
logMessage: function (msg, level) {
	if (!level) {
		level = synckolab.global.LOG_INFO;
	}

	var infolvl = synckolab.config.DEBUG_SYNCKOLAB_LEVEL%4;
	var infostate = synckolab.config.DEBUG_SYNCKOLAB_LEVEL - infolvl;
	var clvl = level%4;
	var cstate = level - clvl;

	// check if we are talking about the same loglevle: ERROR|WARN|INFO|DEBUG
	if (clvl > infolvl) {
		return;
	}

	// now lets see if we want the same type of error NORMAL|CALENDAR|ADRESSBOOK|ALL		

	// if the two states are diffeent and infostate !== synckolab.global.LOG_ALL we want outta here
	if (infostate !== cstate && infostate !== synckolab.global.LOG_ALL) {
		return;
	}

	if (synckolab.config.DEBUG_SYNCKOLAB || clvl === synckolab.global.LOG_ERROR)
	{
		if (synckolab.config.PERFLOG_SYNCKOLAB === true)
		{
			if (this.logStart === -1)
			{
				this.logStart = (new Date()).getTime();
				this.lastmsg = this.logStart;
			}
			var cTime = (new Date()).getTime();
			if (cTime - this.lastmsg !== 0)
			{			
				msg = (cTime - this.lastmsg) + " - " + msg;
				this.lastmsg = cTime;
			}
		}
		// report errors as error
		if (clvl === synckolab.global.LOG_ERROR && Components.utils.reportError) {
			Components.utils.reportError("" + msg + "\nStack Trace: " + this.trace());
		} else 
		if (clvl === synckolab.global.LOG_ERROR) {
			synckolab.global.consoleService.logStringMessage("" + msg + "\nStack Trace: " + this.trace());
		} else {
			synckolab.global.consoleService.logStringMessage(msg);
		}
	}

	// pause the sync on error if defined by globals
	if (synckolab.config.PAUSE_ON_ERROR && clvl === synckolab.global.LOG_ERROR) {
		// TODO this will NOT work...
		if (typeof synckolab !== "undefined" && synckolab.global.wnd && synckolab.global.wnd.pauseSync) {
			synckolab.global.wnd.pauseSync();
		}
	}
},

scrollToBottom : function (itemList)
{
	if (!itemList && synckolab.global.wnd && synckolab.global.document) {
		itemList = synckolab.global.wnd.document.getElementById('itemList');
	}
	if (itemList)
	{
		var boxobject = itemList.parentNode.boxObject;
		boxobject.QueryInterface(Components.interfaces.nsITreeBoxObject);
		boxobject.scrollByLines(100);
	}
},

parseXml: function(content) {
	var parser = Components.classes["@mozilla.org/xmlextras/domparser;1"].getService(Components.interfaces.nsIDOMParser);
	// decode utf-8
	content = synckolab.tools.text.utf8.decode(content);
	return parser.parseFromString(content, "text/xml");
},

/**
 * Return a boolean value telling whether
 * the first argument is a string.
 */ 
isString: function (s) {
	if (typeof s === 'string') {
		return true;
	}
	if (typeof s === 'object') { 
		var criterion = s.constructor.toString().match(/string/i); 
		return (criterion); 
	}
	return false;
},

/**
 * helper function that copies given fields from one object to another. Each field is checked for non-null and empty string.
 * @param src the source object
 * @param target the target object
 * @param fields an array of fields
 * @param noempty add checks for empty string as well
 */
copyFields: function (src, target, fields, noempty) {
	for(var i = 0; i < fields.length; i++) {
		var field = fields[i];
		if(src[field] && (!noempty || src[field] !== "")) {
			target[field] = src[field];
		}
	}
},

/**
 * compares two objects. note: empty string or null is the same as not existant
 * @param a the object to compare
 * @param b the object to compare with
 * @param skipFields fields to skip when comparing (must exist - just the content does not matter) i.e.: { UUID: true }
 * @return true if they contain the same content, false otherwise
 */
equalsObject: function(a, b, skipFields)
{
	// empty arrays 
	if(!a && b && b.length && b.length === 0) {
		return true;
	}
	if(!b && a && a.length && a.length === 0) {
		return true;
	}
	
	if(!a && !b) {
		throw ("Trying to compare two nulls at " + new Error("s").stack);
	}
	
	var p;
	for(p in a) {
		if(p !== "ts" && p !== "sha1" && p !== "synckolab" && typeof(b[p]) === 'undefined' && a[p] !== null && a[p] !== "") {
			// 0 == undefined
			if((a[p] === "0" || a[p] === 0) && !b[p])
			{
				continue;
			}
			synckolab.tools.logMessage("not equals: " + p + " a: " + a[p] + " b: " + b[p], synckolab.global.LOG_INFO);
			return false;
		}
	}

	for(p in a) {
		// some fields we can skip
		if (p !== "ts" && p !== "sha1" && p !== "synckolab") {
			if (a[p]) {
				switch(typeof(a[p])) {
				case 'object':
					if (!this.equalsObject(a[p], b[p])) { 
						synckolab.tools.logMessage("not equals: " + p + " a: " + a[p] + " b: " + b[p], synckolab.global.LOG_INFO);
						return false; 
					} 
					break;
				case 'function': // skip functions
					break;
				default:
					if(skipFields && skipFields[p]) { 
						break;
					}
				
					// both are "false"
					if(!a[p] && !b[p]) { 
						break;
					}
					
					if((a === true || a === false) && a !== b) {
						synckolab.tools.logMessage("not equals (bool): " + p + " a: " + a[p] + " b: " + b[p], synckolab.global.LOG_INFO);
						return false; 
					}
					
					if(("" + a[p]).length !== ("" +b[p]).length) {
						synckolab.tools.logMessage("not equals (strlen): " + p + " a: " + a[p] + (""+a[p]).length + " b: " + b[p] + (""+b[p]).length, synckolab.global.LOG_INFO);
						return false; 
					}
					if(!isNaN(a[p]) && !isNaN(b[p])) {
						if(Number(a[p]) !== Number(b[p])) {
							synckolab.tools.logMessage("not equals (number): " + p + " a: " + a[p] + " b: " + b[p], synckolab.global.LOG_INFO);
							return false; 
						}
					}
					
					if (a[p] !== b[p] && Number(a[p]) !== Number(b[p])) { 
						synckolab.tools.logMessage("not equals: " + p + " a: " + a[p] + " b: " + b[p], synckolab.global.LOG_INFO);
						return false; 
					}
				}
			} else {
				if (b[p]) {
					synckolab.tools.logMessage("not equals: " + p + " a: not found b: " + b[p], synckolab.global.LOG_INFO);
					return false;
				}
			}
		}
	}

	for(p in b) {
		if(p !== "ts" && p !== "sha1" && p !== "synckolab" && p !== "type" && (!a || typeof(a[p]) === 'undefined') && b[p] !== null && b[p] !== "") {
			if(skipFields && skipFields[p]) { 
				continue;
			}
			synckolab.tools.logMessage("not equals: " + p + " a: " + (a?a[p]:'is null') + " b: " + b[p], synckolab.global.LOG_INFO);
			return false;
		}
	}

	return true;
},

/**
 * parses the mail and extracts the content.
 * This also trims the message and removes some common problems (like -- at the end)
 * @param skcontent the mail content
 * @returns Object with content and image ({ content: STRING, parts: [{id, contentTypem name, data }]);
 */
parseMail: function (skcontent) {
	if (skcontent === null) {
		return null;
	}

	var isMultiPart = skcontent.search(/boundary=/i) !== -1;
	var isQP = false;
	var isUU = false;
	var startPos;
	
	// seems we go us a vcard/ical when no xml is found
	if (!isMultiPart)
	{
		startPos = skcontent.indexOf("\r\n\r\n");
		if (startPos === -1 || startPos > skcontent.length - 10) {
			startPos = skcontent.indexOf("\n\n");
		}

		if (startPos === -1 || startPos > skcontent.length - 10) {
			startPos = 0;
		}

		// check for uuencoded
		isUU = skcontent.search(/begin [0-9][0-9][0-9] /);
		if(isUU > 0) {
			this.logMessage("Decoding UUEncoded Message", synckolab.global.LOG_DEBUG);
			skcontent = skcontent.substring(isUU, skcontent.length);
			skcontent = skcontent.substring(skcontent.indexOf("\n"), skcontent.lastIndexOf("\nend"));
			//print("UU only: " + skcontent);
			skcontent = synckolab.tools.text.uu.decode(skcontent);
			
			// also utf 8 decode:
			skcontent = synckolab.tools.text.utf8.decode(skcontent);
			startPos = 0;
		}

		isQP = skcontent.search(/Content-Transfer-Encoding:[ \t\r\n]+quoted-printable/i);
		this.logMessage("Stripping header from Message (QP=" + isQP + ")", synckolab.global.LOG_DEBUG);
		if(isQP !== -1 || skcontent.indexOf("=3D") !== -1)
		{
			skcontent = synckolab.tools.text.quoted.decode(skcontent.substring(startPos, skcontent.length));
			this.logMessage("unquoted content: " + skcontent, synckolab.global.LOG_DEBUG);
			
		} else {
			skcontent = skcontent.substring(startPos, skcontent.length);
		}

		return {
			content: synckolab.tools.text.trim(skcontent)
		};
	}

	this.logMessage("Stripping header from multipart message", synckolab.global.LOG_DEBUG);

	// we got a multipart message - strip it apart
	var messageContent = {
		content: null,
		parts: []
	};

	// XXXboundary="XXX" or XXXboundary=XXX\n
	var boundary = null;
	boundary = skcontent.substring(skcontent.search(/boundary=/)+9);
	// strip away the " or any whitespace
	boundary = boundary.substring(boundary, boundary.indexOf('\n')).replace(/['" \n\r\t]/g, "");
	// split the message into boundaries
	var msgParts = skcontent.split("\n--" + boundary);
	
	
	this.logMessage("Multipart message with " + msgParts.length + " parts", synckolab.global.LOG_DEBUG);
	
	var msgI = 0;
	// skip the first part: its just the header
	for(msgI = 1; msgI < msgParts.length; msgI++){
		// split the msg into lines for easier parsing
		var msgContent = msgParts[msgI].split("\n");
		var gotHeader = false;
		var part = {};
		
		for(var li = 0; li < msgContent.length; li++){
			var line = msgContent[li];
			// skip text without id...
			if(gotHeader && part.contentType === "text" && !part.id) {
				part = null;
				break;
			}

			
			if(!gotHeader) {
				// empty line - done with the header
				if(li > 2 && line.replace(/[\r\n]/g, "").length === 0) {
					part.content = "";
					gotHeader = true;
					continue;
				}
				// look ahead - 
				if(msgContent.length > li+1 && msgContent[li+1].charAt(0) === ' ') {
					line += msgContent[li+1];
					// skip the next line
					li++;
				}
				
				if(line.indexOf(":") === -1) {
					continue;
				}
				
				// check the header
				var val;
				switch(line.substring(0, line.indexOf(':'))) {
				case "Content-Type":
					val = line.substring(line.indexOf(':') + 1).split(";");
					val[0] = val[0].toLowerCase();
					if(val[0].indexOf('text/plain') !== -1) {
						part.contentType = "text";
					}  else {
						part.contentType = val[0];
					}
					
					if(val.length > 1) {
						if(val[1].indexOf("name") !== -1 ) {
							part.name = val[1].substring(val[1].indexOf("name")+4);
							// get rid of special chars
							part.name = part.name.replace(/[ "';=\n\r]/g, "");
						}
					}
					part.contentType = part.contentType.toLowerCase();
					break;
				case "Content-ID":
					if(line.indexOf('<') !== -1) {
						part.id = line.substring(line.indexOf('<') + 1, line.indexOf('>'));
					} else {
						part.id = line.substring(line.indexOf(':' + 1));
						part.id = part.id.replace(/[ "';=]/g, "");
					}
					break;
				case "Content-Transfer-Encoding":
					part.encoding = line.substring(line.indexOf(':' + 1));
					part.encoding = part.encoding.replace(/[ "';=]/g, "");
					break;
				}
			} else {
				// jsut add the content up
				part.content += line + "\n";
			}
			
		} // # end go through lines
		
		// only check the part if it's valid
		if(part && part.content && (part.encoding || part.contentType || part.id)) {
			// check encoding
			var isBase64 = false;
			
			if(part.encoding) {
				isQP = part.encoding.indexOf("quoted-printable") !== -1;
				isBase64 = part.encoding.indexOf("base64") !== -1;
			}
			
			if(!part.id && part.contentType && part.contentType.indexOf("image") !== -1) {
				part.id = part.name;
			}
			
			// lets check the "main" part - should not have an id, type include xml
			if(!part.id) {
				var valid = false;
				if(part.contentType.indexOf("text/x-vcard") !== -1) {
					valid = true;
				}
				if(part.contentType.indexOf("text/x-ical") !== -1) {
					valid = true;
				}
				if(part.contentType.indexOf("text/calendar") !== -1) {
					valid = true;
				}
				if(part.contentType.indexOf("x-vnd.kolab") !== -1) {
					valid = true;
				}
				if(part.contentType.indexOf("application") !== -1 && part.contentType.indexOf("xml") !== -1) {
					valid = true;
				}
				
				// skip if not valid
				if(!valid) {
					this.logMessage("INVALID PART: " + part.contentType, synckolab.global.LOG_INFO);
					continue;
				}
				
				if (isBase64)
				{
					// clean up the base64
					part.content = part.content.replace(/[\r\n \t]+/g, "");

					this.logMessage("Base64 message:\n" + part.content , synckolab.global.LOG_DEBUG);

					// for base64 we use a two storied approach
					// first: use atob 
					// if that gives us an outofmemoryexception use the slow but working javascript
					// engine
					try {
						part.content = atob(part.content);
					} catch (e) {
						// out of memory error... this can be handled :)
						if (typeof Components !== "undefined" && e.result === Components.results.NS_ERROR_OUT_OF_MEMORY)
						{
							part.content = synckolab.tools.text.base64.decode(part.content);
							this.logMessage("decoded base64", synckolab.global.LOG_DEBUG);
						}
						else
						{
							// skip this part
							this.logMessage("Error decoding base64 (" + e.message + "):\n" + part.content, synckolab.global.LOG_ERROR);
							continue;
						}
					}
					// decode utf8 only for testing! (no Components there) - tbird already does the decoding correctly
					if(typeof Components === "undefined"  && part.content) {
						part.content = synckolab.tools.text.utf8.decode(part.content);
					}
				}

				// decode the content (quoted-printable)
				if (isQP)
				{
					part.content = synckolab.tools.text.quoted.decode(part.content);
				}

				// content might still be quoted printable... doublecheck
				// check if we have to decode quoted printable
				if (part.content.indexOf(" version=3D") !== -1 || part.content.indexOf("TZID=3D")) // we know from the version (or in case of citadel from the tzid)
				{
					this.logMessage("Message is quoted", synckolab.global.LOG_DEBUG);
					part.content = synckolab.tools.text.quoted.decode(part.content);
				}
				
				// now set the main content
				messageContent.content = part.content;
			} else {
				this.logMessage("Adding part: " + part.contentType + " name: "+ part.name, synckolab.global.LOG_DEBUG);

				// add the part
				messageContent.parts.push(part);
			}
		}
	}
	
	// only continue if we found a "main" content part
	if(messageContent.content !== null) {
		return messageContent;
	}
	
	this.logMessage("Empty message.. ignoring", synckolab.global.LOG_INFO);
	return null;
},

/**
 * get the profile folder object
 */
getProfileFolder: function () {
	return Components.classes["@mozilla.org/file/directory_service;1"].getService(Components.interfaces.nsIProperties).get("ProfD", Components.interfaces.nsIFile);
},

/**
 * get the profile folder object
 */
getFile: function (path) {
	var localFile = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
	// strip away the path
	if(path.indexOf("file://") !== -1) {
		path = path.substring(7);
	}
	localFile.initWithPath(path);
	return localFile;
},
/**
 * Create a message to be stored on the Kolab server
 *
 * @param cid the id of the card/event
 * @param adsubject optional additional subject (iCal or vCard)
 * @param mime the mime type (application/x-vnd.kolab.contact, application/x-vnd.kolab.event, application/x-vnd.kolab.task, application/x-vnd.kolab.journal, text/x-vcard, text/calendar)
 * @param part true if this is a multipart message
 * @param content the content for the message
 * @param hr human Readable Part (optional)
 * @param attachments optional image attachment(s) (must be {"id":optionalId, "name": nameOfImage, "data": base64data} )
 */
generateMail: function (cid, mail, adsubject, mime, part, skcontent, hr, attachments){
	// sometime we just do not want a new message :)
	if (skcontent === null) {
		return null;
	}

	var msg = "";
	var bound = synckolab.tools.text.randomVcardId();
	var cdate = new Date();
	var sTime = (cdate.getHours()<10?"0":"") + cdate.getHours() + ":" + (cdate.getMinutes()<10?"0":"") + cdate.getMinutes() + ":" +
	(cdate.getSeconds()<10?"0":"") + cdate.getSeconds();		
	var sdate = "Date: " + synckolab.tools.text.getDayString(cdate.getDay()) + ", " + cdate.getDate() + " " +
		synckolab.tools.text.getMonthString(cdate.getMonth()) + " " + cdate.getFullYear() + " " + sTime +
		" " + ((cdate.getTimezoneOffset() < 0)?"+":"-") +
		(Math.abs(cdate.getTimezoneOffset()/60)<10?"0":"") + Math.abs(cdate.getTimezoneOffset()/60) +"00\n"; 

	msg += "From: " + mail + "\n";
	msg += "Reply-To: \n";
	msg += "Bcc: \n";
	msg += "To: synckolab@no.tld\n";

	msg += "Subject: "; 
	if (!part)  {
		msg += adsubject+" ";
	}
	msg += cid + "\n";

	msg += sdate;
	// add mime version (#25271)
	msg += "MIME-Version: 1.0\n";
	if (!part) {
		msg += 'Content-Type: '+mime+'\n';
	} else {
		msg += 'Content-Type: Multipart/Mixed;boundary="Boundary-00='+bound+'"\n';
	}
	// card/ical are encoded quoted printable
	if (!part) {
		msg += "Content-Transfer-Encoding: quoted-printable\n";
	}
	msg += "User-Agent: SyncKolab " + synckolab.config.version + "\n";
	if (part) {
		msg += "X-Kolab-Type: "+mime+"\n";
		// for kolab3 set the part to "3"
		if(part === 3)
			msg += "X-Kolab-Mime-Version: 3\n";
	}
	msg += "\n";
	if (part)
	{
		msg += '--Boundary-00='+bound+'\n';
		msg += 'Content-Type: Text/Plain;\n charset="us-ascii"\n';
		msg += 'Content-Transfer-Encoding: 7bit\n\n';

		msg += 'This is a Kolab Groupware object.\n';
		msg += 'To view this object you will need an email client that can understand the Kolab Groupware format.\n';
		msg += 'For a list of such email clients please visit\n';
		msg += 'http://kolab.org/content/kolab-clients\n';

		/* Changed: human readable content beacuse other clients dont understand it
				and dont update it (ie. a contact/event is different in its attachment 
				than in the message. The notice for exactly this case
		 */
		if (hr)
		{
			msg += "---\n";
			msg += hr;
			msg += "---\n";
			msg += '\nNotice:\nThe information above is only valid, if no other client than synckolab updated this message. (ie. a client that updates the attachment but not the message)\n';
		}

		msg += '\n--Boundary-00='+bound+'\n';
		msg += 'Content-Type: '+mime+';\n name="kolab.xml"\n';
		msg += 'Content-Transfer-Encoding: quoted-printable\n';
		msg += 'Content-Disposition: attachment;\n filename="kolab.xml"\n\n';
		
		msg += synckolab.tools.text.quoted.encode(skcontent);
	}
	else {
		// add the content
		msg += skcontent + '\n';
	}
	
	// if we have an image try to read it and create a new part (ONLY for xml)
	if (part && attachments && attachments.length > 0) {
		for(var i = 0; i < attachments.length; i++) {
			var cur = attachments[i];
			// now we got the image into fileContent - lets attach
			msg += '\n--Boundary-00='+bound+'\n';
			// based on the name - get the MIME
			var ptype = synckolab.tools.file.getMimeType(cur.name.substring(cur.name.lastIndexOf(".")+1));
			if(cur.id) {
				msg += "Content-ID: <"+cur.id+">\n";
			}
			msg += 'Content-Type: '+ptype+';\n name="'+cur.name+'"\n';
			msg += 'Content-Transfer-Encoding: base64\n';
			msg += 'Content-Disposition: attachment;\n filename="'+cur.name+'"\n\n';
			msg += synckolab.tools.text.splitInto(cur.data, 72);
		}
	}

	if (part) {
		msg += '\n--Boundary-00='+bound+'--\n';
	} else {
		msg += '\n';
	}

	return msg;
},

/**
 * reads given file into a base64 string.
 * 
 */
readFileIntoBase64: function (file) {
	var fileContent = "";
	if (file.exists() && file.isReadable())
	{
		// setup the input stream on the file
		var istream = Components.classes["@mozilla.org/network/file-input-stream;1"].createInstance(Components.interfaces.nsIFileInputStream);
		istream.init(file, 0x01, 4, null);
		var fileIO = Components.classes["@mozilla.org/binaryinputstream;1"].createInstance(Components.interfaces.nsIBinaryInputStream); 
		fileIO.setInputStream(istream);
		// get the image
		var csize = 0; 
		while ((csize = fileIO.available()) !== 0)
		{
			var data = fileIO.readBytes(csize);
			fileContent += btoa(data);
		}
		fileIO.close();
		istream.close();
		return fileContent;
	}
	return null;
},

/**
 * Launch a url
 */
launchUrl: function (url)
{
	var uri = Components.classes["@mozilla.org/network/io-service;1"]
	                             .getService(Components.interfaces.nsIIOService).newURI(url, null, null);

	var protocolSvc = Components.classes["@mozilla.org/uriloader/external-protocol-service;1"]
	                                     .getService(Components.interfaces.nsIExternalProtocolService);
	protocolSvc.loadUrl(uri);
},

/**
 * @return the account object
 */
getAccount: function(accountKey) {
	let gAccountManager = Components.classes['@mozilla.org/messenger/account-manager;1'].getService(Components.interfaces.nsIMsgAccountManager);
	// get the right account
	for (let account in fixIterator( gAccountManager.allServers, Components.interfaces.nsIMsgIncomingServer)) {
		if (account.rootMsgFolder.baseMessageURI === accountKey || 
				synckolab.tools.text.fixNameToMiniCharset(account.rootMsgFolder.baseMessageURI) === accountKey ||
				synckolab.tools.text.fixNameToMiniCharset(account.prettyName) === accountKey)
		{
			return account;
		}
	}
	
	return null;
},

/** 
 * @param accountKey the key for the account (baseMessageURI)
 * @return the account name
 */
getAccountName: function (accountKey) {
	let gAccountManager = Components.classes['@mozilla.org/messenger/account-manager;1'].getService(Components.interfaces.nsIMsgAccountManager);
	var account = synckolab.tools.getAccount(accountKey);
	if(account)
		return gAccountManager.getFirstIdentityForServer(account).fullName;
	return null;
},


/** 
 * @param accountKey the key for the account (baseMessageURI)
 * @return the email address
 */
getAccountEMail: function (accountKey) {
	let gAccountManager = Components.classes['@mozilla.org/messenger/account-manager;1'].getService(Components.interfaces.nsIMsgAccountManager);
	var account = synckolab.tools.getAccount(accountKey);
	if(account)
		return gAccountManager.getFirstIdentityForServer(account).email;
	return null;
},


/**
 * @param accountKey the key for the account (baseMessageURI)
 * @param path the path of the folder
 * @return the nsIMsgFolder for the given account and path
 */
getMsgFolder: function (accountKey, path)
{

	this.logMessage("trying to get folder: '" +  path + "' for account " + accountKey, synckolab.global.LOG_DEBUG);

	var gInc = synckolab.tools.getAccount(accountKey);
	// no account
	if (gInc === null)
	{
		alert("Mailaccount '"+accountKey+"'not found!\nPlease Check configuration");
		return null;
	}

	var cFolder = gInc.rootFolder;
	while (cFolder)
	{
		// tbird 3 uses subFolders enumerator instead of getsubfolders
		var subfolders = cFolder.subFolders?cFolder.subFolders:cFolder.GetSubFolders();

		// this block is only for tbird < 3
		try
		{
			if (subfolders.first) {
				subfolders.first();
			}
		}
		catch (ex)
		{
			alert("NOTHING: " + ex + cFolder.prettyName);
			return;
		}

		cFolder = null;
		while (subfolders)
		{
			var cur = null;
			// tbird < 3
			if (subfolders.currentItem) {
				cur = subfolders.currentItem();
			} else {
				cur = subfolders.getNext();
			}

			if (cur === null) {
				break;
			}

			cur = cur.QueryInterface(Components.interfaces.nsIMsgFolder);

			// we found it
			if (path === cur.URI)
				return cur;

			// if the current path is the start of what we are lookiong for, go deeper
			var cp = path.substring(0, path.indexOf('/', cur.URI.length));

			if (cp === cur.URI)
			{
				cFolder = cur;
				break;
			}

			// break condition tbird3
			if (subfolders.hasMoreElements && !subfolders.hasMoreElements()) {
				break;
			}

			// tbird <3 break condition
			if (subfolders.isDone && subfolders.isDone()) {
				break;
			}
			if (subfolders.next)
			{
				try
				{
					subfolders.next();
				}
				catch (exi1)
				{
					break;
				}
			}
		}
		// we didnt found the path somehow
		if (cFolder === null)
		{
			alert("Folder '"+path+"' not found!\nPlease Check configuration");
			return null;
		}
	}

	// get the folder
	return null;
}

};


synckolab.tools.file = {
		
	analyzeMimeType: function(mime) {
		if(!mime) {
			return "data";
		}
		
		switch(mime.toLowerCase()) {
		case "png":
		case "image/png": 
			return "png";
		case "jpeg":
		case "jpg":
		case "image/jpg": 
			return "jpg";
		case "gif":
		case "image/gif": 
			return "gif";
		case "bmp":
		case "image/bmp": 
		case "image/bitmap": 
			return "bmp";
		case "tiff":
		case "tif":
		case "image/tif": 
		case "image/tiff": 
			return "tif";
		}
		return "data";
	},

	getMimeType: function(ext) {
		switch(ext.toLowerCase()) {
		case "png": return "image/png";
		case "gif": return "image/gif";
		case "bmp": return "image/bmp";
		case "tif": case "tiff": return "image/tif";
		case "jpeg": case "jpg": return "image/jpg";
		}
		return "data/unknown";
	},

	/**
	 * Copies a local file into any mail folder.
	 * In order to be displayed correct, make sure to create a complete message file!!!
	 * fileName string - the file to copy(+path)
	 * folderUri string - the Uri/Url of the folder we want this in
	 */
	copyToLocalFolder: function (fileName, folderUri)
	{
		var mailFolder = synckolab.global.rdf.GetResource(folderUri).QueryInterface(Components.interfaces.nsIMsgFolder);
		// ok give out the folder info
	
		// ok now get the filespec
		var fileSpec = Components.classes["@mozilla.org/filespec;1"].createInstance(Components.interfaces.nsIFileSpec);
	
		fileSpec.nativePath = fileName;
	
		mailFolder.copyFileMessage(fileSpec, null, false, null, null);
	},

	/**
	 * Returns a file class for the given sync db file
	 * this also creates the required subdirectories if not yet existant
	 * you can use the .exists() function to check if we go this one already
	 */
	getSyncDbFile: function (config, id) {
		if (id === null)
		{
			synckolab.tools.logMessage("Error: entry has no id (" +config.name + ": " + config.type + ")", synckolab.global.LOG_ERROR);
			return null;
		}
		id = synckolab.tools.text.fixNameToMiniCharset(id);
		
		synckolab.tools.logMessage("syncDbFile:  (" +synckolab.tools.text.fixNameToMiniCharset(config.serverKey) + "/" + config.type + "_" + config.name + "/" + id + ")", synckolab.global.LOG_ERROR);
		
		var file = synckolab.tools.getProfileFolder();
		try {
			file.append("synckolab");
			if (!file.exists()) {
				file.create(1, parseInt("0775", 8));
			}

			file.append(synckolab.tools.text.fixNameToMiniCharset(config.serverKey));
			if (!file.exists()) {
				file.create(1, parseInt("0775", 8));
			}

			
			file.append(config.type + "_" + config.name);
			if (!file.exists()) {
				file.create(1, parseInt("0775", 8));
			}
	
			file.append(id);
		}
		catch (ex)
		{
			synckolab.tools.logMessage("Problem with getting syncDbFile:  (" +synckolab.tools.text.fixNameToMiniCharset(config.serverKey) + "/" + config.name + ": " + config.type + ": " + id + ")\n" + ex, synckolab.global.LOG_ERROR);
			return null;
		}
		return file;
	}
};


/**
 * writes a sync file. 
 * @param file the file to write in. If it exists, it will be removed first.
 * @param data the data object that will be converted to json and written
 * @param direct do not use json, write content as is
 */
synckolab.tools.writeSyncDBFile = function (file, data, direct)
{
	if (data === null) {
		return;
	}

	if (file.exists()) { 
		file.remove(true);
	}
	
	// create a json file out of it
	var skcontent = null;
	if(direct) {
		skcontent = data;
	} else {
		skcontent = JSON.stringify(data, null, " ");
	}
	
	file.create(file.NORMAL_FILE_TYPE, parseInt("0666", 8));
	var istream = null, cstream = null;
	try {
		istream = Components.classes['@mozilla.org/network/file-output-stream;1'].createInstance(Components.interfaces.nsIFileOutputStream);
		istream.init(file, 2, 0x200, false); // open as "write only"
		
		cstream = Components.classes["@mozilla.org/intl/converter-output-stream;1"].createInstance(Components.interfaces.nsIConverterOutputStream);
		cstream.init(istream, "UTF-8", 0, 0x000);
	
		cstream.writeString(skcontent);
		cstream.close();
		istream.close();
	}
	catch (ex)
	{
		if(cstream) {
			cstream.close();
		}
		if(istream) {
			istream.close();
		}
		synckolab.tools.logMessage("readSyncDBFile ERROR while writing file: " + ex, synckolab.global.LOG_ERROR);
	}

};

/**
 * reads a given sync file. 
 * The sync file contains the entry in a json format.
 * @param file the file to read from
 * @param direct do not use json, write content as is
 * @returns the json object from the file
 */
synckolab.tools.readSyncDBFile = function (file, direct)
{	
	if (file === null)
	{
		synckolab.tools.logMessage("readSyncDBFile ERROR: file is null");
		return null;
	}

	if (!file.exists() || !file.isReadable()) {
		return null;
	}
	var istream = null;
	var cstream = null;

	try
	{
		// setup the input stream on the file
		istream = Components.classes["@mozilla.org/network/file-input-stream;1"]
		                                 .createInstance(Components.interfaces.nsIFileInputStream);
		istream.init(file, 0x01, 4, null);
		
		cstream = Components.classes["@mozilla.org/intl/converter-input-stream;1"].createInstance(Components.interfaces.nsIConverterInputStream);
		cstream.init(istream, "UTF-8", 1024, 0);
		
		var fileContent = "";
		var csize = 0; 
		var str = {};
		while (cstream.readString(4096, str) !== 0)
		{
			fileContent += str.value;
		}
		
		cstream.close();
		cstream = null;
		istream.close();
		istream = null;
		
		// use json instead
		if (direct) {
			return fileContent;
		}
		
		return JSON.parse(fileContent);
	}
	catch (ex)
	{
		if(cstream) {
			cstream.close();
		}
		if(istream) {
			istream.close();
		}
		synckolab.tools.logMessage("readSyncDBFile ERROR while reading file: " + ex, synckolab.global.LOG_ERROR);
	}
	return null;
};

/**
 * Retrieves a file in the user profile dir which includes the config database
 * make sure to add .cal, .con or .task at the config so there are no duplicate names
 */
synckolab.tools.file.getHashDataBaseFile = function (config)
{
	var file = synckolab.tools.getProfileFolder();
	file.append("synckolab." + synckolab.tools.text.fixNameToMiniCharset(config.serverKey) + "." + config.name + "." + config.type+".hdb");
	return file;
};


/**
 * Database class: read a file into a hashmap
 * @param file the file to read/write the data to/from
 */
synckolab.dataBase = function (file) {
	// the database file
	this.dbf = file;
	this.db = new synckolab.hashMap();
	
	// no file specified - memory only
	if(!file) {
		return;
	}

	// if the file is not readable - dont bother
	if (!file.exists() || !file.isReadable()) {
		synckolab.tools.logMessage("File not readable: " + file, synckolab.global.LOG_WARNING);
		return;
	}

	// setup the input stream on the file
	var istream = Components.classes["@mozilla.org/network/file-input-stream;1"].createInstance(Components.interfaces.nsIFileInputStream);
	istream.init(this.dbf, 0x01, 4, null);
	var fileScriptableIO = Components.classes["@mozilla.org/scriptableinputstream;1"].createInstance(Components.interfaces.nsIScriptableInputStream); 
	fileScriptableIO.init(istream);
	// parse the xml into our internal document
	istream.QueryInterface(Components.interfaces.nsILineInputStream); 
	var fileContent = "";
	var csize = 0; 
	while ((csize = fileScriptableIO.available()) !== 0)
	{
		fileContent += fileScriptableIO.read( csize );
	}
	fileScriptableIO.close();
	istream.close();

	var lines = fileContent.split("\n");
	for (var i = 0; i < lines.length; i++) {
		if (lines[i].indexOf(":") !== -1)
		{
			var fv = lines[i];
			// replace the \: with something really weird
			if (fv.replace)
			{
				fv = fv.replace(/\\:/g, "#%%$");
				fv = fv.replace(/\\\\/g, "\\");
			}
			// split now
			fv = synckolab.tools.text.trim(fv).split(":");
			for (var j =0; j < fv.length; j++)
			{
				if (fv[j].replace) {
					fv[j] = fv[j].replace(/#%%\$/g, ":");
				}
			}
			// add the hashmap
			this.add(fv);
		}
	}

};


/**
 * returns the position of this entry in the db
 */
synckolab.dataBase.prototype.get = function (key) {
	return this.db.get(key);
};

synckolab.dataBase.prototype.remove = function (entry) {
	this.db.remove(entry[0]);
};

/**
 * add an array - the first entry is the key!
 * @param entry
 */
synckolab.dataBase.prototype.add = function (entry) {
	this.db.put(entry[0], entry);
};

/**
 * convenience function to add a key/value pair (both strings)
 * @param entry
 * @return
 */
synckolab.dataBase.prototype.addField = function (name, value) {
	// ignore errornous fields!
	if (name === null || value === null) {
		return;
	}
	var entry = [name, value];
	this.db.put(entry[0], entry);
};

synckolab.dataBase.prototype.length = function () {
	return this.db.length();
};

synckolab.dataBase.prototype.toString = function () {
	this.db.iterate();
	var cur;
	var str = "";
	while ((cur = this.db.next()))
	{
		str += cur[0] + ":" + cur[1] + "\n";
	}
	return str;
};

synckolab.dataBase.prototype.toXmlString = function () {
	this.db.iterate();
	var cur;
	var str = "";
	while ((cur = this.db.next()))
	{
		str += synckolab.tools.text.nodeWithContent(cur[0], cur[1], false);
	}
	return str;
};
/**
 * writes a database file (key:hashvalue:h2)
 * @param file an optional new filename to write into
 */
synckolab.dataBase.prototype.write = function (file) {
	if (!file && !this.dbf) {
		return;
	}
	
	if(file)
	{
		this.dbf = file;
	}
	
	// remove the old db
	if (this.dbf && this.dbf.exists()) { 
		this.dbf.remove(true);
	}
	
	this.dbf.create(this.dbf.NORMAL_FILE_TYPE, parseInt("0640", 8));
	var stream = Components.classes['@mozilla.org/network/file-output-stream;1'].createInstance(Components.interfaces.nsIFileOutputStream);
	stream.init(this.dbf, 2, 0x200, false); // open as "write only"
	// start iteration
	this.db.iterate();
	var entry;
	var s;
	while ((entry = this.db.next()))
	{
		// skip "empty" fields
		s = entry[0];
		for (var j = 1; entry[j]; j++)
		{			
			var fv = entry[j];
			
			// encode :
			if (fv.replace)
			{
				fv = fv.replace(/\\/g, "\\\\");
				fv = fv.replace(/:/g, "\\:");
			}
			s += ":" + fv;
		}
		s += "\n";
		synckolab.tools.logMessage("writing " + s, synckolab.global.LOG_DEBUG);
		stream.write(s, s.length);
	}
	// write newlines at the end
	s = "\n\n";
	stream.write(s, s.length);
	stream.close();
};



/**
 * Initial prime number used as seed: 521
 */
synckolab.hashMap = function ()
{
	this.len = 0;
	this.seed = 521;
	this.array = [];
	// fill the array
	for (var k = 0; k < this.seed; k++) {
		this.array[k] = [];
	}
};

// starts an iteration
synckolab.hashMap.prototype.iterate = function () {
	this.hashIdx = 0;
	this.idx = 0;
};

/**
 * gets the next element or null
 */
synckolab.hashMap.prototype.next = function () {
	// check if we still have room in the current hash
	this.idx++;
	while (this.idx >= this.array[this.hashIdx].length)
	{
		this.hashIdx++;
		this.idx = 0;
		
		// finished
		if (this.hashIdx >= this.seed) {
			return null;
		}
	}
	
	return this.array[this.hashIdx][this.idx].value;
};


/**
 * HashMap class to speed up searches
 */ 
synckolab.hashMap.entry = function ( key, value )
{
	this.key = key;
	this.value = value;
};


synckolab.hashMap.prototype.getIKey = function (key)
{
	if(!key) {
		var err = new Error("");
		Components.utils.reportError("No key defined for hashmap!\n" + err.stack);
		throw("No key defined for hashmap!");
	}
	
	var sum = 0;
	for (var k = 0; k < key.length; k++) {
		sum += key.charCodeAt(k)*k;
	}
	return sum;
};

synckolab.hashMap.prototype.put = function ( key, value )
{
	if(!key) {
		var err = new Error("");
		Components.utils.reportError("No key defined for hashmap!\n" + err.stack);
		throw("No key defined for hashmap!");
	}

	// get a key
	var ikey = this.getIKey(key) % this.seed;
	var car = this.array[ikey];
	// overwrite if we already have it
	for( var k = 0 ; k < car.length ; k++ )
	{
		if( car[k].key === key ) {
			car[k].value = value;
			return;
		}
	}
	car[car.length] = new synckolab.hashMap.entry( key, value );
	this.len++;
};

synckolab.hashMap.prototype.clear = function ()
{
	for (var k = 0; k < this.seed; k++) {
		this.array[k] = [];
	}
	this.len = 0;
};

synckolab.hashMap.prototype.remove = function ( key )
{
	// get a key
	var ikey = this.getIKey(key) % this.seed;
	var car = this.array[ikey];

	for( var k = 0 ; k < car.length ; k++ )
	{
		if( car[k].key === key ) {
			this.array[ikey].splice(k, 1);
			this.len--;
			return true;
		}
	}
	return false;
};

synckolab.hashMap.prototype.get = function ( key )
{
	// get a key
	var ikey = this.getIKey(key) % this.seed;
	var car = this.array[ikey];

	for( var k = 0 ; k < car.length ; k++ )
	{
		if( car[k].key === key ) {
			return car[k].value;
		}
	}
	return null;
};

synckolab.hashMap.prototype.length = function ()
{
	return this.len;
};

/**
 * synckolab node (standard node with a twist)
 */
synckolab.Node = function (node) {
	if (node === null) {
		return null;
	}
	this.node = node;
	this.nodeName = node.nodeName;
	this.nodeType = node.nodeType;
	this.firstChild = node.firstChild;
	this.nextSibling = new synckolab.Node(node.nextSibling);
};

/**
 * return the data of the current node. this can either be 
 * the direct firstChild - or instead a text subnode
 */
synckolab.Node.prototype.getFirstData = function () {
	if (!this.node.firstChild) {
		return null;
	}
	// we might have a "text" node (kolab3)
	var text = this.getChildNode("text");
	if(text) {
		if (!text.firstChild) {
			return null;
		}
		return synckolab.tools.text.decode4XML(text.firstChild.data);
	}
	// uri is also handled like direct content
	text = this.getChildNode("uri");
	if(text) {
		if (!text.firstChild) {
			return null;
		}
		// uri can be quite large so handle ALL childs
		var combinedNode = "";
		var cur = text.firstChild;
		while(cur) {
			combinedNode = cur.data;
			cur = cur.nextSibling;
		}
		
		return synckolab.tools.text.decode4XML(combinedNode);
	}

	// cur.nodeType === Node.TEXT_NODE
	return synckolab.tools.text.decode4XML(this.node.firstChild.data);
};

/**
 * return the content of a child node with name "name" of the node "node"
 * or the given default "def" if no such node exists
 * @param name the name or path to the result. this can be a string, a one dimensional array (the path) or a two dimensianel array (different paths to check)
 */
synckolab.Node.prototype.getXmlResult =  function (name, def)
{
	var cur = this.getChildNode(name);
	if(!cur) {
		return def;
	}
	
	if (cur.firstChild)
	{
		var value = cur.firstChild.nodeValue;
		// decode the value
		if (value) {
			return synckolab.tools.text.decode4XML(value);
		}
	}
	
	return def;
};


/**
 * @param name a name of path (by passing an array) or multiple paths (by passing a two-dimensional array) to a child
 * return a direct child node with the name "name" of the node "node"
 */
synckolab.Node.prototype.getChildNode = function (name)
{
	if(name === undefined || name === null || name === "") {
		synckolab.tools.logMessage("Trying to get a childnode without a name!", synckolab.global.LOG_WARNING);
		return null;
	}
	
	// passed an array -
	if( Object.prototype.toString.call( name ) === '[object Array]') {
		var curNode;

		// check for two-dimensional array
		if( Object.prototype.toString.call( name[0] ) === '[object Array]') {
			for(var j = 0; j < name.length; j++){
				// try each path
				curNode = this.getChildNode(name[j]);
				if(curNode !== null) {
					return curNode;
				}
			}
			// none of the paths matched a child
			return null;
		}

		// check if we have to go deep
		curNode = this;
		for(var i = 0; i < name.length && curNode !== null; i++){
			curNode = curNode.getChildNode(name[i]);
		}
		return curNode;
	}
	
	// make name upper case
	if(name.toUpperCase) {
		name = name.toUpperCase();
	}
	
	var cur = this.node.firstChild;
	while(cur)
	{
		if(cur.nodeType === Node.ELEMENT_NODE) {
			if (cur.nodeName.toUpperCase() === name)
			{
				return new synckolab.Node(cur);
			}
		}
		cur = cur.nextSibling;
	}
	return null;
};

/**
 * returns the next sibling element of the current node.
 * If a name is given it has to match
 * @param name (option) name of the node to get
 */
synckolab.Node.prototype.getNextNode = function (name)
{
	if(name) {
		name = name.toUpperCase();
	}
	// start with the next node
	var cur = this.node.nextSibling;
	while(cur)
	{
		if(cur.nodeType === Node.ELEMENT_NODE) {
			if (!name) {
				return new synckolab.Node(cur);
			}
			else if (cur.nodeName.toUpperCase() === name)
			{
				return new synckolab.Node(cur);
			}
		}
		// next sibling
		cur = cur.nextSibling;
	}
	return null;
};



/**
 * return the value of the attribute with name "attrName" of the node "node"
 * or null, if no attribute with that name exists
 */
synckolab.Node.prototype.getAttribute = function (attrName)
{
	if (!this.node) {
		return null;
	}
	
	if (this.node.hasAttributes())
	{
		var attrList = this.node.attributes;
		var node = attrList.getNamedItem(attrName);
		if (node) {
			return node.nodeValue;
		}
	}
	return null;
};


/**
 * (At least on branch 1.8), the js instanceof operator does not work to test
 * interfaces on direct implementation objects, i.e. non-wrapped objects.
 * This function falla back to using QueryInterface to check whether the interface
 * is implemented.
 */
synckolab.tools.instanceOf = function (aObject, aInterface) {
	// We first try instanceof which is assumed to be faster than querying the object:
	if (!(aObject instanceof aInterface)) {
		// if the passed object in not wrapped (but a plain implementation),
		// instanceof won't check QueryInterface.
		try {
			aObject.QueryInterface(aInterface);
		} catch (exc) {
			return false;
		}
	}
	return true;
};


/**
 * reads all messages in a given imap folder and create a hashmap with the messageHdr and the id.
 * it uses "parseFunc.uid" as key. This assumes that the subject is the uid!
 * @param map the map to save everything into
 * @param config the config (to read the right folder)
 * @param parseFunc a function that parses the messages into objects
 */
synckolab.tools.fillMessageLookup = function(map, config, parseFunc) {
	var messages;
	// get the message keys
	if (config.folder.getMessages) {
		messages = config.folder.getMessages(null);	 // dont need the msgWindow use null
	} else {
		messages = config.folder.messages; // tbird 3 uses an enumerator property instead of a function
	}

	while(messages.hasMoreElements()) {
		var cur = messages.getNext().QueryInterface(Components.interfaces.nsIMsgDBHdr);
		map.put(cur.mime2DecodedSubject, cur);
	}
};

synckolab.tools.CONFIG_TYPE_BOOL = 0;
synckolab.tools.CONFIG_TYPE_CHAR = 1;
synckolab.tools.CONFIG_TYPE_INT = 2;

/**
 * 
 * @param pref the preference service (Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);)
 * @param name the name of the configuration to get (every value is prefixed with SyncKolab.)
 * @param type the type (see synckolab.tools.CONFIG_TYPE_*)
 * @param def an optional default value
 * @return the configuration value in the given type or the default value
 */
synckolab.tools.getConfigValue = function(pref, name, type, def) {
	name = "SyncKolab." + name;
	try {
		var preftype = pref.getPrefType(name);
		if(type === synckolab.tools.CONFIG_TYPE_BOOL) {
			// fix wrong types from old versions
			if(preftype  === 32) {
				var val = pref.getCharPref(name);
				return val === "true";
			}
			return pref.getBoolPref(name);
		} 
		if(type === synckolab.tools.CONFIG_TYPE_INT) {
			// fix wrong types from old versions
			if(preftype  === 32) {
				var val = pref.getCharPref(name);
				return Number(val);
			}
			return pref.getIntPref(name);
		} 
		// default use char pref 
		return pref.getCharPref(name);
	}
	catch (ex) {
		synckolab.tools.logMessage(name +" (" + pref.getPrefType(name) + ") has a problem: " + ex, synckolab.global.LOG_INFO);
		return def;
	}
};

/**
 * @param pref the preference service (Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);)
 * @param name the name of the configuration to get (every value is prefixed with SyncKolab.)
 * @param type the type (see synckolab.tools.CONFIG_TYPE_*)
 * @param value the value to write
 * @return true when the value has been written
 */
synckolab.tools.setConfigValue = function(pref, name, type, value) {
	name = "SyncKolab." + name;
	try {
		if(type === synckolab.tools.CONFIG_TYPE_BOOL) {
			pref.setBoolPref(name, value);
		} 
		else if(type === synckolab.tools.CONFIG_TYPE_INT) {
			pref.setIntPref(name, value);
		} else {
			// default use char pref 
			pref.setCharPref(name, value);
		}
		pref.savePrefFile(null);
	}
	catch (ex) {
		return false;
	}
	return true;
};


/**
 * remove a preference
 * @param pref the preference service (Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);)
 * @param name the name of the configuration to get (every value is prefixed with SyncKolab.)
 * @return true when the value has been written
 */
synckolab.tools.removeConfig = function(pref, name) {
	name = "SyncKolab." + name;
	try {
		pref.clearUserPref(name);
		pref.savePrefFile(null);
	}
	catch (ex) {
		return false;
	}
	return true;
};


/**
 * opens a browser window with a given url
 * @param aURL the external url to load
 */
synckolab.tools.launchUrl = function(aURL) {
	var messenger = Components.classes["@mozilla.org/messenger;1"].createInstance();
	messenger = messenger.QueryInterface(Components.interfaces.nsIMessenger);
	messenger.launchExternalURL(aURL);	
};


synckolab.tools.getUidFromHeader = function (header) {
	if(!header) {
		return header;
	}
	
	var space = header.indexOf(' ');
	if(space === -1) {
		return header;
	}
	
	if(header.indexOf("iCal ") || header.indexOf("ical ")) {
		return header.substring(5);
	}
	
	if(header.indexOf("vCard ") || header.indexOf("vcard ")) {
		return header.substring(6);
	}
	
	// might be a mailing list - name is the header and it might contain spaces!
	return header;
};