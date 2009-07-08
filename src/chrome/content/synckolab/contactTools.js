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

var MAIL_FORMAT_UNKNOWN = 0;
var MAIL_FORMAT_PLAINTEXT = 1;
var MAIL_FORMAT_HTML = 2;

/**
 * Tools to work with the address book. Parsing functions for vcard, Kolab xml
 * to and from contact plus some utility functions. 
 *
 * @param xml string - a string with the vcard (make sure its trimmed from whitespace)
 * @param card nsIAbCard - the card to update
 * @param extraFields Array - extra fields to save with the card (may be null)
 *
 */
function xml2Card (xml, extraFields, cards)
{
	// until the boundary = end of xml
	xml = fixString4XmlParser(decode_utf8(decodeQuoted(xml)));

	// convert the string to xml
	var parser = Components.classes["@mozilla.org/xmlextras/domparser;1"].getService(Components.interfaces.nsIDOMParser); 	
	var doc = parser.parseFromString(xml, "text/xml");
	
	var topNode = doc.firstChild;
	if (topNode.nodeName == "parsererror")
	{
		// so this message has no valid XML part :-(
		logMessage("Error parsing the XML content of this message.\n" + xml, LOG_ERROR + LOG_AB);
		return false;
	}
	if ((topNode.nodeType != Node.ELEMENT_NODE) || (topNode.nodeName.toUpperCase() != "CONTACT"))
	{
		// this can't be an event in Kolab XML format
		logMessage("This message doesn't contain a contact in Kolab XML format.\n" + xml, LOG_ERROR + LOG_AB);
		return false;
	}

	var card = Components.classes["@mozilla.org/addressbook/cardproperty;1"].createInstance(Components.interfaces.nsIAbCard);
	
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
						ignore this since thunderbird implementation just does not work
						var s = decode4XML(cur.firstChild.data);
						// now we gotta check times... convert the message first
						// save the date in microseconds
						// 2005-03-30T15:28:52Z
						try
						{
							// we dont need the date anyways.. so lets skip that part
							// setCardProperty(card, "LastModifiedDate", string2DateTime(s).getTime() / 1000);
						}
						catch (ex)
						{
							consoleService.logStringMessage("unable to convert to date: " + s);
							alert(("unable to convert to date: " + s + "\nPlease copy the date string in a bug report an submit!\n(Also available in the information)"));
						}
						*/
						break;						

				case "NAME":
					setCardProperty(card, "FirstName", getXmlResult(cur, "GIVEN-NAME", ""));
					setCardProperty(card, "LastName", getXmlResult(cur, "LAST-NAME", ""));
					setCardProperty(card, "DisplayName", getXmlResult(cur, "FULL-NAME", ""));
					found = true;
				break;
				
				// set the prefer mail format (this is not covered by kolab itself)
				case "PREFER-MAIL-FORMAT":
					// 0: unknown
					// 1: plaintext
					// 2: html
					var format = decode4XML(cur.firstChild.data).toUpperCase();
					setCardProperty(card, "PreferMailFormat", MAIL_FORMAT_UNKNOWN);
					switch(format)
					{
						case 'PLAINTEXT':
						case 'TEXT':
						case 'TXT':
						case 'PLAIN': 
						case '1':
							setCardProperty(card, "PreferMailFormat", MAIL_FORMAT_PLAINTEXT);
							break;
						case 'HTML':
						case 'RICHTEXT':
						case 'RICH':
						case '2':
							setCardProperty(card, "PreferMailFormat", MAIL_FORMAT_HTML);
					}
				break;

				case "JOB-TITLE":
			  		if (cur.firstChild == null)
			  			break;
					setCardProperty(card, "JobTitle", decode4XML(cur.firstChild.data));
					found = true;
					break;

				case "NICK-NAME":
			  		if (cur.firstChild == null)
			  			break;
					setCardProperty(card, "NickName", decode4XML(cur.firstChild.data));
					found = true;
					break;

				case "EMAIL":
					logMessage("email: " + email + " - " + getXmlResult(cur, "SMTP-ADDRESS", ""), LOG_ERROR + LOG_AB);
					switch (email)
					{
						case 0:
							setCardProperty(card, "PrimaryEmail", getXmlResult(cur, "SMTP-ADDRESS", ""));
							// only applies to tbird < 3
							if (card.defaultEmail)
								card.defaultEmail = getCardProperty(card, "PrimaryEmail");
							break;
						case 1:
							setCardProperty(card, "SecondEmail", getXmlResult(cur, "SMTP-ADDRESS", ""));
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
						setCardProperty(card, "Category", decode4XML(cur.firstChild.data));
					break;

			  case "ORGANIZATION":
			  		if (cur.firstChild != null)
				  		setCardProperty(card, "Company", decode4XML(cur.firstChild.data));
					found = true;
			  	break;
			  	
				// these two are the same
			  case "PHONE":
			  	var num = getXmlResult(cur, "NUMBER", "");
			  	switch (getXmlResult(cur, "TYPE", "CELLULAR").toUpperCase())
			  	{
			  		case "MOBILE":
			  		case "CELLULAR":
			  			setCardProperty(card, "CellularNumber", num);
			  			break;
			  		case "HOME":
			  		case "HOME1":
			  			setCardProperty(card, "HomePhone", num);
			  			break;
			  		case "FAX":
			  		case "BUSINESSFAX":
			  			setCardProperty(card, "FaxNumber", num);
			  			break;
			  		case "BUSINESS":
			  		case "BUSINESS1":
			  			setCardProperty(card, "WorkPhone", num);
			  			break;
			  		case "PAGE":
			  			setCardProperty(card, "PagerNumber", num);
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
					setCardProperty(card, "BirthYear", tok[0]);
					setCardProperty(card, "BirthMonth", tok[1]);
					// BDAY: 1987-09-27
			  		setCardProperty(card, "BirthDay", tok[2]);
					found = true;
			  	break;
			  	// anniversary - not in vcard rfc??
			  case "ANNIVERSARY":
			  		if (cur.firstChild == null)
			  			break;
					var tok = decode4XML(cur.firstChild.data).split("-");
	
					setCardProperty(card, "AnniversaryYear", tok[0]);
					setCardProperty(card, "AnniversaryMonth", tok[1]);
					// BDAY:1987-09-27T08:30:00-06:00
			  		setCardProperty(card, "AnniversaryDay", tok[2]);
					found = true;
			  	break;
			  	/* @deprecated
			  case "PREFERRED-ADDRESS":
		  		if (cur.firstChild != null)
				  	setCardProperty(card, "DefaultAddress", decode4XML(cur.firstChild.data));
			  	break;
			  	*/
			  case "ADDRESS":
			  	switch (getXmlResult(cur, "TYPE", "HOME").toUpperCase())
			  	{
			  			case "HOME":
								setCardProperty(card, "HomeAddress", getXmlResult(cur, "STREET", ""));
								setCardProperty(card, "HomeAddress2", getXmlResult(cur, "STREET2", ""));
								setCardProperty(card, "HomeCity", getXmlResult(cur, "LOCALITY", ""));
								setCardProperty(card, "HomeState", getXmlResult(cur, "REGION", ""));
								setCardProperty(card, "HomeZipCode", getXmlResult(cur, "POSTAL-CODE", ""));
								setCardProperty(card, "HomeCountry", getXmlResult(cur, "COUNTRY", ""));
								break;
			  			case "BUSINESS":
								setCardProperty(card, "WorkAddress", getXmlResult(cur, "STREET", ""));
								setCardProperty(card, "WorkAddress2", getXmlResult(cur, "STREET2", ""));
								setCardProperty(card, "WorkCity", getXmlResult(cur, "LOCALITY", ""));
								setCardProperty(card, "WorkState", getXmlResult(cur, "REGION", ""));
								setCardProperty(card, "WorkZipCode", getXmlResult(cur, "POSTAL-CODE", ""));
								setCardProperty(card, "WorkCountry", getXmlResult(cur, "COUNTRY", ""));
								break;
					}
					found = true;
			  	break;
			  case "BODY":
			  		if (cur.firstChild == null)
			  			break;
			  		
				  	var cnotes = decode4XML(cur.firstChild.data);
				  	setCardProperty(card, "Notes", cnotes.replace(/\\n/g, "\n"));
				  	logMessage("cur.firstchild.data.length="+cur.firstChild.data.length + " - cnotes=" + cnotes.length + " - card.notes=" + getCardProperty(card, "Notes").length , LOG_DEBUG + LOG_AB);
					found = true;
			  	break;
			  case "DEPARTMENT":
			  		if (cur.firstChild == null)
			  			break;
				  	setCardProperty(card, "Department", decode4XML(cur.firstChild.data));
					found = true;
			  	break;
	
			  case "WEB-PAGE":
			  		if (cur.firstChild == null)
			  			break;
				  	setCardProperty(card, "WebPage1", decode4XML(cur.firstChild.data));
					found = true;
					break;
					
			  case "BUSINESS-WEB-PAGE":
			  		if (cur.firstChild == null)
			  			break;
				  	setCardProperty(card, "WebPage2", decode4XML(cur.firstChild.data));
					found = true;
					break;

			  case "UID":
		  		if (cur.firstChild == null)
		  			break;
			  	setCardProperty(card, "Custom4", decode4XML(cur.firstChild.data));
			  	break;

			  case "CUSTOM1":
		  		if (cur.firstChild == null)
		  			break;
			  	setCardProperty(card, "Custom1", decode4XML(cur.firstChild.data));
			  	break;
			  case "CUSTOM2":
		  		if (cur.firstChild == null)
		  			break;
			  	setCardProperty(card, "Custom2", decode4XML(cur.firstChild.data));
			  	break;
			  case "CUSTOM3":
			  		if (cur.firstChild == null)
			  			break;
				  	setCardProperty(card, "Custom3", decode4XML(cur.firstChild.data));
				  	break;
			  	
			  case "IM-ADDRESS":
		  		if (cur.firstChild == null)
		  			break;
			  	setCardProperty(card, "AimScreenName", decode4XML(cur.firstChild.data));
			  	break;
			  	
			  case "ALLOW-REMOTE-CONTENT":
		  		if (cur.firstChild == null)
		  			break;
		  		if (cur.firstChild.data.toUpperCase() == 'TRUE')
		  			setCardProperty(card, "AllowRemoteContent", true);
		  		else
		  			setCardProperty(card, "AllowRemoteContent", false);
		  		break;
			default:
		  		if (cur.firstChild == null)
		  			break;
				logMessage("XC FIELD not found: " + cur.nodeName + ":" + decode4XML(cur.firstChild.data), LOG_WARNING + LOG_AB);
				// remember other fields
		  		addField(extraFields, cur.nodeName, decode4XML(cur.firstChild.data));
  				break;
			  	
			} // end switch
		}
		
		cur = cur.nextSibling;
	}

	if (found)
		return card;
		
	return null;
}

