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
 * Copyright (c) Niko Berger  2005-2012
 * Copyright (c) Kolab Systems 2012
 * Author: Niko Berger <niko.berger(at)corinis.com>
 * Contributor(s): Andreas Gungl <a.gungl(at)gmx.de>
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
"use strict";

try {
	Components.utils.import("resource://calendar/modules/calUtils.jsm");
	Components.utils.import("resource://calendar/modules/calProviderUtils.jsm");
} catch (importEx) {
	// ignore exception if lightning is not installed
}

if(!com) var com={};
if(!com.synckolab) com.synckolab={};

/* ----- general functions to access calendar and events ----- */

com.synckolab.calendarTools = {
		activeCalendarManager: null,

		// make sure the listener is only registered ONCE
		listenerRegistered: {},

		/**
		 * New and updated calendar functions (lightning 0.1)
		 */
		getCalendarManager: function (listener)
		{
			if (!this.activeCalendarManager || this.activeCalendarManager === null) {
				this.activeCalendarManager = Components.classes["@mozilla.org/calendar/manager;1"].getService(Components.interfaces.calICalendarManager);
			}

			// create a new calendar if none exists
			if (this.activeCalendarManager.getCalendars({}).length === 0) {
				var homeCalendar = this.activeCalendarManager.createCalendar("storage", makeURL("moz-profile-calendar://"));
				this.activeCalendarManager.registerCalendar(homeCalendar);

				var sbs = Components.classes["@mozilla.org/intl/stringbundle;1"].getService(Components.interfaces.nsIStringBundleService);
				
				var props = sbs.createBundle("chrome://calendar/locale/calendar.properties");
				homeCalendar.name = props.GetStringFromName("homeCalendarName");

				var composite = getCompositeCalendar();
				composite.addCalendar(homeCalendar);
			}
			return this.activeCalendarManager;
		},


		/**
		 * Returns a list of calendars (calICalendar)
		 */
		getCalendars: function ()
		{
			try {
				var syncCalManager = this.getCalendarManager();
				if (syncCalManager === null || !syncCalManager) {
					return null;
				}
				return syncCalManager.getCalendars({});
			}
			catch (e) {
				com.synckolab.tools.logMessage("Error getting calendars: " + e, com.synckolab.global.LOG_ERROR);
				return null;
			}
		},

		/**
		 * add a listener to a calendar. This makes sure a listener is not double-added.
		 */
		registerListener: function(calendar, listener) {
			if(listener && !com.synckolab.calendarTools.listenerRegistered[calendar.id]) {
				calendar.addObserver(listener);
				com.synckolab.calendarTools.listenerRegistered[calendar.id] = true;
			}
		},

		/**
		 * @return true if the calendar exists
		 */
		isCalendarAvailable: function ()
		{
			var syncCals = this.getCalendars();
			return syncCals?true:false;
		},

		/**
		 * @return the event with the given id
		 */
		findEvent: function (events, uid) {
			return events.get(uid);
		},

		/**
		 * returns the end date of an event.
		 * Because of changes in lightning 0.8 endDate requires startDate 
		 * to exist and is different for tasks/events
		 */
		getEndDate: function (cur, tasks)
		{
			if (tasks === true && cur.dueDate){
				return cur.dueDate.jsDate;
			}
			if (tasks === false  && cur.untilDate) {
				return cur.untilDate.jsDate;
			}

			if (tasks === false && cur.endDate) {
				return cur.endDate.jsDate;
			}

			return null;
		},


		/* 
		 * Set the property of an event / task
		 * This is taken from the lightning extension (calendar-event-dialog.js#938ff setItemProperty)
		 */
		setKolabItemProperty: function (item, propertyName, value) {
			//com.synckolab.tools.logMessage("setting property: " + propertyName + " with value " + value, com.synckolab.global.LOG_CAL + com.synckolab.global.LOG_DEBUG);
			try
			{
				switch(propertyName) {
				case "startDate":
					item.startDate = value;
					break;
					// endDate might be untilDate
				case "endDate":
					if (item.endDate) {
						item.endDate = value;
					} else {
						item.untilDate = value;
					}
					break;

				case "entryDate":
					item.entryDate = value;
					break;
				case "dueDate":
					item.dueDate = value;
					break;
				case "isCompleted":
					item.isCompleted = value;
					break;
				case "status":
					item.status = com.synckolab.calendarTools.getTaskStatus(value,false);
					break;
				case "title":
					item.title = value;
					break;
				case "priority":
					if(!isNaN(value)) {
						item.priority = Number(value);
					} else
					{
						item.priority = 0;
					}
					break;
				case "daynumber":
					if(!isNaN(value)) {
						item.daynumber = Number(value);
					} else
					{
						item.daynumber = 0;
					}
					break;
				default:
					if (!value || value === "") {
						item.deleteProperty(propertyName);
					} else if (item.getProperty(propertyName) !== value) {
						item.setProperty(propertyName, value);
					}
				break;
				}
			}
			catch (ex){
				com.synckolab.tools.logMessage("unable to set property: " + propertyName + " with value " + value, com.synckolab.global.LOG_CAL + com.synckolab.global.LOG_ERROR);
			}
		},


		isPrivateEvent: function (levent) {
			return (levent && levent.sensitivity === "private");
		},

		isConfidentialEvent: function (levent) {
			return (levent && levent.sensitivity === "confidential");
		},

		isPublicEvent: function (levent) {
			return (levent && !this.isPrivateEvent(levent) && 
					!this.isConfidentialEvent(levent));
		},

		/*
		 * insert an organizer if not existing and update  
		 * ignore: #24838
		
		insertOrganizer: function (levent, config) {
			if (levent.organizer) {
				return levent;
			}
			var modevent = levent.clone();
			var organizer = Components.classes["@mozilla.org/calendar/attendee;1"].createInstance(Components.interfaces.calIAttendee);
			organizer.id = "MAILTO:" + config.email;
			organizer.commonName = config.name;
			organizer.participationStatus = "ACCEPTED";
			organizer.rsvp = false;
			organizer.role = "CHAIR";
			organizer.isOrganizer = true;
			modevent.organizer = organizer;
			// set task status to NONE if it is NULL 
			if (config.type === "task" && !levent.status) {
				modevent.status="NONE";
			}
			config.calendar.modifyItem(modevent, levent, null);
			return modevent;
		},
		*/

		/**
		 * only ORGANIZER is allowed to change non-public events
		 */
		allowSyncEvent: function (levent, revent, config) {
			var lpublic = this.isPublicEvent(levent);
			var rpublic = this.isPublicEvent(revent);
			if (lpublic && rpublic) {
				return true;
			}
			// no organizer: anyone can change
			if(!revent.organizer) {
				return true;
			}
			/*previous behaviour*/
			var rorgmail = config.email;
			if (revent.organizer) {
				rorgmail = revent.organizer.mail;
			}
			var org2mail = (config.email === rorgmail);
			com.synckolab.tools.logMessage("allowSyncEvent: " + org2mail + ":" + lpublic + ":" + rpublic, com.synckolab.global.LOG_CAL + com.synckolab.global.LOG_DEBUG );
			return org2mail;
		},

		/**
		 * sync local changes back to server version
		 */
		checkEventBeforeSync: function (fevent, revent, lsyncCalendar) {
			var rc = this.allowSyncEvent(fevent, revent, lsyncCalendar);
			if (!rc) {
				com.synckolab.tools.logMessage("Update local event with server one : " + revent.id, com.synckolab.global.LOG_CAL + com.synckolab.global.LOG_DEBUG );
				lsyncCalendar.curItemInListStatus.setAttribute("label", com.synckolab.global.strBundle.getString("localUpdate"));
				lsyncCalendar.gConfig.calendar.modifyItem(revent, fevent, lsyncCalendar.gEvents);
			}
			return rc;
		},

		/**
		 * Event has changed from PUBLIC/CONFIDENTIAL to PRIVATE
		 */
		checkEventServerDeletion: function (fevent, revent, lsyncCalendar) {
			return (revent && 
					this.allowSyncEvent(fevent, revent, lsyncCalendar) && 
					this.isPrivateEvent(fevent));
		},

		/**
		 * delete event on Server and database but not in Thunderbird calendar
		 */
		deleteEventOnServer: function (fevent, pevent, lsyncCalendar) {
			if (!this.checkEventServerDeletion(fevent, pevent, lsyncCalendar)) {
				return false;
			}
			var eventry = com.synckolab.tools.file.getSyncDbFile(lsyncCalendar.gConfig, fevent.id);
			if (eventry.exists()) {
				eventry.remove(false);
			}
			lsyncCalendar.curItemInListStatus.setAttribute("label", com.synckolab.global.strBundle.getString("deleteOnServer"));
			return true;
		},

		/**
		 * clear the description if event is confidential or private 
		 */
		modifyDescriptionOnExport: function (levent, syncTasks) {
			var myclass = levent.getProperty("CLASS");
			if (!this.isPublicEvent(levent)) {
				levent = levent.clone();
				levent.setProperty("DESCRIPTION",(syncTasks ? "Task" : "Event") + " is " + myclass + "!");
			}
			return levent;
		},

		/**
		 * prepare event for export 
		 */
		modifyEventOnExport: function (levent, config) {
			//levent = this.insertOrganizer(levent, config); #24838 do not add an organizer
			levent = this.modifyDescriptionOnExport(levent, config.type === "task");
			return levent;
		},

		/**
		 * check Events and Todos on privacy changes and modify appropriately
		 **/
		checkEventOnDeletion: function (levent, pevent, lsyncCalendar) { 

			if (this.deleteEventOnServer(levent, pevent, lsyncCalendar)) {
				return "DELETEME";
			}
			if (!this.checkEventBeforeSync(levent, pevent, lsyncCalendar)) {
				return null;
			}
			return this.modifyDescriptionOnExport(levent, lsyncCalendar.syncTasks);
		}


};


