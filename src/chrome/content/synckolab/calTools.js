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


/* ----- general functions to access calendar and events ----- */

var activeCalendarManager = null;

/**
 * New and updated calendar functions (lightning 0.1)
 */
function getSynckolabCalendarManager()
{
	if (!activeCalendarManager || activeCalendarManager == null) {
		 activeCalendarManager = Components.classes["@mozilla.org/calendar/manager;1"]
										   .getService(Components.interfaces["calICalendarManager"]);
	 }
 
	 if (activeCalendarManager.getCalendars({}).length == 0) {
		 var homeCalendar = activeCalendarManager.createCalendar("storage", 
							makeURL("moz-profile-calendar://"));
		 activeCalendarManager.registerCalendar(homeCalendar);
 
		 var sbs = Components.classes["@mozilla.org/intl/stringbundle;1"]
							 .getService(Components.interfaces.nsIStringBundleService);
		 var props = sbs.createBundle("chrome://calendar/locale/calendar.properties");
		 homeCalendar.name = props.GetStringFromName("homeCalendarName");
 
		 var composite = getCompositeCalendar();
		 composite.addCalendar(homeCalendar);
		 // XXX this doesn't make it selected, but you do add to it
	 }
	 return activeCalendarManager;
}

 
/**
 * Returns a list of calendars (calICalendar)
 */
function getSynckolabCalendars()
{
	 try {
	 	 var syncCalManager = getSynckolabCalendarManager();
	 	 if (syncCalManager == null || !syncCalManager)
	 	 	return null;
		 return syncCalManager.getCalendars({});
	}
	catch (e) {
		logMessage("Error getting calendars: " + e, LOG_ERROR);
		 return null;
	}
}


/**
 * @return true if the calendar exists
 */
function isCalendarAvailable ()
{
	var syncCals = getSynckolabCalendars();
	return syncCals != [] && syncCals != null;
}


/**
 * @return the event with the given id
 */
function findEvent(events, uid)
{
	return events.get(uid);
}


/* ----- functions to handle the Kolab 2 XML event format ----- */

/**
 * return the name of the week day like it is expected
 * by the Kolab 2 XML format
 *
 * @parm index The index of the day in the week starting with 1 => Sunday
 *
 * @return a string with the name of the week day
 */
function getKolabXmlDayName (index)
{
	var name = "sunday";
	switch (index)
	{
		case 1:
			name = "sunday";
			break;
		case 2:
			name = "monday";
			break;
		case 3:
			name = "tuesday";
			break;
		case 4:
			name = "wednesday";
			break;
		case 5:
			name = "thursday";
			break;
		case 6:
			name = "friday";
			break;
		case 7:
			name = "saturday";
			break;
	}
	return name;
}


/**
 * return the index for name of the week day used by the Kolab 2 XML format
 *
 * @parm name a string with the name of the week day
 *
 * @return The index of the day in the week starting with 1 => Sunday
 */
function getDayIndex (name)
{
	var index = 1;
	switch (name.toLowerCase())
	{
		case "sunday":
			index = 1;
			break;
		case "monday":
			index = 2;
			break;
		case "tuesday":
			index = 3;
			break;
		case "wednesday":
			index = 4;
			break;
		case "thursday":
			index = 5;
			break;
		case "friday":
			index = 6;
			break;
		case "saturday":
			index = 7;
			break;
	}
	return index;
}

/**
 * This functions checks if two events are equals
 * TODO: make sure that event2xml does not create undesired ebhaviour when
 *   comparing iCal vs. XML
 */