/**
 * Creates xml (kolab2) out of a given card. 
 * The return is the xml as string.
 * @param card nsIAbCard: the adress book list card
 * @param fields Array: all the fields not being held in the default card
 */
function list2Xml (card, fields)
{
	var xml = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n";
	xml += "<distribution-list version=\"1.0\" >\n";
	xml += " <product-id>SyncKolab, Kolab resource</product-id>\n";
	xml += " <uid>"+getCardProperty(card, "Custom4")+"</uid>\n";
	xml += nodeWithContent("categories", getCardProperty(card, "Category"), false);
	xml += " <creation-date>"+date2String(new Date(getCardProperty(card, "LastModifiedDate")*1000))+"T"+time2String(new Date(getCardProperty(card, "LastModifiedDate")*1000))+"Z</creation-date>\n";
	xml += " <last-modification-date>"+date2String(new Date(getCardProperty(card, "LastModifiedDate")*1000))+"T"+time2String(new Date(getCardProperty(card, "LastModifiedDate")*1000))+"Z</last-modification-date>\n";
	// ??
	xml += " <sensitivity>public</sensitivity>\n";
	if (checkExist(getCardProperty(card, "Description")))
			xml +=" <body>"+encode4XML(getCardProperty(card, "Description"))+"</body>\n";
	if (checkExist(getCardProperty(card, "Notes")))
			xml +=" <body>"+encode4XML(getCardProperty(card, "Notes"))+"</body>\n";
	xml += nodeWithContent("display-name", getCardProperty(card, "ListNickName"), false);

	var cList = card;
	if (cList.addressLists)
 	{
		var total = cList.addressLists.Count();
		if (total)
		{
			for ( var i = 0;  i < total; i++ )
			{
				var cur = cList.addressLists.GetElementAt(i);
				cur = cur.QueryInterface(Components.interfaces.nsIAbCard);
				xml += "  <member>";
				xml += nodeWithContent("display-name", getCardProperty(cur, "DisplayName"), false);		
				if (checkExist(getCardProperty(card, "PrimaryEmail")))						
					xml += nodeWithContent("smtp-address", cur.primaryEmail, false);
				else
				if (checkExist(getCardProperty(card, "SecondEmail")))
					xml += nodeWithContent("smtp-address", cur.secondEmail, false);
				else
					logMessage("ERROR: List entry without an email?!?" + getUID(cur), LOG_ERROR + LOG_AB);
									
				// custom4 is not necessary since there will be a smart-check
				if (checkExist (cur.custom4))
					xml += nodeWithContent("uid", cur.custom4, false);				
				xml += "  </member>\n";
			}
		}
	}

	xml += "</distribution-list>\n";
}

/**
 * Creates vcard (kolab1) out of a given list. 
 * The return is the vcard as string.
 * @param card nsIAbCard: the adress book list card
 * @param fields Array: all the fields not being held in the default card
 */
