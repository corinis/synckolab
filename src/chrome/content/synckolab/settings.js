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

var isCalendar;
var curConfig;

var consoleService = Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService);

// string bundle use: strBundle.getString("KEYNAME")
var strBundle;


/**
 * Generate the interface subtree for a new configuration 
 * and adds it in the correct container (configTree)
 */
function generateConfigTree (configuration)
{
	// skip bad config names
	if (configuration == null || configuration == "" || configuration.indexOf(" ") != -1)
		return;
	
	// get the root tree element
	var tree = document.getElementById("configTree");
	
	var ctree = null;
	
	var cnode = tree.firstChild;
	while (cnode != null)
	{
		if (cnode.nodeName == "treechildren")
		{
			ctree = cnode;
			break;
		}
		cnode = cnode.nextSibling;
	}
	
	if (ctree == null)
		return null;

	var tItem = document.createElement("treeitem");
	tItem.setAttribute("container", "true");
	tItem.setAttribute("open", "true");
	ctree.appendChild(tItem);
	var tRow = document.createElement("treerow");
	tItem.appendChild(tRow);
	var tCell = document.createElement("treecell");
	tRow.appendChild(tCell);
	tItem.setAttribute("id", configuration + "-AcctID");
	tCell.setAttribute("label", configuration);
	tCell.setAttribute("value", configuration + "-Acct");

	// now for the configurations
	var tChildren = document.createElement("treechildren");
	tItem.appendChild(tChildren);

	tItem = document.createElement("treeitem");
	tChildren.appendChild(tItem);
	tRow = document.createElement("treerow");
	tItem.appendChild(tRow);
	tCell = document.createElement("treecell");
	tRow.appendChild(tCell);
	tItem.setAttribute("id", configuration + "-ContactId");
	tCell.setAttribute("label", strBundle.getString("contacts"));
	tCell.setAttribute("value", configuration + "-Contact");

	// only display this part if the calendar is installed
	if (isCalendar)
	{
		tItem = document.createElement("treeitem");
		tChildren.appendChild(tItem);
		tRow = document.createElement("treerow");
		tItem.appendChild(tRow);
		tCell = document.createElement("treecell");
		tRow.appendChild(tCell);
		tItem.setAttribute("id", configuration + "-CalendarId");
		tCell.setAttribute("label", strBundle.getString("calendar"));
		tCell.setAttribute("value", configuration + "-Calendar");
	
		tItem = document.createElement("treeitem");
		tChildren.appendChild(tItem);
		tRow = document.createElement("treerow");
		tItem.appendChild(tRow);
		tCell = document.createElement("treecell");
		tRow.appendChild(tCell);
		tItem.setAttribute("id", configuration + "-TaskId");
		tCell.setAttribute("label", strBundle.getString("tasks"));
		tCell.setAttribute("value", configuration + "-Task");
	}	
}

function setView(viewName)
{
	if (viewName.indexOf("-") == -1)
	{
		alert("Fatal ERROR");
		return;
	}
	var opts = viewName.split("-");
	// display the correct view
	var tabs =document.getElementById("tabs");
	switch (opts[1])
	{
		case "Acct":
			tabs.selectedPanel = document.getElementById("accountTab");
			break;
		case "Contact":
			tabs.selectedPanel = document.getElementById("contactTab");
			break;
		case "Calendar":
			if (isCalendar)
				tabs.selectedPanel = document.getElementById("calTab");
			break;
		case "Task":
			if (isCalendar)
				tabs.selectedPanel = document.getElementById("taskTab");
			break;
		default:
	}
	// preselect the first item
	changeConfig(opts[0]);
}


