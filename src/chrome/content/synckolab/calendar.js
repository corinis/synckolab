// class to sync the address book
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
			this.gEvents.push(newCard);
 		  saveIcal (this.gEvents, this.gTodo, this.gCalFile);
		}
		else
		{
			// we got that already, see which is newer and update the message or the card
			if (newCard.stamp.getTime() > acard.stamp.getTime())
			{
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
			if (newCard.stamp.getTime() < acard.stamp.getTime())
			{
				var msg ="";
				cdate = new Date();
				var sTime = (cdate.getHours()<10?"0":"") + cdate.getHours() + ":" + (cdate.getMinutes()<10?"0":"") + cdate.getMinutes() + ":" +
					(cdate.getSeconds()<10?"0":"") + cdate.getSeconds();
				var sdate = "Date: " + getDayString(cdate.getDay()) + ", " + cdate.getDate() + " " +
					getMonthString (cdate.getMonth()) + " " + cdate.getFullYear() + " " + sTime
					 + " " + (((cdate.getTimezoneOffset()/60) < 0)?"-":"+") +
					(((cdate.getTimezoneOffset()/60) < 10)?"0":"") + cdate.getTimezoneOffset() + "\n";

				msg += "From: synckolab@no.tld\n";
				msg += "Reply-To: \n";
				msg += "Bcc: \n";
				msg += "To: synckolab@no.tld\n";
				msg += "Subject: iCal " + acard.id + "\n";
				msg += sdate;
				msg += 'Content-Type: text/calendar;charset="utf-8"\n';
				msg += 'Content-Transfer-Encoding: quoted-printable\n';
				msg += "User-Agent: SyncKolab\n\r\n\r\n";

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
	}
	
	
}

