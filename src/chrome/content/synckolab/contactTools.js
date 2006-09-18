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

/**
 * Tools to work with the address book. Parsing functions for vcard, Kolab xml
 * to and from contact plus some utility functions. 
 *
 */
function xml2Card (xml, card)
{

	// find the boundary
	var boundary = xml.substring(xml.indexOf('boundary="')+10, xml.indexOf('"', xml.indexOf('boundary="')+12));

	// get the start of the xml
	xml = xml.substring(xml.indexOf("<?xml"));
	
	if (xml.indexOf(boundary) != -1)
		xml = xml.substring(0, xml.indexOf(boundary));
		
	// until the boundary = end of xml
	xml = decode_utf8(DecodeQuoted(xml));
	
	var email = 0;

	// we want to convert to unicode
	xml = DecodeQuoted(xml);

	// convert the string to xml
	var parser = Components.classes["@mozilla.org/xmlextras/domparser;1"].getService(Components.interfaces.nsIDOMParser); 
	var doc = parser.parseFromString(xml, "text/xml");
	
	
	var cur = doc.firstChild.firstChild;
	var found = false;
	
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
						/*
						try
						{
							// we dont need the date anyways.. so lets skip that part
							// card.lastModifiedDate = string2DateTime(s).getTime() / 1000;
						}
						catch (ex)
						{
							consoleService.logStringMessage("unable to convert to date: " + s);
							alert(("unable to convert to date: " + s + "\nPlease copy the date string in a bug report an submit!\n(Also available in the information)"));
						}
						*/
						break;						

				case "NAME":
					card.firstName = getXmlResult(cur, "GIVEN-NAME", "");
					card.lastName = getXmlResult(cur, "LAST-NAME", "");
					card.displayName = getXmlResult(cur, "FULL-NAME", "");
					found = true;
				break;

				case "JOB-TITLE":
			  		if (cur.firstChild == null)
			  			break;
					card.jobTitle = cur.firstChild.data;
					found = true;
					break;

				case "NICK-NAME":
			  		if (cur.firstChild == null)
			  			break;
					card.nickName = cur.firstChild.data;
					found = true;
					break;

				case "EMAIL":
					switch (email)
					{
						case 0:
							card.primaryEmail = card.defaultEmail = getXmlResult(cur, "SMTP-ADDRESS", "");
							break;
						case 1:
							card.secondEmail = getXmlResult(cur, "SMTP-ADDRESS", "");
							break;
					}
					email++;
					found = true;
					break;
					
				case "CATEGORIES":
					if (cur.firstChild != null)
						card.category = cur.firstChild.data;
					break;

			  case "ORGANIZATION":
			  		if (cur.firstChild != null)
				  		card.company = cur.firstChild.data;
					found = true;
			  	break;
			  	
				// these two are the same
			  case "PHONE":
			  	var num = getXmlResult(cur, "NUMBER", "");
			  	switch (getXmlResult(cur, "TYPE", "CELLULAR").toUpperCase())
			  	{
			  		case "MOBILE":
			  		case "CELLULAR":
			  			card.cellularNumber = num;
			  			break;
			  		case "HOME":
			  		case "HOME1":
			  			card.homePhone  = num;
			  			break;
			  		case "FAX":
			  			card.faxNumber = num;
			  			break;
			  		case "BUSINESS":
			  		case "BUSINESS1":
			  			card.workPhone = num;
			  			break;
			  		case "PAGE":
			  			card.pagerNumber = num;
			  			break;
			  	}
				found = true;
			  	break;
			  	
			  case "BIRTHDAY":
			  		if (cur.firstChild == null)
			  			break;
					var tok = cur.firstChild.data.split("-");
					card.birthYear = tok[0];
					card.birthMonth = tok[1];
					// BDAY: 1987-09-27
			  		card.birthDay = tok[2];
					found = true;
			  	break;
			  	// anniversary - not in vcard rfc??
			  case "ANNIVERSARY":
			  		if (cur.firstChild == null)
			  			break;
					var tok = cur.firstChild.data.split("-");
	
					card.anniversaryYear = tok[0];
					card.anniversaryMonth = tok[1];
					// BDAY:1987-09-27T08:30:00-06:00
			  		card.anniversaryDay = tok[2];
					found = true;
			  	break;
			  	
			  case "PREFERRED-ADDRESS":
		  		if (cur.firstChild != null)
				  	card.defaultAddress = cur.firstChild.data;
			  	break;
			  case "ADDRESS":
			  	switch (getXmlResult(cur, "TYPE", "HOME").toUpperCase())
			  	{
			  			case "HOME":
								card.homeAddress = getXmlResult(cur, "STREET", "");
								card.homeAddress2 = getXmlResult(cur, "STREET2", "");
								card.homeCity = getXmlResult(cur, "LOCALITY", "");
								card.homeState = getXmlResult(cur, "REGION", "");
								card.homeZipCode = getXmlResult(cur, "POSTAL-CODE", "");
								card.homeCountry = getXmlResult(cur, "COUNTRY", "");
								break;
			  			case "BUSINESS":
								card.workAddress = getXmlResult(cur, "STREET", "");
								card.workAddress2 = getXmlResult(cur, "STREET2", "");
								card.workCity = getXmlResult(cur, "LOCALITY", "");
								card.workState = getXmlResult(cur, "REGION", "");
								card.workZipCode = getXmlResult(cur, "POSTAL-CODE", "");
								card.workCountry = getXmlResult(cur, "COUNTRY", "");
								break;
					}
					found = true;
			  	break;
			  case "BODY":
			  		if (cur.firstChild == null)
			  			break;
				  	card.notes = cur.firstChild.data;
					found = true;
			  	break;
			  case "DEPARTMENT":
			  		if (cur.firstChild == null)
			  			break;
				  	card.department = cur.firstChild.data;
					found = true;
			  	break;
	
			  case "WEB-PAGE":
			  		if (cur.firstChild == null)
			  			break;
				  	card.webPage1 = cur.firstChild.data;
					found = true;
					break;

			  case "UID":
		  		if (cur.firstChild == null)
		  			break;
			  	card.custom4 = cur.firstChild.data;
			  	break;
			  	
			  case "IM-ADDRESS":
		  		if (cur.firstChild == null)
		  			break;
			  	card.aimScreenName = cur.firstChild.data;
			  	break;
			} // end switch
		}
		
		cur = cur.nextSibling;
	}
	
	return found;

}


