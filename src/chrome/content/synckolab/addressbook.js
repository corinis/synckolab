// class to sync the address book
var syncAddressBook = {
	folderPath: '', // String - the path for the contacts
	serverKey: '', // the incoming server
	gSaveImap: true, // write back to folder

	gAddressBook: '', // the addressbook type nsIAbDirectory
	gCards: '', // remember the current card list
	folder: '', // the contact folder type nsIMsgFolder
	folderMsgURI: '', // the message uri
	folderMessageUids: '',

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
			this.gSaveImap = pref.getBoolPref("SyncKolab."+config+".saveToContactImap");
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
	},

	/**
	 * parses the given content, if an update is required the 
	 * new message content is returned otehrwise null
	 */	
	parseMessage: function(fileContent) {
		var cards = this.gAddressBook.childCards;
		
		var newCard = Components.classes["@mozilla.org/addressbook/cardproperty;1"].createInstance(Components.interfaces.nsIAbCard);	
		if (message2Card (fileContent, newCard))
		{
			// remember that we did this uid already
			this.folderMessageUids.push(newCard.custom4);
			
			// ok lets see if we have this one already (remember custom4=UID)
			var acard = findCard (cards, newCard.custom4);
		
			// a new card				
			if (acard == null)
			{
				this.gAddressBook.addCard (newCard);
			}
			else
			{
				// we got that already, see which is newer and update the message or the card
				if (newCard.lastModifiedDate > acard.lastModifiedDate)
				{
					var list = Components.classes["@mozilla.org/supports-array;1"].createInstance(Components.interfaces.nsISupportsArray);
					list.AppendElement(acard);
					this.gAddressBook.deleteCards(list);
					this.gAddressBook.addCard (newCard);
				}
				else
				if (newCard.lastModifiedDate < acard.lastModifiedDate)
				{
					// remember this message for update
					//updateMessagesCard.push(acard); 
					return card2Message(acard);
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
			content = card2Message(cur);
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
	}
	
	
}
