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
"use strict";

if(!com) var com={};
if(!com.synckolab) com.synckolab={};

/* ----- general functions to access calendar and events ----- */

com.synckolab.addressbookTools = {
	// package shortcuts:
	global : com.synckolab.global,
	tools : com.synckolab.tools,

	// globals
	MAIL_FORMAT_UNKNOWN : 0,
	MAIL_FORMAT_PLAINTEXT : 1,
	MAIL_FORMAT_HTML : 2,

	/**  
	 * wrapper for getting a card property
	 *  tbird < 3: a property is defined by card.propertyName
	 *  in tbird3: a property is defined by card.getProperty('PropertyName');
	 * the function fixes the first chard of the property
	 * @param card the nsIAbCard
	 * @param prop the name of the property to get (make sure ot use tbird3 camel case!!!)
	 * @param def if the prop is empty
	 * @return the property value 
	 */
	getCardProperty : function (card, prop, def) {
		if (typeof def === "undefined") {
			def = null;
		}

		// json synckolab object
		if(card.synckolab) {
			if(card[prop])	// TODO better check for undefined?
			{
				return card[prop];
			}
			return null;
		}

		
		// fix from syncgb
		if (card.isMailList && !card.getProperty) {
			switch (prop) {
			case "uid":
			case "Uid":
			case "Name":
				if (card.listNickName) {
					prop = "listNickName";
				} else if (card.dirName) {
					prop = "dirName";
				} else {
					prop = "displayName";
				}
				break;
			case "NickName":
				prop = "listNickName";
				break;
			case "DisplayName":
				prop = "dirName";
				break;
			case "Notes":
				prop = "description";
				break;
			case "listNickName":
			case "dirName":
			case "description":
				break;
			default:
				var err = new Error("card.getProperty is not a function");
				com.synckolab.tools.logMessage("ERROR getting "+prop+" from list: \n" + err.stack, com.synccgp.global.LOG_DEBUG);
				throw err;
			}

			return card[prop] || def;
		}

		// tbird 3
		if (card.getProperty) {
			if (card.isMailList && prop === "Name") {
				if (card.dirName) {
					return card.dirName;
				}
				return card.displayName;
			}
			var value = card.getProperty(prop, null);
			// generic image equals none set
			if (prop === "PhotoURI" && value === "chrome://messenger/skin/addressbook/icons/contact-generic.png") {
				value = null;
			}
			// custom4 fix
			if (prop === "Custom4" && value === card.getProperty("UUID", null)) {
				value = null;
			}
			// fix for "null" as string
			if (value === "null" || value === null) {
				return def;
			}
			return value;
		} else {
			switch (prop) {
			case "AimScreenName":
				return card.aimScreenName ? card.aimScreenName : card.aim_screen_name;
			case "AnniversaryDay":
				return card.anniversaryDay;
			case "AnniversaryMonth":
				return card.anniversaryMonth;
			case "AnniversaryYear":
				return card.anniversaryYear;
			case "BirthDay":
				return card.birthDay;
			case "BirthMonth":
				return card.birthMonth;
			case "BirthYear":
				return card.birthYear;
			case "CardType":
				return card.cardType;
			case "Category":
				return card.category;
			case "CellularNumber":
				return card.cellularNumber;
			case "CellularNumberType":
				return card.cellularNumberType;
			case "Company":
				return card.company;
			case "Custom1":
				return card.custom1;
			case "Custom2":
				return card.custom2;
			case "Custom3":
				return card.custom3;
			case "Custom4":
				return card.custom4;
			case "Department":
				return card.department;
			case "DisplayName":
				return card.displayName;
			case "FamilyName":
				return card.familyName;
			case "FaxNumber":
				return card.faxNumber;
			case "FaxNumberType":
				return card.faxNumberType;
			case "FirstName":
				return card.firstName;
			case "HomeAddress":
				return card.homeAddress;
			case "HomeAddress2":
				return card.homeAddress2;
			case "HomeCity":
				return card.homeCity;
			case "HomeCountry":
				return card.homeCountry;
			case "HomePhone":
				return card.homePhone;
			case "HomePhoneType":
				return card.homePhoneType;
			case "HomeState":
				return card.homeState;
			case "HomeZipCode":
				return card.homeZipCode;
			case "JobTitle":
				return card.jobTitle;
			case "LastName":
				return card.lastName;
			case "NickName":
				return card.nickName;
			case "Notes":
				return card.notes;
			case "PagerNumber":
				return card.pagerNumber;
			case "PagerNumberType":
				return card.pagerNumberType;
			case "PhoneticFirstName":
				return card.phoneticFirstName;
			case "PhoneticLastName":
				return card.phoneticLastName;
			case "PreferMailFormat":
				return card.preferMailFormat;
			case "PrimaryEmail":
				return card.primaryEmail;
			case "SecondEmail":
				return card.secondEmail;
			case "SpouseName":
				return card.spouseName;
			case "WebPage1":
				return card.webPage1;
			case "WebPage2":
				return card.webPage2;
			case "WorkAddress":
				return card.workAddress;
			case "WorkAddress2":
				return card.workAddress2;
			case "WorkCity":
				return card.workCity;
			case "WorkCountry":
				return card.workCountry;
			case "WorkPhone":
				return card.workPhone;
			case "WorkPhoneType":
				return card.workPhoneType;
			case "WorkState":
				return card.workState;
			case "WorkZipCode":
				return card.workZipCode;
			case "AllowRemoteContent":
				return card.allowRemoteContent;
			default:
				com.synckolab.tools.logMessage("Unable to get property: " + prop, this.global.LOG_WARNING + this.global.LOG_AB);
				return def;
			}
		}
	},

	haveCardProperty : function (card, prop) {
		return (com.synckolab.tools.text.checkExist(this.getCardProperty(card, prop)));
	},

	/**
	 * get the uid of a card
	 * This has to externalized because uids in lists are !== uids in contacts
	 */
	getUID : function (card) {
		if (!card) {
			return null;
		}

		// for mailing lists
		if (card.isMailList) {
			try {
				// sk always uses dirName
				if(card.synckolab) {
					return this.getCardProperty(card, "dirName");
				}
				// tbird is more creative 
				return this.getCardProperty(card, "Name");
			} catch (err) {
				com.synckolab.tools.logMessage("Error in getUID. ListNickName: '" + card.listNickName + "'\n\nStack:\n" + err.stack, com.synckolab.global.LOG_DEBUG);
				throw err;
			}
		}
		
		// we can use custom fields!!!
		var uid = this.getCardProperty(card, "UUID");
		if (uid && uid !== "") {
			return uid;
		}

		return null;
	},
	setUID : function (card, uid) {
		if (!card) {
			return;
		}

		// mailing lists dont have uuid
		if (card.isMailList) {
			return;
		}

		// listNickName is the UID
		this.setCardProperty(card, "UUID", uid);
	}
};

/**
 * get the address books form the address-book provider
 * @return a collection of address books
 */
com.synckolab.addressbookTools.getABDirectory = function (listener) {
	// tbird >= 7
	try {
		var abManager = Components.classes["@mozilla.org/abmanager;1"].getService(Components.interfaces.nsIAbManager);
		if(listener) {
			abManager.addAddressBookListener(listener, 0xFFFFFFFF); // all
		}
		return abManager.directories;
	} catch (ex) {
		// tbird < 7
		var directory = com.synckolab.global.rdf.GetResource("moz-abdirectory://").QueryInterface(Components.interfaces.nsIAbDirectory);
		return directory.childNodes;
	}
};

/**
 * @param card the card to change
 * @prop the name of the property (String)
 * @value the value to set the property to, null will be changed to an empty string ("")
 */
com.synckolab.addressbookTools.setCardProperty = function (card, prop, value, extra) {
	if(card === null) {
		throw ("Unable to process null-card: " + prop);
	}
	
	// make sure not write "null" anywhere
	if (value === null || value === "null" || prop === "Custom4" && (!value.indexOf("pas-id-") || !value.indexOf("sk-"))) {
		value = "";
	}
	
	// special case: this is a json object for the synckolab cache
	if(card.synckolab) {
		card[prop] = value;
	}
	else
	// tbird 3
	if (card.setProperty) {
		if(!extra) {
			card.setProperty(prop, value);
		}
		return;
	} else {
		// translation switch - tbird 2 still has to use custom4
		switch (prop) {
		case "AimScreenName":
			if (card.aimScreenName) {
				card.aimScreenName = value;
			} else {
				card.aim_screen_name = value;
			}
			break;
		case "AnniversaryDay":
			card.anniversaryDay = value;
			break;
		case "AnniversaryMonth":
			card.anniversaryMonth = value;
			break;
		case "AnniversaryYear":
			card.anniversaryYear = value;
			break;
		case "BirthDay":
			card.birthDay = value;
			break;
		case "BirthMonth":
			card.birthMonth = value;
			break;
		case "BirthYear":
			card.birthYear = value;
			break;
		case "CardType":
			card.cardType = value;
			break;
		case "Category":
			card.category = value;
			break;
		case "CellularNumber":
			card.cellularNumber = value;
			break;
		case "CellularNumberType":
			card.cellularNumberType = value;
			break;
		case "Company":
			card.company = value;
			break;
		case "Custom1":
			card.custom1 = value;
			break;
		case "Custom2":
			card.custom2 = value;
			break;
		case "Custom3":
			card.custom3 = value;
			break;
		case "UID":
			card.custom4 = value;
			break;
		case "UUID":
			card.custom4 = value;
			break;
		case "Department":
			card.department = value;
			break;
		case "DisplayName":
			card.displayName = value;
			break;
		case "FamilyName":
			card.familyName = value;
			break;
		case "FaxNumber":
			card.faxNumber = value;
			break;
		case "FaxNumberType":
			card.faxNumberType = value;
			break;
		case "FirstName":
			card.firstName = value;
			break;
		case "HomeAddress":
			card.homeAddress = value;
			break;
		case "HomeAddress2":
			card.homeAddress2 = value;
			break;
		case "HomeCity":
			card.homeCity = value;
			break;
		case "HomeCountry":
			card.homeCountry = value;
			break;
		case "HomePhone":
			card.homePhone = value;
			break;
		case "HomePhoneType":
			card.homePhoneType = value;
			break;
		case "HomeState":
			card.homeState = value;
			break;
		case "HomeZipCode":
			card.homeZipCode = value;
			break;
		case "JobTitle":
			card.jobTitle = value;
			break;
		case "LastName":
			card.lastName = value;
			break;
		case "NickName":
			card.nickName = value;
			break;
		case "Notes":
			card.notes = value;
			break;
		case "PagerNumber":
			card.pagerNumber = value;
			break;
		case "PagerNumberType":
			card.pagerNumberType = value;
			break;
		case "PhoneticFirstName":
			card.phoneticFirstName = value;
			break;
		case "PhoneticLastName":
			card.phoneticLastName = value;
			break;
		case "PreferMailFormat":
			card.preferMailFormat = value;
			break;
		case "PrimaryEmail":
			card.primaryEmail = value;
			break;
		case "SecondEmail":
			card.secondEmail = value;
			break;
		case "SpouseName":
			card.spouseName = value;
			break;
		case "WebPage1":
			card.webPage1 = value;
			break;
		case "WebPage2":
			card.webPage2 = value;
			break;
		case "WorkAddress":
			card.workAddress = value;
			break;
		case "WorkAddress2":
			card.workAddress2 = value;
			break;
		case "WorkCity":
			card.workCity = value;
			break;
		case "WorkCountry":
			card.workCountry = value;
			break;
		case "WorkPhone":
			card.workPhone = value;
			break;
		case "WorkPhoneType":
			card.workPhoneType = value;
			break;
		case "WorkState":
			card.workState = value;
			break;
		case "WorkZipCode":
			card.workZipCode = value;
			break;
		case "AllowRemoteContent":
			card.allowRemoteContent = value;
			break;
		case "Custom4":
			break; // ignore
		default:
			com.synckolab.tools.logMessage("Unable to set property: " + prop + " (reason: not found): " + value, this.global.LOG_WARNING + this.global.LOG_AB);
			return;
		}
	}
};

/**
 * Looks for a card in the card list
 * @param cards childCards - the list of cards
 * @param vId string - the custom4 field (card id)
 */
com.synckolab.addressbookTools.findCard = function (cards, vId, directory) {
	// nothing found - try mailing lists
	var card = cards.get(vId);
	if (card) {
		return card;
	}

	if (directory) {
		var cn = directory.childNodes;
		var ABook = cn.getNext();
		while (ABook) {
			var cur = ABook.QueryInterface(Components.interfaces.nsIAbDirectory);
			if (cur.listNickName === vId) {
				return cur;
			}
			ABook = cn.getNext();
		}
	}

	return null;
};

