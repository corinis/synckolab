/* 
 ***** BEGIN LICENSE BLOCK ***** 
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
 *				Steven D Miller (Copart) <stevendm@rellims.com>
 *					
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
 * 
 ***** END LICENSE BLOCK ***** */

if(!com) var com={};
if(!com.synckolab) com.synckolab={};

/*
 * A kinda "provider" class for syncing the address book.
 * The functions are called by the main synckolab loop to
 * create email content and called with email content (complete 
 * body) to generate add/update contacts in the address book.
 *  
 */
com.synckolab.AddressBook = {
	isTbird2: true, // default: tbird 2 
	gConflictResolve : "ask", // conflict resolution (default: ask what to do; other values: server, client)

	folderPath: '', // String - the path for the contacts
	serverKey: '', // the incoming server
	gSaveImap: true, // write back to folder
	gSync: true, // sync this configuration
	gConfig: '', // remember the configuration name
	gCurUID: '', // save the last checked uid - for external use

	gAddressBook: '', // the addressbook type nsIAbDirectory
	gCards: '', // remember the current card list 
	gCardDB: '', // hashmap for all the cards (faster than iterating on big numbers)
	folder: '', // the contact folder type nsIMsgFolder
	folderMsgURI: '', // the message uri
	gSyncTimeFrame: 0, // time frame to take into account (for adress book always 0=all)
	format: 'VCard', // the format VCard/Xml
	folderMessageUids: '',
	
	email: '', // holds the account email
	name: '', // holds the account name
	
	doc: '', // this is the owning document
	itemList: '', // display the currently processed item with status
	curItemInList: '', // the current item in the list (for updating the status)
	curItemInListId: '',
	curItemInListStatus: '',
	curItemInListContent: '',

	dbFile: '', // the current sync database filen (a file with uid:size:date:localfile)
	
	forceServerCopy: false,
	forceLocalCopy: false,
	isCal: function() {
		return false;
	},

	// return tasks/calendar for correct foldernames
	getType: function() {
		return "contact";
	},

	init: function(config) {
		// shortcuts for some common used utils
		this.tools = com.synckolab.addressbookTools;
		
		
		var addressBookName;
		
		this.forceServerCopy = false;
		this.forceLocalCopy = false;
		
		this.folderMessageUids = new Array(); // the checked uids - for better sync
		
		// initialize the configuration
		try 
		{
			var pref = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
			this.gSync = pref.getBoolPref("SyncKolab."+config+".syncContacts");
			this.folderPath = pref.getCharPref("SyncKolab."+config+".ContactFolderPath");
			this.serverKey = pref.getCharPref("SyncKolab."+config+".IncomingServer");
			addressBookName = pref.getCharPref("SyncKolab."+config+".AddressBook");
			this.format = pref.getCharPref("SyncKolab."+config+".AddressBookFormat");
			this.gSaveImap = pref.getBoolPref("SyncKolab."+config+".saveToContactImap");
			try {
				this.gConflictResolve = pref.getCharPref("SyncKolab."+config+".Resolve");
			} catch (ignore) {};
		} catch(e) {
			return;
		}
		
		// get the rdf for the Addresbook list
		// for configuration
		var directory = com.synckolab.global.rdf.GetResource("moz-abdirectory://").QueryInterface(Components.interfaces.nsIAbDirectory);
		
		var cn = directory.childNodes;
		var ABook = cn.getNext();
		
		this.gAddressBook = null;
		while (ABook != null)
		{
			var cur = ABook.QueryInterface(Components.interfaces.nsIAbDirectory);
			// tbird < 3: use directoryProperties			
			if (cur.directoryProperties)
			{
				this.isTbird2 = true;
				if (cur.directoryProperties.fileName == addressBookName)
				{
					this.gAddressBook = cur;
					break;
				}
				if (cn.hasMoreElements())
					ABook = cn.getNext();
				else
				{
					alert("Unable to find adress book.. please reconfigure!");
					return;
				}
				
				continue;
			}
			else
			{
				this.isTbird2 = false;
				if (cur.dirName == addressBookName)
				{
					this.gAddressBook = cur;
					break;
				}
				if (cn.hasMoreElements())
					ABook = cn.getNext();
				else
				{
					alert("Unable to find adress book.. please reconfigure!");
					return;
				}
			}
		}
		
		// uid -> filename database - main functions needs to know the name
		this.dbFile = com.synckolab.tools.file.getHashDataBaseFile (config + ".ab");
		
		// get the sync config
		this.gConfig = config;
		
		// a hashmap remembering all the cards - for faster use
		this.gCardDB = new com.synckolab.hashMap();
		
		// cache all the cards with the uid in the CardDB hashmap
		// fill the hashmap
		var lCards = this.gAddressBook.childCards;
		// tbird 2 has nsIAbDirectory.Cards
		if (lCards == null)
			lCards = this.gAddressBook.Cards;
		if (lCards != null)
		{
			var card = null;
			// tbird 3 method:
			if (lCards.hasMoreElements)
				while (lCards.hasMoreElements() && (card = lCards.getNext ()) != null)
				{
					// get the right interface
					card = card.QueryInterface(Components.interfaces.nsIAbCard);
					
					// create a UUID if it does not exist!
					var cUID = this.tools.getUID(card);
					if (cUID == null || cUID == "" )
					{
						cUID = "sk-vc-" + com.synckolab.tools.text.randomVcardId();
						this.tools.setUID(card, cUID);
						this.gAddressBook.modifyCard(card);
					}
					
					this.gCardDB.put(cUID, card);
				}
			else
			//tbird 2
			{
				try {
					card = lCards.first();
					while ((card = lCards.currentItem ()) != null)
					{
						// get the right interface
						card = card.QueryInterface(Components.interfaces.nsIAbCard);
						// only save the cards that do have a custom4
						if (this.tools.getUID(card) != null && this.tools.getUID(card) != "" )
						{
							this.gCardDB.put(this.tools.getUID(card), card);
						}
							
						// cycle
						try
						{
							lCards.next();
						}
						catch (ex)
						{
							break;
						}		
					}
				}
				catch (ex)
				{
					com.synckolab.tools.logMessage("AB: Empty address book (exception on first)... ", com.synckolab.global.LOG_DEBUG);
				}
			}
		}
	},
	/**
	 * a callback function for synckolab.js - synckolab will only start with the sync when this returns true
	 * for abook: data getting is synchronous so not needed - calendar is a different story!
	 */
	dataReady: function() {
		return true;
	},
	/**
	 * Returns the number of cards in the adress book
	 */
	itemCount: function() {
		var cards = this.gAddressBook.childCards;
		// tbird 2
		if (cards == null)
			cards = this.gAddressBook.Cards;
		
		var i = 0;
		if (cards.hasMoreElements)
			while (cards.hasMoreElements() && cards.getNext())
				i++;
		// tbird 2
		else
		{
			try
			{
				cards.first();
			}
			catch (ex)
			{
				return 0;
			}
			
			while (cards.currentItem () != null)
			{
				i++;
					
				// cycle
				try
				{
					cards.next();
				}
				catch (ex)
				{
					return i;
				}
			}
		}
		
		return i;
	},
	
	/**
	 * parses the given content, if an update is required the 
	 * new message content is returned otherwise null
	 */	
	parseMessage: function(fileContent, tmp, checkForLater) {
		
		if (checkForLater)
		{
			if (this.tools.isMailList(fileContent))
				return "LATER";
		}
		// the new card might be a card OR a directory
		var newItem = null; 
		
		// create a new item in the itemList for display
		this.curItemInList = this.doc.createElement("listitem");
		this.curItemInListId = this.doc.createElement("listcell");
		this.curItemInListStatus = this.doc.createElement("listcell");
		this.curItemInListContent = this.doc.createElement("listcell");
		this.curItemInListId.setAttribute("label", com.synckolab.global.strBundle.getString("unknown"));
		this.curItemInListId.setAttribute("value", "-");
		this.curItemInListStatus.setAttribute("label", com.synckolab.global.strBundle.getString("parsing"));
		this.curItemInListStatus.setAttribute("value", "-");
		this.curItemInListContent.setAttribute("label", com.synckolab.global.strBundle.getString("unknown"));
		this.curItemInListContent.setAttribute("value", "-");
		
		this.curItemInList.appendChild(this.curItemInListId);
		this.curItemInList.appendChild(this.curItemInListStatus);
		this.curItemInList.appendChild(this.curItemInListContent);
		
		if (this.itemList != null)
		{
			this.itemList.appendChild(this.curItemInList);
			com.synckolab.tools.scrollToBottom();
		}
				
		// this is an array of arrays that hold fieldname+fielddata of until-now-unknown fields
		var messageFields = new com.synckolab.dataBase();
		
		// parse the new item
		newItem = this.tools.parseMessage(fileContent, messageFields, this.gCardDB);
		
		newCard = newItem;
		
		/*
		if (newCard && newCard.isMailList)
		{
			// skip mailing lists
			this.curItemInListContent.setAttribute("label", com.synckolab.global.strBundle.getString("mailingList") + " " + this.tools.getUID(newCard));
			this.curItemInListId.setAttribute("label", com.synckolab.global.strBundle.getString("noChange"));
			com.synckolab.tools.logMessage("skipping mailing lists!", com.synckolab.global.LOG_WARNING + com.synckolab.global.LOG_AB);
			return null;
		}
		*/
		if (newCard) 
		{
			// remember current uid
			this.gCurUID = this.tools.getUID(newCard);
			
			// remember that we did this uid already
			this.folderMessageUids.push(this.tools.getUID(newCard));
			com.synckolab.tools.logMessage("got card from message: " + this.tools.getUID(newCard), com.synckolab.global.LOG_DEBUG + com.synckolab.global.LOG_AB);

			// update list item
			this.curItemInListId.setAttribute("label", this.tools.getUID(newCard));
			this.curItemInListStatus.setAttribute("label", com.synckolab.global.strBundle.getString("checking"));
			// since we disabled mailing list - wont come here
			if (newCard.isMailList)
				this.curItemInListContent.setAttribute("label", com.synckolab.global.strBundle.getString("mailingList") + " " + this.tools.getCardProperty(newCard, "Name"));
			else
			if (newCard.displayName != "")
				this.curItemInListContent.setAttribute("label", newCard.displayName + " <" + newCard.primaryEmail + ">");
			else
				this.curItemInListContent.setAttribute("label", newCard.firstName + " " + newCard.lastName + " <" + newCard.primaryEmail + ">");

			// ok lets see if we have this one already (remember custom4=UID except for mailing list)
			var aCard = this.gCardDB.get(this.tools.getUID(newCard));
			com.synckolab.tools.logMessage("findCard.. done " , com.synckolab.global.LOG_DEBUG + com.synckolab.global.LOG_AB);	

			// get the dbfile from the local disk
			var cEntry = com.synckolab.tools.file.getSyncDbFile(this.gConfig, this.getType(), this.tools.getUID(newCard));
			// ... and the field file
			var fEntry = com.synckolab.tools.file.getSyncFieldFile(this.gConfig, this.getType(), this.tools.getUID(newCard));
			com.synckolab.tools.logMessage("get sync db and field file " , com.synckolab.global.LOG_DEBUG + com.synckolab.global.LOG_AB);	

			// a new card or locally deleted 
			if (aCard == null)
			{	
				// if the file does not exist and it is not found in the adress book -
				// we definitely have a new player here - add it 
				// also do so if the forceLocalCopy flag is set (happens when you change the configuration)
				if (!cEntry.exists() || this.forceLocalCopy)
				{
					// use the original content to write the sync file 
					// this makes it easier to compare later on and makes sure no info is 
					// lost/changed
					com.synckolab.tools.writeSyncDBFile (cEntry, fileContent);
					
					// also copy the image
					var pName = this.tools.getCardProperty(newCard, "PhotoName");
					if (pName != null && pName != "" && pName != "null")
					{
						// in case the copy failed - clear the photoname
						if(this.tools.copyImage(pName) == false)
							this.tools.setCardProperty(newCard, "PhotoName", "");
					}
					
					// also write the extra fields in a file
					if (messageFields.length() > 0)
						messageFields.write(fEntry);

					if (newCard.isMailList)
					{
						// skip mailing lists
						this.gAddressBook.addMailList(newCard);
						// also add to the hash-database
						this.gCardDB.put(this.tools.getUID(newCard), newCard);
					}
					else
					{
						this.gAddressBook.addCard (newCard);
						// also add to the hash-database
						this.gCardDB.put(this.tools.getUID(newCard), newCard);
					}
						
						
					com.synckolab.tools.logMessage("card is new, add to address book: " + this.tools.getUID(newCard), com.synckolab.global.LOG_INFO + com.synckolab.global.LOG_AB);	
					
					//update list item
					this.curItemInListStatus.setAttribute("label", com.synckolab.global.strBundle.getString("localAdd"));
					
				}
				else
				{
					com.synckolab.tools.logMessage("card deleted locally: " + this.tools.getUID(newCard), com.synckolab.global.LOG_INFO + com.synckolab.global.LOG_AB);	
					
					//update list item
					this.curItemInListStatus.setAttribute("label", com.synckolab.global.strBundle.getString("deleteOnServer"));
	
					try
					{
						// also remove the local db file since we deleted the contact
						cEntry.remove(false);
					}
					catch (dele)
					{ // ignore this - if the file does not exist
					}

					try
					{
						// delete extra file if we dont need it
						fEntry.remove(false);
					}
					catch (dele)
					{ // ignore this - if the file does not exist
					}
					
					return "DELETEME";
				}
			}
			else
			// this card is already in the address book
			{
				// make sure to ONLY read the info.. do not get the extra fields from there
				var cCard = this.tools.parseMessage(com.synckolab.tools.readSyncDBFile(cEntry), null, this.gCardDB);
				
				var cCard_equals_aCard, cCard_equals_newCard, aCard_equals_newCard;
				
				// Streamline card comparisons
				if (this.tools.equalsContact(cCard, aCard)) {
					cCard_equals_aCard = true;
					com.synckolab.tools.logMessage("In parse Message in addressbook.js cCard equals aCard", com.synckolab.global.LOG_DEBUG);
				} else {
					cCard_equals_aCard = false;
					com.synckolab.tools.logMessage("In parse Message in addressbook.js cCard DOES NOT equal aCard", com.synckolab.global.LOG_DEBUG);
				}
				
				if (this.tools.equalsContact(cCard, newCard)) {
					cCard_equals_newCard = true;
					com.synckolab.tools.logMessage("In parse Message in addressbook.js cCard equals newCard", com.synckolab.global.LOG_DEBUG);
				} else {
					cCard_equals_newCard = false;
					com.synckolab.tools.logMessage("In parse Message in addressbook.js cCard DOES NOT equal newCard", com.synckolab.global.LOG_DEBUG);
				}

				if (this.tools.equalsContact(aCard, newCard)) {
					aCard_equals_newCard = true;
					com.synckolab.tools.logMessage("In parse Message in addressbook.js aCard equals newCard", com.synckolab.global.LOG_DEBUG);
				} else {
					aCard_equals_newCard = false;
					com.synckolab.tools.logMessage("In parse Message in addressbook.js aCard DOES NOT equal newCard", com.synckolab.global.LOG_DEBUG);
				}
				
				// compare each card with each other
				if (cEntry.exists() && !cCard_equals_aCard && !cCard_equals_newCard )
				{
					//local and server were both updated, ut oh, what do we want to do?
					com.synckolab.tools.logMessage("Conflicts detected, testing for autoresolve.", com.synckolab.global.LOG_WARNING + com.synckolab.global.LOG_AB);
					
					//	This function returns an array on conflicting fields
					var conflicts = com.synckolab.addressbookTools.contactConflictTest(newCard,aCard);

					//If there were no conflicts found, skip dialog and update the local copy (Changes to the way the SHA are calculated could cause this)
					if ( conflicts.length > 0 ) {
						com.synckolab.tools.logMessage("Conflicts length is greater than 0.", com.synckolab.global.LOG_DEBUG + com.synckolab.global.LOG_AB);
						
						//Holds the users response, must be an object so that we can pass by reference
						conflictResolution = new Object();
						conflictResolution.result = 0;

						//Open the contact conflict dialog
						switch (this.gConflictResolve) {
							case 'server':
								conflictResolution.result = 1;
								break;
	
							case 'client':
								conflictResolution.result = 2;
								break;
	
							case 'ask':
							default:
								conflictResolution.result = 0;
							var conflictDlg = window.openDialog("chrome://synckolab/content/contactConflictDialog.xul","conflictDlg","chrome,modal,resizable=1,width=600,height=400",conflicts,conflictResolution,newCard,aCard);
							break;
						}
						 
						
						var bUpdateLocal = false;
						var bUpdateServer = false;
						switch ( conflictResolution.result ) {
							case 0 :
								//User clicked Cancel or X, we move to next record and user can deal with this issue on next sync
								this.curItemInListStatus.setAttribute("label", com.synckolab.global.strBundle.getString("conflict") + ": skipped");
								break;
							case 1 :
								//User chose to keep all server values
								bUpdateLocal = true;
								this.curItemInListStatus.setAttribute("label", com.synckolab.global.strBundle.getString("conflict") + ": " + com.synckolab.global.strBundle.getString("localUpdate"));
								break;
							case 2 :
								//User chose to keep all local values
								bUpdateServer = true;
								this.curItemInListStatus.setAttribute("label", com.synckolab.global.strBundle.getString("conflict") + ": " + com.synckolab.global.strBundle.getString("updateOnServer"));
								break;
							case 3 :
								//User chose a mix of values, therefore, both local and server need updating
								
								//newCard and aCard both already contain the new values
								bUpdateLocal = true;
								bUpdateServer = true;
								this.curItemInListStatus.setAttribute("label", com.synckolab.global.strBundle.getString("conflict") + ": both updated");
								break;
						}
					
					} else {
						//cards values are different, however, no apparent differences
						//Changes to the way the SHA (code revisions) are calculated could cause this
						com.synckolab.tools.logMessage("Contacts differ, however, assumed no change, update local" + this.tools.getUID(newCard), com.synckolab.global.LOG_WARNING + com.synckolab.global.LOG_AB);
						bUpdateLocal = true;
						this.curItemInListStatus.setAttribute("label", "Auto Conflict Resolved : " + com.synckolab.global.strBundle.getString("localUpdate"));
					}
					
					if ( bUpdateLocal ) {
						// Update local entry
						
						// first delete the card 
						if (this.isTbird2 == true)
						{
							list = Components.classes["@mozilla.org/supports-array;1"].createInstance(Components.interfaces.nsISupportsArray);
							list.AppendElement(aCard);
						}
						else
						// tbird 3
						{
							list = Components.classes["@mozilla.org/array;1"].createInstance(Components.interfaces.nsIMutableArray);
							list.appendElement(aCard, false);
						}

						try
						{
							this.gAddressBook.deleteCards(list);

							// also copy the image
							var pName = this.tools.getCardProperty(newCard, "PhotoName");
							if (pName != null && pName != "" && pName != "null")
							{
								// in case the copy failed - clear the photoname
								if(this.tools.copyImage(pName) == false)
									this.tools.setCardProperty(newCard, "PhotoName", "");
							}
							
							// add the new one
							this.gAddressBook.addCard (newCard);
						}
						catch (de)
						{
							com.synckolab.tools.logMessage("problem with local update for - skipping" + this.tools.getUID(aCard), com.synckolab.global.LOG_WARNING + com.synckolab.global.LOG_AB);
						}
						
						// write the current content in the sync-db file
						com.synckolab.tools.writeSyncDBFile (cEntry, fileContent);
						// also write the extra fields in a file (or remove if nothing there)
						if (messageFields.length() > 0)
							messageFields.write(fEntry);
						else
						{
							try
							{
								fEntry.remove(false);
							}
							catch (e) {}
						}
					}

					if ( bUpdateServer ) {
						// update on server - leave local alone
						return this.tools.card2Message(aCard, this.email, this.format);
					}
					return null; // Return null, we either updated nothing or updated only local
				}
				else
				// we got that already, see which to update (server change if db == local != server)
				if (!cEntry.exists() || (cCard_equals_aCard && !cCard_equals_newCard))
				{
					if (!cEntry.exists()) {
						com.synckolab.tools.logMessage("In parse Message in addressbook.js cEntry does not exist", com.synckolab.global.LOG_DEBUG);
					}
					
					com.synckolab.tools.logMessage("server changed: " + this.tools.getUID(aCard), com.synckolab.global.LOG_INFO + com.synckolab.global.LOG_AB);
					
					// server changed - update local
					if (aCard.isMailList)
					{
						var list = null;
						
						try
						{
							list = Components.classes["@mozilla.org/array;1"].createInstance(Components.interfaces.nsIMutableArray);
							list.appendElement(aCard, false);
							this.gAddressBook.deleteCards(list);
							//this.gAddressBook.deleteDirectory(aCard);
							this.gAddressBook.addMailList(newCard);
						} catch (de)
						{
							com.synckolab.tools.logMessage("problem with local update for - skipping" + this.tools.getUID(aCard), com.synckolab.global.LOG_WARNING + com.synckolab.global.LOG_AB);
						}
					}
					else
					{
						var list = null;
						// first delete the card 
						if (this.isTbird2 == true)
						{
							list = Components.classes["@mozilla.org/supports-array;1"].createInstance(Components.interfaces.nsISupportsArray);
							list.AppendElement(aCard);
						}
						else
						// tbird 3
						{
							list = Components.classes["@mozilla.org/array;1"].createInstance(Components.interfaces.nsIMutableArray);
							list.appendElement(aCard, false);
						}
						
						try
						{
							this.gAddressBook.deleteCards(list);

							// also copy the image
							var pName = this.tools.getCardProperty(newCard, "PhotoName");
							if (pName != null && pName != "" && pName != "null")
							{
								// in case the copy failed - clear the photoname
								if(this.tools.copyImage(pName) == false)
									this.tools.setCardProperty(newCard, "PhotoName", "");
							}

							this.gAddressBook.addCard (newCard);
						}
						catch (de)
						{
							com.synckolab.tools.logMessage("problem with local update for - skipping" + this.tools.getUID(aCard), com.synckolab.global.LOG_WARNING + com.synckolab.global.LOG_AB);
						}
						
					}

					com.synckolab.tools.logMessage("updated local " + this.tools.getUID(aCard), com.synckolab.global.LOG_INFO + com.synckolab.global.LOG_AB);
					
					// write the current content in the sync-db file
					//com.synckolab.tools.writeSyncDBFile (cEntry, com.synckolab.tools.stripMailHeader(this.tools.card2Message(newCard, this.email, this.format)));
					com.synckolab.tools.writeSyncDBFile (cEntry, fileContent);

					// also write the extra fields in a file (or remove if nothing there)
					if (messageFields.length() > 0)
						messageFields.write(fEntry);
					else
					if (fEntry.exists())
						fEntry.remove(false);
					
					// update list item
					this.curItemInListStatus.setAttribute("label", com.synckolab.global.strBundle.getString("localUpdate"));
					return null;
				}
				else
				// is the db file equals server, but not local.. we got a local change
					if (cEntry.exists() && !cCard_equals_aCard && cCard_equals_newCard)
				{
					com.synckolab.tools.logMessage("client changed " + this.tools.getUID(aCard) + " - " + cCard.primaryEmail, com.synckolab.global.LOG_INFO + com.synckolab.global.LOG_AB);
					
					// update list item
					this.curItemInListStatus.setAttribute("label", com.synckolab.global.strBundle.getString("updateOnServer"));
					
					// remember this message for update - generate mail message (incl. extra fields)
					this.messageFields = new com.synckolab.dataBase(fEntry);
					var cContent = this.tools.card2Message(aCard, this.email, this.format, messageFields);

					// write the current content in the sync-db file
					com.synckolab.tools.writeSyncDBFile (cEntry, com.synckolab.tools.stripMailHeader(cContent));
					
					return cContent;
				}
				
				this.curItemInListStatus.setAttribute("label", com.synckolab.global.strBundle.getString("noChange"));
				
			}
		}
		else
		{
			this.curItemInListId.setAttribute("label", com.synckolab.global.strBundle.getString("unparseable"));
			com.synckolab.tools.logMessage("unable to parse message, skipping", com.synckolab.global.LOG_WARNING + com.synckolab.global.LOG_AB);
		}
			
		return null;
	},
	
	deleteList: "",

	initUpdate: function () {
		this.gCards = this.gAddressBook.childCards;

		if (this.isTbird2 == true)
		{
			this.deleteList = Components.classes["@mozilla.org/supports-array;1"]
							.createInstance(Components.interfaces.nsISupportsArray);		
		}
		else
		// tbird 3
		{
			this.deleteList = Components.classes["@mozilla.org/array;1"].
					createInstance(Components.interfaces.nsIMutableArray);
		}


		// tbird 2
		if (!this.gCards.hasMoreElements)
		{
			try
			{
				this.gCards.first();
			}
			catch (ex)
			{
				return false;
			}
		}

		return true;
	},
	
	/**
	 * read the next card and return the content if we need an update
	 */
	nextUpdate: function () {
		var cur;
		// if there happens an exception, we are done
		if (this.gCards.hasMoreElements)
		{
			if (!this.gCards.hasMoreElements())
			{
				// we are done
				com.synckolab.tools.logMessage("Finished syncing adress book", com.synckolab.global.LOG_INFO + com.synckolab.global.LOG_AB);
				return "done";
			}
			
			try
			{
				cur = this.gCards.getNext().QueryInterface(Components.interfaces.nsIAbCard);
			}
			catch (ext)
			{
				// we are done
				com.synckolab.tools.logMessage("Bad - Finished syncing adress book", com.synckolab.global.LOG_INFO + com.synckolab.global.LOG_AB);
				return "done";
			}
		}
		// tbird 2
		else
		{
			try
			{
				cur = this.gCards.currentItem().QueryInterface(Components.interfaces.nsIAbCard);
			}
			catch (ext)
			{
				// we are done
				com.synckolab.tools.logMessage("Finished syncing adress book", com.synckolab.global.LOG_INFO + com.synckolab.global.LOG_AB);
				return "done";
			}
		}		
		var content = null;
		
		curItem = cur;
		
		// mailing lists are nsIABDirectory
		/*
		if (cur.isMailList)
		{
			com.synckolab.tools.logMessage("GOT A MAILING LIST!!! - skipping", com.synckolab.global.LOG_INFO + com.synckolab.global.LOG_AB);
			// tbird 2
			if (this.gCards.next)
			{
				try
				{
					// select the next card
					this.gCards.next();
				}
				catch (ext)
				{
					// no next.. but we find that out early enough
				}
			}
			return null;
		}
		*/
		
		
		// check for this entry
		if (this.tools.getUID (curItem) == null)
		{
			/*
			if (cur.isMailList)
			{
				try
				{
					// select the next card
					this.gCards.next();
				}
				catch (ext)
				{
					// no next.. but we find that out early enough
				}
				// skip this one.. there simply ARE no valid mailing list without UID
				return null;
			}
			*/
			
			// look at new card
			// generate a unique id (will random be enough for the future?)
			com.synckolab.addressbookTools.setUID(curItem, "sk-vc-" + com.synckolab.tools.text.randomVcardId());
			if (cur.isMailList)
				com.synckolab.tools.logMessage("adding unsaved list: " + this.tools.getUID (curItem), com.synckolab.global.LOG_INFO + com.synckolab.global.LOG_AB);
			else
				com.synckolab.tools.logMessage("adding unsaved card: " + this.tools.getUID (curItem), com.synckolab.global.LOG_INFO + com.synckolab.global.LOG_AB);
			
			writeCur = true;
			// tbird<3
			if (cur.editCardToDatabase && !this.gAddressBook.modifyCard)
				cur.editCardToDatabase ("moz-abmdbdirectory://"+this.gAddressBook);
			else
				this.gAddressBook.modifyCard(cur);
			
			
			// create a new item in the itemList for display
			this.curItemInList = this.doc.createElement("listitem");
			this.curItemInListId = this.doc.createElement("listcell");
			this.curItemInListStatus = this.doc.createElement("listcell");
			this.curItemInListContent = this.doc.createElement("listcell");
			this.curItemInListId.setAttribute("label", this.tools.getUID(curItem));
			this.curItemInListStatus.setAttribute("label", com.synckolab.global.strBundle.getString("addToServer"));
			if (curItem.isMailList)
				this.curItemInListContent.setAttribute("label", com.synckolab.global.strBundle.getString("mailingList") + " " + this.tools.getCardProperty(curItem, "Name"));
			else
				this.curItemInListContent.setAttribute("label", cur.firstName + " " + curItem.lastName + " <" + curItem.primaryEmail + ">");
			
	
			this.curItemInList.appendChild(this.curItemInListId);
			this.curItemInList.appendChild(this.curItemInListStatus);
			this.curItemInList.appendChild(this.curItemInListContent);
			
			if (this.itemList != null)
			{
				this.itemList.appendChild(this.curItemInList);
				com.synckolab.tools.scrollToBottom();
			}
			
			// and write the message
			content = com.synckolab.addressbookTools.card2Message(curItem, this.email, this.format);
			com.synckolab.tools.logMessage("New Card " + this.tools.getUID(curItem), com.synckolab.global.LOG_INFO + com.synckolab.global.LOG_AB);

			// get the dbfile from the local disk
			var cEntry = com.synckolab.tools.file.getSyncDbFile (this.gConfig, this.getType(), this.tools.getUID(curItem));
			// write the current content in the sync-db file
			com.synckolab.tools.writeSyncDBFile (cEntry, com.synckolab.tools.stripMailHeader(content));
			
		}
		else
		{
			var alreadyProcessed = false;
			
			// check if we have this uid in the messages
			for (var i = 0; i < this.folderMessageUids.length; i++)
			{
				if (this.tools.getUID(curItem) == this.folderMessageUids[i] && this.tools.getUID(curItem) != null)
				{
					com.synckolab.tools.logMessage("we got this contact already: " + this.tools.getUID(curItem), com.synckolab.global.LOG_DEBUG + com.synckolab.global.LOG_AB);
					alreadyProcessed = true;
					break;
				}
			}

			// ok we should have this card in our db (since it has a custom4)
			// but not on the imap account. if we got this entry in our internal db
			// it has been deleted on the server, and we don't know about it yet
			if (!alreadyProcessed)
			{
				// get the dbfile from the local disk
				var cEntry = com.synckolab.tools.file.getSyncDbFile	(this.gConfig, this.getType(), this.tools.getUID(curItem));
				if (this.tools.getUID(curItem) == null)
				{
					alert("UID is NULL???" + curItem.custom4);
				}
				
				if (cEntry.exists() && !this.forceServerCopy)
				{
					// TODO: do not delte list for now..
					if (! curItem.isMailList)
					{
						if (this.isTbird2 == true)
							this.deleteList.AppendElement(curItem);
						else
						// tbird 3
							this.deleteList.appendElement(curItem, false);
					}
					// create a new item in the itemList for display
					this.curItemInList = this.doc.createElement("listitem");
					this.curItemInListId = this.doc.createElement("listcell");
					this.curItemInListStatus = this.doc.createElement("listcell");
					this.curItemInListContent = this.doc.createElement("listcell");
					this.curItemInListId.setAttribute("label", this.tools.getUID(curItem));
					this.curItemInListStatus.setAttribute("label", com.synckolab.global.strBundle.getString("localDelete"));
					if (curItem.isMailList)
						this.curItemInListContent.setAttribute("label", com.synckolab.global.strBundle.getString("mailingList") + " " + this.tools.getUID(curItem));
					else
						this.curItemInListContent.setAttribute("label", curItem.firstName + " " + curItem.lastName + " <" + curItem.primaryEmail + ">");
					
			
					this.curItemInList.appendChild(this.curItemInListId);
					this.curItemInList.appendChild(this.curItemInListStatus);
					this.curItemInList.appendChild(this.curItemInListContent);
					
					if (this.itemList != null)
					{
						this.itemList.appendChild(this.curItemInList);
						com.synckolab.tools.scrollToBottom();
					}
					
					// also remove the local db file since we deleted the contact on the server
					cEntry.remove(false);
					
				}
				// ok its NOT in our internal db... add it
				else
				{
					
					// create a new item in the itemList for display
					this.curItemInList = this.doc.createElement("listitem");
					this.curItemInListId = this.doc.createElement("listcell");
					this.curItemInListStatus = this.doc.createElement("listcell");
					this.curItemInListContent = this.doc.createElement("listcell");
					this.curItemInListId.setAttribute("label", this.tools.getUID(curItem));
					this.curItemInListStatus.setAttribute("label", com.synckolab.global.strBundle.getString("addToServer"));
					if (curItem.isMailList)
						this.curItemInListContent.setAttribute("label", com.synckolab.global.strBundle.getString("mailingList") + " " + this.tools.getUID(curItem));
					else
						this.curItemInListContent.setAttribute("label", curItem.firstName + " " + curItem.lastName + " <" + curItem.primaryEmail + ">");
					
					this.curItemInList.appendChild(this.curItemInListId);
					this.curItemInList.appendChild(this.curItemInListStatus);
					this.curItemInList.appendChild(this.curItemInListContent);
					
					if (this.itemList != null)
					{
						this.itemList.appendChild(this.curItemInList);
						com.synckolab.tools.scrollToBottom();
					}
					
					// and write the message
					content = com.synckolab.addressbookTools.card2Message(curItem, this.email, this.format);
					com.synckolab.tools.logMessage("New Card " + this.tools.getUID(curItem), com.synckolab.global.LOG_INFO + com.synckolab.global.LOG_AB);
					
					// get the dbfile from the local disk
					var cEntry = com.synckolab.tools.file.getSyncDbFile	(this.gConfig, this.getType(), this.tools.getUID(curItem));
					// write the current content in the sync-db file
					com.synckolab.tools.writeSyncDBFile (cEntry, com.synckolab.tools.stripMailHeader(content));
				}				
			}
		}
	
		// tbird 2
		if (this.gCards.next)
		{
			try
			{
				// select the next card
				this.gCards.next();
			}
			catch (ext)
			{
				// no next.. but we find that out early enough
			}
		}
				
		// return the cards content
		return content;
	},
	
	doneParsing: function ()
	{
		try
		{
			this.gAddressBook.deleteCards (this.deleteList);
		}
		catch (e)
		{
			// ignore
		}
	}
};