function init() {

	strBundle = document.getElementById("synckolabBundle");
	isCalendar = isCalendarAvailable ();

	var sCurFolder = "";
	var rdf = Components.classes["@mozilla.org/rdf/rdf-service;1"].getService(Components.interfaces.nsIRDFService);

	var directory = rdf.GetResource("moz-abdirectory://").QueryInterface(Components.interfaces.nsIAbDirectory);
	var pref = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);

	// get all available configurations
	var configs = new Array();
	var curConfig = null;
	
	try {
		var Config = pref.getCharPref("SyncKolab.Configs");
		configs = Config.split(';');
	} catch(ex) {}
	
	// in case we did not find anything - check if there are "old" configurations
	// and use them (like an importer)
	if (configs.length == 0)
	{
		var oldConfigs = new Array();
		try {
			var conConfig = pref.getCharPref("SyncKolab.AddressBookConfigs");
			oldConfigs = conConfig.split(';');
		} catch(ex) {}
		
		try {
			var calConfig = pref.getCharPref("SyncKolab.CalendarConfigs");
			oldConfigs = oldConfigs.concat(calConfig.split(';'));
		}
		catch(ex) {}
		
		// now add each and make sure no doublenames are added:
		for (var i=0; i < oldConfigs.length; i++)
		{
			var addMe = true;
			for (var j=0; j < configs.length; j++)
				if (configs[j] == oldConfigs[i])
				{
					addMe = false;
					break;
				}
			if (addMe && oldConfigs[i].length > 2)
				configs.push(oldConfigs[i]);
		}
	}
	
	if (configs.length == 0)
	{
		alert("NO CONFIGS FOUND.. STARTING WIZARD");
	}

	// generate the configuration in the tree control 	
	for (var i=0; i < configs.length; i++)
		generateConfigTree(configs[i]);

	curConfig = null;
		
	// now prefill all fields we have to prefill
	
	// the format selection boxes:
	var abList = document.getElementById("conFormat");
	var abpopup = document.createElement("menupopup");

	abList.appendChild(abpopup);
	var abchild = document.createElement("menuitem");
	abpopup.appendChild(abchild);
	abchild.setAttribute("label", "VCard/Kolab1");
	abchild.setAttribute("value", "VCard");
	abchild.setAttribute("selected", "true");
	abList.setAttribute("label", "VCard/Kolab1");
	abList.setAttribute("value", "VCard");
	abchild = document.createElement("menuitem");
	abpopup.appendChild(abchild);
	abchild.setAttribute("label", "Xml/Kolab2");
	abchild.setAttribute("value", "Xml");
	abchild.setAttribute("selected", "true");
	abList.setAttribute("label", "Xml/Kolab2");
	abList.setAttribute("value", "Xml");

	abList = document.getElementById("calFormat");
	abpopup = document.createElement("menupopup");

	abList.appendChild(abpopup);
	abchild = document.createElement("menuitem");
	abpopup.appendChild(abchild);
	abchild.setAttribute("label", "iCal/Kolab1");
	abchild.setAttribute("value", "iCal");
	abchild.setAttribute("selected", "true");
	abList.setAttribute("label", "iCal/Kolab1");
	abList.setAttribute("value", "iCal");
	abchild = document.createElement("menuitem");
	abpopup.appendChild(abchild);
	abchild.setAttribute("label", "Xml/Kolab2");
	abchild.setAttribute("value", "Xml");
	abchild.setAttribute("selected", "true");
	abList.setAttribute("label", "Xml/Kolab2");
	abList.setAttribute("value", "Xml");

	abList = document.getElementById("taskFormat");
	abpopup = document.createElement("menupopup");

	abList.appendChild(abpopup);
	abchild = document.createElement("menuitem");
	abpopup.appendChild(abchild);
	abchild.setAttribute("label", "iCal/Kolab1");
	abchild.setAttribute("value", "iCal");
	abchild.setAttribute("selected", "true");
	abList.setAttribute("label", "iCal/Kolab1");
	abList.setAttribute("value", "iCal");
	abchild = document.createElement("menuitem");
	abpopup.appendChild(abchild);
	abchild.setAttribute("label", "Xml/Kolab2");
	abchild.setAttribute("value", "Xml");
	abchild.setAttribute("selected", "true");
	abList.setAttribute("label", "Xml/Kolab2");
	abList.setAttribute("value", "Xml");

	// the account selection
	var actList = document.getElementById("ImapAcct");
	var actpopup = document.createElement("menupopup");
	var isFirst = true;
	actList.appendChild(actpopup);
	
	var gAccountManager = Components.classes['@mozilla.org/messenger/account-manager;1'].getService(Components.interfaces.nsIMsgAccountManager);
	for (var i = 0; i < gAccountManager.allServers.Count(); i++)
	{
		var account = gAccountManager.allServers.GetElementAt(i).QueryInterface(Components.interfaces.nsIMsgIncomingServer);
		if (account.rootMsgFolder.baseMessageURI.toLowerCase().indexOf("imap") == -1)
			continue;
		var actchild = document.createElement("menuitem");
		actpopup.appendChild(actchild);
		actchild.setAttribute("label", account.prettyName);
		actchild.setAttribute("value", accountNameFix(account.rootMsgFolder.baseMessageURI));
		if (isFirst)
		{
			actchild.setAttribute("selected", "true");
			actList.setAttribute("label", account.prettyName);
			actList.setAttribute("value", accountNameFix(account.rootMsgFolder.baseMessageURI));
			isFirst = false;
		}
		
	}	
	
	// the adress book list
	// fill the contact selection
	var cn = directory.childNodes;
	var ABook = cn.getNext();
	var abList = document.getElementById("conURL");
	var abpopup = document.createElement("menupopup");
	
	isFirst = true;
	while (ABook != null)
	{
		var cur = ABook.QueryInterface(Components.interfaces.nsIAbDirectory);
		var abchild = document.createElement("menuitem");
		abpopup.appendChild(abchild);
		abchild.setAttribute("label", cur.directoryProperties.description);
		abchild.setAttribute("value", cur.directoryProperties.fileName);
		// default select the first item
		if (isFirst)
		{
			abchild.setAttribute("selected", "true");
			abList.setAttribute("label", cur.directoryProperties.description);
			abList.setAttribute("value", cur.directoryProperties.fileName);
			isFirst = false;
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
	
	// the calendar
	// if we do not have a calendar, we can easily skip this
	if (isCalendar)
	{
		var calendars = getSynckolabCalendars();

		var abList = document.getElementById("calURL");		
		var abpopup = document.createElement("menupopup");
		abList.appendChild(abpopup);
		
		var taskList = document.getElementById("taskURL");
		var taskpopup = document.createElement("menupopup");
		taskList.appendChild(taskpopup);
		
		// get the calendar manager to find the right files
		for( var i = 0; i < calendars.length; i++ )
	    {
    		// only non-remote calendars - hey we are already doin remote sync :)
			var abchild = document.createElement("menuitem");
			abpopup.appendChild(abchild);
			abchild.setAttribute("label", calendars[i].name);
			abchild.setAttribute("value", calendars[i].name);
			if (i == 0)
			{
				abchild.setAttribute("selected", "true");
				abList.setAttribute("label", calendars[i].name);
				abList.setAttribute("value", calendars[i].name);
			}

			abchild = document.createElement("menuitem");
			taskpopup.appendChild(abchild);
			abchild.setAttribute("label", calendars[i].name);
			abchild.setAttribute("value", calendars[i].name);
			if (i == 0)
			{
				abchild.setAttribute("selected", "true");
				taskList.setAttribute("label", calendars[i].name);
				taskList.setAttribute("value", calendars[i].name);				
			}
    	}
	}	
	
	// now some global settings
/*
	try {
		document.getElementById ("syncCon").checked = pref.getBoolPref("SyncKolab.syncContacts");
	} catch (ex) {}
	try {
		document.getElementById ("syncCal").checked = pref.getBoolPref("SyncKolab.syncCalendar");
	} catch (ex) {}
*/	
	try {
		document.getElementById ("closeWnd").checked = pref.getBoolPref("SyncKolab.closeWindow");
	} catch (ex) {}
	
	// default is 0
	document.getElementById ("syncInterval").value = "0";
	try {		
		document.getElementById ("syncInterval").value = pref.getCharPref("SyncKolab.autoSync");
	} catch (ex) {};
	
	// preselect the first item
	// changeConfig(curConfig); DONT DO THAT NOW :P
	return;	
}

function changeConfig (config)
{
	// didnt change anything
	if (config == curConfig)
		return;
		
	if (curConfig != null)
		saveAllPrefs();
		
	curConfig = config;
//	try
	{
		var pref = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
		
		var act = null;
				
		try
		{
			act = pref.getCharPref("SyncKolab."+config+".IncomingServer");
		}
		catch (ex)
		{
			// get the contact incoming (old style)
			try
			{
				act = pref.getCharPref("SyncKolab."+config+".ContactIncomingServer");
			}
			catch (ex2) 
			{
				try
				{
					act = pref.getCharPref("SyncKolab."+config+".CalendarIncomingServer");
				}
				catch (ex3) {}
			}
		}

		// if no account config found - preselect the first one
		if (act == null)
		{
		}
	
		// select the account
		var actList = document.getElementById("ImapAcct");
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
		
		// update the folder selections
		// the address book
		var ab = null;
		try
		{
			ab = pref.getCharPref("SyncKolab."+config+".AddressBook");
		}
		catch (ex)
		{}
		
		actList = document.getElementById("conURL");
		// go through the items
		if (actList.firstChild != null)
		{
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
		}

		var abFormat = null;
		try {
			abFormat = pref.getCharPref("SyncKolab."+config+".AddressBookFormat");
		} catch (ex) {};
		
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

		document.getElementById ("saveToContactImap").checked = true;
		try {
			document.getElementById ("saveToContactImap").checked = pref.getBoolPref("SyncKolab."+config+".saveToContactImap");
		} catch (ex) {}

		document.getElementById ("syncContacts").checked = true;
		try {
			document.getElementById ("syncContacts").checked = pref.getBoolPref("SyncKolab."+config+".syncContacts");
		} catch (ex) {}
		
		var sCurFolder = null;
		try
		{
			sCurFolder = pref.getCharPref("SyncKolab."+config+".ContactFolderPath");
		} catch (ex) {}
		
		updateFolder (act);
		updateFolder (act);
		if (sCurFolder != null)
		{
			var tree= document.getElementById ("conImapFolder");
			var treei = tree.view.getIndexOfItem(document.getElementById(sCurFolder));
			tree.view.selection.select(treei); 
			if (tree.boxObject)
				tree.boxObject.scrollToRow(treei);
		}
		
		// same stuff for the calendarcontrols		
		if (isCalendar)
		{
			// the calendar			
			var ab = null;
			try
			{
				pref.getCharPref("SyncKolab."+config+".Calendar");
			} catch (ex) {}
			
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
	
			var calFormat = null;
			try
			{
				calFormat = pref.getCharPref("SyncKolab."+config+".CalendarFormat");
			} catch (ex) {}
			
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
	
			document.getElementById ("saveToCalendarImap").checked = true;
			try
			{
				document.getElementById ("saveToCalendarImap").checked = pref.getBoolPref("SyncKolab."+config+".saveToCalendarImap");
			}
			catch (ex) {}
			
			document.getElementById ("syncCalendar").checked = true;
			try {
				document.getElementById ("syncCalendar").checked = pref.getBoolPref("SyncKolab."+config+".syncCalendar");
			} catch (ex) {}
			
			var sCurFolder = null;
			try
			{
				sCurFolder = pref.getCharPref("SyncKolab."+config+".CalendarFolderPath");
			} catch (ex) {}
			updateCalFolder (act);
			updateCalFolder (act);
			if (sCurFolder != null)
			{
				var tree= document.getElementById ("calImapFolder");
				var treei = tree.view.getIndexOfItem(document.getElementById(sCurFolder+"c"));
				tree.view.selection.select(treei); 
				if (tree.boxObject)
					tree.boxObject.scrollToRow(treei);
			}
			
			// the tasks
			// the calendar			
			ab = null;
			try
			{
				pref.getCharPref("SyncKolab."+config+".Tasks");
			} catch (ex) {}
			
			actList = document.getElementById("taskURL");
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
	
			calFormat = null;
			try
			{
				calFormat = pref.getCharPref("SyncKolab."+config+".TaskFormat");
			} catch (ex) {}
			
			actList = document.getElementById("taskFormat");
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
	
			document.getElementById ("saveToTaskImap").checked = true;
			try
			{
				document.getElementById ("saveToTaskImap").checked = pref.getBoolPref("SyncKolab."+config+".saveToTaskImap");
			}
			catch (ex) {}
			
			document.getElementById ("syncTasks").checked = true;
			try {
				document.getElementById ("syncTasks").checked = pref.getBoolPref("SyncKolab."+config+".syncTasks");
			} catch (ex) {}
			
			var sCurFolder = null;
			try
			{
				sCurFolder = pref.getCharPref("SyncKolab."+config+".TaskFolderPath");
			} catch (ex) {}
			updateTaskFolder (act);
			updateTaskFolder (act);
			if (sCurFolder != null)
			{
				var tree= document.getElementById ("taskImapFolder");
				var treei = tree.view.getIndexOfItem(document.getElementById(sCurFolder+"c"));
				tree.view.selection.select(treei); 
				if (tree.boxObject)
					tree.boxObject.scrollToRow(treei);
			}
		}
	}
//	catch (ex)
	{}	
}

/**
 * set all folders after an account change
 */
function setFolders(act)
{
	updateFolder(act);
	updateCalFolder(act)
	updateTaskFolder(act);
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
			if (account.rootMsgFolder.baseMessageURI == act || accountNameFix(account.rootMsgFolder.baseMessageURI) == act)
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
	if (curConfig == null)
	{
		return;
	}
	
	var pref = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
	pref.setCharPref("SyncKolab."+curConfig+".ContactFolderPath", uri);
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
	if (curConfig == null)
	{
		return;
	}

	var pref = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
	pref.setCharPref("SyncKolab."+curConfig+".CalendarFolderPath", uri);
}

function setTaskFolder(uri)
{
	if (curConfig == null)
	{
		return;
	}

	var pref = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
	pref.setCharPref("SyncKolab."+curConfig+".CalendarFolderPath", uri);
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
			if (account.rootMsgFolder.baseMessageURI == act || accountNameFix(account.rootMsgFolder.baseMessageURI) == act)
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


function updateTaskFolder (act)
{
	// dynamically read this...
	
	var gAccountManager = Components.classes['@mozilla.org/messenger/account-manager;1'].getService(Components.interfaces.nsIMsgAccountManager);
	for (var i = 0; i < gAccountManager.allServers.Count(); i++)
	{
		try
		{
			var account = gAccountManager.allServers.GetElementAt(i).QueryInterface(Components.interfaces.nsIMsgIncomingServer);
			if (account.rootMsgFolder.baseMessageURI == act || accountNameFix(account.rootMsgFolder.baseMessageURI) == act)
			{
				var cfold = document.getElementById ("taskImapFolder");
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
	
				updateFolderElements (account.rootFolder, tChildren, "t");
				return;			
				
			}
		}
		catch (ex) {}
	}
}

function saveAllPrefs () {
	if (curConfig == null)
		return;
	
	config = curConfig;
		
	var pref = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
	
	pref.setCharPref("SyncKolab."+config+".IncomingServer", document.getElementById ("ImapAcct").value);
	
	pref.setCharPref("SyncKolab."+config+".AddressBook", document.getElementById ("conURL").value);
	pref.setCharPref("SyncKolab."+config+".AddressBookFormat", document.getElementById ("conFormat").value);
	pref.setBoolPref("SyncKolab."+config+".saveToContactImap", document.getElementById ("saveToContactImap").checked);
	pref.setBoolPref("SyncKolab."+config+".syncContacts", document.getElementById ("syncContacts").checked);

	// if we do not have a calendar, we can easily skip this
	if (isCalendar)
	{
		pref.setCharPref("SyncKolab."+config+".Calendar", document.getElementById ("calURL").value);
		pref.setCharPref("SyncKolab."+config+".CalendarFormat", document.getElementById ("calFormat").value);
		pref.setBoolPref("SyncKolab."+config+".saveToCalendarImap", document.getElementById ("saveToCalendarImap").checked);
		pref.setBoolPref("SyncKolab."+config+".syncCalendar", document.getElementById ("syncCalendar").checked);

		pref.setCharPref("SyncKolab."+config+".Tasks", document.getElementById ("taskURL").value);
		pref.setCharPref("SyncKolab."+config+".TaskFormat", document.getElementById ("taskFormat").value);
		pref.setBoolPref("SyncKolab."+config+".saveToTaskImap", document.getElementById ("saveToTaskImap").checked);
		pref.setBoolPref("SyncKolab."+config+".syncTasks", document.getElementById ("syncTasks").checked);
	}
}


// called when closed (OK)
function savePrefs() {
	var pref = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);

//	pref.setBoolPref("SyncKolab.syncContacts", document.getElementById ("syncCon").checked);
//	pref.setBoolPref("SyncKolab.syncCalendar", document.getElementById ("syncCal").checked);
	pref.setBoolPref("SyncKolab.closeWindow", document.getElementById ("closeWnd").checked);
	pref.setCharPref("SyncKolab.autoSync", document.getElementById ("syncInterval").value);

	var tree = document.getElementById("configTree");
	// get the treechildren item
	var ctree;
	var cnode = tree.firstChild;
	while (cnode != null)
	{
		if (cnode.nodeName == "treechildren")
		{
			ctree = cnode;
			break;
		}
		cnode = cnode.nextSibling;
	}
	
	if (ctree == null)
		return null;

	// first menuitem
	var cur = ctree.firstChild;
	var configs = "";
	while (cur != null)
	{
		if (cur.nodeName == "treeitem")
		{
			configs += cur.firstChild.firstChild.getAttribute("label") + ";";
		}
		cur = cur.nextSibling;
	}
	
	var pref = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
	pref.setCharPref("SyncKolab.Configs", configs);
	
	saveAllPrefs (curConfig);
			
}

function addConfig()
{
	var newconfig = prompt("Insert the name of the new Configuration");
	if (newconfig != null && newconfig != "")
	{
		if (newconfig.indexOf(" ") != -1)
		{
			alert("You can not have a space in the configuration name!");
			return;
		}
		
		var tree = document.getElementById("configTree");
		// get the treechildren item
		var ctree;
		var cnode = tree.firstChild;
		while (cnode != null)
		{
			if (cnode.nodeName == "treechildren")
			{
				ctree = cnode;
				break;
			}
			cnode = cnode.nextSibling;
		}
		
		if (ctree == null)
			return null;

		// first menuitem
		var cur = ctree.firstChild;
		var configs = "";
		while (cur != null)
		{
			if (cur.nodeName == "treeitem")
			{
				configs += cur.firstChild.firstChild.getAttribute("label") + ";";
			}
			cur = cur.nextSibling;
		}
		
		var pref = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
		pref.setCharPref("SyncKolab.Configs", configs  + curConfig + ";");
		// add the tree element
		generateConfigTree(newconfig);
	}
}

function delConfig()
{
	var config = curConfig;
	if (confirm("Are you sure you want delete the configuration " + config + "?"))
	{
		// get the treechildren item
		var tree = document.getElementById("configTree");
		var ctree;
		var cnode = tree.firstChild;
		while (cnode != null)
		{
			if (cnode.nodeName == "treechildren")
			{
				ctree = cnode;
				break;
			}
			cnode = cnode.nextSibling;
		}
		
		if (ctree == null)
			return null;

		// first menuitem
		var cur = ctree.firstChild;
		var configs = "";
		var delNode = null;
		while (cur != null)
		{
			if (cur.nodeName == "treeitem")
			{
				if (config == cur.firstChild.firstChild.getAttribute("label"))
				{
					delNode = cur;
				}
				else
					configs += cur.firstChild.firstChild.getAttribute("label") + ";";
			}
			cur = cur.nextSibling;
		}
		
		var pref = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
		pref.setCharPref("SyncKolab.Configs", configs);
		curConfig = null;

		if (delNode != null)
		{
			try
			{
				ctree.removeChild(delNode);
			} catch (ex) {}
		}
	}
}