function list2Vcard (card, fields)
{
	// save the date in microseconds
	// Date: Fri, 17 Dec 2004 15:06:42 +0100
	var cdate = new Date (getCardProperty(card, "LastModifiedDate")*1000);
	var sTime = (cdate.getHours()<10?"0":"") + cdate.getHours() + ":" + (cdate.getMinutes()<10?"0":"") + cdate.getMinutes() + ":" +
		(cdate.getSeconds()<10?"0":"") + cdate.getSeconds();
	var sdate = "DATE: " + getDayString(cdate.getDay()) + ", " + cdate.getDate() + " " +
		getMonthString (cdate.getMonth()) + " " + cdate.getFullYear() + " " + sTime
		 + " " + (((cdate.getTimezoneOffset()/60) < 0)?"-":"+") +
		(((cdate.getTimezoneOffset()/60) < 10)?"0":"") + cdate.getTimezoneOffset() + "\n";

	
	var msg = "BEGIN:VCARD\n";	
	// N:Lastname;Firstname;Other;Prefix;Suffix
 	if (checkExist (getCardProperty(card, "FirstName")) || checkExist (getCardProperty(card, "LastName")))
		msg += "N:" + getCardProperty(card, "LastName") + ";" + getCardProperty(card, "FirstName") + ";;;\n"
 	if (checkExist (getCardProperty(card, "DisplayName")))
		msg += "FN:" + getCardProperty(card, "DisplayName") + "\n";
 	if (checkExist (getCardProperty(card, "ListNickName")))
		msg += "FN:" + getCardProperty(card, "ListNickName") + "\n";
 	if (checkExist (getCardProperty(card, "NickName")))
		msg += "NICKNAME:" + getCardProperty(card, "NickName") + "\n";
 	if (checkExist (getCardProperty(card, "JobTitle")))
		msg += "TITLE:" + getCardProperty(card, "JobTitle") + "\n";
	if (checkExist (getCardProperty(card, "Company")))
		msg += "ORG:" + getCardProperty(card, "Company") + "\n";
 	if (checkExist (getCardProperty(card, "PrimaryEmail"))) 
		msg += "EMAIL;TYPE=INTERNET,PREF:" + getCardProperty(card, "PrimaryEmail")  + "\n";
 	if (checkExist (getCardProperty(card, "SecondEmail"))) 
		msg += "EMAIL;TYPE=INTERNET:" + getCardProperty(card, "SecondEmail") + "\n";
 	if (checkExist (getCardProperty(card, "PreferMailFormat"))) { 
		switch(getCardProperty(card, "PreferMailFormat")) {
			case MAIL_FORMAT_UNKNOWN:
				msg += "X-EMAILFORMAT:Unknown\n";break;
			case MAIL_FORMAT_PLAINTEXT:
				msg += "X-EMAILFORMAT:Plain Text\n";break;
			case MAIL_FORMAT_HTML:
				msg += "X-EMAILFORMAT:HTML\n";break;
		}
	}
 	if (checkExist (getCardProperty(card, "AimScreenName"))) 
		msg += "X-AIM:" + getCardProperty(card, "AimScreenName") + "\n"; 
  	if (checkExist (getCardProperty(card, "CellularNumber")))
		msg += "TEL;TYPE=CELL:" + getCardProperty(card, "CellularNumber") + "\n";
 	if (checkExist (getCardProperty(card, "HomePhone")))
		msg += "TEL;TYPE=HOME:" + getCardProperty(card, "HomePhone") + "\n";
 	if (checkExist (getCardProperty(card, "FaxNumber")))
		msg += "TEL;TYPE=FAX:" + getCardProperty(card, "FaxNumber") + "\n";
 	if (checkExist (getCardProperty(card, "WorkPhone")))
		msg += "TEL;TYPE=WORK:" + getCardProperty(card, "WorkPhone") + "\n";
 	if (checkExist (getCardProperty(card, "PagerNumber")))
		msg += "TEL;TYPE=PAGER:" + getCardProperty(card, "PagerNumber") + "\n";
 	if (checkExist (getCardProperty(card, "Department")))
		msg += "DEPT:" + getCardProperty(card, "Department") + "\n";
	// BDAY:1987-09-27T08:30:00-06:00
	if (checkExist(getCardProperty(card, "BirthYear")) 
		||checkExist(getCardProperty(card, "BirthDay")) 
		|| checkExist(getCardProperty(card, "BirthMonth")))
	{
		msg += "BDAY:";
		msg += getCardProperty(card, "BirthYear") + "-";
		if (getCardProperty(card, "BirthMonth") < 10)
			msg += "0";
		msg += getCardProperty(card, "BirthMonth") + "-";
		if (getCardProperty(card, "BirthDay") < 10)
			msg += "0";
		msg += getCardProperty(card, "BirthDay") + "\n";
	}
	if (checkExist(getCardProperty(card, "AnniversaryYear")) 
		||checkExist(getCardProperty(card, "AnniversaryDay")) 
		||checkExist(getCardProperty(card, "AnniversaryMonth")))
	{
		msg += "ANNIVERSARY:" 
		msg += getCardProperty(card, "AnniversaryYear") + "-";
		if (getCardProperty(card, "AnniversaryMonth") < 10)
			msg += "0";
		msg += getCardProperty(card, "AnniversaryMonth") + "-";
		if (getCardProperty(card, "AnniversaryDay") < 10)
			msg += "0";
		msg += getCardProperty(card, "AnniversaryDay") + "\n";
	}
 	if (checkExist (getCardProperty(card, "WebPage1")))
		msg += "URL:" + encodeCardField(getCardProperty(card, "WebPage1")) + "\n"; // encode the : chars to HEX, vcard values cannot contain colons
 	if (checkExist (getCardProperty(card, "WebPage2")))
		msg += "URL;TYPE=PERSONAL:" + encodeCardField(getCardProperty(card, "WebPage2")) + "\n";
	// ADR:POBox;Ext. Address;Address;City;State;Zip Code;Country
	if (checkExist (getCardProperty(card, "WorkAddress2")) 
		|| checkExist (getCardProperty(card, "WorkAddress")) 
		|| checkExist (getCardProperty(card, "WorkCountry")) 
		|| checkExist (getCardProperty(card, "WorkCity")) 
		|| checkExist (getCardProperty(card, "WorkState")))
	{
		msg += "ADR;TYPE=WORK:;";
		msg += getCardProperty(card, "WorkAddress2") + ";";
		msg += getCardProperty(card, "WorkAddress") + ";";
		msg += getCardProperty(card, "WorkCity") + ";";
		msg += getCardProperty(card, "WorkState") + ";";
		msg += getCardProperty(card, "WorkZipCode") + ";";
		msg += getCardProperty(card, "WorkCountry") + "\n";
	}
	// ADR:POBox;Ext. Address;Address;City;State;Zip Code;Country
	if (checkExist (getCardProperty(card, "HomeAddress2")) 
		|| checkExist (getCardProperty(card, "HomeAddress")) 
		|| checkExist (getCardProperty(card, "HomeCountry")) 
		|| checkExist (getCardProperty(card, "HomeCity")) 
		|| checkExist (getCardProperty(card, "HomeState")))
	{
		msg += "ADR;TYPE=HOME:;";
		msg += getCardProperty(card, "HomeAddress2") + ";";
		msg += getCardProperty(card, "HomeAddress") + ";";
		msg += getCardProperty(card, "HomeCity") + ";";
		msg += getCardProperty(card, "HomeState") + ";";
		msg += getCardProperty(card, "HomeZipCode") + ";";
		msg += getCardProperty(card, "HomeCountry") + "\n";
 	}
 	if (checkExist (getCardProperty(card, "Custom1")))
		msg += "CUSTOM1:" + getCardProperty(card, "Custom1").replace (/\n/g, "\\n") + "\n";
 	if (checkExist (getCardProperty(card, "Custom2")))
		msg += "CUSTOM2:" + getCardProperty(card, "Custom2").replace (/\n/g, "\\n") + "\n";
 	if (checkExist (getCardProperty(card, "Custom3")))
		msg += "CUSTOM3:" + getCardProperty(card, "Custom3").replace (/\n/g, "\\n") + "\n";
 	// yeap one than more line (or something like that :P) 	
 	if (checkExist (getCardProperty(card, "Description")))
		msg += "NOTE:" + getCardProperty(card, "Description").replace (/\n/g, "\\n") + "\n";
 	if (checkExist (getCardProperty(card, "Notes")))
		msg += "NOTE:" + getCardProperty(card, "Notes").replace (/\n/g, "\\n") + "\n";
	msg += "UID:" + getCardProperty(card, "Custom4") + "\n";	
	// add extra/missing fields
	if (fields != null)
	{
		for (var i = 0; i < fields.length; i++)
		{
			msg += fields[i][0] + ":" + fields[i][1] + "\n";
		}
	}

	var uidList = "";
	
	var cList = card;
	if (cList.addressLists)
 	{
		var total = cList.addressLists.Count();
		logMessage ("List has " + total + " contacts", LOG_INFO + LOG_AB);
		if (!total || total == 0)
			return null; // do not add a list without members

		if (total)
		{
			for ( var i = 0;  i < total; i++ )
			{
				var cur = cList.addressLists.GetElementAt(i);
				cur = cur.QueryInterface(Components.interfaces.nsIAbCard);
				// generate the sub-vcard
				msg += card2Vcard(cur, null);
									
				// custom4 is not really necessary since there will be a smart-check
				if (checkExist (cur.custom4))
				{
					uidList += cur.custom4 + ";";
				}
			}
		}
		
	}
	else
		return null; // do not add a list without members
	msg += "X-LIST:" + uidList + "\n";
 	msg += "VERSION:3.0\n";
 	msg += "END:VCARD\n\n";
 	return msg;
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
	xml += " <uid>"+encode4XML(getCardProperty(card, "Custom4"))+"</uid>\n";
	xml += nodeWithContent("categories", getCardProperty(card, "Category"), false);
	//xml += " <creation-date>"+date2String(new Date(getCardProperty(card, "LastModifiedDate")*1000))+"T"+time2String(new Date(getCardProperty(card, "LastModifiedDate")*1000))+"Z</creation-date>\n";
	xml += " <last-modification-date>"+date2String(new Date(getCardProperty(card, "LastModifiedDate")*1000))+"T"+time2String(new Date(getCardProperty(card, "LastModifiedDate")*1000))+"Z</last-modification-date>\n";
	// ??
	xml += " <sensitivity>public</sensitivity>\n";
	if (checkExist(getCardProperty(card, "Notes")))
			xml +=" <body>"+encode4XML(getCardProperty(card, "Notes"))+"</body>\n";

	if (checkExist (getCardProperty(card, "FirstName")) || checkExist (getCardProperty(card, "LastName")) ||checkExist (getCardProperty(card, "DisplayName")) ||
		checkExist (getCardProperty(card, "NickName")))
	{
		xml += " <name>\n";
		if (checkExist (getCardProperty(card, "FirstName")))
			xml += "  <given-name>"+encode4XML(getCardProperty(card, "FirstName"))+"</given-name>\n";
//			xml += "  <middle-names>"+getCardProperty(card, "NickName")+"</middle-names>\n"; // not really correct...
		if (checkExist (getCardProperty(card, "LastName")))
			xml += "  <last-name>"+encode4XML(getCardProperty(card, "LastName"))+"</last-name>\n";
		if (checkExist (getCardProperty(card, "DisplayName")))		
		{
			xml += "  <full-name>"+encode4XML(getCardProperty(card, "DisplayName"))+"</full-name>\n";
			displayName = getCardProperty(card, "DisplayName");
		}
		else
		if (checkExist (getCardProperty(card, "FirstName")) || checkExist (getCardProperty(card, "LastName")))
		{
			displayName = getCardProperty(card, "FirstName") + " " + getCardProperty(card, "LastName");
			xml += nodeWithContent("full-name", displayName);
		}
			
		
		xml += " </name>\n";
	}
	xml += nodeWithContent("organization", getCardProperty(card, "Company"), false);
	xml += nodeWithContent("web-page", getCardProperty(card, "WebPage1"), false);
	// not really kolab.. but we need that somewhere
	xml += nodeWithContent("business-web-page", getCardProperty(card, "WebPage2"), false);
	xml += nodeWithContent("im-address", getCardProperty(card, "AimScreenName"), false);
	xml += nodeWithContent("department", getCardProperty(card, "Department"), false);
//" <office-location>zuhaus</office-location>\n";
//" <profession>programmierer</profession>\n";
	xml += nodeWithContent("job-title", getCardProperty(card, "JobTitle"), false);
	xml += nodeWithContent("nick-name", getCardProperty(card, "NickName"), false);
	
	
	var adate = getCardProperty(card, "BirthYear") + "-" + getCardProperty(card, "BirthMonth") + "-" + getCardProperty(card, "BirthDay");
	if (adate != "--")
		xml += nodeWithContent("birthday", adate, false);
	adate = getCardProperty(card, "AnniversaryYear") + "-" + getCardProperty(card, "AnniversaryMonth") + "-" + getCardProperty(card, "AnniversaryDay");
	if (adate != "--")
		xml += nodeWithContent("anniversary", adate, false);
	if (checkExist(getCardProperty(card, "HomePhone")))
	{	
		xml += " <phone>\n";
		xml += "  <type>home1</type>\n";
		xml += "  <number>"+getCardProperty(card, "HomePhone")+"</number>\n";
		xml += " </phone>\n";
	}
	if (checkExist(getCardProperty(card, "WorkPhone")))
	{	
		xml += " <phone>\n";
		xml += "  <type>business1</type>\n";
		xml += "  <number>"+getCardProperty(card, "WorkPhone")+"</number>\n";
		xml += " </phone>\n";
	}
	if (checkExist(getCardProperty(card, "FaxNumber")))
	{	
		xml += " <phone>\n";
		xml += "  <type>fax</type>\n";
		xml += "  <number>"+getCardProperty(card, "FaxNumber")+"</number>\n";
		xml += " </phone>\n";
	}
	if (checkExist(getCardProperty(card, "CellularNumber")))
	{	
		xml += " <phone>\n";
		xml += "  <type>mobile</type>\n";
		xml += "  <number>"+getCardProperty(card, "CellularNumber")+"</number>\n";
		xml += " </phone>\n";
	}
	if (checkExist(getCardProperty(card, "PagerNumber")))
	{	
		xml += " <phone>\n";
		xml += "  <type>page</type>\n";
		xml += "  <number>"+getCardProperty(card, "PagerNumber")+"</number>\n"; 
		xml += " </phone>\n";
	}
	
	if (checkExist(getCardProperty(card, "PrimaryEmail")))
	{
		xml += " <email type=\"primary\">\n";
		xml += "  <display-name>"+encode4XML(displayName)+"</display-name>\n";
		xml += "  <smtp-address>"+encode4XML(getCardProperty(card, "PrimaryEmail"))+"</smtp-address>\n";
		xml += " </email>\n";
	}
	
	if (checkExist(getCardProperty(card, "SecondEmail")))
	{
		xml += " <email>\n";
		xml += "  <display-name>"+encode4XML(displayName)+"</display-name>\n";
		xml += "  <smtp-address>"+encode4XML(getCardProperty(card, "SecondEmail"))+"</smtp-address>\n";
		xml += " </email>\n";
	}

	// if the mail format is set... 
	if (getCardProperty(card, "PreferMailFormat") != MAIL_FORMAT_UNKNOWN)
	{
		if (getCardProperty(card, "PreferMailFormat") == MAIL_FORMAT_PLAINTEXT)
		{
			xml += nodeWithContent("prefer-mail-format", "text", false);
		}
		else
		{
			xml += nodeWithContent("prefer-mail-format", "html", false);
		}
	}

	if (checkExist(getCardProperty(card, "HomeAddress")) || checkExist(getCardProperty(card, "HomeAddress2")) ||
		checkExist(getCardProperty(card, "HomeCity")) || checkExist(getCardProperty(card, "HomeState")) ||
		checkExist(getCardProperty(card, "HomeZipCode")) || checkExist(getCardProperty(card, "HomeCountry")))
	{
		xml += " <address>\n";
		xml += "  <type>home</type>\n";
		xml += nodeWithContent("street", getCardProperty(card, "HomeAddress"), false);
		xml += nodeWithContent("street2", getCardProperty(card, "HomeAddress2"), false);
		xml += nodeWithContent("locality", getCardProperty(card, "HomeCity"), false);
		xml += nodeWithContent("region", getCardProperty(card, "HomeState"), false);
		xml += nodeWithContent("postal-code", getCardProperty(card, "HomeZipCode"), false);
		xml += nodeWithContent("country", getCardProperty(card, "HomeCountry"), false);
		xml += " </address>\n";
	}

	if (checkExist(getCardProperty(card, "WorkAddress")) || checkExist(getCardProperty(card, "WorkAddress2")) ||
		checkExist(getCardProperty(card, "WorkCity")) || checkExist(getCardProperty(card, "WorkState")) ||
		checkExist(getCardProperty(card, "WorkZipCode")) || checkExist(getCardProperty(card, "WorkCountry")))
	{
		xml += " <address>\n";
		xml += "  <type>business</type>\n";
		xml += nodeWithContent("street", getCardProperty(card, "WorkAddress"), false);
		xml += nodeWithContent("street2", getCardProperty(card, "WorkAddress2"), false);
		xml += nodeWithContent("locality", getCardProperty(card, "WorkCity"), false);
		xml += nodeWithContent("region", getCardProperty(card, "WorkState"), false);
		xml += nodeWithContent("postal-code", getCardProperty(card, "WorkZipCode"), false);
		xml += nodeWithContent("country", getCardProperty(card, "WorkCountry"), false);
		xml += " </address>\n";
	}
		
	//xml += nodeWithContent("preferred-address", getCardProperty(card, "DefaultAddress"), false); @deprecated
	xml += nodeWithContent("custom1", getCardProperty(card, "Custom1"), false);
	xml += nodeWithContent("custom2", getCardProperty(card, "Custom2"), false);
	xml += nodeWithContent("custom3", getCardProperty(card, "Custom3"), false);
 	if (getCardProperty(card, "AllowRemoteContent"))
 		xml += nodeWithContent("allow-remote-content", "true", false);
 	else
 		xml += nodeWithContent("allow-remote-content", "false", false);
		
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
	return hex_sha1(getCardProperty(card, "AimScreenName") + ":" +
	getCardProperty(card, "AnniversaryDay") + ":" +
	getCardProperty(card, "AnniversaryMonth") + ":" +
	getCardProperty(card, "AnniversaryYear") + ":" +
	getCardProperty(card, "BirthDay") + ":" +
	getCardProperty(card, "BirthMonth") + ":" +
	getCardProperty(card, "BirthYear") + ":" +
	getCardProperty(card, "CardType") + ":" +
	getCardProperty(card, "Category") + ":" +
	getCardProperty(card, "CellularNumber") + ":" +
	getCardProperty(card, "CellularNumberType") + ":" +
	getCardProperty(card, "Company") + ":" +
	getCardProperty(card, "Custom1") + ":" +
	getCardProperty(card, "Custom2") + ":" +
	getCardProperty(card, "Custom3") + ":" +
	getCardProperty(card, "Custom4") + ":" +
	//getCardProperty(card, "DefaultAddress") + ":" + @deprecated
	getCardProperty(card, "Department") + ":" +
	getCardProperty(card, "DisplayName") + ":" +
	getCardProperty(card, "FamilyName") + ":" +
	getCardProperty(card, "FaxNumber") + ":" +
	getCardProperty(card, "FaxNumberType") + ":" +
	getCardProperty(card, "FirstName") + ":" +
	getCardProperty(card, "HomeAddress") + ":" +
	getCardProperty(card, "HomeAddress2") + ":" +
	getCardProperty(card, "HomeCity") + ":" +
	getCardProperty(card, "HomeCountry") + ":" +
	getCardProperty(card, "HomePhone") + ":" +
	getCardProperty(card, "HomePhoneType") + ":" +
	getCardProperty(card, "HomeState") + ":" +
	getCardProperty(card, "HomeZipCode") + ":" +
	getCardProperty(card, "JobTitle") + ":" +
	getCardProperty(card, "LastName") + ":" +
	getCardProperty(card, "NickName") + ":" +
	getCardProperty(card, "Notes") + ":" +
	getCardProperty(card, "PagerNumber") + ":" +
	getCardProperty(card, "PagerNumberType") + ":" +
	getCardProperty(card, "PhoneticFirstName") + ":" +
	getCardProperty(card, "PhoneticLastName") + ":" +
	getCardProperty(card, "PreferMailFormat") + ":" + //Added by Copart, will evidently create a lot of SHA mismatches on first update after sync, auto update will occur
	getCardProperty(card, "PrimaryEmail") + ":" +
	getCardProperty(card, "SecondEmail") + ":" +
	getCardProperty(card, "SpouseName") + ":" +
	getCardProperty(card, "WebPage1") + ":" + // WebPage1 is work web page
	getCardProperty(card, "WebPage2") + ":" + // WebPage2 is home web page
	getCardProperty(card, "WorkAddress") + ":" +
	getCardProperty(card, "WorkAddress2") + ":" +
	getCardProperty(card, "WorkCity") + ":" +
	getCardProperty(card, "WorkCountry") + ":" +
	getCardProperty(card, "WorkPhone") + ":" +
	getCardProperty(card, "WorkPhoneType") + ":" +
	getCardProperty(card, "WorkState") + ":" +
 	getCardProperty(card, "AllowRemoteContent") + ":" + 
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
		"FirstName","LastName","DisplayName","NickName",
		"PrimaryEmail","SecondEmail","AimScreenName","PreferMailFormat",
		"WorkPhone","HomePhone","FaxNumber","PagerNumber","CellularNumber",
		"HomeAddress","HomeAddress2","HomeCity","HomeState","HomeZipCode","HomeCountry","WebPage2",
		"JobTitle","Department","Company","WorkAddress","WorkAddress2","WorkCity","WorkState","WorkZipCode","WorkCountry","WebPage1",
		"Custom1","Custom2","Custom3","Notes");
	
	if (a.isMailList != b.isMailList)
		return;
		
	if (a.isMailList)
		fieldsArray = new Array("listNickName", "description");

	for(var i=0 ; i < fieldsArray.length ; i++ ) {
		var sa = getCardProperty(a, fieldsArray[i]);
		var sb = getCardProperty(b, fieldsArray[i]);
		// null check
		if (sa == null || sb == null)
		{
			if (sa == null && sb == null)
				continue;
			else
				return false;
		}
				
		// check if not equals
		if (sa.length != sb.length || sa != sb)
		{
			// if we got strings... maybe they only differ in whitespace
			if (sa.replace)
				// if they are equals without whitespace.. continue
				if (sa.replace(/\s|(\\n)/g, "") == sb.replace(/\s|(\\n)/g, ""))
					continue;
		
			logMessage ("not equals " + fieldsArray[i] + " '" + sa + "' vs. '" + sb + "'", LOG_DEBUG + LOG_AB);
			return false;
		}
	}
	
	// check for same contents
	if (a.isMailList)
	{
		// TODO
	}
	return true;	
}