/**
 * Tools to work with the address book. Parsing functions for vcard, Kolab xml
 * to and from contact plus some utility functions. 
 *
 * @param xml a dom node of a card or a string with the xml
 * @param card the card object to update
 */
com.synckolab.addressbookTools.xml2Card = function (xml, card) {
	var cur;
	
	// if xml has a nodeType attribute - its already a node
	if(xml.indexOf && !xml.nodeName) {
		com.synckolab.tools.logMessage("parsing the XML content into card", this.global.LOG_DEBUG + this.global.LOG_AB);
		// check if we have to decode quoted printable
		if (xml.indexOf(" version=3D") !== -1) {
			// we know from the version
			xml = com.synckolab.tools.text.quoted.decode(xml);
		}
	
		xml = com.synckolab.tools.text.utf8.decode(xml);
		// potential fix: .replace(/&/g, "&amp;")
	
		// convert the string to xml
		var parser = Components.classes["@mozilla.org/xmlextras/domparser;1"].getService(Components.interfaces.nsIDOMParser);
		var doc = parser.parseFromString(xml, "text/xml");
	
		var topNode = doc.firstChild;
		if (topNode.nodeName === "parsererror") {
			// so this message has no valid XML part :-(
			com.synckolab.tools.logMessage("Error parsing the XML content of this message.\n" + xml, this.global.LOG_ERROR + this.global.LOG_AB);
			return null;
		}
		if ((topNode.nodeType !== Node.ELEMENT_NODE) || (topNode.nodeName.toUpperCase() !== "CONTACT")) {
	
			if ((topNode.nodeType === Node.ELEMENT_NODE) && (topNode.nodeName.toUpperCase() === "DISTRIBUTION-LIST")) {
				return this.Xml2List(topNode, card);
			}
			// this can't be an event in Kolab XML format
			com.synckolab.tools.logMessage("This message doesn't contain a contact in Kolab XML format (" + topNode.nodeName + ").\n" + xml, this.global.LOG_ERROR + this.global.LOG_AB);
			return null;
		}
	
		cur = new com.synckolab.Node(doc.firstChild.firstChild);
	} else {
		com.synckolab.tools.logMessage("parsing dom tree into card.", this.global.LOG_DEBUG + this.global.LOG_AB);
		cur = new com.synckolab.Node(xml.firstChild);
	}
	
	var found = false;
	var tok; // for tokenizer
	var email = 0;

	while (cur) {
		if (cur.nodeType === Node.ELEMENT_NODE)//1
		{
			switch (cur.nodeName.toUpperCase()) {
			case "LAST-MODIFICATION-DATE":
				/*
				ignore this since thunderbird implementation just does not work
				var s = cur.getFirstData();
				// now we gotta check times... convert the message first
				// save the date in microseconds
				// 2005-03-30T15:28:52Z
				try
				{
					// we dont need the date anyways.. so lets skip that part
					// this.setCardProperty(card, "LastModifiedDate", string2DateTime(s).getTime() / 1000);
				}
				catch (ex)
				{
					consoleService.logStringMessage("unable to convert to date: " + s);
					alert(("unable to convert to date: " + s + "\nPlease copy the date string in a bug report an submit!\n(Also available in the information)"));
				}
				*/
				break;

			case "NAME":
				this.setCardProperty(card, "FirstName", cur.getXmlResult("GIVEN-NAME", ""));
				this.setCardProperty(card, "LastName", cur.getXmlResult("LAST-NAME", ""));
				this.setCardProperty(card, "DisplayName", cur.getXmlResult("FULL-NAME", ""));
				found = true;
				break;

			case "DISPLAY-NAME":
				this.setCardProperty(card, "DisplayName", cur.getFirstData());
				break;

				
			// set the prefer mail format (this is not covered by kolab itself)
			case "PREFER-MAIL-FORMAT":
				// 0: unknown
				// 1: plaintext
				// 2: html
				var format = cur.getFirstData().toUpperCase();
				this.setCardProperty(card, "PreferMailFormat", this.MAIL_FORMAT_UNKNOWN);
				switch (format) {
				case 'PLAINTEXT':
				case 'TEXT':
				case 'TXT':
				case 'PLAIN':
				case '1':
					this.setCardProperty(card, "PreferMailFormat", this.MAIL_FORMAT_PLAINTEXT);
					break;
				case 'HTML':
				case 'RICHTEXT':
				case 'RICH':
				case '2':
					this.setCardProperty(card, "PreferMailFormat", this.MAIL_FORMAT_HTML);
				}
				break;

			case "JOB-TITLE":
				if (cur.firstChild === null) {
					break;
				}
				this.setCardProperty(card, "JobTitle", cur.getFirstData());
				found = true;
				break;

			case "NICK-NAME":
				if (cur.firstChild === null) {
					break;
				}
				this.setCardProperty(card, "NickName", cur.getFirstData());
				found = true;
				break;

			case "EMAIL":
				//com.synckolab.tools.logMessage("email: " + email + " - " + cur.getXmlResult("SMTP-ADDRESS", ""), this.global.LOG_DEBUG + this.global.LOG_AB);
				switch (email) {
				case 0:
					this.setCardProperty(card, "PrimaryEmail", cur.getXmlResult("SMTP-ADDRESS", ""));
					// only applies to tbird < 3
					if (card.defaultEmail){
						card.defaultEmail = this.getCardProperty(card, "PrimaryEmail");
					}
					break;
				case 1:
					this.setCardProperty(card, "SecondEmail", cur.getXmlResult("SMTP-ADDRESS", ""));
					break;
				default:
					// remember other emails
					this.setCardProperty(card, "EMAIL" + email, cur.getXmlResult("SMTP-ADDRESS", ""), true);
					break;
				}
				email++;
				found = true;
				break;

			case "CATEGORIES":
				if (cur.firstChild === null) {
					break;
				}
				this.setCardProperty(card, "Category", cur.getFirstData());
				break;

			case "ORGANIZATION":
				if (cur.firstChild === null) {
					break;
				}
				this.setCardProperty(card, "Company", cur.getFirstData());
				found = true;
				break;

			// these two are the same
			case "PHONE":
				var num = cur.getXmlResult("NUMBER", "");
				switch (cur.getXmlResult("TYPE", "CELLULAR").toUpperCase()) {
				case "MOBILE":
				case "CELLULAR":
					this.setCardProperty(card, "CellularNumber", num);
					break;
				case "HOME":
				case "HOME1":
					this.setCardProperty(card, "HomePhone", num);
					break;
				case "FAX":
				case "BUSINESSFAX":
					this.setCardProperty(card, "FaxNumber", num);
					break;
				case "BUSINESS":
				case "BUSINESS1":
					this.setCardProperty(card, "WorkPhone", num);
					break;
				case "PAGE":
					this.setCardProperty(card, "PagerNumber", num);
					break;
				default:
					// remember other phone numbers
					this.setCardProperty(card, "PHONE_" + cur.getXmlResult("TYPE", "CELLULAR"), num, true);
					break;
				}
				found = true;
				break;

			case "BIRTHDAY":
				if (cur.firstChild === null) {
					break;
				}
				tok = cur.firstChild.data.split("-");
				this.setCardProperty(card, "BirthYear", tok[0]);
				this.setCardProperty(card, "BirthMonth", tok[1]);
				// BDAY: 1987-09-27
				this.setCardProperty(card, "BirthDay", tok[2]);
				found = true;
				break;
			// anniversary - not in vcard rfc??
			case "ANNIVERSARY":
				if (cur.firstChild === null) {
					break;
				}
				tok = cur.getFirstData().split("-");

				this.setCardProperty(card, "AnniversaryYear", tok[0]);
				this.setCardProperty(card, "AnniversaryMonth", tok[1]);
				// BDAY:1987-09-27T08:30:00-06:00
				this.setCardProperty(card, "AnniversaryDay", tok[2]);
				found = true;
				break;
			/* @deprecated
			case "PREFERRED-ADDRESS":
			if (cur.firstChild)
				this.setCardProperty(card, "DefaultAddress", cur.getFirstData());
			break;
			*/
			case "ADDRESS":
				switch (cur.getXmlResult("TYPE", "HOME").toUpperCase()) {
				case "HOME":
					this.setCardProperty(card, "HomeAddress", cur.getXmlResult("STREET", ""));
					this.setCardProperty(card, "HomeAddress2", cur.getXmlResult("STREET2", ""));
					this.setCardProperty(card, "HomeCity", cur.getXmlResult("LOCALITY", ""));
					this.setCardProperty(card, "HomeState", cur.getXmlResult("REGION", ""));
					this.setCardProperty(card, "HomeZipCode", cur.getXmlResult("POSTAL-CODE", ""));
					this.setCardProperty(card, "HomeCountry", cur.getXmlResult("COUNTRY", ""));
					break;
				case "BUSINESS":
					this.setCardProperty(card, "WorkAddress", cur.getXmlResult("STREET", ""));
					this.setCardProperty(card, "WorkAddress2", cur.getXmlResult("STREET2", ""));
					this.setCardProperty(card, "WorkCity", cur.getXmlResult("LOCALITY", ""));
					this.setCardProperty(card, "WorkState", cur.getXmlResult("REGION", ""));
					this.setCardProperty(card, "WorkZipCode", cur.getXmlResult("POSTAL-CODE", ""));
					this.setCardProperty(card, "WorkCountry", cur.getXmlResult("COUNTRY", ""));
					break;
				}
				found = true;
				break;
			case "PICTURE":
				if (cur.firstChild === null) {
					break;
				}

				// we should have a picture named /tmp/synckolab.img - this will be moved if we keep this contact
				this.setCardProperty(card, "PhotoName", cur.getFirstData());
				break;
			case "PICTURE-URI":
				if (cur.firstChild === null) {
					break;
				}
				var uri = cur.getFirstData();
				// check for local
				if (uri.indexOf("file") === 0) {
					this.setCardProperty(card, "PhotoType", "file");
					this.setCardProperty(card, "PhotoURI", uri);
				} else if (uri.indexOf("http") === 0) {
					this.setCardProperty(card, "PhotoType", "web");
					this.setCardProperty(card, "PhotoURI", uri);
				}
				break;
			case "BODY":
				if (cur.firstChild === null) {
					break;
				}

				var cnotes = cur.getFirstData();
				this.setCardProperty(card, "Notes", cnotes.replace(/\\n/g, "\n"));
				com.synckolab.tools.logMessage("cur.firstchild.data.length=" + cur.firstChild.data.length + " - cnotes=" + cnotes.length + " - card.notes=" + this.getCardProperty(card, "Notes").length, this.global.LOG_DEBUG + this.global.LOG_AB);
				found = true;
				break;
			case "DEPARTMENT":
				if (cur.firstChild === null) {
					break;
				}
				this.setCardProperty(card, "Department", cur.getFirstData());
				found = true;
				break;

			case "WEB-PAGE":
				if (cur.firstChild === null) {
					break;
				}
				this.setCardProperty(card, "WebPage1", cur.getFirstData());
				found = true;
				break;

			case "BUSINESS-WEB-PAGE":
				if (cur.firstChild === null) {
					break;
				}
				this.setCardProperty(card, "WebPage2", cur.getFirstData());
				found = true;
				break;

			case "UID":
				if (cur.firstChild === null) {
					break;
				}
				this.setUID(card, cur.getFirstData());
				break;

			case "CUSTOM1":
				if (cur.firstChild === null) {
					break;
				}
				this.setCardProperty(card, "Custom1", cur.getFirstData());
				break;
			case "CUSTOM2":
				if (cur.firstChild === null) {
					break;
				}
				this.setCardProperty(card, "Custom2", cur.getFirstData());
				break;

			case "CUSTOM3":
				if (cur.firstChild === null) {
					break;
				}
				this.setCardProperty(card, "Custom3", cur.getFirstData());
				break;

			case "CUSTOM4":
				if (cur.firstChild === null) {
					break;
				}
				this.setCardProperty(card, "Custom4", cur.getFirstData());
				break;

			case "IM-ADDRESS":
				if (cur.firstChild === null) {
					break;
				}
				this.setCardProperty(card, "AimScreenName", cur.getFirstData());
				break;

			case "ALLOW-REMOTE-CONTENT":
				if (cur.firstChild === null) {
					break;
				}
				this.setCardProperty(card, "AllowRemoteContent", 'TRUE' === cur.firstChild.data.toUpperCase());
				break;
			default:
				if (cur.firstChild === null) {
					break;
				}
				if (cur.nodeName !== "product-id" && cur.nodeName !== "sensitivity") {
					// remember other fields
					com.synckolab.tools.logMessage("FIELD not found: " + cur.nodeName + "=" + cur.getFirstData(), this.global.LOG_WARNING + this.global.LOG_AB);
					this.setCardProperty(card, cur.nodeName, cur.getFirstData(), true);
				}
				break;

			} // end switch
		}

		cur = cur.nextSibling;
	}

	if (found) {
		return card;
	}

	return null;
};

