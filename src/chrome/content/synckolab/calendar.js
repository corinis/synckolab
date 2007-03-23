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
 *                 Andreas Gungl <a.gungl@gmx.de>
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

var debugCalendarSync = false;

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
	folderPath: '', // String - the path for the entries
	serverKey: '', // the incoming server
	gSaveImap: true, // write back to folder

//	gEvents: '', - now a listener
	gToDo: '',
	gCurTodo: 0,
	gCurEvent: 0,
	folder: '', // the contact folder type nsIMsgFolder
	folderMsgURI: '', // the message uri
	gCalendarName: '', // the calendar name
	gCalendar: '', // the calendar
	gCalendarEvents: '', // all events from the calendar
	format: 'iCal', // the format iCal/Xml	
	folderMessageUids: '',
	
	dbFile: '', // the current sync database file
	db: '', // the current sync database

	itemList: '', // display the currently processed item with status
	curItemInList: '', // the current item in the list (for updating the status)
	curItemInListId: '',
	curItemInListStatus: '',
	curItemInListContent: '',

	init: function(config) {
		if (!isCalendarAvailable ())
			return;
			
		var calFile;
		// initialize the configuration
		try {
	    var pref = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
			this.folderPath = pref.getCharPref("SyncKolab."+config+".CalendarFolderPath");
			this.serverKey = pref.getCharPref("SyncKolab."+config+".CalendarIncomingServer");
			this.gCalendarName = pref.getCharPref("SyncKolab."+config+".Calendar");
			this.format = pref.getCharPref("SyncKolab."+config+".CalendarFormat");			
			this.gSaveImap = pref.getBoolPref("SyncKolab."+config+".saveToCalendarImap");
		} catch(e) {
			return;
		}

		// get the correct calendar instance
		var calendars = getSynckolabCalendars();
		for( var i = 0; i < calendars.length; i++ )
		{
			if (calendars[i].name == this.gCalendarName)
			{
				this.gCalendar = calendars[i];
				break;
			}
		}		
		
		
		this.folderMessageUids = new Array(); // the checked uids - for better sync
    	
    	// get the sync db
		this.dbFile = getHashDataBaseFile (config + ".cal");
		this.db = readHashDataBase (this.dbFile);
	},
	
	init2: function (nextFunc, sync)	{
		// get ALL the items from calendar - when done call nextfunc
		this.gEvents.nextFunc = nextFunc;
		this.gEvents.sync = sync;
		this.gEvents.events = new Array();
		// gCalendar might be invalid if no calendar is selected in the settings
		if (this.gCalendar) {
		  this.gCalendar.getItems(this.gCalendar.ITEM_FILTER_TYPE_EVENT, 0, null, null, this.gEvents);
			// if no item has been read, onGetResult has never been called 
			// leaving us stuck in the events chain
		  if (this.gEvents.events.length > 0)
		      return true;
		  else
		      return false;
		}
		else {
		  alert("Please select a calender as sync target before trying to synchronize.");
		  return false;
		}
	},
	
	gEvents: {
		nextFunc: '',
		events: new Array(),
		sync: '',
		onOperationComplete: function(aCalendar, aStatus, aOperator, aId, aDetail) {		
// 			    consoleService.logStringMessage("operation: status="+aStatus + " Op=" + aOperator + " Detail=" + aDetail);
			},
		onGetResult: function(aCalendar, aStatus, aItemType, aDetail, aCount, aItems) {
                consoleService.logStringMessage("got results: " + aCount + " items");
                for (var i = 0; i < aCount; i++) {
                    this.events.push(aItems[i]);
                }
                this.nextFunc(this.sync);
            }
	},


	/**
	 * parses the given content, if an update is required the 
	 * new message content is returned otherwise null
	 */	
	parseMessage: function(fileContent) {
		fileContent = decode_utf8(DecodeQuoted(fileContent));
		
		// create a new item in the itemList for display
		this.curItemInList = document.createElement("listitem");
		this.curItemInListId = document.createElement("listcell");
		this.curItemInListStatus = document.createElement("listcell");
		this.curItemInListContent = document.createElement("listcell");
		this.curItemInListId.setAttribute("label", "unknown");
		this.curItemInListStatus.setAttribute("label", "parsing");
		this.curItemInListContent.setAttribute("label", "unknown");
		

		this.curItemInList.appendChild(this.curItemInListId);
		this.curItemInList.appendChild(this.curItemInListStatus);
		this.curItemInList.appendChild(this.curItemInListContent);
		
		this.itemList.appendChild(this.curItemInList);
		
		var newEvent;
		if (this.format == "Xml")
		{
			newEvent = Components.classes["@mozilla.org/calendar/event;1"]
				.createInstance(Components.interfaces.calIEvent);
			if (xml2Event(fileContent, newEvent) == false)
			{
				// update list item
				this.curItemInListId.setAttribute("label", "unparseable");
				return null;
			}
		}
		else
		{
            // this.format == 'iCal'
		    newEvent = ical2event(fileContent);
		}

		// update list item
		this.curItemInListId.setAttribute("label", newEvent.id);
		this.curItemInListStatus.setAttribute("label", "checking");
		this.curItemInListContent.setAttribute("label", newEvent.title);
		
		// remember that we did this uid already
		this.folderMessageUids.push(newEvent.id);
		// ok lets see if we have this one already 
		var foundEvent = findEvent (this.gEvents, newEvent.id);
	
		if (foundEvent == null)
		{
			// a new event
			if (debugCalendarSync)
				consoleService.logStringMessage("a new event, locally unknown:" + newEvent.id);
			var cEntry = getDbEntry (newEvent.id, this.db);
			if (cEntry == -1)
			{
				var curEntry = new Array();
				curEntry.push(newEvent.id);
				curEntry.push(genCalSha1(newEvent));
				this.db.push(curEntry);
				this.curItemInListStatus.setAttribute("label", "add local");

				if (debugCalendarSync)
				    consoleService.logStringMessage("added locally:" + newEvent.id);				
			}
			else
			{
				this.curItemInListStatus.setAttribute("label", "server delete");
				if (debugCalendarSync)
				    consoleService.logStringMessage("server delete - DELETEME returned:" + newEvent.id);
				return "DELETEME";
			}

			// add the new event
			this.gCalendar.addItem(newEvent, this.gEvents);
		}
		else
		{
			// event exists in local calendar
			if (debugCalendarSync)
				consoleService.logStringMessage("event exists locally:" + newEvent.id);

			var cdb = getDbEntry (newEvent.id, this.db);
			var lastSyncEntry = cdb!=-1?this.db[cdb][1]:null;
			var newSyncEntry = genCalSha1 (newEvent);
			var curSyncEntry = genCalSha1 (foundEvent);

			// where did changes happen?
			if (lastSyncEntry != null && lastSyncEntry != curSyncEntry && lastSyncEntry != newSyncEntry)
			{
				// changed locally and on server side
				if (debugCalendarSync)
					consoleService.logStringMessage("changed both on server and client:" + newEvent.id);
				if (window.confirm("Changes were made on the server and local. Click ok to use the server version.\nClient Event: " + 
					foundEvent.title + "<"+ foundEvent.id + ">\nServer Event: " + newEvent.title + "<"+ newEvent.id + ">"))
				{
					// take event from server
					if (debugCalendarSync)
						consoleService.logStringMessage("take event from server:" + newEvent.id);

					var newdb = new Array();
					newdb.push(newEvent.id);
					newdb.push(newSyncEntry);
					if (lastSyncEntry != null) this.db[cdb][0] = ""; // mark for delete
					
					this.db.push(newdb);
	
					for (var i = 0; i < this.gEvents.events.length; i++)
					{
						if (this.gEvents.events[i].id == newEvent.id)
						{
							// modify the item
							this.gCalendar.modifyItem(newEvent, foundEvent, this.gEvents);
							//this.gEvents.events[i] = newEvent;
							
							//update list item
							this.curItemInListStatus.setAttribute("label", "update local");
							
							return null;
						}
					}
				}
				else
				{
					// put local change to server
					if (debugCalendarSync)
					   consoleService.logStringMessage("put event on server:" + newEvent.id);

					var newdb = new Array();
					newdb.push(foundEvent.id);
					newdb.push(curSyncEntry);
					if (lastSyncEntry != null) this.db[cdb][0] = ""; // mark for delete

					this.db.push(newdb);
	
					var msg = null;
					if (this.format == "Xml")
					{
					msg = event2kolabXmlMsg(foundEvent);
					} 
					else
					{
    					msg = genMailHeader(foundEvent.id, "iCal", "text/calendar", false);
		                        msg += encodeQuoted(encode_utf8(foundEvent.getIcalString()));
		                        msg += "\n\n";
					}

						// update list item
						this.curItemInListStatus.setAttribute("label", "update server");
					
					// remember this message for update
					return msg;
				}
			}
			else
			{
				if (debugCalendarSync)
					consoleService.logStringMessage("changed only on one side (if at all):" + newEvent.id);
	 			// we got that already, see which is newer and update the message or the event
				// the sync database might be out-of-date, so we handle a non-existent entry as well
	 			if (lastSyncEntry == null || (lastSyncEntry == curSyncEntry && lastSyncEntry != newSyncEntry))
				{
					// event has been changed on the server
					if (debugCalendarSync)
					   consoleService.logStringMessage("event changed on server:" + newEvent.id);
			    
					var newdb = new Array();
					newdb.push(newEvent.id);
					newdb.push(newSyncEntry);
					if (lastSyncEntry != null) this.db[cdb][0] = ""; // mark for delete
					this.db.push(newdb);

					for (var i = 0; i < this.gEvents.events.length; i++)
					{
						if (this.gEvents.events[i].id == newEvent.id)
						{
							// modify the item
							this.gCalendar.modifyItem(newEvent, foundEvent, this.gEvents);
							//this.gEvents.events[i] = newEvent;

							// update list item
							this.curItemInListStatus.setAttribute("label", "update local");
							 
							return null;
						}
					}
				}
				else
				{
					if (lastSyncEntry != curSyncEntry && lastSyncEntry == newSyncEntry)
					{
						// event has been changed on the client
						if (debugCalendarSync)
							consoleService.logStringMessage("event changed on client:" + newEvent.id);
						var newdb = new Array();
						newdb.push(foundEvent.id);
						newdb.push(curSyncEntry);
						if (lastSyncEntry != null)
						{
							this.db[cdb][0] = ""; // mark for delete
						}
						this.db.push(newdb);

				                var msg = null;
				                if (this.format == "Xml")
				                {
				                    msg = event2kolabXmlMsg(foundEvent);
				                } 
				                else
				                {
				    				msg = genMailHeader(foundEvent.id, "iCal", "text/calendar", false);
				    				icssrv = Components.classes["@mozilla.org/calendar/ics-service;1"]
				    					.getService(Components.interfaces.calIICSService);
				    				var calComp = icssrv.createIcalComponent("VCALENDAR");
				    				calComp.version = "2.0";
				    				calComp.prodid = "-//Mozilla.org/NONSGML Mozilla Calendar V1.1//EN";
				    				calComp.addSubcomponent(foundEvent.icalComponent);
				    				
				    				msg += encodeQuoted(encode_utf8(calComp.serializeToICS()));
				    				msg += "\n\n";
				                }
				
						// update list item
						this.curItemInListStatus.setAttribute("label", "update server");
						
						// remember this message for update
						return msg;
					}
				}
				if (debugCalendarSync)
					consoleService.logStringMessage("no change for event:" + newEvent.id);
 	
				this.curItemInListStatus.setAttribute("label", "no change");
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
		consoleService.logStringMessage("next update...");
		// if there happens an exception, we are done
		if ((this.gEvents == null || this.gCurEvent >= this.gEvents.events.length) && (this.gTodo == null || this.gCurTodo >= this.gTodo.length))
		{
			consoleService.logStringMessage("done update...");
			// we are done
			return "done";
		}
		consoleService.logStringMessage("get event");
		
		if (this.gEvents != null && this.gCurEvent <= this.gEvents.events.length )
		{
			var cur = this.gEvents.events[this.gCurEvent++];
			var msg = null;
			var writeCur = true;
		    
			if (debugCalendarSync)
				consoleService.logStringMessage("nextUpdate for event:" + cur.id);
			// check if we have this uid in the messages
			var i;
			for (i = 0; i < this.folderMessageUids.length; i++)
			{
				if (cur.id == this.folderMessageUids[i])
				{
					if (debugCalendarSync)
						consoleService.logStringMessage("event is know from IMAP lookup:" + cur.id);
					writeCur = false;
					break;
				}
			}
			
			// ok we should have this event in our db but 
			// not on the imap acct. if we got this entry in our internal db
			// it has been deleted on the server and we dont know about it yet
			if (writeCur)
			{
				if (debugCalendarSync)
					consoleService.logStringMessage("nextUpdate decided to write event:" + cur.id);

				var curSyncEntry = genCalSha1 (cur);
				var cdb = getDbEntry (cur.id, this.db);
				if (cdb != -1)
				{
					// we have it in our database
					if (debugCalendarSync)
						consoleService.logStringMessage("nextUpdate found -1, better don't write event:" + cur.id);
					writeCur = false;
					this.db[cdb][0] = ""; // mark for delete
					this.gCalendar.deleteItem(cur, this.gEvents);
					
					// create a new item in the itemList for display
					this.curItemInList = document.createElement("listitem");
					this.curItemInListId = document.createElement("listcell");
					this.curItemInListStatus = document.createElement("listcell");
					this.curItemInListContent = document.createElement("listcell");
					this.curItemInListId.setAttribute("label", cur.id);
					this.curItemInListStatus.setAttribute("label", "local delete");
					this.curItemInListContent.setAttribute("label", cur.title);
					
			
					this.curItemInList.appendChild(this.curItemInListId);
					this.curItemInList.appendChild(this.curItemInListStatus);
					this.curItemInList.appendChild(this.curItemInListContent);
					
					this.itemList.appendChild(this.curItemInList);
				}
				// ok its NOT in our internal db... add it
				else
				{
					var newdb = new Array();
					newdb.push(cur.id);
					newdb.push(curSyncEntry);
					this.db.push(newdb);
					
					
					// create a new item in the itemList for display
					this.curItemInList = document.createElement("listitem");
					this.curItemInListId = document.createElement("listcell");
					this.curItemInListStatus = document.createElement("listcell");
					this.curItemInListContent = document.createElement("listcell");
					this.curItemInListId.setAttribute("label", cur.id);
					this.curItemInListStatus.setAttribute("label", "add to server");
					this.curItemInListContent.setAttribute("label", cur.title);
					
			
					this.curItemInList.appendChild(this.curItemInListId);
					this.curItemInList.appendChild(this.curItemInListStatus);
					this.curItemInList.appendChild(this.curItemInListContent);
					
					this.itemList.appendChild(this.curItemInList);
				}
			}

		
			if (writeCur)
			{
				if (debugCalendarSync)
					consoleService.logStringMessage("nextUpdate really writes event:" + cur.id);

				// and write the message
		                var msg = null;
		                if (this.format == "Xml")
		                {
					msg = event2kolabXmlMsg(cur);
		                } 
		                else
		                {
					msg = genMailHeader(cur.id, "iCal", "text/calendar", false);
					icssrv = Components.classes["@mozilla.org/calendar/ics-service;1"]
						.getService(Components.interfaces.calIICSService);
					var calComp = icssrv.createIcalComponent("VCALENDAR");
					calComp.version = "2.0";
					calComp.prodid = "-//Mozilla.org/NONSGML Mozilla Calendar V1.1//EN";
					calComp.addSubcomponent(cur.icalComponent);

					msg += encodeQuoted(encode_utf8(calComp.serializeToICS()));
					msg += "\n\n";
				}
				consoleService.logStringMessage("New event:\n" + msg);
				if (debugCalendarSync)
					consoleService.logStringMessage("nextUpdate puts event into db (2):" + cur.id);
				// add the new event into the db
				var curSyncEntry = genCalSha1 (cur);
				var newdb = new Array();
				newdb.push(cur.id);
				newdb.push(curSyncEntry);
				this.db.push(newdb);

			}
		}	
		else
		if (this.gTodo != null && this.gCurTodo <= this.gTodo.length)
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
					consoleService.logStringMessage("we got this todo: " + cur.id);
					writeCur = false;
					break;
				}
			}
		
			if (writeCur)
			{
				// and write the message
				var msg = genMailHeader(cur.id, "iCal", "text/calendar", false);
				msg += encodeQuoted(encode_utf8(cur.getIcalString()));
				msg += "\n\n";
				
		    consoleService.logStringMessage("New event [" + msg + "]");
			}
		}
		
		// return the event's content
		return msg;
	},
	
	
	doneParsing: function ()
	{
		writeHashDataBase (this.dbFile, this.db);
	}
}
