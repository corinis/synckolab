function init() {
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
	
	try {
	document.getElementById ("imap_URL").value = pref.getCharPref("SyncKolab.ContactFolderPath");
	document.getElementById ("imap_Acct").value = pref.getCharPref("SyncKolab.IncomingServerKey");
	} catch (ex) {}
	
}

function savePrefs() {
	var pref = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
	pref.setCharPref("SyncKolab.ContactFolderPath", document.getElementById ("imap_URL").value);
	pref.setCharPref("SyncKolab.IncomingServerKey", document.getElementById ("imap_Acct").value);
	pref.setCharPref("SyncKolab.AddressBook", document.getElementById ("ab_URL").value);
}