/**
 * Creates xml (kolab2) out of a given card. 
 * The return is the xml as string.
 * @param card nsIAbCard: the adress book list card
 * @param fields Array: all the fields not being held in the default card
 */
com.synckolab.addressbookTools.list2Xml = function (card, fields) {
	var xml = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n";
	xml += "<distribution-list version=\"1.0\" >\n";
	xml += " <product-id>SyncKolab, Kolab resource</product-id>\n";
	xml += " <uid>" + this.getUID(card) + "</uid>\n";
	xml += " <creation-date>" + com.synckolab.tools.text.date2String(new Date(this.getCardProperty(card, "LastModifiedDate") * 1000)) + "T" + com.synckolab.tools.text.time2String(new Date(this.getCardProperty(card, "LastModifiedDate") * 1000)) + "Z</creation-date>\n";
	xml += " <last-modification-date>" + com.synckolab.tools.text.date2String(new Date(this.getCardProperty(card, "LastModifiedDate") * 1000)) + "T" + com.synckolab.tools.text.time2String(new Date(this.getCardProperty(card, "LastModifiedDate") * 1000)) + "Z</last-modification-date>\n";

	// default: public - tbird doesnt know of other types of list like private
	xml += " <sensitivity>public</sensitivity>\n";

	xml += " <name>" + com.synckolab.tools.text.encode4XML(card.displayName) + "</name>\n";

	if (this.haveCardProperty(card, "Description")) {
		xml += ' <body type="desc">' + com.synckolab.tools.text.encode4XML(this.getCardProperty(card, "Description")) + "</body>\n";
	} else if (this.haveCardProperty(card, "Notes")) {
		xml += " <body>" + com.synckolab.tools.text.encode4XML(this.getCardProperty(card, "Notes")) + "</body>\n";
	}
	if (this.haveCardProperty(card, "Nickname")) {
		xml += " <nickname>" + com.synckolab.tools.text.encode4XML(this.getCardProperty(card, "Nickname")) + "</nickname>\n";
	}
	
	var abManager = Components.classes["@mozilla.org/abmanager;1"].getService(Components.interfaces.nsIAbManager);

	com.synckolab.tools.logMessage("getting list via manager: " + card.mailListURI, this.global.LOG_WARNING + this.global.LOG_AB);

	var	cList = abManager.getDirectory(card.mailListURI);

	var lCards = cList.childCards;
	if (lCards) {
		if (lCards.hasMoreElements) {
			var curCard = null;
			while (lCards.hasMoreElements() && (curCard = lCards.getNext())) {
				// get the right interface
				var cur = curCard.QueryInterface(Components.interfaces.nsIAbCard);
				// get the uid or generate it
				var uid = this.getUID(cur);
				if (!uid) {
					uid = "sk-vc-" + com.synckolab.tools.text.randomVcardId();
					com.synckolab.addressbookTools.setUID(cur, uid);
				}

				xml += "  <member>";
				xml += com.synckolab.tools.text.nodeWithContent("display-name", this.getCardProperty(cur, "DisplayName"), false);
				if (this.haveCardProperty(cur, "PrimaryEmail")) {
					xml += com.synckolab.tools.text.nodeWithContent("smtp-address", this.getCardProperty(cur, "PrimaryEmail"), false);
				} else if (this.haveCardProperty(cur, "SecondEmail")) {
					xml += com.synckolab.tools.text.nodeWithContent("smtp-address", this.getCardProperty(cur, "SecondEmail"), false);
				} else {
					com.synckolab.tools.logMessage("List entry without an email!" + this.getUID(cur), this.global.LOG_WARNING + this.global.LOG_AB);
				}

				xml += com.synckolab.tools.text.nodeWithContent("uid", uid, false);

				xml += "  </member>\n";
			}
		} else {
			com.synckolab.tools.logMessage("lists not supported " + xml, com.synckolab.global.LOG_WARNING + com.synckolab.global.LOG_AB);
			return null;
		}
	} else {
		com.synckolab.tools.logMessage("lists not supported " + xml, com.synckolab.global.LOG_WARNING + com.synckolab.global.LOG_AB);
		return null;
	}

	xml += "</distribution-list>\n";
	com.synckolab.tools.logMessage("list: " + xml, com.synckolab.global.LOG_INFO + com.synckolab.global.LOG_AB);

	return xml;
};

/**
 * Creates vcard (kolab1) out of a given list. 
 * The return is the vcard as string.
 * @param card nsIAbCard: the adress book list card
 * @param fields Array: all the fields not being held in the default card
 */
com.synckolab.addressbookTools.list2Vcard = function (card, fields) {
	// save the date in microseconds
	// Date: Fri, 17 Dec 2004 15:06:42 +0100
	var cdate = new Date(this.getCardProperty(card, "LastModifiedDate") * 1000);
	var sTime = (cdate.getHours() < 10 ? "0" : "") + cdate.getHours() + ":" + (cdate.getMinutes() < 10 ? "0" : "") + cdate.getMinutes() + ":" + (cdate.getSeconds() < 10 ? "0" : "") + cdate.getSeconds();
	var sdate = "DATE: " + com.synckolab.tools.text.getDayString(cdate.getDay()) + ", " + cdate.getDate() + " " + com.synckolab.tools.text.getMonthString(cdate.getMonth()) + " " + cdate.getFullYear() + " " + sTime + " " + (((cdate.getTimezoneOffset() / 60) < 0) ? "-" : "+") + (((cdate.getTimezoneOffset() / 60) < 10) ? "0" : "") + cdate.getTimezoneOffset() + "\n";

	var msg = "BEGIN:VCARD\n";

	msg += "UID:" + this.getUID(card) + "\n";
	msg += "N:" + com.synckolab.tools.text.quoted.encode(card.displayName) + "\n";

	if (this.haveCardProperty(card, "Description")) {
		msg += 'NOTE:' + com.synckolab.tools.text.quoted.encode(this.getCardProperty(card, "Description")) + "\n";
	} else if (this.haveCardProperty(card, "Notes")) {
		msg += 'NOTE:' + com.synckolab.tools.text.quoted.encode(this.getCardProperty(card, "Noted")) + "\n";
	}

	if (this.haveCardProperty(card, "Nickname")) {
		msg += "NICK:" + com.synckolab.tools.text.quoted.encode(this.getCardProperty(card, "Nickname")) + "\n";
	}
	
	var uidList = "";

	var cList = card;
	if (cList.addressLists) {
		var total = cList.addressLists.length;
		com.synckolab.tools.logMessage("List has " + total + " contacts", this.global.LOG_INFO + this.global.LOG_AB);
		if (!total || total === 0) {
			return null; // do not add a list without members
		}

		if (total) {
			for (var i = 0; i < total; i++) {
				var cur = cList.addressLists.queryElementAt(i, Components.interfaces.nsIAbCard);
				// generate the sub-vcard??
				//msg += card2Vcard(cur, null);

				// custom4 is not really necessary since there will be a smart-check
				if (this.getUID(cur)) {
					uidList += this.getUID(cur) + ";";
				}
			}
		}

	} else {
		return null; // do not add a list without members
	}
	msg += "X-LIST:" + uidList + "\n";
	msg += "VERSION:3.0\n";
	msg += "END:VCARD\n\n";
	return msg;
};

/**
 * moves the temp image stored in /tmp/synckolab.img to its final position
 */
com.synckolab.addressbookTools.copyImage = function (newName) {
	// wrong name - forget it
	if (newName === null || newName === "" || newName === "null") {
		return;
	}

	var file = Components.classes["@mozilla.org/file/directory_service;1"].getService(Components.interfaces.nsIProperties).get("TmpD", Components.interfaces.nsIFile);
	file.append("syncKolab.img");

	// we dont have the image
	if (!file.exists()) {
		return false;
	}

	var fileTo = Components.classes["@mozilla.org/file/directory_service;1"].getService(Components.interfaces.nsIProperties).get("ProfD", Components.interfaces.nsIFile);
	fileTo.append("Photos");
	if (!fileTo.exists()) {
		fileTo.create(1, parseInt("0775", 8));
	}

	// fix newName: we can have C:\ - file:// and more - remove all that and put it in the photos folder
	newName = newName.replace(/[^A-Za-z0-9._ \-]/g, "");
	newName = newName.replace(/ /g, "_");

	try {
		file.moveTo(fileTo, newName);
	} catch (ex) {
		com.synckolab.tools.logMessage("Unable to move file " + newName + "\n" + ex, this.global.LOG_WARNING + this.global.LOG_AB);
	}

	// check if the file exists
	fileTo.append(newName);
	return fileTo.exists();
};

/**
 * Creates xml (kolab2) out of a given card. 
 * The return is the xml as string.
 * @param card nsIAbCard: the adress book card
 * @param fields Array: all the fields not being held in the default card
 */
