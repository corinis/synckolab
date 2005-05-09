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
			if (this.format == "Xml")
				this.gSaveImap = false;
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
	 * new message content is returned otehrwise null
	 */	
	parseMessage: function(fileContent) {
		var cards = this.gAddressBook.childCards;
		
		var newCard = Components.classes["@mozilla.org/addressbook/cardproperty;1"].createInstance(Components.interfaces.nsIAbCard);	
		if (message2Card (fileContent, newCard, this.format))
		{
			// remember that we did this uid already
			this.folderMessageUids.push(newCard.custom4);
			
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
					db.push(curEntry);
	
					this.gAddressBook.addCard (newCard);
				}
				else
				{
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
					if (window.confirm("Changes were made on the server and local. Click ok to use the server version.\nClient card: " + 
						acard.displayName + "<"+ acard.defaultEmail + ">\nServer Card: " + newCard.displayName + "<"+ newCard.defaultEmail + ">"))
					{
						// server changed - update local
						var list = Components.classes["@mozilla.org/supports-array;1"].createInstance(Components.interfaces.nsISupportsArray);
						list.AppendElement(acard);
						this.gAddressBook.deleteCards(list);
						this.gAddressBook.addCard (newCard);
						var newdb = new Array();
						newdb.push(newCard.custom4);
						newdb.push(newSyncEntry);
						if (lastSyncEntry != null)
						{
							this.db[cdb][0] = ""; // mark for delete
						}
						this.db.push(newdb);
					}
					else
					{
						var newdb = new Array();
						newdb.push(acard.custom4);
						newdb.push(curSyncEntry);
						if (lastSyncEntry != null)
						{
							this.db[cdb][0] = ""; // mark for delete
						}
						this.db.push(newdb);
	
						// remember this message for update
						return card2Message(acard, this.format);
					}
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
					{
						this.db[cdb][0] = ""; // mark for delete
					}
					this.db.push(newdb);
				}
				else
				if (lastSyncEntry != curSyncEntry && lastSyncEntry == newSyncEntry)
				{
				    consoleService.logStringMessage("client changed: " + acard.custom4);
					var newdb = new Array();
					newdb.push(acard.custom4);
					newdb.push(curSyncEntry);
					if (lastSyncEntry != null)
					{
						this.db[cdb][0] = ""; // mark for delete
					}
					this.db.push(newdb);

					// remember this message for update
					return card2Message(acard, this.format);
				}
			}
		}
		return null;
	},

	initUpdate: function () {
		this.gCards = this.gAddressBook.childCards;
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
			// look a new card
			// generate a unique id (will random be enough for the future?)
			cur.custom4 = "pas-id-" + get_randomVcardId();
	    	consoleService.logStringMessage("adding unsaved card: " + cur.custom4);
			writeCur = true;
			cur.editCardToDatabase ("moz-abmdbdirectory://"+this.gAddressBook);
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
		}
	
		if (writeCur)
		{
			// and write the message
			content = card2Message(cur, this.format);
		        consoleService.logStringMessage("New Card [" + content + "]");
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
		writeHashDataBase (this.dbFile, this.db);
	}
}