function vList2Card (uids, lines, card, cards)
{
	var beginVCard = false;
    
    card.isMailList = true;
	//	parse the card
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
	  	consoleService.logStringMessage("parsing: " + lines[i]);
		
		switch (tok[0].toUpperCase())
		{
			case "DATE":
				// now we gotta check times... convert the message first
				// save the date in microseconds
				// Date: Fri, 17 Dec 2004 15:06:42 +0100
				/*
				 * have to ignore this because of abook doesnt support this
				try
				{
					setCardProperty(card, "LastModifiedDate", (new Date(Date.parse(lines[i].substring(lines[i].indexOf(":")+1, lines[i].length)))).getTime() / 1000);
				}
				catch (ex)
				{
					consoleService.logStringMessage("unable to convert to date: " + lines[i]);
					alert(("unable to convert to date: " + lines[i] + "\nPlease copy the date string in a bug report an submit!\n(Also available in the information)"));
				}
				*/
				break;						
		  // the all important unique list name! 				
		  case "FN":
		  	setCardProperty(card, "ListNickName", tok[1]);
		  	break;
		  case "NOTE":
			setCardProperty(card, "Description", tok[1].replace (/\\n/g, "\n")); // carriage returns were stripped, add em back
			found = true;
		  	break;
		  
		  case "UID":
		  	// we cannot set the custom4 for a mailing list... but since tbird defined
		  	// the name to be unique... lets keep it that way
		  	//setCardProperty(card, "Custom4", tok[1]);
		  	break;
		  case "BEGIN":
		  	if (!beginVCard)
		  	{
		  		beginVCard = true;
		  		break;
		  	}
		  	
		  	// sub-vcard... parse...
		  	var cStart = i;
			for (; i < lines.length; i++)
				if (lines[i].toUpperCase() == "END:VCARD")
					break;
			var newCard = Components.classes["@mozilla.org/addressbook/cardproperty;1"].createInstance(Components.interfaces.nsIAbCard);
			message2Card(lines, newCard, null, cStart, i);
			// check if we know this card already :) - ONLY cards
			var gotCard = findCard (cards, getUID(newCard), null);
			if (gotCard != null)
			{
				card.addressLists.AppendElement(gotCard);
			}
			else
				card.addressLists.AppendElement(newCard);
		  	break;
		  	
	  	  // stuff we just do not parse :)
		  case "END":
		  case "VERSION":
		  case "":
		  	break;
		  	
		  default:
			consoleService.logStringMessage("VL FIELD not found: " + tok[0] + ":" + tok[1]);
		  	//addField(extraFields, tok[0], tok[1]);
		  	break;
		} // end switch
	}
	return true;
}


