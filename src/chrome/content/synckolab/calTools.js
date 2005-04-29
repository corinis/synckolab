
function xml2Event (xml, card)
{
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
	
	while(cur != null)
	{
		
		if (cur.nodeType == Node.ELEMENT_NODE)//1
		{
			switch (cur.nodeName.toUpperCase())
			{
				case "LAST-MODIFICATION-DATE":
						var s = cur.firstChild.data;
						// now we gotta check times... convert the message first
						// save the date in microseconds
						// 2005-03-30T15:28:52Z
						card.lastModifiedDate.setTime(string2DateTime(s).getTime());
						//card.lastModifiedDate = string2DateTime(s).getTime() / 1000;
						break;						

				case "START-DATE":
						var s = cur.firstChild.data;
						// 2005-03-30T15:28:52Z
						if (s.indexOf(":") == -1)
							card.allDay = true;						
						card.start.setTime (string2DateTime(s).getTime());
						found = true;
						break;						

				case "END-DATE":
						var s = cur.firstChild.data;
						// 2005-03-30T15:28:52Z
						card.end.setTime (string2DateTime(s).getTime());
						found = true;
						break;						

				case "SUMMARY":
					card.title = cur.firstChild.data;
					break;

				case "RECURRENCE":
					card.recur = true;
					//card.interval = getXmlResult(cur, "INTERVAL", "1");
					card.recurrenceStartDate.setTime(card.start.getTime());
					//calIRecurrenceInfo  card.recurrenceInfo
					//calIAttendee 
					/*
					calIRecurrenceRule type  //null/"", "SECONDLY", "MINUTELY", "HOURLY", "DAILY", "WEEKLY", "MONTHLY", "YEARLY"
							interval // repeat every N of type
							count //long
								or
							endDate
					*/							
					found = true;
				break;
	
				case "ORGANIZER":
					cur.organizer.commonName = getXmlResult(cur, "DISPLAY-NAME", "") + "<"+ getXmlResult(cur, "SMTP-ADDRESS", "") +">";
					found = true;
					break;
					
			  case "LOCATION":
			  	card.location = cur.firstChild.data;
					found = true;
					break;

			  case "BODY":
			  	card.description = cur.firstChild.data;
					found = true;
			  	break;
			  case "UID":
			  	card.id = cur.firstChild.data;
			  	break;
			} // end switch
		}
		
		cur = cur.nextSibling;
	}
	
	return found;

}


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
	return getCalendarDirectory().exists() && this.readDataFromFile;
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
