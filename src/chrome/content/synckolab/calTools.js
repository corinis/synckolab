// FIXME this should be under Mozilla license like so

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

/**
 * retrieve the calendar directory
 */
function getCalendarDirectory ()
{
	var file = Components.classes["@mozilla.org/file/directory_service;1"].
	   getService(Components.interfaces.nsIProperties).
	   get("ProfD", Components.interfaces.nsIFile);
	file.append("Calendar");
	return file;
}


/**
 * @return true if the calendar exists
 */
function isCalendarAvailable ()
{
	// the file should be missing and the function readDataFromFile
	return getCalendarDirectory().exists();
// FIXME && this.readDataFromFile;
}


/**
 * @return the event with the given id
 */
function findEvent(events, uid)
{
	for (var i =0; i < events.length; i++)
		if (events[i].id == uid)
			return events[i];
	return null;
}


/* ----- functions to handle the Kolab 2 XML event format ----- */

/**
 * parse a string containing a Kolab XML message and put the information
 * in a preinitialized event object
 * Sometimes when syncing, there are empty events, that should not be put 
 * into calendar, so this function returns if we actually got an event
 * @return true, if this event actually existed  
 */
function xml2Event (xml, event)
{
	
	// TODO use a conversion from UTC to local time zone
	// TODO honor the character set
	// TODO improve recurrence settings
	// TODO handle attendees
	// TODO find a solution for Kolab fields not supported in Sunbird
	
	// FIXME clean up
  //    calendarToDo.due.clear();
   // calendarToDo.start.setTime( startDate );
   //var iCalToDo = Components.classes["@mozilla.org/icaltodo;1"].createInstance().QueryInterface(Components.interfaces.oeIICalTodo);

	// find the boundary
	var boundary = xml.substring(xml.indexOf("boundary=")+10, xml.indexOf('"', xml.indexOf("boundary=")+11));

	// get the start of the xml
	xml = xml.substring(xml.indexOf("<?xml"));
	// until the boundary = end of xml
	xml = xml.substring(0, xml.indexOf("--"+boundary));
	var email = 0;

	// we want to convert to unicode
	xml = decode_utf8(DecodeQuoted(xml));
	
	// convert the string to xml
	var parser = Components.classes["@mozilla.org/xmlextras/domparser;1"].getService(Components.interfaces.nsIDOMParser); 
	var doc = parser.parseFromString(xml, "text/xml");
	
	
	var cur = doc.firstChild.firstChild;
	// FIXME we better start with doc.firstChild and check for ELEMENT_NODE
	// and nodeName == event. As we know the structure of Kolab XML for
	// events, we can access the child nodes directly.

	// iterate over the DOM tree of the XML structure of the event
	while(cur != null)
	{
		
		if (cur.nodeType == Node.ELEMENT_NODE)//1
		{
			switch (cur.nodeName.toUpperCase())
			{
				case "UID":
			  		event.id = cur.firstChild.data;
					// FIXME - for faster debugging only, so you can see the 
					// uid resp. the msg subject in the URL field when opening the event, 
					// you can find the appropriate msg very easily afterwards
					event.url = cur.firstChild.data;
					break;
					
				case "LAST-MODIFICATION-DATE":
					var s = cur.firstChild.data;
					// now we gotta check times... convert the message first
					// save the date in microseconds
					// 2005-03-30T15:28:52Z
					//event.lastModifiedDate.setTime(string2DateTime(s).getTime());
					//event.lastModifiedDate = string2DateTime(s).getTime() / 1000;
					break;						

				case "START-DATE":
					var s = cur.firstChild.data;
					// 2005-03-30T15:28:52Z
					// date values witout time part specify a full day event
					if (s.indexOf(":") == -1)
						event.allDay = true;						
					event.start.setTime (string2DateTime(s).getTime());
					found = true;
					break;						

				case "END-DATE":
					var s = cur.firstChild.data;
					// 2005-03-30T15:28:52Z
					event.end.setTime (string2DateTime(s).getTime());
					found = true;
					break;						

				case "SUMMARY":
					event.title = cur.firstChild.data;
					found = true;
					break;

				case "BODY":
			  		event.description = cur.firstChild.data;
					found = true;
					break;
					
				case "CREATOR":
					var name = getXmlResult(cur, "DISPLAY-NAME", "") 
						+ "<"+ getXmlResult(cur, "SMTP-ADDRESS", "") +">";
					// FIXME
					found = true;
					break;
					
				case "ORGANIZER":
					var name = getXmlResult(cur, "DISPLAY-NAME", "") 
						+ "<"+ getXmlResult(cur, "SMTP-ADDRESS", "") +">";
					// FIXME cur.organizer.commonName = name;
					found = true;
					break;
					
				case "LOCATION":
			  		event.location = cur.firstChild.data;
					found = true;
					break;

				case "CATEGORIES":
			  		event.categories = cur.firstChild.data;
					found = true;
					break;

				case "ALARM":
					event.alarm       = true;
					event.alarmLength = cur.firstChild.data;
					// event.alarmUnits remains at the default which is 
					// in minutes like in Kolab XML
					found = true;
					break;
					
				case "SENSITIVITY":
					if (cur.firstChild.data == "public")
						event.privateEvent = false;
					found = true;
					break;

				case "RECURRENCE":
consoleService.logStringMessage("Parsing this card: " + event.id);
					event.recur = true;
					// read the "cycle" attribute for the units and
					// map the Kolab XML values to the Sunbird values
					var units = getXmlAttributeValue(cur, "cycle");
					if (units == null)
						units = "weeks";
					else switch (units.toUpperCase())
					{
						case "DAILY":
							// FIXME verify the Sunbird value
							units = "days";
							break;
						case "WEEKLY":
							units = "weeks";
							// FIXME need to process the <day> value here
							break;
						case "MONTHLY":
							// FIXME need to process extra type "type" which can be
							// "daynumber" or "weekday"
							// daynumber has <date>
							// weekday has <daynumber> and <day>
							units = "months";
							break;
						case "YEARLY":
							// FIXME need to process extra type "type" which can be
							// "monthday" or "yearday"
							// monthday has <date> and <month>
							// yearday has <daynumber>
							// FIXME verify the Sunbird value
							units = "years";
							break;
						default:
							units = "weeks";
					}
consoleService.logStringMessage("cycle = " + units);
					event.recurUnits = units;
					event.recurInterval = getXmlResult(cur, "INTERVAL", "1");
					// this hould not happen
					if( event.recurInterval == 0 )
						event.recur = false;
					
					var node = getXmlChildNode(cur, "RANGE");
					if (node != null)
					{
						event.recurForever = false;
						event.recurCount = 0;
						// read the "type" attribute of the range
						var rangeType = getXmlAttributeValue(node, "type");
						if (rangeType != null)
						{
consoleService.logStringMessage("type = " + rangeType);
							var rangeSpec = getXmlResult(cur, "RANGE", "dummy");
consoleService.logStringMessage("RANGE = " + rangeSpec);
							switch (rangeType.toUpperCase())
							{
								case "DATE":
									if (rangeSpec != "dummy")
									{
										// XML type is Date, not DateTime
consoleService.logStringMessage("setting recurEnd to " + rangeSpec);
										event.recurEnd.setTime(string2Date(rangeSpec).getTime());
										//event.recurEnd.hour = event.start.hour;
										//event.recurEnd.minute = event.start.minute;
									}
									else
										event.recurEnd.clear();
									break;
								case "NUMBER":
									if (rangeSpec != "dummy")
										event.recurCount = rangeSpec;
									else
										event.recurCount = 1;
									break;
								case "NONE":
									event.recurForever = true;
									break;
							}
						}
					}
					// FIXME read 0..n exclusions
/* FIXME - this is code from Sunbird to demonstrate the API of the event class
   if( gEvent.recur == true )
   {
      if( gEvent.recurUnits == "weeks" )
      {
         // advanced weekly repeating, choosing the days to repeat
         gEvent.recurWeekdays = getAdvancedWeekRepeat();
      }
      else if( gEvent.recurUnits == "months" )
      {
         // advanced month repeating, either every day or every date
         if( getFieldValue( "advanced-repeat-dayofweek", "selected" ) == true )
         {
            gEvent.recurWeekNumber = getWeekNumberOfMonth();
         } 
         else if( getFieldValue( "advanced-repeat-dayofweek-last", "selected" ) == true )
         {
            gEvent.recurWeekNumber = 5;
         }
         else
            gEvent.recurWeekNumber = 0;
      
      }
   }
*/
					found = true;
					break;
	
				case "ATTENDEE":
			  		// FIXME
					getXmlResult(cur, "DISPLAY-NAME", "");
					getXmlResult(cur, "SMTP-ADDRESS", "");
					// The status must be one of none, tentative, accepted, or declined.
					getXmlResult(cur, "STATUS", "none");
					getXmlResult(cur, "REQUEST-RESPONSE", "1");
					// Role is one of required, optional, or resource.
					getXmlResult(cur, "ROLE", "optional");
					found = true;
					break;
					
				case "SHOW-TIME-AS":
					// default is "none"
			  		// FIXME event.??? = cur.firstChild.data;
					found = true;
					break;
					
				case "COLOR-LABEL":
					// default is "none"
			  		// FIXME event.??? = cur.firstChild.data;
					found = true;
					break;
					
			} // end switch
		}
		
		cur = cur.nextSibling;
	}
	
	return found;

}