function equalsEvent (a, b, syncTasks, email)
{
	return cnv_event2xml(a, true, syncTasks, email) == cnv_event2xml(b, true, syncTasks, email);
/*
	//Fields to look for
	var fieldsArray = new Array(
		"title",
		"description");

	
	for(var i=0 ; i < fieldsArray.length ; i++ ) {
		if ( eval("a."+fieldsArray[i]) != eval("b."+fieldsArray[i]) )
		{
			logMessage ("not equals " + fieldsArray[i], LOG_CAL + LOG_DEBUG);
			return false;
		}
	}

	if (a.getProperty("LOCATION") != b.getProperty("LOCATION"))
		return false;
		
	// check date
	var isAllDay = a.startDate.isDate;
	var bisAllDay = b.startDate.isDate;
	if (isAllDay != bisAllDay)
		return false;
		
	if (calDateTime2String(a.startDate, isAllDay) != calDateTime2String(b.startDate, isAllDay))
		return false;
	if (calDateTime2String(a.endDate, isAllDay) != calDateTime2String(b.endDate, isAllDay))
		return false;
	
	// check attendees
	
	var attendees = a.getAttendees({});
	var battendees = b.getAttendees({});
	if (attendees && !battendees)
		return false;
	if (battendees && !attendees)
		return false;
	if (attendees.length != battendees.length)
		return false;
		
	if (attendees.length > 0 ) 
	{
		for each (var attendee in attendees) 
		{
			var found = false;
			for each (var battendee in battendees) 
			{
				if (attendee.id == battendee.id &&
					attendee.participationStatus == battendee.participationStatus)
				{
					found = true;
					break;
				}
			}
			
			if (!found)
			{
				logMessage("some attendee has not been found.. not eqal", LOG_CAL + LOG_DEBUG);
				return false;
			}
		}
	}	
	return true;	
*/	
}


function message2Event (fileContent, extraFields, syncTasks)
{
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
		if (xml2Event(fileContent, extraFields, parsedEvent) == false)
		{
			return null;
		}
	}
	else
	{
		fileContent = decode_utf8(decodeQuoted(fileContent));
		 // this.format == 'iCal'
		parsedEvent = ical2event(fileContent, syncTasks);
	}
	return parsedEvent;

}


/**
 * parse a string containing a Kolab XML message and put the information
 * in a preinitialized event object
 * Sometimes when syncing, there are empty events, that should not be put 
 * into calendar, so this function returns if we actually got an event
 *
 * @return true, if this event actually existed  
 */
