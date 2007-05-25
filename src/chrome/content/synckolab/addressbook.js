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
	gSync: true, // sync this configuration
	gConfig: '', // remember the configuration name
	gCurUID: '', // save the last checked uid - for external use

	gAddressBook: '', // the addressbook type nsIAbDirectory
	gCards: '', // remember the current card list
	folder: '', // the contact folder type nsIMsgFolder
	folderMsgURI: '', // the message uri
	format: 'VCard', // the format VCard/Xml
	folderMessageUids: '',
	
	email: '', // holds the account email
	name: '', // holds the account name
	
	itemList: '', // display the currently processed item with status
	curItemInList: '', // the current item in the list (for updating the status)
	curItemInListId: '',
	curItemInListStatus: '',
	curItemInListContent: '',
	
	forceServerCopy: false,
	forceLocalCopy: false,
	isCal: function() {
		return false
	},
	
	init: function(config) {
		var addressBookName;
		
		this.forceServerCopy = false;
		this.forceLocalCopy = false;
		
		this.folderMessageUids = new Array(); // the checked uids - for better sync
		// initialize the configuration
		try 
		{
			var pref = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
			this.folderPath = pref.getCharPref("SyncKolab."+config+".ContactFolderPath");
			this.serverKey = pref.getCharPref("SyncKolab."+config+".IncomingServer");
			addressBookName = pref.getCharPref("SyncKolab."+config+".AddressBook");
			this.format = pref.getCharPref("SyncKolab."+config+".AddressBookFormat");
			this.gSaveImap = pref.getBoolPref("SyncKolab."+config+".saveToContactImap");
			this.gSync = pref.getBoolPref("SyncKolab."+config+".syncContacts");
			
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
		
		// get the sync config
		this.gConfig = config;
	},

	/**
	 * Returns the number of cards in the adress book
	 */
	itemCount: function() {
		var cards = this.gAddressBook.childCards;
		var i = 0;
		
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
		return i;
	},
	
	/**
	 * parses the given content, if an update is required the 
	 * new message content is returned otherwise null
	 */	
	parseMessage: function(fileContent) {
		var cards = this.gAddressBook.childCards;
		
		// the new card might be a card OR a directory
		var newItem = null; 
		
		// create a new item in the itemList for display
		this.curItemInList = document.createElement("listitem");
		this.curItemInListId = document.createElement("listcell");
		this.curItemInListStatus = document.createElement("listcell");
		this.curItemInListContent = document.createElement("listcell");
		this.curItemInListId.setAttribute("label", strBundle.getString("unknown"));
		this.curItemInListStatus.setAttribute("label", strBundle.getString("parsing"));
		this.curItemInListContent.setAttribute("label", strBundle.getString("unknown"));
		

		this.curItemInList.appendChild(this.curItemInListId);
		this.curItemInList.appendChild(this.curItemInListStatus);
		this.curItemInList.appendChild(this.curItemInListContent);
		
		this.itemList.appendChild(this.curItemInList);
		
		// get the content in a nice format
		fileContent = stripMailHeader(fileContent);
		
		// this is an array of arrays that hold fieldname+fielddata of until-now-unknown fields
		var messageFields = new Array();		
		
		// parse the new item
		newItem = parseMessage(fileContent, messageFields, cards);
		
		newCard = newItem;
		/*
		if (newCard.isMailList)
		{
			var cur = newCard;
			alert("CUR INFO for " + getUID(newCard) +  "\n" + 
				"custom4? " + cur.custom4 + "\n" +
				"listNickName? " + cur.listNickName + "\n" +
				"content? " + cur.lastName + "\n" +
				"content? " + cur.nickName + "\n" +
				"description? " + cur.description + "\n" +
				"mailListURI? " + cur.mailListURI +
				""
				);
		}
		*/
		if (newCard) //message2Card (fileContent, newCard, messageFields)
		{
			// remember current uid
			this.gCurUID = getUID(newCard);
			
			// remember that we did this uid already
			this.folderMessageUids.push(getUID(newCard));
			logMessage("got card from message: " + getUID(newCard), LOG_DEBUG + LOG_AB);	

			// update list item
			this.curItemInListId.setAttribute("label", getUID(newCard));
			this.curItemInListStatus.setAttribute("label", strBundle.getString("checking"));
			if (newCard.isMailList)
				this.curItemInListContent.setAttribute("label", strBundle.getString("mailingList") + " " + newCard.listNickName);
			else
				this.curItemInListContent.setAttribute("label", newCard.firstName + " " + newCard.lastName + " <" + newCard.primaryEmail + ">");

			// ok lets see if we have this one already (remember custom4=UID except for mailing list)
			var aCard = findCard (cards, getUID(newCard), this.gAddressBook);

			// get the dbfile from the local disk
			var cEntry = getSyncDbFile	(this.gConfig, false, getUID(newCard));
			// ... and the field file
			var fEntry = getSyncFieldFile(this.gConfig, false, getUID(newCard));

			// a new card or locally deleted 
			if (aCard == null)
			{				
				// if the file does not exist and it is not found in the adress book -
				// we definitely have a new player here - add it 
				// also do so if the forceLocalCopy flag is set (happens when you change the configuration)
				if (!cEntry.exists() || this.forceLocalCopy)
				{
					// use the original content to write the snyc file 
					// this makes it easier to compare later on and makes sure no info is 
					// lost/changed
					writeSyncDBFile (cEntry, fileContent);
					
					// also write the extra fields in a file
					if (messageFields.length > 0)
						writeDataBase(fEntry, messageFields);

					if (newCard.isMailList)
						this.gAddressBook.addMailList(newCard);
					else					
						this.gAddressBook.addCard (newCard);
						
					logMessage("card is new, add to address book: " + getUID(newCard), LOG_INFO + LOG_AB);	
					
					//update list item
					this.curItemInListStatus.setAttribute("label", strBundle.getString("localAdd"));
					
				}
				else
				{
					logMessage("card deleted locally: " + getUID(newCard), LOG_INFO + LOG_AB);	
					
					//update list item
					this.curItemInListStatus.setAttribute("label", strBundle.getString("deleteOnServer"));
	
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
			// this card is already in the adress book
			{
				// make sure to ONLY read the info.. do not get the extra fields from there
				var cCard = parseMessage(readSyncDBFile(cEntry), null, cards);
				
				// compare each card with each other
				if (cEntry.exists() && !equalsContact(cCard, aCard) && !equalsContact(cCard, newCard) )
				{
					//local and server were both updated, ut oh, what do we want to do?
					logMessage("Conflicts detected, testing for autoresolve.", LOG_WARNING + LOG_AB);
					
					//	This function returns an array on conflicting fields
					var conflicts = contactConflictTest(newCard,aCard);
										
					//If there were no conflicts found, skip dialog and update the local copy (Changes to the way the SHA are calculated could cause this)
					if ( conflicts.length > 0 ) {

						//Holds the users response, must be an object so that we can pass by reference
						conflictResolution = new Object();
						conflictResolution.result = 0;
    				
						//Open the contact conflict dialog
						var conflictDlg = window.openDialog("chrome://synckolab/content/contactConflictDialog.xul","conflictDlg","chrome,modal,resizable=1,width=600,height=400",conflicts,conflictResolution,newCard,aCard);
						
						var bUpdateLocal = false;
						var bUpdateServer = false;
						switch ( conflictResolution.result ) {
							case 0 :
								//User clicked Cancel or X, we move to next record and user can deal with this issue on next sync
								this.curItemInListStatus.setAttribute("label", strBundle.getString("conflict") + ": skipped");
								break;
							case 1 :
								//User chose to keep all server values
								bUpdateLocal = true;
								this.curItemInListStatus.setAttribute("label", strBundle.getString("conflict") + ": " + strBundle.getString("localUpdate"));
								break;
							case 2 :
								//User chose to keep all local values
								bUpdateServer = true;
								this.curItemInListStatus.setAttribute("label", strBundle.getString("conflict") + ": " + strBundle.getString("updateOnServer"));
								break;
							case 3 :
								//User chose a mix of values, therefore, both local and server need updating
								
								//newCard and aCard both already contain the new values
								bUpdateLocal = true;
								bUpdateServer = true;
								this.curItemInListStatus.setAttribute("label", strBundle.getString("conflict") + ": both updated");
								break;
						}
					
					} else {
						//cards values are different, however, no apparent differences
						//Changes to the way the SHA (code revisions) are calculated could cause this
						logMessage("Contacts differ, however, assumed no change, update local" + getUID(newCard), LOG_WARNING + LOG_AB);
						bUpdateLocal = true;
						this.curItemInListStatus.setAttribute("label", "Auto Conflict Resolved : " + strBundle.getString("localUpdate"));
					}
					
					if ( bUpdateLocal ) {
						// Update local entry						
						
						// first delete the card 
						var list = Components.classes["@mozilla.org/supports-array;1"].createInstance(Components.interfaces.nsISupportsArray);
						list.AppendElement(aCard);
						this.gAddressBook.deleteCards(list);
						
						// add the new one
						this.gAddressBook.addCard (newCard);
						
						// write the current content in the sync-db file
						writeSyncDBFile (cEntry, fileContent);
						// also write the extra fields in a file (or remove if nothing there)
						if (messageFields.length > 0)
							writeDataBase(fEntry, messageFields);						
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
						return card2Message(aCard, this.email, this.format);
					}
					return null; // Return null, we either updated nothing or updated only local
				}
				else
				// we got that already, see which to update (server change if db == local != server)
				if (!cEntry.exists() || (equalsContact(cCard, aCard) && !equalsContact(cCard, newCard)))
				{
				    logMessage("server changed: " + getUID(aCard), LOG_INFO + LOG_AB);
				    
					// server changed - update local
					if (aCard.isMailList)
					{
						this.gAddressBook.deleteDirectory(aCard);
						this.gAddressBook.addMailList(newCard);
					}
					else
					{
						var list = Components.classes["@mozilla.org/supports-array;1"].createInstance(Components.interfaces.nsISupportsArray);
						list.AppendElement(aCard);
						this.gAddressBook.deleteCards(list);
						this.gAddressBook.addCard (newCard);
					}
										
					// write the current content in the sync-db file
					writeSyncDBFile (cEntry, stripMailHeader(card2Message(newCard, this.email, this.format)));

					// also write the extra fields in a file (or remove if nothing there)
					if (messageFields.length > 0)
						writeDataBase(fEntry, messageFields);						
					else
					if (fEntry.exists())
						fEntry.remove(false);
					
					// update list item
					this.curItemInListStatus.setAttribute("label", strBundle.getString("localUpdate"));
					return null;
				}
				else
				// is the db file equals server, but not local.. we got a local change
				if (cEntry.exists() && !equalsContact(cCard, aCard) && equalsContact(cCard, newCard))
				{
				    logMessage("client changed: " + getUID(aCard), LOG_INFO + LOG_AB);
					
					// update list item
					this.curItemInListStatus.setAttribute("label", strBundle.getString("updateOnServer"));
					
					// remember this message for update - generate mail message
					var cContent = card2Message(aCard, this.email, this.format, fEntry);

					// write the current content in the sync-db file
					writeSyncDBFile (cEntry, stripMailHeader(cContent));
					
					return cContent;
				}
				
				this.curItemInListStatus.setAttribute("label", strBundle.getString("noChange"));
				
			}
		}
		else
		{
			this.curItemInListId.setAttribute("label", strBundle.getString("unparseable"));
			logMessage("unable to parse message, skipping", LOG_WARNING + LOG_AB);
		}
			
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
		
		curItem = cur;
		
		// mailing lists are nsIABDirectory 
		if (cur.isMailList)
		{
			var cn = this.gAddressBook.childNodes;
			var ABook = cn.getNext();
			while (ABook != null)
			{
				var ccur = ABook.QueryInterface(Components.interfaces.nsIAbDirectory);
				if (ccur.listNickName == cur.displayName)
				{
					curItem = ccur;
					break;
				}
				try
				{
					ABook = cn.getNext();
				}
				catch (ex)
				{
					// break out if we have a problem here
					break;
				}
			}
			
		}
		
		
		// check for this entry
		if (getUID (curItem) == null)
		{
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
				// skip this one.. there simply ARE no valid mailng list without UID
				return null;
			}
			
			// look at new card
			// generate a unique id (will random be enough for the future?)
			setUID(curItem, "pas-id-" + get_randomVcardId());
			if (cur.isMailList)
		    	logMessage("adding unsaved list: " + getUID (curItem), LOG_INFO + LOG_AB);
			else
		    	logMessage("adding unsaved card: " + getUID (curItem), LOG_INFO + LOG_AB);
			
			writeCur = true;
			cur.editCardToDatabase ("moz-abmdbdirectory://"+this.gAddressBook);
			
			// create a new item in the itemList for display
			this.curItemInList = document.createElement("listitem");
			this.curItemInListId = document.createElement("listcell");
			this.curItemInListStatus = document.createElement("listcell");
			this.curItemInListContent = document.createElement("listcell");
			this.curItemInListId.setAttribute("label", getUID(curItem));
			this.curItemInListStatus.setAttribute("label", strBundle.getString("addToServer"));
			if (curItem.isMailList)
				this.curItemInListContent.setAttribute("label", strBundle.getString("mailingList") + " " + getUID(curItem));
			else
				this.curItemInListContent.setAttribute("label", cur.firstName + " " + curItem.lastName + " <" + curItem.primaryEmail + ">");
			
	
			this.curItemInList.appendChild(this.curItemInListId);
			this.curItemInList.appendChild(this.curItemInListStatus);
			this.curItemInList.appendChild(this.curItemInListContent);
			
			this.itemList.appendChild(this.curItemInList);
			
			// and write the message
			content = card2Message(curItem, this.email, this.format);
	        logMessage("New Card " + getUID(curItem), 2);

			// get the dbfile from the local disk
			var cEntry = getSyncDbFile	(this.gConfig, false, getUID(curItem));
			// write the current content in the sync-db file
			writeSyncDBFile (cEntry, stripMailHeader(content));			
			
		}		
		else
		{
			var alreadyProcessed = false;
			// check if we have this uid in the messages
			for (var i = 0; i < this.folderMessageUids.length; i++)
			{
				if (getUID(curItem) == this.folderMessageUids[i] && getUID(curItem) != null)
				{
					logMessage("we got this contact already: " + getUID(curItem), LOG_DEBUG + LOG_AB);
					alreadyProcessed = true;
					break;
				}
			}

			// ok we should have this card in our db (since it has a custom4)
			// but not on the imap acct. if we got this entry in our internal db
			// it has been deleted on the server, and we dont know about it yet
			if (!alreadyProcessed)
			{
				// get the dbfile from the local disk
				var cEntry = getSyncDbFile	(this.gConfig, false, getUID(curItem));
				if (getUID(curItem) == null)
				{
					alert("UID is NULL???" + curItem.custom4);
				}
				
				if (cEntry.exists() && !this.forceServerCopy)
				{
					this.deleteList.AppendElement(curItem);
					
					// create a new item in the itemList for display
					this.curItemInList = document.createElement("listitem");
					this.curItemInListId = document.createElement("listcell");
					this.curItemInListStatus = document.createElement("listcell");
					this.curItemInListContent = document.createElement("listcell");
					this.curItemInListId.setAttribute("label", getUID(curItem));
					this.curItemInListStatus.setAttribute("label", strBundle.getString("localDelete"));
					if (curItem.isMailList)
						this.curItemInListContent.setAttribute("label", strBundle.getString("mailingList") + " " + getUID(curItem));
					else
						this.curItemInListContent.setAttribute("label", curItem.firstName + " " + curItem.lastName + " <" + curItem.primaryEmail + ">");
					
			
					this.curItemInList.appendChild(this.curItemInListId);
					this.curItemInList.appendChild(this.curItemInListStatus);
					this.curItemInList.appendChild(this.curItemInListContent);
					
					this.itemList.appendChild(this.curItemInList);
					
					// also remove the local db file since we deleted the contact on the server
					cEntry.remove(false);
					
				}
				// ok its NOT in our internal db... add it
				else
				{
					
					// create a new item in the itemList for display
					this.curItemInList = document.createElement("listitem");
					this.curItemInListId = document.createElement("listcell");
					this.curItemInListStatus = document.createElement("listcell");
					this.curItemInListContent = document.createElement("listcell");
					this.curItemInListId.setAttribute("label", getUID(curItem));
					this.curItemInListStatus.setAttribute("label", strBundle.getString("addToServer"));
					if (curItem.isMailList)
						this.curItemInListContent.setAttribute("label", strBundle.getString("mailingList") + " " + getUID(curItem));
					else
						this.curItemInListContent.setAttribute("label", curItem.firstName + " " + curItem.lastName + " <" + curItem.primaryEmail + ">");
					
					this.curItemInList.appendChild(this.curItemInListId);
					this.curItemInList.appendChild(this.curItemInListStatus);
					this.curItemInList.appendChild(this.curItemInListContent);
					
					this.itemList.appendChild(this.curItemInList);
					
					// and write the message
					content = card2Message(curItem, this.email, this.format);
					logMessage("New Card " + getUID(curItem), LOG_INFO + LOG_AB);
					
					// get the dbfile from the local disk
					var cEntry = getSyncDbFile	(this.gConfig, false, getUID(curItem));
					// write the current content in the sync-db file
					writeSyncDBFile (cEntry, stripMailHeader(content));			
				}				
			}
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
	}
}