/* ----- functions to handle the Kolab 2 XML event format ----- */

/**
 * This functions checks if two event json objects are equals
 */
com.synckolab.calendarTools.equalsEvent = function (a, b) {
	return com.synckolab.tools.equalsObject(a, b);
};

/**
 * 
 * @param fileContent this contains a message to parse or already a preparsed json object
 * @param syncTasks true if we sync tasks
 * @returns a parsed json object
 */
com.synckolab.calendarTools.message2json = function (fileContent, syncTasks) {
	if (fileContent === null) {
		return null;
	}
	
	// if fileContent contains a synckolab field its already parsed
	if(fileContent.synckolab) {
		return fileContent;
	}

	// fileContent should be a string - with indexOf
	if(!fileContent.indexOf) {
		com.synckolab.tools.logMessage("Unknown fileContent: " + fileContent.toSource(), com.synckolab.global.LOG_CAL + com.synckolab.global.LOG_WARNING);
		return null;
	}
	
	if (fileContent.indexOf("<?xml") !== -1 || fileContent.indexOf("<?XML") !== -1)
	{
		return this.xml2json(fileContent, syncTasks);
	}

	// for ical - use the way through the lightning decoder to json
	var parsedEvent = null;
	if(fileContent.indexof("=3D") !== -1) {
		fileContent = com.synckolab.tools.text.quoted.decode(fileContent);
	}
	// sepcial fix for Europe bug
	if (fileContent.indexOf("TZIDID=rope")) {
		fileContent = fileContent.replace(/TZID=rope/g,"TZID=Europe");
	}
	// this.format === 'iCal'
	parsedEvent = this.ical2event(fileContent, syncTasks);

	if(parsedEvent === null) {
		return null;
	}

	// check type
	if (syncTasks === true && com.synckolab.tools.instanceOf(parsedEvent, Components.interfaces.calIEvent))
	{
		com.synckolab.tools.logMessage("There is an event in the task folder! skipping.", com.synckolab.global.LOG_CAL + com.synckolab.global.LOG_WARNING);
		return null;
	}

	if (syncTasks === false && !com.synckolab.tools.instanceOf(parsedEvent, Components.interfaces.calIEvent))
	{
		com.synckolab.tools.logMessage("There is a task in the calendar folder! skipping.", com.synckolab.global.LOG_CAL + com.synckolab.global.LOG_WARNING);
		return null;
	}

	return this.event2json(parsedEvent, syncTasks);
};

/**
 * converts a lightning event into a json representation.
 * @param event the lightning event
 * @param syncTasks true if this is a task
 * @return a json object
 */
