/**
 * Parses a vcard message to a addressbook card.
 * This function ignores unused headers.
 * You can create a new card using:
 * newcard = Components.classes["@mozilla.org/addressbook/cardproperty;1"].createInstance(Components.interfaces.nsIAbCard);	
 * @param message string - a string with the vcard
 * @param card nsIAbCard - the card to update
 *
 */
function message2Card (message, card)
{
	// make an array of all lines for easier parsing
	var lines = message.split("\n");
	
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
	// now update it
	var found = false;
	
	for (var i = 0; i < lines.length; i++)
	{
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
			case "NICKNAME":
					card.nickName = tok[1];
					found = true;
					break;
			case "FN":
					card.displayName = tok[1];
					found = true;
					break;
			// N:firstName;LastName;Nickname
			case "N":
				var cur = tok[1].split(";");
				card.firstName = cur[0];
				card.lastName = cur[1];
					found = true;
			break;
			case "TITLE":
				card.jobTitle = tok[1];
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
		  case "FN":
		  	card.displayName = tok[1];
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
			// these two are the same
		  case "TEL;TYPE=CELL":
		  case "TEL;TYPE=CELL;TYPE=VOICE":
		  case "TEL;TYPE=VOICE;TYPE=CELL":
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
		  case "TEL;TYPE=FAX":
		  	card.faxNumber = tok[1];
				found = true;
		  	break;
		  case "TEL;TYPE=WORK":
		  case "TEL;TYPE=WORK;TYPE=VOICE":
		  case "TEL;TYPE=VOICE;TYPE=WORK":
		  	card.workPhone = tok[1];
				found = true;
		  	break;
		  case "TEL;TYPE=PAGE":
		  	card.pagerNumber = tok[1];
				found = true;
		  	break;
		  case "BDAY":
				var cur = tok[1].split("-");
				card.birthYear = cur[0];
				card.birthMonth = cur[1];
				// BDAY:1987-09-27T08:30:00-06:00
		  	card.birthDay = (cur[2].indexOf("T") != -1)?cur[2].substring(0,cur[2].indexOf("T")):cur[2];
				found = true;
		  	break;
		  	// anniversary - not in vcard rfc??
		  case "ANNIVERSARY":
				var cur = tok[1].split("-");

				card.anniversaryYear = cur[0];
				card.anniversaryMonth = cur[1];
				// BDAY:1987-09-27T08:30:00-06:00
		  	card.anniversaryDay = (cur[2].indexOf("T") != -1)?cur[2].substring(0,cur[2].indexOf("T")):cur[2];
				found = true;
		  	break;
		  	
		  case "ADDR;TYPE=HOME,POSTAL":
		  case "ADDR;TYPE=HOME":
				var cur = tok[1].split(";");
				card.homeAddress2 = cur[1];
				card.homeAddress = cur[2];
				card.homeCity = cur[3];
				card.homeState = cur[4];
				card.homeZipCode = cur[5];
				card.homeCountry = cur[6];
				found = true;
		  	break;
		  case "ADDR;TYPE=WORK,POSTAL":
		  case "ADDR;TYPE=WORK":
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
function card2Message (card)
{
	if (card.custom4 == null || card.custom4.length < 2)
		return null;
	var msg = "";
	// save the date in microseconds
	// Date: Fri, 17 Dec 2004 15:06:42 +0100
	var cdate = new Date (card.lastModifiedDate*1000);
	var sTime = (cdate.getHours()<10?"0":"") + cdate.getHours() + ":" + (cdate.getMinutes()<10?"0":"") + cdate.getMinutes() + ":" +
		(cdate.getSeconds()<10?"0":"") + cdate.getSeconds();
	var sdate = "Date: " + getDayString(cdate.getDay()) + ", " + cdate.getDate() + " " +
		getMonthString (cdate.getMonth()) + " " + cdate.getFullYear() + " " + sTime
		 + " " + (((cdate.getTimezoneOffset()/60) < 0)?"-":"+") +
		(((cdate.getTimezoneOffset()/60) < 10)?"0":"") + cdate.getTimezoneOffset() + "00\n";
		
	msg += "From - " + getDayString(cdate.getDay()) + " " + getMonthString (cdate.getMonth()) + " " + 
		cdate.getDate()	+ " " + sTime + " " + cdate.getFullYear() + "\n";
	msg += "X-Mozilla-Status: 0001\n";
	msg += "X-Mozilla-Status2: 00000000\n";
	msg += "Content-Type: Text/X-VCard;\n";
  msg += '\tcharset="utf-8"\n';
	msg += "From: \n";
	msg += "Reply-To: \n";
	msg += "Bcc: \n";
	msg += "To: \n";
	msg += "Subject: vCard " + card.custom4 + "\n";
	msg += sdate;
	msg += "User-Agent: SyncKolab\n\r\n\r\n";

	msg += "BEGIN:VCARD\n";
	// N:firstName;LastName;Nickname
	if (checkExist (card.firstName) || checkExist (card.lastName))
		msg += "N:"+card.firstName+";"+card.lastName+";\n";
	if (checkExist (card.displayName))
		msg += "FN:"+card.displayName+"\n";
	if (checkExist (card.nickName))
		msg += "NICKNAME:"+card.nickName+"\n";
	if (checkExist (card.jobTitle))
		msg += "TITLE:"+card.jobTitle + "\n";
	if (checkExist (card.primaryEmail))
		msg += "EMAIL:"+card.primaryEmail + "\n";
	if (checkExist (card.defaultEmail))
		msg += "EMAIL;TYPE=INTERNET,PREF:" + card.defaultEmail +"\n";
	if (checkExist (card.displayName))
		msg += "FN:"+card.displayName + "\n";
	if (checkExist (card.company))
		msg += "ORG:"+card.company + "\n";
	if (checkExist (card.cellularNumber))
		msg += "TEL;TYPE=CELL:"+card.cellularNumber + "\n";
	if (checkExist (card.homePhone))
		msg += "TEL;TYPE=VOICE:"+card.homePhone + "\n";
	if (checkExist (card.faxNumber))
		msg += "TEL;TYPE=FAX:"+card.faxNumber + "\n";
	if (checkExist (card.workPhone))
		msg += "TEL;TYPE=WORK:"+card.workPhone + "\n";
	if (checkExist (card.pagerNumber))
		msg += "TEL;TYPE=PAGE:"+card.pagerNumber + "\n";
	if (checkExist (card.department))
		msg += "DEPT:"+card.department + "\n";
				// BDAY:1987-09-27T08:30:00-06:00
	if (checkExist(card.birthYear) ||checkExist(card.birthDay) ||checkExist(card.birthMonth))
		msg += "BDAY:" + card.birthYear + "-" + card.birthMonth + "-" + card.birthDay + "\n";
	if (checkExist(card.anniversaryYear) ||checkExist(card.anniversaryDay) ||checkExist(card.anniversaryMonth))
		msg += "ANNIVERSARY:" + card.anniversaryYear + "-" + card.anniversaryMonth + "-" + card.anniversaryDay + "\n";
	if (checkExist (card.webPage1))
		msg += "URL:"+card.webPage1 + "\n";
	if (checkExist (card.webPage2))
		msg += "URL;TYPE=PERSONAL:"+card.webPage2 + "\n";
	if (checkExist (card.workAddress) || checkExist (card.workCountry) || checkExist (card.workCity) || checkExist (card.workState))
	{
		msg += "ADDR;TYPE=WORK:;"+card.workAddress2 + ";" + card.workAddress + ";" +
			card.workCity + ";" + card.workState + ";" + card.workZipCode + ";" + card.workCountry + "\n";
	}
	if (checkExist (card.homeAddress) || checkExist (card.homeCountry) || checkExist (card.homeCity) || checkExist (card.homeState))
	{
		msg += "ADDR;TYPE=home:;"+card.homeAddress2 + ";" + card.homeAddress + ";" +
			card.homeCity + ";" + card.homeState + ";" + card.homeZipCode + ";" + card.homeCountry + "\n";
	}
	if (checkExist (card.custom1))
		msg += "CUSTOM1:"+card.custom1.replace (/\n/g, "\\n") + "\n";
	if (checkExist (card.custom2))
		msg += "CUSTOM2:"+card.custom2.replace (/\n/g, "\\n") + "\n";
	if (checkExist (card.custom3))
		msg += "CUSTOM3:"+card.custom3.replace (/\n/g, "\\n") + "\n";
	// yeap one than more line (or something like that :P)
	if (checkExist (card.notes))
		msg += "NOTE:"+card.notes.replace (/\n/g, "\\n") + "\n";
	msg += "UID:"+card.custom4 + "\n";	
	msg += "VERSION:3.0\n";
	msg += "END:VCARD\n\n";
	return msg;
}
