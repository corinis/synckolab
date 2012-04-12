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
"use strict";

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
	gConflictResolve : "ask", // conflict resolution (default: ask what to do; other values: server, client)

	folderPath: '', // String - the path for the contacts
	serverKey: '', // the incoming server
	gSaveImap: true, // write back to folder
	gSync: true, // sync this configuration
	gConfig: null, // remember the configuration name
	gCurUID: '', // save the last checked uid - for external use

	gCards: '', // remember the current card list 
	gCardDB: '', // hashmap for all the cards (faster than iterating on big numbers)
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

	/**
	 * add the address book specific configuration to the config object
	 * @param config the config object (name is already prefilled)
	 * @param pref a nsIPrefBranch for reading of the configuration 
	 */
	readConfig: function(config, pref) {
		com.synckolab.tools.logMessage("Reading Configuration:" + config.name, com.synckolab.global.LOG_WARNING);

		try 
		{
			config.sync = pref.getBoolPref("SyncKolab." + config.name + ".syncContacts");
			config.folderPath = pref.getCharPref("SyncKolab." + config.name + ".ContactFolderPath");
			
			config.addressBookName = pref.getCharPref("SyncKolab." + config.name + ".AddressBook");
			config.format = pref.getCharPref("SyncKolab." + config.name + ".AddressBookFormat");
			config.saveImap = pref.getBoolPref("SyncKolab." + config.name + ".saveToContactImap");
			config.useSyncListener = pref.getBoolPref("SyncKolab." + config.name + ".syncListenerContactImap");
		} catch (e) {
			return;
		}
		
		// get the rdf for the Addresbook list
		// the addressbook type nsIAbDirectory
		
		var cn = com.synckolab.addressbookTools.getABDirectory({
			getConfig: function(addressBokName) {
				// search through the configs  
				for(var j = 0; j < com.synckolab.main.syncConfigs.length; j++) {
					if(com.synckolab.main.syncConfigs[j]) {
						var curConfig = com.synckolab.main.syncConfigs[j];
						//com.synckolab.tools.logMessage("checking " + curConfig.contact.folderMsgURI + " vs. " + folder, com.synckolab.global.LOG_DEBUG);

						if(curConfig.contact && curConfig.contact.sync && curConfig.contact.useSyncListener) {
							if(curConfig.contact.addressBookName === addressBokName)
							{
								return curConfig.contact;
							}
						}
					}
				}
				
			},
			onItemAdded: function(parent, newCard) {
				if(!parent) {
					return;
				}
				// make sure not to parse messages while a full sync is running
				if(com.synckolab.global.running || com.synckolab.global.triggerRunning) {
					return;
				}

				var cConfig = this.getConfig(parent.dirName);
				if(!cConfig) {
					return;
				}
				
				newCard = newCard.QueryInterface(Components.interfaces.nsIAbCard);
				com.synckolab.tools.logMessage("trigger new card", com.synckolab.global.LOG_DEBUG + com.synckolab.global.LOG_AB);
				
				// get the dbfile from the local disk
				var cUID = null;
				
				cUID = com.synckolab.addressbookTools.getUID(newCard);
				if (!cUID) {
					// generate a unique id (will random be enough for the future?)
					cUID = "sk-vc-" + com.synckolab.tools.text.randomVcardId();
					com.synckolab.addressbookTools.setUID(newCard, cUID);
					// avoid loop
					com.synckolab.global.triggerRunning = true;
					cConfig.addressBook.modifyCard(newCard);
					com.synckolab.global.triggerRunning = false;
				}
				
				if (newCard.isMailList) {
					com.synckolab.tools.logMessage("adding unsaved list: " + cUID, com.synckolab.global.LOG_INFO + com.synckolab.global.LOG_AB);
				} else {
					com.synckolab.tools.logMessage("adding unsaved card: " + cUID, com.synckolab.global.LOG_INFO + com.synckolab.global.LOG_AB);
				}
				

				// and write the message
				var abcontent = com.synckolab.addressbookTools.card2Message(newCard, cConfig.email, cConfig.format);
				com.synckolab.tools.logMessage("New Card " + abcontent, com.synckolab.global.LOG_INFO + com.synckolab.global.LOG_AB);

				// get the dbfile from the local disk
				var idxEntry = com.synckolab.tools.file.getSyncDbFile(cConfig, cUID);
				// write the current content in the sync-db file (parse to json object first)
				com.synckolab.tools.writeSyncDBFile(idxEntry, com.synckolab.addressbookTools.parseMessageContent(com.synckolab.tools.stripMailHeader(abcontent)));

				com.synckolab.tools.logMessage("Writing card to imap" , com.synckolab.global.LOG_INFO + com.synckolab.global.LOG_AB);

				com.synckolab.main.writeImapMessage(abcontent, cConfig, 
				{
					OnProgress: function (progress, progressMax) {},
					OnStartCopy: function () { },
					SetMessageKey: function (key) {},
					OnStopCopy: function (status) { 
						com.synckolab.tools.logMessage("Finished writing contact entry to imap", com.synckolab.global.LOG_INFO + com.synckolab.global.LOG_AB);
					}
				});
				
			},
			onItemRemoved: function(parent, item) {
				if(!parent) {
					return;
				}
				// make sure not to parse messages while a full sync is running
				if(com.synckolab.global.running|| com.synckolab.global.triggerRunning) {
					return;
				}
				
				var curConfig = this.getConfig(parent.dirName);
				if(!curConfig) {
					return;
				}

				var cUID = com.synckolab.addressbookTools.getUID(item);
				// the item doesnt have an uuid - skip
				if(!cUID) {
					return;
				}

				// local delete triggers a FULL sync 
				com.synckolab.tools.logMessage("Trigger synckolab "+curConfig.name, com.synckolab.global.LOG_INFO);
				com.synckolab.main.forceConfig = curConfig.name;
				com.synckolab.main.forceConfigType = "contact";
				com.synckolab.main.sync("trigger", curConfig);
			},
			onItemPropertyChanged: function(item, prop, oldval, newval) {
				// make sure not to parse messages while a full sync is running
				if(com.synckolab.global.running || com.synckolab.global.triggerRunning) {
					return;
				}
				
				// local change triggers a full sync
				com.synckolab.tools.logMessage("item changed "+ item.directoryId, com.synckolab.global.LOG_INFO);
			}
		});
		var ABook = cn.getNext();
		config.addressBook = null;
		while (ABook)
		{
			var cur = ABook.QueryInterface(Components.interfaces.nsIAbDirectory);
			if (cur.dirName === config.addressBookName)
			{
				config.addressBook = cur;
				break;
			}
			if (cn.hasMoreElements())
			{
				ABook = cn.getNext();
			}
			else
			{
				alert("Unable to find adress book.. please reconfigure!");
				return;
			}
		}
		
		// uid -> filename database - main functions needs to know the name
		config.dbFile = com.synckolab.tools.file.getHashDataBaseFile(config + ".ab");
		
		// add a listener
	},

	init: function (config) {
		// shortcuts for some common used utils
		this.tools = com.synckolab.addressbookTools;
		
		this.forceServerCopy = false;
		this.forceLocalCopy = false;
		
		this.folderMessageUids = []; // the checked uids - for better sync
		
		// get the sync config
		this.gConfig = config;
		
		// clean out cardDb to avoid conflicts with autosync
		this.gConfig.cardDb = null;
		
		// a hashmap remembering all the cards - for faster use
		this.gCardDB = new com.synckolab.hashMap();
		
		// cache all the cards with the uid in the CardDB hashmap
		// fill the hashmap
		var lCards = this.gConfig.addressBook.childCards;
		var card = null;
		// read all cards
		while (lCards.hasMoreElements() && (card = lCards.getNext()))
		{
			// get the right interface
			card = card.QueryInterface(Components.interfaces.nsIAbCard);
			
			// create a UUID if it does not exist!
			var cUID = this.tools.getUID(card);
			if (cUID === null || cUID === "")
			{
				cUID = "sk-vc-" + com.synckolab.tools.text.randomVcardId();
				this.tools.setUID(card, cUID);
				this.gConfig.addressBook.modifyCard(card);
			}
			
			this.gCardDB.put(cUID, card);
		}
	},
	
	
	/**
	 * callback when a new message has arrived
	 */
	triggerParseAddMessage: function(message) {
		// parse the new message content
		var newCard = com.synckolab.addressbookTools.parseMessageContent(message.fileContent);
		
		// get the dbfile from the local disk
		var cUid = com.synckolab.addressbookTools.getUID(newCard);
		var idxEntry = com.synckolab.tools.file.getSyncDbFile(message.config, cUid);

		// write the pojo into a file for faster comparison in later sync
		com.synckolab.tools.writeSyncDBFile(idxEntry, newCard);
		
		com.synckolab.tools.logMessage("card is new, add to address book: " + cUid, com.synckolab.global.LOG_INFO + com.synckolab.global.LOG_AB);
		// convert to a thunderbird object and add to the address book 
		if (newCard.type === "maillist")
		{
			// add mailing lists - add list of currently added cards
			if(!message.config.cardDb) {
				message.config.cardDb = new com.synckolab.hashMap();
				var lCards = message.config.addressBook.childCards;
				var card = null;
				// read all cards
				while (lCards.hasMoreElements() && (card = lCards.getNext()))
				{
					// get the right interface
					card = card.QueryInterface(Components.interfaces.nsIAbCard);
					
					// create a UUID if it does not exist!
					var cUID = com.synckolab.addressbookTools.getUID(card);
					if (cUID === null || cUID === "")
					{
						cUID = "sk-vc-" + com.synckolab.tools.text.randomVcardId();
						com.synckolab.addressbookTools.setUID(card, cUID);
						message.config.addressBook.modifyCard(card);
					}
					
					message.config.cardDb.put(cUID, card);
				}
			}
			message.config.addressBook.addMailList(com.synckolab.addressbookTools.createTBirdObject(newCard, message.config.cardDb));
			// also add to the hash-database
			//this.gCardDB.put(this.tools.getUID(newCard), newCard);
		}
		else
		{
			// also copy the image
			var pNameA = com.synckolab.addressbookTools.getCardProperty(newCard, "PhotoName");
			if (pNameA && pNameA !== "" && pNameA !== "null")
			{
				// in case the copy failed - clear the photoname
				if (com.synckolab.addressbookTools.copyImage(pNameA) === false) {
					com.synckolab.addressbookTools.setCardProperty(newCard, "PhotoName", "");
				}
			}
			
			message.config.addressBook.addCard(com.synckolab.addressbookTools.createTBirdObject(newCard));
			// clean out old cardDb
			message.config.cardDb = null;
		}


	},

	/**
	 * callback when a message has been deleted which should contain a contact
	 */
	triggerParseDeleteMessage: function(message) {
		// parse the new message content
		var newCard = com.synckolab.addressbookTools.parseMessageContent(message.fileContent);
		
		// find the entry in the address book and remove it
		var cId = com.synckolab.addressbookTools.getUID(newCard);
		var cards = message.config.addressBook.childCards;
		var deleteList = Components.classes["@mozilla.org/array;1"].createInstance(Components.interfaces.nsIMutableArray);
		while (cards.hasMoreElements())
		{
			var cCard = cards.getNext().QueryInterface(Components.interfaces.nsIAbCard);
			if(com.synckolab.addressbookTools.getUID(cCard) === cId) {
				com.synckolab.tools.logMessage("found card to delete: " + cId, com.synckolab.global.LOG_DEBUG + com.synckolab.global.LOG_AB);
				deleteList.appendElement(cCard, false);
				break;
			}
		}
		
		try
		{
			message.config.addressBook.deleteCards(deleteList);
		}
		catch (e)
		{
			com.synckolab.tools.logMessage("unable to delete card: " + cId, com.synckolab.global.LOG_ERROR + com.synckolab.global.LOG_AB);
			return;
		}

		
		// get the dbfile from the local disk
		var idxEntry = com.synckolab.tools.file.getSyncDbFile(message.config, cId);
		if (idxEntry.exists()) {
			idxEntry.remove(true);
		}

		// also delete image
		var pNameA = com.synckolab.addressbookTools.getCardProperty(newCard, "PhotoName");
		if (pNameA && pNameA !== "" && pNameA !== "null")
		{
			// delete actual image
			var fileTo = Components.classes["@mozilla.org/file/directory_service;1"].getService(Components.interfaces.nsIProperties).get("ProfD", Components.interfaces.nsIFile);
			fileTo.append("Photos");
			if (!fileTo.exists()) {
				fileTo.create(1, parseInt("0775", 8));
			}

			// fix newName: we can have C:\ - file:// and more - remove all that and put it in the photos folder
			var newName = pNameA.replace(/[^A-Za-z0-9._ \-]/g, "");
			newName = newName.replace(/ /g, "_");

			// check if the file exists
			fileTo.append(newName);
			if(fileTo.exists()){
				fileTo.remove(true);
			}
		}

		com.synckolab.tools.logMessage("deleting card: " + cId, com.synckolab.global.LOG_INFO + com.synckolab.global.LOG_AB);
		
	},

	/**
	 * a callback function for synckolab.js - synckolab will only start with the sync when this returns true
	 * for abook: data getting is synchronous so not needed - calendar is a different story!
	 */
	dataReady: function () {
		return true;
	},
	/**
	 * Returns the number of cards in the adress book
	 */
	itemCount: function () {
		var cards = this.gConfig.addressBook.childCards;
		
		var i = 0;
		while (cards.hasMoreElements() && cards.getNext())
		{
			i++;
		}
		
		return i;
	},
	
	/**
	 * parses the given content, if an update is required the 
	 * new message content is returned otherwise null
	 */	
	parseMessage: function (fileContent, tmp, checkForLater) {
		
		if (checkForLater)
		{
			if (this.tools.isMailList(fileContent))
			{
				return "LATER";
			}
		}
		// the new card might be a card OR a directory
		var newCard = null;
		var pName;	// temp for photos
		
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
		
		if (this.itemList)
		{
			this.itemList.appendChild(this.curItemInList);
			com.synckolab.tools.scrollToBottom(this.itemList);
		}
				
		// parse the new item
		newCard = this.tools.parseMessageContent(fileContent);
		
		if (newCard && newCard.isMailList)
		{
			com.synckolab.tools.logMessage("got mailing list " + this.tools.getUID(newCard), com.synckolab.global.LOG_WARNING + com.synckolab.global.LOG_AB);
		}
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
			this.folderMessageUids.push(this.gCurUID);
			com.synckolab.tools.logMessage("got card from message: " + this.gCurUID, com.synckolab.global.LOG_DEBUG + com.synckolab.global.LOG_AB);

			// update list item
			this.curItemInListId.setAttribute("label", this.gCurUID);
			this.curItemInListStatus.setAttribute("label", com.synckolab.global.strBundle.getString("checking"));
			
			// since we disabled mailing list - wont come here
			if (newCard.type === "maillist") {
				this.curItemInListContent.setAttribute("label", com.synckolab.global.strBundle.getString("mailingList") + " " + this.tools.getCardProperty(newCard, "Name"));
			} else if (this.tools.getCardProperty(newCard, "DisplayName") !== "") {
				this.curItemInListContent.setAttribute("label", this.tools.getCardProperty(newCard, "DisplayName") + 
						" <" + this.tools.getCardProperty(newCard, "PrimaryEmail","---") + ">");
			} else {
				this.curItemInListContent.setAttribute("label", this.tools.getCardProperty(newCard, "FirstName") + " " + 
						this.tools.getCardProperty(newCard, "LastName") + 
						" <" + this.tools.getCardProperty(newCard, "PrimaryEmail","---") + ">");
			}

			// ok lets see if we have this one already
			var foundCard = this.gCardDB.get(this.gCurUID);

			// get the dbfile from the local disk
			var idxEntry = com.synckolab.tools.file.getSyncDbFile(this.gConfig, this.tools.getUID(newCard));
			com.synckolab.tools.logMessage("got entry from db: " + foundCard, com.synckolab.global.LOG_DEBUG + com.synckolab.global.LOG_AB);	

			// a new card or locally deleted 
			if (foundCard === null)
			{	
				// if the file does not exist and it is not found in the adress book -
				// we definitely have a new entry here - add it 
				// also do so if the forceLocalCopy flag is set (happens when you change the configuration)
				if (!idxEntry.exists() || this.forceLocalCopy)
				{
					// write the pojo into a file for faster comparison in later sync
					com.synckolab.tools.writeSyncDBFile(idxEntry, newCard);
					
					// convert to a thunderbird object and add to the address book 
					if (newCard.type === "maillist")
					{
						com.synckolab.tools.logMessage("list is new, add to address book: " + this.tools.getUID(newCard), com.synckolab.global.LOG_INFO + com.synckolab.global.LOG_AB);
						// add mailing lists- pass the gCardDB with its nsIAbCard
						this.gConfig.addressBook.addMailList(com.synckolab.addressbookTools.createTBirdObject(newCard, this.gCardDB));
						// also add to the hash-database
						this.gCardDB.put(this.tools.getUID(newCard), newCard);
					}
					else
					{
						com.synckolab.tools.logMessage("card is new, add to address book: " + this.tools.getUID(newCard), com.synckolab.global.LOG_INFO + com.synckolab.global.LOG_AB);
						// also copy the image
						var pNameA = this.tools.getCardProperty(newCard, "PhotoName");
						if (pNameA && pNameA !== "" && pNameA !== "null")
						{
							// in case the copy failed - clear the photoname
							if (this.tools.copyImage(pNameA) === false) {
								this.tools.setCardProperty(newCard, "PhotoName", "");
							}
						}
						
						var abCard = com.synckolab.addressbookTools.createTBirdObject(newCard);
						this.gConfig.addressBook.addCard(abCard);
						// also add to the hash-database
						this.gCardDB.put(this.tools.getUID(newCard), abCard);
					}
					
					//update list item
					this.curItemInListStatus.setAttribute("label", com.synckolab.global.strBundle.getString("localAdd"));
					// new card added - we are done
					return null;
				}
				else
				{
					com.synckolab.tools.logMessage("card deleted locally: " + this.tools.getUID(newCard), com.synckolab.global.LOG_INFO + com.synckolab.global.LOG_AB);	
					
					//update list item
					this.curItemInListStatus.setAttribute("label", com.synckolab.global.strBundle.getString("deleteOnServer"));
	
					try
					{
						// also remove the local db file since we deleted the contact
						idxEntry.remove(false);
					}
					catch (deleidxEntry)
					{ // ignore this - if the file does not exist
					}
					
					// make sure to delete the message
					return "DELETEME";
				}
			}
			else
			// this card is already in the address book
			{
				// read the current card from the sync db (might be null)
				var cCard = com.synckolab.tools.readSyncDBFile(idxEntry);
				
				var cCard_equals_foundCard, cCard_equals_newCard, foundCard_equals_newCard;
				
				// Streamline card comparisons
				if (this.tools.equalsContact(cCard, foundCard)) {
					cCard_equals_foundCard = true;
					com.synckolab.tools.logMessage("In parse Message in addressbook.js cCard equals foundCard", com.synckolab.global.LOG_DEBUG);
				} else {
					cCard_equals_foundCard = false;
					com.synckolab.tools.logMessage("In parse Message in addressbook.js cCard NOT EQUALS foundCard\n ", com.synckolab.global.LOG_DEBUG);
				}
				
				if (this.tools.equalsContact(cCard, newCard)) {
					cCard_equals_newCard = true;
					com.synckolab.tools.logMessage("In parse Message in addressbook.js cCard equals newCard", com.synckolab.global.LOG_DEBUG);
				} else {
					cCard_equals_newCard = false;
					com.synckolab.tools.logMessage("In parse Message in addressbook.js cCard DOES NOT equal newCard", com.synckolab.global.LOG_DEBUG);
				}

				if (this.tools.equalsContact(foundCard, newCard)) {
					foundCard_equals_newCard = true;
					com.synckolab.tools.logMessage("In parse Message in addressbook.js foundCard equals newCard", com.synckolab.global.LOG_DEBUG);
				} else {
					foundCard_equals_newCard = false;
					com.synckolab.tools.logMessage("In parse Message in addressbook.js foundCard DOES NOT equal newCard", com.synckolab.global.LOG_DEBUG);
				}
				
				// compare each card with each other
				if (idxEntry.exists() && !cCard_equals_foundCard && !cCard_equals_newCard)
				{
					//local and server were both updated, ut oh, what do we want to do?
					com.synckolab.tools.logMessage("Conflicts detected, testing for autoresolve.", com.synckolab.global.LOG_WARNING + com.synckolab.global.LOG_AB);
					
					//	This function returns an array on conflicting fields
					var conflicts = com.synckolab.addressbookTools.contactConflictTest(newCard, foundCard);
					var bUpdateLocal = false;
					var bUpdateServer = false;

					//If there were no conflicts found, skip dialog and update the local copy (Changes to the way the SHA are calculated could cause this)
					if (conflicts.length > 0) {
						com.synckolab.tools.logMessage("Conflicts length is greater than 0.", com.synckolab.global.LOG_DEBUG + com.synckolab.global.LOG_AB);
						
						//Holds the users response, must be an object so that we can pass by reference
						var conflictResolution = {};
						conflictResolution.result = 0;

						//Open the contact conflict dialog
						switch (this.gConflictResolve) {
						case 'server':
							conflictResolution.result = 1;
							break;

						case 'client':
							conflictResolution.result = 2;
							break;

						default:
							conflictResolution.result = 0;
							var conflictDlg = window.openDialog("chrome://synckolab/content/contactConflictDialog.xul",
									"conflictDlg",
									"chrome,modal,resizable=1,width=600,height=400",
									conflicts,
									conflictResolution,
									newCard, foundCard);
							break;
						}
						 
						
						switch (conflictResolution.result) {
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

							//newCard and foundCard both already contain the new values
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
					
					if (bUpdateLocal) {
						// Update local entry
						var ulDelList = null;
						// first delete the card 
						ulDelList = Components.classes["@mozilla.org/array;1"].createInstance(Components.interfaces.nsIMutableArray);
						ulDelList.appendElement(foundCard, false);

						try
						{
							this.gConfig.addressBook.deleteCards(ulDelList);

							// also copy the image
							pName = this.tools.getCardProperty(newCard, "PhotoName");
							if (pName && pName !== "" && pName !== "null")
							{
								// in case the copy failed - clear the photoname
								if (this.tools.copyImage(pName) === false) {
									this.tools.setCardProperty(newCard, "PhotoName", "");
								}
							}
							
							// add the new one
							this.gConfig.addressBook.addCard(com.synckolab.addressbookTools.createTBirdObject(newCard));
						}
						catch (de)
						{
							com.synckolab.tools.logMessage("problem with local update for - skipping" + this.tools.getUID(foundCard), com.synckolab.global.LOG_WARNING + com.synckolab.global.LOG_AB);
						}
						
						// write the current content in the sync-db file
						com.synckolab.tools.writeSyncDBFile(idxEntry, newCard);
					}

					if (bUpdateServer) {
						// update on server
						var abcontent = this.tools.card2Message(foundCard, this.gConfig.email, this.gConfig.format);

						// write the current content in the sync-db file
						com.synckolab.tools.writeSyncDBFile(idxEntry, this.tools.parseMessageContent(com.synckolab.tools.stripMailHeader(abcontent)));
						return abcontent;
					}
					return null; // Return null, we either updated nothing or updated only local
				}
				else
				// we got that already, see which to update (server change if db == local != server) - or actually no change
				if (!idxEntry.exists() || (cCard_equals_foundCard && !cCard_equals_newCard))
				{
					if (!idxEntry.exists()) {
						com.synckolab.tools.logMessage("In parse Message in addressbook.js idxEntry does not exist", com.synckolab.global.LOG_DEBUG);
					}
					
					if(foundCard_equals_newCard){
						com.synckolab.tools.logMessage("no change, but sync file missing: " + this.tools.getUID(foundCard), com.synckolab.global.LOG_INFO + com.synckolab.global.LOG_AB);
					} else {
						com.synckolab.tools.logMessage("server changed: " + this.tools.getUID(foundCard), com.synckolab.global.LOG_INFO + com.synckolab.global.LOG_AB);
					}
					
					// server changed - update local
					if (foundCard.isMailList)
					{
						
						try
						{
							//var delMailListlist = Components.classes["@mozilla.org/array;1"].createInstance(Components.interfaces.nsIMutableArray);
							//delMailListlist.appendElement(foundCard, false);
							//this.gConfig.addressBook.deleteCards(delMailListlist);
							this.gConfig.addressBook.deleteDirectory(foundCard);
							this.gConfig.addressBook.addMailList(com.synckolab.addressbookTools.createTBirdObject(newCard, this.gCardDB));
						} catch (delMailList)
						{
							com.synckolab.tools.logMessage("problem with local update for - skipping" + this.tools.getUID(foundCard), com.synckolab.global.LOG_WARNING + com.synckolab.global.LOG_AB);
						}
					}
					else
					{
						var list = null;
						list = Components.classes["@mozilla.org/array;1"].createInstance(Components.interfaces.nsIMutableArray);
						list.appendElement(foundCard, false);
						
						try
						{
							this.gConfig.addressBook.deleteCards(list);

							// also copy the image
							pName = this.tools.getCardProperty(newCard, "PhotoName");
							if (pName && pName !== "" && pName !== "null")
							{
								// in case the copy failed - clear the photoname
								if (this.tools.copyImage(pName) === false) {
									this.tools.setCardProperty(newCard, "PhotoName", "");
								}
							}

							this.gConfig.addressBook.addCard(com.synckolab.addressbookTools.createTBirdObject(newCard));
						}
						catch (delocalUpdate)
						{
							com.synckolab.tools.logMessage("problem with local update for - skipping" + this.tools.getUID(foundCard), com.synckolab.global.LOG_WARNING + com.synckolab.global.LOG_AB);
						}
						
					}

					com.synckolab.tools.logMessage("write sync db " + this.tools.getUID(foundCard), com.synckolab.global.LOG_INFO + com.synckolab.global.LOG_AB);
					
					// write the current content in the sync-db file
					com.synckolab.tools.writeSyncDBFile(idxEntry, newCard);

					// update list item
					if(foundCard_equals_newCard){
						this.curItemInListStatus.setAttribute("label", com.synckolab.global.strBundle.getString("noChange"));
					}
					else {
						this.curItemInListStatus.setAttribute("label", com.synckolab.global.strBundle.getString("localUpdate"));
					}
					return null;
				}
				else
				// is the db file equals server, but not local.. we got a local change
				if (idxEntry.exists() && !cCard_equals_foundCard && cCard_equals_newCard)
				{
					com.synckolab.tools.logMessage("client changed " + this.tools.getUID(foundCard) + " - " + cCard.primaryEmail, com.synckolab.global.LOG_INFO + com.synckolab.global.LOG_AB);
					
					// update list item
					this.curItemInListStatus.setAttribute("label", com.synckolab.global.strBundle.getString("updateOnServer"));
					
					// remember this message for update - generate mail message (incl. extra fields)
					var abcontent = this.tools.card2Message(foundCard, this.gConfig.email, this.gConfig.format);
					// write the current content in the sync-db file
					com.synckolab.tools.writeSyncDBFile(idxEntry, this.tools.parseMessageContent(com.synckolab.tools.stripMailHeader(abcontent)));
					return abcontent;
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
		this.gCards = this.gConfig.addressBook.childCards;
		this.deleteList = Components.classes["@mozilla.org/array;1"].createInstance(Components.interfaces.nsIMutableArray);
		return true;
	},
	
	/**
	 * read the next card and return the content if we need an update
	 */
	nextUpdate: function () {
		var cur;
		// if there happens an exception, we are done
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
		
		var abcontent = null;
		var idxEntry = null;
		var curItem = cur;
		
		// mailing lists are nsIABDirectory
		
		if (cur.isMailList)
		{
			com.synckolab.tools.logMessage("Convert Mailing list to nsIABDirectory", com.synckolab.global.LOG_DEBUG + com.synckolab.global.LOG_AB);
			curItem = Components.classes["@mozilla.org/abmanager;1"].getService(Components.interfaces.nsIAbManager).getDirectory(cur.mailListURI);
		}
		
		// check for this entry
		if (this.tools.getUID(curItem) === null)
		{
			
			if (cur.isMailList)
			{
				try
				{
					// select the next card
					this.gCards.next();
				}
				catch (extMLCard)
				{
					// no next.. but we find that out early enough
				}
				// skip this one.. there simply ARE no valid mailing list without UID
				return null;
			}
			
			
			// look at new card
			// generate a unique id (will random be enough for the future?)
			com.synckolab.addressbookTools.setUID(curItem, "sk-vc-" + com.synckolab.tools.text.randomVcardId());
			if (cur.isMailList) {
				com.synckolab.tools.logMessage("adding unsaved list: " + this.tools.getUID(curItem), com.synckolab.global.LOG_INFO + com.synckolab.global.LOG_AB);
			} else {
				com.synckolab.tools.logMessage("adding unsaved card: " + this.tools.getUID(curItem), com.synckolab.global.LOG_INFO + com.synckolab.global.LOG_AB);
			}
			
			this.gConfig.addressBook.modifyCard(cur);
			
			// create a new item in the itemList for display
			this.curItemInList = this.doc.createElement("listitem");
			this.curItemInListId = this.doc.createElement("listcell");
			this.curItemInListStatus = this.doc.createElement("listcell");
			this.curItemInListContent = this.doc.createElement("listcell");
			this.curItemInListId.setAttribute("label", this.tools.getUID(curItem));
			this.curItemInListStatus.setAttribute("label", com.synckolab.global.strBundle.getString("addToServer"));
			if (curItem.isMailList) {
				this.curItemInListContent.setAttribute("label", com.synckolab.global.strBundle.getString("mailingList") + " " + this.tools.getCardProperty(curItem, "Name"));
			} else {
				this.curItemInListContent.setAttribute("label", cur.firstName + " " + curItem.lastName + " <" + curItem.primaryEmail + ">");
			}
			
	
			this.curItemInList.appendChild(this.curItemInListId);
			this.curItemInList.appendChild(this.curItemInListStatus);
			this.curItemInList.appendChild(this.curItemInListContent);
			
			if (this.itemList)
			{
				this.itemList.appendChild(this.curItemInList);
				com.synckolab.tools.scrollToBottom(this.itemList);
			}
			
			// and write the message
			abcontent = com.synckolab.addressbookTools.card2Message(curItem, this.gConfig.email, this.gConfig.format);
			com.synckolab.tools.logMessage("New Card " + this.tools.getUID(curItem), com.synckolab.global.LOG_INFO + com.synckolab.global.LOG_AB);

			// get the dbfile from the local disk
			idxEntry = com.synckolab.tools.file.getSyncDbFile(this.gConfig, this.tools.getUID(curItem));
			// write the current content in the sync-db file (parse to json object first)
			com.synckolab.tools.writeSyncDBFile(idxEntry, this.tools.parseMessage(com.synckolab.tools.stripMailHeader(abcontent)));
		}
		else
		{
			var alreadyProcessed = false;
			
			// check if we have this uid in the messages
			for (var i = 0; i < this.folderMessageUids.length; i++)
			{
				if (this.tools.getUID(curItem) === this.folderMessageUids[i] && this.tools.getUID(curItem))
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
				idxEntry = com.synckolab.tools.file.getSyncDbFile(this.gConfig, this.tools.getUID(curItem));
				if (this.tools.getUID(curItem) === null)
				{
					alert("UID is NULL???" + curItem.custom4);
				}
				
				if (idxEntry.exists() && !this.forceServerCopy)
				{
					
					if (!curItem.isMailList)
					{
						this.deleteList.appendElement(curItem, false);
					} else {
						// delete list
						this.gConfig.addressBook.deleteDirectory(curItem);
					}
					
					// create a new item in the itemList for display
					this.curItemInList = this.doc.createElement("listitem");
					this.curItemInListId = this.doc.createElement("listcell");
					this.curItemInListStatus = this.doc.createElement("listcell");
					this.curItemInListContent = this.doc.createElement("listcell");
					this.curItemInListId.setAttribute("label", this.tools.getUID(curItem));
					this.curItemInListStatus.setAttribute("label", com.synckolab.global.strBundle.getString("localDelete"));
					if (curItem.isMailList) {
						this.curItemInListContent.setAttribute("label", com.synckolab.global.strBundle.getString("mailingList") + " " + this.tools.getUID(curItem));
					} else {
						this.curItemInListContent.setAttribute("label", curItem.firstName + " " + curItem.lastName + " <" + curItem.primaryEmail + ">");
					}
			
					this.curItemInList.appendChild(this.curItemInListId);
					this.curItemInList.appendChild(this.curItemInListStatus);
					this.curItemInList.appendChild(this.curItemInListContent);
					
					if (this.itemList)
					{
						this.itemList.appendChild(this.curItemInList);
						com.synckolab.tools.scrollToBottom(this.itemList);
					}
					
					// also remove the local db file since we deleted the contact on the server
					idxEntry.remove(false);
					
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
					if (curItem.isMailList) {
						this.curItemInListContent.setAttribute("label", com.synckolab.global.strBundle.getString("mailingList") + " " + this.tools.getUID(curItem));
					} else {
						this.curItemInListContent.setAttribute("label", curItem.firstName + " " + curItem.lastName + " <" + curItem.primaryEmail + ">");
					}
					this.curItemInList.appendChild(this.curItemInListId);
					this.curItemInList.appendChild(this.curItemInListStatus);
					this.curItemInList.appendChild(this.curItemInListContent);
					
					if (this.itemList)
					{
						this.itemList.appendChild(this.curItemInList);
						com.synckolab.tools.scrollToBottom(this.itemList);
					}
					
					// and write the message
					abcontent = com.synckolab.addressbookTools.card2Message(curItem, this.gConfig.email, this.gConfig.format);
					com.synckolab.tools.logMessage("New Card " + this.tools.getUID(curItem), com.synckolab.global.LOG_INFO + com.synckolab.global.LOG_AB);
					
					// get the dbfile from the local disk
					idxEntry = com.synckolab.tools.file.getSyncDbFile(this.gConfig, this.tools.getUID(curItem));
					// write the current content in the sync-db file
					com.synckolab.tools.writeSyncDBFile(idxEntry, this.tools.parseMessageContent(com.synckolab.tools.stripMailHeader(abcontent)));
				}
			}
		}
	
		// return the cards content
		return abcontent;
	},
	
	doneParsing: function ()
	{
		try
		{
			this.gConfig.addressBook.deleteCards(this.deleteList);
		}
		catch (e)
		{
			// ignore
		}
	}
};