com.synckolab.calendarTools.event2json = function (event, syncTasks) {
	com.synckolab.tools.logMessage("Event To JSON", com.synckolab.global.LOG_CAL + com.synckolab.global.LOG_DEBUG);
	// no event given
	if(!event) {
		return null;
	}
	var jobj = {
			synckolab : com.synckolab.config.version, // synckolab version
			type : "calendar"
	};
	
	if(syncTasks === true) {
		jobj.type = "task";
	}
	
	// TODO  not working ATM:
	//	- yearly recurrence

	var isAllDay = syncTasks?false:(event.startDate?event.startDate.isDate:false);
	var endDate = com.synckolab.calendarTools.getEndDate(event, syncTasks);
	var i, minutes;
	var dayindex, daynumber;

	// correct the end date for all day events 
	// Kolab uses for 1-day-event:
	// startdate = day_x, enddate = day_x
	// Sunbird uses for 1-day-event:
	// startdate = day_x, enddate = day_x + 1
	if (isAllDay && endDate)
	{
		var tmp_date = endDate;
		tmp_date.setTime(tmp_date.getTime() - 24*60*60000);
		// lightning 0.9pre fix
		if (createDateTime) {
			endDate = new createDateTime();
		} else {
			endDate = new CalDateTime();
		}

		endDate.jsDate = tmp_date;
	}

	// tasks have some additional fields
	if (syncTasks === true)
	{
		if(event.entryDate) {
			jobj.startDate = com.synckolab.tools.text.calDateTime2String(event.entryDate, isAllDay);
		}
		if(endDate) {
			jobj.endDate = com.synckolab.tools.text.calDateTime2String(endDate, isAllDay);
		}
		// jobj.completedDate =  com.synckolab.tools.text.calDateTime2String(completedDate, true);
		if(event.priority && event.priority !== null && event.priority !== "") {
			jobj.priority = event.priority;
		}

		// tasks have a status
		if (event.isCompleted || event.percentComplete === 100) {
			jobj.completed = 100;
			jobj.status = "completed";
		}
		else {
			jobj.status = com.synckolab.calendarTools.getTaskStatus(event.status, true);
			jobj.completed = event.percentComplete;
		}
	} else {
		jobj.startDate = com.synckolab.tools.text.calDateTime2String(event.startDate, isAllDay);
		jobj.endDate = com.synckolab.tools.text.calDateTime2String(endDate, isAllDay);
	}

	jobj.uid = event.id;
	jobj.title = event.title;
	jobj.body = event.getProperty("DESCRIPTION");
	jobj.sensitivity = event.getProperty("CLASS")?event.getProperty("CLASS").toLowerCase():"public";
	// xml += " <creation-date>" + com.synckolab.tools.text.calDateTime2String(event.getProperty("CREATED"), false) + "</creation-date>\n";
	// xml += " <last-modification-date>" + com.synckolab.tools.text.calDateTime2String(event.getProperty("LAST-MODIFIED"), false) + "</last-modification-date>\n";

	if (event.getProperty("LOCATION")) {
		jobj.location = event.getProperty("LOCATION");
	}
	
	// make sure we mark new events as busy - TODO validate this
	jobj.showTimeAs = event.getProperty("X-KOLAB-SHOW-TIME-AS")?event.getProperty("X-KOLAB-SHOW-TIME-AS"):"busy";

	if (event.getProperty("X-KOLAB-COLOR-LABEL")) {
		jobj.colorLabel = event.getProperty("X-KOLAB-COLOR-LABEL");
	}

	// tmp object for copying arrays
	var tmpobj;
	
	// allow multiple alarms
	if (event.getAlarms)
	{
		var calarms = [];
		
		// Alarms (only allow relative alarms)
		var alarm;
		var alarms = event.getAlarms({});
		for(i=0; i < alarms.length; i++) {
			alarm = alarms[i];
			// skip absolute - ALARM_RELATED_ABSOLUTE = 0;
			if (alarm.related === alarm.ALARM_RELATED_ABSOLUTE) {
				continue;
			}
			minutes = Math.floor(Math.abs(alarm.offset.inSeconds)/60);
			tmpobj = {
				offset: minutes,
				related: 1
			};
			calarms.push(tmpobj);
			
			// TODO lightning has some other attributes which we should take care of
			com.synckolab.tools.copyFields(alarm, tmpobj, ["description", "summary", "action"], true);
		}
		
		// only create if there are alarms
		if(calarms.length > 0) {
			jobj.alarms = calarms;
		}
	}
	
	if ((!jobj.alarms || jobj.alarms.length === 0) && event.alarmOffset && event.alarmOffset.inSeconds !== 0)
	{
		jobj.alarms = [];
		minutes = Math.floor(Math.abs(event.alarmOffset.inSeconds)/60);
		tmpobj = {
			offset: minutes
		};
		jobj.alarms.push(tmpobj);
	}

	// lighnting 0.9 (thanks to Pavlic)
	if (event.getCategories)
	{
		var cCat = "";
		var catarray = event.getCategories({});
		if (catarray.length > 0 ) {
			var cnt;
			for (cnt = 0; cnt < catarray.length; cnt++) {
				cCat += catarray[cnt];
				if ( (cnt+1) < catarray.length) {
					cCat += ",";
				}
			}
		}
		if(cCat && cCat !== "") {
			jobj.categories = cCat;
		}
	}
	else
	{
		if (event.getProperty("CATEGORIES")) {
			jobj.categories = event.getProperty("CATEGORIES");
		} else if (event.getProperty("CATEGORY")) {
			jobj.categories = event.getProperty("CATEGORY");
		}
	}

	var recInfo = event.recurrenceInfo;
	if (recInfo && recInfo.countRecurrenceItems() >= 1)
	{
		jobj.recurrence = {};
		// read the first recurrence rule and process it
		var recRule = recInfo.getRecurrenceItemAt(0);
		switch (recRule.type)
		{
		case "DAILY":
			jobj.recurrence.cycle = "daily";
			break;
		case "WEEKLY":
			//alert(event.icalString);
			//alert(recRule.icalProperty.icalString);

			jobj.recurrence.cycle = "weekly";
			jobj.recurrence.days = []; 
			// need to process the <day> value here
			var curDay = recRule.getComponent("BYDAY", {});
			if (curDay && curDay.length > 0 ) {
				// multiple recurrence possible
				for(var recweekdays = 0; recweekdays < curDay.length; recweekdays ++) {
					jobj.recurrence.days.push(com.synckolab.tools.kolab.getXmlDayName(curDay[recweekdays]));
				}
			} 
			break;
		case "MONTHLY":
			// "daynumber" or "weekday"
			var days = recRule.getComponent("BYMONTHDAY", {});
			
			if (days && days.length > 0) {
				// daynumber has <daynumber>
				jobj.recurrence.cycle = "monthly";
				jobj.recurrence.days = days;
			}
			else
			{
				jobj.recurrence.cycle = "monthly";
				// weekday has <daynumber> and <day>
				days = recRule.getComponent("BYDAY", {});
				if (days && days.length > 0)
				{
					dayindex = days[0] % 8;
					daynumber = (days[0] - dayindex) / 8;
					jobj.recurrence.daynumber = daynumber;
					jobj.recurrence.weekday = com.synckolab.tools.kolab.getXmlDayName(dayindex);
				}
			}
			break;
		case "YEARLY":
			// "weekday", monthday" or "yearday"
			// weekday has <day>, <daynumber> and <month>
			// FIXME weekday is not yet supported by Lightning
			//xml += " <recurrence cycle=\"yearly\" type=\"weekday\">\n";
			//xml += "  <day>tuesday</day>\n";
			//xml += "  <daynumber>2</daynumber>\n";
			//xml += "  <month>july</month>\n";

			// monthday has <daynumber> and <month>
			// FIXME monthday is not yet supported by Lightning
			//xml += " <recurrence cycle=\"yearly\" type=\"monthday\">\n";
			//xml += "  <daynumber>2</daynumber>\n";
			//xml += "  <month>july</month>\n";

			// yearday has <daynumber>
			jobj.recurrence.cycle = "yearly";
			// FIXME we have no matching field in Lighning yet
			jobj.recurrence.daynumber = 1;
			break;
			// no recurrence
		default:
			recInfo = null;
		}

		// additional info for recurence
		if (recInfo)
		{
			jobj.recurrence.interval = recRule.interval;
			jobj.recurrence.count = 0;
			if (recRule.isByCount)
			{
				if (recRule.count > 0) {
					jobj.recurrence.count = recRule.count;
				} 
			}
			else
			{

				endDate = recRule.endDate;
				// new lightning
				if (!endDate) {
					endDate = recRule.untilDate;
				}
				
				if (endDate) {
					jobj.recurrence.untilDate = com.synckolab.tools.text.date2String(endDate.jsDate);
				}
			}

			var items = recInfo.getRecurrenceItems({});
			if(items) {
				jobj.recurrence.exclusion = [];
				for (i in items)
				{
					var item = items[i];
					if (item.isNegative) {
						jobj.recurrence.exclusion.push(com.synckolab.tools.text.calDateTime2String(item.date, true));
					}
				}
			}
		}
	}

	var attendees = event.getAttendees({});
	if (syncTasks !== true && attendees && attendees.length > 0) 
	{
		jobj.attendees = [];
		
		var attendee;
		for (i=0; i < attendees.lenght; i++) {
			attendee = attendees[i];
			tmpobj = {};
			jobj.attendess.push(tmpobj);
			
			var cmail = attendee.id.replace(/MAILTO:/i, '');
			if(cmail && cmail !== "unknown") {
				tmpobj.mail = attendee.id.replace(/MAILTO:/i, '');
			}
			tmpobj.displayName = attendee.commonName;
			tmpobj.rsvp = (attendee.rsvp ? true : false);
			
			tmpobj.status = "none"; // default: "NEEDS-ACTION"
			switch (attendee.participationStatus)
			{
			case "TENTATIVE":
				tmpobj.status = "tentative";
				break;
			case "ACCEPTED":
				tmpobj.status = "accepted";
				break;
			case "DECLINED":
				tmpobj.status = "declined";
				break;
			}
			
			tmpobj.role = "required"; // default: "REQ-PARTICIPANT"
			switch (attendee.role)
			{
			case "OPT-PARTICIPANT":
				tmpobj.role = "optional";
				break;
			case "NON-PARTICIPANT":
				tmpobj.role = "resource";
				break;
			}
		}
	}

	if (event.organizer)
	{
		jobj.organizer = {
			displayName: event.organizer.commonName
		};
		// might not have an smtp address
		if(event.organizer.id) {
			jobj.organizer.mail = event.organizer.id.replace(/MAILTO:/i, '');
		} 
	}

	if (event.getProperty("X-KOLAB-CREATOR-DISPLAY-NAME") && event.getProperty("X-KOLAB-CREATOR-SMTP-ADDRESS"))
	{
		jobj.creator = {
			displayName: event.getProperty("X-KOLAB-CREATOR-DISPLAY-NAME"),
			mail: event.getProperty("X-KOLAB-CREATOR-SMTP-ADDRESS").replace(/MAILTO:/i, '')
		};
	}

	return jobj;
};

