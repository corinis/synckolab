
function init() {
	var sCurFolder = "";
	var rdf = Components.classes["@mozilla.org/rdf/rdf-service;1"].getService(Components.interfaces.nsIRDFService);

	var directory = rdf.GetResource("moz-abdirectory://").QueryInterface(Components.interfaces.nsIAbDirectory);
	var pref = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
	var cn = directory.childNodes;
	var ABook = cn.getNext();
	
	var abList = document.getElementById("ab_URL");
	var abpopup = document.createElement("menupopup");
	abList.appendChild(abpopup);
	var ab = "";
	try {
		ab = pref.getCharPref("SyncKolab.AddressBook");
	}
	catch (ex) {}
	while (ABook != null)
	{
		var cur = ABook.QueryInterface(Components.interfaces.nsIAbDirectory);
		var abchild = document.createElement("menuitem");
		abpopup.appendChild(abchild);
		abchild.setAttribute("label", cur.directoryProperties.description);
		abchild.setAttribute("value", cur.directoryProperties.fileName);
		if (cur.directoryProperties.fileName == ab)
		{
			abchild.setAttribute("selected", "true");
			abList.setAttribute("label", cur.directoryProperties.description);
			abList.setAttribute("value", cur.directoryProperties.fileName);
			
		}
		try
		{	
			ABook = cn.getNext();
		}
		catch (ex)
		{
			break;
		}
	}

	// get the mail account
	var actList = document.getElementById("imap_Acct");
	var actpopup = document.createElement("menupopup");
	actList.appendChild(actpopup);
	var act = "";
	try {
		act = pref.getCharPref("SyncKolab.IncomingServer");
	}
	catch (ex) {}

	try {
		sCurFolder = pref.getCharPref("SyncKolab.ContactFolderPath");
		document.getElementById ("saveToImap").checked = pref.getBoolPref("SyncKolab.saveToImap");
	} catch (ex) {}

	var gAccountManager = Components.classes['@mozilla.org/messenger/account-manager;1'].getService(Components.interfaces.nsIMsgAccountManager);
	for (var i = 0; i < gAccountManager.allServers.Count(); i++)
	{
		var account = gAccountManager.allServers.GetElementAt(i).QueryInterface(Components.interfaces.nsIMsgIncomingServer);

		var actchild = document.createElement("menuitem");
		actpopup.appendChild(actchild);
		actchild.setAttribute("label", account.prettyName);
		actchild.setAttribute("value", account.rootMsgFolder.baseMessageURI);
		if (account.rootMsgFolder.baseMessageURI == act)
		{
			actchild.setAttribute("selected", "true");
			actList.setAttribute("label", account.prettyName);
			actList.setAttribute("value", account.rootMsgFolder.baseMessageURI);
			// update the folder since we have a default acct
			updateFolder (account.rootMsgFolder.baseMessageURI);
			// select the element
			if (sCurFolder != "")
			{
				var tree= document.getElementById ("imap_Folder");
				var treei = tree.view.getIndexOfItem(document.getElementById(sCurFolder));
				tree.view.selection.select(treei); 
				tree.boxObject.scrollToRow(treei);
					
				
			}
		}
	}	
}

function updateFolder (act)
{
	// dynamically read this...
	
	var gAccountManager = Components.classes['@mozilla.org/messenger/account-manager;1'].getService(Components.interfaces.nsIMsgAccountManager);
	for (var i = 0; i < gAccountManager.allServers.Count(); i++)
	{
		var account = gAccountManager.allServers.GetElementAt(i).QueryInterface(Components.interfaces.nsIMsgIncomingServer);
		if (account.rootMsgFolder.baseMessageURI == act)
		{
			var cfold = document.getElementById ("imap_Folder");
			// delete the treechildren if exist
			var cnode = cfold.firstChild;
			while (cnode != null)
			{
				if (cnode.nodeName == "treechildren")
				{
					cfold.removeChild(cnode);
					break;
				}
				cnode = cnode.nextSibling;
			}
			

			// ok show some folders:
			var tChildren = document.createElement("treechildren");
			cfold.appendChild(tChildren);

			updateFolderElements (account.rootFolder, tChildren);
			return;			
			
		}
	}
}

function setFolder(uri)
{
	var pref = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
	pref.setCharPref("SyncKolab.ContactFolderPath", uri);
}

/**
 * updates the folder tree
 */
function updateFolderElements (msgFolder, root)
{
	var tItem = document.createElement("treeitem");
	root.appendChild(tItem);
	var tRow = document.createElement("treerow");
	tItem.appendChild(tRow);
	var tCell = document.createElement("treecell");
	tRow.appendChild(tCell);
	tItem.setAttribute("id", msgFolder.URI);
	tCell.setAttribute("label", msgFolder.prettyName);
	tCell.setAttribute("value", msgFolder.URI);
	/*
	if (sCurFolder == msgFolder.URI)
	{
		alert("selected");
		tCell.setAttribute("selected", "true");
	}
	*/
	
	if (msgFolder.hasSubFolders )
	{
		tItem.setAttribute("container", "true");
		tItem.setAttribute("open", "true");
		var tChildren = document.createElement("treechildren");
		tItem.appendChild(tChildren);
		//alert (msgFolder.prettyName);
		//alert (msgFolder.URI);
		
		var subfolders = msgFolder.GetSubFolders ();
		
		try
		{
			subfolders.first ();
		}
		catch (ex)
		{
			alert("NOTHING: " + msgFolder.prettyName);
			return;
		}
		while (subfolders != null)
		{
			var cur = subfolders.currentItem().QueryInterface(Components.interfaces.nsIMsgFolder);
			//alert(cur.URI);
			updateFolderElements (cur, tChildren);
			if (subfolders.isDone())
				break;
			try
			{
				subfolders.next();
			}
			catch (ex)
			{
				break;
			}
			
		}
		
		//alert (msgFolder.dBTransferInfo.NumMessages); 
		
	}
}


function savePrefs() {
	var pref = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
	pref.setCharPref("SyncKolab.IncomingServer", document.getElementById ("imap_Acct").value);
	pref.setCharPref("SyncKolab.AddressBook", document.getElementById ("ab_URL").value);
	pref.setBoolPref("SyncKolab.saveToImap", document.getElementById ("saveToImap").checked);
}
