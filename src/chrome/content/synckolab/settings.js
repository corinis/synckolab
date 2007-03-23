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

/**
 * These are the functions for the configuration.
 */

/**
 * TODO: make sure a selected contact folder isnt in cal yet and other way round)
 */
var isCalendar;
var selectedCalConfig;
var selectedConConfig;

var consoleService = Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService);

function init() {

	isCalendar = isCalendarAvailable ();
	selectedCalConfig = null;
	selectedConConfig = null;
	
	var sCurFolder = "";
	var rdf = Components.classes["@mozilla.org/rdf/rdf-service;1"].getService(Components.interfaces.nsIRDFService);

	var directory = rdf.GetResource("moz-abdirectory://").QueryInterface(Components.interfaces.nsIAbDirectory);
	var pref = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
	
	var calConfigs = new Array(), conConfigs = new Array;
	try {
		var conConfig = pref.getCharPref("SyncKolab.AddressBookConfigs");
		conConfigs = conConfig.split(';');
	} catch(ex) {}
	
	try {
		var calConfig = pref.getCharPref("SyncKolab.CalendarConfigs");
		calConfigs = calConfig.split(';');
	}
	catch(ex) {}

	// the addressbook configuration list	
	var conConfigList = document.getElementById("conConfig");
	var conConfigPopup = document.createElement("menupopup");

	conConfigList.appendChild(conConfigPopup);

	var i;
	for (i=0; i < conConfigs.length; i++)
		if (conConfigs[i].length > 0)
		{
			var abchild = document.createElement("menuitem");
			conConfigPopup.appendChild(abchild);
			abchild.setAttribute("label", conConfigs[i]);
			abchild.setAttribute("value", conConfigs[i]);
			if (selectedConConfig == null)
			{
				selectedConConfig = conConfigs[i];
				abchild.setAttribute("selected", "true");
				conConfigList.setAttribute("label", conConfigs[i]);
				conConfigList.setAttribute("value", conConfigs[i]);
			}
		}
		
	// the calendar configuration list	
	var calConfigList = document.getElementById("calConfig");
	var calConfigPopup = document.createElement("menupopup");

	calConfigList.appendChild(calConfigPopup);
	for (i=0; i < calConfigs.length; i++)
		if (calConfigs[i].length > 0)
		{
			var abchild = document.createElement("menuitem");
			calConfigPopup.appendChild(abchild);
			abchild.setAttribute("label", calConfigs[i]);
			abchild.setAttribute("value", calConfigs[i]);
			if (selectedCalConfig == null)
			{
				selectedCalConfig = calConfigs[i];
				abchild.setAttribute("selected", "true");
				calConfigList.setAttribute("label", calConfigs[i]);
				calConfigList.setAttribute("value", calConfigs[i]);
			}
			
		}
	
	// do we even sync cal or contacts at all?
	try {
		document.getElementById ("syncCon").checked = pref.getBoolPref("SyncKolab.syncContacts");
	} catch (ex) {}
	try {
		document.getElementById ("syncCal").checked = pref.getBoolPref("SyncKolab.syncCalendar");
	} catch (ex) {}
	try {
		document.getElementById ("closeWnd").checked = pref.getBoolPref("SyncKolab.closeWindow");
	} catch (ex) {}

	// fill the contact selection
	var cn = directory.childNodes;
	var ABook = cn.getNext();
	
	var abList = document.getElementById("conURL");
	var abpopup = document.createElement("menupopup");

	abList.appendChild(abpopup);
	// default selected
	var ab = "";
	try {
		if (selectedConConfig != null)
			ab = pref.getCharPref("SyncKolab."+selectedConConfig+".AddressBook");
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

	// fill the format
	var selConFormat = null;
	try
	{	
		if (selectedConConfig != null)
			selConFormat = pref.getCharPref("SyncKolab."+selectedConConfig+".AddressBookFormat");
	}
	catch (ex){}

	var abList = document.getElementById("conFormat");
	var abpopup = document.createElement("menupopup");

	abList.appendChild(abpopup);
	var abchild = document.createElement("menuitem");
	abpopup.appendChild(abchild);
	abchild.setAttribute("label", "VCard/Kolab1");
	abchild.setAttribute("value", "VCard");
	if (selConFormat == "VCard")
	{
		abchild.setAttribute("selected", "true");
		abList.setAttribute("label", "VCard/Kolab1");
		abList.setAttribute("value", "VCard");
	}
	var abchild = document.createElement("menuitem");
	abpopup.appendChild(abchild);
	abchild.setAttribute("label", "Xml/Kolab2");
	abchild.setAttribute("value", "Xml");
	if (selConFormat == "Xml")
	{
		abchild.setAttribute("selected", "true");
		abList.setAttribute("label", "Xml/Kolab2");
		abList.setAttribute("value", "Xml");
	}

	
	// get the mail account
	var actList = document.getElementById("conImapAcct");
	var actpopup = document.createElement("menupopup");
	actList.appendChild(actpopup);
	var act = "";
	try {
		if (selectedConConfig != null)
			act = pref.getCharPref("SyncKolab."+selectedConConfig+".ContactIncomingServer");
	}
	catch (ex) {}

	if (selectedConConfig != null)
	{
		try {
			sCurFolder = pref.getCharPref("SyncKolab."+selectedConConfig+".ContactFolderPath");
		} catch (ex) {}
		try {
			document.getElementById ("saveToConImap").checked = pref.getBoolPref("SyncKolab."+selectedConConfig+".saveToContactImap");
		} catch (ex) {}
	}

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
	if (!isCalendar)
			consoleService.logStringMessage("Calendar not available - disabling");
	else
	{
		var calendars = getCalendars();

		var abList = document.getElementById("calURL");
		var abpopup = document.createElement("menupopup");
	
		abList.appendChild(abpopup);
		var ab = "";
		try {
			if (selectedCalConfig != null)
				ab = pref.getCharPref("SyncKolab."+selectedCalConfig+".Calendar");
		}
		catch (ex) {}
		
		// get the calendar manager to find the right files
		for( var i = 0; i < calendars.length; i++ )
	    {
    		// only non-remote calendars - hey we are already doin remote sync :)
			var abchild = document.createElement("menuitem");
			abpopup.appendChild(abchild);
			abchild.setAttribute("label", calendars[i].name);
			abchild.setAttribute("value", calendars[i].name);
			if (calendars[i].name == ab)
			{
				abchild.setAttribute("selected", "true");
				abList.setAttribute("label", calendars[i].name);
				abList.setAttribute("value", calendars[i].name);
				
			}
    	}

		
		// fill the format
		var selCalFormat = null;
		try
		{
			if (selectedCalConfig != null)
				selCalFormat = pref.getCharPref("SyncKolab."+selectedCalConfig+".CalendarFormat");
		}
		catch (ex){}
		
		var abList = document.getElementById("calFormat");
		var abpopup = document.createElement("menupopup");
	
		abList.appendChild(abpopup);
		var abchild = document.createElement("menuitem");
		abpopup.appendChild(abchild);
		abchild.setAttribute("label", "iCal/Kolab1");
		abchild.setAttribute("value", "iCal");
		if (selCalFormat == "iCal")
		{
			abchild.setAttribute("selected", "true");
			abList.setAttribute("label", "iCal/Kolab1");
			abList.setAttribute("value", "iCal");
		}
		var abchild = document.createElement("menuitem");
		abpopup.appendChild(abchild);
		abchild.setAttribute("label", "Xml/Kolab2");
		abchild.setAttribute("value", "Xml");
		if (selCalFormat == "Xml")
		{
			abchild.setAttribute("selected", "true");
			abList.setAttribute("label", "Xml/Kolab2");
			abList.setAttribute("value", "Xml");
		}
	
		// get the mail account
		var calActList = document.getElementById("calImapAcct");
		var actpopup = document.createElement("menupopup");
		calActList.appendChild(actpopup);
		var act = "";
		try {
			if (selectedCalConfig != null)
				act = pref.getCharPref("SyncKolab."+selectedCalConfig+".CalendarIncomingServer");
		}
		catch (ex) {}
	
		sCurFolder = "";
		if (selectedCalConfig != null)
		{
			try {
					sCurFolder = pref.getCharPref("SyncKolab."+selectedCalConfig+".CalendarFolderPath");
			} catch (ex) {}
			try {
					document.getElementById ("saveToCalImap").checked = pref.getBoolPref("SyncKolab."+selectedCalConfig+".saveToCalendarImap");
			} catch (ex) {}
		}
	
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

// called when a new profile is selected
function updateCon(value)
{
	// save the old prefs
	saveConPrefs ();
	
	selectedConConfig = value;

	// get the prefs
	try
	{
		var pref = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
		var act = pref.getCharPref("SyncKolab."+selectedConConfig+".ContactIncomingServer");
		
		// select the account
		var actList = document.getElementById("conImapAcct");
		// go through the items
		var cur = actList.firstChild.firstChild;
		while (cur != null)
		{
			if (cur.getAttribute("value") == act)
			{
				actList.selectedItem = cur;
				actList.setAttribute("label", cur.getAttribute("label"));
				actList.setAttribute("value", cur.getAttribute("value"));
				break;
			}
			cur = cur.nextSibling;
		}
						
		// the address book
		var ab = pref.getCharPref("SyncKolab."+selectedConConfig+".AddressBook");
		actList = document.getElementById("conURL");
		// go through the items
		var cur = actList.firstChild.firstChild;
		while (cur != null)
		{
			if (cur.getAttribute("value") == ab)
			{
				actList.selectedItem = cur;
				actList.setAttribute("label", cur.getAttribute("label"));
				actList.setAttribute("value", cur.getAttribute("value"));
				break;
			}
			cur = cur.nextSibling;
		}

		var abFormat = pref.getCharPref("SyncKolab."+selectedConConfig+".AddressBookFormat");
		actList = document.getElementById("conFormat");
		// go through the items
		var cur = actList.firstChild.firstChild;
		while (cur != null)
		{
			if (cur.getAttribute("value") == abFormat)
			{
				actList.selectedItem = cur;
				actList.setAttribute("label", cur.getAttribute("label"));
				actList.setAttribute("value", cur.getAttribute("value"));
				break;
			}
			cur = cur.nextSibling;
		}

		document.getElementById ("saveToConImap").checked = pref.getBoolPref("SyncKolab."+selectedConConfig+".saveToContactImap");
		
		var sCurFolder = pref.getCharPref("SyncKolab."+selectedConConfig+".ContactFolderPath");
		updateFolder (act);
		updateFolder (act);
		var tree= document.getElementById ("conImapFolder");
		var treei = tree.view.getIndexOfItem(document.getElementById(sCurFolder));
		tree.view.selection.select(treei); 
		tree.boxObject.scrollToRow(treei);

	}
	catch(ex){};
}

function updateCal(value)
{
	// save the old prefs
	saveCalPrefs ();
	
	selectedCalConfig = value;

	// get the prefs
	try
	{
		var pref = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
		var act = pref.getCharPref("SyncKolab."+selectedCalConfig+".CalendarIncomingServer");
		
		// select the account
		var actList = document.getElementById("calImapAcct");
		// go through the items
		var cur = actList.firstChild.firstChild;
		while (cur != null)
		{
			if (cur.getAttribute("value") == act)
			{
				actList.selectedItem = cur;
				actList.setAttribute("label", cur.getAttribute("label"));
				actList.setAttribute("value", cur.getAttribute("value"));
				break;
			}
			cur = cur.nextSibling;
		}
						
		// the calendar
		var ab = pref.getCharPref("SyncKolab."+selectedCalConfig+".Calendar");
		actList = document.getElementById("calURL");
		// go through the items
		var cur = actList.firstChild.firstChild;
		while (cur != null)
		{
			if (cur.getAttribute("value") == ab)
			{
				actList.selectedItem = cur;
				actList.setAttribute("label", cur.getAttribute("label"));
				actList.setAttribute("value", cur.getAttribute("value"));
				break;
			}
			cur = cur.nextSibling;
		}

		var calFormat = pref.getCharPref("SyncKolab."+selectedCalConfig+".CalendarFormat");
		actList = document.getElementById("calFormat");
		// go through the items
		var cur = actList.firstChild.firstChild;
		while (cur != null)
		{
			if (cur.getAttribute("value") == calFormat)
			{
				actList.selectedItem = cur;
				actList.setAttribute("label", cur.getAttribute("label"));
				actList.setAttribute("value", cur.getAttribute("value"));
				break;
			}
			cur = cur.nextSibling;
		}

		document.getElementById ("saveToCalImap").checked = pref.getBoolPref("SyncKolab."+selectedCalConfig+".saveToCalendarImap");
		
		var sCurFolder = pref.getCharPref("SyncKolab."+selectedCalConfig+".CalendarFolderPath");
		updateCalFolder (act);
		updateCalFolder (act);
		var tree= document.getElementById ("calImapFolder");
		var treei = tree.view.getIndexOfItem(document.getElementById(sCurFolder+"c"));
		tree.view.selection.select(treei); 
		tree.boxObject.scrollToRow(treei);

	}
	catch(ex){};
}

function updateFolder (act)
{
	// dynamically read this...
	
	var gAccountManager = Components.classes['@mozilla.org/messenger/account-manager;1'].getService(Components.interfaces.nsIMsgAccountManager);
	for (var i = 0; i < gAccountManager.allServers.Count(); i++)
	{
		try
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
		catch (ex){}
	}
}

function setFolder(uri)
{
	if (selectedConConfig == null)
	{
		alert("Select/Create a Configuration first");
		return;
	}
	
	var pref = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
	if (selectedCalConfig != null)
	{
		if (uri == pref.getCharPref("SyncKolab."+selectedCalConfig+".CalendarFolderPath"))
		{
			alert("You have to select a different folder for Calendar and Contacts!");
			return;
		}
	}
	pref.setCharPref("SyncKolab."+selectedConConfig+".ContactFolderPath", uri);
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
	if (selectedCalConfig == null)
	{
		alert("Select/create a configuration first!");
		return;
	}

	var pref = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
	if (selectedConConfig != null)
	{
		if (uri == pref.getCharPref("SyncKolab."+selectedConConfig+".ContactFolderPath"))
		{
			alert("You have to select a different folder for Calendar and Contacts!");
			return;
		}
	}
	pref.setCharPref("SyncKolab."+selectedCalConfig+".CalendarFolderPath", uri);
}

function updateCalFolder (act)
{
	// dynamically read this...
	
	var gAccountManager = Components.classes['@mozilla.org/messenger/account-manager;1'].getService(Components.interfaces.nsIMsgAccountManager);
	for (var i = 0; i < gAccountManager.allServers.Count(); i++)
	{
		try
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
		catch (ex) {}
	}
}

function saveCalPrefs () {
	if (selectedCalConfig == null)
		return;

	// if we do not have a calendar, we can easily skip this
	if (isCalendar)
	{
		var pref = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
		pref.setCharPref("SyncKolab."+selectedCalConfig+".CalendarIncomingServer", document.getElementById ("calImapAcct").value);
		pref.setCharPref("SyncKolab."+selectedCalConfig+".Calendar", document.getElementById ("calURL").value);
		pref.setCharPref("SyncKolab."+selectedCalConfig+".CalendarFormat", document.getElementById ("calFormat").value);
		pref.setBoolPref("SyncKolab."+selectedCalConfig+".saveToCalendarImap", document.getElementById ("saveToCalImap").checked);
	}
}

function saveConPrefs () {
	if (selectedConConfig == null)
		return;
	var pref = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
	pref.setCharPref("SyncKolab."+selectedConConfig+".ContactIncomingServer", document.getElementById ("conImapAcct").value);
	pref.setCharPref("SyncKolab."+selectedConConfig+".AddressBook", document.getElementById ("conURL").value);
	pref.setCharPref("SyncKolab."+selectedConConfig+".AddressBookFormat", document.getElementById ("conFormat").value);
	pref.setBoolPref("SyncKolab."+selectedConConfig+".saveToContactImap", document.getElementById ("saveToConImap").checked);
}

// called when closed (OK)
function savePrefs() {
	var pref = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);

	pref.setBoolPref("SyncKolab.syncContacts", document.getElementById ("syncCon").checked);
	pref.setBoolPref("SyncKolab.syncCalendar", document.getElementById ("syncCal").checked);
	pref.setBoolPref("SyncKolab.closeWindow", document.getElementById ("closeWnd").checked);
	
	saveCalPrefs ();
	saveConPrefs ();
}

function addConConfig()
{
	var newconfig = prompt("Insert the name of the new Configuration");
	if (newconfig != null && newconfig != "")
	{
		var conConfigList = document.getElementById("conConfig");
		var conConfigPopup = conConfigList.firstChild;

		var abchild = document.createElement("menuitem");
		conConfigPopup.appendChild(abchild);
		abchild.setAttribute("label", newconfig);
		abchild.setAttribute("value", newconfig);
		
		// first menuitem
		var cur = conConfigPopup.firstChild;
		var configs = "";
		while (cur != null)
		{
			configs += cur.getAttribute("value") + ";";
			cur = cur.nextSibling;
		}
		
		var pref = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
		pref.setCharPref("SyncKolab.AddressBookConfigs", configs);
	}
}

function delConConfig()
{
	var config = selectedConConfig;
	if (confirm("Are you sure you want delete the configuration " + config + "?"))
	{
		var conConfigList = document.getElementById("conConfig");
		var conConfigPopup = conConfigList.firstChild;
		
		// first menuitem
		var delNode = null;
		var cur = conConfigPopup.firstChild;
		var configs = "";
		while (cur != null)
		{
			if (cur.getAttribute("value") == config)
			{
				delNode = cur;
			}
			else
			{
				configs += cur.getAttribute("value") + ";";
			}
			cur = cur.nextSibling;
		}
		if (delNode != null)
		{
			conConfigPopup.removeChild(delNode);
		}
		
		var pref = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
		pref.setCharPref("SyncKolab.AddressBookConfigs", configs);
		selectedConConfig = null;
	}
}

function addCalConfig()
{
	var newconfig = prompt("Insert the name of the new Configuration");
	if (newconfig != null && newconfig != "")
	{
		var conConfigList = document.getElementById("calConfig");
		var conConfigPopup = conConfigList.firstChild;

		var abchild = document.createElement("menuitem");
		conConfigPopup.appendChild(abchild);
		abchild.setAttribute("label", newconfig);
		abchild.setAttribute("value", newconfig);
		
		// first menuitem
		var cur = conConfigPopup.firstChild;
		var configs = "";
		while (cur != null)
		{
			configs += cur.getAttribute("value") + ";";
			cur = cur.nextSibling;
		}
		
		var pref = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
		pref.setCharPref("SyncKolab.CalendarConfigs", configs);
	}
}

function delCalConfig()
{
	var config = selectedCalConfig;
	
	if (confirm("Are you sure you want delete the configuration " + config + "?"))
	{
		var calConfigList = document.getElementById("calConfig");
		var calConfigPopup = calConfigList.firstChild;
		
		// first menuitem
		var delNode = null;
		var cur = calConfigPopup.firstChild;
		var configs = "";
		while (cur != null)
		{
			if (cur.getAttribute("value") == config)
			{
				delNode = cur;
			}
			else
			{
				configs += cur.getAttribute("value") + ";";
			}
			cur = cur.nextSibling;
		}
		if (delNode != null)
		{
			calConfigPopup.removeChild(delNode);
		}
		
		var pref = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
		pref.setCharPref("SyncKolab.CalendarConfigs", configs);
		selectedCalConfig = null;
	}
}