/**
 * this fills an event object based on a event json.
 * @param json the json object to read
 * @param calendar an optional calendar to set
 */
com.synckolab.calendarTools.json2event = function (jobj, calendar) {
	var syncTasks = (jobj.type === "task");
	var event;

	if (syncTasks === true)
	{
		com.synckolab.tools.logMessage("creating task/todo.", com.synckolab.global.LOG_CAL + com.synckolab.global.LOG_DEBUG);
		event = Components.classes["@mozilla.org/calendar/todo;1"].createInstance(Components.interfaces.calITodo);
	}
	else {
		com.synckolab.tools.logMessage("creating event.", com.synckolab.global.LOG_CAL + com.synckolab.global.LOG_DEBUG);
		event = Components.classes["@mozilla.org/calendar/event;1"].createInstance(Components.interfaces.calIEvent);
	}
	// set the correct calendar
	event.calendar = calendar;
	
	var cDate, i;
	
	// full day
	if(!syncTasks && !jobj.startDate) {
		throw ("Events MUST have a startdate");
	}

	if(jobj.startDate) {
		if (jobj.startDate.indexOf(":") === -1) {
			// entry date and start date can be handled the same way
			com.synckolab.tools.logMessage("setting all day: " + (syncTasks?"entryDate":"startDate"), com.synckolab.global.LOG_CAL + com.synckolab.global.LOG_DEBUG);
			this.setKolabItemProperty(event, syncTasks?"entryDate":"startDate", com.synckolab.tools.text.string2CalDate(jobj.startDate));
		} else {
			// entry date and start date can be handled the same way
			com.synckolab.tools.logMessage("setting: " + (syncTasks?"entryDate":"startDate"), com.synckolab.global.LOG_CAL + com.synckolab.global.LOG_DEBUG);
			this.setKolabItemProperty(event, syncTasks?"entryDate":"startDate", com.synckolab.tools.text.string2CalDateTime(jobj.startDate, true));
		}
	}
	
	// full day
	if(jobj.endDate) {
		if (jobj.endDate.indexOf(":") === -1) {
			cDate = com.synckolab.tools.text.string2CalDate(jobj.endDate);
			// Kolab uses for 1-day-event:
			// startdate = day_x, enddate = day_x
			// Sunbird uses for 1-day-event:
			// startdate = day_x, enddate = day_x + 1
			var tmp_date = cDate.jsDate;
			tmp_date.setTime(tmp_date.getTime() + 24*60*60000);
			cDate.jsDate = tmp_date;
			cDate.isDate = true;
			// due date and end date can be handled the same way
			this.setKolabItemProperty(event, syncTasks?"dueDate":"endDate", cDate);
		} else {
			// due date and end date can be handled the same way
			this.setKolabItemProperty(event, syncTasks?"dueDate":"endDate", com.synckolab.tools.text.string2CalDateTime(jobj.endDate, true));
		}
	}
	
	// 2005-03-30T15:28:52Z
	if(jobj.creationDate) {
		this.setKolabItemProperty(event, "CREATED", com.synckolab.tools.text.string2CalDateTime(jobj.creationDate, true));
	}

	// 2005-03-30T15:28:52Z
	if(jobj.lastModified) {
		this.setKolabItemProperty(event, "LAST-MODIFIED", com.synckolab.tools.text.string2CalDateTime(jobj.lastModified, true));
	}

	// special fields for tasks
	if(syncTasks) {
		if(jobj.priority) {
			this.setKolabItemProperty(event, "priority", jobj.priority);
		}
		this.setKolabItemProperty(event, "status", jobj.status);
		this.setKolabItemProperty(event, "PERCENT-COMPLETE", jobj.completed);
	}
	
	event.id = jobj.uid;
	this.setKolabItemProperty(event, "title", jobj.title);
	this.setKolabItemProperty(event, "DESCRIPTION", jobj.body);
	if(jobj.sensitivity) {
		this.setKolabItemProperty(event, "CLASS", jobj.sensitivity.toUpperCase());
	}
	
	if(jobj.location) {
		this.setKolabItemProperty(event, "LOCATION", jobj.location);
	}
	
	this.setKolabItemProperty(event, "X-KOLAB-SHOW-TIME-AS", jobj.showTimeAs);
	
	if(jobj.colorLabel) {
		this.setKolabItemProperty(event, "X-KOLAB-COLOR-LABEL", jobj.colorLabel);
	}
	
	
	if(jobj.alarms) {
		for(i=0; i < jobj.alarms.length; i++) {
			// tbird 3 uses multiple alarms (using addAlarm)
			if (event.addAlarm)
			{
				var alarm = Components.classes["@mozilla.org/calendar/alarm;1"].createInstance(Components.interfaces.calIAlarm);
				alarm.related = 1; // 1: related to startdate - 2: related to enddate
				// fix for #24507 make sure the alarm is BEFORE the event not after
				alarm.offset = com.synckolab.tools.text.createDuration(-1 * Number(jobj.alarms[i].offset));
				
				// TODO lightning has some other attributes which we should take care of
				com.synckolab.tools.copyFields(jobj.alarms[i], alarm, ["description", "summary", "action"], true);

				event.addAlarm(alarm);
			}
			else {
				event.alarmOffset = com.synckolab.tools.text.createDuration(-1 * Number(jobj.alarms[i].offset));
			}
		}
	}

	if (!event.setCategories) {
		this.setKolabItemProperty(event, "CATEGORIES", jobj.categories);
	}
	else {
		// from calUtils.js
		var categories = categoriesStringToArray(jobj.categories);
		event.setCategories(categories.length, categories);
	}

	if(jobj.recurrence) {
		com.synckolab.tools.logMessage("recurring event", com.synckolab.global.LOG_CAL + com.synckolab.global.LOG_DEBUG);

		var recInfo = Components.classes["@mozilla.org/calendar/recurrence-info;1"].createInstance(Components.interfaces.calIRecurrenceInfo);
		recInfo.item = event;
		var recRule = Components.classes["@mozilla.org/calendar/recurrence-rule;1"].createInstance(Components.interfaces.calIRecurrenceRule);
		recRule.type = jobj.recurrence.cycle.toUpperCase();

		switch(jobj.recurrence.cycle) {
		case "daily":
			// nothing else to do here
			break;
		case "weekly":
			if(jobj.recurrence.days.length > 0) {
				
				//alert(recRule.icalProperty.icalString);
				var weeklyRecurrence = [];
				for(var recdays = 0; recdays < jobj.recurrence.days.length; recdays++) {
					weeklyRecurrence.push(com.synckolab.tools.kolab.getDayIndex(jobj.recurrence.days[recdays]));
				}
				recRule.setComponent("BYDAY", weeklyRecurrence.length, weeklyRecurrence);
			}
			break;
		case "monthly":
			if(!jobj.recurrence.weekday) {
				if(jobj.recurrence.days) {
					recRule.setComponent("BYMONTHDAY", jobj.recurrence.days.length, jobj.recurrence.days);
				}
				else if(jobj.recurrence.daynumber) {
					recRule.setComponent("BYMONTHDAY", 1, [jobj.recurrence.daynumber]);
				}
			} else {
				var dayindex = com.synckolab.tools.kolab.getDayIndex(jobj.recurrence.weekday);
				if(jobj.recurrence.daynumber === -1) {
					recRule.setComponent("BYDAY", 1, [(-1)*(8+dayindex)]);
				} else {
					recRule.setComponent("BYDAY", 1, [jobj.recurrence.daynumber*8 + dayindex]);
				}
			} 
			break;
		case "yearly":
			// Yearly options are not supported by lightning
			break;
		}
		
		// interval
		recRule.interval = jobj.recurrence.interval;
		if(jobj.recurrence.count) {
			recRule.count = jobj.recurrence.count;
		}
		
		if(jobj.recurrence.untilDate) {
			if (recRule.endDate) {
				recRule.endDate = com.synckolab.tools.text.string2CalDate(jobj.recurrence.untilDate);
			} else {
				// new lighnting
				recRule.untilDate = com.synckolab.tools.text.string2CalDate(jobj.recurrence.untilDate);
			}
		}
		recInfo.insertRecurrenceItemAt(recRule, 0);
		
		if(jobj.recurrence.exclusion && jobj.recurrence.exclusion.length > 0) {
			for(i=0; i < jobj.recurrence.exclusion.length; i++) {
				var exclusionDate = com.synckolab.tools.text.string2CalDate(jobj.recurrence.exclusion[i]);
				recInfo.removeOccurrenceAt(exclusionDate);
				var exclusion = recInfo.getOccurrenceFor(exclusionDate,true);
				recInfo.modifyException(exclusion, true);
			}
		}
		
		event.recurrenceInfo = recInfo;
	}

	if(jobj.attendees && jobj.attendees.length > 0) {
		for(i=0; i < jobj.attendees.length; i++) {
			var attendee = Components.classes["@mozilla.org/calendar/attendee;1"].createInstance(Components.interfaces.calIAttendee);
			attendee.id = "MAILTO:" + jobj.attendees[i].mail;
			attendee.commonName = jobj.attendees[i].displayName;
			attendee.isOrganizer= false;
			attendee.participationStatus = (jobj.attendees[i].status === "none")?"NEEDS-ACTION":jobj.attendees[i].status.toUpperCase();
			attendee.rsvp = jobj.attendees[i].rsvp;
			attendee.role = "REQ-PARTICIPANT";
			switch(jobj.attendees[i].role) {
			case "optional":
				attendee.role = "OPT-PARTICIPANT";
				break;
			case "resource":
				attendee.role = "NON-PARTICIPANT";
				break;
			}
			// "invitation-sent" is missing, it can be "true" or false"
			event.addAttendee(attendee);
		}
	}

	if(jobj.creator) {
		this.setKolabItemProperty(event, "X-KOLAB-CREATOR-DISPLAY-NAME", jobj.creator.displayName);
		this.setKolabItemProperty(event, "X-KOLAB-CREATOR-SMTP-ADDRESS", jobj.creator.mail);
	}

	if(jobj.organizer) {
		var organizer = Components.classes["@mozilla.org/calendar/attendee;1"].createInstance(Components.interfaces.calIAttendee);
		organizer.id = "MAILTO:" + jobj.organizer.mail;
		organizer.commonName = jobj.organizer.displayName;
		organizer.participationStatus = "ACCEPTED";
		organizer.rsvp = false;
		organizer.role = "CHAIR";
		organizer.isOrganizer = true;
		event.organizer = organizer;
	}
	
	return event;
};