/**
 * Parses a vcard/xml/list into its card/list object.
 * this function finds out if the message is either:
 *  - a vcard with a contact
 *  - a vcard with a list
 *  - a xml kolab2 contact
 *  - a xml kolab2 distribution list
 * on its own and returns the correct object.
 * @param message string - a string with the vcard (make sure its trimmed from whitespace)
 * @param fields Array - extra fields to save with the card (may be null)
 * @param cards Array - only required if this is a list
 * @return the filled object or null if not parseable
 *		can be: Components.interfaces.nsIAbDirectory
 *		or:	Components.interfaces.nsIAbCard
 */
function parseMessage (message, extraFields, cards)
{
	// fix for bug #16766: message has no properties
	if (message == null)
		return false;
		
	// check for xml style
	if (message.indexOf("<?xml") != -1 || message.indexOf("<?XML") != -1)
	{
		logMessage("XML message!", LOG_INFO + LOG_AB);	
		return xml2Card(message, extraFields, cards);
	}
	else
		logMessage("VCARD/VLIST!", LOG_INFO + LOG_AB);	

	// decode utf8
	message = decode_utf8(decodeQuoted(message));
	
	// make an array of all lines for easier parsing
	var lines = message.split("\n");

	// check if we got a list
	for (var i = 0; i < lines.length; i++)
	{
		if (lines[i].toUpperCase().indexOf("X-LIST") != -1)
		{
			logMessage("parsing a list: " + message, LOG_DEBUG + LOG_AB);	
		    var mailList = Components.classes["@mozilla.org/addressbook/directoryproperty;1"].createInstance(Components.interfaces.nsIAbDirectory);
			if (!vList2Card(lines[i], lines, mailList, cards))
				return null;
			return mailList;
		}
	}	

	var newCard = Components.classes["@mozilla.org/addressbook/cardproperty;1"].createInstance(Components.interfaces.nsIAbCard);
	if (!message2Card(lines, newCard, extraFields, 0, lines.length))
	{
		logMessage("unparseable: " + message, LOG_ERROR + LOG_AB);	
		return null;
	}
	return newCard;
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
function message2Card (lines, card, extraFields, startI, endI)
{	
	// reset the card
	setCardProperty(card, "AimScreenName", "");
	setCardProperty(card, "AnniversaryDay", "");
	setCardProperty(card, "AnniversaryMonth", "");
	setCardProperty(card, "AnniversaryYear", "");
	setCardProperty(card, "BirthDay", "");
	setCardProperty(card, "BirthMonth", "");
	setCardProperty(card, "BirthYear", "");
	setCardProperty(card, "CardType", "");
	setCardProperty(card, "Category", "");
	setCardProperty(card, "CellularNumber", "");
	setCardProperty(card, "CellularNumberType", "");
	setCardProperty(card, "Company", "");
	setCardProperty(card, "Custom1", "");
	setCardProperty(card, "Custom2", "");
	setCardProperty(card, "Custom3", "");
	setCardProperty(card, "Custom4", "");
	//setCardProperty(card, "DefaultAddress", ""); @deprecated
	setCardProperty(card, "Department", "");
	setCardProperty(card, "DisplayName", "");
	setCardProperty(card, "FamilyName", "");
	setCardProperty(card, "FaxNumber", "");
	setCardProperty(card, "FaxNumberType", "");
	setCardProperty(card, "FirstName", "");
	setCardProperty(card, "HomeAddress", "");
	setCardProperty(card, "HomeAddress2", "");
	setCardProperty(card, "HomeCity", "");
	setCardProperty(card, "HomeCountry", "");
	setCardProperty(card, "HomePhone", "");
	setCardProperty(card, "HomePhoneType", "");
	setCardProperty(card, "HomeState", "");
	setCardProperty(card, "HomeZipCode", "");
	setCardProperty(card, "JobTitle", "");
	//setCardProperty(card, "LastModifiedDate", 0);
	setCardProperty(card, "LastName", "");
	setCardProperty(card, "NickName", "");
	setCardProperty(card, "Notes", "");
	setCardProperty(card, "PagerNumber", "");
	setCardProperty(card, "PagerNumberType", "");
	setCardProperty(card, "PhoneticFirstName", "");
	setCardProperty(card, "PhoneticLastName", "");
	setCardProperty(card, "PreferMailFormat", MAIL_FORMAT_UNKNOWN); 
	//PRUint32 preferMailFormat = "";
	setCardProperty(card, "PrimaryEmail", "");
	setCardProperty(card, "SecondEmail", "");
	setCardProperty(card, "SpouseName", "");
	setCardProperty(card, "WebPage1", ""); // WebPage1 is work web page
	setCardProperty(card, "WebPage2", ""); // WebPage2 is home web page
	setCardProperty(card, "WorkAddress", "");
	setCardProperty(card, "WorkAddress2", "");
	setCardProperty(card, "WorkCity", "");
	setCardProperty(card, "WorkCountry", "");
	setCardProperty(card, "WorkPhone", "");
	setCardProperty(card, "WorkPhoneType", "");
	setCardProperty(card, "WorkState", "");
	setCardProperty(card, "WorkZipCode", "");

/*
	setCardProperty(card, "CardType", "");
	setCardProperty(card, "Category", "");
	setCardProperty(card, "PhoneticFirstName", "");
	setCardProperty(card, "PhoneticLastName", "");
	//PRUint32 preferMailFormat = "";
*/

	// now update it
	var found = false;
	
	// remember which email we already have and set the other one accordingly
	var gotEmailPrimary = false, gotEmailSecondary = false;
	
	for (var i = startI; i < lines.length && i < endI; i++)
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
		
		// check if we actually have data in the second token (skip it if it does not)
		if (tok[1] == null || tok[1] == '' || tok[1] == ';' || tok[1] == ';;;;;;')
			continue;
			
		switch (tok[0].toUpperCase())
		{
			case "DATE":
				// now we gotta check times... convert the message first
				// save the date in microseconds
				// Date: Fri, 17 Dec 2004 15:06:42 +0100
				/* 
				 * have to ignore this because of abook doesnt really support this
				try
				{
					setCardProperty(card, "LastModifiedDate", (new Date(Date.parse(lines[i].substring(lines[i].indexOf(":")+1, lines[i].length)))).getTime() / 1000);
				}
				catch (ex)
				{
					consoleService.logStringMessage("unable to convert to date: " + lines[i]);
					alert(("unable to convert to date: " + lines[i] + "\nPlease copy the date string in a bug report an submit!\n(Also available in the information)"));
				}
				*/
				break;						
 				
			case "N":
				// N:Lastname;Firstname;Other;Prexif;Suffix
				var cur = tok[1].split(";"); 
				setCardProperty(card, "LastName", cur[0]);
				setCardProperty(card, "FirstName", cur[1]);
				found = true;
				break;
			case "FN":
				setCardProperty(card, "DisplayName", tok[1]);
				found = true;
				break;
			case "NICKNAME":
				setCardProperty(card, "NickName", tok[1]);
				found = true;
				break;
			case "TITLE":
				setCardProperty(card, "JobTitle", tok[1]);
				found = true;
				break;
			case "ORG":
				setCardProperty(card, "Company", tok[1]);
				found = true;
				break;
			case "EMAIL;TYPE=PREF":
			case "EMAIL;TYPE=PREF,HOME":
			case "EMAIL;TYPE=INTERNET,PREF":
			case "EMAIL;PREF;TYPE=INTERNET":
			case "EMAIL;TYPE=PREF;HOME":
			case "EMAIL;TYPE=INTERNET;PREF":
				// the "preferred" email is the primary
				if (!gotEmailPrimary)
				{
					setCardProperty(card, "PrimaryEmail", tok[1]);
					gotEmailPrimary = true;
				}
				else
				if (!gotEmailSecondary)
				{
					setCardProperty(card, "SecondEmail", tok[1]);
					gotEmailSecondary = true;
				}
				else
				{
					if (extraFields != null)
						addField(extraFields, tok[0], tok[1]);
				}
				
				found = true;
				break;
			case "EMAIL;TYPE=INTERNET":
			case "EMAIL;INTERNET":
			case "EMAIL": //This is here to limit compact to existing vcards
				// make sure to fill all email fields
				if (!gotEmailPrimary)
				{
					setCardProperty(card, "PrimaryEmail", tok[1]);
					gotEmailPrimary = true;
				}
				else
				if (!gotEmailSecondary)
				{
					setCardProperty(card, "SecondEmail", tok[1]);
					gotEmailSecondary = true;
				}
				else
				{
					logMessage("additional email found: " + tok[1], LOG_WARNING + LOG_AB);	
					addField(extraFields, tok[0], tok[1]);
				}

				found = true;
		    break;
			case "X-EMAILFORMAT": 
				// This will set the Email format to vCard, not part of vCard 3.0 spec, so the X- is there, I assume a Kolab server would just ignore this field
				switch(tok[1]) {
					case "Plain Text":
						setCardProperty(card, "PreferMailFormat", MAIL_FORMAT_PLAINTEXT);
						break;
					case "HTML":
						setCardProperty(card, "PreferMailFormat", MAIL_FORMAT_HTML);
						break;
					// Unknown or misspeelled!
					default:
						setCardProperty(card, "PreferMailFormat", MAIL_FORMAT_UNKNOWN);
				}
				break;

			case "X-AIM": // not standard vcard spec, therefore, prepended with an X
				setCardProperty(card, "AimScreenName", tok[1]);
				found = true;
			break;
			case "TEL;TYPE=MOBILE;TYPE=VOICE":
			case "TEL;TYPE=VOICE;TYPE=MOBILE":
			case "TEL;TYPE=MOBILE":
			case "TEL;MOBILE":
			case "TEL;TYPE=CELL;TYPE=VOICE":
			case "TEL;TYPE=VOICE;TYPE=CELL":
			case "TEL;TYPE=CELL":
			case "TEL;CELL":
				setCardProperty(card, "CellularNumber", tok[1]);
				found = true;
				break;
			case "TEL;TYPE=VOICE;TYPE=HOME":
			case "TEL;TYPE=HOME;TYPE=VOICE":
			case "TEL;VOICE":
			case "TEL;HOME;VOICE":
			case "TEL;VOICE;HOME":
			case "TEL;TYPE=VOICE":
			case "TEL;TYPE=HOME":
			case "TEL;HOME":
			case "TEL":
				setCardProperty(card, "HomePhone", tok[1]);
				found = true;
				break;
			case "TEL;TYPE=WORK;TYPE=VOICE":
			case "TEL;TYPE=VOICE;TYPE=WORK":
			case "TEL;VOICE;WORK":
			case "TEL;WORK;VOICE":
			case "TEL;TYPE=WORK":
			case "TEL;WORK":
				setCardProperty(card, "WorkPhone", tok[1]);
				found = true;
				break;
			case "TEL;TYPE=FAX":
			case "TEL;FAX":
				setCardProperty(card, "FaxNumber", tok[1]);	
 				found = true;
				break;
			case "TEL;TYPE=PAGER":
			case "TEL;TYPE=PAGE":
			case "TEL;PAGER":
			case "TEL;PAGE":
				setCardProperty(card, "PagerNumber", tok[1]);
				found = true;
				break;
			case "BDAY":
				// BDAY:1987-09-27T08:30:00-06:00
				var cur = tok[1].split("-");
				setCardProperty(card, "BirthYear", cur[0]);
				setCardProperty(card, "BirthMonth", cur[1]);
				setCardProperty(card, "BirthDay", (cur[2].indexOf("T") != -1)?cur[2].substring(0,cur[2].indexOf("T")):cur[2]);
				found = true;
		  	break;
			case "ANNIVERSARY":
				// This is not a standard vCard entry.
 				var cur = tok[1].split("-");

				setCardProperty(card, "AnniversaryYear", cur[0]);
				setCardProperty(card, "AnniversaryMonth", cur[1]);
				// BDAY:1987-09-27T08:30:00-06:00
				setCardProperty(card, "AnniversaryDay", (cur[2].indexOf("T") != -1)?cur[2].substring(0,cur[2].indexOf("T")):cur[2]);
				found = true;
		  	break;
		  	
		  case "ADR;TYPE=HOME,POSTAL":
		  case "ADR;TYPE=HOME":
		  case "ADR;HOME":
		  case "ADR":
				// ADR:POBox;Ext. Address;Address;City;State;Zip Code;Country
				var cur = tok[1].split(";");
				setCardProperty(card, "HomeAddress2", cur[1]);
				setCardProperty(card, "HomeAddress", cur[2]);
				setCardProperty(card, "HomeCity", cur[3]);
				setCardProperty(card, "HomeState", cur[4]);
				setCardProperty(card, "HomeZipCode", cur[5]);
				setCardProperty(card, "HomeCountry", cur[6]);
				found = true;
		  	break;
		  case "ADR;TYPE=WORK,POSTAL":
		  case "ADR;WORK":
		  case "ADR;TYPE=WORK":
				var cur = tok[1].split(";");
				setCardProperty(card, "WorkAddress2", cur[1]);
				setCardProperty(card, "WorkAddress", cur[2]);
				setCardProperty(card, "WorkCity", cur[3]);
				setCardProperty(card, "WorkState", cur[4]);
				setCardProperty(card, "WorkZipCode", cur[5]);
				setCardProperty(card, "WorkCountry", cur[6]);
				found = true;
		  	break;
		  case "NOTE":
				setCardProperty(card, "Notes", tok[1].replace (/\\n/g, "\n")); // carriage returns were stripped, add em back
				found = true;
		  	break;
		  case "DEPT":
		  	setCardProperty(card, "Department", tok[1]);
				found = true;
		  	break;
		  case "CUSTOM1":
				setCardProperty(card, "Custom1", tok[1].replace (/\\n/g, "\n")); // carriage returns were stripped, add em back
				found = true;
		  	break;
		  case "CUSTOM2":
				setCardProperty(card, "Custom2", tok[1].replace (/\\n/g, "\n")); // carriage returns were stripped, add em back
				found = true;
		  	break;
		  case "CUSTOM3":
				setCardProperty(card, "Custom3", tok[1].replace (/\\n/g, "\n")); // carriage returns were stripped, add em back
				found = true;
		  	break;

		  case "URL;TYPE=WORK":
		  case "URL":
				// WebPage1 is work web page
				setCardProperty(card, "WebPage1", decodeCardField(tok[1])); // decode to convert the : char hex codes back to ascii
				found = true;
				break;
		  case "URL;TYPE=PRIVATE":
		  case "URL;TYPE=PERSONAL":
				// WebPage2 is home web page
				setCardProperty(card, "WebPage2", decodeCardField(tok[1])); // decode to convert the : char hex codes back to ascii
				found = true;
				break;
		  case "UID":
		  	setCardProperty(card, "Custom4", tok[1]);
		  	break;
		  case "ALLOWREMOTECONTENT":
			  if (tok[1].toUpperCase() == 'TRUE')
				  setCardProperty(card, "AllowRemoteContent", true);
			  else
				  setCardProperty(card, "AllowRemoteContent", false);
			 break;

		  	
	  	  // stuff we just do not parse :)
	  	  case "":
		  case "BEGIN":
		  case "END":
		  case "VERSION":
		  	break;
		  	
		  default:
			logMessage("VC FIELD not found: " + tok[0] + ":" + tok[1], LOG_WARNING + LOG_AB);
		  	addField(extraFields, tok[0], tok[1]);
		  	break;
		} // end switch
	}
		
	// invalid VCARD: no uid:
	if (getCardProperty(card, "Custom4") == "")
	{
		// generate one
		setCardProperty(card, "Custom4", "vc-" + get_randomVcardId()); 
	}

	return found;
}
function list2Human (card)
{
	var msg = "";
	msg += "Name: " + getCardProperty(card, "ListNickName") + "\n";
 	if (checkExist (getCardProperty(card, "Notes")))
		msg += "Notes: " + getCardProperty(card, "Description") + "\n";

	var cList = card.QueryInterface(Components.interfaces.nsIAbDirectory);
	if (cList.addressLists)
 	{
		msg += "Members: \n";
		var total = cList.addressLists.Count();
		if (total)
		{
			for ( var i = 0;  i < total; i++ )
			{
				var card = cList.addressLists.GetElementAt(i);
				card = card.QueryInterface(Components.interfaces.nsIAbCard);
				msg += getCardProperty(card, "DisplayName") + "<" + getCardProperty(card, "PrimaryEmail") + ">\n";
			}
		}
	}	
}