/**
 * Creates xml (kolab2) out of a given card. 
 * The return is the xml as string.
 */
function card2Xml (card)
{
	var displayName = "";
	var xml = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n";
	xml += "<contact version=\"1.0\" >\n";
	xml += " <product-id>SyncKolab, Kolab resource</product-id>\n";
	xml += " <uid>"+card.custom4+"</uid>\n";
	xml += nodeWithContent("categories", card.category, false);
	xml += " <creation-date>"+date2String(new Date(card.lastModifiedDate*1000))+"T"+time2String(new Date(card.lastModifiedDate*1000))+"Z</creation-date>\n";
	xml += " <last-modification-date>"+date2String(new Date(card.lastModifiedDate*1000))+"T"+time2String(new Date(card.lastModifiedDate*1000))+"Z</last-modification-date>\n";
	// ??
	xml += " <sensitivity>public</sensitivity>\n";
	if (checkExist(card.notes))
			xml +=" <body>"+card.notes+"</body>\n";

	if (checkExist (card.firstName) || checkExist (card.lastName) ||checkExist (card.displayName) ||
		checkExist (card.nickName))
	{
		xml += " <name>\n";
		if (checkExist (card.firstName))
			xml += "  <given-name>"+card.firstName+"</given-name>\n";
//			xml += "  <middle-names>"+card.nickName+"</middle-names>\n"; // not really correct...
		if (checkExist (card.lastName))
			xml += "  <last-name>"+card.lastName+"</last-name>\n";
		if (checkExist (card.displayName))		
		{
			xml += "  <full-name>"+card.displayName+"</full-name>\n";
			displayName = card.displayName;
		}
		else
		if (checkExist (card.firstName) || checkExist (card.lastName))
		{
			displayName = card.firstName + " " + card.lastName;
			xml += "  <full-name>" + displayName + "</full-name>\n";
		}
			
		
		xml += " </name>\n";
	}
	xml += nodeWithContent("organization", card.company, false);
	xml += nodeWithContent("web-page", card.webPage1, false);
	xml += nodeWithContent("im-address", card.aimScreenName, false);
	xml += nodeWithContent("department", card.department, false);
//" <office-location>zuhaus</office-location>\n";
//" <profession>programmierer</profession>\n";
	xml += nodeWithContent("job-title", card.jobTitle, false);
	xml += nodeWithContent("nick-name", card.nickName, false);
	var adate = card.birthYear + "-" + card.birthMonth + "-" + card.birthDay;
	if (adate != "--")
		xml += nodeWithContent("birthday", adate, false);
	adate = card.anniversaryYear + "-" + card.anniversaryMonth + "-" + card.anniversaryDay;
	if (adate != "--")
		xml += nodeWithContent("anniversary", adate, false);
	if (checkExist(card.homePhone))
	{	
		xml += " <phone>\n";
		xml += "  <type>home1</type>\n";
		xml += "  <number>"+card.homePhone+"</number>\n";
		xml += " </phone>\n";
	}
	if (checkExist(card.workPhone))
	{	
		xml += " <phone>\n";
		xml += "  <type>business1</type>\n";
		xml += "  <number>"+card.workPhone+"</number>\n";
		xml += " </phone>\n";
	}
	if (checkExist(card.cellularNumber))
	{	
		xml += " <phone>\n";
		xml += "  <type>mobile</type>\n";
		xml += "  <number>"+card.cellularNumber+"</number>\n";
		xml += " </phone>\n";
	}
	if (checkExist(card.pagerNumber))
	{	
		xml += " <phone>\n";
		xml += "  <type>page</type>\n";
		xml += "  <number>"+card.cellularNumber+"</number>\n";
		xml += " </phone>\n";
	}
	
	if (checkExist(card.primaryEmail))
	{
		xml += " <email>\n";
		xml += "  <display-name>"+displayName+"</display-name>\n";
		xml += "  <smtp-address>"+card.primaryEmail+"</smtp-address>\n";
		xml += " </email>\n";
	}
	
	if (checkExist(card.secondEmail))
	{
		xml += " <email>\n";
		xml += "  <display-name>"+displayName+"</display-name>\n";
		xml += "  <smtp-address>"+card.secondEmail+"</smtp-address>\n";
		xml += " </email>\n";
	}

	if (checkExist(card.defaultEmail))
	{
		xml += " <email>\n";
		xml += "  <display-name>"+displayName+"</display-name>\n";
		xml += "  <smtp-address>"+card.defaultEmail+"</smtp-address>\n";
		xml += " </email>\n";
	}
	if (checkExist(card.homeAddress) || checkExist(card.homeAddress2) ||
		checkExist(card.homeCity) || checkExist(card.homeState) ||
		checkExist(card.homeZipCode) || checkExist(card.homeCountry))
	{
		xml += " <address>\n";
		xml += "  <type>home</type>\n";
		xml += nodeWithContent("street", card.homeAddress, false);
		xml += nodeWithContent("street2", card.homeAddress2, false);
		xml += nodeWithContent("locality", card.homeCity, false);
		xml += nodeWithContent("region", card.homeState, false);
		xml += nodeWithContent("postal-code", card.homeZipCode, false);
		xml += nodeWithContent("country", card.homeCountry, false);
		xml += " </address>\n";
	}

	if (checkExist(card.workAddress) || checkExist(card.workAddress2) ||
		checkExist(card.workCity) || checkExist(card.workState) ||
		checkExist(card.workZipCode) || checkExist(card.workCountry))
	{
		xml += " <address>\n";
		xml += "  <type>business</type>\n";
		xml += nodeWithContent("street", card.workAddress, false);
		xml += nodeWithContent("street2", card.workAddress2, false);
		xml += nodeWithContent("locality", card.workCity, false);
		xml += nodeWithContent("region", card.workState, false);
		xml += nodeWithContent("postal-code", card.workZipCode, false);
		xml += nodeWithContent("country", card.workCountry, false);
		xml += " </address>\n";
	}
		
	xml += nodeWithContent("preferred-address", card.defaultAddress, false);
	xml += "</contact>\n";
	
	return xml;	
}