/**
 * parse a string containing a Kolab XML message and put the information
 * in a preinitialized event object
 * Sometimes when syncing, there are empty events, that should not be put 
 * into calendar, so this function returns if we actually got an event
 *
 * @return true, if this event actually existed  
 */
com.synckolab.calendarTools.xml2json = function (xml, syncTasks)
{
	var jobj = {
		synckolab : com.synckolab.config.version, // synckolab version
		type : "calendar"
	};
	
	if(syncTasks === true) {
		jobj.type = "task";
		jobj.completed = 0;
	}

	// check if we have to decode quoted printable
	if (xml.indexOf(" version=3D") !== -1) { // we know from the version
		xml = com.synckolab.tools.text.quoted.decode(xml);
	}

	com.synckolab.tools.logMessage("Parsing an XML event:\n" + xml, com.synckolab.global.LOG_CAL + com.synckolab.global.LOG_DEBUG);
	// TODO improve recurrence settings
	//	  not working ATM:
	//		  - yearly recurrence

	// decode utf chars and make sure an & is an &amp; (otherwise this is unparseable)
	xml = com.synckolab.tools.text.utf8.decode(xml);
	// temporary fixes:
	// - attribute: "summary= ; "action=
	// TODO: remove for non-nightly!!!
	xml = xml.replace('"summary=', '" summary=');
	xml = xml.replace('"action=', '" action=');


	// convert the string to xml
	var parser = Components.classes["@mozilla.org/xmlextras/domparser;1"].getService(Components.interfaces.nsIDOMParser); 
	var doc = parser.parseFromString(xml, "text/xml");

	// we start with doc.firstChild and check for ELEMENT_NODE
	// and nodeName === event. As we know the structure of Kolab XML for
	// events, this is a good place to sort out invalid XML structures.
	var topNode = doc.firstChild;
	if (topNode.nodeName === "parsererror")
	{
		// so this message has no valid XML part :-(
		com.synckolab.tools.logMessage("Error parsing the XML content of this message.\n" + xml, com.synckolab.global.LOG_CAL + com.synckolab.global.LOG_ERROR);
		return false;
	}
	if ((topNode.nodeType !== Node.ELEMENT_NODE) || ((topNode.nodeName.toUpperCase() !== "EVENT") && (topNode.nodeName.toUpperCase() !== "TASK") ))
	{
		// this can't be an event in Kolab XML format
		com.synckolab.tools.logMessage("This message doesn't contain an event in Kolab XML format.\n" + xml, com.synckolab.global.LOG_CAL + com.synckolab.global.LOG_ERROR);
		return false;
	}

	// check for task
	if(syncTasks !== true && topNode.nodeName.toUpperCase() === "TASK") {
		com.synckolab.tools.logMessage("Skipping task in event sync", com.synckolab.global.LOG_CAL + com.synckolab.global.LOG_ERROR);
		return null;
	}

	if(syncTasks === true && topNode.nodeName.toUpperCase() !== "TASK") {
		com.synckolab.tools.logMessage("Skipping event in task sync", com.synckolab.global.LOG_CAL + com.synckolab.global.LOG_ERROR);
		return null;
	}

	var cur = new com.synckolab.Node(topNode.firstChild);
	var s, tmpobj;
	var cDate;
	// iterate over the DOM tree of the XML structure of the event
	while(cur)
	{
		if (cur.nodeType === Node.ELEMENT_NODE)
		{
			switch (cur.nodeName.toUpperCase())
			{
			case "UID":
				jobj.uid = cur.getFirstData();
				break;

			case "CREATION-DATE":
				if (!cur.firstChild) {
					break;
				}

				s = cur.getFirstData();
				// 2005-03-30T15:28:52Z
				//skip: jobj.createdDate = cur.getFirstData();
				break;

			case "LAST-MODIFICATION-DATE":
				if (!cur.firstChild) {
					break;
				}

				// 2005-03-30T15:28:52Z
				//skip: jobj.modified = cur.getFirstData();
				break;

				// entry date and start date can be handled the same way 
			case "ENTRY-DATE":
			case "START-DATE":
				if (!cur.firstChild) {
					break;
				}
				jobj.startDate = cur.getFirstData();
				break;

			case "DUE-DATE":
			case "END-DATE":
				if (!cur.firstChild) {
					break;
				}
				jobj.endDate = cur.getFirstData();
				break;

			case "PRIORITY":
				// only tasks 
				if (syncTasks === false) {
					break;
				}
				jobj.priority = cur.getFirstData();
				break;

			case "COMPLETED-DATE":
				if (syncTasks) {
					jobj.completed = 100;
					jobj.statsu = "completed";
				}
				break;

			case "STATUS":
				// only tasks 
				if (syncTasks === false || !cur.firstChild) {
					break;
				}
				jobj.status = cur.getFirstData();
				break;

			case "COMPLETED":
				// only tasks have a completed field
				if (syncTasks === false) {
					break;
				}

				var iComplete = 0;
				if (cur.firstChild)
				{
					iComplete = parseInt(cur.firstChild.data, 10);
				}

				if (iComplete < 0) {
					iComplete = 0;
				} else if (iComplete > 100) {
						iComplete = 100;
				}
				jobj.completed = iComplete;
				break;

			case "SUMMARY":
				if (cur.firstChild)
				{
					var data = cur.getFirstData();
					if (data && data !== '' && data !== 'null') {
						jobj.title = data;
					}
				}
				break;

			case "BODY":
				// sometimes we have <body></body> in the XML
				if (cur.firstChild)
				{
					var cnotes = cur.getFirstData();
					if (cnotes && cnotes !== '' && cnotes !== 'null') {
						jobj.body = cnotes;
					}
				}
				break;

			case "SENSITIVITY":
				jobj.sensitivity = "public";
				if (cur.firstChild) {
					jobj.sensitivity = cur.getFirstData();
				}
				break;

			case "LOCATION":
				// sometimes we have <location></location> in the XML
				if (cur.firstChild) {
					jobj.location = cur.getFirstData();
				}
				break;

			case "SHOW-TIME-AS":
				if (cur.firstChild) {
					jobj.showTimeAs = cur.getFirstData();
				}
				break;

			case "COLOR-LABEL":
				if (cur.firstChild) {
					jobj.colorLabel = cur.getFirstData();
				}
				break;

			case "ALARM":
				if (cur.firstChild)
				{
					if(!jobj.alarms) {
						jobj.alarms = [];
					}

					var cData = cur.getFirstData();
					tmpobj =  {};
					tmpobj.related = 1; // 1: related to startdate - 2: related to enddate
					tmpobj.offset = Number(cData);
					if (cur.getAttribute("description")) {
						tmpobj.description = cur.getAttribute("description");
					}
					if (cur.getAttribute("summary")) {
						tmpobj.summary = cur.getAttribute("summary");
					}
					if (cur.getAttribute("action")) {
						tmpobj.action = cur.getAttribute("action");
					}
					
					jobj.alarms.push(tmpobj);
				}
				break;

			case "CATEGORIES":
				if (cur.firstChild)
				{
					jobj.categories = cur.getFirstData();
				}
				break;

			case "RECURRENCE":
				jobj.recurrence = {};
				
				var detail;
				var day;
				var daynumber;
				var dayindex;
				var month;

				// read the "cycle" attribute for the units and
				// map the Kolab XML values to the Sunbird values
				jobj.recurrence.cycle = cur.getAttribute("cycle");
				if (jobj.recurrence.cycle === null) {
					jobj.recurrence.cycle = "weekly";
				}
				
				var recur;
				switch (jobj.recurrence.cycle)
				{
				case "weekly":
					// need to process the <day> value here
					jobj.recurrence.days = []; 
					// iterate over the DOM subtre
					recur = cur.firstChild;
					while(recur)
					{
						if ((recur.nodeType === Node.ELEMENT_NODE) && (recur.nodeName.toUpperCase() === "DAY"))
						{
							jobj.recurrence.days.push(recur.firstChild.data);
						}
						recur = recur.nextSibling;
					}
					break;
				case "monthly":
					// need to process extra type "type" which can be
					// "daynumber" or "weekday"
					var mode = cur.getAttribute("type");
					if(mode) {
						switch (mode.toUpperCase())
						{
						case "DAYNUMBER":
							jobj.recurrence.days = []; 

							// iterate over the DOM subtre
							recur = cur.firstChild;
							while(recur)
							{
								if ((recur.nodeType === Node.ELEMENT_NODE) && (recur.nodeName.toUpperCase() === "DAYNUMBER"))
								{
									jobj.recurrence.days.push(recur.firstChild.data);
								}
								recur = recur.nextSibling;
							}
							break;
						case "WEEKDAY":
							// weekday has <daynumber> and <day>
							detail = cur.firstChild;
							jobj.recurrence.daynumber = -1;
							while(detail)
							{
								if ((detail.nodeType === Node.ELEMENT_NODE) && (detail.nodeName.toUpperCase() === "DAY"))
								{
									if(detail.firstChild.data) {
										jobj.recurrence.weekday = detail.firstChild.data;
									}
								}
								if ((detail.nodeType === Node.ELEMENT_NODE) && (detail.nodeName.toUpperCase() === "DAYNUMBER"))
								{
									if(detail.firstChild.data) {
										jobj.recurrence.daynumber = Number(detail.firstChild.data);
									}
								}
								detail = detail.nextSibling;
							}
							break;
					}
					}
					break;
				case "yearly":
					jobj.recurrence.daynumber = 1;
					
					// need to process extra type "type" which can be
					// "weekday", monthday" or "yearday"
					mode = cur.getAttribute("type");
					switch (mode.toUpperCase())
					{
					case "YEARDAY":
						// yearday has <daynumber>
						detail = cur.firstChild;
						if ((detail) && (detail.nodeType === Node.ELEMENT_NODE) && (detail.nodeName.toUpperCase() === "DAYNUMBER"))
						{
							daynumber = Number(detail.firstChild.data);
							// FIXME this needs to be written to the event when supported by Lightning
						}
						break;
					case "MONTHDAY":
						// monthday has <daynumber> and <month>
						detail = cur.firstChild;
						while(detail)
						{
							if ((detail.nodeType === Node.ELEMENT_NODE) && (detail.nodeName.toUpperCase() === "MONTH"))
							{
								month = Number(detail.firstChild.data);
							}
							if ((detail.nodeType === Node.ELEMENT_NODE) && (detail.nodeName.toUpperCase() === "DAYNUMBER"))
							{
								daynumber = Number(detail.firstChild.data);
							}
							detail = detail.nextSibling;
						}
						// FIXME this needs to be written to the event when supported by Lightning
						break;
					case "WEEKDAY":
						// weekday has <day>, <daynumber> and <month>
						detail = cur.firstChild;
						while(detail)
						{
							if ((detail.nodeType === Node.ELEMENT_NODE) && (detail.nodeName.toUpperCase() === "DAY"))
							{
								day = detail.firstChild.data;
							}
							if ((detail.nodeType === Node.ELEMENT_NODE) && (detail.nodeName.toUpperCase() === "MONTH"))
							{
								month = detail.firstChild.data;
							}
							if ((detail.nodeType === Node.ELEMENT_NODE) && (detail.nodeName.toUpperCase() === "DAYNUMBER"))
							{
								daynumber = Number(detail.firstChild.data);
							}
							detail = detail.nextSibling;
						}
						// FIXME this needs to be written to the event when supported by Lightning
						break;
					}
					break;
				}

				jobj.recurrence.interval = Number(cur.getXmlResult("INTERVAL", 1));
				jobj.recurrence.count = 0;
				
				var node = new com.synckolab.Node(cur.getChildNode("RANGE"));
				if (node)
				{
					// read the "type" attribute of the range
					var rangeType = node.getAttribute("type");
					if (rangeType)
					{
						var rangeSpec = cur.getXmlResult("RANGE", "dummy");
						switch (rangeType.toUpperCase())
						{
						case "DATE":
							if (rangeSpec !== "dummy")
							{
								jobj.recurrence.untilDate = rangeSpec;
							}
							else {
								jobj.recurrence.count = 0;
							}
							break;
						case "NUMBER":
							if (rangeSpec !== "dummy") {
								jobj.recurrence.count = Number(rangeSpec);
							} else {
								jobj.recurrence.count = 1;
							}
							break;
						case "NONE":
							jobj.recurrence.count =  0;
							break;
						}
					}
				}
				else
				{
					// no range set
					jobj.recurrence.count = -1;
				}

				// read 0..n exclusions
				jobj.recurrence.exclusion = [];
				node = cur.firstChild;
				while(node)
				{
					if(node.nodeType === Node.ELEMENT_NODE && (node.nodeName.toUpperCase() === "EXCLUSION"))
					{
						jobj.recurrence.exclusion.push(node.firstChild.data);
					}
					node = node.nextSibling;
				}
				break;

			case "ATTENDEE":
				if(!jobj.attendees) {
					jobj.attendees = [];
				}
				
				var attendee = {};
				var cmail = cur.getXmlResult("SMTP-ADDRESS");
				if (cmail && cmail !== "unknown") {
					attendee.mail = cmail;
				}
				attendee.displayName = cur.getXmlResult("DISPLAY-NAME", "");
				attendee.status = cur.getXmlResult("STATUS", "none");
				// The request response status is true or false
				attendee.rsvp = cur.getXmlResult("REQUEST-RESPONSE", "false") === "true";
				attendee.role = cur.getXmlResult("ROLE", "optional");
				jobj.attendees.push(attendee);
				// "invitation-sent" is missing, it can be "true" or false"
				break;
				
			case "CREATOR":
				jobj.creator = {};
				jobj.creator.displayName = cur.getXmlResult("DISPLAY-NAME", "");
				jobj.creator.mail = cur.getXmlResult("SMTP-ADDRESS", "");
				break;

			case "ORGANIZER":
				var otmpDN = cur.getXmlResult("DISPLAY-NAME");
				var otmpMail = cur.getXmlResult("SMTP-ADDRESS");
				if (otmpDN && otmpDN !== "unknown" && otmpDN !== "") {
					otmpDN = null;
				}
				
				if (otmpMail && otmpMail !== "unknown" && otmpMail !== "") {
					otmpMail = null;
				}
				
				if(otmpDN || otmpMail) {
					jobj.organizer = {};
					if (otmpDN) {
						jobj.organizer.displayName = otmpDN;
					}
					if (otmpMail) {
						jobj.organizer.mail = otmpMail;
					}
				}
				break;

			default:

			} // end switch
		} // end if
		cur = cur.nextSibling;
	} // end while

	com.synckolab.tools.logMessage("Parsed event in XML", com.synckolab.global.LOG_CAL + com.synckolab.global.LOG_DEBUG);
	return jobj;
};

