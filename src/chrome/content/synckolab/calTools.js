
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
	return getCalendarDirectory().exists();
}
