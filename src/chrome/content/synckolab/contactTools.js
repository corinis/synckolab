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
 *                 Steven D Miller (Copart) <stevendm@rellims.com>
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
 * @param xml string - a string with the vcard (make sure its trimmed from whitespace)
 * @param card nsIAbCard - the card to update
 * @param extraFields Array - extra fields to save with the card (may be null)
 *
 */
function xml2Card (xml, card, extraFields)
{
	// until the boundary = end of xml
	xml = decode_utf8(DecodeQuoted(xml));
	

	// convert the string to xml
	var parser = Components.classes["@mozilla.org/xmlextras/domparser;1"].getService(Components.interfaces.nsIDOMParser); 
	var doc = parser.parseFromString(xml, "text/xml");
	
	
	var cur = doc.firstChild.firstChild;
	var found = false;
	
	var email = 0;
	
	while(cur != null)
	{
		
		if (cur.nodeType == Node.ELEMENT_NODE)//1
		{
			switch (cur.nodeName.toUpperCase())
			{
				case "LAST-MODIFICATION-DATE":
						/*
						ignore this since thunderbird implmentation just does not work
						var s = cur.firstChild.data;
						// now we gotta check times... convert the message first
						// save the date in microseconds
						// 2005-03-30T15:28:52Z
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
						default:
							// remember other emails
					  		addField(extraFields, "EMAIL", getXmlResult(cur, "SMTP-ADDRESS", ""));
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
					default:
						// remember other emails
				  		addField(extraFields, "PHONE:" + getXmlResult(cur, "TYPE", "CELLULAR"), num);
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

			  case "CUSTOM1":
		  		if (cur.firstChild == null)
		  			break;
			  	card.custom1 = cur.firstChild.data;
			  	break;
			  case "CUSTOM2":
		  		if (cur.firstChild == null)
		  			break;
			  	card.custom1 = cur.firstChild.data;
			  	break;
			  case "CUSTOM3":
		  		if (cur.firstChild == null)
		  			break;
			  	card.custom1 = cur.firstChild.data;
			  	break;
			  	
			  case "IM-ADDRESS":
		  		if (cur.firstChild == null)
		  			break;
			  	card.aimScreenName = cur.firstChild.data;
			  	break;
			  	
			default:
		  		if (cur.firstChild == null)
		  			break;
				// remember other fields
		  		addField(extraFields, cur.nodeName, cur.firstChild.data);
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
 * @param card nsIAbCard: the adress book card
 * @param fields Array: all the fields not being held in the default card
 */
function card2Xml (card, fields)
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
			xml += "  <given-name>"+encode4XML(card.firstName)+"</given-name>\n";
//			xml += "  <middle-names>"+card.nickName+"</middle-names>\n"; // not really correct...
		if (checkExist (card.lastName))
			xml += "  <last-name>"+encode4XML(card.lastName)+"</last-name>\n";
		if (checkExist (card.displayName))		
		{
			xml += "  <full-name>"+encode4XML(card.displayName)+"</full-name>\n";
			displayName = card.displayName;
		}
		else
		if (checkExist (card.firstName) || checkExist (card.lastName))
		{
			displayName = card.firstName + " " + card.lastName;
			xml += "  <full-name>" + encode4XML(displayName) + "</full-name>\n";
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
	if (checkExist(card.workPhone))
	{	
		xml += " <phone>\n";
		xml += "  <type>fax</type>\n";
		xml += "  <number>"+card.faxNumber+"</number>\n";
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
		xml += "  <number>"+card.pagerNumber+"</number>\n"; 
		xml += " </phone>\n";
	}
	
	if (checkExist(card.primaryEmail))
	{
		xml += " <email type=\"primary\">\n";
		xml += "  <display-name>"+encode4XML(displayName)+"</display-name>\n";
		xml += "  <smtp-address>"+encode4XML(card.primaryEmail)+"</smtp-address>\n";
		xml += " </email>\n";
	}
	
	if (checkExist(card.secondEmail))
	{
		xml += " <email>\n";
		xml += "  <display-name>"+encode4XML(displayName)+"</display-name>\n";
		xml += "  <smtp-address>"+encode4XML(card.secondEmail)+"</smtp-address>\n";
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
	xml += nodeWithContent("custom1", card.custom1, false);
	xml += nodeWithContent("custom2", card.custom2, false);
	xml += nodeWithContent("custom3", card.custom3, false);
	
	// add extra/missing fields
	if (fields != null)
	{
		for (var i = 0; i < fields.length; i++)
		{
			xml += nodeWithContent(fields[i][0], fields[i][1], false);
		}
	}
	
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
	card.preferMailFormat + ":" + //Added by Copart, will evidently create a lot of SHA mismatches on first update after sync, auto update will occur
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
 * This function compares two vcards.
 * It takes note of most fields (except custom4)
 *
 */
function equalsContact (a, b)
{
	//Fields to look for
	var fieldsArray = new Array(
		"firstName","lastName","displayName","nickName",
		"primaryEmail","secondEmail","aimScreenName",
		"workPhone","homePhone","faxNumber","pagerNumber","cellularNumber",
		"homeAddress","homeAddress2","homeCity","homeState","homeZipCode","homeCountry","webPage2",
		"jobTitle","department","company","workAddress","workAddress2","workCity","workState","workZipCode","workCountry","webPage1",
		"custom1","custom2","custom3","notes");

	for(var i=0 ; i < fieldsArray.length ; i++ ) {
		if ( eval("a."+fieldsArray[i]) != eval("b."+fieldsArray[i]) )
		{
			logMessage ("not equals " + fieldsArray[i], 3);
			return false;
		}
	}
	
	return true;	
}


/**
 * Parses a vcard message to a addressbook card.
 * This function ignores unused headers.
 * It also finds out if we are working with a vcard or a xml format
 * You can create a new card using:
 * newcard = Components.classes["@mozilla.org/addressbook/cardproperty;1"].createInstance(Components.interfaces.nsIAbCard);	
 * @param message string - a string with the vcard (make sure its trimmed from whitespace)
 * @param card nsIAbCard - the card to update
 * @param fields Array - extra fields to save with the card (may be null)
 *
 */
function message2Card (message, card, extraFields)
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
	card.preferMailFormat = ""; //Added by Copart
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
	// fix for bug #16766: message has no properties
	if (message == null)
		return false;
		
	// check for xml style
	if (message.indexOf("<?xml") != -1 || message.indexOf("<?XML") != -1)
		return xml2Card(message, card);
	
	// decode utf8
	message = decode_utf8(DecodeQuoted(message));
	
	// make an array of all lines for easier parsing
	var lines = message.split("\n");

	// now update it
	var found = false;
	
	// remember which email we already have and set the other one accordingly
	var gotEmailPrimary = false, gotEmailSecondary = false;
	
	for (var i = 0; i < lines.length; i++)
	{
		// decode utf8
		var vline = lines[i];
		
		// strip the \n at the end
		if (vline.charAt(vline.length-1) == '\r')
			vline = vline.substring(0, vline.length-1);
		
		var tok = vline.split(":");
		
		// fix for bug #16839: Colon in address book field
		for (var j = 2; j < tok.length; j++)
			tok[1] += ":" + tok[j];
		
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
				// the "preferred" email is the primary
				if (!gotEmailPrimary)
				{
					card.primaryEmail = tok[1];
					gotEmailPrimary = true;
				}
				else
				if (!gotEmailSecondary)
				{
					card.secondEmail = tok[1];
					gotEmailSecondary = true;
				}
				else
				{
					addField(extraFields, tok[0], tok[1]);
				}
				
				found = true;
				break;
			case "EMAIL;INTERNET":
			case "EMAIL": //This is here to limit compact to existing vcards
				// make sure to fill all email fields
				if (!gotEmailSecondary)
				{
					card.secondEmail = tok[1];
					gotEmailSecondary = true;
				}
				else
				if (!gotEmailPrimary)
				{
					card.primaryEmail = tok[1];
					gotEmailPrimary = true;
				}
				else
				{
					addField(extraFields, tok[0], tok[1]);
				}

				found = true;
		    break;
			case "X-EMAILFORMAT": 
			// This will set the Email format to vCard, not part of vCard 3.0 spec, so the X- is there, I assume a Kolab server would just ignore this field
				switch(tok[1]) {
					case "Unknown":
						card.preferMailFormat = 0;
					case "Plain Text":
						card.preferMailFormat = 1;
					case "HTML":
						card.preferMailFormat = 2;
				}
	    	found = true;
    		break;
			case "X-AIM": // not standard vcard spec, therefore, prepended with an X
				card.aimScreenName = tok[1];
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
			case "TEL;TYPE=PAGE":
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
				card.notes = tok[1].replace (/\\n/g, "\n"); // carriage returns were stripped, add em back
				found = true;
		  	break;
		  case "DEPT":
		  	card.department = tok[1];
				found = true;
		  	break;
		  case "CUSTOM1":
				card.custom1 = tok[1].replace (/\\n/g, "\n"); // carriage returns were stripped, add em back
				found = true;
		  	break;
		  case "CUSTOM2":
				card.custom2 = tok[1].replace (/\\n/g, "\n"); // carriage returns were stripped, add em back
				found = true;
		  	break;
		  case "CUSTOM3":
				card.custom3 = tok[1].replace (/\\n/g, "\n"); // carriage returns were stripped, add em back
				found = true;
		  	break;

		  case "URL;TYPE=WORK":
		  case "URL":
				// WebPage1 is work web page
				card.webPage1 = decodeCardField(tok[1]); // decode to convert the : char hex codes back to ascii
				found = true;
				break;
		  case "URL;TYPE=PRIVATE":
		  case "URL;TYPE=PERSONAL":
				// WebPage2 is home web page
				card.webPage2 = decodeCardField(tok[1]); // decode to convert the : char hex codes back to ascii
				found = true;
				break;
		  case "UID":
		  	card.custom4 = tok[1];
		  	break;
		  default:
		  	addField(extraFields, tok[0], tok[1]);
		  	break;
		} // end switch
	}
		
	return found;
}

function card2Human (card)
{
	var msg = "";

 	if (checkExist (card.firstName) || checkExist (card.lastName))
		msg += "Name: " + card.lastName + ";" + card.firstName + ";;;\n"
 	if (checkExist (card.jobTitle))
		msg += "Title: " + card.jobTitle + "\n";
	if (checkExist (card.company))
		msg += "Company: " + card.company + "\n\n";
 	if (checkExist (card.webPage1))
		msg += "Web: " + card.webPage1 + "\n"; // encode the : chars to HEX, vcard values cannot contain colons
 	if (checkExist (card.webPage2))
		msg += "Web: " + card.webPage2 + "\n\n";

  	if (checkExist (card.cellularNumber))
		msg += "Cell #: " + card.cellularNumber + "\n";
 	if (checkExist (card.homePhone))
		msg += "Home #: " + card.homePhone + "\n";
 	if (checkExist (card.faxNumber))
		msg += "Fax #: " + card.faxNumber + "\n";
 	if (checkExist (card.workPhone))
		msg += "Work #: " + card.workPhone + "\n";
 	if (checkExist (card.pagerNumber))
		msg += "Pager #: " + card.pagerNumber + "\n";
 	if (checkExist (card.department))
		msg += "Department: " + card.department + "\n";
	
 	if (checkExist (card.primaryEmail)) 
		msg += "E-Mail:" + card.primaryEmail  + "\n";
 	if (checkExist (card.secondEmail)) 
		msg += "E-Mail:" + card.secondEmail + "\n";

	if (checkExist(card.birthYear) 
		||checkExist(card.birthDay) 
		|| checkExist(card.birthMonth))
	{
		msg += "Birthday: ";
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
		msg += "Anniversary: " 
		msg += card.anniversaryYear + "-";
		if (card.anniversaryMonth < 10)
			msg += "0";
		msg += card.anniversaryMonth + "-";
		if (card.anniversaryDay < 10)
			msg += "0";
		msg += card.anniversaryDay + "\n";
	}


	if (checkExist (card.workAddress2) 
		|| checkExist (card.workAddress) 
		|| checkExist (card.workCountry) 
		|| checkExist (card.workCity) 
		|| checkExist (card.workState))
	{
		msg += "Work: ";
		msg += card.workAddress2 + "\n";
		msg += card.workAddress + "\n";
		msg += card.workZipCode + " ";
		msg += card.workState + " ";
		msg += card.workCity + "\n";
		msg += card.workCountry + "\n";
	}
	// ADR:POBox;Ext. Address;Address;City;State;Zip Code;Country
	if (checkExist (card.homeAddress2) 
		|| checkExist (card.homeAddress) 
		|| checkExist (card.homeCountry) 
		|| checkExist (card.homeCity) 
		|| checkExist (card.homeState))
	{
		msg += "Home: ";
		msg += card.homeAddress2 + "\n";
		msg += card.homeAddress + "\n";
		msg += card.homeZipCode + " ";
		msg += card.homeState + " ";
		msg += card.homeCity + "\n";
		msg += card.homeCountry + "\n";
 	}
	return msg;
}

/**
 * Creates a vcard message out of a card.
 * This creates the WHOLE message including header
 * @param card nsIAbCard - the adress book card 
 * @param email String - the email of the current account
 * @param format String - the format to use (Xml|VCard)
 * @param fFile nsIFile - an array holding all the extra fields not in the card structure
 */
function card2Message (card, email, format, fFile)
{
	// it may be we do not have a uid - skip it then
	if (card.custom4 == null || card.custom4.length < 2)
		return null;
	
	// read the database file
	var fields = readDataBase (fFile);
	
	// for the kolab xml format
	if(format == "Xml")
	{
		return generateMail(card.custom4, email, "", "application/x-vnd.kolab.contact", 
			true, encodeQuoted(encode_utf8(card2Xml(card, fields))), card2Human(card));
	}
	

	// save the date in microseconds
	// Date: Fri, 17 Dec 2004 15:06:42 +0100
	var cdate = new Date (card.lastModifiedDate*1000);
	var sTime = (cdate.getHours()<10?"0":"") + cdate.getHours() + ":" + (cdate.getMinutes()<10?"0":"") + cdate.getMinutes() + ":" +
		(cdate.getSeconds()<10?"0":"") + cdate.getSeconds();
	var sdate = "DATE: " + getDayString(cdate.getDay()) + ", " + cdate.getDate() + " " +
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
		msg += "EMAIL;TYPE=INTERNET,PREF:" + card.primaryEmail  + "\n";
 	if (checkExist (card.secondEmail)) 
		msg += "EMAIL;TYPE=INTERNET:" + card.secondEmail + "\n";
 	if (checkExist (card.preferMailFormat)) { 
		switch(card.preferMailFormat) {
			case 0:
				msg += "X-EMAILFORMAT:Unknown\n";break;
			case 1:
				msg += "X-EMAILFORMAT:Plain Text\n";break;
			case 2:
				msg += "X-EMAILFORMAT:HTML\n";break;
		}
	}
 	if (checkExist (card.aimScreenName)) 
		msg += "X-AIM:" + card.aimScreenName + "\n"; 
  	if (checkExist (card.cellularNumber))
		msg += "TEL;TYPE=CELL:" + card.cellularNumber + "\n";
 	if (checkExist (card.homePhone))
		msg += "TEL;TYPE=HOME:" + card.homePhone + "\n";
 	if (checkExist (card.faxNumber))
		msg += "TEL;TYPE=FAX:" + card.faxNumber + "\n";
 	if (checkExist (card.workPhone))
		msg += "TEL;TYPE=WORK:" + card.workPhone + "\n";
 	if (checkExist (card.pagerNumber))
		msg += "TEL;TYPE=PAGER:" + card.pagerNumber + "\n";
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
		msg += "URL:" + encodeCardField(card.webPage1) + "\n"; // encode the : chars to HEX, vcard values cannot contain colons
 	if (checkExist (card.webPage2))
		msg += "URL;TYPE=PERSONAL:" + encodeCardField(card.webPage2) + "\n";
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
	// add extra/missing fields
	if (fields != null)
	{
		for (var i = 0; i < fields.length; i++)
		{
			msg += fields[i][0] + ":" + fields[i][1] + "\n";
		}
	}
 	msg += "VERSION:3.0\n";
 	msg += "END:VCARD\n\n";

	return generateMail(card.custom4, email, "vCard", "application/x-vcard", 
			false, encodeQuoted(encode_utf8(msg)), null);
}


/*
 * Replaces any ; or : with their equivalent char codes since these are reserved characters in vcard spec
 * By Copart
 */
function encodeCardField(fieldValue) 
{
	var safeStr;
	safeStr = fieldValue.replace(/:/g, "=3A");
	return safeStr.replace(/;/g, "=3B");
}

/*
 * Decodes a string encoded by encodeCardField
 * By Copart
 */
function decodeCardField(fieldValue) 
{
	var unsafeStr;
	unsafeStr = fieldValue.replace(/=3A/g, ":");
	return unsafeStr.replace(/=3B/g, ";");
}


/**
 * get the uid of a card
 * This has to externalized because uids in lists are != uids in contacts
 */
function getUID (card)
{
	if (card == null)
		return null;
	if (card.isMailList)
		return null;
	if (card.custom4 == "")
		return null;
	return card.custom4;
}


function setUID (card, uid)
{
	if (card == null)
		return;
		
	card.custom4 = uid;
}