/**
 * task status mapping from Lightning to xml
 * Kolabs "deferred" will be Lightning "CANCELLED"
 */
/* return the task status */
com.synckolab.calendarTools.getTaskStatus = function (tstatus, xmlvalue) {
	var arrstatus = [];
	arrstatus["IN-PROCESS"] = "in-progress";
	arrstatus["IN-PROGRESS"] = "in-progress";
	arrstatus["in-progress"] = "in-progress";
	arrstatus["in-process"] = "in-progress";
	arrstatus["NEEDS-ACTION"] = "waiting-on-someone-else";
	arrstatus["CANCELLED"] = "deferred";
	arrstatus["COMPLETED"] = "completed";
	
	var val = null;

	if (xmlvalue) {
		var info = arrstatus[tstatus];
		// not found = not-started
		if(!info) {
			val = "not-started";
		}
		else {
			val = arrstatus[tstatus];
		}
	}
	else {
		/* we want to return the Lightning value */
		for (var icalval in arrstatus) {
			if (arrstatus[icalval] === tstatus) {
				val =  icalval;
			}
		}
	}
	if(!val)
		return (xmlvalue ? "not-started" : "NONE");
	else
		return val;
};

/**
 * convert an ICAL event into a Kolab XML string representation,
 * allow to caller to skip fields which change frequently such as
 * "last-modification-date" because this can confuse the hash IDs.
 *
 * @param skipVolatiles skips problematic fields for hash creation
 * @return XML string in Kolab 2 format
 */
