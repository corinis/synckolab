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
 * Contributor(s): Niko Berger <niko.berger@corinis.com>
 *				 Andreas Gungl <a.gungl@gmx.de>
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

if(!com) var com={};
if(!com.synckolab) com.synckolab={};

/* ----- general functions to access calendar and events ----- */

com.synckolab.calendarTools = {
	activeCalendarManager: null,
	
	/**
	 * New and updated calendar functions (lightning 0.1)
	 */
	getCalendarManager: function ()
	{
		if (!this.activeCalendarManager || this.activeCalendarManager == null) {
			this.activeCalendarManager = Components.classes["@mozilla.org/calendar/manager;1"]
			                                                .getService(Components.interfaces["calICalendarManager"]);
		}
	
		// create a new calendar if none exists
		if (this.activeCalendarManager.getCalendars({}).length == 0) {
			var homeCalendar = this.activeCalendarManager.createCalendar("storage", 
					makeURL("moz-profile-calendar://"));
			this.activeCalendarManager.registerCalendar(homeCalendar);
	
			var sbs = Components.classes["@mozilla.org/intl/stringbundle;1"]
			                             .getService(Components.interfaces.nsIStringBundleService);
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
			if (syncCalManager == null || !syncCalManager)
				return null;
			return syncCalManager.getCalendars({});
		}
		catch (e) {
			com.synckolab.tools.logMessage("Error getting calendars: " + e, com.synckolab.global.LOG_ERROR);
			return null;
		}
	},

	
	/**
	 * @return true if the calendar exists
	 */
	isCalendarAvailable: function ()
	{
		var syncCals = this.getCalendars();
		return syncCals != [] && syncCals != null;
	},
	
	/**
	 * @return the event with the given id
	 */
	findEvent: function(events, uid) {
		return events.get(uid);
	},
	
	/**
	 * returns the end date of an event.
	 * Because of changes in lightning 0.8 endDate requires startDate 
	 * to exist and is different for tasks/events
	 */
	getEndDate: function (cur, tasks)
	{
		if (tasks == true && cur.startDate !=null && cur.dueDate)
			return cur.dueDate.jsDate;

		if (tasks == false && cur.startDate !=null && cur.untilDate)
			return cur.untilDate.jsDate;

		if (tasks == false && cur.startDate !=null && cur.endDate)
			return cur.endDate.jsDate;
			
		return null;
	},
	

	/* 
	 * Set the property of an event / task
	 * This is taken from the lightning extension (calendar-event-dialog.js#938ff setItemProperty)
	 */
	setKolabItemProperty: function(item, propertyName, value) {
		try
		{
			switch(propertyName) {
			case "startDate":
				item.startDate = value;
				break;
			// endDate might be untilDate
			case "endDate":
				if (item.endDate)
					item.endDate = value;
				else
					item.untilDate = value;
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
				item.status = this.getTaskStatus(value,false);
				break;
			case "title":
				item.title = value;
				break;

			default:
				if (!value || value == "")
					item.deleteProperty(propertyName);
				else if (item.getProperty(propertyName) != value)
					item.setProperty(propertyName, value);
			break;
			}
		}
		catch (ex){
			com.synckolab.tools.logMessage("unable to set property: " + propertyName + " with value " + value, com.synckolab.global.LOG_CAL + com.synckolab.global.LOG_ERROR);
		}
	},


	isPrivateEvent: function (levent) {
		return (levent && levent.getProperty("CLASS") == "PRIVATE");
	},

	isConfidentialEvent: function(levent) {
		return (levent && levent.getProperty("CLASS") == "CONFIDENTIAL");
	},

	isPublicEvent: function(levent) {
		return (levent && !this.isPrivateEvent(levent) && 
				!this.isConfidentialEvent(levent));
	},

	/**
	 * insert an organizer if not existing and update  
	 */
	insertOrganizer: function(levent, lsyncCalendar) {
		if (levent.organizer)
			return levent;
		var modevent = levent.clone();
		organizer = Components.classes["@mozilla.org/calendar/attendee;1"].createInstance(Components.interfaces.calIAttendee);
		organizer.id = "MAILTO:" + lsyncCalendar.email;
		organizer.commonName = lsyncCalendar.name;
		organizer.participationStatus = "ACCEPTED";
		organizer.rsvp = false;
		organizer.role = "CHAIR";
		organizer.isOrganizer = true;
		modevent.organizer = organizer;
		/* set task status to NONE if it is NULL */
		if (lsyncCalendar.syncTasks && !levent.status)
			modevent.status="NONE";
		lsyncCalendar.gCalendar.modifyItem(modevent, levent, lsyncCalendar.gEvents);
		return modevent;
	},

	/**
	 * only ORGANIZER is allowed to change non-public events
	 */
	allowSyncEvent: function(levent, revent, lsyncCalendar) {
		var lpublic = this.isPublicEvent(levent);
		var rpublic = this.isPublicEvent(revent);
		if (lpublic && rpublic)
			return true;
		/*previous behaviour*/
		var rorgmail = lsyncCalendar.email;
		if (revent.organizer)
			rorgmail = revent.organizer.id.replace(/MAILTO:/i, '');
		var org2mail = (lsyncCalendar.email == rorgmail);
		com.synckolab.tools.logMessage("allowSyncEvent: " + org2mail + ":" + lpublic + ":" + rpublic, com.synckolab.global.LOG_CAL + com.synckolab.global.LOG_DEBUG );
		return org2mail;
	},

	/**
	 * sync local changes back to server version
	 */
	checkEventBeforeSync: function(fevent, revent, lsyncCalendar) {
		var rc = this.allowSyncEvent(fevent, revent, lsyncCalendar);
		if (!rc) {
			com.synckolab.tools.logMessage("Update local event with server one : " + revent.id, com.synckolab.global.LOG_CAL + com.synckolab.global.LOG_DEBUG );
			lsyncCalendar.curItemInListStatus.setAttribute("label", com.synckolab.global.strBundle.getString("localUpdate"));
			lsyncCalendar.gCalendar.modifyItem(revent, fevent, lsyncCalendar.gEvents);
		}
		return rc;
	},

	/**
	 * Event has changed from PUBLIC/CONFIDENTIAL to PRIVATE
	 */
	checkEventServerDeletion: function(fevent, revent, lsyncCalendar) {
		return (revent && 
				this.allowSyncEvent(fevent, revent, lsyncCalendar) && 
				this.isPrivateEvent(fevent));
	},

	/**
	 * delete event on Server and database but not in Thunderbird calendar
	 */
	deleteEventOnServer: function(fevent, pevent, lsyncCalendar) {
		if (!this.checkEventServerDeletion(fevent, pevent, lsyncCalendar))
			return false;
		var eventry = com.synckolab.tools.file.getSyncDbFile(lsyncCalendar.gConfig, lsyncCalendar.getType(), fevent.id);
		var fentry = com.synckolab.tools.file.getSyncFieldFile(lsyncCalendar.gConfig, lsyncCalendar.getType(), fevent.id);
		if (eventry.exists())
			eventry.remove(false);
		if (fentry.exists())
			fentry.remove(false);
		lsyncCalendar.curItemInListStatus.setAttribute("label", com.synckolab.global.strBundle.getString("deleteOnServer"));
		return true;
	},

	/**
	 * clear the description if event is confidential or private 
	 */
	modifyDescriptionOnExport: function(levent, syncTasks) {
		var myclass = levent.getProperty("CLASS");
		if (!this.isPublicEvent(levent)) {
			levent = levent.clone();
			tmpdesc = (syncTasks==true ? "Task" : "Event");
			levent.setProperty("DESCRIPTION",tmpdesc + " is " + myclass + "!");
		}
		return levent;
	},

	/**
	 * prepare event for export 
	 */
	modifyEventOnExport: function(levent, lsyncCalendar) {
		levent = this.insertOrganizer(levent, lsyncCalendar);
		levent = this.modifyDescriptionOnExport(levent, lsyncCalendar.syncTasks);
		return levent;
	},

	/**
	 * check Events and Todos on privacy changes and modify appropriately
	 **/
	checkEventOnDeletion: function(levent, pevent, lsyncCalendar) { 

		if (this.deleteEventOnServer(levent, pevent, lsyncCalendar)) 
			return "DELETEME";
		if (!this.checkEventBeforeSync(levent, pevent, lsyncCalendar)) 
			return null;
		return this.modifyDescriptionOnExport(levent, lsyncCalendar.syncTasks);
	}


};