/**
 * Generate a sha1 key out of a vcard - used for database
 */
function genConSha1 (card)
{
	return hex_sha1(card.aimScreenName + ":" +
	card.anniversaryDay + ":" +
	card.anniversaryMonth + ":" +
	card.anniversaryYear + ":" +
	card.birthDay + ":" +
	card.birthMonth + ":" +
	card.birthYear + ":" +
	card.cardType + ":" +
	card.category + ":" +
	card.cellularNumber + ":" +
	card.cellularNumberType + ":" +
	card.company + ":" +
	card.custom1 + ":" +
	card.custom2 + ":" +
	card.custom3 + ":" +
	card.custom4 + ":" +
	card.defaultAddress + ":" +
	card.defaultEmail + ":" +
	card.department + ":" +
	card.displayName + ":" +
	card.familyName + ":" +
	card.faxNumber + ":" +
	card.faxNumberType + ":" +
	card.firstName + ":" +
	card.homeAddress + ":" +
	card.homeAddress2 + ":" +
	card.homeCity + ":" +
	card.homeCountry + ":" +
	card.homePhone + ":" +
	card.homePhoneType + ":" +
	card.homeState + ":" +
	card.homeZipCode + ":" +
	card.jobTitle + ":" +
	card.lastName + ":" +
	card.nickName + ":" +
	card.notes + ":" +
	card.pagerNumber + ":" +
	card.pagerNumberType + ":" +
	card.phoneticFirstName + ":" +
	card.phoneticLastName + ":" +
	card.primaryEmail + ":" +
	card.secondEmail + ":" +
	card.spouseName + ":" +
	card.webPage1 + ":" + // WebPage1 is work web page
	card.webPage2 + ":" + // WebPage2 is home web page
	card.workAddress + ":" +
	card.workAddress2 + ":" +
	card.workCity + ":" +
	card.workCountry + ":" +
	card.workPhone + ":" +
	card.workPhoneType + ":" +
	card.workState + ":" +
	card.workZipCode);
}


