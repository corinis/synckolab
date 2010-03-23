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
 *   - -1=take all messages
 */

if(!com) var com={};
if(!com.synckolab) com.synckolab={};

com.synckolab.Calendar = {
	
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
		// package shortcuts:
		this.global = com.synckolab.global;
		this.tools = com.synckolab.tools;
		this.calTools = com.synckolab.calendarTools;

		if (!this.calTools.isCalendarAvailable ())
			return;
		
		this.tools.logMessage("Initialising calendar...", this.global.LOG_INFO);
			
		this.forceServerCopy = false;
		this.forceLocalCopy = false;
			
		// initialize the configuration
		try {
			var pref = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
			this.serverKey = pref.getCharPref("SyncKolab."+config+".IncomingServer");
			try {
				this.gConflictResolve = pref.getCharPref("SyncKolab."+config+".Resolve");
			}
			catch (ignore) 
			{	}

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
				// use default timeframe if not specified
				try {
					this.gSyncTimeFrame = pref.getIntPref("SyncKolab."+config+".taskSyncTimeframe");
				}
				catch (ignore) {
					this.tools.logMessage("Sync Time frame is not specified", this.global.LOG_WARNING);
					// per default take all
					this.gSyncTimeFrame = -1;
				}
			}
			else
			{
				// calendar config
				this.gSync = pref.getBoolPref("SyncKolab."+config+".syncCalendar");
				com.synckolab.tools.logMessage("Calendar sync? " + this.gSync, com.synckolab.global.LOG_DEBUG);

				if (this.gSync == false)
					return;
				this.folderPath = pref.getCharPref("SyncKolab."+config+".CalendarFolderPath");
				this.gCalendarName = pref.getCharPref("SyncKolab."+config+".Calendar");
				this.format = pref.getCharPref("SyncKolab."+config+".CalendarFormat");			
				this.gSaveImap = pref.getBoolPref("SyncKolab."+config+".saveToCalendarImap");
				// use default timeframe if not specified
				try
				{
					this.gSyncTimeFrame = pref.getIntPref("SyncKolab."+config+".calSyncTimeframe");
				}
				catch (ignore) {
					this.tools.logMessage("Sync Time frame is not specified", this.global.LOG_WARNING);
					// per default take all
					this.gSyncTimeFrame = -1;
				}			 
			}			
		} catch(e) {
			this.tools.logMessage("Error on reading config " + config + "\n" + e, this.global.LOG_ERROR);
			return;
		}

		// get the correct calendar instance
		var calendars = this.calTools.getCalendars();
		for( var i = 0; i < calendars.length; i++ )
		{
			if (calendars[i].name == this.gCalendarName || 
					com.synckolab.tools.text.fixNameToMiniCharset(calendars[i].name) == com.synckolab.tools.text.fixNameToMiniCharset(this.gCalendarName))
			{
				this.gCalendar = calendars[i];
				break;
			}
		}		

		
		this.folderMessageUids = new Array(); // the checked uids - for better sync
		
		// uid -> filename database - main functions needs to know the name
		if (this.syncTasks)
			this.dbFile = com.synckolab.tools.file.getHashDataBaseFile(config + ".task");
		else
			this.dbFile = com.synckolab.tools.file.getHashDataBaseFile(config + ".cal");
			
		this.gConfig = config;

		// remember all the items we already worked with
		this.gCalDB = new com.synckolab.hashMap();
	},
	
	init2: function (nextFunc, sync)	{

		this.tools.logMessage("Init2 for " + (this.syncTasks == true?"tasks":"calendar"), this.global.LOG_DEBUG);
		// get ALL the items from calendar - when done call nextfunc
		this.gEvents.nextFunc = nextFunc;
		this.gEvents.events = new Array();
		this.gEvents.sync = sync;
		this.gEvents.ready = false;
		
		// gCalendar might be invalid if no calendar is selected in the settings
		if (this.gCalendar) {
			if (this.syncTasks == true)
				this.gCalendar.getItems(this.gCalendar.ITEM_FILTER_TYPE_TODO | this.gCalendar.ITEM_FILTER_COMPLETED_ALL, 0, null, null, this.gEvents);
			else
				this.gCalendar.getItems(this.gCalendar.ITEM_FILTER_TYPE_EVENT, 0, null, null, this.gEvents);
		}
		else {
			alert("Please select a calender as sync target before trying to synchronize.");
			return false;
		}
	},
	// asynchronous function for getting the items
	gEvents: {
		nextFunc: '',
		events: new Array(),
		sync: '',
		ready: false,
		onOperationComplete: function(aCalendar, aStatus, aOperator, aId, aDetail) {
			com.synckolab.tools.logMessage("operation "+(this.syncTasks == true?"tasks":"calendar")+": status="+aStatus + " Op=" + aOperator + " Detail=" + aDetail, com.synckolab.global.LOG_DEBUG + com.synckolab.global.LOG_CAL);
			this.ready = true;
			},
		onGetResult: function(aCalendar, aStatus, aItemType, aDetail, aCount, aItems) {
				com.synckolab.tools.logMessage("got results: " + aCount + " items", com.synckolab.global.LOG_DEBUG + com.synckolab.global.LOG_CAL);
				for (var i = 0; i < aCount; i++) {
					this.events.push(aItems[i]);
				}
			}
	},
	/**
	 * a callback function for synckolab.js - synckolab will only start with the sync when this returns true
	 */
	dataReady: function() {
		// check if we got the data already
		if (this.gEvents.ready == false)
			return false;
		
		// make sure not to doublefill the map
		this.gCalDB.clear();
		
		// fill the hashmap
		for (var i =0; i < this.gEvents.events.length; i++)
		{
			this.gCalDB.put(this.gEvents.events[i].id, this.gEvents.events[i]);
		}
		this.tools.logMessage("Indexed " + this.gCalDB.length() + " Entries", this.global.LOG_CAL + this.global.LOG_DEBUG);
		
		this.tools.logMessage("Getting items for " + (this.syncTasks == true?"tasks":"calendar"), this.global.LOG_CAL + this.global.LOG_DEBUG);
		
		return true;
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
	 * The content is already parsed and stripped of any headers
	 */	
	parseMessage: function(fileContent) {
		
		// create a new item in the itemList for display
		this.curItemInList = this.doc.createElement("listitem");
		this.curItemInListId = this.doc.createElement("listcell");
		this.curItemInListStatus = this.doc.createElement("listcell");
		this.curItemInListContent = this.doc.createElement("listcell");
		this.curItemInListId.setAttribute("label", com.synckolab.global.strBundle.getString("unknown"));
		this.curItemInListStatus.setAttribute("label", com.synckolab.global.strBundle.getString("parsing"));
		this.curItemInListContent.setAttribute("label", com.synckolab.global.strBundle.getString("unknown"));
		

		this.curItemInList.appendChild(this.curItemInListId);
		this.curItemInList.appendChild(this.curItemInListStatus);
		this.curItemInList.appendChild(this.curItemInListContent);
		
		if (this.itemList != null)
		{
			this.itemList.appendChild(this.curItemInList);
			com.synckolab.tools.scrollToBottom();
		}
		
		// this is an array of arrays that hold fieldname+fielddata of until-now-unknown fields
		var messageFields = new com.synckolab.dataBase();

		// parse the content
		var parsedEvent = this.calTools.message2Event(fileContent, messageFields, this.syncTasks);
		
		if (parsedEvent == null)
		{
			this.curItemInListId.setAttribute("label", com.synckolab.global.strBundle.getString("unparseable"));
			return null;
		}
		// set the calendar
		parsedEvent.calendar = this.gCalendar;
		// remember current uid
		this.gCurUID = parsedEvent.id;

		// update list item
		this.curItemInListId.setAttribute("label", parsedEvent.id);
		this.curItemInListStatus.setAttribute("label", com.synckolab.global.strBundle.getString("checking"));
		var info = parsedEvent.title;

		if (!this.syncTasks && parsedEvent.startDate)
		{
			info += " (" + com.synckolab.tools.text.date2String(parsedEvent.startDate.jsDate) + ")";
		}
		this.curItemInListContent.setAttribute("label", info);
		
		// remember that we did this uid already
		this.folderMessageUids.push(parsedEvent.id);
		
		// ok lets see if we have this one already 
		var foundEvent = this.calTools.findEvent (this.gCalDB, parsedEvent.id);
		this.tools.logMessage("findevent returned :" + foundEvent + "(" + (foundEvent == null?'null':foundEvent.id) + ") for " + parsedEvent.id + " caching " + this.gCalDB.length() + " events", this.global.LOG_CAL + this.global.LOG_DEBUG);
				
		// get the dbfile from the local disk
		var idxEntry = com.synckolab.tools.file.getSyncDbFile(this.gConfig, this.getType(), parsedEvent.id);
		// ... and the field file
		var fEntry = com.synckolab.tools.file.getSyncFieldFile(this.gConfig, this.getType(), parsedEvent.id);

		this.tools.logMessage("idxEntry:" + idxEntry, this.global.LOG_CAL + this.global.LOG_DEBUG);
		
		// always add if the forceLocalCopy flag is set (happens when you change the configuration)
		if (foundEvent == null || this.forceLocalCopy)
		{
			// a new event
			this.tools.logMessage("a new event, locally unknown:" + parsedEvent.id, this.global.LOG_CAL + this.global.LOG_DEBUG);
			if (!idxEntry.exists() || !this.calTools.allowSyncEvent(foundEvent, parsedEvent, this))
			{
				// use the original content to write the snyc file 
				// this makes it easier to compare later on and makes sure no info is 
				// lost/changed
				com.synckolab.tools.writeSyncDBFile (idxEntry, fileContent);
				
				// also write the extra fields in a file
				if (messageFields.length() > 0)
					messageFields.write(fEntry);
				
				this.curItemInListStatus.setAttribute("label", com.synckolab.global.strBundle.getString("localAdd"));
				
				// update the parsedEvent timestamp so it wont display a window
				var lastAckTime = Components.classes["@mozilla.org/calendar/datetime;1"]
				                                     .createInstance(Components.interfaces.calIDateTime);
				lastAckTime.jsDate = new Date();
				parsedEvent.alarmLastAck = lastAckTime;
				
				// add the new event
				this.gCalendar.addItem(parsedEvent, this.gEvents);
				// also add to the hash-database
				this.gCalDB.put(parsedEvent.id, parsedEvent);

				this.tools.logMessage("added locally:" + parsedEvent.id, this.global.LOG_CAL + this.global.LOG_INFO);
			}
			else
			{
				// now this should be deleted, since it was in the db already
				this.tools.logMessage("Delete event on server and in db: " + parsedEvent.id, this.global.LOG_CAL + this.global.LOG_INFO);
				this.curItemInListStatus.setAttribute("label", com.synckolab.global.strBundle.getString("deleteOnServer"));

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
			this.tools.logMessage("Event exists local: " + parsedEvent.id, this.global.LOG_CAL + this.global.LOG_DEBUG);
			
			var cEvent = this.calTools.message2Event(com.synckolab.tools.readSyncDBFile(idxEntry), null, this.syncTasks);

			var hasEntry = idxEntry.exists() && (cEvent != null);
			// make sure cEvent is not null, else the comparision will fail
			this.tools.logMessage("Start comparing events....", this.global.LOG_CAL + this.global.LOG_DEBUG);
			var equal2parsed = hasEntry && this.calTools.equalsEvent(cEvent, parsedEvent, this.syncTasks, this.email);
			this.tools.logMessage ("cEvent==parsedEvent: " + equal2parsed,  this.global.LOG_CAL + this.global.LOG_DEBUG);
			var equal2found = hasEntry && this.calTools.equalsEvent(cEvent, foundEvent, this.syncTasks, this.email);
			this.tools.logMessage ("cEvent==foundEvent: " + equal2found,  this.global.LOG_CAL + this.global.LOG_DEBUG);
			
			if (hasEntry && !equal2parsed && !equal2found)
 			{
				// changed locally and on server side
				this.tools.logMessage("Changed on server and local: " + parsedEvent.id, this.global.LOG_CAL + this.global.LOG_DEBUG);

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
				if (window.confirm(strBundle.getFormattedString("calConflictUseServer", [foundEvent.title, foundEvent.id, parsedEvent.title, parsedEvent.id])))
					conflictResolution.result = 1;
				else
					conflictResolution.result = 2;
				
				if (conflictResolution.result == 1)
 				{
 					// take event from server
					this.tools.logMessage("Take event from server: " + parsedEvent.id, this.global.LOG_CAL + this.global.LOG_INFO);
					
					com.synckolab.tools.writeSyncDBFile (idxEntry, fileContent);
	
					// also write the extra fields in a file
					if (messageFields.length() > 0)
						messageFields.write(fEntry);
	
					for (var i = 0; i < this.gEvents.events.length; i++)
					{
						if (this.gEvents.events[i].id == parsedEvent.id)
						{
							// if we change a local event make sure to set alarmLastAck
							if (parsedEvent.alarmLastAck)
								parsedEvent.alarmLastAck = foundEvent.alarmLastAck.clone();
							
							try {
								// modify the item - catch exceptions due to triggered alarms
								// because they will break the sync process
								this.gCalendar.modifyItem(parsedEvent, foundEvent, this.gEvents);
							} catch (e) {
								this.tools.logMessage("gCalendar.modifyItem() failed: " + e, this.global.LOG_CAL + this.global.LOG_WARNING);
							}
							
							//update list item
							this.curItemInListStatus.setAttribute("label", com.synckolab.global.strBundle.getString("localUpdate"));
							
							return null;
						}
					}
				}
				else
				{
					// local change to server
					this.tools.logMessage ("put event on server: " + parsedEvent.id, this.global.LOG_CAL + this.global.LOG_INFO);
					
					// first check privacy info
					var foundEvent = this.calTools.checkEventOnDeletion(foundEvent, parsedEvent, this);
					if (!foundEvent || foundEvent == "DELETEME")
						return foundEvent;
					
					var msg = null;
					if (this.format == "Xml")
					{
						msg = this.calTools.event2kolabXmlMsg(foundEvent, this.email, this.syncTasks);
					} 
					else
					{
						icssrv = Components.classes["@mozilla.org/calendar/ics-service;1"]
							.getService(Components.interfaces.calIICSService);

						var calComp = icssrv.createIcalComponent("VCALENDAR");
						
						calComp.version = "2.0";
						calComp.prodid = "-//Mozilla.org/NONSGML Mozilla Calendar V1.1//EN";
						calComp.addSubcomponent(foundEvent.icalComponent);
						
						if (this.syncTasks)
						{
							
							msg = com.synckolab.tools.generateMail(cur.id, this.email, "iCal", "text/todo", 
								false, com.synckolab.tools.text.quoted.encode(calComp.serializeToICS()), null);
						}
						else
						{
							
							msg = com.synckolab.tools.generateMail(cur.id, this.email, "iCal", "text/calendar", 
								false, com.synckolab.tools.text.quoted.encode(calComp.serializeToICS()), null);
						}
					}

					com.synckolab.tools.writeSyncDBFile (idxEntry, com.synckolab.tools.stripMailHeader(msg));

					// update list item
					this.curItemInListStatus.setAttribute("label", com.synckolab.global.strBundle.getString("updateOnServer"));
					
					// remember this message for update
					return msg;
				}
			}
			else
			{
				this.tools.logMessage("changed only on one side (if at all):" + parsedEvent.id, this.global.LOG_CAL + this.global.LOG_DEBUG);
				
				// we got that already, see which is newer and update the message or the event
				// the sync database might be out-of-date, so we handle a non-existent entry as well
				if (!hasEntry || (!equal2parsed && equal2found))
				{
					this.tools.logMessage("event on server changed: " + parsedEvent.id, this.global.LOG_CAL + this.global.LOG_INFO);
					
					com.synckolab.tools.writeSyncDBFile (idxEntry, fileContent);
	
					for (var i = 0; i < this.gEvents.events.length; i++)
					{
						if (this.gEvents.events[i].id == parsedEvent.id)
						{
							// if we change a local event make sure to set alarmLastAck
							if (parsedEvent.alarmLastAck)
								parsedEvent.alarmLastAck = foundEvent.alarmLastAck.clone();
							
							try {
								// modify the item - catch exceptions due to triggered alarms
								// because they will break the sync process								
 								this.gCalendar.modifyItem(parsedEvent, foundEvent, this.gEvents);
							} catch (e) {
								this.tools.logMessage("gCalendar.modifyItem() failed: " + e, this.global.LOG_CAL + this.global.LOG_WARNING);
							}
	
							// update list item
							this.curItemInListStatus.setAttribute("label", com.synckolab.global.strBundle.getString("localUpdate"));
							 
							return null;
						}
					}
				}
				else
				if (equal2parsed && !equal2found)
				{
					this.tools.logMessage("event on client changed: " + parsedEvent.id, this.global.LOG_CAL + this.global.LOG_INFO);
	
					var foundEvent = this.calTools.checkEventOnDeletion(foundEvent, parsedEvent, this);
					if (!foundEvent || foundEvent == "DELETEME")
						return foundEvent;
					
					var msg = null;
					if (this.format == "Xml")
					{
						msg = this.calTools.event2kolabXmlMsg(foundEvent, this.email, this.syncTasks);
					} 
					else
					{
						icssrv = Components.classes["@mozilla.org/calendar/ics-service;1"]
							.getService(Components.interfaces.calIICSService);

						var calComp = icssrv.createIcalComponent("VCALENDAR");
						calComp.version = "2.0";
						calComp.prodid = "-//Mozilla.org/NONSGML Mozilla Calendar V1.1//EN";
						calComp.addSubcomponent(foundEvent.icalComponent);
						
						if (this.syncTasks)
						{
							msg = com.synckolab.tools.generateMail(parsedEvent.id, this.email, "iCal", "text/todo", 
								false, com.synckolab.tools.text.quoted.encode(calComp.serializeToICS()), null);
						}
						else
						{
							msg = com.synckolab.tools.generateMail(parsedEvent.id, this.email, "iCal", "text/calendar", 
								false, com.synckolab.tools.text.quoted.encode(calComp.serializeToICS()), null);
						}
					}
					
					// update list item
					this.curItemInListStatus.setAttribute("label", com.synckolab.global.strBundle.getString("updateOnServer"));

					com.synckolab.tools.writeSyncDBFile (idxEntry, com.synckolab.tools.stripMailHeader(msg));
					
					// remember this message for update
					return msg;
				}
				
				this.tools.logMessage("no change for event:" + parsedEvent.id, this.global.LOG_CAL + this.global.LOG_INFO);
				this.curItemInListStatus.setAttribute("label", com.synckolab.global.strBundle.getString("noChange"));
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
		this.tools.logMessage("next update...", this.global.LOG_CAL + this.global.LOG_DEBUG);
		// if there happens an exception, we are done
		if ((this.gEvents == null || this.gCurEvent >= this.gEvents.events.length))
		{
			this.tools.logMessage("done update...", this.global.LOG_CAL + this.global.LOG_INFO);
			// we are done
			return "done";
		}
		this.tools.logMessage("get event ( "+this.gCurEvent+" of "+this.gEvents.events.length+")", this.global.LOG_CAL + this.global.LOG_DEBUG);
		
		if (this.gEvents != null && this.gCurEvent <= this.gEvents.events.length )
		{
			var cur = this.gEvents.events[this.gCurEvent++];
			var msg = null;
			var writeCur = true;
		
			this.tools.logMessage ("nextUpdate for "+ ((this.syncTasks==true)?"task":"event") +":" + cur.id, this.global.LOG_CAL + this.global.LOG_DEBUG);

			// check if we can skip this entry	(make sure we got a start and enddate.. otherwise it will fail)
			var endDate = this.calTools.getEndDate(cur, this.syncTasks);		
				
			if (endDate != null && this.gSyncTimeFrame > 0 && (endDate.getTime() + (this.gSyncTimeFrame * 86400000) < (new Date()).getTime()))
			{
					this.tools.logMessage("skipping event because its too old: " + cur.id, this.global.LOG_CAL + this.global.LOG_INFO);
					return null;
			}
			
			/* skip if event is PRIVATE */
			if (this.calTools.isPrivateEvent(cur)) {
				this.tools.logMessage("skipping event because it is marked as PRIVATE: " + cur.id, this.global.LOG_CAL + this.global.LOG_INFO);
				return null;
			}
			
			this.tools.logMessage("processing event", this.global.LOG_CAL + this.global.LOG_DEBUG);

			// check if we have this uid in the messages, skip it if it
			// has been processed already when reading the IMAP msgs
			var i;
			for (i = 0; i < this.folderMessageUids.length; i++)
			{
				if (cur.id == this.folderMessageUids[i])
				{
					this.tools.logMessage("event is known from IMAP lookup: " + cur.id, this.global.LOG_CAL + this.global.LOG_INFO);
					writeCur = false;
					break;
				}
			}
			
			// ok we should have this event in our db but 
			// not on the imap acct. if we got this entry in our internal db
			// it has been deleted on the server and we dont know about it yet
			if (writeCur)
			{
				this.tools.logMessage("nextUpdate decided to write event:" + cur.id, this.global.LOG_CAL + this.global.LOG_INFO);

				var cEntry = com.synckolab.tools.file.getSyncDbFile(this.gConfig, this.getType(), cur.id);
				
				if (cEntry.exists() && !this.forceServerCopy)
				{
					// we have it in our database - don't write back to server but delete locally
					this.tools.logMessage("nextUpdate assumes 'delete on server', better don't write event:" + cur.id, this.global.LOG_CAL + this.global.LOG_INFO);

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
					this.curItemInListStatus.setAttribute("label", com.synckolab.global.strBundle.getString("localDelete"));
					this.curItemInListContent.setAttribute("label", cur.title);
					
			
					this.curItemInList.appendChild(this.curItemInListId);
					this.curItemInList.appendChild(this.curItemInListStatus);
					this.curItemInList.appendChild(this.curItemInListContent);
					
					if (this.itemList != null)
					{
						this.itemList.appendChild(this.curItemInList);
						com.synckolab.tools.scrollToBottom();
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
					this.curItemInListStatus.setAttribute("label", com.synckolab.global.strBundle.getString("addToServer"));
					this.curItemInListContent.setAttribute("label", cur.title);
					
					this.curItemInList.appendChild(this.curItemInListId);
					this.curItemInList.appendChild(this.curItemInListStatus);
					this.curItemInList.appendChild(this.curItemInListContent);
					
					if (this.itemList != null)
					{
						this.itemList.appendChild(this.curItemInList);
						com.synckolab.tools.scrollToBottom();
					}
				}
			}

		
			if (writeCur)
			{
				this.tools.logMessage("nextUpdate really writes event:" + cur.id, this.global.LOG_CAL + this.global.LOG_DEBUG);
				// and now really write the message
		
				var msg = null;
				var clonedEvent = cur;
				clonedEvent = this.calTools.modifyEventOnExport(cur, this);

				if (this.format == "Xml")
				{
					msg = this.calTools.event2kolabXmlMsg(clonedEvent, this.email, this.syncTasks);
				} 
				else
				{
					icssrv = Components.classes["@mozilla.org/calendar/ics-service;1"]
						.getService(Components.interfaces.calIICSService);

					var calComp = icssrv.createIcalComponent("VCALENDAR");
					calComp.version = "2.0";
					calComp.prodid = "-//Mozilla.org/NONSGML Mozilla Calendar V1.1//EN";
					calComp.addSubcomponent(clonedEvent.icalComponent);

					if (this.syncTasks)
					{
						msg = com.synckolab.tools.generateMail(cur.id, this.email, "iCal", "text/todo", 
							false, com.synckolab.tools.text.utf8.encode(com.synckolab.tools.text.quoted.encode(calComp.serializeToICS())), null);
					}
					else
					{

						msg = com.synckolab.tools.generateMail(cur.id, this.email, "iCal", "text/calendar", 
							false, com.synckolab.tools.text.utf8.encode(com.synckolab.tools.text.quoted.encode(calComp.serializeToICS())), null);
					}					
				}
				
				this.tools.logMessage("New event:\n" + msg, this.global.LOG_CAL + this.global.LOG_DEBUG);
				
				// add the new event into the db
				var cEntry = com.synckolab.tools.file.getSyncDbFile(this.gConfig, this.getType(), cur.id);
				com.synckolab.tools.writeSyncDBFile(cEntry, com.synckolab.tools.stripMailHeader(msg));

			}
		}	
		
		// return the event's content
		return msg;
	},
	
	
	doneParsing: function ()
	{
		// done
	}
};