/* ----- functions to handle the Kolab 2 XML event format ----- */

/**
 * This functions checks if two events are equals
 * TODO: make sure that event2xml does not create undesired behaviour when
 *   comparing iCal vs. XML
 */
com.synckolab.calendarTools.equalsEvent = function(a, b, syncTasks, email) {
	var sa = this.cnv_event2xml(a, true, syncTasks, email);
	var sb = this.cnv_event2xml(b, true, syncTasks, email);
	if (sa == sb)
		return true;

	// do a diff to see whats different
	var la = sa.split("\n");
	var lb = sb.split("\n");
	var i;
	for (i=0; i < la.length && i < lb.length; i++)
	{
		if (la[i] != lb[i])
		{
			com.synckolab.tools.logMessage("not equals: " + la[i] + " vs. " + lb[i], com.synckolab.global.LOG_CAL + com.synckolab.global.LOG_INFO );
		}
	}
	return false;
};

com.synckolab.calendarTools.message2Event = function(fileContent, extraFields, syncTasks) {
	if (fileContent == null)
		return null;
		
	var parsedEvent = null;
	if (fileContent.indexOf("<?xml") != -1 || fileContent.indexOf("<?XML") != -1)
	{
		if (syncTasks == true)
		{
			parsedEvent = Components.classes["@mozilla.org/calendar/todo;1"]
				.createInstance(Components.interfaces.calITodo);
		}
		else
			parsedEvent = Components.classes["@mozilla.org/calendar/event;1"]
				.createInstance(Components.interfaces.calIEvent);
		if (this.xml2Event(fileContent, extraFields, parsedEvent) == false)
		{
			return null;
		}
	}
	else
	{
		fileContent = com.synckolab.tools.text.utf8.decode(com.synckolab.tools.text.quoted.decode(fileContent));
		 // this.format == 'iCal'
		parsedEvent = this.ical2event(fileContent, syncTasks);
	}
	return parsedEvent;
};


/**
 * parse a string containing a Kolab XML message and put the information
 * in a preinitialized event object
 * Sometimes when syncing, there are empty events, that should not be put 
 * into calendar, so this function returns if we actually got an event
 *
 * @return true, if this event actually existed  
 */