com.synckolab.addressbookTools.card2Xml = function (card, fields) {
	// translate the card: base64xml, xml, vcard
	//com.synckolab.tools.logMessage ("XML: \n" + card.translateTo("xml"), this.global.LOG_WARNING + this.global.LOG_AB); - dont work is actually a HTML
	//com.synckolab.tools.logMessage ("VCARD: \n" + card.translateTo("vcard"), this.global.LOG_WARNING + this.global.LOG_AB); // converts a little too much and ignores uuid

	// debug for photo:

	var displayName = "";
	var xml = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n";
	xml += "<contact version=\"1.0\" >\n";
	xml += " <product-id>SyncKolab, Kolab resource</product-id>\n";
	xml += " <uid>" + com.synckolab.tools.text.encode4XML(this.getUID(card)) + "</uid>\n";
	xml += com.synckolab.tools.text.nodeWithContent("categories", this.getCardProperty(card, "Category"), false);
	//xml += " <creation-date>"+com.synckolab.tools.text.date2String(new Date(this.getCardProperty(card, "LastModifiedDate")*1000))+"T"+com.synckolab.tools.text.time2String(new Date(this.getCardProperty(card, "LastModifiedDate")*1000))+"Z</creation-date>\n";
	xml += " <last-modification-date>" + com.synckolab.tools.text.date2String(new Date(this.getCardProperty(card, "LastModifiedDate") * 1000)) + "T" + com.synckolab.tools.text.time2String(new Date(this.getCardProperty(card, "LastModifiedDate") * 1000)) + "Z</last-modification-date>\n";
	// ??
	xml += " <sensitivity>public</sensitivity>\n";
	if (this.haveCardProperty(card, "Notes")) {
		xml += " <body>" + com.synckolab.tools.text.encode4XML(this.getCardProperty(card, "Notes")) + "</body>\n";
	}

	if (this.haveCardProperty(card, "FirstName") || this.haveCardProperty(card, "LastName") || this.haveCardProperty(card, "DisplayName") || this.haveCardProperty(card, "NickName")) {
		xml += " <name>\n";
		if (this.haveCardProperty(card, "FirstName")) {
			xml += "  <given-name>" + com.synckolab.tools.text.encode4XML(this.getCardProperty(card, "FirstName")) + "</given-name>\n";
		}
		//			xml += "  <middle-names>"+this.getCardProperty(card, "NickName")+"</middle-names>\n"; // not really correct...
		if (this.haveCardProperty(card, "LastName")) {
			xml += "  <last-name>" + com.synckolab.tools.text.encode4XML(this.getCardProperty(card, "LastName")) + "</last-name>\n";
		}
		if (this.haveCardProperty(card, "DisplayName")) {
			xml += "  <full-name>" + com.synckolab.tools.text.encode4XML(this.getCardProperty(card, "DisplayName")) + "</full-name>\n";
			displayName = this.getCardProperty(card, "DisplayName");
		} else if (this.haveCardProperty(card, "FirstName") || this.haveCardProperty(card, "LastName")) {
			displayName = this.getCardProperty(card, "FirstName") + " " + this.getCardProperty(card, "LastName");
			xml += com.synckolab.tools.text.nodeWithContent("full-name", displayName);
		}

		xml += " </name>\n";
	}
	xml += com.synckolab.tools.text.nodeWithContent("organization", this.getCardProperty(card, "Company"), false);
	xml += com.synckolab.tools.text.nodeWithContent("web-page", this.getCardProperty(card, "WebPage1"), false);
	// not really kolab.. but we need that somewhere
	xml += com.synckolab.tools.text.nodeWithContent("business-web-page", this.getCardProperty(card, "WebPage2"), false);
	xml += com.synckolab.tools.text.nodeWithContent("im-address", this.getCardProperty(card, "AimScreenName"), false);
	xml += com.synckolab.tools.text.nodeWithContent("department", this.getCardProperty(card, "Department"), false);
	//" <office-location>zuhaus</office-location>\n";
	//" <profession>programmierer</profession>\n";
	xml += com.synckolab.tools.text.nodeWithContent("job-title", this.getCardProperty(card, "JobTitle"), false);
	xml += com.synckolab.tools.text.nodeWithContent("nick-name", this.getCardProperty(card, "NickName"), false);
	var adate;
	if (this.haveCardProperty(card, "BirthYear") && this.haveCardProperty(card, "BirthMonth") && this.haveCardProperty(card, "BirthDay")) {
		adate = this.getCardProperty(card, "BirthYear") + "-" + this.getCardProperty(card, "BirthMonth") + "-" + this.getCardProperty(card, "BirthDay");
		xml += com.synckolab.tools.text.nodeWithContent("birthday", adate, false);
	}
	if (this.haveCardProperty(card, "AnniversaryYear") && this.haveCardProperty(card, "AnniversaryMonth") && this.haveCardProperty(card, "AnniversaryDay")) {
		adate = this.getCardProperty(card, "AnniversaryYear") + "-" + this.getCardProperty(card, "AnniversaryMonth") + "-" + this.getCardProperty(card, "AnniversaryDay");
		xml += com.synckolab.tools.text.nodeWithContent("anniversary", adate, false);
	}
	if (this.haveCardProperty(card, "HomePhone")) {
		xml += " <phone>\n";
		xml += "  <type>home1</type>\n";
		xml += "  <number>" + this.getCardProperty(card, "HomePhone") + "</number>\n";
		xml += " </phone>\n";
	}
	if (this.haveCardProperty(card, "WorkPhone")) {
		xml += " <phone>\n";
		xml += "  <type>business1</type>\n";
		xml += "  <number>" + this.getCardProperty(card, "WorkPhone") + "</number>\n";
		xml += " </phone>\n";
	}
	if (this.haveCardProperty(card, "FaxNumber")) {
		xml += " <phone>\n";
		xml += "  <type>fax</type>\n";
		xml += "  <number>" + this.getCardProperty(card, "FaxNumber") + "</number>\n";
		xml += " </phone>\n";
	}
	if (this.haveCardProperty(card, "CellularNumber")) {
		xml += " <phone>\n";
		xml += "  <type>mobile</type>\n";
		xml += "  <number>" + this.getCardProperty(card, "CellularNumber") + "</number>\n";
		xml += " </phone>\n";
	}
	if (this.haveCardProperty(card, "PagerNumber")) {
		xml += " <phone>\n";
		xml += "  <type>page</type>\n";
		xml += "  <number>" + this.getCardProperty(card, "PagerNumber") + "</number>\n";
		xml += " </phone>\n";
	}

	if (this.haveCardProperty(card, "PrimaryEmail")) {
		xml += " <email type=\"primary\">\n";
		xml += "  <display-name>" + com.synckolab.tools.text.encode4XML(displayName) + "</display-name>\n";
		xml += "  <smtp-address>" + com.synckolab.tools.text.encode4XML(this.getCardProperty(card, "PrimaryEmail")) + "</smtp-address>\n";
		xml += " </email>\n";
	}

	if (this.haveCardProperty(card, "SecondEmail")) {
		xml += " <email>\n";
		xml += "  <display-name>" + com.synckolab.tools.text.encode4XML(displayName) + "</display-name>\n";
		xml += "  <smtp-address>" + com.synckolab.tools.text.encode4XML(this.getCardProperty(card, "SecondEmail")) + "</smtp-address>\n";
		xml += " </email>\n";
	}

	// if the mail format is set... 
	if (this.getCardProperty(card, "PreferMailFormat") !== this.MAIL_FORMAT_UNKNOWN) {
		if (this.getCardProperty(card, "PreferMailFormat") === this.MAIL_FORMAT_PLAINTEXT) {
			xml += com.synckolab.tools.text.nodeWithContent("prefer-mail-format", "text", false);
		} else {
			xml += com.synckolab.tools.text.nodeWithContent("prefer-mail-format", "html", false);
		}
	}

	if (this.haveCardProperty(card, "HomeAddress") || this.haveCardProperty(card, "HomeAddress2") || this.haveCardProperty(card, "HomeCity") || this.haveCardProperty(card, "HomeState") || this.haveCardProperty(card, "HomeZipCode") || this.haveCardProperty(card, "HomeCountry")) {
		xml += " <address>\n";
		xml += "  <type>home</type>\n";
		xml += com.synckolab.tools.text.nodeWithContent("street", this.getCardProperty(card, "HomeAddress"), false);
		xml += com.synckolab.tools.text.nodeWithContent("street2", this.getCardProperty(card, "HomeAddress2"), false);
		xml += com.synckolab.tools.text.nodeWithContent("locality", this.getCardProperty(card, "HomeCity"), false);
		xml += com.synckolab.tools.text.nodeWithContent("region", this.getCardProperty(card, "HomeState"), false);
		xml += com.synckolab.tools.text.nodeWithContent("postal-code", this.getCardProperty(card, "HomeZipCode"), false);
		xml += com.synckolab.tools.text.nodeWithContent("country", this.getCardProperty(card, "HomeCountry"), false);
		xml += " </address>\n";
	}

	if (this.haveCardProperty(card, "WorkAddress") || this.haveCardProperty(card, "WorkAddress2") || this.haveCardProperty(card, "WorkCity") || this.haveCardProperty(card, "WorkState") || this.haveCardProperty(card, "WorkZipCode") || this.haveCardProperty(card, "WorkCountry")) {
		xml += " <address>\n";
		xml += "  <type>business</type>\n";
		xml += com.synckolab.tools.text.nodeWithContent("street", this.getCardProperty(card, "WorkAddress"), false);
		xml += com.synckolab.tools.text.nodeWithContent("street2", this.getCardProperty(card, "WorkAddress2"), false);
		xml += com.synckolab.tools.text.nodeWithContent("locality", this.getCardProperty(card, "WorkCity"), false);
		xml += com.synckolab.tools.text.nodeWithContent("region", this.getCardProperty(card, "WorkState"), false);
		xml += com.synckolab.tools.text.nodeWithContent("postal-code", this.getCardProperty(card, "WorkZipCode"), false);
		xml += com.synckolab.tools.text.nodeWithContent("country", this.getCardProperty(card, "WorkCountry"), false);
		xml += " </address>\n";
	}

	// photo name = photo - this is an attachment (handled outside)
	xml += com.synckolab.tools.text.nodeWithContent("picture", this.getCardProperty(card, "PhotoName"), false);

	// we can probably ignore that
	var ptype = this.getCardProperty(card, "PhotoType");
	if (ptype === "web" || ptype === "file") {
		/* kolab:
		 * 1. read the file: FILENAME = this.getCardProperty(card, "PhotoName")
		 *		found in  ~profil/Photos/FILENAME
		 * 2. create an attachment name FILENAME with the content (base64 encoded)
		 */
		xml += com.synckolab.tools.text.nodeWithContent("picture-uri", this.getCardProperty(card, "PhotoURI"), false); // we can distinguish between file: and http: anyways
	}

	//xml += com.synckolab.tools.text.nodeWithContent("preferred-address", this.getCardProperty(card, "DefaultAddress"), false); @deprecated
	xml += com.synckolab.tools.text.nodeWithContent("custom1", this.getCardProperty(card, "Custom1"), false);
	xml += com.synckolab.tools.text.nodeWithContent("custom2", this.getCardProperty(card, "Custom2"), false);
	xml += com.synckolab.tools.text.nodeWithContent("custom3", this.getCardProperty(card, "Custom3"), false);
	xml += com.synckolab.tools.text.nodeWithContent("custom4", this.getCardProperty(card, "Custom4"), false);
	if (this.getCardProperty(card, "AllowRemoteContent")) {
		xml += com.synckolab.tools.text.nodeWithContent("allow-remote-content", "true", false);
	} else {
		xml += com.synckolab.tools.text.nodeWithContent("allow-remote-content", "false", false);
	}

	// add extra/missing fields
	if (fields) {
		xml += fields.toXmlString();
	}

	xml += "</contact>\n";

	return xml;
};

/**
 * Generate a sha1 key out of a vcard - used for database
 */
com.synckolab.addressbookTools.genConSha1 = function (card) {
	return com.synckolab.tools.sha1.hex_sha1(this.getCardProperty(card, "AimScreenName") + ":" + this.getCardProperty(card, "AnniversaryDay") + ":" + this.getCardProperty(card, "AnniversaryMonth") + ":" + this.getCardProperty(card, "AnniversaryYear") + ":" + this.getCardProperty(card, "BirthDay") + ":" +
			this.getCardProperty(card, "BirthMonth") + ":" + this.getCardProperty(card, "BirthYear") + ":" + this.getCardProperty(card, "CardType") + ":" + this.getCardProperty(card, "Category") + ":" + this.getCardProperty(card, "CellularNumber") + ":" +
			this.getCardProperty(card, "CellularNumberType") + ":" + this.getCardProperty(card, "Company") + ":" + this.getCardProperty(card, "Custom1") + ":" + this.getCardProperty(card, "Custom2") + ":" + this.getCardProperty(card, "Custom3") + ":" + this.getCardProperty(card, "Custom4") + ":" +
			//this.getCardProperty(card, "DefaultAddress") + ":" + @deprecated
			this.getCardProperty(card, "Department") + ":" + this.getCardProperty(card, "DisplayName") + ":" + this.getCardProperty(card, "FamilyName") + ":" + this.getCardProperty(card, "FaxNumber") + ":" + this.getCardProperty(card, "FaxNumberType") + ":" + this.getCardProperty(card, "FirstName") +
			":" + this.getCardProperty(card, "HomeAddress") + ":" + this.getCardProperty(card, "HomeAddress2") + ":" + this.getCardProperty(card, "HomeCity") + ":" + this.getCardProperty(card, "HomeCountry") + ":" + this.getCardProperty(card, "HomePhone") + ":" +
			this.getCardProperty(card, "HomePhoneType") + ":" + this.getCardProperty(card, "HomeState") + ":" + this.getCardProperty(card, "HomeZipCode") + ":" + this.getCardProperty(card, "JobTitle") + ":" + this.getCardProperty(card, "LastName") + ":" + this.getCardProperty(card, "NickName") +
			":" + this.getCardProperty(card, "Notes") + ":" + this.getCardProperty(card, "PagerNumber") + ":" + this.getCardProperty(card, "PagerNumberType") + ":" + this.getCardProperty(card, "PhoneticFirstName") + ":" + this.getCardProperty(card, "PhoneticLastName") + ":" +
			this.getCardProperty(card, "PreferMailFormat") + ":" + //Added by Copart, will evidently create a lot of SHA mismatches on first update after sync, auto update will occur
			this.getCardProperty(card, "PrimaryEmail") + ":" + this.getCardProperty(card, "SecondEmail") + ":" + this.getCardProperty(card, "SpouseName") + ":" + this.getCardProperty(card, "WebPage1") + ":" + // WebPage1 is work web page
			this.getCardProperty(card, "WebPage2") + ":" + // WebPage2 is home web page
			this.getCardProperty(card, "WorkAddress") + ":" + this.getCardProperty(card, "WorkAddress2") + ":" + this.getCardProperty(card, "WorkCity") + ":" + this.getCardProperty(card, "WorkCountry") + ":" + this.getCardProperty(card, "WorkPhone") + ":" +
			this.getCardProperty(card, "WorkPhoneType") + ":" + this.getCardProperty(card, "WorkState") + ":" + this.getCardProperty(card, "AllowRemoteContent") + ":" + card.workZipCode);
};

/**
 * This function compares two vcards.
 * It takes note of most fields (except custom4)
 *
 */
