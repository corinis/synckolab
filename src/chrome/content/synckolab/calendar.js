/*
 ***** BEGIN LICENSE BLOCK *****
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
 *
 ***** END LICENSE BLOCK ***** */

/*
 * A kinda "provider" class for syncing the calendar. 
 * The functions are called by the main synckolab loop to 
 * create email content and called with email content (complete 
 * body) to generate add/update contacts in the calendar. 
 * 
 * This WILL be replaced and put into a real calendar provider
 * (As described by the Mozilla Calendar project)
 */

var syncCalendar = {
	folderPath: '', // String - the path for the contacts
	serverKey: '', // the incoming server
	gSaveImap: true, // write back to folder

	gEvents: '',
	gToDo: '',
	gCurTodo: 0,
	gCurEvent: 0,
	folder: '', // the contact folder type nsIMsgFolder
	folderMsgURI: '', // the message uri
	gCalFile: '',
	format: 'iCal', // the format iCal/Xml	
	folderMessageUids: '',
	
	dbFile: '', // the current sync database file
	db: '', // the current sync database 

	init: function(config) {
		if (!isCalendarAvailable ())
			return;
			
		var calFile;
		// initialize the configuration
		try {
	    var pref = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
			this.folderPath = pref.getCharPref("SyncKolab."+config+".CalendarFolderPath");
			this.serverKey = pref.getCharPref("SyncKolab."+config+".CalendarIncomingServer");
			this.gCalFile = pref.getCharPref("SyncKolab."+config+".Calendar");
			this.format = pref.getCharPref("SyncKolab."+config+".CalendarFormat");			
			this.gSaveImap = pref.getBoolPref("SyncKolab."+config+".saveToCalendarImap");
			// since Imap savine does not work with xml - disable this
			if (this.format == "Xml")
				this.gSaveImap = false;
		} catch(e) {
			return;
		}
		var aDataStream = readDataFromFile( this.gCalFile, "UTF-8" );
		
		this.gEvents = parseIcalEvents( aDataStream );
    	this.gToDo = parseIcalToDos( aDataStream );		 
    	this.folderMessageUids = new Array(); // the checked uids - for better sync
    	
    	// get the sync db
		this.dbFile = getHashDataBaseFile (config + ".cal");
		this.db = readHashDataBase (this.dbFile);
	},

	/**
	 * parses the given content, if an update is required the 
	 * new message content is returned otehrwise null
	 */	
	parseMessage: function(fileContent) {
		fileContent = decode_utf8(DecodeQuoted(fileContent));
		var newCard;
		if (this.format == "Xml")
		{
			newCard = Components.classes["@mozilla.org/icalevent;1"].createInstance().QueryInterface(Components.interfaces.oeIICalEvent);
			xml2Event(fileContent, newCard)
		}
		else
			newCard = parseIcalEvents(fileContent)[0].QueryInterface(Components.interfaces.oeIICalEvent);
		
		// remember that we did this uid already
		this.folderMessageUids.push(newCard.id);
		// ok lets see if we have this one already (remember custom4=UID)
		var acard = findEvent (this.gEvents, newCard.id);
	
		// a new card				
		if (acard == null)
		{
			var cEntry = getDbEntry (newCard.id, this.db);
			if (cEntry == -1)
			{
				var curEntry = new Array();
				curEntry.push(newCard.id);
				curEntry.push(genCalSha1(newCard));
				this.db.push(curEntry);

				this.gAddressBook.addCard (newCard);
			}
			else
			{
				return "DELETEME";
			}

			this.gEvents.push(newCard);
 		  	saveIcal (this.gEvents, this.gTodo, this.gCalFile);
		}
		else
		{
			var cdb = getDbEntry (newCard.id, this.db);
			var lastSyncEntry = cdb!=-1?this.db[cdb][1]:null;
			var newSyncEntry = genCalSha1 (newCard);
			var curSyncEntry = genCalSha1 (acard);

			if (lastSyncEntry != null && lastSyncEntry != curSyncEntry && lastSyncEntry != newSyncEntry)
			{
				if (window.confirm("Changes were made on the server and local. Click ok to use the server version.\nClient card: " + 
					acard.displayName + "<"+ acard.defaultEmail + ">\nServer Card: " + newCard.displayName + "<"+ newCard.defaultEmail + ">"))
				{
					var newdb = new Array();
					newdb.push(newCard.id);
					newdb.push(newSyncEntry);
					if (lastSyncEntry != null)
					{
						this.db[cdb][0] = ""; // mark for delete
					}
					this.db.push(newdb);
	
					for (var i = 0; i < this.gEvents.length; i++)
					{
						if (this.gEvents[i].id == newCard.id)
						{
							 this.gEvents[i] = newCard;
							 // save the cards
							 saveIcal (this.gEvents, this.gTodo, this.gCalFile);
							 return null;
						}
					}
				}
				else
				{
					var newdb = new Array();
					newdb.push(acard.id);
					newdb.push(curSyncEntry);
					if (lastSyncEntry != null)
					{
						this.db[cdb][0] = ""; // mark for delete
					}
					this.db.push(newdb);
	
					var msg = geniCalMailHeader(acard.id);
					msg += encodeQuoted(encode_utf8(acard.getIcalString()));
					msg += "\n\n";
					// remember this message for update
					return msg;
				}
			}
			else

			// we got that already, see which is newer and update the message or the card
			if (lastSyncEntry == null || (lastSyncEntry == curSyncEntry && lastSyncEntry != newSyncEntry))
			{
			    consoleService.logStringMessage("server changed: " + acard.id);
			    
				var newdb = new Array();
				newdb.push(newCard.id);
				newdb.push(newSyncEntry);
				if (lastSyncEntry != null)
				{
					this.db[cdb][0] = ""; // mark for delete
				}
				this.db.push(newdb);

				for (var i = 0; i < this.gEvents.length; i++)
				{
					if (this.gEvents[i].id == newCard.id)
					{
						 this.gEvents[i] = newCard;
						 // save the cards
						 saveIcal (this.gEvents, this.gTodo, this.gCalFile);
						 return null;
					}
				}
				
			}
			else
			if (lastSyncEntry != curSyncEntry && lastSyncEntry == newSyncEntry)
			{
			    consoleService.logStringMessage("client changed: " + acard.id);
				var newdb = new Array();
				newdb.push(acard.id);
				newdb.push(curSyncEntry);
				if (lastSyncEntry != null)
				{
					this.db[cdb][0] = ""; // mark for delete
				}
				this.db.push(newdb);

				var msg = geniCalMailHeader(acard.id);
				msg += encodeQuoted(encode_utf8(acard.getIcalString()));
				msg += "\n\n";
				// remember this message for update
				return msg;
			}
		}
		return null;
	},
	
	
	initUpdate: function () {
		this.gCurEvent = 0;
		this.gCurTodo = 0;
		return true;
	},
	
	/**
	 * read the next todo/event and return the content if update needed
	 */
	nextUpdate: function () {
		// if there happens an exception, we are done
		if ((this.gEvents == null || this.gCurEvent >= this.gEvents.length) && (this.gTodo == null || this.gCurTodo >= this.gTodo.length))
		{
			// we are done
			return "done";
		}
		
		if (this.gEvents != null && this.gCurEvent <= this.gEvents.length )
		{
			var cur = this.gEvents[this.gCurEvent++];
			var msg = null;
	    var writeCur = false;
		    
			writeCur = true;
			// check if we have this uid in the messages
			var i;
			for (i = 0; i < this.folderMessageUids.length; i++)
			{
				if (cur.id == this.folderMessageUids[i])
				{
			    consoleService.logStringMessage("we got this card: " + cur.id);
					writeCur = false;
					break;
				}
			}
		
			if (writeCur)
			{
				// and write the message
				msg ="";
				cdate = new Date();
				var sTime = (cdate.getHours()<10?"0":"") + cdate.getHours() + ":" + (cdate.getMinutes()<10?"0":"") + cdate.getMinutes() + ":" +
					(cdate.getSeconds()<10?"0":"") + cdate.getSeconds();
				var sdate = "Date: " + getDayString(cdate.getDay()) + ", " + cdate.getDate() + " " +
					getMonthString (cdate.getMonth()) + " " + cdate.getFullYear() + " " + sTime
					 + " " + (((cdate.getTimezoneOffset()/60) < 0)?"-":"+") +
					(((cdate.getTimezoneOffset()/60) < 10)?"0":"") + cdate.getTimezoneOffset() + "00\n";
	/*
				msg += "From - " + getDayString(cdate.getDay()) + " " + getMonthString (cdate.getMonth()) + " " + 
						cdate.getDate()	+ " " + sTime + " " + cdate.getFullYear() + "\n";
				msg += "X-Mozilla-Status: 0001\n";
				msg += "X-Mozilla-Status2: 00000000\n";
				msg += "Content-Type: Text/X-VCalendar;\n";
			  msg += '\tcharset="utf-8"\n';
*/
				msg += "From: synckolab@no.tld\n";
				msg += "Reply-To: \n";
				msg += "Bcc: \n";
				msg += "To: synckolab@no.tld\n";
				msg += "Subject: iCal " + cur.id + "\n";
				msg += sdate;
				msg += 'Content-Type: text/calendar;charset="utf-8"\n';
				msg += 'Content-Transfer-Encoding: quoted-printable\n';
				msg += "User-Agent: SyncKolab\n\r\n\r\n";
				
				msg += encodeQuoted(encode_utf8(cur.getIcalString()));
				msg += "\n\n";
		    consoleService.logStringMessage("New Card [" + msg + "]");
			}
		}	
		else
		if (gTodo != null && this.gCurTodo <= this.gTodo.length)
		{
			var cur = this.gTodo[this.gCurTodo++];
			var msg = null;
	    var writeCur = false;
		    
			writeCur = true;
			// check if we have this uid in the messages
			var i;
			for (i = 0; i < this.folderMessageUids.length; i++)
			{
				if (cur.id == this.folderMessageUids[i])
				{
			    consoleService.logStringMessage("we got this card: " + cur.id);
					writeCur = false;
					break;
				}
			}
		
			if (writeCur)
			{
				// and write the message
				msg ="";
				cdate = new Date();
				var sTime = (cdate.getHours()<10?"0":"") + cdate.getHours() + ":" + (cdate.getMinutes()<10?"0":"") + cdate.getMinutes() + ":" +
					(cdate.getSeconds()<10?"0":"") + cdate.getSeconds();
				var sdate = "Date: " + getDayString(cdate.getDay()) + ", " + cdate.getDate() + " " +
					getMonthString (cdate.getMonth()) + " " + cdate.getFullYear() + " " + sTime
					 + " " + (((cdate.getTimezoneOffset()/60) < 0)?"-":"+") +
					(((cdate.getTimezoneOffset()/60) < 10)?"0":"") + cdate.getTimezoneOffset() + "00\n";
/*	
				msg += "From - " + getDayString(cdate.getDay()) + " " + getMonthString (cdate.getMonth()) + " " + 
						cdate.getDate()	+ " " + sTime + " " + cdate.getFullYear() + "\n";
				msg += "X-Mozilla-Status: 0001\n";
				msg += "X-Mozilla-Status2: 00000000\n";
				msg += "Content-Type: Text/X-VCalendar;\n";
			  msg += '\tcharset="utf-8"\n';
*/			  
				msg += "From: \n";
				msg += "Reply-To: \n";
				msg += "Bcc: \n";
				msg += "To: \n";
				msg += "Subject: iCal " + cur.id + "\n";
				msg += sdate;
				msg += 'Content-Type: text/calendar;charset="utf-8"\n';
				msg += 'Content-Transfer-Encoding: quoted-printable\n';
				msg += "User-Agent: SyncKolab\n\r\n\r\n";
				
				msg += encodeQuoted(encode_utf8(cur.getIcalString()));
				msg += "\n\n";
				
		    consoleService.logStringMessage("New Card [" + msg + "]");
			}
		}
		
		// return the cards content
		return msg;
	},
	
	
	doneParsing: function ()
	{
		writeHashDataBase (this.dbFile, this.db);
	}
}