com.synckolab.calendarTools.xml2Event = function(xml, extraFields, event)
{
	var syncTasks = false;
	// check if we have to decode quoted printable
	if (xml.indexOf(" version=3D") != -1) // we know from the version
		xml = com.synckolab.tools.text.quoted.decode(xml);
	
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
	// and nodeName == event. As we know the structure of Kolab XML for
	// events, this is a good place to sort out invalid XML structures.
	var topNode = doc.firstChild;
	if (topNode.nodeName == "parsererror")
	{
		// so this message has no valid XML part :-(
		com.synckolab.tools.logMessage("Error parsing the XML content of this message.\n" + xml, com.synckolab.global.LOG_CAL + com.synckolab.global.LOG_ERROR);
		return false;
	}
	if ((topNode.nodeType != Node.ELEMENT_NODE) || ((topNode.nodeName.toUpperCase() != "EVENT") && (topNode.nodeName.toUpperCase() != "TASK") ))
	{
		// this can't be an event in Kolab XML format
		com.synckolab.tools.logMessage("This message doesn't contain an event in Kolab XML format.\n" + xml, com.synckolab.global.LOG_CAL + com.synckolab.global.LOG_ERROR);
		return false;
	}

	// check for task
	if (topNode.nodeName.toUpperCase() == "TASK")
		syncTasks = true;
		
	if (syncTasks == true && event instanceof Components.interfaces.calIEvent)
	{
		com.synckolab.tools.logMessage("There is an event in the task folder! skipping\n" + event, com.synckolab.global.LOG_CAL + com.synckolab.global.LOG_WARNING);
		return false;
	}

	if (syncTasks == false && ! (event instanceof Components.interfaces.calIEvent))
	{
		com.synckolab.tools.logMessage("There is a task in the calendar folder! skipping\n" + event, com.synckolab.global.LOG_CAL + com.synckolab.global.LOG_WARNING);
		return false;
	}
		
	var cur = new com.synckolab.Node(topNode.firstChild);
	// iterate over the DOM tree of the XML structure of the event
	while(cur != null)
	{
		if (cur.nodeType == Node.ELEMENT_NODE)
		{
			switch (cur.nodeName.toUpperCase())
			{
				case "UID":
					event.id = cur.getFirstData();
					// FIXME - for faster debugging only, so you can see the 
					// uid resp. the msg subject in the URL field when opening the event, 
					// you can find the appropriate msg very easily afterwards
					this.setKolabItemProperty(event, "URL", cur.getFirstData());
					break;
					
				case "CREATION-DATE":
					if (!cur.firstChild)
						break;

					var s = cur.getFirstData();
					// 2005-03-30T15:28:52Z
					this.setKolabItemProperty(event, "CREATED", com.synckolab.tools.text.string2CalDateTime(s, true));
					break;						

				case "LAST-MODIFICATION-DATE":
					if (!cur.firstChild)
						break;

					var s = cur.getFirstData();
					// 2005-03-30T15:28:52Z
					this.setKolabItemProperty(event, "LAST-MODIFIED", com.synckolab.tools.text.string2CalDateTime(s, true));
					break;						

				// entry date and start date can be handled the same way 
				case "ENTRY-DATE":
				case "START-DATE":
					if (!cur.firstChild)
						break;
						
					var s = cur.getFirstData();
					// 2005-03-30T15:28:52Z
					if (s.indexOf(":") == -1)
					{
						var cDate = com.synckolab.tools.text.string2CalDate(s);
						cDate.isDate = true;
						// date values witout time part specify a full day event
						if (syncTasks == true)
							this.setKolabItemProperty(event, "entryDate", cDate);
						else
							this.setKolabItemProperty(event, "startDate", cDate);
					}
					else
					{
						if (syncTasks == true)
							this.setKolabItemProperty(event, "entryDate", com.synckolab.tools.text.string2CalDateTime(s, true));
						else
							this.setKolabItemProperty(event, "startDate", com.synckolab.tools.text.string2CalDateTime(s, true));
					}
					break;						

				// hande end date and due-date, completed-date the same way (completed date also sets the percent complete to 100)
				case "COMPLETED-DATE":
					if (syncTasks == true)
						this.setKolabItemProperty(event, "PERCENT-COMPLETE", 100);
				
				case "DUE-DATE":
				case "END-DATE":
					if (!cur.firstChild)
						break;

					var s = cur.getFirstData();
					// 2005-03-30T15:28:52Z
					if (s.indexOf(":") == -1) // full day event
					{
						// date values witout time part specify a full day event
						var cDate = com.synckolab.tools.text.string2CalDate(s);
						// Kolab uses for 1-day-event:
						// startdate = day_x, enddate = day_x
						// Sunbird uses for 1-day-event:
						// startdate = day_x, enddate = day_x + 1
						var tmp_date = cDate.jsDate;
						com.synckolab.tools.logMessage("Found EndDate: "+s+" - in time: " + tmp_date.getTime(), com.synckolab.global.LOG_DEBUG);
						tmp_date.setTime(tmp_date.getTime() + 24*60*60000);
						cDate.jsDate = tmp_date;
						cDate.isDate = true;

						// for tasks its endDate
						if (syncTasks == true)
							this.setKolabItemProperty(event, "dueDate", cDate);
						else
							this.setKolabItemProperty(event, "endDate", cDate);
					}
					else
					{
						if (syncTasks == true)
							this.setKolabItemProperty(event, "dueDate", com.synckolab.tools.text.string2CalDateTime(s, true));
						else
							this.setKolabItemProperty(event, "endDate", com.synckolab.tools.text.string2CalDateTime(s, true));
					}
					break;						

				case "PRIORITY":
					// only tasks 
					if (syncTasks == false)
						break;
					if (cur.firstChild)
						this.setKolabItemProperty(event, "priority", cur.firstChild.data);
					break;

				case "STATUS":
					// only tasks 
					if (syncTasks == false)
						break;
					if (!cur.firstChild)
						break;
						
					var cStatus = cur.firstChild.data;
					this.setKolabItemProperty(event, "status", cStatus);
					
					break;
										
				case "COMPLETED":
					// only tasks have a completed field
					if (syncTasks == false)
						break;

					var iComplete = 0;
					if (cur.firstChild)
					{
						iComplete = parseInt(cur.firstChild.data);
					}
					
					if (iComplete < 0)
						iComplete = 0;
					else
					if (iComplete > 100)
						iComplete = 100;
					
					this.setKolabItemProperty(event, "PERCENT-COMPLETE", iComplete);
					break;
					
				case "SUMMARY":
					if (cur.firstChild)
					{
						var data = cur.getFirstData();
						if (data != '' && data != 'null' && data != null)
							this.setKolabItemProperty(event, "title", cur.getFirstData());
					}
					break;

				case "BODY":
					// sometimes we have <body></body> in the XML
					if (cur.firstChild)
					{
						var cnotes = cur.getFirstData();
						this.setKolabItemProperty(event, "DESCRIPTION", cnotes);
					}
					break;
		
				case "CREATOR":
					this.setKolabItemProperty(event, "X-KOLAB-CREATOR-DISPLAY-NAME", cur.getXmlResult("DISPLAY-NAME", ""));
					this.setKolabItemProperty(event, "X-KOLAB-CREATOR-SMTP-ADDRESS", cur.getXmlResult("SMTP-ADDRESS", ""));
					break;
					
				case "ORGANIZER":
					organizer = Components.classes["@mozilla.org/calendar/attendee;1"]
										  .createInstance(Components.interfaces.calIAttendee);
					organizer.id = "MAILTO:" + cur.getXmlResult("SMTP-ADDRESS", "unknown");
					organizer.commonName = cur.getXmlResult("DISPLAY-NAME", "");
					organizer.participationStatus = "ACCEPTED";
					organizer.rsvp = false;
					organizer.role = "CHAIR";
					organizer.isOrganizer = true;
					event.organizer = organizer;
					break;
					
				case "LOCATION":
					// sometimes we have <location></location> in the XML
					if (cur.firstChild)
						this.setKolabItemProperty(event, "LOCATION", cur.getFirstData());
					break;

				case "CATEGORIES":
					if (cur.firstChild)
					{
						if (!event.setCategories) {
							this.setKolabItemProperty(event, "CATEGORIES", cur.getFirstData());
							break;
						}
						var cattxt = cur.getFirstData();
						if (cattxt) {
							// from calUtils.js
							var categories = categoriesStringToArray(cattxt);
							event.setCategories(categories.length, categories);
						}
					}
					break;

				case "ALARM":
					if (cur.firstChild)
					{
						var cData = cur.getFirstData();
						var alarmOffset = com.synckolab.tools.text.createDuration(Number(cData));
						
						// tbird 3 uses multiple alarms (using addAlarm)
						if (event.addAlarm)
						{
							var alarm = Components.classes["@mozilla.org/calendar/alarm;1"].createInstance(Components.interfaces.calIAlarm);
							alarm.related = 1; // 1: related to startdate - 2: related to enddate
							alarm.offset = alarmOffset;
							// optional attributes
							if (cur.getAttribute("description") != null)
								alarm.description = cur.getAttribute("description");
							if (cur.getAttribute("summary") != null)
								alarm.summary = cur.getAttribute("summary");
							if (cur.getAttribute("action") != null)
								alarm.action = cur.getAttribute("action");
							event.addAlarm(alarm);
						}
						else
							event.alarmOffset = alarmOffset;
					}
					break;
					
				case "SENSITIVITY":
					this.setKolabItemProperty(event, "CLASS", 'PUBLIC');
					if (cur.firstChild)
						switch (cur.getFirstData())
						{
							case "private":
								this.setKolabItemProperty(event, "CLASS", 'PRIVATE');
								break;
							case "confidential":
								this.setKolabItemProperty(event, "CLASS", 'CONFIDENTIAL');
								break;
						}
					break;

				case "RECURRENCE":
					com.synckolab.tools.logMessage("Parsing recurring event: " + event.id, com.synckolab.global.LOG_CAL + com.synckolab.global.LOG_INFO);
					recInfo = Components.classes["@mozilla.org/calendar/recurrence-info;1"] 
						.createInstance(Components.interfaces.calIRecurrenceInfo);
					recInfo.item = event;
					recRule = Components.classes["@mozilla.org/calendar/recurrence-rule;1"] 
						.createInstance(Components.interfaces.calIRecurrenceRule);
					// read the "cycle" attribute for the units and
					// map the Kolab XML values to the Sunbird values
					units = cur.getAttribute("cycle");
					if (units == null)
						units = "weekly";
					recRule.type = units.toUpperCase();
					switch (recRule.type)
					{
						case "DAILY":
							// nothing else to do here
							break;
						case "WEEKLY":
							// need to process the <day> value here
							var onDays = [];
							var recur = cur.firstChild;
							// iterate over the DOM subtre
							while(recur != null)
							{
								if ((recur.nodeType == Node.ELEMENT_NODE)
								   && (recur.nodeName.toUpperCase() == "DAY"))
								{
									var day = recur.firstChild.data;
									onDays.push(com.synckolab.tools.kolab.getDayIndex(day));
								}
								recur = recur.nextSibling;
							}
							if (onDays.length > 0)
								recRule.setComponent("BYDAY", onDays.length, onDays);
							break;
						case "MONTHLY":
							// need to process extra type "type" which can be
							// "daynumber" or "weekday"
							mode = cur.getAttribute("type");
							switch (mode.toUpperCase())
							{
								case "DAYNUMBER":
									// daynumber has <daynumber>
									var detail = cur.getChildNode("daynumber");
									if ((detail != null)
										&& (detail.nodeType == Node.ELEMENT_NODE)
										&& (detail.nodeName.toUpperCase() == "DAYNUMBER"))
									{
										var daynumber = detail.firstChild.data;
										recRule.setComponent("BYMONTHDAY", 1, [daynumber]);
									}
									break;
								case "WEEKDAY":
									// weekday has <daynumber> and <day>
									var detail = cur.firstChild;
									var day;
									var daynumber;
									var dayindex;
									while(detail != null)
									{
										if ((detail.nodeType == Node.ELEMENT_NODE)
											&& (detail.nodeName.toUpperCase() == "DAY"))
										{
											day = detail.firstChild.data;
										}
										if ((detail.nodeType == Node.ELEMENT_NODE)
											&& (detail.nodeName.toUpperCase() == "DAYNUMBER"))
										{
											daynumber = detail.firstChild.data;
										}
										detail = detail.nextSibling;
									}
									dayindex = com.synckolab.tools.kolab.getDayIndex(day);
									if (daynumber == -1)
										recRule.setComponent("BYDAY", 1, [(-1)*(8+dayindex)]);
									else
										recRule.setComponent("BYDAY", 1, [daynumber*8 + dayindex]);
									break;
							}
							break;
						case "YEARLY":
							// need to process extra type "type" which can be
							// "weekday", monthday" or "yearday"
							mode = cur.getAttribute("type");
							var day;
							var daynumber;
							var month;
							switch (mode.toUpperCase())
							{
								case "YEARDAY":
									// yearday has <daynumber>
									var detail = cur.firstChild;
									if ((detail != null)
										&& (detail.nodeType == Node.ELEMENT_NODE)
										&& (detail.nodeName.toUpperCase() == "DAYNUMBER"))
									{
										daynumber = detail.firstChild.data;
										// FIXME this needs to be written to the event when supported by Lightning
									}
									break;
								case "MONTHDAY":
									// monthday has <daynumber> and <month>
									var detail = cur.firstChild;
									var day;
									var daynumber;
									while(detail != null)
									{
										if ((detail.nodeType == Node.ELEMENT_NODE)
											&& (detail.nodeName.toUpperCase() == "MONTH"))
										{
											month = detail.firstChild.data;
										}
										if ((detail.nodeType == Node.ELEMENT_NODE)
											&& (detail.nodeName.toUpperCase() == "DAYNUMBER"))
										{
											daynumber = detail.firstChild.data;
										}
										detail = detail.nextSibling;
									}
									// FIXME this needs to be written to the event when supported by Lightning
									break;
								case "WEEKDAY":
									// weekday has <day>, <daynumber> and <month>
									var detail = cur.firstChild;
									while(detail != null)
									{
										if ((detail.nodeType == Node.ELEMENT_NODE)
											&& (detail.nodeName.toUpperCase() == "DAY"))
										{
											day = detail.firstChild.data;
										}
										if ((detail.nodeType == Node.ELEMENT_NODE)
											&& (detail.nodeName.toUpperCase() == "MONTH"))
										{
											month = detail.firstChild.data;
										}
										if ((detail.nodeType == Node.ELEMENT_NODE)
											&& (detail.nodeName.toUpperCase() == "DAYNUMBER"))
										{
											daynumber = detail.firstChild.data;
										}
										detail = detail.nextSibling;
									}
									// FIXME this needs to be written to the event when supported by Lightning
									break;
							}
							break;
					}
					
					recRule.interval = cur.getXmlResult("INTERVAL", "1");
					var node = new com.synckolab.Node(cur.getChildNode("RANGE"));
					if (node != null)
					{
						// read the "type" attribute of the range
						var rangeType = node.getAttribute("type");
						if (rangeType != null)
						{
							var rangeSpec = cur.getXmlResult("RANGE", "dummy");
							switch (rangeType.toUpperCase())
							{
								case "DATE":
									if (rangeSpec != "dummy")
									{
										// XML type is Date, not DateTime
										if (recRule.endDate)
											recRule.endDate = com.synckolab.tools.text.string2CalDate(rangeSpec);
										else
										// new lighnting
											recRule.untilDate = com.synckolab.tools.text.string2CalDate(rangeSpec);
									}
									else
										recRule.count = -1;
									break;
								case "NUMBER":
									if (rangeSpec != "dummy")
										recRule.count = rangeSpec;
									else
										recRule.count = 1;
									break;
								case "NONE":
									recRule.count = -1;
									break;
							}
						}
					}
					else
					{
						// no range set
						recRule.count = -1;
					}
					
					recInfo.insertRecurrenceItemAt(recRule, 0);
					// read 0..n exclusions
					var node = cur.firstChild;
					while(node != null)
					{
						if(node.nodeType == Node.ELEMENT_NODE && (node.nodeName.toUpperCase() == "EXCLUSION"))
						{
							date = com.synckolab.tools.text.string2CalDate(node.firstChild.data);
							recInfo.removeOccurrenceAt(date);
							var exclusion = recInfo.getOccurrenceFor(date,true);
							recInfo.modifyException(exclusion, true);
						}
						node = node.nextSibling;
					}
					event.recurrenceInfo = recInfo;
					break;
	
				case "ATTENDEE":
					attendee = Components.classes["@mozilla.org/calendar/attendee;1"]
										 .createInstance(Components.interfaces.calIAttendee);
					attendee.id = "MAILTO:" + cur.getXmlResult("SMTP-ADDRESS", "unknown");
					attendee.commonName = cur.getXmlResult("DISPLAY-NAME", "");
					// The status must be one of none, tentative, accepted, or declined.
					switch (cur.getXmlResult("STATUS", "none"))
					{
						case "tentative":
							attendee.participationStatus = "TENTATIVE";
							break;
						case "accepted":
							attendee.participationStatus = "ACCEPTED";
							break;
						case "declined":
							attendee.participationStatus = "DECLINED";
							break;
						default:
							attendee.participationStatus = "NEEDS-ACTION";
					}
					// The request response status is true or false
					if (cur.getXmlResult("REQUEST-RESPONSE", "false") == "true")
						attendee.rsvp = true;
					else
						attendee.rsvp = false;
					// Role is one of required, optional, or resource.
					switch (cur.getXmlResult("ROLE", "optional"))
					{
						case "required":
							attendee.role = "REQ-PARTICIPANT";
							break;
						case "optional":
							attendee.role = "OPT-PARTICIPANT";
							break;
						case "resource":
							// FIXME it's currently the only way to map a "resource" attendee
							attendee.role = "NON-PARTICIPANT";
							break;
						default:
							attendee.role = "NON-PARTICIPANT";
					}
					attendee.isOrganizer = false;
					event.addAttendee(attendee);
					// "invitation-sent" is missing, it can be "true" or false"
					break;
					
				case "SHOW-TIME-AS":
					// default is "none"
			  		this.setKolabItemProperty(event, "X-KOLAB-SHOW-TIME-AS", cur.getFirstData());
					break;
					
				case "COLOR-LABEL":
					// default is "none"
					this.setKolabItemProperty(event, "X-KOLAB-COLOR-LABEL", cur.getFirstData());
					break;

				default:
					if (cur.firstChild == null)
						break;
				// remember other fields
				if (extraFields)
					extraFields.addField(cur.nodeName, cur.getFirstData());
				break;

			} // end switch
		} // end if
		cur = cur.nextSibling;
	} // end while
	
	com.synckolab.tools.logMessage("Parsed event in XML", com.synckolab.global.LOG_CAL + com.synckolab.global.LOG_DEBUG);
	return true;
};