/**
 * Parses a vcard message to a addressbook card.
 * This function ignores unused headers.
 * You can create a new card using:
 * newcard = Components.classes["@mozilla.org/addressbook/cardproperty;1"].createInstance(Components.interfaces.nsIAbCard);	
 * @param message string - a string with the vcard
 * @param card nsIAbCard - the card to update
 *
 */
function message2Card (message, card, format)
{
	
	// reset the card
	card.aimScreenName = "";
	card.anniversaryDay = "";
	card.anniversaryMonth = "";
	card.anniversaryYear = "";
	card.birthDay = "";
	card.birthMonth = "";
	card.birthYear = "";
	card.cardType = "";
	card.category = "";
	card.cellularNumber = "";
	card.cellularNumberType = "";
	card.company = "";
	card.custom1 = "";
	card.custom2 = "";
	card.custom3 = "";
	card.custom4 = "";
	card.defaultAddress = "";
	card.defaultEmail = "";
	card.department = "";
	card.displayName = "";
	card.familyName = "";
	card.faxNumber = "";
	card.faxNumberType = "";
	card.firstName = "";
	card.homeAddress = "";
	card.homeAddress2 = "";
	card.homeCity = "";
	card.homeCountry = "";
	card.homePhone = "";
	card.homePhoneType = "";
	card.homeState = "";
	card.homeZipCode = "";
	card.jobTitle = "";
	card.lastModifiedDate = 0;
	card.lastName = "";
	card.nickName = "";
	card.notes = "";
	card.pagerNumber = "";
	card.pagerNumberType = "";
	card.phoneticFirstName = "";
	card.phoneticLastName = "";
	//PRUint32 preferMailFormat = "";
	card.primaryEmail = "";
	card.secondEmail = "";
	card.spouseName = "";
	card.webPage1 = ""; // WebPage1 is work web page
	card.webPage2 = ""; // WebPage2 is home web page
	card.workAddress = "";
	card.workAddress2 = "";
	card.workCity = "";
	card.workCountry = "";
	card.workPhone = "";
	card.workPhoneType = "";
	card.workState = "";
	card.workZipCode = "";

/*
	card.cardType = "";
	card.category = "";
	card.defaultAddress = "";
	card.phoneticFirstName = "";
	card.phoneticLastName = "";
	card.spouseName = "";
	//PRUint32 preferMailFormat = "";
	//card.secondEmail = "";
	//card.aimScreenName = "";
*/
	if (format == "Xml")
		return xml2Card(message, card);
	
	// decode utf8
	message = decode_utf8(DecodeQuoted(message));
	
	// make an array of all lines for easier parsing
	var lines = message.split("\n");

	// now update it
	var found = false;
	
	for (var i = 0; i < lines.length; i++)
	{
		// decode utf8
		var vline = lines[i];
		
		// strip the \n at the end
		if (vline.charAt(vline.length-1) == '\r')
			vline = vline.substring(0, vline.length-1);
		
		var tok = vline.split(":");
		switch (tok[0].toUpperCase())
		{
			case "DATE":
				// now we gotta check times... convert the message first
				// save the date in microseconds
				// Date: Fri, 17 Dec 2004 15:06:42 +0100
				try
				{
					card.lastModifiedDate = (new Date(Date.parse(lines[i].substring(lines[i].indexOf(":")+1, lines[i].length)))).getTime() / 1000;
				}
				catch (ex)
				{
					consoleService.logStringMessage("unable to convert to date: " + lines[i]);
					alert(("unable to convert to date: " + lines[i] + "\nPlease copy the date string in a bug report an submit!\n(Also available in the information)"));
				}
				break;						
 				
			case "N":
				// N:Lastname;Firstname;Other;Prexif;Suffix
				var cur = tok[1].split(";"); 
				card.lastName = cur[0];
				card.firstName = cur[1];
				found = true;
				break;
			case "FN":
				card.displayName = tok[1];
				found = true;
				break;
			case "NICKNAME":
				card.nickName = tok[1];
				found = true;
				break;
			case "TITLE":
				card.jobTitle = tok[1];
				found = true;
				break;
			case "ORG":
				card.company = tok[1];
				found = true;
				break;
			case "EMAIL;TYPE=PREF":
			case "EMAIL;TYPE=INTERNET,PREF":
				card.defaultEmail = tok[1];
				found = true;
				break;
			case "EMAIL;INTERNET":
			case "EMAIL":
				card.primaryEmail = tok[1];
				found = true;
		    break;
			case "TEL;TYPE=CELL;TYPE=VOICE":
			case "TEL;TYPE=VOICE;TYPE=CELL":
			case "TEL;TYPE=CELL":
				card.cellularNumber = tok[1];
				found = true;
				break;
			case "TEL;TYPE=VOICE;TYPE=HOME":
			case "TEL;TYPE=HOME;TYPE=VOICE":
			case "TEL;TYPE=VOICE":
			case "TEL;TYPE=HOME":
				card.homePhone = tok[1];
				found = true;
				break;
			case "TEL;TYPE=WORK;TYPE=VOICE":
			case "TEL;TYPE=VOICE;TYPE=WORK":
			case "TEL;TYPE=WORK":
				card.workPhone = tok[1];
				found = true;
				break;
			case "TEL;TYPE=FAX":
				card.faxNumber = tok[1];	
 				found = true;
				break;
			case "TEL;TYPE=PAGER":
				card.pagerNumber = tok[1];
				found = true;
				break;
			case "BDAY":
				// BDAY:1987-09-27T08:30:00-06:00
				var cur = tok[1].split("-");
				card.birthYear = cur[0];
				card.birthMonth = cur[1];
				card.birthDay = (cur[2].indexOf("T") != -1)?cur[2].substring(0,cur[2].indexOf("T")):cur[2];
				found = true;
		  	break;
			case "ANNIVERSARY":
				// This is not a standard vCard entry.
 				var cur = tok[1].split("-");

				card.anniversaryYear = cur[0];
				card.anniversaryMonth = cur[1];
				// BDAY:1987-09-27T08:30:00-06:00
				card.anniversaryDay = (cur[2].indexOf("T") != -1)?cur[2].substring(0,cur[2].indexOf("T")):cur[2];
				found = true;
		  	break;
		  	
		  case "ADR;TYPE=HOME,POSTAL":
		  case "ADR;TYPE=HOME":
				// ADR:POBox;Ext. Address;Address;City;State;Zip Code;Country
				var cur = tok[1].split(";");
				card.homeAddress2 = cur[1];
				card.homeAddress = cur[2];
				card.homeCity = cur[3];
				card.homeState = cur[4];
				card.homeZipCode = cur[5];
				card.homeCountry = cur[6];
				found = true;
		  	break;
		  case "ADR;TYPE=WORK,POSTAL":
		  case "ADR;TYPE=WORK":
				var cur = tok[1].split(";");
				card.workAddress2 = cur[1];
				card.workAddress = cur[2];
				card.workCity = cur[3];
				card.workState = cur[4];
				card.workZipCode = cur[5];
				card.workCountry = cur[6];
				found = true;
		  	break;
		  case "NOTE":
		  	card.notes = tok[1];
				found = true;
		  	break;
		  case "DEPT":
		  	card.department = tok[1];
				found = true;
		  	break;
		  case "CUSTOM1":
		  	card.custom1 = tok[1];
				found = true;
		  	break;
		  case "CUSTOM2":
		  	card.custom2 = tok[1];
				found = true;
		  	break;
		  case "CUSTOM3":
		  	card.custom3 = tok[1];
				found = true;
		  	break;

		  case "URL;TYPE=WORK":
		  case "URL":
		  	card.webPage1 = tok[1]; // WebPage1 is work web page
				found = true;
				break;
		  case "URL;TYPE=PRIVATE":
		  case "URL;TYPE=PERSONAL":
		  	card.webPage2 = tok[1]; // WebPage2 is home web page
				found = true;
				break;
		  case "UID":
		  	card.custom4 = tok[1];
		  	break;
		} // end switch
	}
	
	return found;
}

