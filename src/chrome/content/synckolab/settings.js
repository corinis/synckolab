/*
include('chrome://synckolab/content/jslib/io/io.js');
include('chrome://synckolab/content/jslib/rdf/rdf.js');
include('chrome://synckolab/content/jslib/rdf/rdfFile.js');
*/
var isCalendar;

function init() {
	isCalendar = isCalendarAvailable ();
	
	var sCurFolder = "";
	var rdf = Components.classes["@mozilla.org/rdf/rdf-service;1"].getService(Components.interfaces.nsIRDFService);

	var directory = rdf.GetResource("moz-abdirectory://").QueryInterface(Components.interfaces.nsIAbDirectory);
	var pref = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);

	try {
		document.getElementById ("syncCon").checked = pref.getBoolPref("SyncKolab.syncContacts");
		document.getElementById ("syncCal").checked = pref.getBoolPref("SyncKolab.syncCalendar");
	} catch (ex) {}

	var cn = directory.childNodes;
	var ABook = cn.getNext();
	
	var abList = document.getElementById("conURL");
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
	var actList = document.getElementById("conImapAcct");
	var actpopup = document.createElement("menupopup");
	actList.appendChild(actpopup);
	var act = "";
	try {
		act = pref.getCharPref("SyncKolab.ContactIncomingServer");
	}
	catch (ex) {}

	try {
		sCurFolder = pref.getCharPref("SyncKolab.ContactFolderPath");
		document.getElementById ("saveToConImap").checked = pref.getBoolPref("SyncKolab.saveToContactImap");
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
				var tree= document.getElementById ("conImapFolder");
				var treei = tree.view.getIndexOfItem(document.getElementById(sCurFolder));
				tree.view.selection.select(treei); 
				tree.boxObject.scrollToRow(treei);
			}
		}
	}	
	
	// if we do not have a calendar, we can easily skip this
	if (isCalendar)
	{
		var abList = document.getElementById("calURL");
		var abpopup = document.createElement("menupopup");
	
		abList.appendChild(abpopup);
		var ab = "";
		try {
			ab = pref.getCharPref("SyncKolab.Calendar");
		}
		catch (ex) {}
		
		// get the calendar manager to find the right files
		var calFile = getCalendarDirectory ()
	  calFile.append("CalendarManager.rdf");
		var rdf = new RDFFile( calFile.path, null);
		var rootContainer = rdf.getRootContainers("seq")[0];
		rdf.flush();
		for( var i = 0; i < rootContainer.getSubNodes().length; i++ )
    {
    	var cur = rootContainer.getSubNodes()[i];
    	// only non-remote calendars - hey we are already doin remote sync :)
      if( cur.getAttribute( "http://home.netscape.com/NC-rdf#active" ) == "true" &&
      	cur.getAttribute( "http://home.netscape.com/NC-rdf#remote" ) == "false")
      {
					var abchild = document.createElement("menuitem");
					abpopup.appendChild(abchild);
					abchild.setAttribute("label", cur.getAttribute( "http://home.netscape.com/NC-rdf#name" ));
					abchild.setAttribute("value", cur.getAttribute( "http://home.netscape.com/NC-rdf#path" ));
					if (cur.getAttribute( "http://home.netscape.com/NC-rdf#path" ) == ab)
					{
						abchild.setAttribute("selected", "true");
						abList.setAttribute("label", cur.getAttribute( "http://home.netscape.com/NC-rdf#name" ));
						abList.setAttribute("value", cur.getAttribute( "http://home.netscape.com/NC-rdf#path" ));
						
					}
      }                
    }

		
		// get the mail account
		var calActList = document.getElementById("calImapAcct");
		var actpopup = document.createElement("menupopup");
		calActList.appendChild(actpopup);
		var act = "";
		try {
			act = pref.getCharPref("SyncKolab.CalendarIncomingServer");
		}
		catch (ex) {}
	
		sCurFolder = "";
		try {
			sCurFolder = pref.getCharPref("SyncKolab.CalendarFolderPath");
			document.getElementById ("saveToCalImap").checked = pref.getBoolPref("SyncKolab.saveToCalendarImap");
		} catch (ex) {}
	
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
				calActList.setAttribute("label", account.prettyName);
				calActList.setAttribute("value", account.rootMsgFolder.baseMessageURI);
				// update the folder since we have a default acct
				updateCalFolder (account.rootMsgFolder.baseMessageURI);
				// select the element
				if (sCurFolder != "")
				{
					var tree= document.getElementById ("calImapFolder");
					var treei = tree.view.getIndexOfItem(document.getElementById(sCurFolder+"c"));
					tree.view.selection.select(treei); 
					tree.boxObject.scrollToRow(treei);
				}
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
			var cfold = document.getElementById ("conImapFolder");
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

			updateFolderElements (account.rootFolder, tChildren, "");
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
function updateFolderElements (msgFolder, root, appendChar)
{
	var tItem = document.createElement("treeitem");
	root.appendChild(tItem);
	var tRow = document.createElement("treerow");
	tItem.appendChild(tRow);
	var tCell = document.createElement("treecell");
	tRow.appendChild(tCell);
	tItem.setAttribute("id", msgFolder.URI + appendChar);
	tCell.setAttribute("label", msgFolder.prettyName);
	tCell.setAttribute("value", msgFolder.URI);
	
	if (msgFolder.hasSubFolders )
	{
		tItem.setAttribute("container", "true");
		tItem.setAttribute("open", "true");
		var tChildren = document.createElement("treechildren");
		tItem.appendChild(tChildren);
		
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
			updateFolderElements (cur, tChildren, appendChar);
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
	}
}

function setCalFolder(uri)
{
	var pref = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
	pref.setCharPref("SyncKolab.CalendarFolderPath", uri);
}

function updateCalFolder (act)
{
	// dynamically read this...
	
	var gAccountManager = Components.classes['@mozilla.org/messenger/account-manager;1'].getService(Components.interfaces.nsIMsgAccountManager);
	for (var i = 0; i < gAccountManager.allServers.Count(); i++)
	{
		var account = gAccountManager.allServers.GetElementAt(i).QueryInterface(Components.interfaces.nsIMsgIncomingServer);
		if (account.rootMsgFolder.baseMessageURI == act)
		{
			var cfold = document.getElementById ("calImapFolder");
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

			updateFolderElements (account.rootFolder, tChildren, "c");
			return;			
			
		}
	}
}


function savePrefs() {
	var pref = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
	pref.setCharPref("SyncKolab.ContactIncomingServer", document.getElementById ("conImapAcct").value);
	pref.setCharPref("SyncKolab.AddressBook", document.getElementById ("conURL").value);
	pref.setBoolPref("SyncKolab.saveToContactImap", document.getElementById ("saveToConImap").checked);

	pref.setBoolPref("SyncKolab.syncContacts", document.getElementById ("syncCon").checked);

	// if we do not have a calendar, we can easily skip this
	if (isCalendar)
	{
		pref.setBoolPref("SyncKolab.syncCalendar", document.getElementById ("syncCal").checked);
		pref.setCharPref("SyncKolab.CalendarIncomingServer", document.getElementById ("calImapAcct").value);
		pref.setCharPref("SyncKolab.Calendar", document.getElementById ("calURL").value);
		pref.setBoolPref("SyncKolab.saveToCalendarImap", document.getElementById ("saveToCalImap").checked);
	}
}