function xml2Event (xml, extraFields, event)
{
	var syncTasks = false;
	
	logMessage("Parsing an XML event:\n" + xml, LOG_CAL + LOG_DEBUG);
	// TODO improve recurrence settings
	//	  not working ATM:
	//		  - yearly recurrence
	
	// decode utf chars and make sure an & is an &amp; (otherwise this is unparseable)
	xml = fixString4XmlParser(decode_utf8(decodeQuoted(xml)));
	
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
		logMessage("Error parsing the XML content of this message.\n" + xml, LOG_CAL + LOG_ERROR);
		return false;
	}
	if ((topNode.nodeType != Node.ELEMENT_NODE) || ((topNode.nodeName.toUpperCase() != "EVENT") && (topNode.nodeName.toUpperCase() != "TASK") ))
	{
		// this can't be an event in Kolab XML format
		logMessage("This message doesn't contain an event in Kolab XML format.\n" + xml, LOG_CAL + LOG_ERROR);
		return false;
	}

	// check for task
	if (topNode.nodeName.toUpperCase() == "TASK")
		syncTasks = true;
		
	if (syncTasks == true && event instanceof Components.interfaces.calIEvent)
	{
		logMessage("There is an event in the task folder! skipping\n" + event, LOG_CAL + LOG_WARNING);
		return false;
	}

	if (syncTasks == false && ! (event instanceof Components.interfaces.calIEvent))
	{
		logMessage("There is a task in the calendar folder! skipping\n" + event, LOG_CAL + LOG_WARNING);
		return false;
	}
		
	var cur = topNode.firstChild;
	// iterate over the DOM tree of the XML structure of the event
	while(cur != null)
	{
		if (cur.nodeType == Node.ELEMENT_NODE)
		{
			switch (cur.nodeName.toUpperCase())
			{
				case "UID":
			  		event.id = decode4XML(cur.firstChild.data);
					// FIXME - for faster debugging only, so you can see the 
					// uid resp. the msg subject in the URL field when opening the event, 
					// you can find the appropriate msg very easily afterwards
					setKolabItemProperty(event, "URL", decode4XML(cur.firstChild.data));
					break;
					
				case "CREATION-DATE":
					if (!cur.firstChild)
						break;

					var s = decode4XML(cur.firstChild.data);
					// 2005-03-30T15:28:52Z
					setKolabItemProperty(event, "CREATED", string2CalDateTime(s, true));
					break;						

				case "LAST-MODIFICATION-DATE":
					if (!cur.firstChild)
						break;

					var s = decode4XML(cur.firstChild.data);
					// 2005-03-30T15:28:52Z
					setKolabItemProperty(event, "LAST-MODIFIED", string2CalDateTime(s, true));
					break;						

				// entry date and start date can be handled the same way 
				case "ENTRY-DATE":
				case "START-DATE":
					if (!cur.firstChild)
						break;
						
					var s = decode4XML(cur.firstChild.data);
					// 2005-03-30T15:28:52Z
					if (s.indexOf(":") == -1)
					{
						var cDate = string2CalDate(s);
						cDate.isDate = true;
						// date values witout time part specify a full day event
						if (syncTasks == true)
							setKolabItemProperty(event, "entryDate", cDate);
						else
							setKolabItemProperty(event, "startDate", cDate);
					}
					else
					{
						if (syncTasks == true)
							setKolabItemProperty(event, "entryDate", string2CalDateTime(s, true));
						else
							setKolabItemProperty(event, "startDate", string2CalDateTime(s, true));
					}
					break;						

				// hande end date and due-date, completed-date the same way (completed date also sets the percent complete to 100)
				case "COMPLETED-DATE":
					if (syncTasks == true)
						setKolabItemProperty(event, "PERCENT-COMPLETE", 100);
				
				case "DUE-DATE":
				case "END-DATE":
					if (!cur.firstChild)
						break;

					var s = decode4XML(cur.firstChild.data);
					// 2005-03-30T15:28:52Z
					if (s.indexOf(":") == -1) // full time event
					{
						// date values witout time part specify a full day event
						var cDate = string2CalDate(s);
						// Kolab uses for 1-day-event:
						// startdate = day_x, enddate = day_x
						// Sunbird uses for 1-day-event:
						// startdate = day_x, enddate = day_x + 1
						var tmp_date = cDate.jsDate;
						tmp_date.setTime(tmp_date.getTime() + 24*60*60000);
						cDate.jsDate = tmp_date;
						cDate.isDate = true;

						// for tasks its endDate
						if (syncTasks == true)
							setKolabItemProperty(event, "dueDate", cDate);
						else
							setKolabItemProperty(event, "endDate", cDate);
					}
					else
					{
						if (syncTasks == true)
							setKolabItemProperty(event, "dueDate", string2CalDateTime(s, true));
						else
							setKolabItemProperty(event, "endDate", string2CalDateTime(s, true));
					}
					break;						

				case "PRIORITY":
					// only tasks 
					if (syncTasks == false)
						break;
					if (cur.firstChild)
						setKolabItemProperty(event, "priority", cur.firstChild.data);
					break;

				case "STATUS":
					// only tasks 
					if (syncTasks == false)
						break;
					if (!cur.firstChild)
						break;
						
					var cStatus = cur.firstChild.data;
					setKolabItemProperty(event, "status", cStatus);
					
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
					
					setKolabItemProperty(event, "PERCENT-COMPLETE", iComplete);
					break;
					
				case "SUMMARY":
					if (cur.firstChild)
						setKolabItemProperty(event, "title", decode4XML(cur.firstChild.data));
					break;

				case "BODY":
					// sometimes we have <body></body> in the XML
					if (cur.firstChild)
					{
					  	var cnotes = decode4XML(cur.firstChild.data);
						setKolabItemProperty(event, "DESCRIPTION", cnotes);
					}
					break;
		
				case "CREATOR":
			  		setKolabItemProperty(event, "X-KOLAB-CREATOR-DISPLAY-NAME", getXmlResult(cur, "DISPLAY-NAME", ""));
			  		setKolabItemProperty(event, "X-KOLAB-CREATOR-SMTP-ADDRESS", getXmlResult(cur, "SMTP-ADDRESS", ""));
					break;
					
				case "ORGANIZER":
					organizer = Components.classes["@mozilla.org/calendar/attendee;1"]
										  .createInstance(Components.interfaces.calIAttendee);
					organizer.id = "MAILTO:" + getXmlResult(cur, "SMTP-ADDRESS", "unknown");
					organizer.commonName = getXmlResult(cur, "DISPLAY-NAME", "");
					organizer.participationStatus = "ACCEPTED";
					organizer.rsvp = false;
					organizer.role = "CHAIR";
					organizer.isOrganizer = true;
					event.organizer = organizer;
					break;
					
				case "LOCATION":
					// sometimes we have <location></location> in the XML
					if (cur.firstChild)
						setKolabItemProperty(event, "LOCATION", decode4XML(cur.firstChild.data));
					break;

				case "CATEGORIES":
					if (cur.firstChild)
					{
						if (!event.setCategories) {
							setKolabItemProperty(event, "CATEGORIES", decode4XML(cur.firstChild.data));
							break;
						}
						var cattxt = decode4XML(cur.firstChild.data);
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
						var cData = decode4XML(cur.firstChild.data);
						// fix up the cdata if not in the right format
						if (cData.indexOf("-PT") != 0)
							cData = "-PT" + cData + "M";
						
						event.alarmOffset = createDuration(cData);
					}
					break;
					
				case "SENSITIVITY":
					setKolabItemProperty(event, "CLASS", 'PUBLIC');
					if (cur.firstChild)
						switch (decode4XML(cur.firstChild.data))
						{
							case "private":
								setKolabItemProperty(event, "CLASS", 'PRIVATE');
								break;
							case "confidential":
								setKolabItemProperty(event, "CLASS", 'CONFIDENTIAL');
								break;
						}
					break;

				case "RECURRENCE":
					logMessage("Parsing recurring event: " + event.id, LOG_CAL + LOG_INFO);
					recInfo = Components.classes["@mozilla.org/calendar/recurrence-info;1"] 
						.createInstance(Components.interfaces.calIRecurrenceInfo);
					recInfo.item = event;
					recRule = Components.classes["@mozilla.org/calendar/recurrence-rule;1"] 
						.createInstance(Components.interfaces.calIRecurrenceRule);
					// read the "cycle" attribute for the units and
					// map the Kolab XML values to the Sunbird values
					units = getXmlAttributeValue(cur, "cycle");
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
									onDays.push(getDayIndex(day));
								}
								recur = recur.nextSibling;
							}
							if (onDays.length > 0)
								recRule.setComponent("BYDAY", onDays.length, onDays);
							break;
						case "MONTHLY":
							// need to process extra type "type" which can be
							// "daynumber" or "weekday"
							mode = getXmlAttributeValue(cur, "type");
							switch (mode.toUpperCase())
							{
								case "DAYNUMBER":
									// daynumber has <daynumber>
									var detail = getXmlChildNode(cur, "daynumber");
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
									dayindex = getDayIndex(day);
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
							mode = getXmlAttributeValue(cur, "type");
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
					
					recRule.interval = getXmlResult(cur, "INTERVAL", "1");
					var node = getXmlChildNode(cur, "RANGE");
					if (node != null)
					{
						// read the "type" attribute of the range
						var rangeType = getXmlAttributeValue(node, "type");
						if (rangeType != null)
						{
							var rangeSpec = getXmlResult(cur, "RANGE", "dummy");
							switch (rangeType.toUpperCase())
							{
								case "DATE":
									if (rangeSpec != "dummy")
									{
										// XML type is Date, not DateTime
										recRule.endDate = string2CalDate(rangeSpec);
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
							   date = string2CalDate(node.firstChild.data);
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
					attendee.id = "MAILTO:" + getXmlResult(cur, "SMTP-ADDRESS", "unknown");
					attendee.commonName = getXmlResult(cur, "DISPLAY-NAME", "");
					// The status must be one of none, tentative, accepted, or declined.
					switch (getXmlResult(cur, "STATUS", "none"))
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
					if (getXmlResult(cur, "REQUEST-RESPONSE", "false") == "true")
						attendee.rsvp = true;
					else
						attendee.rsvp = false;
					// Role is one of required, optional, or resource.
					switch (getXmlResult(cur, "ROLE", "optional"))
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
			  		setKolabItemProperty(event, "X-KOLAB-SHOW-TIME-AS", decode4XML(cur.firstChild.data));
					break;
					
				case "COLOR-LABEL":
					// default is "none"
			  		setKolabItemProperty(event, "X-KOLAB-COLOR-LABEL", decode4XML(cur.firstChild.data));
					break;

				default:
			  		if (cur.firstChild == null)
			  			break;
					// remember other fields
			  		addField(extraFields, cur.nodeName, decode4XML(cur.firstChild.data));
	  				break;
					
			} // end switch
		} // end if
		cur = cur.nextSibling;
	} // end while
	
	logMessage("Parsed event in XML", LOG_CAL + LOG_DEBUG);
	return true;
}


/**
 * convert an ICAL event into a Kolab XML string representation
 * and include all fields
 *
 * @return XML string in Kolab 2 format
 */
function event2xml (event, syncTasks, email)
{
	return cnv_event2xml( event, false, syncTasks, email);
}

/**
 * returns the end date of an event.
 * Because of changes in lightning 0.8 endDate requires startDate 
 * to exist and is different for tasks/events
 */
function getEndDate (cur, tasks)
{
	if (tasks == true && cur.startDate !=null && cur.dueDate)
		return cur.dueDate.jsDate;

	if (tasks == false && cur.startDate !=null && cur.endDate)
		return cur.endDate.jsDate;
		
	return null;
}

/**
 * task status mapping from Lightning to xml
 * Kolabs "deferred" will be Lightning "CANCELLED"
 */
var arrstatus = new Array();
arrstatus["IN-PROCESS"] = "in-progress";
arrstatus["NEEDS-ACTION"]="waiting-on-someone-else";
arrstatus["NONE"]="not-started";
arrstatus["CANCELLED"]="deferred";
arrstatus["COMPLETED"]="completed";

/* return the task status */
function getTaskStatus(tstatus, xmlvalue)
{
	if (xmlvalue)
		return arrstatus[tstatus];
	/* we want to return the Lightning value */
	for (var icalval in arrstatus) {
		if (arrstatus[icalval] == tstatus)
			return icalval;
	}
	return (xmlvalue==true ? "not-started" : "NONE");
}

/**
 * convert an ICAL event into a Kolab XML string representation,
 * allow to caller to skip fields which change frequently such as
 * "last-modification-date" because this can confuse the hash IDs.
 *
 * @param skipVolatiles skips problematic fields for hash creation
 * @return XML string in Kolab 2 format
 */
function cnv_event2xml (event, skipVolatiles, syncTasks, email)
{
	// TODO  not working ATM:
	//	- yearly recurrence
	
	var isAllDay = (syncTasks==true)?false:(event.startDate?event.startDate.isDate:false);
	var endDate = getEndDate(event, syncTasks);

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
			xml += " <status>" + getTaskStatus(event.status, true) + "</status>\n";
			xml += " <completed>" + event.percentComplete +"</completed>\n";
		}
	}
	else
		xml += '<event version='+'"'+'1.0" >\n';
	if (skipVolatiles != true)
		xml += " <product-id>Synckolab " + gSyncKolabVersion + ", Calendar Sync</product-id>\n";

	xml += " <uid>" + event.id + "</uid>\n";
	
	if(syncTasks == true)
	{
		xml += " <start-date>" + calDateTime2String(event.entryDate, isAllDay) + "</start-date>\n";
		xml += " <due-date>" + calDateTime2String(endDate, isAllDay) + "</due-date>\n";
		/*
		if (!skipVolatiles)
			xml += " <completed-date>" + calDateTime2String(completedDate, true) + "</completed-date>\n";
		*/
	}
	else
	{
		xml += " <start-date>" + calDateTime2String(event.startDate, isAllDay) + "</start-date>\n";
		xml += " <end-date>" + calDateTime2String(endDate, isAllDay) + "</end-date>\n";
	 }
		
	xml += " <summary>" + encode4XML(event.title) +"</summary>\n";

	if (skipVolatiles != true)
	{
		xml += " <creation-date>" + calDateTime2String(event.getProperty("CREATED"), false) + "</creation-date>\n";
		xml += " <last-modification-date>" + calDateTime2String(event.getProperty("LAST-MODIFIED"), false) + "</last-modification-date>\n";
	}

	// description only for public events
	if (event.getProperty("DESCRIPTION") &&
			(isPublicEvent(event) || !skipVolatiles))
		xml += " <body>" + encode4XML(event.getProperty("DESCRIPTION")) + "</body>\n";
	
	if (event.getProperty("CLASS"))
		xml += " <sensitivity>" + event.getProperty("CLASS").toLowerCase() + "</sensitivity>\n";
	else
		xml += " <sensitivity>public</sensitivity>\n";
	
	if (event.getProperty("LOCATION"))
		xml += " <location>" + encode4XML(event.getProperty("LOCATION")) +"</location>\n";
	if (event.alarmOffset && event.alarmOffset.inSeconds != 0)
	{
		minutes = Math.floor(Math.abs(event.alarmOffset.inSeconds)/60);
		xml += " <alarm>" + minutes + "</alarm>\n";
	}
	
	// lighnting 0.9 (thanks to Pavlic)
	if (event.getCategories)
	{
		var catarray = event.getCategories({});
		if (catarray.length > 0 ) {
			xml += " <categories>";
			for (cnt = 0; cnt < catarray.length; cnt++) {
				xml += encode4XML(catarray[cnt]) ;
				if ( (cnt+1) < catarray.length)
					xml += ",";
				}
			xml += "</categories>\n";
			}
	}
	else
	{
		if (event.getProperty("CATEGORIES"))
			xml += " <categories>" + encode4XML(event.getProperty("CATEGORIES")) + "</categories>\n";
		else
		if (event.getProperty("CATEGORY"))
			xml += " <categories>" + encode4XML(event.getProperty("CATEGORY")) + "</categories>\n";
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
					xml += "  <day>" + getKolabXmlDayName(i) + "</day>\n";
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
						xml += "  <day>" + getKolabXmlDayName(dayindex) + "</day>\n";
					}
					else
					{
						xml += "  <daynumber>-1</daynumber>\n";
						if (days && days.length > 0 && days[0] < 0)
							dayindex = days[0] * -1 - 8;
						else
							dayindex = 1;
						xml += "  <day>" + getKolabXmlDayName(dayindex) + "</day>\n";
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
				if (endDate)
					xml += "  <range type=\"date\">" + date2String(endDate.jsDate) + "</range>\n";
				else
					xml += "  <range type=\"none\"/>\n";
			}
	
			var items = recInfo.getRecurrenceItems({});
			for (var i in items)
			{
				var item = items[i];
				if (item.isNegative)
					xml += "  <exclusion>" + calDateTime2String(item.date, true) + "</exclusion>\n";
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
				xml += "  <display-name>" + encode4XML(attendee.commonName) + "</display-name>\n";
				xml += "  <smtp-address>" + encode4XML(mail) + "</smtp-address>\n";
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
		xml += "  <display-name>" + encode4XML(event.organizer.commonName) + "</display-name>\n";
		xml += "  <smtp-address>" + encode4XML(event.organizer.id.replace(/MAILTO:/i, '')) + "</smtp-address>\n";
		xml += " </organizer>\n";
	}

	if (event.getProperty("X-KOLAB-SHOW-TIME-AS"))
		xml += " <show-time-as>" + event.getProperty("X-KOLAB-SHOW-TIME-AS") + "</show-time-as>\n";
	else // make sure we mark new events as busy - TODO validate this 
		xml += " <show-time-as>busy</show-time-as>\n";
		
	if (event.getProperty("X-KOLAB-COLOR-LABEL"))
		xml += " <color-label>" + encode4XML(event.getProperty("X-KOLAB-COLOR-LABEL")) + "</color-label>\n";
	if (event.getProperty("X-KOLAB-CREATOR-DISPLAY-NAME") && event.getProperty("X-KOLAB-CREATOR-SMTP-ADDRESS"))
	{
		xml += " <creator>\n";
		xml += "  <display-name>" + encode4XML(event.getProperty("X-KOLAB-CREATOR-DISPLAY-NAME")) + "</display-name>\n";
		xml += "  <smtp-address>" + encode4XML(event.getProperty("X-KOLAB-CREATOR-SMTP-ADDRESS")) + "</smtp-address>\n";
		xml += " </creator>\n";
	}

	xml += " <revision>0</revision>\n";	
	if (syncTasks == true)
	{
		xml += " <priority>" + encode4XML(event.priority) + "</priority>\n";
		xml += "</task>\n"
	}
	else
		xml += "</event>\n"

	logMessage("Created XML event structure:\n=============================\n" + xml, LOG_CAL + LOG_DEBUG);
	return xml;
}

