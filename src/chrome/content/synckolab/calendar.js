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
"use strict";

if (!com)
	var com = {};
if (!com.synckolab)
	com.synckolab = {};

com.synckolab.Calendar = {
	gConflictResolve : "ask", // conflict resolution (default: ask what to do)

	folderPath : '', // String - the path for the entries
	serverKey : '', // the incoming server
	gSaveImap : true, // write back to folder
	gSync : true, // sync this configuration	
	gConfig : null, // remember the configuration name
	gCurUID : '', // save the last checked uid - for external use

	gCurEvent : 0,
	gSyncTimeFrame : 180, // time frame to take into account (all older than X days will be ignored completely) -1 just take all
	gCalendarName : '', // the calendar name
	gCalendar : '', // the calendar
	gCalendarEvents : '', // all events from the calendar
	gCalDB : '', // hashmap for all the events (faster than iterating on big numbers)
	format : 'Xml', // the format iCal/Xml	
	folderMessageUids : '',

	dbFile : '', // the current sync database filen (a file with uid:size:date:localfile)

	doc : '', // this is the owning document
	itemList : '', // display the currently processed item with status
	curItemInList : '', // the current item in the list (for updating the status)
	curItemInListId : '',
	curItemInListStatus : '',
	curItemInListContent : '',

	forceServerCopy : false,
	forceLocalCopy : false,

	isCal : function () {
		return true;
	},

	// return tasks/calendar for correct foldernames
	getType : function () {
		return (this.gConfig.task === true ? "tasks" : "calendar");
	},

	/**
	 * add the address book specific configuration to the config object
	 * @param config the config object (name is already prefilled)
	 * @param pref a nsIPrefBranch for reading of the configuration
	 * @param task set to true to read the task configuration 
	 */
	readConfig: function(config, pref) {
		if (!com.synckolab.calendarTools.isCalendarAvailable()) {
			return;
		}
		com.synckolab.tools.logMessage("Reading Configuration:" + config.name, com.synckolab.global.LOG_WARNING);
		config.forceServerCopy = false;
		config.forceLocalCopy = false;

		if (config.task === true) {
			// task config
			try {
				config.sync = pref.getBoolPref("SyncKolab." + config.name + ".syncTasks");
			} catch (ex) {
				return;
			}
			
			if(!config.sync)
			{
				return;
			}

			config.folderPath = pref.getCharPref("SyncKolab." + config.name + ".TaskFolderPath");
			config.calendarName = pref.getCharPref("SyncKolab." + config.name + ".Tasks");
			
			config.format = pref.getCharPref("SyncKolab." + config.name + ".TaskFormat");
			config.saveImap = pref.getBoolPref("SyncKolab." + config.name + ".saveToTaskImap");
			// use default timeframe if not specified
			try {
				config.timeFrame = pref.getIntPref("SyncKolab." + config.name + ".taskSyncTimeframe");
			} catch (tfignore) {
				// per default take all
				this.tools.logMessage("Sync Time frame is not specified. Syncing all.", this.global.LOG_WARNING);
				config.timeFrame = -1;
			}
			// uid -> filename database - main functions needs to know the name
			config.dbFile = com.synckolab.tools.file.getHashDataBaseFile(config + ".task");
		} else {
			// calendar config
			try {
				config.sync = pref.getBoolPref("SyncKolab." + config.name + ".syncCalendar");
			} catch (gcalex) {
				return;
			}

			if(!config.sync)
			{
				return;
			}

			config.folderPath = pref.getCharPref("SyncKolab." + config.name + ".CalendarFolderPath");
			config.calendarName = pref.getCharPref("SyncKolab." + config.name + ".Calendar");
			config.format = pref.getCharPref("SyncKolab." + config.name + ".CalendarFormat");
			config.saveImap = pref.getBoolPref("SyncKolab." + config.name + ".saveToCalendarImap");
			
			// use default timeframe if not specified
			try {
				config.syncTimeFrame = pref.getIntPref("SyncKolab." + config.name + ".calSyncTimeframe");
			} catch (ignore2) {
				// per default take all
				this.tools.logMessage("Sync Time frame is not specified. Syncing all.", this.global.LOG_WARNING);
				config.syncTimeFrame = -1;
			}
			// uid -> filename database - main functions needs to know the name
			config.dbFile = com.synckolab.tools.file.getHashDataBaseFile(config + ".cal");
		}
	},
	
	init : function (config) {
		// package shortcuts:
		this.global = com.synckolab.global;
		this.tools = com.synckolab.tools;
		this.calTools = com.synckolab.calendarTools;

		this.gConfig = config;

		this.tools.logMessage("Initialising calendar config: " + this.gConfig.name, this.global.LOG_INFO);

		this.forceServerCopy = false;
		this.forceLocalCopy = false;

		// get the correct calendar instance
		var calendars = this.calTools.getCalendars();
		for ( var i = 0; i < calendars.length; i++) {
			if (calendars[i].name === config.calendarName || com.synckolab.tools.text.fixNameToMiniCharset(calendars[i].name) === com.synckolab.tools.text.fixNameToMiniCharset(config.calendarName)) {
				this.gCalendar = calendars[i];
				break;
			}
		}

		this.folderMessageUids = []; // the checked uids - for better sync

		// remember all the items we already worked with
		this.gCalDB = new com.synckolab.hashMap();
	},

	init2 : function (nextFunc, sync) {

		this.tools.logMessage("Init2 for " + (this.gConfig.task === true ? "tasks" : "calendar"), this.global.LOG_DEBUG);
		// get ALL the items from calendar - when done call nextfunc
		this.gEvents.nextFunc = nextFunc;
		this.gEvents.events = [];
		this.gEvents.sync = sync;
		this.gEvents.ready = false;

		// gCalendar might be invalid if no calendar is selected in the settings
		if (this.gCalendar) {
			if (this.gConfig.task === true) {
				this.gCalendar.getItems(this.gCalendar.ITEM_FILTER_TYPE_TODO | this.gCalendar.ITEM_FILTER_COMPLETED_ALL, 0, null, null, this.gEvents);
			} else {
				this.gCalendar.getItems(this.gCalendar.ITEM_FILTER_TYPE_EVENT, 0, null, null, this.gEvents);
			}
		} else {
			alert("Please select a calender as sync target before trying to synchronize.");
			return false;
		}
	},
	// asynchronous function for getting the items
	gEvents : {
		nextFunc : '',
		events : [],
		sync : '',
		ready : false,
		onOperationComplete : function (aCalendar, aStatus, aOperator, aId, aDetail) {
			com.synckolab.tools.logMessage("operation " + (com.synckolab.Calendar.gConfig.task === true ? "tasks" : "calendar") + ": status=" + aStatus + " Op=" + aOperator + " Detail=" + aDetail, com.synckolab.global.LOG_DEBUG + com.synckolab.global.LOG_CAL);
			if (aStatus === 2152333316) {
				com.synckolab.tools.logMessage((com.synckolab.Calendar.gConfig.task === true ? "tasks" : "calendar") + ": duplicate id - for additem", com.synckolab.global.LOG_INFO + com.synckolab.global.LOG_CAL);
			}
			this.ready = true;
		},
		onGetResult : function (aCalendar, aStatus, aItemType, aDetail, aCount, aItems) {
			com.synckolab.tools.logMessage("got results: " + aCount + " items", com.synckolab.global.LOG_DEBUG + com.synckolab.global.LOG_CAL);
			for ( var i = 0; i < aCount; i++) {
				this.events.push(aItems[i]);
			}
		}
	},
	/**
	 * a callback function for synckolab.js - synckolab will only start with the sync when this returns true
	 */
	dataReady : function () {
		// check if we got the data already
		if (this.gEvents.ready === false) {
			return false;
		}

		// make sure not to doublefill the map
		this.gCalDB.clear();

		// fill the hashmap
		for ( var i = 0; i < this.gEvents.events.length; i++) {
			this.gCalDB.put(this.gEvents.events[i].id, this.gEvents.events[i]);
		}
		this.tools.logMessage("Indexed " + this.gCalDB.length() + " Entries", this.global.LOG_CAL + this.global.LOG_DEBUG);

		this.tools.logMessage("Getting items for " + (this.gConfig.task === true ? "tasks" : "calendar"), this.global.LOG_CAL + this.global.LOG_DEBUG);

		return true;
	},
	/**
	 * Returns the number of cards in the adress book
	 */
	itemCount : function () {
		return this.gEvents.events.length;
	},

	/**
	 * parses the given content, if an update is required the 
	 * new message content is returned otherwise null
	 * The content is already parsed and stripped of any headers
	 */
	parseMessage : function (fileContent) {

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

		if (this.itemList) {
			this.itemList.appendChild(this.curItemInList);
			com.synckolab.tools.scrollToBottom(this.itemList);
		}

		// this is an array of arrays that hold fieldname+fielddata of until-now-unknown fields
		var messageFields = new com.synckolab.dataBase();

		// parse the content
		var parsedEvent = this.calTools.message2Event(fileContent, messageFields, this.gConfig.task);
		this.tools.logMessage("parsed event (message2Event)", this.global.LOG_CAL + this.global.LOG_DEBUG);

		if (parsedEvent === null) {
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
		var i;
		var msg;
		var foundEvent;
		var calComp;

		if (!this.gConfig.task && parsedEvent.startDate) {
			info += " (" + com.synckolab.tools.text.date2String(parsedEvent.startDate.jsDate) + ")";
		}
		this.curItemInListContent.setAttribute("label", info);

		// check for duplicate events
		for (i = 0; i < this.folderMessageUids.length; i++) {
			if (parsedEvent.id === this.folderMessageUids[i]) {
				this.tools.logMessage("event is is already parsed.. deleting duplicate: " + parsedEvent.id, this.global.LOG_CAL + this.global.LOG_INFO);
				this.curItemInListStatus.setAttribute("label", com.synckolab.global.strBundle.getString("deleteOnServer"));
				return "DELETEME";
			}
		}

		// remember that we did this uid already
		this.folderMessageUids.push(parsedEvent.id);

		// ok lets see if we have this one already 
		foundEvent = this.calTools.findEvent(this.gCalDB, parsedEvent.id);
		this.tools.logMessage("findevent returned :" + foundEvent + "(" + (foundEvent === null ? 'null' : foundEvent.id) + ") for " + parsedEvent.id + " caching " + this.gCalDB.length() + " events", this.global.LOG_CAL + this.global.LOG_DEBUG);

		// get the dbfile from the local disk
		var idxEntry = com.synckolab.tools.file.getSyncDbFile(this.gConfig, this.getType(), parsedEvent.id);
		// ... and the field file
		var fEntry = com.synckolab.tools.file.getSyncFieldFile(this.gConfig, this.getType(), parsedEvent.id);
		
		this.tools.logMessage("idxEntry:" + idxEntry, this.global.LOG_CAL + this.global.LOG_DEBUG);

		// always add if the forceLocalCopy flag is set (happens when you change the configuration)
		if (foundEvent === null || this.forceLocalCopy) {
			// a new event
			this.tools.logMessage("a new event, locally unknown:" + parsedEvent.id, this.global.LOG_CAL + this.global.LOG_DEBUG);
			if (!idxEntry.exists() || !this.calTools.allowSyncEvent(foundEvent, parsedEvent, this)) {
				// use the original content to write the snyc file 
				// this makes it easier to compare later on and makes sure no info is 
				// lost/changed
				com.synckolab.tools.writeSyncDBFile(idxEntry, fileContent);

				// also write the extra fields in a file
				if (messageFields.length() > 0) {
					messageFields.write(fEntry);
				}

				this.curItemInListStatus.setAttribute("label", com.synckolab.global.strBundle.getString("localAdd"));

				// update the parsedEvent timestamp so it wont display a window
				var lastAckTime = Components.classes["@mozilla.org/calendar/datetime;1"].createInstance(Components.interfaces.calIDateTime);
				lastAckTime.jsDate = new Date();
				parsedEvent.alarmLastAck = lastAckTime;

				// if we dont have a timezone - set it
				/*
				if (parsedEvent.timezone === null || parsedEvent.timezone.icalComponent === null) {
					parsedEvent.timezone = lastAckTime.timezone;
				}
				*/

				// add the new event
				try {
					this.gCalendar.addItem(parsedEvent, this.gEvents);
					// also add to the hash-database
					this.gCalDB.put(parsedEvent.id, parsedEvent);
					this.tools.logMessage("added locally:" + parsedEvent.id, this.global.LOG_CAL + this.global.LOG_INFO);
				} catch (addEx) {
					this.tools.logMessage("unable to add item:" + parsedEvent.id + "\n" + addEx, this.global.LOG_CAL + this.global.LOG_ERR);
					this.curItemInListStatus.setAttribute("label", "ERROR");
				}
			} else {
				// now this should be deleted, since it was in the db already
				this.tools.logMessage("Delete event on server and in db: " + parsedEvent.id, this.global.LOG_CAL + this.global.LOG_INFO);
				this.curItemInListStatus.setAttribute("label", com.synckolab.global.strBundle.getString("deleteOnServer"));

				// also remove the local db file since we deleted the contact
				if (idxEntry.exists()) {
					idxEntry.remove(false);
				}

				try {
					// delete extra file if we dont need it
					fEntry.remove(false);
				} catch (dele) { // ignore this - if the file does not exist
				}

				return "DELETEME";
			}
		} else {
			// event exists in local calendar
			this.tools.logMessage("Event exists local: " + parsedEvent.id, this.global.LOG_CAL + this.global.LOG_DEBUG);

			var cEvent = this.calTools.message2Event(com.synckolab.tools.readSyncDBFile(idxEntry), null, this.gConfig.task);

			var hasEntry = idxEntry.exists() && (cEvent);
			// make sure cEvent is not null, else the comparision will fail
			this.tools.logMessage("Start comparing events....", this.global.LOG_CAL + this.global.LOG_DEBUG);
			var equal2parsed = hasEntry && this.calTools.equalsEvent(cEvent, parsedEvent, this.gConfig.task, this.gConfig.email);
			this.tools.logMessage("cEvent==parsedEvent: " + equal2parsed, this.global.LOG_CAL + this.global.LOG_DEBUG);
			var equal2found = hasEntry && this.calTools.equalsEvent(cEvent, foundEvent, this.gConfig.task, this.gConfig.email);
			this.tools.logMessage("cEvent==foundEvent: " + equal2found, this.global.LOG_CAL + this.global.LOG_DEBUG);

			if (hasEntry && !equal2parsed && !equal2found) {
				// changed locally and on server side
				this.tools.logMessage("Changed on server and local: " + parsedEvent.id, this.global.LOG_CAL + this.global.LOG_DEBUG);

				//Holds the users response, must be an object so that we can pass by reference
				var conflictResolution = {};
				conflictResolution.result = 0;

				// check for conflict resolution settings 
				if (this.gConflictResolve === 'server') {
					conflictResolution.result = 1;
				} else if (this.gConflictResolve === 'client') {
					conflictResolution.result = 2;
				} else
				// display a dialog asking for whats going on
				if (window.confirm(com.synckolab.global.strBundle.getFormattedString("calConflictUseServer", [ foundEvent.title, foundEvent.id, parsedEvent.title, parsedEvent.id ]))) {
					conflictResolution.result = 1;
				} else {
					conflictResolution.result = 2;
				}
				
				if (conflictResolution.result === 1) {
					// take event from server
					this.tools.logMessage("Take event from server: " + parsedEvent.id, this.global.LOG_CAL + this.global.LOG_INFO);

					com.synckolab.tools.writeSyncDBFile(idxEntry, fileContent);

					// also write the extra fields in a file
					if (messageFields.length() > 0) {
						messageFields.write(fEntry);
					}

					for (i = 0; i < this.gEvents.events.length; i++) {
						if (this.gEvents.events[i].id === parsedEvent.id) {
							// if we change a local event make sure to set alarmLastAck
							if (parsedEvent.alarmLastAck) {
								parsedEvent.alarmLastAck = foundEvent.alarmLastAck.clone();
							}

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
				} else {
					// local change to server
					this.tools.logMessage("put event on server: " + parsedEvent.id, this.global.LOG_CAL + this.global.LOG_INFO);

					// first check privacy info
					foundEvent = this.calTools.checkEventOnDeletion(foundEvent, parsedEvent, this);
					if (!foundEvent || foundEvent === "DELETEME") {
						return foundEvent;
					}

					msg = null;
					if (this.gConfig.format === "Xml") {
						msg = this.calTools.event2kolabXmlMsg(foundEvent, this.gConfig.email, this.gConfig.task);
					} else {
						calComp = Components.classes["@mozilla.org/calendar/ics-service;1"].getService(Components.interfaces.calIICSService).createIcalComponent("VCALENDAR");
						calComp.version = "2.0";
						calComp.prodid = "-//Mozilla.org/NONSGML Mozilla Calendar V1.1//EN";
						calComp.addSubcomponent(foundEvent.icalComponent);

						if (this.gConfig.task) {
							msg = com.synckolab.tools.generateMail(parsedEvent.id, this.gConfig.email, "iCal", "text/todo", false, com.synckolab.tools.text.utf8.encode(calComp.serializeToICS()), null);
						} else {
							msg = com.synckolab.tools.generateMail(parsedEvent.id, this.gConfig.email, "iCal", "text/calendar", false, com.synckolab.tools.text.utf8.encode(calComp.serializeToICS()), null);
						}
					}

					com.synckolab.tools.writeSyncDBFile(idxEntry, com.synckolab.tools.stripMailHeader(msg));

					// update list item
					this.curItemInListStatus.setAttribute("label", com.synckolab.global.strBundle.getString("updateOnServer"));

					// remember this message for update
					return msg;
				}
			} else {
				this.tools.logMessage("changed only on one side (if at all):" + parsedEvent.id, this.global.LOG_CAL + this.global.LOG_DEBUG);

				// we got that already, see which is newer and update the message or the event
				// the sync database might be out-of-date, so we handle a non-existent entry as well
				if (!hasEntry || (!equal2parsed && equal2found)) {
					this.tools.logMessage("event on server changed: " + parsedEvent.id, this.global.LOG_CAL + this.global.LOG_INFO);

					com.synckolab.tools.writeSyncDBFile(idxEntry, fileContent);

					for (i = 0; i < this.gEvents.events.length; i++) {
						if (this.gEvents.events[i].id === parsedEvent.id) {
							// if we change a local event make sure to set alarmLastAck
							if (parsedEvent.alarmLastAck) {
								parsedEvent.alarmLastAck = foundEvent.alarmLastAck.clone();
							}

							try {
								// modify the item - catch exceptions due to triggered alarms
								// because they will break the sync process								
								this.gCalendar.modifyItem(parsedEvent, foundEvent, this.gEvents);
							} catch (e1) {
								this.tools.logMessage("gCalendar.modifyItem() failed: " + e1, this.global.LOG_CAL + this.global.LOG_WARNING);
							}

							// update list item
							this.curItemInListStatus.setAttribute("label", com.synckolab.global.strBundle.getString("localUpdate"));

							return null;
						}
					}
				} else if (equal2parsed && !equal2found) {
					this.tools.logMessage("event on client changed: " + parsedEvent.id, this.global.LOG_CAL + this.global.LOG_INFO);

					foundEvent = this.calTools.checkEventOnDeletion(foundEvent, parsedEvent, this);
					if (!foundEvent || foundEvent === "DELETEME") {
						return foundEvent;
					}

					msg = null;
					if (this.gConfig.format === "Xml") {
						msg = this.calTools.event2kolabXmlMsg(foundEvent, this.gConfig.email, this.gConfig.task);
					} else {
						calComp = Components.classes["@mozilla.org/calendar/ics-service;1"].getService(Components.interfaces.calIICSService).createIcalComponent("VCALENDAR");
						calComp.version = "2.0";
						calComp.prodid = "-//Mozilla.org/NONSGML Mozilla Calendar V1.1//EN";
						calComp.addSubcomponent(foundEvent.icalComponent);
						
						if (this.gConfig.task) {
							msg = com.synckolab.tools.generateMail(parsedEvent.id, this.gConfig.email, "iCal", "text/todo", false, com.synckolab.tools.text.utf8.encode(calComp.serializeToICS()), null);
						} else {
							msg = com.synckolab.tools.generateMail(parsedEvent.id, this.gConfig.email, "iCal", "text/calendar", false, com.synckolab.tools.text.utf8.encode(calComp.serializeToICS()), null);
						}
					}

					// update list item
					this.curItemInListStatus.setAttribute("label", com.synckolab.global.strBundle.getString("updateOnServer"));

					com.synckolab.tools.writeSyncDBFile(idxEntry, com.synckolab.tools.stripMailHeader(msg));

					// remember this message for update
					return msg;
				}

				this.tools.logMessage("no change for event:" + parsedEvent.id, this.global.LOG_CAL + this.global.LOG_INFO);
				this.curItemInListStatus.setAttribute("label", com.synckolab.global.strBundle.getString("noChange"));
			}
		}
		return null;
	},

	initUpdate : function () {
		this.gCurEvent = 0;
		return true;
	},

	/**
	 * read the next todo/event and return the content if update needed
	 * @return null to skip this one completely
	 * @return "done" to specify that the sync is finished
	 */
	nextUpdate : function () {
		this.tools.logMessage("next update...", this.global.LOG_CAL + this.global.LOG_DEBUG);
		// if there happens an exception, we are done
		if ((this.gEvents === null || this.gCurEvent >= this.gEvents.events.length)) {
			this.tools.logMessage("done update...", this.global.LOG_CAL + this.global.LOG_INFO);
			// we are done
			return "done";
		}
		this.tools.logMessage("get event ( " + this.gCurEvent + " of " + this.gEvents.events.length + ")", this.global.LOG_CAL + this.global.LOG_DEBUG);
		var msg = null;
		var cEntry;
		
		if (this.gEvents && this.gCurEvent <= this.gEvents.events.length) {
			var cur = this.gEvents.events[this.gCurEvent++];
			var writeCur = true;
			msg = null;

			this.tools.logMessage("nextUpdate for " + (this.gConfig.task ? "task" : "event") + ":" + cur.id, this.global.LOG_CAL + this.global.LOG_DEBUG);

			if (cur.id === null) {
				this.tools.logMessage("no id found for this element! skipping.", this.global.LOG_CAL + this.global.LOG_WARNING);
				return null;
			}

			// check if we can skip this entry	(make sure we got a start and enddate.. otherwise it will fail)
			var endDate = this.calTools.getEndDate(cur, this.gConfig.task);

			if (endDate && this.gSyncTimeFrame > 0 && (endDate.getTime() + (this.gSyncTimeFrame * 86400000) < (new Date()).getTime())) {
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
			for ( var i = 0; i < this.folderMessageUids.length; i++) {
				if (cur.id === this.folderMessageUids[i]) {
					this.tools.logMessage("event is known from IMAP lookup: " + cur.id, this.global.LOG_CAL + this.global.LOG_INFO);
					writeCur = false;
					break;
				}
			}

			// ok we should have this event in our db but 
			// not on the imap acct. if we got this entry in our internal db
			// it has been deleted on the server and we dont know about it yet
			if (writeCur) {
				this.tools.logMessage("nextUpdate decided to write event:" + cur.id, this.global.LOG_CAL + this.global.LOG_INFO);

				cEntry = com.synckolab.tools.file.getSyncDbFile(this.gConfig, this.getType(), cur.id);

				if (cEntry.exists() && !this.forceServerCopy) {
					// we have it in our database - don't write back to server but delete locally
					this.tools.logMessage("nextUpdate assumes 'delete on server', better don't write event:" + cur.id, this.global.LOG_CAL + this.global.LOG_INFO);

					writeCur = false;
					this.gCalendar.deleteItem(cur, this.gEvents);

					// also remove the local db file since we deleted the contact on the server
					if (cEntry.exists) {
						cEntry.remove(false);
					}

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

					if (this.itemList) {
						this.itemList.appendChild(this.curItemInList);
						com.synckolab.tools.scrollToBottom(this.itemList);
					}

				} else {
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

					if (this.itemList) {
						this.itemList.appendChild(this.curItemInList);
						com.synckolab.tools.scrollToBottom(this.itemList);
					}
				}
			}

			if (writeCur) {
				this.tools.logMessage("nextUpdate really writes event:" + cur.id, this.global.LOG_CAL + this.global.LOG_DEBUG);
				// and now really write the message
				msg = null;
				var clonedEvent = cur;
				clonedEvent = this.calTools.modifyEventOnExport(cur, this);

				if (this.gConfig.format === "Xml") {
					msg = this.calTools.event2kolabXmlMsg(clonedEvent, this.gConfig.email, this.gConfig.task);
				} else {
					var calComp = Components.classes["@mozilla.org/calendar/ics-service;1"].getService(Components.interfaces.calIICSService).createIcalComponent("VCALENDAR");
					calComp.version = "2.0";
					calComp.prodid = "-//Mozilla.org/NONSGML Mozilla Calendar V1.1//EN";
					calComp.addSubcomponent(clonedEvent.icalComponent);

					if (this.gConfig.task) {
						msg = com.synckolab.tools.generateMail(cur.id, this.gConfig.email, "iCal", "text/todo", false, com.synckolab.tools.text.utf8.encode(calComp.serializeToICS()), null);
					} else {

						msg = com.synckolab.tools.generateMail(cur.id, this.gConfig.email, "iCal", "text/calendar", false, com.synckolab.tools.text.utf8.encode(calComp.serializeToICS()), null);
					}
				}

				this.tools.logMessage("New event:\n" + msg, this.global.LOG_CAL + this.global.LOG_DEBUG);

				// add the new event into the db
				cEntry = com.synckolab.tools.file.getSyncDbFile(this.gConfig, this.getType(), cur.id);
				com.synckolab.tools.writeSyncDBFile(cEntry, com.synckolab.tools.stripMailHeader(msg));

			}
		}

		// return the event's content
		return msg;
	},

	doneParsing : function () {
		// done
	}
};