function card2Human (card)
{
	var msg = "";

 	if (checkExist (getCardProperty(card, "FirstName")) || checkExist (getCardProperty(card, "LastName")))
		msg += "Name: " + getCardProperty(card, "LastName") + " " + getCardProperty(card, "FirstName") + "\n";
	else
	if (checkExist (getCardProperty(card, "DisplayName")))
		msg += "Name: " + getCardProperty(card, "DisplayName");
		
 	if (checkExist (getCardProperty(card, "JobTitle")))
		msg += "Title: " + getCardProperty(card, "JobTitle") + "\n";
	if (checkExist (getCardProperty(card, "Company")))
		msg += "Company: " + getCardProperty(card, "Company") + "\n\n";
 	if (checkExist (getCardProperty(card, "WebPage1")))
		msg += "Web: " + getCardProperty(card, "WebPage1") + "\n"; 
 	if (checkExist (getCardProperty(card, "WebPage2")))
		msg += "Web: " + getCardProperty(card, "WebPage2") + "\n\n";

  	if (checkExist (getCardProperty(card, "CellularNumber")))
		msg += "Cell #: " + getCardProperty(card, "CellularNumber") + "\n";
 	if (checkExist (getCardProperty(card, "AhomePhone")))
		msg += "Home #: " + getCardProperty(card, "AhomePhone") + "\n";
 	if (checkExist (getCardProperty(card, "FaxNumber")))
		msg += "Fax #: " + getCardProperty(card, "FaxNumber") + "\n";
 	if (checkExist (getCardProperty(card, "WorkPhone")))
		msg += "Work #: " + getCardProperty(card, "WorkPhone") + "\n";
 	if (checkExist (getCardProperty(card, "PagerNumber")))
		msg += "Pager #: " + getCardProperty(card, "PagerNumber") + "\n";
 	if (checkExist (getCardProperty(card, "Department")))
		msg += "Department: " + getCardProperty(card, "Department") + "\n";
	
 	if (checkExist (getCardProperty(card, "PrimaryEmail"))) 
		msg += "E-Mail:" + getCardProperty(card, "PrimaryEmail")  + "\n";
 	if (checkExist (getCardProperty(card, "SecondEmail"))) 
		msg += "E-Mail:" + getCardProperty(card, "SecondEmail") + "\n";

	if (checkExist(getCardProperty(card, "BirthYear")) 
		||checkExist(getCardProperty(card, "BirthDay")) 
		|| checkExist(getCardProperty(card, "BirthMonth")))
	{
		msg += "Birthday: ";
		msg += getCardProperty(card, "BirthYear") + "-";
		if (getCardProperty(card, "BirthMonth") < 10)
			msg += "0";
		msg += getCardProperty(card, "BirthMonth") + "-";
		if (getCardProperty(card, "BirthDay") < 10)
			msg += "0";
		msg += getCardProperty(card, "BirthDay") + "\n";
	}
	if (checkExist(getCardProperty(card, "AnniversaryYear")) 
		||checkExist(getCardProperty(card, "AnniversaryDay")) 
		||checkExist(getCardProperty(card, "AnniversaryMonth")))
	{
		msg += "Anniversary: " 
		msg += getCardProperty(card, "AnniversaryYear") + "-";
		if (getCardProperty(card, "AnniversaryMonth") < 10)
			msg += "0";
		msg += getCardProperty(card, "AnniversaryMonth") + "-";
		if (getCardProperty(card, "AnniversaryDay") < 10)
			msg += "0";
		msg += getCardProperty(card, "AnniversaryDay") + "\n";
	}


	if (checkExist (getCardProperty(card, "WorkAddress2")) 
		|| checkExist (getCardProperty(card, "WorkAddress")) 
		|| checkExist (getCardProperty(card, "WorkCountry")) 
		|| checkExist (getCardProperty(card, "WorkCity")) 
		|| checkExist (getCardProperty(card, "WorkState")))
	{
		msg += "Work: ";
		msg += getCardProperty(card, "WorkAddress2") + "\n";
		msg += getCardProperty(card, "WorkAddress") + "\n";
		msg += getCardProperty(card, "WorkZipCode") + " ";
		msg += getCardProperty(card, "WorkState") + " ";
		msg += getCardProperty(card, "WorkCity") + "\n";
		msg += getCardProperty(card, "WorkCountry") + "\n";
	}
	// ADR:POBox;Ext. Address;Address;City;State;Zip Code;Country
	if (checkExist (getCardProperty(card, "HomeAddress2")) 
		|| checkExist (getCardProperty(card, "HomeAddress")) 
		|| checkExist (getCardProperty(card, "HomeCountry")) 
		|| checkExist (getCardProperty(card, "HomeCity")) 
		|| checkExist (getCardProperty(card, "HomeState")))
	{
		msg += "Home: ";
		msg += getCardProperty(card, "HomeAddress2") + "\n";
		msg += getCardProperty(card, "HomeAddress") + "\n";
		msg += getCardProperty(card, "HomeZipCode") + " ";
		msg += getCardProperty(card, "HomeState") + " ";
		msg += getCardProperty(card, "HomeCity") + "\n";
		msg += getCardProperty(card, "HomeCountry") + "\n";
 	}
 	if (checkExist (getCardProperty(card, "Notes")))
		msg += "Notes: " + getCardProperty(card, "Notes") + "\n";
	return msg;
}

