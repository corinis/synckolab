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
 * Contributor(s):	Niko Berger <niko.berger(at)corinis.com>
 *					Andreas Gungl <a.gungl(at)gmx.de>
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
if(!com) var com={};
if(!com.synckolab) com.synckolab={};
if(!com.synckolab.tools) com.synckolab.tools={};

Components.utils.import("resource://calendar/modules/calUtils.jsm");
Components.utils.import("resource://calendar/modules/calProviderUtils.jsm");

com.synckolab.tools = {

	logStart: -1,
	lastmsg: -1,

	/**
	 * Prints out debug messages to the cosole if the global variable DEBUG_SYNCKOLAB is set to true
	 * Also prints out performance related stuff
	 */
logMessage: function (msg, level) {
	if (!level) {
		level = com.synckolab.global.LOG_INFO;
	}

	var infolvl = com.synckolab.config.DEBUG_SYNCKOLAB_LEVEL%4;
	var infostate = com.synckolab.config.DEBUG_SYNCKOLAB_LEVEL - infolvl;
	var clvl = level%4;
	var cstate = level - clvl;

	// check if we are talking about the same loglevle: ERROR|WARN|INFO|DEBUG
	if (clvl > infolvl) {
		return;
	}

	// now lets see if we want the same type of error NORMAL|CALENDAR|ADRESSBOOK|ALL		

	// if the two states are diffeent and infostate !== com.synckolab.global.LOG_ALL we want outta here
	if (infostate !== cstate && infostate !== com.synckolab.global.LOG_ALL) {
		return;
	}

	if (com.synckolab.config.DEBUG_SYNCKOLAB || clvl === com.synckolab.global.LOG_ERROR)
	{
		if (com.synckolab.config.PERFLOG_SYNCKOLAB === true)
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
		if (clvl === com.synckolab.global.LOG_ERROR && Components.utils.reportError) {
			var err = new Error("" + msg);
			Components.utils.reportError("" + msg + err.stack);
		} else 
		if (clvl === com.synckolab.global.LOG_ERROR) {
			com.synckolab.global.consoleService.logStringMessage("" + msg + new Error("" + msg).stack);
		} else {
			com.synckolab.global.consoleService.logStringMessage(msg);
		}
	}

	// pause the sync on error if defined by globals
	if (com.synckolab.config.PAUSE_ON_ERROR && clvl === com.synckolab.global.LOG_ERROR) {
		// TODO this will NOT work...
		if (typeof com.synckolab !== "undefined" && com.synckolab.global.wnd && com.synckolab.global.wnd.pauseSync) {
			com.synckolab.global.wnd.pauseSync();
		}
	}
},

scrollToBottom : function (itemList)
{
	if (!itemList && com.synckolab.global.wnd && com.synckolab.global.document) {
		itemList = com.synckolab.global.wnd.document.getElementById('itemList');
	}
	com.synckolab.tools.logMessage("checking itemlist: " + itemList);
	if (itemList)
	{
		// select and deselect the newly appended item (makes it scroll to the bottom)
		var lastItemPos = itemList.getRowCount ? itemList.getRowCount() - 1 : itemList.itemCount - 1;
		com.synckolab.tools.logMessage("got itemlist: " + lastItemPos, com.synckolab.global.LOG_DEBUG + com.synckolab.global.LOG_AB);
		if (lastItemPos > 0)
		{
			itemList.selectedIndex = lastItemPos;
			itemList.scrollToIndex(lastItemPos);
			itemList.ensureIndexIsVisible(lastItemPos);
		}
	}
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
 * @return true if they contain the same content, false otherwise
 */
equalsObject: function(a, b)
{
	// empty arrays 
	if(!a && b && b.length && b.length === 0) {
		return true;
	}
	if(!b && a && a.length && a.length === 0) {
		return true;
	}
	
	var p;
	for(p in a) {
		if(typeof(b[p]) === 'undefined' && a[p] !== null && a[p] !== "") {
			com.synckolab.tools.logMessage("not equals: " + p, com.synckolab.global.LOG_DEBUG);
			return false;
		}
	}

	for(p in a) {
		if (a[p]) {
			switch(typeof(a[p])) {
			case 'object':
				if (!this.equalsObject(a[p], b[p])) { 
					com.synckolab.tools.logMessage("not equals: " + p, com.synckolab.global.LOG_DEBUG);
					return false; 
				} 
				break;
			case 'function': // skip functions
				break;
			default:
				if (a[p] !== b[p]) { 
					com.synckolab.tools.logMessage("not equals: " + p, com.synckolab.global.LOG_DEBUG);
					return false; 
				}
			}
		} else {
			if (b[p]) {
				return false;
			}
		}
	}

	for(p in b) {
		if(typeof(a[p]) === 'undefined' && b[p] !== null && b[p] !== "") {
			com.synckolab.tools.logMessage("not equals: " + p, com.synckolab.global.LOG_DEBUG);
			return false;
		}
	}

	return true;
},

/**
 * Removes a possible mail header and extracts only the "real" content.
 * This also trims the message and removes some common problems (like -- at the end)
 */
stripMailHeader: function (skcontent) {
	if (skcontent === null) {
		return null;
	}

	var isMultiPart = skcontent.search(/boundary=/i) !== -1;
	var isQP;
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

		isQP = skcontent.search(/Content-Transfer-Encoding:[ \t\r\n]+quoted-printable/i);
		this.logMessage("Stripping header from Message (QP=" + isQP + ")", com.synckolab.global.LOG_DEBUG);
		if(isQP !== -1 || skcontent.indexOf("=3D") !== -1)
		{
			skcontent = com.synckolab.tools.text.quoted.decode(skcontent.substring(startPos, skcontent.length));
			this.logMessage("unquoted content: " + skcontent, com.synckolab.global.LOG_DEBUG);
			
		} else {
			skcontent = skcontent.substring(startPos, skcontent.length);
		}

		return com.synckolab.tools.text.trim(skcontent);
	}

	this.logMessage("Stripping header from multipart message", com.synckolab.global.LOG_DEBUG);

	// we got a multipart message - strip it apart

	// XXXboundary="XXX" or XXXboundary=XXX\n
	var boundary = null;
	boundary = skcontent.substring(skcontent.search(/boundary=/)+9);

	// lets trim boundary (in case we have whitespace after the =
	boundary = com.synckolab.tools.text.trim(boundary);

	// if the boundary string starts with "... we look for an end
	if (boundary.charAt(0) === '"')
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
		if (ws !== -1 && ws < cutWS) {
			cutWS = ws;
		}
		ws = boundary.indexOf('\t');
		if (ws !== -1 && ws < cutWS) {
			cutWS = ws;
		}
		ws = boundary.indexOf('\r');
		if (ws !== -1 && ws < cutWS) {
			cutWS = ws;
		}
		boundary = boundary.substring(0, cutWS);
	}
	// try to get the start of the card part

	// remove the tmp image if it exists...
	var file = Components.classes["@mozilla.org/file/directory_service;1"].getService(Components.interfaces.nsIProperties).get("TmpD", Components.interfaces.nsIFile);
	file.append("syncKolab.img");
	if (file.exists()) {
		file.remove(true);
	}
	
	// check if we have an image attachment
	var imgC = skcontent;
	var imgIdx = imgC.search(/Content-Type:[ \t\r\n]+image/i);
	
	if (imgIdx !== -1)
	{
		// get rid of the last part until the boundary
		imgC = imgC.substring(imgIdx);
		var idx = imgC.indexOf(boundary);
		if (idx !== -1) {
			imgC = imgC.substring(0, idx);
		}
		
		// get the image data (make sure to remove \n and whitespace
		idx = imgC.indexOf('\n\n');
		imgC = imgC.substring(idx);
		imgC = imgC.replace(/[\r\n \t\-]+/g, "");
		// now we got one line of data - write it in a tmpfile (unencoded - obviously)
		file.create(file.NORMAL_FILE_TYPE, parseInt("0666", 8));
		var stream = Components.classes['@mozilla.org/network/file-output-stream;1'].createInstance(Components.interfaces.nsIFileOutputStream);
		stream.init(file, 2, 0x200, false); // open as "write only"
		var fileIO = Components.classes["@mozilla.org/binaryoutputstream;1"].createInstance(Components.interfaces.nsIBinaryOutputStream); 
		fileIO.setOutputStream(stream);
		
		try {
			var fcontent = atob(imgC);
			fileIO.writeBytes(fcontent, fcontent.length);
		}
		catch (ex) {
			// still continue
			this.logMessage("Error while handling image: " + ex + "\nStream:\n" + imgC, com.synckolab.global.LOG_INFO);
		}
		
		fileIO.close();
		stream.close();
	}
	
	// check kolab XML first
	var contentIdx = -1;
	var endcontentIdx;
	var contTypeIdx = skcontent.search(/Content-Type:[ \t\r\n]+application\/x-vnd.kolab./i);
	if (contTypeIdx !== -1)
	{
		skcontent = skcontent.substring(contTypeIdx); // cut everything before this part
		// there might be a second boundary... remove that as well
		endcontentIdx = skcontent.indexOf(boundary);
		if (endcontentIdx !== -1) {
			skcontent = skcontent.substring(0, endcontentIdx);
		}
		if ((new RegExp("--$")).test(skcontent)) {
			skcontent = skcontent.substring(0, skcontent.length - 2);
		}
		
		contentIdx = skcontent.indexOf("<?xml");
	}
	else
	{
		// check for vcard | ical
		contTypeIdx = skcontent.search(/Content-Type:[ \t\r\n]+text\/x-vcard/i);
		if (contTypeIdx === -1) {
			contTypeIdx = skcontent.search(/Content-Type:[ \t\r\n]+text\/x-ical/i);
		}
		if (contTypeIdx === -1) {
			contTypeIdx = skcontent.search(/Content-Type:[ \t\r\n]+text\/calendar/i);
		}

		if (contTypeIdx !== -1)
		{
			skcontent = skcontent.substring(contTypeIdx); // cut everything before this part
			
			// handle multi-line 
			skcontent = skcontent.replace(/[\n\r]+ /, "");
			// there might be a second boundary... remove that as well
			endcontentIdx = skcontent.indexOf(boundary);
			if (endcontentIdx !== -1) {
				skcontent = skcontent.substring(0, endcontentIdx);
			}
			if ((new RegExp("--$")).test(skcontent)) {
				skcontent = skcontent.substring(0, skcontent.length - 2);
			}

			contentIdx = skcontent.indexOf("BEGIN:");
		}
	}


	// if we did not find a decoded card, it might be base64
	if (contentIdx === -1)
	{
		isQP = skcontent.search(/Content-Transfer-Encoding:[ \t\r\n]+quoted-printable/i);
		var isBase64 = skcontent.search(/Content-Transfer-Encoding:[ \t\r\n]+base64/i);

		this.logMessage("contentIdx === -1: looks like its encoded: QP=" + isQP + " B64=" + isBase64);
		
		if (isBase64 !== -1)
		{
			this.logMessage("Base64 Decoding message. (Boundary: "+boundary+")", com.synckolab.global.LOG_INFO);
			// get rid of the header
			skcontent = skcontent.substring(isBase64, skcontent.length);
			startPos = skcontent.indexOf("\r\n\r\n");
			var startPos2 = skcontent.indexOf("\n\n");
			if (startPos2 !== -1 && (startPos2 < startPos || startPos === -1)) {
				startPos = startPos2;
			}

			var endPos = skcontent.indexOf("--"); // we could check for "--"+boundary but its not necessary since base64 doesnt allow it anyways
			// we probably removed the -- already, but to make sure
			if (endPos === -1) {
				endPos = skcontent.length;
			}

			skcontent = skcontent.substring(startPos, endPos).replace(/[\r\n \t]+/g, "");

			this.logMessage("Base64 message: " + skcontent, com.synckolab.global.LOG_DEBUG);

			// for base64 we use a two storied approach
			// first: use atob 
			// if that gives us an outofmemoryexception use the slow but working javascript
			// engine
			try {
				skcontent = atob(skcontent);
			} catch (e) {
				// out of memory error... this can be handled :)
				if (e.result === Components.results.NS_ERROR_OUT_OF_MEMORY)
				{
					skcontent = com.synckolab.text.base64.decode(skcontent);
					this.logMessage("decoded base64: " + skcontent, com.synckolab.global.LOG_DEBUG);

				}
				else
				{
					this.logMessage("Error decoding base64 (" + e + "): " + skcontent, com.synckolab.global.LOG_ERROR);
					return null;
				}
			}
		}
		
		

		if (isQP !== -1)
		{
			skcontent = skcontent.substring(isQP, skcontent.length);
			skcontent = com.synckolab.tools.text.quoted.decode(skcontent);
		}
		
		

		if (isQP === -1 && isBase64 === -1)
		{
			// so this message has no <xml>something</xml> area
			this.logMessage("Error parsing this message: no xml segment found\n" + skcontent, com.synckolab.global.LOG_ERROR);
			return null;
		}
		
		// with the decoded content - check for the real start
		contentIdx = skcontent.indexOf("<?xml");
		if (contentIdx === -1) {
			contentIdx = skcontent.indexOf("BEGIN:");
		}

		
		if (contentIdx !== -1) {
			skcontent = skcontent.substring(contentIdx);
		}
	}
	else
	{
		skcontent = skcontent.substring(contentIdx);
		// until the boundary = end of xml|vcard/ical
		if (skcontent.indexOf(boundary) !== -1) {
			skcontent = skcontent.substring(0, skcontent.indexOf("--"+boundary));
		}
	}
	
	// content might still be quotted printable... doublecheck
	// check if we have to decode quoted printable
	if (skcontent.indexOf(" version=3D") !== -1 || skcontent.indexOf("TZID=3D")) // we know from the version (or in case of citadel from the tzid)
	{
		this.logMessage("Message is quoted", com.synckolab.global.LOG_INFO);
		skcontent = com.synckolab.tools.text.quoted.decode(skcontent);
	}

	return com.synckolab.tools.text.trim(skcontent);
},