com.synckolab.calendarTools.json2xml = function (jobj, syncTasks, email) {
	// TODO  not working ATM:
	//	- yearly recurrence

	var xml = '<?xml version='+'"'+'1.0" encoding='+'"UTF-8"?>\n';
	if (jobj.type === "task")
	{
		xml += '<task version='+'"'+'1.0" >\n';
	}
	else {
		xml += '<event version='+'"'+'1.0" >\n';
	}
	
	xml += " <product-id>Synckolab " + com.synckolab.config.version + ", Calendar Sync</product-id>\n";
	xml += com.synckolab.tools.text.nodeWithContent("uid", jobj.uid, false);

	if(syncTasks === true)
	{
		// tasks have a status
		xml += com.synckolab.tools.text.nodeWithContent("status", jobj.status, false);
		xml += com.synckolab.tools.text.nodeWithContent("completed", jobj.completed, false);
		xml += com.synckolab.tools.text.nodeWithContent("start-date", jobj.startDate, false);
		xml += com.synckolab.tools.text.nodeWithContent("due-date", jobj.endDate, false);
		xml += com.synckolab.tools.text.nodeWithContent("priority", jobj.priority, false);
		
		// xml += " <completed-date>" + com.synckolab.tools.text.calDateTime2String(completedDate, true) + "</completed-date>\n";
	}
	else
	{
		xml += com.synckolab.tools.text.nodeWithContent("start-date", jobj.startDate, false);
		xml += com.synckolab.tools.text.nodeWithContent("end-date", jobj.endDate, false);
	}


	xml += com.synckolab.tools.text.nodeWithContent("summary", jobj.title, false);
	xml += com.synckolab.tools.text.nodeWithContent("body", jobj.body, false);
	xml += com.synckolab.tools.text.nodeWithContent("sensitivity", jobj.sensitivity, false);
	// xml += " <creation-date>" + jobj.createdDate + "</creation-date>\n";
	// xml += " <last-modification-date>" + jobj.lastModificationDate + "</last-modification-date>\n";
	xml += com.synckolab.tools.text.nodeWithContent("location", jobj.location, false);
	xml += com.synckolab.tools.text.nodeWithContent("show-time-as", jobj.showTimeAs, false);
	xml += com.synckolab.tools.text.nodeWithContent("color-label", jobj.colorLabel, false);

	var i;
	if(jobj.alarms) {
		for(i=0; i < jobj.alarms.length; i++) {
			var att = "";
			if (jobj.alarms[i].description && jobj.alarms[i].description !== "") {
				att += 'description="' + jobj.alarms[i].description + '" ';
			}
			if (jobj.alarms[i].summary && jobj.alarms[i].summary !== "") {
				att += 'summary="' + jobj.alarms[i].summary + '" ';
			}
			if (jobj.alarms[i].action && jobj.alarms[i].action !== "") {
				att += 'action="' + jobj.alarms[i].action + '"';
			}

			xml += " <alarm "+att+">" + jobj.alarms[i].offset + "</alarm>\n";
		}
	}

	xml += com.synckolab.tools.text.nodeWithContent("categories", jobj.categories, false);
	if(jobj.recurrence) {
		switch(jobj.recurrence.cycle) {
		case "daily":
			xml += " <recurrence cycle=\"daily\">\n";
			break;
		case "weekly":
			xml += " <recurrence cycle=\"weekly\">\n";
			for(i=0; i < jobj.recurrence.days.length; i++) {
				xml += com.synckolab.tools.text.nodeWithContent("day", jobj.recurrence.days[i], false);
			}
			break;
		case "monthly":
			if(!jobj.recurrence.daynumber && !jobj.recurrence.days) {
				xml += " <recurrence cycle=\"monthly\">\n";
			} else if(jobj.recurrence.days) {
				xml += " <recurrence cycle=\"monthly\" type=\"daynumber\">\n";
				for(i=0; i < jobj.recurrence.days.length; i++) {
					xml += com.synckolab.tools.text.nodeWithContent("daynumber", jobj.recurrence.days[i], false);
				}
			} else if(!jobj.recurrence.weekday) {
				xml += " <recurrence cycle=\"monthly\" type=\"daynumber\">\n";
				xml += "  <daynumber>" + jobj.recurrence.daynumber + "</daynumber>\n";
			} else {
				xml += " <recurrence cycle=\"monthly\" type=\"weekday\">\n";
				xml += "  <daynumber>" + jobj.recurrence.daynumber + "</daynumber>\n";
				xml += "  <day>" + jobj.recurrence.weekday + "</day>\n";
			} 
			break;
		case "yearly":
			// "weekday", monthday" or "yearday"
			// weekday has <day>, <daynumber> and <month>
			// FIXME weekday is not yet supported by Lightning
			//xml += " <recurrence cycle=\"yearly\" type=\"weekday\">\n";
			//xml += "  <day>tuesday</day>\n";
			//xml += "  <daynumber>2</daynumber>\n";
			//xml += "  <month>july</month>\n";

			// monthday has <daynumber> and <month>
			// FIXME monthday is not yet supported by Lightning
			//xml += " <recurrence cycle=\"yearly\" type=\"monthday\">\n";
			//xml += "  <daynumber>2</daynumber>\n";
			//xml += "  <month>july</month>\n";

			// yearday has <daynumber>
			xml += " <recurrence cycle=\"yearly\" type=\"yearday\">\n";
			// FIXME we have no matching field in Lighning yet
			xml += "  <daynumber>1</daynumber>\n";
			break;
		}
		
		xml += com.synckolab.tools.text.nodeWithContent("interval", jobj.recurrence.interval, true);
		if(jobj.recurrence.count && jobj.recurrence.count > 0) {
			xml += "  <range type=\"number\">" + jobj.recurrence.count + "</range>\n";
		} else if(jobj.recurrence.untilDate) {
			xml += "  <range type=\"date\">" + jobj.recurrence.untilDate + "</range>\n";
		} else {
			xml += "  <range type=\"none\"/>\n";
		}

		if(jobj.recurrence.exclusion) {
			for(i=0; i < jobj.recurrence.exclusion.length; i++) {
				xml += com.synckolab.tools.text.nodeWithContent("exclusion", jobj.recurrence.exclusion[i], true);
			}
		}
		
		xml += " </recurrence>\n";
	}
	
	if(jobj.attendees) {
		for(i=0; i < jobj.attendees.length; i++) {
			xml += " <attendee>\n";
			xml += com.synckolab.tools.text.nodeWithContent("display-name", jobj.attendees[i].displayName, false);
			xml += com.synckolab.tools.text.nodeWithContent("smtp-address", jobj.attendees[i].email, false);
			xml += com.synckolab.tools.text.nodeWithContent("status", jobj.attendees[i].status, false);
			xml += com.synckolab.tools.text.nodeWithContent("request-response", jobj.attendees[i].rsvp ? "true" : "false", false);
			xml += com.synckolab.tools.text.nodeWithContent("role", jobj.attendees[i].role, false);
			xml += " </attendee>\n";
		}
	}


	if (jobj.organizer)
	{
		xml += " <organizer>\n";
		xml += com.synckolab.tools.text.nodeWithContent("display-name", jobj.organizer.displayName, false);
		xml += com.synckolab.tools.text.nodeWithContent("smtp-address", jobj.organizer.email, false);
		xml += " </organizer>\n";
	}

	if (jobj.creator)
	{
		xml += " <creator>\n";
		xml += com.synckolab.tools.text.nodeWithContent("display-name", jobj.creator.displayName, false);
		xml += com.synckolab.tools.text.nodeWithContent("smtp-address", jobj.creator.email, false);
		xml += " </creator>\n";
	}


	xml += " <revision>0</revision>\n";	
	if (jobj.type === "task")
	{
		xml += "</task>\n";
	}
	else {
		xml += "</event>\n";
	}

	//com.synckolab.tools.logMessage("Created XML event structure:\n=============================\n" + xml, com.synckolab.global.LOG_CAL + com.synckolab.global.LOG_DEBUG);
	return xml;
};

