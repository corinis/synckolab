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
 * ***** END LICENSE BLOCK ***** */


/* ----- general functions to access calendar and events ----- */

var activeCalendarManager;

/**
 * New and updated calendar functions (lightning 0.1)
 */
function getSynckolabCalendarManager()
{
    // TODO somehow a Lightning calendar looses its event color after it's accessed in synckolab
    if (!activeCalendarManager) {
         activeCalendarManager = Components.classes["@mozilla.org/calendar/manager;1"]
                                           .getService(Components.interfaces["calICalendarManager"]);
//         activeCalendarManager.addObserver(ltnCalendarManagerObserver);
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
         return getSynckolabCalendarManager().getCalendars({});
     } catch (e) {
         dump("Error getting calendars: " + e + "\n");
         return [];
	}
}


/**
 * @return true if the calendar exists
 */
function isCalendarAvailable ()
{
	return getSynckolabCalendars() != [];
}


/**
 * @return the event with the given id
 */
function findEvent(events, uid)
{
	for (var i =0; i < events.events.length; i++)
		if (events.events[i].id == uid)
			return events.events[i];
	return null;
}


/**
 * generate a sha1 over the most important fields
 */
function genCalSha1 (event)
{
    // Use the Kolab 2 XML representation as base for the hash.
    // This may slow down the process, but it should be possible
    // to switch back to something faster if needed.
    var aString = cnv_event2xml( event, true);
    hashValue = hex_sha1(aString);
    return hashValue;
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
 * parse a string containing a Kolab XML message and put the information
 * in a preinitialized event object
 * Sometimes when syncing, there are empty events, that should not be put 
 * into calendar, so this function returns if we actually got an event
 *
 * @return true, if this event actually existed  
 */
function xml2Event (xml, event)
{
	logMessage("Parsing an XML event:\n" + xml);
	// TODO improve recurrence settings
	//      not working ATM:
	//          - yearly recurrence
	
	// FIXME clean up - ToDos have a folder on their own in Kolab, 
	// so we don't need to support them in this function
	//
    //calendarToDo.due.clear();
    //calendarToDo.start.setTime( startDate );
    //var iCalToDo = Components.classes["@mozilla.org/icaltodo;1"].createInstance().QueryInterface(Components.interfaces.oeIICalTodo);

	// find the boundary
	var boundary = xml.substring(xml.indexOf('boundary="')+10, xml.indexOf('"', xml.indexOf('boundary="')+12));

	// get the start of the xml
	var contTypeIdx = xml.indexOf('Content-Type: application/x-vnd.kolab.event');

	if (contTypeIdx == -1)
	{
		// so this message has no part of content type application/x-vnd.kolab.event
		logMessage("Error parsing this message: no application/x-vnd.kolab.event");
		return false;
	}
	
	xml = xml.substring(contTypeIdx); // cut everything before this part
	var xmlIdx = xml.indexOf("<?xml")
	
	if (xmlIdx == -1)
	{
		// FIXME try to decode if transfer-encoding is set to base64
		if (xml.indexOf("Content-Transfer-Encoding: base64") != -1)
		{
			var startPos = xml.indexOf("\r\n\r\n");
			var endPos = xml.indexOf("--"+boundary)
			xml = xml.substring(startPos, endPos).replace(/\r\n/g, "")
			try {
				xml = atob(xml)
			} catch (e) {
				dump("Error decoding base64: " + e + "\n");
				logMessage("Error decoding base64: " + xml);
				return false;
			}
		}
		else
		{
			// so this message has no <xml>something</xml> area
			logMessage("Error parsing this message: no xml segment found");
			return false;
		}
	}
	else
	{
		xml = xml.substring(xmlIdx);
		// until the boundary = end of xml
		if (xml.indexOf(boundary) != -1)
			xml = xml.substring(0, xml.indexOf("--"+boundary));
	}
	
	// decode utf chars
	xml = decode_utf8(DecodeQuoted(xml))

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
		logMessage("Error parsing the XML content of this message.");
		return false;
	}
	if ((topNode.nodeType != Node.ELEMENT_NODE) || (topNode.nodeName.toUpperCase() != "EVENT"))
	{
		// this can't be an event in Kolab XML format
		logMessage("This message doesn't contain an event in Kolab XML format.");
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
			  		event.id = cur.firstChild.data;
					// FIXME - for faster debugging only, so you can see the 
					// uid resp. the msg subject in the URL field when opening the event, 
					// you can find the appropriate msg very easily afterwards
					event.setProperty("URL", cur.firstChild.data);
					break;
					
				case "CREATION-DATE":
					var s = cur.firstChild.data;
					// 2005-03-30T15:28:52Z
					event.setProperty("CREATED", string2CalDateTime(s, true));
					break;						

				case "LAST-MODIFICATION-DATE":
					var s = cur.firstChild.data;
					// 2005-03-30T15:28:52Z
					event.setProperty("LAST-MODIFIED", string2CalDateTime(s, true));
					break;						

				case "START-DATE":
					var s = cur.firstChild.data;
					// 2005-03-30T15:28:52Z
					if (s.indexOf(":") == -1)
					{
    					// date values witout time part specify a full day event
                        event.startDate = string2CalDate(s);
						event.startDate.isDate = true;
					}
					else
                        event.startDate = string2CalDateTime(s, true);
					break;						

				case "END-DATE":
					var s = cur.firstChild.data;
					// 2005-03-30T15:28:52Z
					if (s.indexOf(":") == -1)
					{
    					// date values witout time part specify a full day event
                        event.endDate = string2CalDate(s);
						event.endDate.day += 1;
						event.endDate.isDate = true;
					}
					else
                        event.endDate = string2CalDateTime(s, true);
					break;						

				case "SUMMARY":
					event.title = cur.firstChild.data;
					break;

				case "BODY":
				    // sometimes we have <body></body> in the XML
				    if (cur.firstChild)
						event.setProperty("DESCRIPTION", cur.firstChild.data);
					break;
					
				case "CREATOR":
			  		event.setProperty("X-KOLAB-CREATOR-DISPLAY-NAME", getXmlResult(cur, "DISPLAY-NAME", ""));
			  		event.setProperty("X-KOLAB-CREATOR-SMTP-ADDRESS", getXmlResult(cur, "SMTP-ADDRESS", ""));
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
					event.addAttendee(organizer);
					break;
					
				case "LOCATION":
				    // sometimes we have <location></location> in the XML
				    if (cur.firstChild)
						event.setProperty("LOCATION", cur.firstChild.data);
					break;

				case "CATEGORIES":
				    if (cur.firstChild)
						event.setProperty("CATEGORIES", cur.firstChild.data);
					break;

				case "ALARM":
				    if (cur.firstChild)
						event.alarmOffset = createDuration(cur.firstChild.data);
					break;
					
				case "SENSITIVITY":
                    event.setProperty("CLASS", 'PUBLIC');
        			switch (cur.firstChild.data)
                    {
                        case "private":
                            event.setProperty("CLASS", 'PRIVATE');
                            break;
                        case "confidential":
                            event.setProperty("CLASS", 'CONFIDENTIAL');
                            break;
                    }
					break;

				case "RECURRENCE":
					logMessage("Parsing recurring event: " + event.id);
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
					var node = getXmlChildNode(cur, "EXCLUSION");
					while ((node != null) && (node.nodeType == Node.ELEMENT_NODE) 
					   && (node.nodeName.toUpperCase() == "EXCLUSION"))
					{
					   date = string2CalDate(node.firstChild.data);
                       recInfo.removeOccurrenceAt(date);
                       node = node.nextSibling;
                       // skip non-element nodes
					   while ((node != null) && (node.nodeType != Node.ELEMENT_NODE))
					   {
                          node = node.nextSibling;
                       }
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
			  		event.setProperty("X-KOLAB-SHOW-TIME-AS", cur.firstChild.data);
					break;
					
				case "COLOR-LABEL":
					// default is "none"
			  		event.setProperty("X-KOLAB-COLOR-LABEL", cur.firstChild.data);
					break;
					
			} // end switch
		} // end if
		cur = cur.nextSibling;
	} // end while
	
	logMessage("Parsed event in ICAL:\n" + event.icalString);
	return true;
}