com.synckolab.addressbookTools.equalsContact = function (a, b) {
	//Fields to look for
	var fieldsArray;
	// remember the numeric field
	var numericFieldCount = 0;
	
	// if one does not exist - they are definitely different!
	if(!a || !b)
	{
		return false;
	}

	if (a.isMailList !== b.isMailList) {
		com.synckolab.tools.logMessage("not equals isMailList: '" + (a.isMailList ? "true" : "false") + "' vs. '" + (b.isMailList ? "true" : "false") + "'", com.synckolab.global.LOG_DEBUG + com.synckolab.global.LOG_AB);
		return false;
	}

	if (a.isMailList) {
		fieldsArray = [ "NickName", "DisplayName", "Notes" ];
	} else {
		fieldsArray = [
		// these are numbers
		"PreferMailFormat", "BirthYear", "BirthMonth", "BirthDay", "AnniversaryYear", "AnniversaryMonth", "AnniversaryDay",
		// now for strings
		"FirstName", "LastName", "DisplayName", "NickName", "PrimaryEmail", "SecondEmail", "AimScreenName", "WorkPhone", "HomePhone", "FaxNumber", "PagerNumber", "CellularNumber", "HomeAddress", "HomeAddress2", "HomeCity", "HomeState", "HomeZipCode", "HomeCountry", "WebPage2",
				"JobTitle", "Department", "Company", "WorkAddress", "WorkAddress2", "WorkCity", "WorkState", "WorkZipCode", "WorkCountry", "WebPage1", "Custom1", "Custom2", "Custom3", "Custom4", "Notes", "PhotoURI"]; // PhotoType, PhotoName
		numericFieldCount = 7;
	}

	for ( var i = 0; i < fieldsArray.length; i++) {
		var sa = this.getCardProperty(a, fieldsArray[i]);
		var sb = this.getCardProperty(b, fieldsArray[i]);

		// empty field or zero is the same as null (for comparison only) 
		if (sa === '' || sa === 0 || sa === '0') {
			sa = null;
		}
		if (sb === '' || sb === 0 || sb === '0') {
			sb = null;
		}

		// in case the fields are below a certain limit they should be treated as numeric
		if (i < numericFieldCount) {
			if (sa) {
				sa = Number(sa);
			}
			if (sb) {
				sb = Number(sb);
			}
		}

		// null check
		if (sa === null || sb === null) {
			if (sa === null && sb === null) {
				continue;
			}
			else {
				com.synckolab.tools.logMessage("not equals " + fieldsArray[i] + " '" + sa + "' vs. '" + sb + "'", this.global.LOG_DEBUG + this.global.LOG_AB);
				return false;
			}
		}

		// check if not equals 
		if (sa !== sb) {
			// if we got strings... maybe they only differ in whitespace
			if (sa && sb && sa.replace && sb.replace) {
				// if they are equals without whitespace.. continue
				if (sa.replace(/\s|(\\n)|\n|\r/gm, "") === sb.replace(/\s|(\\n)|\n|\r/gm, "")) {
					continue;
				}
			}

			com.synckolab.tools.logMessage("not equals " + fieldsArray[i] + " '" + sa + "' vs. '" + sb + "'", this.global.LOG_DEBUG + this.global.LOG_AB);
			return false;
		}
	}

	if (a.isMailList) {
		com.synckolab.tools.logMessage("start comparing mailing lists!", this.global.LOG_DEBUG + this.global.LOG_AB);

		// update fieldsArray for second run
		fieldsArray = ["Notes", "Nickname"];

		var abManager = Components.classes["@mozilla.org/abmanager;1"].getService(Components.interfaces.nsIAbManager);
		com.synckolab.tools.logMessage("aUri:" + a.mailListURI + "(if: " + (a instanceof Components.interfaces.nsIAbDirectory) + ")" + " b.uri: " + b.mailListURI + "(if: " + (b instanceof Components.interfaces.nsIAbDirectory) + ")", this.global.LOG_DEBUG + this.global.LOG_AB);

		// to get a list(hashmap) of all cards there is either: .childCards (if it is already saved) or Array addressLists
		var aList = a;
		var bList = b;
		var aCards = null;
		var bCards = null;

		if (!(a instanceof Components.interfaces.nsIAbDirectory)) {
			aList = abManager.getDirectory(a.mailListURI);
			aCards = aList.childCards;
		} else {
			aCards = aList.addressLists.enumerate();
		}

		if (!(b instanceof Components.interfaces.nsIAbDirectory)) {
			bList = abManager.getDirectory(b.mailListURI);
			bCards = bList.childCards;
		} else {
			bCards = bList.addressLists.enumerate();
		}

		// put the childs in a hashmap
		var aMap = new com.synckolab.hashMap();
		aMap.clear();

		var aCount = 0;
		var cur, card;
		if (aCards && aCards.hasMoreElements) {
			card = null;
			while (aCards.hasMoreElements() && (card = aCards.getNext())) {
				// get the right interface
				cur = card.QueryInterface(Components.interfaces.nsIAbCard);
				// get the uid or generate it
				aMap.put(this.getUID(cur), cur);
				aCount++;
			}
		}

		// now do a compare
		var bCount = 0;
		if (bCards && bCards.hasMoreElements) {
			card = null;
			while (bCards.hasMoreElements() && (card = bCards.getNext())) {
				// get the right interface
				cur = card.QueryInterface(Components.interfaces.nsIAbCard);
				// get the uid or generate it
				var cUID = this.getUID(cur);
				com.synckolab.tools.logMessage("check " + cUID + "", this.global.LOG_DEBUG + this.global.LOG_AB);

				if (!aMap.get(cUID)) {
					com.synckolab.tools.logMessage("not equals " + cUID + " not found", this.global.LOG_DEBUG + this.global.LOG_AB);
					return false;
				}
				bCount++;
			}
		}

		// if there are any childcards left - return
		if (aCount !== bCount) {
			com.synckolab.tools.logMessage("not equals  '" + aCount + "' vs. '" + bCount + "'", this.global.LOG_DEBUG + this.global.LOG_AB);
			return false;
		}
		// listst are equals
		return true;
	}

	return true;
};