/**
 * Write an event into human readable form
 */
com.synckolab.calendarTools.json2Human = function (jobj)
{
	var txt = "";
	if (jobj.title) {
		txt += "Summary: " + jobj.title +"\n";
	}

	if(jobj.type === "task")
	{
		if (jobj.startDate)
		{
			txt += "Start date: " + jobj.startDate + "\n";
			if (jobj.endDate) {
				txt += "End date: " + jobj.endDate + "\n\n";
			}
		}
	}
	if (jobj.body) {
		txt += jobj.body + "\n";
	}
	if (jobj.location) {
		txt += jobj.location +"\n";
	}
	return txt;
};

/**
 * convert an ICAL event into a Kolab 2 XML format message
 *
 * @return a message in Kolab 2 format
 */
com.synckolab.calendarTools.event2kolabXmlMsg = function (event, email)
{
	var syncTasks = (event.type === "task");
	var xml = this.json2xml(event, syncTasks);
	return com.synckolab.tools.generateMail(event.uid, email, "", syncTasks?"application/x-vnd.kolab.task":"application/x-vnd.kolab.event", 
			true, com.synckolab.tools.text.utf8.encode(xml), this.json2Human(event, syncTasks));
};



/**
 * functions to handle the iCal event format
 */
com.synckolab.calendarTools.ical2event = function (content, todo)
{
	var event;
	var icssrv = Components.classes["@mozilla.org/calendar/ics-service;1"]
	.getService(Components.interfaces.calIICSService);

	var rootComp = null;
	try
	{
		rootComp = icssrv.parseICS(content, null);
	}
	catch (ex)	{
		com.synckolab.tools.logMessage("unable to parse ical: " + content, com.synckolab.global.LOG_CAL + com.synckolab.global.LOG_ERROR);
		return null;
	}

	if (rootComp.componentType === 'VCALENDAR') {
		event = rootComp;
	} else 
		if (rootComp.componentType === 'VTODO') {
			event = rootComp;
		} else {
			event = rootComp.getFirstSubcomponent('VCALENDAR');
			if (!event)
			{
				event = rootComp.getFirstSubcomponent('VTODO');
			}
		}

	var subComp = event.getFirstSubcomponent("ANY");
	while (subComp) {
		if (subComp.componentType === "VEVENT") {
			event = Components.classes["@mozilla.org/calendar/event;1"]
			.createInstance(Components.interfaces.calIEvent);
			break;
		} else if (subComp.componentType === "VTODO") {
			event = Components.classes["@mozilla.org/calendar/todo;1"]
			.createInstance(Components.interfaces.calITodo);
			break;
		} else if (subComp.componentType !== "VTIMEZONE") {
			com.synckolab.tools.logMessage("unable to parse event 2: " + content, com.synckolab.global.LOG_CAL + com.synckolab.global.LOG_ERROR);
			return null;
		}
		subComp = event.getNextSubcomponent("ANY");
	}

	if (!subComp ) {
		com.synckolab.tools.logMessage("unable to parse event 3: " + content, com.synckolab.global.LOG_CAL + com.synckolab.global.LOG_ERROR);
		return null;
	}


	try	{
		event.icalComponent = subComp;
		com.synckolab.tools.logMessage("parsed event: " + event + ":" + event.id, com.synckolab.global.LOG_CAL + com.synckolab.global.LOG_INFO);
	}
	catch (exc)	{
		com.synckolab.tools.logMessage("unable to parse event: \n" + content, com.synckolab.global.LOG_CAL + com.synckolab.global.LOG_ERROR);
		return null;
	}
	return event;
};