/* ----- functions to handle the iCal event format ----- */


function saveIcal (eventArray, todoArray, fileName)
{
	var len = 0;
	var eventStrings = new Array();
	var begin = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Mozilla.org/NONSGML Mozilla Calendar V1.0//EN\n";
	var end = "END:VCALENDAR";
	var i = 0, j;
	for( i = 0;  eventArray != null && i < eventArray.length; i++ )
	{
    var calendarEvent = eventArray[i].clone();
      
    // convert time to represent local to produce correct DTSTART and DTEND
    if(calendarEvent.allDay != true)
       convertLocalToZuluEvent( calendarEvent );
      
    // check if all required properties are available
    if (calendarEvent.method == 0 )
       calendarEvent.method = calendarEvent.ICAL_METHOD_PUBLISH;
    if (calendarEvent.stamp.year ==  0 )
       calendarEvent.stamp.setTime( new Date() );

    var eventString = calendarEvent.getIcalString();
    
    // include VCALENDAR version, prodid, method only on first component
    var ibegin = eventString.indexOf("BEGIN:", 15+eventString.indexOf("BEGIN:VCALENDAR"));
    // include END:VCALENDAR only on last component
    var iend = eventString.lastIndexOf("END:VCALENDAR");
    // Include components between begin and end.
    // (Since times are all Zulu times, no VTIMEZONEs are expected,
    // so safe to assume no duplicate VTIMEZONES need to be removed.)
    eventString = eventString.slice(ibegin, iend);

    // patch TRIGGER for Outlook compatibility (before \r\n fix)
    eventString = patchICalStringForExport(eventString);
    // make sure all line terminators are full \r\n as required by rfc2445
    eventString = eventString.replace(/\r\n|\n|\r/g, "\r\n");
    
    // collect result in array, will join at end
    eventStrings.push(eventString);
   }

   for( j = 0; todoArray != null && j < todoArray.length; i++ )
   {
      var calendarEvent = todoArray[j].clone();
      
      // convert time to represent local to produce correct DTSTART and DTEND
      if(calendarEvent.allDay != true)
         convertLocalToZuluEvent( calendarEvent );
      
      // check if all required properties are available
      if (calendarEvent.method == 0 )
         calendarEvent.method = calendarEvent.ICAL_METHOD_PUBLISH;
      if (calendarEvent.stamp.year ==  0 )
         calendarEvent.stamp.setTime( new Date() );

      var eventString = calendarEvent.getIcalString();
      // include VCALENDAR version, prodid, method only on first component
      var ibegin = eventString.indexOf("BEGIN:", 15+eventString.indexOf("BEGIN:VCALENDAR"));
      // include END:VCALENDAR only on last component
      var iend = eventString.lastIndexOf("END:VCALENDAR");
      // Include components between begin and end.
      // (Since times are all Zulu times, no VTIMEZONEs are expected,
      // so safe to assume no duplicate VTIMEZONES need to be removed.)
      eventString = eventString.slice(ibegin, iend);

      // patch TRIGGER for Outlook compatibility (before \r\n fix)
      eventString = patchICalStringForExport(eventString);
      // make sure all line terminators are full \r\n as required by rfc2445
      eventString = eventString.replace(/\r\n|\n|\r/g, "\r\n");
      
      // collect result in array, will join at end
      eventStrings[i+j] = eventString;
  }
   
   // concatenate all at once to avoid excess string copying on long calendars.
	var sfile = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
	// temp path
	sfile.initWithPath(fileName);
	if (sfile.exists()) 
		sfile.remove(true);
	sfile.create(sfile.NORMAL_FILE_TYPE, 0666);
	
	var content = begin + eventStrings.join("") + end;
	// create a new message in there
	var stream = Components.classes['@mozilla.org/network/file-output-stream;1'].createInstance(Components.interfaces.nsIFileOutputStream);
	stream.init(sfile, 2, 0x200, false); // open as "write only"
	stream.write(content, content.length);
	stream.close();
//  return ;
}