function card2Vcard (card, fields)
{
	// save the date in microseconds
	// Date: Fri, 17 Dec 2004 15:06:42 +0100
	var cdate = new Date (getCardProperty(card, "LastModifiedDate")*1000);
	var sTime = (cdate.getHours()<10?"0":"") + cdate.getHours() + ":" + (cdate.getMinutes()<10?"0":"") + cdate.getMinutes() + ":" +
		(cdate.getSeconds()<10?"0":"") + cdate.getSeconds();
	var sdate = "DATE: " + getDayString(cdate.getDay()) + ", " + cdate.getDate() + " " +
		getMonthString (cdate.getMonth()) + " " + cdate.getFullYear() + " " + sTime
		 + " " + (((cdate.getTimezoneOffset()/60) < 0)?"-":"+") +
		(((cdate.getTimezoneOffset()/60) < 10)?"0":"") + cdate.getTimezoneOffset() + "\n";

	
	var msg = "BEGIN:VCARD\n";
	// N:Lastname;Firstname;Other;Prefix;Suffix
 	if (checkExist (getCardProperty(card, "FirstName")) || checkExist (getCardProperty(card, "LastName")))
		msg += "N:" + getCardProperty(card, "LastName") + ";" + getCardProperty(card, "FirstName") + ";;;\n"
 	if (checkExist (getCardProperty(card, "DisplayName")))
		msg += "FN:" + getCardProperty(card, "DisplayName") + "\n";
 	if (checkExist (getCardProperty(card, "NickName")))
		msg += "NICKNAME:" + getCardProperty(card, "NickName") + "\n";
 	if (checkExist (getCardProperty(card, "JobTitle")))
		msg += "TITLE:" + getCardProperty(card, "JobTitle") + "\n";
	if (checkExist (getCardProperty(card, "Company")))
		msg += "ORG:" + getCardProperty(card, "Company") + "\n";
 	if (checkExist (getCardProperty(card, "PrimaryEmail"))) 
		msg += "EMAIL;TYPE=INTERNET;PREF:" + getCardProperty(card, "PrimaryEmail")  + "\n";
 	if (checkExist (getCardProperty(card, "SecondEmail"))) 
		msg += "EMAIL;TYPE=INTERNET:" + getCardProperty(card, "SecondEmail") + "\n";
 	if (checkExist (getCardProperty(card, "PreferMailFormat"))) { 
		switch(getCardProperty(card, "PreferMailFormat")) {
			case MAIL_FORMAT_UNKNOWN:
				msg += "X-EMAILFORMAT:Unknown\n";break;
			case MAIL_FORMAT_PLAINTEXT:
				msg += "X-EMAILFORMAT:Plain Text\n";break;
			case MAIL_FORMAT_HTML:
				msg += "X-EMAILFORMAT:HTML\n";break;
		}
	}
 	if (checkExist (getCardProperty(card, "AimScreenName"))) 
		msg += "X-AIM:" + getCardProperty(card, "AimScreenName") + "\n"; 
  	if (checkExist (getCardProperty(card, "CellularNumber")))
		msg += "TEL;TYPE=CELL:" + getCardProperty(card, "CellularNumber") + "\n";
 	if (checkExist (getCardProperty(card, "HomePhone")))
		msg += "TEL;TYPE=HOME:" + getCardProperty(card, "HomePhone") + "\n";
 	if (checkExist (getCardProperty(card, "FaxNumber")))
		msg += "TEL;TYPE=FAX:" + getCardProperty(card, "FaxNumber") + "\n";
 	if (checkExist (getCardProperty(card, "WorkPhone")))
		msg += "TEL;TYPE=WORK:" + getCardProperty(card, "WorkPhone") + "\n";
 	if (checkExist (getCardProperty(card, "PagerNumber")))
		msg += "TEL;TYPE=PAGER:" + getCardProperty(card, "PagerNumber") + "\n";
 	if (checkExist (getCardProperty(card, "Department")))
		msg += "DEPT:" + getCardProperty(card, "Department") + "\n";
	// BDAY:1987-09-27T08:30:00-06:00
	if (checkExist(getCardProperty(card, "BirthYear")) 
		||checkExist(getCardProperty(card, "BirthDay")) 
		|| checkExist(getCardProperty(card, "BirthMonth")))
	{
		msg += "BDAY:";
		msg += getCardProperty(card, "BirthYear") + "-";
		if (getCardProperty(card, "BirthMonth") < 10)
			msg += "0";
		msg += getCardProperty(card, "BirthMonth") + "-";
		if (getCardProperty(card, "BirthDay") < 10)
			msg += "0";
		msg += getCardProperty(card, "BirthDay") + "\n";
	}
	if (checkExist(getCardProperty(card, "AnniversaryYear")) 
		||checkExist(getCardProperty(card, "AnniversaryDay")) 
		||checkExist(getCardProperty(card, "AnniversaryMonth")))
	{
		msg += "ANNIVERSARY:" 
		msg += getCardProperty(card, "AnniversaryYear") + "-";
		if (getCardProperty(card, "AnniversaryMonth") < 10)
			msg += "0";
		msg += getCardProperty(card, "AnniversaryMonth") + "-";
		if (getCardProperty(card, "AnniversaryDay") < 10)
			msg += "0";
		msg += getCardProperty(card, "AnniversaryDay") + "\n";
	}
 	if (checkExist (getCardProperty(card, "WebPage1")))
		msg += "URL:" + encodeCardField(getCardProperty(card, "WebPage1")) + "\n"; // encode the : chars to HEX, vcard values cannot contain colons
 	if (checkExist (getCardProperty(card, "WebPage2")))
		msg += "URL;TYPE=PERSONAL:" + encodeCardField(getCardProperty(card, "WebPage2")) + "\n";
	// ADR:POBox;Ext. Address;Address;City;State;Zip Code;Country
	if (checkExist (getCardProperty(card, "WorkAddress2")) 
		|| checkExist (getCardProperty(card, "WorkAddress")) 
		|| checkExist (getCardProperty(card, "WorkCountry")) 
		|| checkExist (getCardProperty(card, "WorkCity")) 
		|| checkExist (getCardProperty(card, "WorkState")))
	{
		msg += "ADR;TYPE=WORK:;";
		msg += getCardProperty(card, "WorkAddress2") + ";";
		msg += getCardProperty(card, "WorkAddress") + ";";
		msg += getCardProperty(card, "WorkCity") + ";";
		msg += getCardProperty(card, "WorkState") + ";";
		msg += getCardProperty(card, "WorkZipCode") + ";";
		msg += getCardProperty(card, "WorkCountry") + "\n";
	}
	// ADR:POBox;Ext. Address;Address;City;State;Zip Code;Country
	if (checkExist (getCardProperty(card, "HomeAddress2")) 
		|| checkExist (getCardProperty(card, "HomeAddress")) 
		|| checkExist (getCardProperty(card, "HomeCountry")) 
		|| checkExist (getCardProperty(card, "HomeCity")) 
		|| checkExist (getCardProperty(card, "HomeState")))
	{
		msg += "ADR;TYPE=HOME:;";
		msg += getCardProperty(card, "HomeAddress2") + ";";
		msg += getCardProperty(card, "HomeAddress") + ";";
		msg += getCardProperty(card, "HomeCity") + ";";
		msg += getCardProperty(card, "HomeState") + ";";
		msg += getCardProperty(card, "HomeZipCode") + ";";
		msg += getCardProperty(card, "HomeCountry") + "\n";
 	}
 	if (checkExist (getCardProperty(card, "Custom1")))
		msg += "CUSTOM1:" + getCardProperty(card, "Custom1").replace (/\n/g, "\\n") + "\n";
 	if (checkExist (getCardProperty(card, "Custom2")))
		msg += "CUSTOM2:" + getCardProperty(card, "Custom2").replace (/\n/g, "\\n") + "\n";
 	if (checkExist (getCardProperty(card, "Custom3")))
		msg += "CUSTOM3:" + getCardProperty(card, "Custom3").replace (/\n/g, "\\n") + "\n";
 	if (getCardProperty(card, "AllowRemoteContent"))
 		msg += "ALLOWREMOTECONTENT:true\n";
 	else
 		msg += "ALLOWREMOTECONTENT:false\n";
 	// yeap one than more line (or something like that :P)
 	if (checkExist (getCardProperty(card, "Notes")))
		msg += "NOTE:" + getCardProperty(card, "Notes").replace(/\n\n/g, "\\n").replace (/\n/g, "\\n") + "\n";
	msg += "UID:" + getCardProperty(card, "Custom4") + "\n";	
	// add extra/missing fields
	if (fields != null)
	{
		for (var i = 0; i < fields.length; i++)
		{
			// skipp fields[i] if not available
			if (!fields[i])
				continue;
				
			msg += fields[i][0] + ":" + fields[i][1] + "\n";
		}
	}
 	msg += "VERSION:3.0\n";
 	msg += "END:VCARD\n\n";

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
	if (!card.isMailList && (getCardProperty(card, "Custom4") == null || getCardProperty(card, "Custom4").length < 2) )
		return null;			

     logMessage("creating message out of card... ", LOG_INFO + LOG_AB);
	
	// read the database file
	var fields = readDataBase (fFile);
		
	// for the kolab xml format
	if(format == "Xml")
	{
		// mailing list
		if (card.isMailList)
			return generateMail(getCardProperty(card, "Custom4"), email, "", "application/x-vnd.kolab.contact.distlist", 
				true, encodeQuoted(encode_utf8(list2Xml(card, fields))), list2Human(card));
		else
			return generateMail(getCardProperty(card, "Custom4"), email, "", "application/x-vnd.kolab.contact", 
				true, encodeQuoted(encode_utf8(card2Xml(card, fields))), card2Human(card));
	}
	
	if (card.isMailList)
		return generateMail(getCardProperty(card, "Custom4"), email, "vCard", "application/x-vcard.list", 
			false, encodeQuoted(encode_utf8(list2Vcard(card,fields))), null);

	return generateMail(getCardProperty(card, "Custom4"), email, "vCard", "text/vcard", 
			false, encodeQuoted(encode_utf8(card2Vcard(card, fields))), null);
			
		
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
		
	// mailing list UID is the nickname - since it has to be unique
	if (card.isMailList)
		return getCardProperty(card, "ListNickName");

	if (getCardProperty(card, "Custom4") == "")
		return null;
	return getCardProperty(card, "Custom4");
}