/**
 * convert an ICAL event into a Kolab XML string representation
 * and include all fields
 *
 * @return XML string in Kolab 2 format
 */
com.synckolab.calendarTools.event2xml = function (event, syncTasks, email)
{
	return this.cnv_event2xml( event, false, syncTasks, email);
};



/**
 * task status mapping from Lightning to xml
 * Kolabs "deferred" will be Lightning "CANCELLED"
 */

/* return the task status */
com.synckolab.calendarTools.getTaskStatus = function(tstatus, xmlvalue) {
	arrstatus = new Array();
	arrstatus["IN-PROCESS"] = "in-progress";
	arrstatus["NEEDS-ACTION"]="waiting-on-someone-else";
	arrstatus["NONE"]="not-started";
	arrstatus["CANCELLED"]="deferred";
	arrstatus["COMPLETED"]="completed";

	if (xmlvalue)
		return arrstatus[tstatus];
	/* we want to return the Lightning value */
	for (var icalval in arrstatus) {
		if (arrstatus[icalval] == tstatus)
			return icalval;
	}
	return (xmlvalue==true ? "not-started" : "NONE");
};

/**
 * convert an ICAL event into a Kolab XML string representation,
 * allow to caller to skip fields which change frequently such as
 * "last-modification-date" because this can confuse the hash IDs.
 *
 * @param skipVolatiles skips problematic fields for hash creation
 * @return XML string in Kolab 2 format
 */