/**
 * convert an ICAL event into a Kolab XML string representation
 * and include all fields
 *
 * @return XML string in Kolab 2 format
 */
function event2xml (event)
{
    return cnv_event2xml( event, false);
}

/**
 * convert an ICAL event into a Kolab XML string representation,
 * allow to caller to skip fields which change frequently such as
 * "last-modification-date" because this can confuse the hash IDs.
 *
 * @return XML string in Kolab 2 format
 */
function cnv_event2xml (event, skipVolatiles)
{
	// TODO improve recurrence settings
	//      not working ATM:
	//          - yearly recurrence

    var hasOrganizer = false;
    var isAllDay = event.startDate.isDate;
    var endDate = event.endDate;

    var xml = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n";
    xml += "<event version=\"1.0\" >\n"
    xml += " <product-id>Synckolab 0.4.31-ag, Calendar Sync</product-id>\n";
    xml += " <uid>" + event.id + "</uid>\n"
    xml += " <start-date>" + calDateTime2String(event.startDate, isAllDay) + "</start-date>\n";
    xml += " <end-date>" + calDateTime2String(endDate, isAllDay) + "</end-date>\n";
    xml += " <summary>" + event.title +"</summary>\n";

    if (!skipVolatiles)
    {
        xml += " <creation-date>" + calDateTime2String(event.getProperty("CREATED"), false) + "</creation-date>\n";
        xml += " <last-modification-date>" + calDateTime2String(event.getProperty("LAST-MODIFIED"), false) + "</last-modification-date>\n";
    }

    if (event.getProperty("DESCRIPTION"))
        xml += " <body>" + event.getProperty("DESCRIPTION") + "</body>\n";
    if (event.getProperty("CLASS"))
        xml += " <sensitivity>" + event.getProperty("CLASS").toLowerCase() + "</sensitivity>\n";
    else
        xml += " <sensitivity>public</sensitivity>\n";
    if (event.getProperty("LOCATION"))
        xml += " <location>" + event.getProperty("LOCATION") +"</location>\n";
    if (event.alarmOffset && event.alarmOffset.inSeconds != 0)
    {
        minutes = Math.floor(Math.abs(event.alarmOffset.inSeconds)/60);
        xml += " <alarm>" + minutes + "</alarm>\n";
    }
    if (event.getProperty("CATEGORIES"))
        xml += " <categories>" + event.getProperty("CATEGORIES") + "</categories>\n";

    var recInfo = event.recurrenceInfo;
    if (recInfo && recInfo.countRecurrenceItems() >= 1)
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
                        dayindex = days[0] % 8
                        daynumber = (days[0] - dayindex) / 8
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
		}
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

    var attendees = event.getAttendees({});
    if (attendees && attendees.length > 0) 
    {
        for each (var attendee in attendees) 
        {
            mail = attendee.id.replace(/MAILTO:/, '');
            // FIXME the check for the array size == 1 is a hack to work around a Lightning bug
            // where isOrganizer() doesn't get true
            if (attendee.isOrganizer || (attendee.role == "CHAIR") || (attendees.length == 1))
            {
                xml += " <organizer>\n";
                xml += "  <display-name>" + attendee.commonName + "</display-name>\n";
                xml += "  <smtp-address>" + mail + "</smtp-address>\n";
                xml += " </organizer>\n";
                hasOrganizer = true;
                // FIXME indicator for workaround
                if (!attendee.isOrganizer) logMessage("Organizer status expected!!!"); 
            }
            else
            {
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
                xml += "  <display-name>" + attendee.commonName + "</display-name>\n";
                xml += "  <smtp-address>" + mail + "</smtp-address>\n";
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
    }

    if (!hasOrganizer)
    {
        // FIXME Try to read the sender data from the settings of the 
        // account specified in the synckolab settings
        xml += " <organizer>\n";
        xml += "  <display-name>" + "Synckolab" + "</display-name>\n";
        xml += "  <smtp-address>" + "synckolab@no.tld" + "</smtp-address>\n";
        xml += " </organizer>\n";
    }

    if (event.getProperty("X-KOLAB-SHOW-TIME-AS"))
        xml += " <show-time-as>" + event.getProperty("X-KOLAB-SHOW-TIME-AS") + "</show-time-as>\n";
    if (event.getProperty("X-KOLAB-COLOR-LABEL"))
        xml += " <color-label>" + event.getProperty("X-KOLAB-COLOR-LABEL") + "</color-label>\n";
    if (event.getProperty("X-KOLAB-CREATOR-DISPLAY-NAME") && event.getProperty("X-KOLAB-CREATOR-SMTP-ADDRESS"))
    {
        xml += " <creator>\n";
        xml += "  <display-name>" + event.getProperty("X-KOLAB-CREATOR-DISPLAY-NAME") + "</display-name>\n";
        xml += "  <smtp-address>" + event.getProperty("X-KOLAB-CREATOR-SMTP-ADDRESS") + "</smtp-address>\n";
        xml += " </creator>\n";
    }

    xml += " <revision>0</revision>\n";
    xml += "</event>\n"

	logMessage("Event in ICAL:\n=============\n" + event.icalString + "\n" 
		+ "Created XML event structure:\n=============================\n" + xml);
	return xml;
}


/**
 * convert an ICAL event into a Kolab 2 XML format message
 *
 * @return a message in Kolab 2 format
 */
function event2kolabXmlMsg (event, email)
{
    var xml = "";
    xml = event2xml(event);
	var xml = event2xml(event);
	var my_msg = generateMail(event.id, email, "", "application/x-vnd.kolab.event", 
			true, encode_utf8(xml));
	return my_msg;
}



/**
 * functions to handle the iCal event format
 */


function ical2event (content)
{
    var event;
	var icssrv = Components.classes["@mozilla.org/calendar/ics-service;1"]
                           .getService(Components.interfaces.calIICSService);
	var rootComp = icssrv.parseICS(content);
  
    if (rootComp.componentType == 'VCALENDAR') {
		event = rootComp;
	} else {
		event = rootComp.getFirstSubcomponent('VCALENDAR');
	}
	var subComp = event.getFirstSubcomponent("ANY");
	event = Components.classes["@mozilla.org/calendar/event;1"]
                      .createInstance(Components.interfaces.calIEvent);
    event.icalComponent = subComp;
    logMessage("parsed event: " + event + ":" + event.id);
    return event;
}


