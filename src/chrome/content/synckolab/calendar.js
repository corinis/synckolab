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

/*
 * A kinda "provider" class for syncing the calendar. 
 * The functions are called by the main synckolab loop to 
 * create email content and called with email content (complete 
 * body) to generate add/update contacts in the calendar. 
 * 
 * Notice:
 *   - all events/tasks older then today-gSyncTimeFrame(in days) will be ignored completely (not deleted, modified, added,...)
 *   - all email messages with a date-header older than today-gSyncTimeFrame(in days) will also be ignored!
 *   - 0=take all messages
 */
var syncCalendar = {
	isTbird2: true, // default: tbird 2 
	gConflictResolve : "ask", // conflict resolution (default: ask what to do)

	folderPath: '', // String - the path for the entries
	serverKey: '', // the incoming server
	gSaveImap: true, // write back to folder
	gSync: true, // sync this configuration	
	gConfig: '', // remember the configuration name
	gCurUID: '', // save the last checked uid - for external use

	gCurEvent: 0,
	folder: '', // the contact folder type nsIMsgFolder
	folderMsgURI: '', // the message uri
	gSyncTimeFrame: 180, // time frame to take into account (all older than X days will be ignored completely) -1 just take all
	gCalendarName: '', // the calendar name
	gCalendar: '', // the calendar
	gCalendarEvents: '', // all events from the calendar
	gCalDB: '', // hashmap for all the events (faster than iterating on big numbers)
	format: 'Xml', // the format iCal/Xml	
	folderMessageUids: '',
	
	email: '', // holds the account email
	name: '', // holds the account name

	dbFile: '', // the current sync database filen (a file with uid:size:date:localfile)

	doc: '', // this is the owning document
	itemList: '', // display the currently processed item with status
	curItemInList: '', // the current item in the list (for updating the status)
	curItemInListId: '',
	curItemInListStatus: '',
	curItemInListContent: '',

	forceServerCopy: false,
	forceLocalCopy: false,
	
	syncTasks: false,	// sync tasks if true, otherwise sync events
	
	isCal: function() {
		return true;
	},
	
	// return tasks/calendar for correct foldernames
	getType: function() {
		return (this.syncTasks == true?"tasks":"calendar");
	},

	init: function(config) {
		if (!isCalendarAvailable ())
			return;

		logMessage("Initialising calendar...", LOG_INFO);
			
		this.forceServerCopy = false;
		this.forceLocalCopy = false;
			
		// initialize the configuration
		try {
			var pref = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
			this.serverKey = pref.getCharPref("SyncKolab."+config+".IncomingServer");
			try {
				this.gConflictResolve = pref.getCharPref("SyncKolab."+config+".Resolve");
			}
			catch (e) 
			{
				// ignore
			}

			if (this.syncTasks == true)
			{
				// task config
				this.gSync = pref.getBoolPref("SyncKolab."+config+".syncTasks");
				if (this.gSync == false)
					return;
				this.folderPath = pref.getCharPref("SyncKolab."+config+".TaskFolderPath");
				this.gCalendarName = pref.getCharPref("SyncKolab."+config+".Tasks");
				this.format = pref.getCharPref("SyncKolab."+config+".TaskFormat");
				this.gSaveImap = pref.getBoolPref("SyncKolab."+config+".saveToTaskImap");
				// use defualt timeframe if not specified
				try {
					this.gSyncTimeFrame = parseInt(pref.getCharPref("SyncKolab."+config+".taskSyncTimeframe"));
				}
				catch (ignore) {
					logMessage("Sync Time frame is not specified", LOG_WARNING);
					// per default take all
					this.gSyncTimeFrame = -1;
				}
			}
			else
			{
				// calendar config
				this.gSync = pref.getBoolPref("SyncKolab."+config+".syncCalendar");
				if (this.gSync == false)
					return;
				this.folderPath = pref.getCharPref("SyncKolab."+config+".CalendarFolderPath");
				this.gCalendarName = pref.getCharPref("SyncKolab."+config+".Calendar");
				this.format = pref.getCharPref("SyncKolab."+config+".CalendarFormat");			
				this.gSaveImap = pref.getBoolPref("SyncKolab."+config+".saveToCalendarImap");
				// use defualt timeframe if not specified
				try
				{
					this.gSyncTimeFrame = parseInt(pref.getCharPref("SyncKolab."+config+".calSyncTimeframe"));
				}
				catch (ignore) {
					logMessage("Sync Time frame is not specified", LOG_WARNING);
					// per default take all
					this.gSyncTimeFrame = -1;
				}			 
			}			
		} catch(e) {
			logMessage("Error on reading config " + config + "\n" + e, LOG_ERROR);
			return;
		}

		// get the correct calendar instance
		var calendars = getSynckolabCalendars();
		for( var i = 0; i < calendars.length; i++ )
	    {
	    	if (calendars[i].name == this.gCalendarName || 
	    	fixNameToMiniCharset(calendars[i].name) == fixNameToMiniCharset(this.gCalendarName))
	    	{
	    		this.gCalendar = calendars[i];
	    		break;
	    	}
		}		
		
		
    	this.folderMessageUids = new Array(); // the checked uids - for better sync
    	
    	// get the sync db
    	
		if (this.syncTasks)
			this.dbFile = getHashDataBaseFile (config + ".task");
		else
			this.dbFile = getHashDataBaseFile (config + ".cal");
			
		this.gConfig = config;

		// card hashmap
		this.gCalDB = new SKMap();
		this.gCalDB.clear();

	},
	
	init2: function (nextFunc, sync)	{

		logMessage("Init2 for " + (this.syncTasks == true?"tasks":"calendar"), LOG_DEBUG);
		// get ALL the items from calendar - when done call nextfunc
		this.gEvents.nextFunc = nextFunc;
		this.gEvents.events = new Array();
		this.gEvents.sync = sync;
		
		// gCalendar might be invalid if no calendar is selected in the settings
		if (this.gCalendar) {
			if (this.syncTasks == true)
				this.gCalendar.getItems(this.gCalendar.ITEM_FILTER_TYPE_TODO | this.gCalendar.ITEM_FILTER_COMPLETED_ALL, 0, null, null, this.gEvents);
			else
				this.gCalendar.getItems(this.gCalendar.ITEM_FILTER_TYPE_EVENT, 0, null, null, this.gEvents);

			// fill the hashmap
			for (var i =0; i < this.gEvents.events.length; i++)
			{
				this.gCalDB.put(this.gEvents.events[i].id, this.gEvents.events[i]);
			}
				
			logMessage("Getting items for " + (this.syncTasks == true?"tasks":"calendar"), LOG_CAL + LOG_DEBUG);
			
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
			    logMessage("operation "+(this.syncTasks == true?"tasks":"calendar")+": status="+aStatus + " Op=" + aOperator + " Detail=" + aDetail, LOG_DEBUG + LOG_CAL);
			},
		onGetResult: function(aCalendar, aStatus, aItemType, aDetail, aCount, aItems) {
                logMessage("got results: " + aCount + " items", LOG_DEBUG + LOG_CAL);
                for (var i = 0; i < aCount; i++) {
                    this.events.push(aItems[i]);
                }
            }
	},

	/**
	 * Returns the number of cards in the adress book
	 */
	itemCount: function() {
		return this.gEvents.events.length;
	},
	
	/**
	 * parses the given content, if an update is required the 
	 * new message content is returned otherwise null
	 */	
	parseMessage: function(fileContent) {
		
		// create a new item in the itemList for display
		this.curItemInList = this.doc.createElement("listitem");
		this.curItemInListId = this.doc.createElement("listcell");
		this.curItemInListStatus = this.doc.createElement("listcell");
		this.curItemInListContent = this.doc.createElement("listcell");
		this.curItemInListId.setAttribute("label", strBundle.getString("unknown"));
		this.curItemInListStatus.setAttribute("label", strBundle.getString("parsing"));
		this.curItemInListContent.setAttribute("label", strBundle.getString("unknown"));
		

		this.curItemInList.appendChild(this.curItemInListId);
		this.curItemInList.appendChild(this.curItemInListStatus);
		this.curItemInList.appendChild(this.curItemInListContent);
		
		if (this.itemList != null)
		{
			this.itemList.appendChild(this.curItemInList);
			scrollToBottom();
		}
		
		
		// get the content in a nice format
		fileContent = stripMailHeader(fileContent);

		// this is an array of arrays that hold fieldname+fielddata of until-now-unknown fields
		var messageFields = new Array();		

		// parse the content
		var parsedEvent = message2Event(fileContent, messageFields, this.syncTasks);
		
		if (parsedEvent == null)
		{
			this.curItemInListId.setAttribute("label", strBundle.getString("unparseable"));
			return null;
		}

		// remember current uid
		this.gCurUID = parsedEvent.id;

		// update list item
		this.curItemInListId.setAttribute("label", parsedEvent.id);
		this.curItemInListStatus.setAttribute("label", strBundle.getString("checking"));
		var info = parsedEvent.title;
		if (!this.syncTasks)
		{
		    info += " (" + date2String(parsedEvent.startDate.jsDate) + ")";
		}
		this.curItemInListContent.setAttribute("label", info);
		
		// remember that we did this uid already
		this.folderMessageUids.push(parsedEvent.id);
		
		// ok lets see if we have this one already 
		var foundEvent = findEvent (this.gCalDB, parsedEvent.id);
	    logMessage("findevent returned :" + foundEvent + "(" + (foundEvent == null?'null':foundEvent.id) + ") for " + parsedEvent.id + " caching " + this.gCalDB.length() + " events", LOG_CAL + LOG_DEBUG);
				
		// get the dbfile from the local disk
		var idxEntry = getSyncDbFile(this.gConfig, this.getType(), parsedEvent.id);
		// ... and the field file
		var fEntry = getSyncFieldFile(this.gConfig, this.getType(), parsedEvent.id);

	    logMessage("idxEntry:" + idxEntry, LOG_CAL + LOG_DEBUG);
		
		// always add if the forceLocalCopy flag is set (happens when you change the configuration)
		if (foundEvent == null || this.forceLocalCopy)
		{
		    // a new event
		    logMessage("a new event, locally unknown:" + parsedEvent.id, LOG_CAL + LOG_DEBUG);
			if (!idxEntry.exists())
			{
				// use the original content to write the snyc file 
				// this makes it easier to compare later on and makes sure no info is 
				// lost/changed
				writeSyncDBFile (idxEntry, fileContent);
				
				// also write the extra fields in a file
				if (messageFields.length > 0)
					writeDataBase(fEntry, messageFields);
				
				this.curItemInListStatus.setAttribute("label", strBundle.getString("localAdd"));
				
    			// add the new event
    			this.gCalendar.addItem(parsedEvent, this.gEvents);
				// also add to the hash-database
				this.gCalDB.put(parsedEvent.id, parsedEvent);

				logMessage("added locally:" + parsedEvent.id, LOG_CAL + LOG_INFO);
			}
			else
			{
				// now this should be deleted, since it was in the db already
				logMessage("Delete event on server and in db: " + parsedEvent.id, LOG_CAL + LOG_INFO);
				this.curItemInListStatus.setAttribute("label", strBundle.getString("deleteOnServer"));

				// also remove the local db file since we deleted the contact
				if (idxEntry.exists())
					idxEntry.remove(false);

				try
				{				
					// delete extra file if we dont need it
					fEntry.remove(false);
				}
				catch (dele)
				{ // ignore this - if the file does not exist
				}
				
				return "DELETEME";
			}
		}
		else
		{
		    // event exists in local calendar
			logMessage("Event exists local: " + parsedEvent.id, LOG_CAL + LOG_DEBUG);
			
			var cEvent = message2Event(readSyncDBFile(idxEntry), null, this.syncTasks);
			
			var hasEntry = idxEntry.exists() && (cEvent != null);
			// make sure cEvent is not null, else the comparision will fail
			logMessage("Start comparing events....", LOG_CAL + LOG_DEBUG);
			var equal2parsed = hasEntry && equalsEvent(cEvent, parsedEvent, this.syncTasks, this.email);
			var equal2found = hasEntry && equalsEvent(cEvent, foundEvent, this.syncTasks, this.email);
			logMessage ("cEvent==parsedEvent: " + equal2parsed + "\ncEvent==foundEvent: " + equal2found,  LOG_CAL + LOG_DEBUG);
			

			if (hasEntry && !equal2parsed && !equal2found)
 			{
			    // changed locally and on server side
				logMessage("Changed on server and local: " + parsedEvent.id, LOG_CAL + LOG_DEBUG);

				//Holds the users response, must be an object so that we can pass by reference
				conflictResolution = new Object();
				conflictResolution.result = 0;
  				
				// check for conflict resolution settings 
				if (this.gConflictResolve = 'server')
					conflictResolution.result = 1;
				else
				if (this.gConflictResolve = 'client')												
					conflictResolution.result = 2;
				else
				// display a dialog asking for whats going on
				if (window.confirm("Changes were made on the server and local. Click ok to use the server version.\nClient Event: " + 
					foundEvent.title + "<"+ foundEvent.id + ">\nServer Event: " + parsedEvent.title + "<"+ parsedEvent.id + ">"))
					conflictResolution.result = 1;
				else
					conflictResolution.result = 2;
				
				if (conflictResolution.result == 1)
 				{
 					// take event from server
					logMessage("Take event from server: " + parsedEvent.id, LOG_CAL + LOG_INFO);
					
					writeSyncDBFile (idxEntry, fileContent);
	
					// also write the extra fields in a file
					if (messageFields.length > 0)
						writeDataBase(fEntry, messageFields);
	
					for (var i = 0; i < this.gEvents.events.length; i++)
					{
						if (this.gEvents.events[i].id == parsedEvent.id)
						{
							try {
							    // modify the item - catch exceptions due to triggered alarms
							    // because they will break the sync process
								this.gCalendar.modifyItem(parsedEvent, foundEvent, this.gEvents);
							} catch (e) {}
							
							//update list item
							this.curItemInListStatus.setAttribute("label", strBundle.getString("localUpdate"));
							
							return null;
						}
					}
				}
				else
				{
					// local change to server
					logMessage ("put event on server: " + parsedEvent.id, LOG_CAL + LOG_INFO);
					
                    var msg = null;
                    if (this.format == "Xml")
                    {
                        msg = event2kolabXmlMsg(foundEvent, this.email, this.syncTasks);
                    } 
                    else
                    {
						icssrv = Components.classes["@mozilla.org/calendar/ics-service;1"]
							.getService(Components.interfaces.calIICSService);
							
						if (this.syncTasks)
						{
							var calComp = icssrv.createIcalComponent("VTODO");
							
							calComp.version = "2.0";
							calComp.prodid = "-//Mozilla.org/NONSGML Mozilla Calendar V1.1//EN";
							calComp.addSubcomponent(foundEvent.icalComponent);
							
							msg = generateMail(cur.id, this.email, "iCal", "text/todo", 
								false, encodeQuoted(encode_utf8(calComp.serializeToICS())), null);
						}
						else
						{
							var calComp = icssrv.createIcalComponent("VCALENDAR");
							calComp.version = "2.0";
							calComp.prodid = "-//Mozilla.org/NONSGML Mozilla Calendar V1.1//EN";
							calComp.addSubcomponent(foundEvent.icalComponent);
							
							msg = generateMail(cur.id, this.email, "iCal", "text/calendar", 
								false, encodeQuoted(encode_utf8(calComp.serializeToICS())), null);
						}
					}

					writeSyncDBFile (idxEntry, stripMailHeader(msg));

					// update list item
					this.curItemInListStatus.setAttribute("label", strBundle.getString("updateOnServer"));
					
					// remember this message for update
					return msg;
				}
			}
			else
			{
				logMessage("changed only on one side (if at all):" + parsedEvent.id, LOG_CAL + LOG_DEBUG);
				
				// we got that already, see which is newer and update the message or the event
				// the sync database might be out-of-date, so we handle a non-existent entry as well
				if (!hasEntry || (!equal2parsed && equal2found))
				{
					logMessage("event on server changed: " + parsedEvent.id, LOG_CAL + LOG_INFO);
					
					writeSyncDBFile (idxEntry, fileContent);
	
					for (var i = 0; i < this.gEvents.events.length; i++)
					{
						if (this.gEvents.events[i].id == parsedEvent.id)
						{
							try {
							    // modify the item - catch exceptions due to triggered alarms
							    // because they will break the sync process
 								this.gCalendar.modifyItem(parsedEvent, foundEvent, this.gEvents);
							} catch (e) {}
	
							// update list item
							this.curItemInListStatus.setAttribute("label", strBundle.getString("localUpdate"));
							 
							return null;
						}
					}
				}
				else
				if (equal2parsed && !equal2found)
				{
					logMessage("event on client changed: " + parsedEvent.id, LOG_CAL + LOG_INFO);
	
					var msg = null;
					if (this.format == "Xml")
					{
						msg = event2kolabXmlMsg(foundEvent, this.email, this.syncTasks);
					} 
					else
					{
						icssrv = Components.classes["@mozilla.org/calendar/ics-service;1"]
							.getService(Components.interfaces.calIICSService);
						if (this.syncTasks)
						{
							var calComp = icssrv.createIcalComponent("VTODO");
							
							calComp.version = "2.0";
							calComp.prodid = "-//Mozilla.org/NONSGML Mozilla Calendar V1.1//EN";
							calComp.addSubcomponent(foundEvent.icalComponent);
							
							msg = generateMail(cur.id, this.email, "iCal", "text/todo", 
								false, encodeQuoted(encode_utf8(calComp.serializeToICS())), null);
						}
						else
						{
							var calComp = icssrv.createIcalComponent("VCALENDAR");
							calComp.version = "2.0";
							calComp.prodid = "-//Mozilla.org/NONSGML Mozilla Calendar V1.1//EN";
							calComp.addSubcomponent(foundEvent.icalComponent);
							
							msg = generateMail(parsedEvent.id, this.email, "iCal", "text/calendar", 
								false, encodeQuoted(encode_utf8(calComp.serializeToICS())), null);
						}
					}
					
					// update list item
					this.curItemInListStatus.setAttribute("label", getLangString(strBundle, "updateOnServer"));

					writeSyncDBFile (idxEntry, stripMailHeader(msg));
					
					// remember this message for update
					return msg;
				}
				
				logMessage("no change for event:" + parsedEvent.id, LOG_CAL + LOG_INFO);
				this.curItemInListStatus.setAttribute("label", getLangString(strBundle, "noChange"));
			}
		}
		return null;
	},
	
	
	initUpdate: function () {
		this.gCurEvent = 0;
		return true;
	},
	
	/**
	 * read the next todo/event and return the content if update needed
	 * @return null to skip this one completely
	 * @return "done" to specify that the sync is finished
	 */
	nextUpdate: function () {
		logMessage("next update...", LOG_CAL + LOG_DEBUG);
		// if there happens an exception, we are done
		if ((this.gEvents == null || this.gCurEvent >= this.gEvents.events.length))
		{
			logMessage("done update...", LOG_CAL + LOG_INFO);
			// we are done
			return "done";
		}
		logMessage("get event", LOG_CAL + LOG_DEBUG);
		
		if (this.gEvents != null && this.gCurEvent <= this.gEvents.events.length )
		{
			var cur = this.gEvents.events[this.gCurEvent++];
			var msg = null;
			var writeCur = true;
		    
			logMessage ("nextUpdate for "+ ((this.syncTasks==true)?"task":"event") +":" + cur.id, LOG_CAL + LOG_DEBUG);
			
			// check if we can skip this entry
			var endDate = (this.syncTasks==true)?(cur.dueDate?cur.dueDate.jsDate:null):cur.endDate.jsDate;
			if (endDate != null && this.gSyncTimeFrame > 0 && (endDate.getTime() + (this.gSyncTimeFrame * 86400000) < (new Date()).getTime()))
			{
					logMessage("skipping event because its too old: " + cur.id, LOG_CAL + LOG_INFO);
					return null;
			}
			
			logMessage("processing event", LOG_CAL + LOG_DEBUG);

			// check if we have this uid in the messages, skip it if it
			// has been processed already when reading the IMAP msgs
			var i;
			for (i = 0; i < this.folderMessageUids.length; i++)
			{
				if (cur.id == this.folderMessageUids[i])
				{
					logMessage("event is known from IMAP lookup: " + cur.id, LOG_CAL + LOG_INFO);
					writeCur = false;
					break;
				}
			}
			
			// ok we should have this event in our db but 
			// not on the imap acct. if we got this entry in our internal db
			// it has been deleted on the server and we dont know about it yet
			if (writeCur)
			{
				logMessage("nextUpdate decided to write event:" + cur.id, LOG_CAL + LOG_INFO);

				var cEntry = getSyncDbFile	(this.gConfig, this.getType(), cur.id);
				
				if (cEntry.exists() && !this.forceServerCopy)
				{
					// we have it in our database - don't write back to server but delete locally
					logMessage("nextUpdate assumes 'delete on server', better don't write event:" + cur.id, LOG_CAL + LOG_INFO);

					writeCur = false;
					this.gCalendar.deleteItem(cur, this.gEvents);
					
					// also remove the local db file since we deleted the contact on the server
					if (cEntry.exists)
						cEntry.remove(false);
					
					// create a new item in the itemList for display
					this.curItemInList = this.doc.createElement("listitem");
					this.curItemInListId = this.doc.createElement("listcell");
					this.curItemInListStatus = this.doc.createElement("listcell");
					this.curItemInListContent = this.doc.createElement("listcell");
					this.curItemInListId.setAttribute("label", cur.id);
					this.curItemInListStatus.setAttribute("label", strBundle.getString("localDelete"));
					this.curItemInListContent.setAttribute("label", cur.title);
					
			
					this.curItemInList.appendChild(this.curItemInListId);
					this.curItemInList.appendChild(this.curItemInListStatus);
					this.curItemInList.appendChild(this.curItemInListContent);
					
					if (this.itemList != null)
					{
						this.itemList.appendChild(this.curItemInList);
						scrollToBottom();
					}
					
				}
				else
				{
					// create a new item in the itemList for display
					this.curItemInList = this.doc.createElement("listitem");
					this.curItemInListId = this.doc.createElement("listcell");
					this.curItemInListStatus = this.doc.createElement("listcell");
					this.curItemInListContent = this.doc.createElement("listcell");
					this.curItemInListId.setAttribute("label", cur.id);
					this.curItemInListStatus.setAttribute("label", strBundle.getString("addToServer"));
					this.curItemInListContent.setAttribute("label", cur.title);
					
					this.curItemInList.appendChild(this.curItemInListId);
					this.curItemInList.appendChild(this.curItemInListStatus);
					this.curItemInList.appendChild(this.curItemInListContent);
					
					if (this.itemList != null)
					{
						this.itemList.appendChild(this.curItemInList);
						scrollToBottom();
					}
				}
			}

		
			if (writeCur)
			{
				logMessage("nextUpdate really writes event:" + cur.id, LOG_CAL + LOG_DEBUG);
				// and now really write the message
				
                var msg = null;
                if (this.format == "Xml")
                {
				    msg = event2kolabXmlMsg(cur, this.email, this.syncTasks);
                } 
                else
                {
    				icssrv = Components.classes["@mozilla.org/calendar/ics-service;1"]
    					.getService(Components.interfaces.calIICSService);
    					
					if (this.syncTasks)
					{
						var calComp = icssrv.createIcalComponent("VTODO");
						
						calComp.version = "2.0";
						calComp.prodid = "-//Mozilla.org/NONSGML Mozilla Calendar V1.1//EN";
						calComp.addSubcomponent(cur.icalComponent);
						
						msg = generateMail(cur.id, this.email, "iCal", "text/todo", 
							false, encodeQuoted(encode_utf8(calComp.serializeToICS())), null);
					}
					else
					{
	    				var calComp = icssrv.createIcalComponent("VCALENDAR");
	    				calComp.version = "2.0";
	    				calComp.prodid = "-//Mozilla.org/NONSGML Mozilla Calendar V1.1//EN";
	    				calComp.addSubcomponent(cur.icalComponent);
	    				
						msg = generateMail(cur.id, this.email, "iCal", "text/calendar", 
							false, encodeQuoted(encode_utf8(calComp.serializeToICS())), null);
					}					
				}
				
		    	logMessage("New event:\n" + msg, LOG_CAL + LOG_DEBUG);
				logMessage("nextUpdate puts event into db (2):" + cur.id, LOG_CAL + LOG_INFO);
				
				// add the new event into the db
				var cEntry = getSyncDbFile	(this.gConfig, this.getType(), cur.id);
				writeSyncDBFile (cEntry, stripMailHeader(msg));

			}
		}	
		
		// return the event's content
		return msg;
	},
	
	
	doneParsing: function ()
	{
//		writeDataBase (this.dbFile, this.db);
	}
}