/**
 * Create a message to be stored on the Kolab server
 *
 * cid: the id of the card/event
 * adsubject: optional additional subject (iCal or vCard)
 * mime: the mime type (application/x-vnd.kolab.contact, application/x-vnd.kolab.event, application/x-vnd.kolab.task, application/x-vnd.kolab.journal, text/x-vcard, text/calendar)
 * part: true if this is a multipart message
 * content: the content for the message
 * hr: human Readable Part (optional)
 * profileimage: optional image attachment (the name of the image - it always resides in profile/Photos/XXX.jpg!)
 */
generateMail: function (cid, mail, adsubject, mime, part, skcontent, hr, image){
	// sometime we just do not want a new message :)
	if (skcontent === null) {
		return null;
	}

	var msg = "";
	var bound = com.synckolab.tools.text.randomVcardId();
	var cdate = new Date();
	var sTime = (cdate.getHours()<10?"0":"") + cdate.getHours() + ":" + (cdate.getMinutes()<10?"0":"") + cdate.getMinutes() + ":" +
	(cdate.getSeconds()<10?"0":"") + cdate.getSeconds();		
	var sdate = "Date: " + com.synckolab.tools.text.getDayString(cdate.getDay()) + ", " + cdate.getDate() + " " +
		com.synckolab.tools.text.getMonthString(cdate.getMonth()) + " " + cdate.getFullYear() + " " + sTime +
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
	if (!part) {
		msg += 'Content-Type: '+mime+';\n  charset="utf-8"\n';
	} else {
		msg += 'Content-Type: Multipart/Mixed;boundary="Boundary-00='+bound+'"\n';
	}
	// card/ical are encoded quoted printable
	if (!part) {
		msg += "Content-Transfer-Encoding: quoted-printable\n";
	}
	msg += "User-Agent: SyncKolab " + com.synckolab.config.version + "\n";
	if (part) {
		msg += "X-Kolab-Type: "+mime+"\n";
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
		msg += 'http://www.kolab.org/kolab2-clients.html\n';

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
		msg += 'Content-Transfer-Encoding: base64\n';
		msg += 'Content-Disposition: attachment;\n filename="kolab.xml"\n\n';
		// keep lines at 80 chars
		var acontent = btoa(skcontent);
		var n = 0;
		for (n= 0; n < acontent.length; )
		{
			if (n + 80 < acontent.length) {
				msg += acontent.slice(n, n+80);
			} else {
				msg += acontent.slice(n);
			}
			msg += "\n";
			n+=80;
		}
	}
	else {
		// add the content
		msg += skcontent + '\n';
	}
	
	// if we have an image try to read it and create a new part (ONLY for xml)
	if (part && image) {
		var file = Components.classes["@mozilla.org/file/directory_service;1"].getService(Components.interfaces.nsIProperties).get("ProfD", Components.interfaces.nsIFile);
		try {
			file.append("Photos");
			if (!file.exists()) {
				file.create(1, parseInt("0775", 8));
			}
			
			// fix newName: we can have C:\ - file:// and more - remove all that and put it in the photos folder
			var imageName = image.replace(/[^A-Za-z0-9._ \-]/g, "");
			imageName = imageName.replace(/ /g, "_");
	
			file.append(imageName);
			// file actually exists - we can try to read it and attach it
			if (file.exists() && file.isReadable())
			{
				// setup the input stream on the file
				var istream = Components.classes["@mozilla.org/network/file-input-stream;1"].createInstance(Components.interfaces.nsIFileInputStream);
				istream.init(file, 0x01, 4, null);
				var fileIO = Components.classes["@mozilla.org/binaryinputstream;1"].createInstance(Components.interfaces.nsIBinaryInputStream); 
				fileIO.setInputStream(istream);
				// get the image
				var fileContent = "";
				var csize = 0; 
				while ((csize = fileIO.available()) !== 0)
				{
					var data = fileIO.readBytes(csize);
					fileContent += btoa(data);
				}
				fileIO.close();
				istream.close();

				this.logMessage("got " + fileContent.length + " bytes", com.synckolab.global.LOG_WARNING);
				
				// now we got the image into fileContent - lets attach
				
				msg += '\n--Boundary-00='+bound+'\n';
				msg += 'Content-Type: image/jpeg;\n name="'+image+'"\n';
				msg += 'Content-Transfer-Encoding: base64\n';
				msg += 'Content-Disposition: attachment;\n filename="'+image+'"\n\n';
				msg += fileContent;
			}
		}
		catch (ex)
		{
			this.logMessage("Unable to read image: "+image+"\n" + ex, com.synckolab.global.LOG_WARNING);
			return null;
		}
		
	}

	if (part) {
		msg += '--Boundary-00='+bound+'--\n';
	} else {
		msg += '\n';
	}

	return msg;
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
 * @param accountKey the key for the account (baseMessageURI)
 * @return the account name
 */
getAccountName: function (accountKey) {
	var accountManager = Components.classes['@mozilla.org/messenger/account-manager;1'].getService(Components.interfaces.nsIMsgAccountManager);
	var gInc = null;
	for (var i = 0; i < accountManager.allServers.Count(); i++)
	{
		var account = accountManager.allServers.GetElementAt(i).QueryInterface(Components.interfaces.nsIMsgIncomingServer);
		if (account.rootMsgFolder.baseMessageURI === accountKey || com.synckolab.tools.text.accountNameFix(account.rootMsgFolder.baseMessageURI) === accountKey ||
				com.synckolab.tools.text.accountNameFix(account.prettyName) === accountKey)
		{
			return accountManager.getFirstIdentityForServer(account).fullName;
		}
	}
},


/** 
 * @param accountKey the key for the account (baseMessageURI)
 * @return the email address
 */
getAccountEMail: function (accountKey) {
	var accountManager = Components.classes['@mozilla.org/messenger/account-manager;1'].getService(Components.interfaces.nsIMsgAccountManager);
	var gInc = null;
	for (var i = 0; i < accountManager.allServers.Count(); i++)
	{
		var account = accountManager.allServers.GetElementAt(i).QueryInterface(Components.interfaces.nsIMsgIncomingServer);
		if (account.rootMsgFolder.baseMessageURI === accountKey || com.synckolab.tools.text.accountNameFix(account.rootMsgFolder.baseMessageURI) === accountKey ||
				com.synckolab.tools.text.accountNameFix(account.prettyName) === accountKey)
		{
			return accountManager.getFirstIdentityForServer(account).email;
		}
	}
},


/**
 * @param accountKey the key for the account (baseMessageURI)
 * @param path the path of the folder
 * @return the nsIMsgFolder for the given account and path
 */
getMsgFolder: function (accountKey, path)
{

	this.logMessage("trying to get folder: '" +  path + "' for account " + accountKey, com.synckolab.global.LOG_DEBUG);

	var accountManager = Components.classes['@mozilla.org/messenger/account-manager;1'].getService(Components.interfaces.nsIMsgAccountManager);
	var gInc = null;
	for (var i = 0; i < accountManager.allServers.Count(); i++)
	{
		var account = accountManager.allServers.GetElementAt(i).QueryInterface(Components.interfaces.nsIMsgIncomingServer);
		if (account.rootMsgFolder.baseMessageURI === accountKey || com.synckolab.tools.text.accountNameFix(account.rootMsgFolder.baseMessageURI) === accountKey||
				com.synckolab.tools.text.accountNameFix(account.prettyName) === accountKey)
		{
			gInc = account;
		}
	}

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
			{
				this.logMessage("we found our path!!!: " + cur.URI, com.synckolab.global.LOG_DEBUG);
				return cur;
			}

			// if the current path is the start of what we are lookiong for, go deeper
			var cp = path.substring(0, path.indexOf('/', cur.URI.length));

			if (cp === cur.URI)
			{
				this.logMessage("got subpath: " + cur.URI, com.synckolab.global.LOG_DEBUG);

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


com.synckolab.tools.file = {
	/**
	 * Copies a local file into any mail folder.
	 * In order to be displayed correct, make sure to create a complete message file!!!
	 * fileName string - the file to copy(+path)
	 * folderUri string - the Uri/Url of the folder we want this in
	 */
	copyToLocalFolder: function (fileName, folderUri)
	{
		var mailFolder = com.synckolab.global.rdf.GetResource(folderUri).QueryInterface(Components.interfaces.nsIMsgFolder);
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
			com.synckolab.tools.logMessage("Error: entry has no id (" +config.name + ": " + config.type + ")", com.synckolab.global.LOG_ERROR);
			return null;
		}

		id = id.replace(/[ :.;$\\\/]\#\@/g, "_");
		var file = Components.classes["@mozilla.org/file/directory_service;1"].getService(Components.interfaces.nsIProperties).get("ProfD", Components.interfaces.nsIFile);
		try {
			file.append("synckolab");
			if (!file.exists()) {
				file.create(1, parseInt("0775", 8));
			}
	
			file.append(config.type);
	
			if (!file.exists()) {
				file.create(1, parseInt("0775", 8));
			}
	
			file.append(config.name);
			if (!file.exists()) {
				file.create(1, parseInt("0775", 8));
			}
			file.append(id);
		}
		catch (ex)
		{
			com.synckolab.tools.logMessage("Problem with getting syncDbFile:  (" +config.name + ": " + config.type + ": " + id + ")\n" + ex, com.synckolab.global.LOG_ERROR);
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
com.synckolab.tools.writeSyncDBFile = function (file, data, direct)
{
	if (data === null) {
		return;
	}

	if (file.exists()) { 
		file.remove(true);
	}
	
	// create a json file out of it
	var skcontent = null;
	if(direct)
		skcontent = data;
	else
		skcontent = JSON.stringify(data);
	
	file.create(file.NORMAL_FILE_TYPE, parseInt("0666", 8));
	var stream = Components.classes['@mozilla.org/network/file-output-stream;1'].createInstance(Components.interfaces.nsIFileOutputStream);
	stream.init(file, 2, 0x200, false); // open as "write only"
	stream.write(skcontent, skcontent.length);
	stream.close();
};


/**
 * reads a given sync file. 
 * The sync file contains the entry in a json format.
 * @param file the file to read from
 * @param direct do not use json, write content as is
 * @returns the json object from the file
 */
com.synckolab.tools.readSyncDBFile = function (file, direct)
{	
	if (file === null)
	{
		com.synckolab.tools.logMessage("readSyncDBFile ERROR: file is null");
		return null;
	}

	if (!file.exists() || !file.isReadable()) {
		return null;
	}

	try
	{
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
		while ((csize = fileScriptableIO.available()) !== 0)
		{
			fileContent += fileScriptableIO.read( csize );
		}
		fileScriptableIO.close();
		istream.close();

		// use json instead
		if (direct) {
			return fileContent;
		}
		
		return JSON.parse(fileContent);
	}
	catch (ex)
	{
		com.synckolab.tools.logMessage("readSyncDBFile ERROR while reading file" + ex);
	}
	return null;
};

/**
 * Retrieves a file in the user profile dir which includes the config database
 * make sure to add .cal, .con or .task at the config so there are no duplicate names
 */
com.synckolab.tools.file.getHashDataBaseFile = function (config)
{
	var file = Components.classes["@mozilla.org/file/directory_service;1"].getService(Components.interfaces.nsIProperties).get("ProfD", Components.interfaces.nsIFile);
	file.append(config+".hdb");
	return file;
};

/**
 * Returns a file class for the given sync field file
 * this also creates the required subdirectories if not yet existant
 * you can use the .exists() function to check if we go this one already
 */
com.synckolab.tools.file.getSyncFieldFile = function (config, type, id)
{
	id = id.replace(/[ :.;$\\\/]\#\@/g, "_");
	var file = Components.classes["@mozilla.org/file/directory_service;1"].getService(Components.interfaces.nsIProperties).get("ProfD", Components.interfaces.nsIFile);
	file.append("synckolab");
	if (!file.exists()) {
		file.create(1, parseInt("0775", 8));
	}
	file.append(type);
	if (!file.exists()) {
		file.create(1, parseInt("0775", 8));
	}

	file.append(config);
	if (!file.exists()) {
		file.create(1, parseInt("0775", 8));
	}
	file.append(id + ".field");
	
	return file;
};



/**
 * Database class: read a file into a hashmap
 * @param file the file to read/write the data to/from
 */
com.synckolab.dataBase = function (file) {
	// the database file
	this.dbf = file;
	this.db = new com.synckolab.hashMap();
	
	// no file specified - memory only
	if(!file) {
		return;
	}

	// if the file is not readable - dont bother
	if (!file.exists() || !file.isReadable()) {
		com.synckolab.tools.logMessage("File not readable: " + file, com.synckolab.global.LOG_WARNING);
		return;
	}

	// setup the input stream on the file
	var istream = Components.classes["@mozilla.org/network/file-input-stream;1"]
	                                 .createInstance(Components.interfaces.nsIFileInputStream);
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
			fv = com.synckolab.tools.text.trim(fv).split(":");
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
com.synckolab.dataBase.prototype.get = function (key) {
	return this.db.get(key);
};

com.synckolab.dataBase.prototype.remove = function (entry) {
	this.db.remove(entry[0]);
};

/**
 * add an array - the first entry is the key!
 * @param entry
 */
com.synckolab.dataBase.prototype.add = function (entry) {
	this.db.put(entry[0], entry);
};

/**
 * convenience function to add a key/value pair (both strings)
 * @param entry
 * @return
 */
com.synckolab.dataBase.prototype.addField = function (name, value) {
	// ignore errornous fields!
	if (name === null || value === null) {
		return;
	}
	var entry = [name, value];
	this.db.put(entry[0], entry);
};

com.synckolab.dataBase.prototype.length = function () {
	return this.db.length();
};

com.synckolab.dataBase.prototype.toString = function () {
	this.db.iterate();
	var cur;
	var str = "";
	while ((cur = this.db.next()))
	{
		str += cur[0] + ":" + cur[1] + "\n";
	}
	return str;
};

com.synckolab.dataBase.prototype.toXmlString = function () {
	this.db.iterate();
	var cur;
	var str = "";
	while ((cur = this.db.next()))
	{
		str += com.synckolab.tools.text.nodeWithContent(cur[0], cur[1], false);
	}
	return str;
};
/**
 * writes a database file (key:hashvalue:h2)
 * @param file an optional new filename to write into
 */
com.synckolab.dataBase.prototype.write = function (file) {
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
		com.synckolab.tools.logMessage("writing " + s, com.synckolab.global.LOG_DEBUG);
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
com.synckolab.hashMap = function ()
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
com.synckolab.hashMap.prototype.iterate = function () {
	this.hashIdx = 0;
	this.idx = 0;
};

/**
 * gets the next element or null
 */
com.synckolab.hashMap.prototype.next = function () {
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
com.synckolab.hashMap.entry = function ( key, value )
{
	this.key = key;
	this.value = value;
	
};


com.synckolab.hashMap.prototype.getIKey = function (key)
{
	if(!key) {
		var err = new Error("");
		Components.utils.reportError("No key defined for hashmap!" + err.stack);
		throw("No key defined for hashmap!");
	}
	
	var sum = 0;
	for (var k = 0; k < key.length; k++) {
		sum += key.charCodeAt(k)*k;
	}
	return sum;
};

com.synckolab.hashMap.prototype.put = function ( key, value )
{
	if(!key) {
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
	car[car.length] = new com.synckolab.hashMap.entry( key, value );
	this.len++;
};

com.synckolab.hashMap.prototype.clear = function ()
{
	for (var k = 0; k < this.seed; k++) {
		this.array[k] = [];
	}
	this.len = 0;
};

com.synckolab.hashMap.prototype.remove = function ( key )
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

com.synckolab.hashMap.prototype.get = function ( key )
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

com.synckolab.hashMap.prototype.length = function ()
{
	return this.len;
};

/**
 * synckolab node (standard node with a twist)
 */
com.synckolab.Node = function (node) {
	if (node === null) {
		return null;
	}
	this.node = node;
	this.nodeName = node.nodeName;
	this.nodeType = node.nodeType;
	this.firstChild = node.firstChild;
	this.nextSibling = new com.synckolab.Node(node.nextSibling);
};

com.synckolab.Node.prototype.getFirstData =  function () {
	if (!this.node.firstChild) {
		return null;
	}
	return com.synckolab.tools.text.decode4XML(this.node.firstChild.data);
};

/**
 * return the content of a child node with name "name" of the node "node"
 * or the given default "def" if no such node exists
 */
com.synckolab.Node.prototype.getXmlResult =  function (name, def)
{
	var cur = this.node.firstChild;
	while(cur)
	{
		if (cur.nodeName.toUpperCase() === name.toUpperCase())
		{
			if (cur.hasChildNodes())
			{
				var value = cur.firstChild.nodeValue;
				// decode the value
				if (value) {
					return com.synckolab.tools.text.decode4XML(value);
				}
			}
		}
		cur = cur.nextSibling;
	}
	return def;
};


/**
 * return a direct child node with the name "name" of the node "node"
 */
com.synckolab.Node.prototype.getChildNode = function (name)
{
	var cur = this.node.firstChild;
	while(cur)
	{
		if (cur.nodeName.toUpperCase() === name.toUpperCase())
		{
			return cur;
		}
		cur = cur.nextSibling;
	}
	return null;
};

/**
 * return the value of the attribute with name "attrName" of the node "node"
 * or null, if no attribute with that name exists
 */
com.synckolab.Node.prototype.getAttribute = function (attrName)
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
com.synckolab.tools.instanceOf = function (aObject, aInterface) {
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