function setUID (card, uid)
{
	if (card == null)
		return;
		
	// we do not have to call this for a mailing list because
	// listNickName is the UID
	if (card.isMailList)
		return;
	setCardProperty(card, "Custom4", uid);
}

/**  
 * wrapper for getting a card property
 *  tbird < 3: a property is defined by card.propertyName
 *  in tbird3: a property is defined by card.getProperty('PropertyName');
 * the function fixes the first chard of the property
 * @param card the nsIAbCard
 * @param prop the name of the property to get (make sure ot use tbird3 camel case!!!)
 * @return the property value 
 */
function getCardProperty (card, prop)
{
	// tbird 3
	if (card.getProperty)
	{
		return card.getProperty(prop, null);
	}
	else
	{
		var propName = prop.substring(0,1).toLowerCase() + prop.substring(1);
		return eval("card." + propName);
	}
}

function setCardProperty (card, prop, value)
{
	// tbird 3
	if (card.setProperty)
	{
		return card.setProperty(prop, value);
	}
	else
	{
		// translation switch
		switch (prop)
		{
			case	"AimScreenName":	card.aimScreenName = value; break;
			case	"AnniversaryDay":	card.anniversaryDay = value; break;
			case	"AnniversaryMonth":	card.anniversaryMonth = value; break;
			case	"AnniversaryYear":	card.anniversaryYear = value; break;
			case	"BirthDay":	card.birthDay = value; break;
			case	"BirthMonth":	card.birthMonth = value; break;
			case	"BirthYear":	card.birthYear = value; break;
			case	"CardType":	card.cardType = value; break;
			case	"Category":	card.category = value; break;
			case	"CellularNumber":	card.cellularNumber = value; break;
			case	"CellularNumberType":	card.cellularNumberType = value; break;
			case	"Company":	card.company = value; break;
			case	"Custom1":	card.custom1 = value; break;
			case	"Custom2":	card.custom2 = value; break;
			case	"Custom3":	card.custom3 = value; break;
			case	"Custom4":	card.custom4 = value; break;
			case	"Department":	card.department = value; break;
			case	"DisplayName":	card.displayName = value; break;
			case	"FamilyName":	card.familyName = value; break;
			case	"FaxNumber":	card.faxNumber = value; break;
			case	"FaxNumberType":	card.faxNumberType = value; break;
			case	"FirstName":	card.firstName = value; break;
			case	"HomeAddress":	card.homeAddress = value; break;
			case	"HomeAddress2":	card.homeAddress2 = value; break;
			case	"HomeCity":	card.homeCity = value; break;
			case	"HomeCountry":	card.homeCountry = value; break;
			case	"HomePhone":	card.homePhone = value; break;
			case	"HomePhoneType":	card.homePhoneType = value; break;
			case	"HomeState":	card.homeState = value; break;
			case	"HomeZipCode":	card.homeZipCode = value; break;
			case	"JobTitle":	card.jobTitle = value; break;
			case	"LastName":	card.lastName = value; break;
			case	"NickName":	card.nickName = value; break;
			case	"Notes":	card.notes = value; break;
			case	"PagerNumber":	card.pagerNumber = value; break;
			case	"PagerNumberType":	card.pagerNumberType = value; break;
			case	"PhoneticFirstName":	card.phoneticFirstName = value; break;
			case	"PhoneticLastName":	card.phoneticLastName = value; break;
			case	"PreferMailFormat":	card.preferMailFormat =  	value; break;
			case	"PrimaryEmail":	card.primaryEmail = value; break;
			case	"SecondEmail":	card.secondEmail = value; break;
			case	"SpouseName":	card.spouseName = value; break;
			case	"WebPage1":	card.webPage1 = value; break;
			case	"WebPage2":	card.webPage2 = value; break;
			case	"WorkAddress":	card.workAddress = value; break;
			case	"WorkAddress2":	card.workAddress2 = value; break;
			case	"WorkCity":	card.workCity = value; break;
			case	"WorkCountry":	card.workCountry = value; break;
			case	"WorkPhone":	card.workPhone = value; break;
			case	"WorkPhoneType":	card.workPhoneType = value; break;
			case	"WorkState":	card.workState = value; break;
			case	"WorkZipCode":	card.workZipCode = value; break;
			case	"AllowRemoteContent":	card.allowRemoteContent =	value; break;
			default:
				logMessage("Unable to set property: " + prop + " (reason: not found): " + value, LOG_WARNING + LOG_AB);
				return;
		}
	}
}
