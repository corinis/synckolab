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

/*
 * A kinda "provider" class for syncing the address book.
 * The functions are called by the main synckolab loop to
 * create email content and called with email content (complete 
 * body) to generate add/update contacts in the address book.
 *  
 */
var syncAddressBook = {
	folderPath: '', // String - the path for the contacts
	serverKey: '', // the incoming server
	gSaveImap: true, // write back to folder

	gAddressBook: '', // the addressbook type nsIAbDirectory
	gCards: '', // remember the current card list
	folder: '', // the contact folder type nsIMsgFolder
	folderMsgURI: '', // the message uri
	format: 'VCard', // the format VCard/Xml
	folderMessageUids: '',
	
	dbFile: '', // the current sync database file
	db: '', // the current sync database 
	
	itemList: '', // display the currently processed item with status
	curItemInList: '', // the current item in the list (for updating the status)
	curItemInListId: '',
	curItemInListStatus: '',
	curItemInListContent: '',

	init: function(config) {
		var addressBookName;
		
		this.folderMessageUids = new Array(); // the checked uids - for better sync
		// initialize the configuration
		try 
		{
			var pref = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
			this.folderPath = pref.getCharPref("SyncKolab."+config+".ContactFolderPath");
			this.serverKey = pref.getCharPref("SyncKolab."+config+".ContactIncomingServer");
			addressBookName = pref.getCharPref("SyncKolab."+config+".AddressBook");
			this.format = pref.getCharPref("SyncKolab."+config+".AddressBookFormat");
			this.gSaveImap = pref.getBoolPref("SyncKolab."+config+".saveToContactImap");
			
			// since Imap savine does not work with xml - disable this
			//if (this.format == "Xml")
			//	this.gSaveImap = false;
		} catch(e) {
			return;
		}
		
		// get the rdf for the Addresbook list
		// for configuration
		var directory = rdf.GetResource("moz-abdirectory://").QueryInterface(Components.interfaces.nsIAbDirectory);
		
		var cn = directory.childNodes;
		var ABook = cn.getNext();
		
		this.gAddressBook = null;
		while (ABook != null)
		{
			var cur = ABook.QueryInterface(Components.interfaces.nsIAbDirectory);
			if (cur.directoryProperties.fileName == addressBookName)
			{
				this.gAddressBook = cur;
				break;
			}
			ABook = cn.getNext();
		}
		
		// we got the address book in gAddressBook
		
		// get the sync db
		this.dbFile = getHashDataBaseFile (config + ".con");
		this.db = readHashDataBase (this.dbFile);
	},

	
	/**
	 * parses the given content, if an update is required the 
	 * new message content is returned otherwise null
	 */	
	parseMessage: function(fileContent) {
		var cards = this.gAddressBook.childCards;
		
		var newCard = Components.classes["@mozilla.org/addressbook/cardproperty;1"].createInstance(Components.interfaces.nsIAbCard);
		
		// create a new item in the itemList for display
		this.curItemInList = document.createElement("listitem");
		this.curItemInListId = document.createElement("listcell");
		this.curItemInListStatus = document.createElement("listcell");
		this.curItemInListContent = document.createElement("listcell");
		this.curItemInListId.setAttribute("label", "unknown");
		this.curItemInListStatus.setAttribute("label", "parsing");
		this.curItemInListContent.setAttribute("label", "unknown");
		

		this.curItemInList.appendChild(this.curItemInListId);
		this.curItemInList.appendChild(this.curItemInListStatus);
		this.curItemInList.appendChild(this.curItemInListContent);
		
		this.itemList.appendChild(this.curItemInList);
		
		if (message2Card (fileContent, newCard, this.format))
		{
			// remember that we did this uid already
			this.folderMessageUids.push(newCard.custom4);
			consoleService.logStringMessage("got card from message: " + newCard.custom4);	

			// update list item
			this.curItemInListId.setAttribute("label", newCard.custom4);
			this.curItemInListStatus.setAttribute("label", "checking");
			this.curItemInListContent.setAttribute("label", newCard.firstName + " " + newCard.lastName + " <" + newCard.primaryEmail + ">");

			// ok lets see if we have this one already (remember custom4=UID)
			var acard = findCard (cards, newCard.custom4);
		
			// a new card or locally deleted 
			if (acard == null)
			{
				var cEntry = getDbEntry (newCard.custom4, this.db);
				if (cEntry == -1)
				{
					var curEntry = new Array();
					curEntry.push(newCard.custom4);
					curEntry.push(genConSha1(newCard));
					this.db.push(curEntry);
	
					this.gAddressBook.addCard (newCard);
					consoleService.logStringMessage("card is new, add to address book: " + newCard.custom4);	
					
					//update list item
					this.curItemInListStatus.setAttribute("label", "add local");
				}
				else
				{
					consoleService.logStringMessage("card deleted locally: " + newCard.custom4);	

					//update list item
					this.curItemInListStatus.setAttribute("label", "delete on server");
					return "DELETEME";
				}				
			}
			else
			{
				var cdb = getDbEntry (newCard.custom4, this.db);
				var lastSyncEntry = cdb!=-1?this.db[cdb][1]:null;
				var newSyncEntry = genConSha1 (newCard);
				var curSyncEntry = genConSha1 (acard);

				if (lastSyncEntry != null && lastSyncEntry != curSyncEntry && lastSyncEntry != newSyncEntry)
				{
					//local and server were both updated, ut oh, what do we want to do?
					consoleService.logStringMessage("Conflicts detected, opening resolution dialog.");
					
					//This function returns an array on conflicting fields
					var conflicts = contactConflictTest(newCard,acard);
										
					//If there were no conflicts found, skip dialog and update the local copy (Changes to the way the SHA are calculated could cause this)
					if ( conflicts.length > 0 ) {

						//Holds the users response, must be an object so that we can pass by reference
						conflictResolution = new Object();
						conflictResolution.result = 0;
    				
						//Open the contact conflict dialog
						var conflictDlg = window.openDialog("chrome://synckolab/content/contactConflictDialog.xul","conflictDlg","chrome,modal,resizable=1,width=600,height=400",conflicts,conflictResolution,newCard,acard);
						
						var bUpdateLocal = false;
						var bUpdateServer = false;
						switch ( conflictResolution.result ) {
							case 0 :
								//User clicked Cancel or X, we move to next record and user can deal with this issue on next sync
								this.curItemInListStatus.setAttribute("label", "Conflict : skipped");
								break;
							case 1 :
								//User chose to keep all server values
								bUpdateLocal = true;
								this.curItemInListStatus.setAttribute("label", "Conflict : local updated");
								break;
							case 2 :
								//User chose to keep all local values
								bUpdateServer = true;
								this.curItemInListStatus.setAttribute("label", "Conflict : server updated");
								break;
							case 3 :
								//User chose a mix of values, therefore, both local and server need updating
								
								//newCard and acard both already contain the new values
								bUpdateLocal = true;
								bUpdateServer = true;
								this.curItemInListStatus.setAttribute("label", "Conflict : both updated");
								break;
						}
					
					} else {
						//SHA values are different, however, no apparent differences
						//Changes to the way the SHA (code revisions) are calculated could cause this
						consoleService.logStringMessage("Sha values different, however, assumed no change, update local" + newCard.custom4);
						bUpdateLocal = true;
						this.curItemInListStatus.setAttribute("label", "Auto Conflict Resolved : update local");						
					}
					
					if ( bUpdateLocal ) {
						// Update local entry						
						
						// first delete the card 
						var list = Components.classes["@mozilla.org/supports-array;1"].createInstance(Components.interfaces.nsISupportsArray);
						list.AppendElement(acard);
						this.gAddressBook.deleteCards(list);
						
						// add the new one
						this.gAddressBook.addCard (newCard);
						var newdb = new Array();
						// regenerate internal db sha with possible changed values
						newdb.push(newCard.custom4);
						newdb.push(genConSha1 (newCard));

						this.db[cdb][0] = ""; // mark for delete
						
						this.db.push(newdb);
					}

					if ( bUpdateServer ) {
						// update on server - leave local alone
						return card2Message(acard, this.format);
					}
					return null; // Return null, we either updated nothing or updated only local
				}
				else
				// we got that already, see which to update
				if (lastSyncEntry == null || (lastSyncEntry == curSyncEntry && lastSyncEntry != newSyncEntry))
				{
				    consoleService.logStringMessage("server changed: " + acard.custom4);
					// server changed - update local
					var list = Components.classes["@mozilla.org/supports-array;1"].createInstance(Components.interfaces.nsISupportsArray);
					list.AppendElement(acard);
					this.gAddressBook.deleteCards(list);
					this.gAddressBook.addCard (newCard);
					var newdb = new Array();
					newdb.push(newCard.custom4);
					newdb.push(newSyncEntry);
					if (lastSyncEntry != null)
						this.db[cdb][0] = ""; // mark for delete
					this.db.push(newdb);

					// update list item
					this.curItemInListStatus.setAttribute("label", "update local");
					return null;
				}
				else
				if (lastSyncEntry != curSyncEntry && lastSyncEntry == newSyncEntry)
				{
				    consoleService.logStringMessage("client changed: " + acard.custom4);

					// update list item
					this.curItemInListStatus.setAttribute("label", "update server");
					
					// remember this message for update
					return card2Message(acard, this.format);
				}
				
				this.curItemInListStatus.setAttribute("label", "no change");
				
			}
		}
		else
				    consoleService.logStringMessage("unable to parse message, skipping");
		return null;
	},
	
	deleteList: "",

	initUpdate: function () {
		this.gCards = this.gAddressBook.childCards;
		this.deleteList = Components.classes["@mozilla.org/supports-array;1"]
							.createInstance(Components.interfaces.nsISupportsArray);		
		try
		{
			this.gCards.first();
		}
		catch (ex)
		{
			return false;
		}
		return true;
	},
	
	/**
	 * read the next card and return the content if we need an update
	 */
	nextUpdate: function () {
		var cur;
		// if there happens an exception, we are done
		try
		{
			cur = this.gCards.currentItem().QueryInterface(Components.interfaces.nsIAbCard);
		}
		catch (ext)
		{
			// we are done
			return "done";
		}
		
		var content = null;
		
    	var writeCur = false;
	    
		if (cur.custom4.length < 2)
		{
			// look at new card
			// generate a unique id (will random be enough for the future?)
			cur.custom4 = "pas-id-" + get_randomVcardId();
	    	consoleService.logStringMessage("adding unsaved card: " + cur.custom4);
			writeCur = true;
			cur.editCardToDatabase ("moz-abmdbdirectory://"+this.gAddressBook);
			// add the new card into the db
			var curSyncEntry = genConSha1 (cur);
			var newdb = new Array();
			newdb.push(cur.custom4);
			newdb.push(curSyncEntry);
			this.db.push(newdb);
			
			// create a new item in the itemList for display
			this.curItemInList = document.createElement("listitem");
			this.curItemInListId = document.createElement("listcell");
			this.curItemInListStatus = document.createElement("listcell");
			this.curItemInListContent = document.createElement("listcell");
			this.curItemInListId.setAttribute("label", cur.custom4);
			this.curItemInListStatus.setAttribute("label", "new add to server");
			this.curItemInListContent.setAttribute("label", cur.firstName + " " + cur.lastName + " <" + cur.primaryEmail + ">");
			
	
			this.curItemInList.appendChild(this.curItemInListId);
			this.curItemInList.appendChild(this.curItemInListStatus);
			this.curItemInList.appendChild(this.curItemInListContent);
			
			this.itemList.appendChild(this.curItemInList);
			
		}
		else
		{
			writeCur = true;
			// check if we have this uid in the messages
			for (var i = 0; i < this.folderMessageUids.length; i++)
			{
				if (cur.custom4 == this.folderMessageUids[i])
				{
					consoleService.logStringMessage("we got this card: " + cur.custom4);
					writeCur = false;
					break;
				}
			}

			// ok we should have this card in our db (since it has a custom4)
			// but not on the imap acct. if we got this entry in our internal db
			// it has been deleted on the server, and we dont know about it yet
			if (writeCur)
			{
				var curSyncEntry = genConSha1 (cur);
				var cdb = getDbEntry (cur.custom4, this.db);
				if (cdb != -1)
				{
					writeCur = false;
					this.db[cdb][0] = ""; // mark for delete
					this.deleteList.AppendElement(cur);

					
					// create a new item in the itemList for display
					this.curItemInList = document.createElement("listitem");
					this.curItemInListId = document.createElement("listcell");
					this.curItemInListStatus = document.createElement("listcell");
					this.curItemInListContent = document.createElement("listcell");
					this.curItemInListId.setAttribute("label", cur.custom4);
					this.curItemInListStatus.setAttribute("label", "local delete");
					this.curItemInListContent.setAttribute("label", cur.firstName + " " + cur.lastName + " <" + cur.primaryEmail + ">");
					
			
					this.curItemInList.appendChild(this.curItemInListId);
					this.curItemInList.appendChild(this.curItemInListStatus);
					this.curItemInList.appendChild(this.curItemInListContent);
					
					this.itemList.appendChild(this.curItemInList);

				}
				// ok its NOT in our internal db... add it
				else
				{
					var newdb = new Array();
					newdb.push(cur.custom4);
					newdb.push(curSyncEntry);
					this.db.push(newdb);
					// create a new item in the itemList for display
					this.curItemInList = document.createElement("listitem");
					this.curItemInListId = document.createElement("listcell");
					this.curItemInListStatus = document.createElement("listcell");
					this.curItemInListContent = document.createElement("listcell");
					this.curItemInListId.setAttribute("label", cur.custom4);
					this.curItemInListStatus.setAttribute("label", "add to server");
					this.curItemInListContent.setAttribute("label", cur.firstName + " " + cur.lastName + " <" + cur.primaryEmail + ">");
					
			
					this.curItemInList.appendChild(this.curItemInListId);
					this.curItemInList.appendChild(this.curItemInListStatus);
					this.curItemInList.appendChild(this.curItemInListContent);
					
					this.itemList.appendChild(this.curItemInList);
					
				}				
			}
		}
	
		if (writeCur)
		{
			// and write the message
			content = card2Message(cur, this.format);
	        consoleService.logStringMessage("New Card " + cur.custom4);
		}
	
		try
		{
			// select the next card
			this.gCards.next();
		}
		catch (ext)
		{
			// no next.. but we find that out early enough
		}
		
		// return the cards content
		return content;			
	},
	
	doneParsing: function ()
	{
		this.gAddressBook.deleteCards (this.deleteList);
		writeHashDataBase (this.dbFile, this.db);
	}
}