/**
 * Write an event into human readable form
 */
function event2Human (event, syncTasks)
{
	var txt = "Summary: " + event.title +"\n";
	if(syncTasks == false)
	{
		var isAllDay = event.startDate?event.startDate.isDate:false;
		if (event.startDate)
		{
			txt += "Start date: " + calDateTime2String(event.startDate, isAllDay) + "\n";
			var endDate = event.endDate;
			if (event.endDate)		
				txt += "End date: " + calDateTime2String(endDate, isAllDay) + "\n\n";
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
function event2kolabXmlMsg (event, email, syncTasks)
{
	var xml = event2xml(event, syncTasks, email);
	var my_msg = generateMail(event.id, email, "", syncTasks?"application/x-vnd.kolab.task":"application/x-vnd.kolab.event", 
			true, encodeQuoted(encode_utf8(xml)), event2Human(event, syncTasks));
	return my_msg;
}



/**
 * functions to handle the iCal event format
 */
function ical2event (content, todo)
{
	var event;
	var icssrv = Components.classes["@mozilla.org/calendar/ics-service;1"]
						   .getService(Components.interfaces.calIICSService);
			  
	var rootComp = null;
	try
	{
		rootComp = icssrv.parseICS(content, null);
	}
	catch (ex)
	{
		logMessage("unable to parse ical: " + content, LOG_CAL + LOG_ERROR);
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
			logMessage("unable to parse event 2: " + content, LOG_CAL + LOG_ERROR);
			return null;
        }
        subComp = event.getNextSubcomponent("ANY");
	}

	if (!subComp ) {
		logMessage("unable to parse event 3: " + content, LOG_CAL + LOG_ERROR);
		return null;
	}

	
	try
	{
		event.icalComponent = subComp;
		logMessage("parsed event: " + event + ":" + event.id, LOG_CAL + LOG_INFO);
	}
	catch (exc)
	{
		logMessage("unable to parse event: \n" + content, LOG_CAL + LOG_ERROR);
		return null;
	}
	return event;
}




/* 
 * Set the property of an event / task
 * This is taken from the lightning extension (calendar-event-dialog.js#938ff setItemProperty)
 */
function setKolabItemProperty(item, propertyName, value)
{
	 try
	 {
		switch(propertyName) {
	    case "startDate":
			item.startDate = value;
	        break;
	    case "endDate":
			item.endDate = value;
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
	    	item.status = getTaskStatus(value,false);
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
		 logMessage("unable set property: " + propertyName + " with value " + value, LOG_CAL + LOG_ERROR);
	 }
}


 function isPrivateEvent(levent)
 {
 	return (levent && levent.getProperty("CLASS") == "PRIVATE");
 }

 function isConfidentialEvent(levent)
 {
 	return (levent && levent.getProperty("CLASS") == "CONFIDENTIAL");
 }

 function isPublicEvent(levent)
 {
 	return (levent && !isPrivateEvent(levent) && 
 		!isConfidentialEvent(levent));
 }

 /**
  * insert an organizer if not existing and update  
  */
 function insertOrganizer(levent, lsyncCalendar) 
 {
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
 }

 
/**
 * only ORGANIZER is allowed to change non-public events
 */
function allowSyncEvent(levent, revent, lsyncCalendar)
{
	var lpublic = isPublicEvent(levent);
	var rpublic = isPublicEvent(revent);
	if (lpublic && rpublic)
		return true;
	/*previous behaviour*/
	var rorgmail = lsyncCalendar.email;
	if (revent.organizer)
		rorgmail = revent.organizer.id.replace(/MAILTO:/i, '');
	var org2mail = (lsyncCalendar.email == rorgmail);
	logMessage("allowSyncEvent: " + org2mail + ":" + lpublic + ":" + rpublic, LOG_CAL + LOG_DEBUG );
	return org2mail;
}

 /**
  * sync local changes back to server version
  */
 function checkEventBeforeSync(fevent, revent, lsyncCalendar)
 {
 	var rc = allowSyncEvent(fevent, revent, lsyncCalendar);
 	if (!rc) {
 		logMessage("Update local event with server one : " + revent.id, LOG_CAL + LOG_DEBUG );
 		lsyncCalendar.curItemInListStatus.setAttribute("label", strBundle.getString("localUpdate"));
 		lsyncCalendar.gCalendar.modifyItem(revent, fevent, lsyncCalendar.gEvents);
 	}
 	return rc;
 }

/**
 * Event has changed from PUBLIC/CONFIDENTIAL to PRIVATE
 */
function checkEventServerDeletion(fevent, revent, lsyncCalendar)
{
	return (revent && 
		allowSyncEvent(fevent, revent, lsyncCalendar) && 
		isPrivateEvent(fevent));
}

/**
 * delete event on Server and database but not in Thunderbird calendar
 */
function deleteEventOnServer(fevent, pevent, lsyncCalendar)
{
	if (!checkEventServerDeletion(fevent, pevent, lsyncCalendar))
		return false;
	var eventry = getSyncDbFile(lsyncCalendar.gConfig, lsyncCalendar.getType(), fevent.id);
	var fentry = getSyncFieldFile(lsyncCalendar.gConfig, lsyncCalendar.getType(), fevent.id);
	if (eventry.exists())
		eventry.remove(false);
	if (fentry.exists())
		fentry.remove(false);
	lsyncCalendar.curItemInListStatus.setAttribute("label", strBundle.getString("deleteOnServer"));
	return true;
}
  
 /**
  * clear the description if event is confidential or private 
  */
 function modifyDescriptionOnExport(levent, syncTasks) 
 {
 	var myclass = levent.getProperty("CLASS");
 	if (!isPublicEvent(levent)) {
 		levent = levent.clone();
 		tmpdesc = (syncTasks==true ? "Task" : "Event");
 		levent.setProperty("DESCRIPTION",tmpdesc + " is " + myclass + "!");
 	}
 	return levent;
 }

 /**
  * prepare event for export 
  */
 function modifyEventOnExport(levent, lsyncCalendar)
 {
 	levent = insertOrganizer(levent, lsyncCalendar);
 	levent = modifyDescriptionOnExport(levent, lsyncCalendar.syncTasks);
 	return levent;
 }

  /**
   * check Events and Todos on privacy changes and modify appropriately
   **/
function checkEventOnDeletion(levent, pevent, lsyncCalendar) { 
	
	if (deleteEventOnServer(levent, pevent, lsyncCalendar)) 
		return "DELETEME";
	if (!checkEventBeforeSync(levent, pevent, lsyncCalendar)) 
		return null;
	return modifyDescriptionOnExport(levent, lsyncCalendar.syncTasks);
}