com.synckolab.addressbookTools.vList2Card = function (uids, lines, card, cards) {
	var beginVCard = false;

	card.type = "maillist";
	card.isMailList = true;
	
	//	parse the card
	for ( var i = 0; i < lines.length; i++) {
		var vline = lines[i];

		// strip the \n at the end
		if (vline.charAt(vline.length - 1) === '\r') {
			vline = vline.substring(0, vline.length - 1);
		}

		var tok = vline.split(":");

		// fix for bug #16839: Colon in address book field
		for ( var j = 2; j < tok.length; j++) {
			tok[1] += ":" + tok[j];
		}

		com.synckolab.tools.logMessage("parsing: " + lines[i], this.global.LOG_DEBUG + this.global.LOG_AB);
		var found;
		switch (tok[0].toUpperCase()) {
		case "DATE":
			// now we gotta check times... convert the message first
			// save the date in microseconds
			// Date: Fri, 17 Dec 2004 15:06:42 +0100
			/*
			 * have to ignore this because of abook doesnt support this
			try
			{
				this.setCardProperty(card, "LastModifiedDate", (new Date(Date.parse(lines[i].substring(lines[i].indexOf(":")+1, lines[i].length)))).getTime() / 1000);
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
			this.setCardProperty(card, "ListNickName", tok[1]);
			break;
		case "NOTE":
			this.setCardProperty(card, "Description", tok[1].replace(/\\n/g, "\n")); // carriage returns were stripped, add em back
			found = true;
			break;

		case "UID":
			// we cannot set the custom4 for a mailing list... but since tbird defined
			// the name to be unique... lets keep it that way
			//this.setCardProperty(card, "Custom4", tok[1]);
			break;
		case "BEGIN":
			if (!beginVCard) {
				beginVCard = true;
				break;
			}

			// sub-vcard... parse...
			var cStart = i;
			for (; i < lines.length; i++) {
				if (lines[i].toUpperCase() === "END:VCARD") {
					break;
				}
			}
			var newCard = Components.classes["@mozilla.org/addressbook/cardproperty;1"].createInstance(Components.interfaces.nsIAbCard);
			com.synckolab.addressbookTools.message2Card(lines, newCard, null, cStart, i);
			// check if we know this card already :) - ONLY cards
			var gotCard = com.synckolab.addressbookTools.findCard(cards, this.getUID(newCard), null);
			if (gotCard) {
				card.addressLists.appendElement(gotCard);
			} else {
				card.addressLists.appendElement(newCard);
			}
			break;

		// stuff we just do not parse :)
		case "END":
		case "VERSION":
		case "":
			break;

		default:
			com.synckolab.tools.logMessage("VL FIELD not found: " + tok[0] + ":" + tok[1], this.global.LOG_DEBUG + this.global.LOG_AB);
			//extraFields.addField(tok[0], tok[1]);
			break;
		} // end switch
	}
	return true;
};

/**
 * this is analog function to xml2card. It will fill a json object (card) with the 
 * information from the xml
 * @param topNode the node to parse
 * @param card the card object
 */
com.synckolab.addressbookTools.Xml2List = function (topNode, card) {
	card.type = "maillist";
	card.isMailList = true;

	var cur = new com.synckolab.Node(topNode.firstChild);
	var found = false;
	var email = 0;

	while (cur) {
		if (cur.nodeType === Node.ELEMENT_NODE)//1
		{
			switch (cur.nodeName.toUpperCase()) {
			case "LAST-MODIFICATION-DATE":
				/*
				ignore this since thunderbird implementation just does not work
				var s = cur.getFirstData();
				// now we gotta check times... convert the message first
				// save the date in microseconds
				// 2005-03-30T15:28:52Z
				try
				{
					// we dont need the date anyways.. so lets skip that part
					// this.setCardProperty(card, "LastModifiedDate", string2DateTime(s).getTime() / 1000);
				}
				catch (ex)
				{
					consoleService.logStringMessage("unable to convert to date: " + s);
					alert(("unable to convert to date: " + s + "\nPlease copy the date string in a bug report an submit!\n(Also available in the information)"));
				}
				*/
				break;
			// very important!!!
			case "NAME":
				if (cur.firstChild === null) {
					break;
				}
				card.dirName = cur.getFirstData();
				found = true;
				break;
			case "NICKNAME":
				card.listNickName = cur.getFirstData();
				found = true;
				break;
			case "BODY":
				card.description = cur.getFirstData();
				found = true;
				break;
			case "UID":
				// the md5 of the name is the uid... 
				// because for thunderbird the name is unique
				break;
			case "MEMBER":
				// sub-vcard... parse...
				if(!card.contacts) {
					card.contacts = [];
				}
				var member = {
					synckolab: com.synckolab.config.version, // synckolab version
					listMember: true,
					type: "contact", // a contact
					isMailList: false,
					ts: new Date().getTime() // the current time
				};
				// parse the whole card
				com.synckolab.addressbookTools.xml2Card(cur, member);
				com.synckolab.tools.logMessage("FOUND CARD: " + member.toSource(), this.global.LOG_DEBUG + this.global.LOG_AB);
				
				card.contacts.push(member);
				// parse the member - take as much as we wan
				
				break;
			case "PRODUCT-ID":
			case "CREATION-DATE":
			case "SENSITIVITY":
				// ignore
				break;
			default:
				com.synckolab.tools.logMessage("Ignoring XML list FIELD not found: " + cur.nodeName, this.global.LOG_DEBUG + this.global.LOG_AB);
				break;
			}

		}

		cur = cur.nextSibling;
	}

	if (!found) {
		return null;
	}
	com.synckolab.tools.logMessage("finished parsing list: " + card.dirName + " - " + this.getUID(card) + "\n" + card.toSource(), this.global.LOG_DEBUG + this.global.LOG_AB);

	return card;
};

/**
 * @return true if the message contains a list instead of a card
 */
com.synckolab.addressbookTools.isMailList = function (message) {
	if (message.indexOf("<?xml") !== -1 || message.indexOf("<?XML") !== -1) {
		if (message.indexOf("<distribution-list") !== -1 || message.indexOf("<DISTRIBUTION-LIST") !== -1) {
			com.synckolab.tools.logMessage("is mail list returning true", com.synckolab.global.LOG_DEBUG + com.synckolab.global.LOG_AB);
			return true;
		}
	}

	if (message.indexOf("X-LIST") !== -1 || message.indexOf("x-list") !== -1) {
		com.synckolab.tools.logMessage("is mail list returning true", com.synckolab.global.LOG_DEBUG + com.synckolab.global.LOG_AB);
		return true;
	}

	return false;
};


/**
 * Parses a vcard/xml/list into its json object.
 * this function finds out if the message is either:
 *  - a vcard with a contact
 *  - a vcard with a list
 *  - a xml kolab2 contact
 *  - a xml kolab2 distribution list
 * on its own and returns the correct object.
 * @param message string - a string with the vcard (make sure its trimmed from whitespace)
 * @return the filled object or null if not parseable
 */
com.synckolab.addressbookTools.parseMessageContent = function (message) {
	// fix for bug #16766: message has no properties
	if (message === null) {
		return false;
	}
	
	// the pojo contains the synckolab version - this is used to identify the content
	var card = {
		synckolab: com.synckolab.config.version, // synckolab version
		type: "contact", // a contact
		isMailList: false,
		ts: new Date().getTime() // the current time
	};
	
	// check for xml style
	if (message.indexOf("<?xml") !== -1 || message.indexOf("<?XML") !== -1) {
		if(this.xml2Card(message, card)) {
			card.sha1 = com.synckolab.addressbookTools.genConSha1(card);
			return card;
		}
	} else {
		com.synckolab.tools.logMessage("VCARD/VLIST!", this.global.LOG_INFO + this.global.LOG_AB);
	}
	
	// decode utf8
	message = com.synckolab.tools.text.utf8.decode(message);

	// check for errors in the decoded message
	if (message.indexOf("TYPE=3D") !== -1) {
		message = com.synckolab.tools.text.quoted.decode(message);
	} else 
	// that still looks double decoded
	if (message.indexOf("=C3=") !== -1) {
		message = com.synckolab.tools.text.utf8.decode(com.synckolab.tools.text.quoted.decode(message));
	}

	// make an array of all lines for easier parsing
	var lines = message.split("\n");

	// check if we got a list
	for ( var i = 0; i < lines.length; i++) {
		if (lines[i].toUpperCase().indexOf("X-LIST") !== -1) {
			com.synckolab.tools.logMessage("parsing a list: " + message, this.global.LOG_DEBUG + this.global.LOG_AB);
			if (!this.vList2Card(lines[i], lines, card)) {
				return null;
			}
			return card;
		}
	}

	if (!com.synckolab.addressbookTools.message2Card(lines, card, 0, lines.length)) {
		com.synckolab.tools.logMessage("unparseable: " + message, this.global.LOG_ERROR + this.global.LOG_AB);
		return null;
	}
	
	card.sha1 = com.synckolab.addressbookTools.genConSha1(card);
	return card;
};

/**
 * Transform a json object into the real deal
 * @param base the base json object
 * @return a thunderbird object (either nsIABCard or nsIAbDirectory)
 */
com.synckolab.addressbookTools.createTBirdObject = function(base, cards) {
	var card = null;
	if(base.type === "contact") {
		card = Components.classes["@mozilla.org/addressbook/cardproperty;1"].createInstance(Components.interfaces.nsIAbCard);
	} else if(base.type === "maillist") {
		card = Components.classes["@mozilla.org/addressbook/directoryproperty;1"].createInstance(Components.interfaces.nsIAbDirectory);
	} else {
		return null;
	}

	// go through all elements of base
	for(var field in base) {
		// skip our own stuff TODO: handle mailing lists!
		if(field !== "type" || field !== "synckolab" || field !== "ts") {
			// copy the property from base to card
			this.setCardProperty(card, field, this.getCardProperty(base, field));
		}
	}
	return card;
};

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
com.synckolab.addressbookTools.message2Card = function (lines, card, startI, endI) {
	// reset the card
	this.setCardProperty(card, "AimScreenName", "");
	this.setCardProperty(card, "AnniversaryDay", "");
	this.setCardProperty(card, "AnniversaryMonth", "");
	this.setCardProperty(card, "AnniversaryYear", "");
	this.setCardProperty(card, "BirthDay", "");
	this.setCardProperty(card, "BirthMonth", "");
	this.setCardProperty(card, "BirthYear", "");
	this.setCardProperty(card, "CardType", "");
	this.setCardProperty(card, "Category", "");
	this.setCardProperty(card, "CellularNumber", "");
	this.setCardProperty(card, "CellularNumberType", "");
	this.setCardProperty(card, "Company", "");
	this.setCardProperty(card, "Custom1", "");
	this.setCardProperty(card, "Custom2", "");
	this.setCardProperty(card, "Custom3", "");
	this.setCardProperty(card, "Custom4", "");
	//this.setCardProperty(card, "DefaultAddress", ""); @deprecated
	this.setCardProperty(card, "Department", "");
	this.setCardProperty(card, "DisplayName", "");
	this.setCardProperty(card, "FamilyName", "");
	this.setCardProperty(card, "FaxNumber", "");
	this.setCardProperty(card, "FaxNumberType", "");
	this.setCardProperty(card, "FirstName", "");
	this.setCardProperty(card, "HomeAddress", "");
	this.setCardProperty(card, "HomeAddress2", "");
	this.setCardProperty(card, "HomeCity", "");
	this.setCardProperty(card, "HomeCountry", "");
	this.setCardProperty(card, "HomePhone", "");
	this.setCardProperty(card, "HomePhoneType", "");
	this.setCardProperty(card, "HomeState", "");
	this.setCardProperty(card, "HomeZipCode", "");
	this.setCardProperty(card, "JobTitle", "");
	//this.setCardProperty(card, "LastModifiedDate", 0);
	this.setCardProperty(card, "LastName", "");
	this.setCardProperty(card, "NickName", "");
	this.setCardProperty(card, "Notes", "");
	this.setCardProperty(card, "PagerNumber", "");
	this.setCardProperty(card, "PagerNumberType", "");
	this.setCardProperty(card, "PhoneticFirstName", "");
	this.setCardProperty(card, "PhoneticLastName", "");
	this.setCardProperty(card, "PreferMailFormat", this.MAIL_FORMAT_UNKNOWN);
	//PRUint32 preferMailFormat = "";
	this.setCardProperty(card, "PrimaryEmail", "");
	this.setCardProperty(card, "SecondEmail", "");
	this.setCardProperty(card, "SpouseName", "");
	this.setCardProperty(card, "WebPage1", ""); // WebPage1 is work web page
	this.setCardProperty(card, "WebPage2", ""); // WebPage2 is home web page
	this.setCardProperty(card, "WorkAddress", "");
	this.setCardProperty(card, "WorkAddress2", "");
	this.setCardProperty(card, "WorkCity", "");
	this.setCardProperty(card, "WorkCountry", "");
	this.setCardProperty(card, "WorkPhone", "");
	this.setCardProperty(card, "WorkPhoneType", "");
	this.setCardProperty(card, "WorkState", "");
	this.setCardProperty(card, "WorkZipCode", "");

	/*
		this.setCardProperty(card, "CardType", "");
		this.setCardProperty(card, "Category", "");
		this.setCardProperty(card, "PhoneticFirstName", "");
		this.setCardProperty(card, "PhoneticLastName", "");
		//PRUint32 preferMailFormat = "";
	*/

	// now update it
	var found = false;
	var cur;

	// remember which email we already have and set the other one accordingly
	var gotEmailPrimary = false, gotEmailSecondary = false;

	for ( var i = startI; i < lines.length && i < endI; i++) {
		// decode utf8
		var vline = lines[i];

		// strip the \n at the end
		if (vline.charAt(vline.length - 1) === '\r') {
			vline = vline.substring(0, vline.length - 1);
		}

		var tok = vline.split(":");

		// fix for bug #16839: Colon in address book field
		for ( var j = 2; j < tok.length; j++) {
			tok[1] += ":" + tok[j];
		}

		// check if we actually have data in the second token (skip it if it does not)
		if (tok[1] === null || tok[1] === '' || tok[1] === ';' || tok[1] === ';;;;;;') {
			continue;
		}

		// remove some tok0 stuff
		var field = tok[0].toUpperCase();
		field = field.replace(/TYPE=/g, "").replace(/,/g, ";");
		switch (field) {
		case "DATE":
			// now we gotta check times... convert the message first
			// save the date in microseconds
			// Date: Fri, 17 Dec 2004 15:06:42 +0100
			/* 
			 * have to ignore this because of abook doesnt really support this
			try
			{
				this.setCardProperty(card, "LastModifiedDate", (new Date(Date.parse(lines[i].substring(lines[i].indexOf(":")+1, lines[i].length)))).getTime() / 1000);
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
			cur = tok[1].split(";");
			this.setCardProperty(card, "LastName", cur[0]);
			this.setCardProperty(card, "FirstName", cur[1]);
			found = true;
			break;
		case "FN":
			this.setCardProperty(card, "DisplayName", tok[1]);
			found = true;
			break;
		case "NICKNAME":
			this.setCardProperty(card, "NickName", tok[1]);
			found = true;
			break;
		case "TITLE":
			this.setCardProperty(card, "JobTitle", tok[1]);
			found = true;
			break;
		case "ORG":
			this.setCardProperty(card, "Company", tok[1]);
			found = true;
			break;
		case "EMAIL;PREF":
		case "EMAIL;PREF;HOME":
		case "EMAIL;INTERNET;PREF":
		case "EMAIL;PREF;INTERNET":
			// the "preferred" email is the primary
			if (!gotEmailPrimary) {
				this.setCardProperty(card, "PrimaryEmail", tok[1]);
				gotEmailPrimary = true;
			} else if (!gotEmailSecondary) {
				this.setCardProperty(card, "SecondEmail", tok[1]);
				gotEmailSecondary = true;
			} else {
				this.setCardProperty(card, tok[0], tok[1], true);
			}

			found = true;
			break;
		case "EMAIL;INTERNET":
		case "EMAIL": //This is here to limit compact to existing vcards
			// make sure to fill all email fields
			if (!gotEmailPrimary) {
				this.setCardProperty(card, "PrimaryEmail", tok[1]);
				gotEmailPrimary = true;
			} else if (!gotEmailSecondary) {
				this.setCardProperty(card, "SecondEmail", tok[1]);
				gotEmailSecondary = true;
			} else {
				com.synckolab.tools.logMessage("additional email found: " + tok[1], this.global.LOG_WARNING + this.global.LOG_AB);
				this.setCardProperty(card, tok[0], tok[1], true);
			}

			found = true;
			break;
		case "X-EMAILFORMAT":
			// This will set the Email format to vCard, not part of vCard 3.0 spec, so the X- is there, I assume a Kolab server would just ignore this field
			switch (tok[1]) {
			case "Plain Text":
				this.setCardProperty(card, "PreferMailFormat", this.MAIL_FORMAT_PLAINTEXT);
				break;
			case "HTML":
				this.setCardProperty(card, "PreferMailFormat", this.MAIL_FORMAT_HTML);
				break;
			// Unknown or misspeelled!
			default:
				this.setCardProperty(card, "PreferMailFormat", this.MAIL_FORMAT_UNKNOWN);
			}
			break;

		case "X-AIM": // not standard vcard spec, therefore, prepended with an X
			this.setCardProperty(card, "AimScreenName", tok[1]);
			found = true;
			break;
		case "TEL;MOBILE;VOICE":
		case "TEL;VOICE;MOBILE":
		case "TEL;MOBILE":
		case "TEL;CELL;VOICE":
		case "TEL;VOICE;CELL":
		case "TEL;PREF;CELL;VOICE":
		case "TEL;CELL":
			this.setCardProperty(card, "CellularNumber", tok[1]);
			found = true;
			break;
		case "TEL;VOICE;HOME":
		case "TEL;HOME;VOICE":
		case "TEL;VOICE":
		case "TEL;PREF;HOME;VOICE":
		case "TEL;HOME":
		case "TEL":
			this.setCardProperty(card, "HomePhone", tok[1]);
			found = true;
			break;
		case "TEL;VOICE;WORK":
		case "TEL;WORK;VOICE":
		case "TEL;PREF;WORK;VOICE":
		case "TEL;WORK":
			this.setCardProperty(card, "WorkPhone", tok[1]);
			found = true;
			break;
		case "TEL;FAX":
			this.setCardProperty(card, "FaxNumber", tok[1]);
			found = true;
			break;
		case "TEL;PAGER":
		case "TEL;PAGE":
			this.setCardProperty(card, "PagerNumber", tok[1]);
			found = true;
			break;
		case "BDAY":
			// BDAY:1987-09-27T08:30:00-06:00
			cur = tok[1].split("-");
			this.setCardProperty(card, "BirthYear", cur[0]);
			this.setCardProperty(card, "BirthMonth", cur[1]);
			this.setCardProperty(card, "BirthDay", (cur[2].indexOf("T") !== -1) ? cur[2].substring(0, cur[2].indexOf("T")) : cur[2]);
			found = true;
			break;
		case "ANNIVERSARY":
			// This is not a standard vCard entry.
			cur = tok[1].split("-");

			this.setCardProperty(card, "AnniversaryYear", cur[0]);
			this.setCardProperty(card, "AnniversaryMonth", cur[1]);
			// BDAY:1987-09-27T08:30:00-06:00
			this.setCardProperty(card, "AnniversaryDay", (cur[2].indexOf("T") !== -1) ? cur[2].substring(0, cur[2].indexOf("T")) : cur[2]);
			found = true;
			break;
		case "PICTURE":
			// skip
			break;
		case "PICTURE-URI":
			var uri = tok[1];
			// check for local
			if (uri.indexOf("file") === 0) {
				this.setCardProperty(card, "PhotoType", "file");
				this.setCardProperty(card, "PhotoURI", uri);
			} else if (uri.indexOf("http") === 0) {
				this.setCardProperty(card, "PhotoType", "web");
				this.setCardProperty(card, "PhotoURI", uri);
			}
			break;

		case "ADR;HOME;POSTAL":
		case "ADR;HOME":
		case "ADR":
			// ADR:POBox;Ext. Address;Address;City;State;Zip Code;Country
			cur = tok[1].split(";");
			this.setCardProperty(card, "HomeAddress2", cur[1]);
			this.setCardProperty(card, "HomeAddress", cur[2]);
			this.setCardProperty(card, "HomeCity", cur[3]);
			this.setCardProperty(card, "HomeState", cur[4]);
			this.setCardProperty(card, "HomeZipCode", cur[5]);
			this.setCardProperty(card, "HomeCountry", cur[6]);
			found = true;
			break;
		case "ADR;WORK;POSTAL":
		case "ADR;WORK":
			cur = tok[1].split(";");
			this.setCardProperty(card, "WorkAddress2", cur[1]);
			this.setCardProperty(card, "WorkAddress", cur[2]);
			this.setCardProperty(card, "WorkCity", cur[3]);
			this.setCardProperty(card, "WorkState", cur[4]);
			this.setCardProperty(card, "WorkZipCode", cur[5]);
			this.setCardProperty(card, "WorkCountry", cur[6]);
			found = true;
			break;
		case "NOTE":
			this.setCardProperty(card, "Notes", tok[1].replace(/\\n/g, "\n")); // carriage returns were stripped, add em back
			found = true;
			break;
		case "DEPT":
			this.setCardProperty(card, "Department", tok[1]);
			found = true;
			break;
		case "CUSTOM1":
			this.setCardProperty(card, "Custom1", tok[1].replace(/\\n/g, "\n")); // carriage returns were stripped, add em back
			found = true;
			break;
		case "CUSTOM2":
			this.setCardProperty(card, "Custom2", tok[1].replace(/\\n/g, "\n")); // carriage returns were stripped, add em back
			found = true;
			break;
		case "CUSTOM3":
			this.setCardProperty(card, "Custom3", tok[1].replace(/\\n/g, "\n")); // carriage returns were stripped, add em back
			found = true;
			break;
		case "CUSTOM4":
			this.setCardProperty(card, "Custom4", tok[1].replace(/\\n/g, "\n")); // carriage returns were stripped, add em back
			found = true;
			break;

		case "URL;WORK":
		case "URL":
			// WebPage1 is work web page
			this.setCardProperty(card, "WebPage1", this.decodeCardField(tok[1])); // decode to convert the : char hex codes back to ascii
			found = true;
			break;
		case "URL;PRIVATE":
		case "URL;PERSONAL":
			// WebPage2 is home web page
			this.setCardProperty(card, "WebPage2", this.decodeCardField(tok[1])); // decode to convert the : char hex codes back to ascii
			found = true;
			break;
		case "UID":
			this.setUID(card, tok[1]);
			break;
		case "ALLOWREMOTECONTENT":
			this.setCardProperty(card, "AllowRemoteContent", tok[1].toUpperCase() === 'TRUE');
			break;

		// stuff we just do not parse :)
		case "":
		case "BEGIN":
		case "END":
		case "VERSION":
			break;

		default:
			com.synckolab.tools.logMessage("VC FIELD not found: " + tok[0] + ":" + tok[1], this.global.LOG_WARNING + this.global.LOG_AB);
			this.setCardProperty(card, tok[0], tok[1], true);
		} // end switch
	}

	// invalid VCARD: no uid:
	if (this.getUID(card) === null) {
		// generate one
		this.setUID(card, "vc-" + com.synckolab.tools.text.randomVcardId());
	}

	return found;
};

com.synckolab.addressbookTools.list2Human = function (card) {
	var msg = "";
	msg += "Name: " + this.getCardProperty(card, "DisplayName") + "\n";
	if (this.haveCardProperty(card, "Notes")) {
		msg += "Notes: " + this.getCardProperty(card, "Notes") + "\n";
	}

	var cList = Components.classes["@mozilla.org/abmanager;1"].getService(Components.interfaces.nsIAbManager).getDirectory(card.mailListURI);

	var lCards = cList.childCards;
	if (lCards) {
		msg += "Members: \n\n";
		var curCard = null;
		if (lCards.hasMoreElements) {
			while (lCards.hasMoreElements() && (curCard = lCards.getNext())) {
				// get the right interface
				curCard = curCard.QueryInterface(Components.interfaces.nsIAbCard);
				msg += this.getCardProperty(curCard, "DisplayName") + "<" + this.getCardProperty(curCard, "PrimaryEmail") + ">\n";
			}
		}
	}
	return msg;
};

com.synckolab.addressbookTools.card2Human = function (card) {
	var msg = "";

	if (this.haveCardProperty(card, "FirstName") || this.haveCardProperty(card, "LastName")) {
		msg += "Name: " + (this.haveCardProperty(card, "LastName") ? this.getCardProperty(card, "LastName", "") + " " : "") + this.getCardProperty(card, "FirstName", "") + "\n";
	} else if (this.haveCardProperty(card, "DisplayName")) {
		msg += "Name: " + this.getCardProperty(card, "DisplayName");
	}

	if (this.haveCardProperty(card, "JobTitle")) {
		msg += "Title: " + this.getCardProperty(card, "JobTitle") + "\n";
	}
	if (this.haveCardProperty(card, "Company")) {
		msg += "Company: " + this.getCardProperty(card, "Company") + "\n\n";
	}
	if (this.haveCardProperty(card, "WebPage1")) {
		msg += "Web: " + this.getCardProperty(card, "WebPage1") + "\n";
	}
	if (this.haveCardProperty(card, "WebPage2")) {
		msg += "Web: " + this.getCardProperty(card, "WebPage2") + "\n\n";
	}

	if (this.haveCardProperty(card, "CellularNumber")) {
		msg += "Cell #: " + this.getCardProperty(card, "CellularNumber") + "\n";
	}
	if (this.haveCardProperty(card, "AhomePhone")) {
		msg += "Home #: " + this.getCardProperty(card, "AhomePhone") + "\n";
	}
	if (this.haveCardProperty(card, "FaxNumber")) {
		msg += "Fax #: " + this.getCardProperty(card, "FaxNumber") + "\n";
	}
	if (this.haveCardProperty(card, "WorkPhone")) {
		msg += "Work #: " + this.getCardProperty(card, "WorkPhone") + "\n";
	}
	if (this.haveCardProperty(card, "PagerNumber")) {
		msg += "Pager #: " + this.getCardProperty(card, "PagerNumber") + "\n";
	}
	if (this.haveCardProperty(card, "Department")) {
		msg += "Department: " + this.getCardProperty(card, "Department") + "\n";
	}

	if (this.haveCardProperty(card, "PrimaryEmail")) {
		msg += "E-Mail:" + this.getCardProperty(card, "PrimaryEmail") + "\n";
	}
	if (this.haveCardProperty(card, "SecondEmail")) {
		msg += "E-Mail:" + this.getCardProperty(card, "SecondEmail") + "\n";
	}

	if (this.haveCardProperty(card, "BirthYear") && this.haveCardProperty(card, "BirthDay") && this.haveCardProperty(card, "BirthMonth")) {
		msg += "Birthday: ";
		msg += this.getCardProperty(card, "BirthYear") + "-";
		if (this.getCardProperty(card, "BirthMonth") < 10) {
			msg += "0";
		}
		msg += this.getCardProperty(card, "BirthMonth") + "-";
		if (this.getCardProperty(card, "BirthDay") < 10) {
			msg += "0";
		}
		msg += this.getCardProperty(card, "BirthDay") + "\n";
	}
	if (this.haveCardProperty(card, "AnniversaryYear") && this.haveCardProperty(card, "AnniversaryDay") && this.haveCardProperty(card, "AnniversaryMonth")) {
		msg += "Anniversary: ";
		msg += this.getCardProperty(card, "AnniversaryYear") + "-";
		if (this.getCardProperty(card, "AnniversaryMonth") < 10) {
			msg += "0";
		}
		msg += this.getCardProperty(card, "AnniversaryMonth") + "-";
		if (this.getCardProperty(card, "AnniversaryDay") < 10) {
			msg += "0";
		}
		msg += this.getCardProperty(card, "AnniversaryDay") + "\n";
	}

	if (this.haveCardProperty(card, "WorkAddress2") || this.haveCardProperty(card, "WorkAddress") || this.haveCardProperty(card, "WorkCountry") || this.haveCardProperty(card, "WorkCity") || this.haveCardProperty(card, "WorkState")) {
		msg += "Work: ";
		if (this.haveCardProperty(card, "WorkAddress")) {
			msg += this.getCardProperty(card, "WorkAddress") + "\n";
		}
		if (this.haveCardProperty(card, "WorkAddress2")) {
			msg += this.getCardProperty(card, "WorkAddress2") + "\n";
		}
		if (this.haveCardProperty(card, "WorkZipCode")) {
			msg += this.getCardProperty(card, "WorkZipCode") + " ";
		}
		if (this.haveCardProperty(card, "WorkState")) {
			msg += this.getCardProperty(card, "WorkState") + " ";
		}
		if (this.haveCardProperty(card, "WorkCity")) {
			msg += this.getCardProperty(card, "WorkCity") + "\n";
		}
		if (this.haveCardProperty(card, "WorkCountry")) {
			msg += this.getCardProperty(card, "WorkCountry") + "\n";
		}
	}
	// ADR:POBox;Ext. Address;Address;City;State;Zip Code;Country
	if (this.haveCardProperty(card, "HomeAddress2") || this.haveCardProperty(card, "HomeAddress") || this.haveCardProperty(card, "HomeCountry") || this.haveCardProperty(card, "HomeCity") || this.haveCardProperty(card, "HomeState")) {
		msg += "Home: ";
		if (this.haveCardProperty(card, "HomeAddress")) {
			msg += this.getCardProperty(card, "HomeAddress") + "\n";
		}
		if (this.haveCardProperty(card, "HomeAddress2")) {
			msg += this.getCardProperty(card, "HomeAddress2") + "\n";
		}
		if (this.haveCardProperty(card, "HomeZipCode")) {
			msg += this.getCardProperty(card, "HomeZipCode") + " ";
		}
		if (this.haveCardProperty(card, "HomeState")) {
			msg += this.getCardProperty(card, "HomeState") + " ";
		}
		if (this.haveCardProperty(card, "HomeCity")) {
			msg += this.getCardProperty(card, "HomeCity") + "\n";
		}
		if (this.haveCardProperty(card, "HomeCountry")) {
			msg += this.getCardProperty(card, "HomeCountry") + "\n";
		}
	}
	if (this.haveCardProperty(card, "Notes")) {
		msg += "Notes: " + this.getCardProperty(card, "Notes") + "\n";
	}
	return msg;
};

/**
 * this returns a quoted encoded vcard
 */
com.synckolab.addressbookTools.card2Vcard = function (card, fields) {
	// save the date in microseconds
	// Date: Fri, 17 Dec 2004 15:06:42 +0100
	var cdate = new Date(this.getCardProperty(card, "LastModifiedDate") * 1000);
	var sTime = (cdate.getHours() < 10 ? "0" : "") + cdate.getHours() + ":" + (cdate.getMinutes() < 10 ? "0" : "") + cdate.getMinutes() + ":" + (cdate.getSeconds() < 10 ? "0" : "") + cdate.getSeconds();
	var sdate = "DATE: " + com.synckolab.tools.text.getDayString(cdate.getDay()) + ", " + cdate.getDate() + " " + com.synckolab.tools.text.getMonthString(cdate.getMonth()) + " " + cdate.getFullYear() + " " + sTime + " " + (((cdate.getTimezoneOffset() / 60) < 0) ? "-" : "+") +
			(((cdate.getTimezoneOffset() / 60) < 10) ? "0" : "") + cdate.getTimezoneOffset() + "\n";

	var msg = "BEGIN:VCARD\n";
	// N:Lastname;Firstname;Other;Prefix;Suffix
	if (this.haveCardProperty(card, "FirstName") || this.haveCardProperty(card, "LastName")) {
		msg += "N:" + this.getCardProperty(card, "LastName", "") + ";" + this.getCardProperty(card, "FirstName", "") + ";;;\n";
	}
	if (this.haveCardProperty(card, "DisplayName")) {
		msg += "FN:" + this.getCardProperty(card, "DisplayName") + "\n";
	}
	if (this.haveCardProperty(card, "NickName")) {
		msg += "NICKNAME:" + this.getCardProperty(card, "NickName") + "\n";
	}
	if (this.haveCardProperty(card, "JobTitle")) {
		msg += "TITLE:" + this.getCardProperty(card, "JobTitle") + "\n";
	}
	if (this.haveCardProperty(card, "Company")) {
		msg += "ORG:" + this.getCardProperty(card, "Company") + "\n";
	}
	if (this.haveCardProperty(card, "PrimaryEmail")) {
		msg += "EMAIL;TYPE=3DINTERNET;PREF:" + this.getCardProperty(card, "PrimaryEmail") + "\n";
	}
	if (this.haveCardProperty(card, "SecondEmail")) {
		msg += "EMAIL;TYPE=3DINTERNET:" + this.getCardProperty(card, "SecondEmail") + "\n";
	}
	if (this.haveCardProperty(card, "PreferMailFormat")) {
		switch (this.getCardProperty(card, "PreferMailFormat")) {
		case this.MAIL_FORMAT_UNKNOWN:
			msg += "X-EMAILFORMAT:Unknown\n";
			break;
		case this.MAIL_FORMAT_PLAINTEXT:
			msg += "X-EMAILFORMAT:Plain Text\n";
			break;
		case this.MAIL_FORMAT_HTML:
			msg += "X-EMAILFORMAT:HTML\n";
			break;
		}
	}
	if (this.haveCardProperty(card, "AimScreenName")) {
		msg += "X-AIM:" + this.getCardProperty(card, "AimScreenName") + "\n";
	}
	if (this.haveCardProperty(card, "CellularNumber")) {
		msg += "TEL;TYPE=3DCELL:" + this.getCardProperty(card, "CellularNumber") + "\n";
	}
	if (this.haveCardProperty(card, "HomePhone")) {
		msg += "TEL;TYPE=3DHOME:" + this.getCardProperty(card, "HomePhone") + "\n";
	}
	if (this.haveCardProperty(card, "FaxNumber")) {
		msg += "TEL;TYPE=3DFAX:" + this.getCardProperty(card, "FaxNumber") + "\n";
	}
	if (this.haveCardProperty(card, "WorkPhone")) {
		msg += "TEL;TYPE=3DWORK:" + this.getCardProperty(card, "WorkPhone") + "\n";
	}
	if (this.haveCardProperty(card, "PagerNumber")) {
		msg += "TEL;TYPE=3DPAGER:" + this.getCardProperty(card, "PagerNumber") + "\n";
	}
	if (this.haveCardProperty(card, "Department")) {
		msg += "DEPT:" + this.getCardProperty(card, "Department") + "\n";
	}
	// BDAY:1987-09-27T08:30:00-06:00
	if (this.haveCardProperty(card, "BirthYear") || this.haveCardProperty(card, "BirthDay") || this.haveCardProperty(card, "BirthMonth")) {
		msg += "BDAY:";
		msg += this.getCardProperty(card, "BirthYear") + "-";
		if (this.getCardProperty(card, "BirthMonth") < 10) {
			msg += "0";
		}
		msg += this.getCardProperty(card, "BirthMonth") + "-";
		if (this.getCardProperty(card, "BirthDay") < 10) {
			msg += "0";
		}
		msg += this.getCardProperty(card, "BirthDay") + "\n";
	}
	if (this.haveCardProperty(card, "AnniversaryYear") || this.haveCardProperty(card, "AnniversaryDay") || this.haveCardProperty(card, "AnniversaryMonth")) {
		msg += "ANNIVERSARY:";
		msg += this.getCardProperty(card, "AnniversaryYear") + "-";
		if (this.getCardProperty(card, "AnniversaryMonth") < 10) {
			msg += "0";
		}
		msg += this.getCardProperty(card, "AnniversaryMonth") + "-";
		if (this.getCardProperty(card, "AnniversaryDay") < 10) {
			msg += "0";
		}
		msg += this.getCardProperty(card, "AnniversaryDay") + "\n";
	}
	if (this.haveCardProperty(card, "WebPage1")) {
		msg += "URL:" + this.encodeCardField(this.getCardProperty(card, "WebPage1")) + "\n"; // encode the : chars to HEX, vcard values cannot contain colons
	}
	if (this.haveCardProperty(card, "WebPage2")) {
		msg += "URL;TYPE=3DPERSONAL:" + this.encodeCardField(this.getCardProperty(card, "WebPage2")) + "\n";
	}
	// ADR:POBox;Ext. Address;Address;City;State;Zip Code;Country
	if (this.haveCardProperty(card, "WorkAddress2") || this.haveCardProperty(card, "WorkAddress") || this.haveCardProperty(card, "WorkCountry") || this.haveCardProperty(card, "WorkCity") || this.haveCardProperty(card, "WorkState")) {
		msg += "ADR;TYPE=3DWORK:;";
		msg += this.getCardProperty(card, "WorkAddress", "") + ";";
		msg += this.getCardProperty(card, "WorkAddress2", "") + ";";
		msg += this.getCardProperty(card, "WorkCity", "") + ";";
		msg += this.getCardProperty(card, "WorkState", "") + ";";
		msg += this.getCardProperty(card, "WorkZipCode", "") + ";";
		msg += this.getCardProperty(card, "WorkCountry", "") + "\n";
	}
	// ADR:POBox;Ext. Address;Address;City;State;Zip Code;Country
	if (this.haveCardProperty(card, "HomeAddress2") || this.haveCardProperty(card, "HomeAddress") || this.haveCardProperty(card, "HomeCountry") || this.haveCardProperty(card, "HomeCity") || this.haveCardProperty(card, "HomeState")) {
		msg += "ADR;TYPE=3DHOME:;";
		msg += this.getCardProperty(card, "HomeAddress", "") + ";";
		msg += this.getCardProperty(card, "HomeAddress2", "") + ";";
		msg += this.getCardProperty(card, "HomeCity", "") + ";";
		msg += this.getCardProperty(card, "HomeState", "") + ";";
		msg += this.getCardProperty(card, "HomeZipCode", "") + ";";
		msg += this.getCardProperty(card, "HomeCountry", "") + "\n";
	}
	if (this.haveCardProperty(card, "Custom1")) {
		msg += "CUSTOM1:" + this.getCardProperty(card, "Custom1").replace(/\n/g, "\\n") + "\n";
	}
	if (this.haveCardProperty(card, "Custom2")) {
		msg += "CUSTOM2:" + this.getCardProperty(card, "Custom2").replace(/\n/g, "\\n") + "\n";
	}
	if (this.haveCardProperty(card, "Custom3")) {
		msg += "CUSTOM3:" + this.getCardProperty(card, "Custom3").replace(/\n/g, "\\n") + "\n";
	}
	if (this.haveCardProperty(card, "Custom4")) {
		msg += "CUSTOM4:" + this.getCardProperty(card, "Custom4").replace(/\n/g, "\\n") + "\n";
	}
	if (this.getCardProperty(card, "AllowRemoteContent")) {
		msg += "ALLOWREMOTECONTENT:true\n";
	}
	else {
		msg += "ALLOWREMOTECONTENT:false\n";
	}
	// picture
	if (this.haveCardProperty(card, "PhotoName")) {
		msg += "PICTURE:" + this.getCardProperty(card, "PhotoName") + "\n";
		var ptype = this.getCardProperty(card, "PhotoType");
		if (ptype === "web" || ptype === "file") {
			msg += "PICTURE-URI:" + this.getCardProperty(card, "PhotoURI"); // we can distinguish between file: and http: anyways
		}
	}

	// yeap one than more line (or something like that :P)
	if (this.haveCardProperty(card, "Notes")) {
		msg += "NOTE:" + this.getCardProperty(card, "Notes").replace(/\n\n/g, "\\n").replace(/\n/g, "\\n") + "\n";
	}
	msg += "UID:" + this.getUID(card) + "\n";
	// add extra/missing fields
	if (fields) {
		msg += fields.toString();
	}
	msg += "VERSION:3.0\n";
	msg += "END:VCARD\n\n";

	return msg;
};

/**
 * Creates a vcard message out of a card.
 * This creates the WHOLE message including header
 * @param card nsIAbCard - the adress book card 
 * @param email String - the email of the current account
 * @param format String - the format to use (Xml|VCard)
 * @param fields com.synckolab.database - a hashmap holding all the extra fields not in the card structure
 */
com.synckolab.addressbookTools.card2Message = function (card, email, format, fields) {
	// it may be we do not have a uid - skip it then
	if (this.getUID(card) === null || this.getUID(card).length < 2) {
		return null;
	}

	com.synckolab.tools.logMessage("creating message out of card... ", this.global.LOG_INFO + this.global.LOG_AB);

	// for the kolab xml format
	if (format === "Xml") {
		// mailing list
		if (card.isMailList) {
			return com.synckolab.tools.generateMail(this.getUID(card), email, "", "application/x-vnd.kolab.contact.distlist", true, com.synckolab.tools.text.utf8.encode(this.list2Xml(card, fields)), this.list2Human(card));
		} else {
			return com.synckolab.tools.generateMail(this.getUID(card), email, "", "application/x-vnd.kolab.contact", true, com.synckolab.tools.text.utf8.encode(this.card2Xml(card, fields)), this.card2Human(card), this.getCardProperty(card, "PhotoName"));
		}
	}

	if (card.isMailList) {
		return com.synckolab.tools.generateMail(this.getUID(card), email, "vCard", "text/x-vcard.list", false, com.synckolab.tools.text.utf8.encode(this.list2Vcard(card, fields)), null);
	}

	return com.synckolab.tools.generateMail(this.getUID(card), email, "vCard", "text/vcard", false, com.synckolab.tools.text.utf8.encode(this.card2Vcard(card, fields)), null);

	/*
	return com.synckolab.tools.generateMail(this.getUID(card), email, "vCard", "text/vcard", 
			false, decodeURIComponent(card.translateTo("vcard")), null);
			- this works kinda... some fields ar emissing and others are wrong named in order to be compatible with kolab
	*/

};

/*
 * Replaces any ; or : with their equivalent char codes since these are reserved characters in vcard spec
 */
com.synckolab.addressbookTools.encodeCardField = function (fieldValue) {
	var safeStr;
	safeStr = fieldValue.replace(/\=/g, "=3D");
	safeStr = fieldValue.replace(/:/g, "=3A");
	return safeStr.replace(/;/g, "=3B");
};

/*
 * Decodes a string encoded by encodeCardField
 */
com.synckolab.addressbookTools.decodeCardField = function (fieldValue) {
	var unsafeStr;
	unsafeStr = fieldValue.replace(/\=3A/g, ":");
	unsafeStr = fieldValue.replace(/\=3D/g, "=");
	return unsafeStr.replace(/\=3B/g, ";");
};

//Returns an array of fields that are in conflict
com.synckolab.addressbookTools.contactConflictTest = function (serverCard, localCard) {
	var conflictArray = []; //conflictArray.length

	//Fields to look for
	//Fields to look for
	var fieldsArray = [
	// these are numbers
	"BirthYear", "BirthMonth", "BirthDay", "AnniversaryYear", "AnniversaryMonth", "AnniversaryDay",
	// now for stings
	"FirstName", "LastName", "DisplayName", "NickName", "PrimaryEmail", "SecondEmail", "AimScreenName", "PreferMailFormat", "WorkPhone", "HomePhone", "FaxNumber", "PagerNumber", "CellularNumber", "HomeAddress", "HomeAddress2", "HomeCity", "HomeState", "HomeZipCode", "HomeCountry", "WebPage2",
			"JobTitle", "Department", "Company", "WorkAddress", "WorkAddress2", "WorkCity", "WorkState", "WorkZipCode", "WorkCountry", "WebPage1", "Custom1", "Custom2", "Custom3", "Custom4", "Notes"];
	// remember the numeric field
	var numericFieldCount = 6;

	for ( var i = 0; i < fieldsArray.length; i++) {
		var sa = this.getCardProperty(serverCard, fieldsArray[i]);
		var sb = this.getCardProperty(localCard, fieldsArray[i]);

		// empty field is the same as null
		// zero equals not set (so set to null) - for comparison only
		if (sa === '' || sa === 0) {
			sa = null;
		}
		if (sb === '' || sb === 0) {
			sb = null;
		}

		// in case the fields are below a certain limit they should be treated as numeric
		if (i < numericFieldCount) {
			if (sa) {
				sa = Number(sa);
			}
			if (sb) {
				sb = Number(sb);
			}
		}

		var conflict = false;

		// null check
		if (!sa || !sb) {
			if (!sa && !sb) {
				continue;
			}
			else {
				conflict = true;
			}
		}

		// check if not equals 
		if (conflict === false && sa !== sb) {
			// if we got strings... maybe they only differ in whitespace
			if (sa && sa.replace && sb && sb.replace) {
				// if they are equals without whitespace.. continue
				if (sa.replace(/\s|(\\n)| /g, "") === sb.replace(/\s|(\\n)| /g, "")) {
					continue;
				}
			}

			conflict = true;
		}

		if (conflict === true) {
			conflictArray.push(fieldsArray[i]);
		}
	}

	return conflictArray;
};