/**
 * Creates a vcard message out of a card.
 * This creates the WHOLE message including header
 */
function card2Message (card, format)
{
	if (card.custom4 == null || card.custom4.length < 2)
		return null;
	
	if(format == "Xml")
	{
		return genMailHeader(card.custom4, "", "application/x-vnd.kolab.contact", true) + encodeQuoted(encode_utf8(card2Xml(card)));
	}
	

	// save the date in microseconds
	// Date: Fri, 17 Dec 2004 15:06:42 +0100
	var cdate = new Date (card.lastModifiedDate*1000);
	var sTime = (cdate.getHours()<10?"0":"") + cdate.getHours() + ":" + (cdate.getMinutes()<10?"0":"") + cdate.getMinutes() + ":" +
		(cdate.getSeconds()<10?"0":"") + cdate.getSeconds();
	var sdate = "Date: " + getDayString(cdate.getDay()) + ", " + cdate.getDate() + " " +
		getMonthString (cdate.getMonth()) + " " + cdate.getFullYear() + " " + sTime
		 + " " + (((cdate.getTimezoneOffset()/60) < 0)?"-":"+") +
		(((cdate.getTimezoneOffset()/60) < 10)?"0":"") + cdate.getTimezoneOffset() + "\n";

	
	var msg = "BEGIN:VCARD\n";
	// N:Lastname;Firstname;Other;Prefix;Suffix
 	if (checkExist (card.firstName) || checkExist (card.lastName))
		msg += "N:" + card.lastName + ";" + card.firstName + ";;;\n"
 	if (checkExist (card.displayName))
		msg += "FN:" + card.displayName + "\n";
 	if (checkExist (card.nickName))
		msg += "NICKNAME:" + card.nickName + "\n";
 	if (checkExist (card.jobTitle))
		msg += "TITLE:" + card.jobTitle + "\n";
	if (checkExist (card.company))
		msg += "ORG:" + card.company + "\n";
 	if (checkExist (card.primaryEmail))
		msg += "EMAIL:" + card.primaryEmail + "\n";
 	if (checkExist (card.defaultEmail))
		msg += "EMAIL;TYPE=INTERNET,PREF:" + card.defaultEmail  + "\n";
 	if (checkExist (card.cellularNumber))
		msg += "TEL;TYPE=CELL:" + card.cellularNumber + "\n";
 	if (checkExist (card.homePhone))
		msg += "TEL;TYPE=HOME:" + card.homePhone + "\n";
 	if (checkExist (card.faxNumber))
		msg += "TEL;TYPE=FAX:" + card.faxNumber + "\n";
 	if (checkExist (card.workPhone))
		msg += "TEL;TYPE=WORK:" + card.workPhone + "\n";
 	if (checkExist (card.pagerNumber))
		msg += "TEL;TYPE=PAGE:" + card.pagerNumber + "\n";
 	if (checkExist (card.department))
		msg += "DEPT:" + card.department + "\n";
	// BDAY:1987-09-27T08:30:00-06:00
	if (checkExist(card.birthYear) 
		||checkExist(card.birthDay) 
		|| checkExist(card.birthMonth))
	{
		msg += "BDAY:";
		msg += card.birthYear + "-";
		if (card.birthMonth < 10)
			msg += "0";
		msg += card.birthMonth + "-";
		if (card.birthDay < 10)
			msg += "0";
		msg += card.birthDay + "\n";
	}
	if (checkExist(card.anniversaryYear) 
		||checkExist(card.anniversaryDay) 
		||checkExist(card.anniversaryMonth))
	{
		msg += "ANNIVERSARY:" 
		msg += card.anniversaryYear + "-";
		if (card.anniversaryMonth < 10)
			msg += "0";
		msg += card.anniversaryMonth + "-";
		if (card.anniversaryDay < 10)
			msg += "0";
		msg += card.anniversaryDay + "\n";
	}
 	if (checkExist (card.webPage1))
		msg += "URL:" + card.webPage1 + "\n";
 	if (checkExist (card.webPage2))
		msg += "URL;TYPE=PERSONAL:" + card.webPage2 + "\n";
	// ADR:POBox;Ext. Address;Address;City;State;Zip Code;Country
	if (checkExist (card.workAddress2) 
		|| checkExist (card.workAddress) 
		|| checkExist (card.workCountry) 
		|| checkExist (card.workCity) 
		|| checkExist (card.workState))
	{
		msg += "ADR;TYPE=WORK:;";
		msg += card.workAddress2 + ";";
		msg += card.workAddress + ";";
		msg += card.workCity + ";";
		msg += card.workState + ";";
		msg += card.workZipCode + ";";
		msg += card.workCountry + "\n";
	}
	// ADR:POBox;Ext. Address;Address;City;State;Zip Code;Country
	if (checkExist (card.homeAddress2) 
		|| checkExist (card.homeAddress) 
		|| checkExist (card.homeCountry) 
		|| checkExist (card.homeCity) 
		|| checkExist (card.homeState))
	{
		msg += "ADR;TYPE=HOME:;";
		msg += card.homeAddress2 + ";";
		msg += card.homeAddress + ";";
		msg += card.homeCity + ";";
		msg += card.homeState + ";";
		msg += card.homeZipCode + ";";
		msg += card.homeCountry + "\n";
 	}
 	if (checkExist (card.custom1))
		msg += "CUSTOM1:" + card.custom1.replace (/\n/g, "\\n") + "\n";
 	if (checkExist (card.custom2))
		msg += "CUSTOM2:" + card.custom2.replace (/\n/g, "\\n") + "\n";
 	if (checkExist (card.custom3))
		msg += "CUSTOM3:" + card.custom3.replace (/\n/g, "\\n") + "\n";
 	// yeap one than more line (or something like that :P)
 	if (checkExist (card.notes))
		msg += "NOTE:" + card.notes.replace (/\n/g, "\\n") + "\n";
	msg += "UID:" + card.custom4 + "\n";	
 	msg += "VERSION:3.0\n";
 	msg += "END:VCARD\n\n";

	return genMailHeader(card.custom4, "vCard", "text/x-vcard", false) + encodeQuoted(encode_utf8(msg));
}