com.synckolab.calendarTools.cnv_event2xml = function(event, skipVolatiles, syncTasks, email) {
	// TODO  not working ATM:
	//	- yearly recurrence
	
	var isAllDay = (syncTasks==true)?false:(event.startDate?event.startDate.isDate:false);
	var endDate = this.getEndDate(event, syncTasks);

	// correct the end date for all day events before writing the XML object
	// Kolab uses for 1-day-event:
	// startdate = day_x, enddate = day_x
	// Sunbird uses for 1-day-event:
	// startdate = day_x, enddate = day_x + 1
	if (isAllDay && endDate && endDate != null )
	{
		var tmp_date = endDate;
		tmp_date.setTime(tmp_date.getTime() - 24*60*60000);
		// lightning 0.9pre fix
		if (createDateTime)
			endDate = new createDateTime();
		else
			endDate = new CalDateTime();

		endDate.jsDate = tmp_date;
	}

	var xml = '<?xml version='+'"'+'1.0" encoding='+'"UTF-8"?>\n';
	if (syncTasks == true)
	{
		xml += '<task version='+'"'+'1.0" >\n';
		
		// tasks have a status
		if (event.isCompleted || event.percentComplete == 100) {
			xml += " <completed>100</completed>\n";	
			xml += " <status>completed</status>\n";
		}
		else	{
			xml += " <status>" + this.getTaskStatus(event.status, true) + "</status>\n";
			xml += " <completed>" + event.percentComplete +"</completed>\n";
		}
	}
	else
		xml += '<event version='+'"'+'1.0" >\n';
	if (skipVolatiles != true)
		xml += " <product-id>Synckolab " + com.synckolab.config.version + ", Calendar Sync</product-id>\n";

	xml += " <uid>" + event.id + "</uid>\n";
	
	if(syncTasks == true)
	{
		xml += " <start-date>" + com.synckolab.tools.text.calDateTime2String(event.entryDate, isAllDay) + "</start-date>\n";
		xml += " <due-date>" + com.synckolab.tools.text.calDateTime2String(endDate, isAllDay) + "</due-date>\n";
		/*
		if (!skipVolatiles)
			xml += " <completed-date>" + com.synckolab.tools.text.calDateTime2String(completedDate, true) + "</completed-date>\n";
		*/
	}
	else
	{
		xml += " <start-date>" + com.synckolab.tools.text.calDateTime2String(event.startDate, isAllDay) + "</start-date>\n";
		xml += " <end-date>" + com.synckolab.tools.text.calDateTime2String(endDate, isAllDay) + "</end-date>\n";
	 }
	
	
	xml += " <summary>" + com.synckolab.tools.text.encode4XML(event.title) +"</summary>\n";

	if (skipVolatiles != true)
	{
		xml += " <creation-date>" + com.synckolab.tools.text.calDateTime2String(event.getProperty("CREATED"), false) + "</creation-date>\n";
		xml += " <last-modification-date>" + com.synckolab.tools.text.calDateTime2String(event.getProperty("LAST-MODIFIED"), false) + "</last-modification-date>\n";
	}

	// description only for public events
	if (event.getProperty("DESCRIPTION") &&
			(this.isPublicEvent(event) || !skipVolatiles))
		xml += " <body>" + com.synckolab.tools.text.encode4XML(event.getProperty("DESCRIPTION")) + "</body>\n";
	
	if (event.getProperty("CLASS"))
		xml += " <sensitivity>" + event.getProperty("CLASS").toLowerCase() + "</sensitivity>\n";
	else
		xml += " <sensitivity>public</sensitivity>\n";
	
	if (event.getProperty("LOCATION"))
		xml += " <location>" + com.synckolab.tools.text.encode4XML(event.getProperty("LOCATION")) +"</location>\n";
	// tbird 3: allow multiple alarms
	if (event.getAlarms)
	{
		// Alarms (only allow relative alarms)
		for each (let alarm in event.getAlarms({})) {
			// skip abolute ALARM_RELATED_ABSOLUTE = 0;
			if (alarm.related == 0)
				continue;
			var minutes = Math.floor(Math.abs(alarm.offset.inSeconds)/60);
			
			// tbird 3 has some other attributes which we should take care of
			var att = "";
			if (alarm.description != null && alarm.description != "")
				att += 'description="' + alarm.description + '" ';
			if (alarm.summary != null && alarm.summary != "")
				att += 'summary="' + alarm.summary + '" ';
			if (alarm.action != null && alarm.action != "")
				att += 'action="' + alarm.action + '"';
			
			xml += " <alarm "+att+">" + minutes + "</alarm>\n";
		}
	}
	else
	// tbird 2
	if (event.alarmOffset && event.alarmOffset.inSeconds != 0)
	{
		var minutes = Math.floor(Math.abs(event.alarmOffset.inSeconds)/60);
		xml += " <alarm>" + minutes + "</alarm>\n";
	}
	
	// lighnting 0.9 (thanks to Pavlic)
	if (event.getCategories)
	{
		var catarray = event.getCategories({});
		if (catarray.length > 0 ) {
			xml += " <categories>";
			for (cnt = 0; cnt < catarray.length; cnt++) {
				xml += com.synckolab.tools.text.encode4XML(catarray[cnt]) ;
				if ( (cnt+1) < catarray.length)
					xml += ",";
				}
			xml += "</categories>\n";
			}
	}
	else
	{
		if (event.getProperty("CATEGORIES"))
			xml += " <categories>" + com.synckolab.tools.text.encode4XML(event.getProperty("CATEGORIES")) + "</categories>\n";
		else
		if (event.getProperty("CATEGORY"))
			xml += " <categories>" + com.synckolab.tools.text.encode4XML(event.getProperty("CATEGORY")) + "</categories>\n";
	}

	var recInfo = event.recurrenceInfo;
	if (syncTasks != true && recInfo && recInfo.countRecurrenceItems() >= 1)
	{
		// read the first recurrence rule and process it
		recRule = recInfo.getRecurrenceItemAt(0);
		switch (recRule.type)
		{
			case "DAILY":
				xml += " <recurrence cycle=\"daily\">\n";
				break;
			case "WEEKLY":
				xml += " <recurrence cycle=\"weekly\">\n";
				// need to process the <day> value here
				for each (var i in recRule.getComponent("BYDAY", {})) {
					xml += "  <day>" + com.synckolab.tools.kolab.getXmlDayName(i) + "</day>\n";
				}
				break;
			case "MONTHLY":
				// "daynumber" or "weekday"
				var days = recRule.getComponent("BYMONTHDAY", {});
				if (days && days.length > 0 && days[0]) {
					// daynumber has <daynumber>
					xml += " <recurrence cycle=\"monthly\" type=\"daynumber\">\n";
					xml += "  <daynumber>" + days[0] + "</daynumber>\n";
				}
				else
				{
					xml += " <recurrence cycle=\"monthly\" type=\"weekday\">\n";
					// weekday has <daynumber> and <day>
					days = recRule.getComponent("BYDAY", {});
					if (days && days.length > 0 && days[0] > 0)
					{
						dayindex = days[0] % 8;
						daynumber = (days[0] - dayindex) / 8;
						xml += "  <daynumber>" + daynumber + "</daynumber>\n";
						xml += "  <day>" + com.synckolab.tools.kolab.getXmlDayName(dayindex) + "</day>\n";
					}
					else
					{
						xml += "  <daynumber>-1</daynumber>\n";
						if (days && days.length > 0 && days[0] < 0)
							dayindex = days[0] * -1 - 8;
						else
							dayindex = 1;
						xml += "  <day>" + com.synckolab.tools.kolab.getXmlDayName(dayindex) + "</day>\n";
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
				xml += " <recurrence cycle=\"yearly\" type=\"yearday\">\n";
				// FIXME we have no matching field in Lighning yet
				xml += "  <daynumber>1</daynumber>\n";
				break;
			// no recurrence
			default:
				recInfo = null;
		}
		// we still might not have a reccurence :)
		if (recInfo != null)
		{
			xml += "  <interval>" + recRule.interval + "</interval>\n";
			if (recRule.isByCount)
			{
				if (recRule.count > 0)
					xml += "  <range type=\"number\">" + recRule.count + "</range>\n";
				else
					xml += "  <range type=\"none\"/>\n";
			}
			else
			{
				
				var endDate = recRule.endDate;
				// new lightning
				if (!endDate)
					endDate = recRule.untilDate;
				
				if (endDate)
					xml += "  <range type=\"date\">" + com.synckolab.tools.text.date2String(endDate.jsDate) + "</range>\n";
				else
					xml += "  <range type=\"none\"/>\n";
			}
	
			var items = recInfo.getRecurrenceItems({});
			for (var i in items)
			{
				var item = items[i];
				if (item.isNegative)
					xml += "  <exclusion>" + com.synckolab.tools.text.calDateTime2String(item.date, true) + "</exclusion>\n";
			}
			xml += " </recurrence>\n";
		}
	}

	var attendees = event.getAttendees({});
	if (syncTasks != true && attendees && attendees.length > 0) 
	{
		for each (var attendee in attendees) 
		{
			mail = attendee.id.replace(/MAILTO:/i, '');
				var status = "none";
				switch (attendee.participationStatus)
				{
					case "TENTATIVE":
						status = "tentative";
						break;
					case "ACCEPTED":
						status = "accepted";
						break;
					case "DECLINED":
						status = "declined";
						break;
					case "NEEDS-ACTION":
						status = "none";
						break;
				}
				xml += " <attendee>\n";
				xml += "  <display-name>" + com.synckolab.tools.text.encode4XML(attendee.commonName) + "</display-name>\n";
				xml += "  <smtp-address>" + com.synckolab.tools.text.encode4XML(mail) + "</smtp-address>\n";
				xml += "  <status>" + status + "</status>\n";
				xml += "  <request-response>" + (attendee.rsvp ? "true" : "false") + "</request-response>\n";
				switch (attendee.role)
				{
					case "REQ-PARTICIPANT":
						xml += "  <role>required</role>\n";
						break;
					case "OPT-PARTICIPANT":
						xml += "  <role>optional</role>\n";
						break;
					case "NON-PARTICIPANT":
						xml += "  <role>resource</role>\n";
						break;
					default:
						xml += "  <role>required</role>\n";
				}
				xml += " </attendee>\n";
		}
	}

	if ( event.organizer )
	{
		xml += " <organizer>\n";
		xml += "  <display-name>" + com.synckolab.tools.text.encode4XML(event.organizer.commonName) + "</display-name>\n";
		xml += "  <smtp-address>" + com.synckolab.tools.text.encode4XML(event.organizer.id.replace(/MAILTO:/i, '')) + "</smtp-address>\n";
		xml += " </organizer>\n";
	}

	if (event.getProperty("X-KOLAB-SHOW-TIME-AS"))
		xml += " <show-time-as>" + event.getProperty("X-KOLAB-SHOW-TIME-AS") + "</show-time-as>\n";
	else // make sure we mark new events as busy - TODO validate this 
		xml += " <show-time-as>busy</show-time-as>\n";
		
	if (event.getProperty("X-KOLAB-COLOR-LABEL"))
		xml += " <color-label>" + com.synckolab.tools.text.encode4XML(event.getProperty("X-KOLAB-COLOR-LABEL")) + "</color-label>\n";
	if (event.getProperty("X-KOLAB-CREATOR-DISPLAY-NAME") && event.getProperty("X-KOLAB-CREATOR-SMTP-ADDRESS"))
	{
		xml += " <creator>\n";
		xml += "  <display-name>" + com.synckolab.tools.text.encode4XML(event.getProperty("X-KOLAB-CREATOR-DISPLAY-NAME")) + "</display-name>\n";
		xml += "  <smtp-address>" + com.synckolab.tools.text.encode4XML(event.getProperty("X-KOLAB-CREATOR-SMTP-ADDRESS")) + "</smtp-address>\n";
		xml += " </creator>\n";
	}

	xml += " <revision>0</revision>\n";	
	if (syncTasks == true)
	{
		xml += " <priority>" + com.synckolab.tools.text.encode4XML(event.priority) + "</priority>\n";
		xml += "</task>\n";
	}
	else
		xml += "</event>\n";

	//com.synckolab.tools.logMessage("Created XML event structure:\n=============================\n" + xml, com.synckolab.global.LOG_CAL + com.synckolab.global.LOG_DEBUG);
	return xml;
};

/**
 * Write an event into human readable form
 */
com.synckolab.calendarTools.event2Human = function(event, syncTasks)
{
	var txt = "";
	if (event.title != null)
		txt += "Summary: " + event.title +"\n";
	
	if(syncTasks == false)
	{
		var isAllDay = event.startDate?event.startDate.isDate:false;
		if (event.startDate)
		{
			txt += "Start date: " + com.synckolab.tools.text.calDateTime2String(event.startDate, isAllDay) + "\n";
			var endDate = event.endDate;
			if (event.endDate)		
				txt += "End date: " + com.synckolab.tools.text.calDateTime2String(endDate, isAllDay) + "\n\n";
		}
	}
	if (event.getProperty("DESCRIPTION"))
	   txt += event.getProperty("DESCRIPTION") + "\n";
	if (event.getProperty("LOCATION"))
	   txt += event.getProperty("LOCATION") +"\n";
	return txt;
}

/**
 * convert an ICAL event into a Kolab 2 XML format message
 *
 * @return a message in Kolab 2 format
 */
com.synckolab.calendarTools.event2kolabXmlMsg = function (event, email, syncTasks)
{
	var xml = this.event2xml(event, syncTasks, email);
	var my_msg = com.synckolab.tools.generateMail(event.id, email, "", syncTasks?"application/x-vnd.kolab.task":"application/x-vnd.kolab.event", 
			true, com.synckolab.tools.text.utf8.encode(xml), this.event2Human(event, syncTasks));
	return my_msg;
};



/**
 * functions to handle the iCal event format
 */
com.synckolab.calendarTools.ical2event = function(content, todo)
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

	if (rootComp.componentType == 'VCALENDAR') {
		event = rootComp;
	} else 
	if (rootComp.componentType == 'VTODO') {
		event = rootComp;
	} else 	{
		event = rootComp.getFirstSubcomponent('VCALENDAR');
		if (!event)
		{
			event = rootComp.getFirstSubcomponent('VTODO');
		}
	}
	
	var subComp = event.getFirstSubcomponent("ANY");
	while (subComp) {
		if (subComp.componentType == "VEVENT") {
			event = Components.classes["@mozilla.org/calendar/event;1"]
			                           .createInstance(Components.interfaces.calIEvent);
			break;
	} else if (subComp.componentType == "VTODO") {
		event = Components.classes["@mozilla.org/calendar/todo;1"]
	                     .createInstance(Components.interfaces.calITodo);
		break;
	} else if (subComp.componentType != "VTIMEZONE") {
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

