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

String.prototype.trim = function() { return this.replace(/^\s+|\s+$/g, ''); }

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

function setSyncPrefView(viewName)
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
		// on welcome we return - no change config
		case "Welcome":
			tabs.selectedPanel = document.getElementById("welcome");
			return;
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
		addConfig();
		return;
	}

	// the the about
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
	tItem.setAttribute("id", "Welcome-Welcome");
	tCell.setAttribute("label", strBundle.getString("aboutSyncKolab"));
	tCell.setAttribute("value", "Welcome-Welcome");
	
	// generate the configuration in the tree control 	
	for (var i=0; i < configs.length; i++)
		generateConfigTree(configs[i]);

	curConfig = null;
		
	// now prefill all fields we have to prefill
	
	prefillFields();
		
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
	
	// default do hide the window
	document.getElementById ("hiddenWnd").checked = true;
	try {		
		document.getElementById ("hiddenWnd").checked = pref.getBoolPref("SyncKolab.hiddenWindow");
	} catch (ex) {};
	
	return;	
}

function prefillFields() {

	// the format selection boxes:
	var abList = document.getElementById("conFormat");
	var abpopup = document.createElement("menupopup");

	abList.appendChild(abpopup);
	var abchild = document.createElement("menuitem");
	abpopup.appendChild(abchild);
	abchild.setAttribute("label", "VCard/Kolab1");
	abchild.setAttribute("value", "VCard");
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
	var rdf = Components.classes["@mozilla.org/rdf/rdf-service;1"].getService(Components.interfaces.nsIRDFService);
	var directory = rdf.GetResource("moz-abdirectory://").QueryInterface(Components.interfaces.nsIAbDirectory);

	var cn = directory.childNodes;
	var ABook = cn.getNext();
	var abList = document.getElementById("conURL");
	var abpopup = document.createElement("menupopup");
	abList.appendChild(abpopup);
	
	isFirst = true;
	while (ABook != null)
	{
		var cur = ABook.QueryInterface(Components.interfaces.nsIAbDirectory);
		var abchild = document.createElement("menuitem");
		abpopup.appendChild(abchild);
		// tbird < 3: use directoryProperties
		if (cur.directoryProperties)
		{
			abchild.setAttribute("label", cur.directoryProperties.description);
			abchild.setAttribute("value", cur.directoryProperties.fileName);
		}
		else
		{
			abchild.setAttribute("label", cur.dirName);
			abchild.setAttribute("value", cur.dirName);
		}
		// default select the first item
		
		if (isFirst)
		{
			abchild.setAttribute("selected", "true");
			// tbird < 3: use directoryProperties
			if (cur.directoryProperties)
			{
				abList.setAttribute("label", cur.directoryProperties.description);
				abList.setAttribute("value", cur.directoryProperties.fileName);
			}
			else
			{
				abList.setAttribute("label", cur.dirName);
				abList.setAttribute("value", cur.dirName);
			}
			isFirst = false;
		}
		
		try
		{	
			if (cn.hasMoreElements ())		
				ABook = cn.getNext();
			else
				break;
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
    		// only non-remote calendars - hey we are already doin remote sync here :)
			var abchild = document.createElement("menuitem");
			abpopup.appendChild(abchild);
			abchild.setAttribute("label", calendars[i].name);
			abchild.setAttribute("value", fixNameToMiniCharset(calendars[i].name));
			if (i == 0)
			{
				abchild.setAttribute("selected", "true");
				abList.setAttribute("label", calendars[i].name);
				abList.setAttribute("value", fixNameToMiniCharset(calendars[i].name));
			}

			abchild = document.createElement("menuitem");
			taskpopup.appendChild(abchild);
			abchild.setAttribute("label", calendars[i].name);
			abchild.setAttribute("value", fixNameToMiniCharset(calendars[i].name));
			if (i == 0)
			{
				abchild.setAttribute("selected", "true");
				taskList.setAttribute("label", calendars[i].name);
				taskList.setAttribute("value", fixNameToMiniCharset(calendars[i].name));				
			}
    	}
	}	
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
			alert("No account found");
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

		// update the resolve settings
		var resolve = 'ask';		
		try
		{
			resolve = pref.getCharPref("SyncKolab."+config+".Resolve");
		}
		catch (ex)
		{
			// ignore (use ask)
		}
		
		actList = document.getElementById("DefaultResolve");
		// go through the items
		cur = actList.firstChild.firstChild;
		while (cur != null)
		{
			if (cur.getAttribute("value") == resolve)
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

		document.getElementById ("syncContacts").checked = false;
		try {
			document.getElementById ("syncContacts").checked = pref.getBoolPref("SyncKolab."+config+".syncContacts");
		} catch (ex) {}
		setControlStateContacts(document.getElementById ("syncContacts").checked);
		
		var sCurFolder = null;
		try
		{
			sCurFolder = pref.getCharPref("SyncKolab."+config+".ContactFolderPath");
		} catch (ex) {}
		

		updateFolder (act);
		updateFolder (act);

		if (sCurFolder != null)
		{
			var tree = document.getElementById ("conImapFolder");
			
			// make sure we have the correct folder in the view
			if (document.getElementById(sCurFolder) != null)
			{			
				var treei = tree.view.getIndexOfItem(document.getElementById(sCurFolder));
				
				tree.view.selection.select(treei); 
				if (tree.boxObject)
					tree.boxObject.scrollToRow(treei);
			}
		}
		
		// same stuff for the calendarcontrols		
		if (isCalendar)
		{
			// the calendar			
			var ab = null;
			try
			{
				ab = pref.getCharPref("SyncKolab."+config+".Calendar");
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
			
			// per default: sync last 6 monts (~180 days)
			document.getElementById ("calSyncTimeframe").value = "180";
			try
			{
				document.getElementById ("calSyncTimeframe").value = pref.getCharPref("SyncKolab."+config+".calSyncTimeframe");
			}	
			catch (ex) {}
			
			document.getElementById ("saveToCalendarImap").checked = true;
			try
			{
				document.getElementById ("saveToCalendarImap").checked = pref.getBoolPref("SyncKolab."+config+".saveToCalendarImap");
			}
			catch (ex) {}
			
			document.getElementById ("syncCalendar").checked = false;
			try {
				document.getElementById ("syncCalendar").checked = pref.getBoolPref("SyncKolab."+config+".syncCalendar");
			} catch (ex) {}
			setControlStateCalendar(document.getElementById ("syncCalendar").checked);
			
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
				// make sure we have the correct folder in the view
				if (document.getElementById(sCurFolder+"c") != null)
				{			
					var treei = tree.view.getIndexOfItem(document.getElementById(sCurFolder+"c"));
					tree.view.selection.select(treei); 
					if (tree.boxObject)
						tree.boxObject.scrollToRow(treei);
				}
			}
			
			// the tasks
			// the calendar			
			ab = null;
			try
			{
				ab = pref.getCharPref("SyncKolab."+config+".Tasks");
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
	
			// per default: sync last 6 monts (~180 days)
			document.getElementById ("taskSyncTimeframe").value = "180";
			try
			{
				document.getElementById ("taskSyncTimeframe").value = pref.getCharPref("SyncKolab."+config+".taskSyncTimeframe");
			}	
			catch (ex) {}
	
			document.getElementById ("saveToTaskImap").checked = true;
			try
			{
				document.getElementById ("saveToTaskImap").checked = pref.getBoolPref("SyncKolab."+config+".saveToTaskImap");
			}
			catch (ex) {}
			
			document.getElementById ("syncTasks").checked = false;
			try {
				document.getElementById ("syncTasks").checked = pref.getBoolPref("SyncKolab."+config+".syncTasks");
			} catch (ex) {}
			setControlStateTasks(document.getElementById ("syncTasks").checked);
			
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
				// make sure we have the correct folder in the view
				if (document.getElementById(sCurFolder+"t") != null)
				{			
					var treei = tree.view.getIndexOfItem(document.getElementById(sCurFolder+"t"));
					tree.view.selection.select(treei); 
					if (tree.boxObject)
						tree.boxObject.scrollToRow(treei);
				}
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

/**
 * Delete all temp/cache - files/folders for this configuration
 */
function resetConfiguration(config)
{
	var file = Components.classes["@mozilla.org/file/directory_service;1"].
	   getService(Components.interfaces.nsIProperties).
	   get("ProfD", Components.interfaces.nsIFile);
	file.append(config+".hdb");
	if (file.exists())
		file.remove(true);

	file = Components.classes["@mozilla.org/file/directory_service;1"].
	   getService(Components.interfaces.nsIProperties).
	   get("ProfD", Components.interfaces.nsIFile);
	file.append("synckolab");

	if (!file.exists())
		return;
	
	file.append("calendar");
	if (file.exists())
	{
		file.append(config);
		if (file.exists())
			file.remove (true);
	}
	

	file = Components.classes["@mozilla.org/file/directory_service;1"].
	   getService(Components.interfaces.nsIProperties).
	   get("ProfD", Components.interfaces.nsIFile);
	file.append("synckolab");

	if (!file.exists())
		return;
	
	file.append("contact");
	if (file.exists())
	{
		file.append(config);
		if (file.exists())
			file.remove (true);
	}

	file = Components.classes["@mozilla.org/file/directory_service;1"].
	   getService(Components.interfaces.nsIProperties).
	   get("ProfD", Components.interfaces.nsIFile);
	file.append("synckolab");

	if (!file.exists())
		return;
	
	file.append("task");
	if (file.exists())
	{
		file.append(config);
		if (file.exists())
			file.remove (true);
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
	resetConfiguration(curConfig);
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
	resetConfiguration(curConfig);
}

function setTaskFolder(uri)
{
	if (curConfig == null)
	{
		return;
	}

	var pref = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
	pref.setCharPref("SyncKolab."+curConfig+".TaskFolderPath", uri);
	resetConfiguration(curConfig);
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

function saveAllPrefs (configName) {
	if (curConfig == null && (!configName || configName == null))
		return;
	
	var config = curConfig;
	
	if (config == null)
		config = configName;
		
	var pref = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
	
	pref.setCharPref("SyncKolab."+config+".IncomingServer", document.getElementById ("ImapAcct").value);
	if (document.getElementById("DefaultResolve"))
		pref.setCharPref("SyncKolab."+config+".Resolve", document.getElementById ("DefaultResolve").value);
	else
		pref.setCharPref("SyncKolab."+config+".Resolve", "ask");
	
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
		if (document.getElementById("calSyncTimeframe") != null)
			pref.setCharPref("SyncKolab."+config+".calSyncTimeframe", document.getElementById("calSyncTimeframe").value);
		else
			pref.setCharPref("SyncKolab."+config+".calSyncTimeframe", "180");
			
		pref.setCharPref("SyncKolab."+config+".Tasks", document.getElementById ("taskURL").value);
		pref.setCharPref("SyncKolab."+config+".TaskFormat", document.getElementById ("taskFormat").value);
		pref.setBoolPref("SyncKolab."+config+".saveToTaskImap", document.getElementById ("saveToTaskImap").checked);
		pref.setBoolPref("SyncKolab."+config+".syncTasks", document.getElementById ("syncTasks").checked);
		if (document.getElementById("taskSyncTimeframe"))
			pref.setCharPref("SyncKolab."+config+".taskSyncTimeframe", document.getElementById("taskSyncTimeframe").value);
		else
			pref.setCharPref("SyncKolab."+config+".taskSyncTimeframe", "180");
	}
}


// called when closed (OK)
function savePrefs() {
	var pref = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);

//	pref.setBoolPref("SyncKolab.syncContacts", document.getElementById ("syncCon").checked);
//	pref.setBoolPref("SyncKolab.syncCalendar", document.getElementById ("syncCal").checked);
	pref.setBoolPref("SyncKolab.closeWindow", document.getElementById ("closeWnd").checked);
	pref.setCharPref("SyncKolab.autoSync", document.getElementById ("syncInterval").value);
	pref.setBoolPref("SyncKolab.hiddenWindow", document.getElementById ("hiddenWnd").checked);

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
			if (cur.firstChild.firstChild.getAttribute("id") != "Welcome-Welcome" && cur.firstChild.firstChild.getAttribute("label") != strBundle.getString("aboutSyncKolab"))
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
	window.open('chrome://synckolab/content/newWizard.xul', 'newWizard', 'chrome,resizable=0');
	this.close();
	/*
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
	*/
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
				{
					if (cur.firstChild.firstChild.getAttribute("id") != "Welcome-Welcome" && cur.firstChild.firstChild.getAttribute("label") != strBundle.getString("aboutSyncKolab"))
					{
						// skip this node
						cur = cur.nextSibling;
						continue;
					}
						
					configs += cur.firstChild.firstChild.getAttribute("label") + ";";
				}
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

/**
 * Enables/disables the controls on the page
 */
function setControlStateContacts(active) 
{
	var fieldsArray = new Array(
		"conURL",
		"conImapFolder",
		"conFormat",
		"saveToContactImap"
	);

	
	for(var i=0 ; i < fieldsArray.length ; i++ ) {
		document.getElementById(fieldsArray[i]).disabled = !active;
	}
}


/**
 * Enables/disables the controls on the page
 */
function setControlStateCalendar(active) 
{
	var fieldsArray = new Array(
		"calURL",
		"calImapFolder",
		"calFormat",
		"saveToCalendarImap",
		"calSyncTimeframe"
	);

	
	for(var i=0 ; i < fieldsArray.length ; i++ ) {
		if (document.getElementById(fieldsArray[i]) != null)
			document.getElementById(fieldsArray[i]).disabled = !active;
	}
}

/**
 * Enables/disables the controls on the page
 */
function setControlStateTasks(active) 
{
	var fieldsArray = new Array(
		"taskURL",
		"taskImapFolder",
		"taskFormat",
		"saveToTaskImap",
		"taskSyncTimeframe"
	);

	
	for(var i=0 ; i < fieldsArray.length ; i++ ) {
		if (document.getElementById(fieldsArray[i]) != null)
			document.getElementById(fieldsArray[i]).disabled = !active;
	}
}


/**
 * Save a single Configuration
 */
function saveSingleConfig()
{
	var configName = curConfig;
	var nsIFilePicker = Components.interfaces.nsIFilePicker;
	var fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
	fp.init(window, strBundle.getString("saveConfig"), nsIFilePicker.modeSave);
	fp.appendFilter(strBundle.getString("configFiles"),"*.config");
	fp.defaultString = configName + ".config";
	fp.defaultExtension = "config";
	var res = fp.show();
	if (res == nsIFilePicker.returnOK){
		var thefile = fp.file;
		// open the file
		thefile.create(thefile.NORMAL_FILE_TYPE, 0666);
	 	var stream = Components.classes['@mozilla.org/network/file-output-stream;1'].createInstance(Components.interfaces.nsIFileOutputStream);
	 	stream.init(thefile, 2, 0x200, false); // open as "write only"

		var s = "# SyncKolab V0.6.0 Configuration File\n";
		stream.write(s, s.length);
		writeLine(stream, "Configuration", configName);
		
		writeConfig(configName, stream);
		
		s = "\n\n";
		stream.write(s, s.length);
		stream.close();
	}
}

/**
 * Load a configuration from a file
 */
function loadConfig()
{
	var nsIFilePicker = Components.interfaces.nsIFilePicker;
	var fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
	fp.init(window, strBundle.getString("loadConfig"), nsIFilePicker.modeOpen);
	fp.appendFilter(strBundle.getString("configFiles"),"*.config");
	fp.defaultString = "SyncKolab.config";
	fp.defaultExtension = "config";
	var res = fp.show();
	if (res == nsIFilePicker.returnOK){
		var file = fp.file;

		if ((!file.exists()) || (!file.isReadable()))
			return null;
		
		 // setup the input stream on the file
		var istream = Components.classes["@mozilla.org/network/file-input-stream;1"]
			.createInstance(Components.interfaces.nsIFileInputStream);
		istream.init(file, 0x01, 4, null);
		var fileScriptableIO = Components.classes["@mozilla.org/scriptableinputstream;1"].createInstance(Components.interfaces.nsIScriptableInputStream); 
		fileScriptableIO.init(istream);
		// parse the xml into our internal document
		istream.QueryInterface(Components.interfaces.nsILineInputStream); 
		var fileContent = "";
		var csize = 0; 
		while ((csize = fileScriptableIO.available()) != 0)
		{
			fileContent += fileScriptableIO.read( csize );
		}
		fileScriptableIO.close(); 	
		istream.close();

	 	// read basics
		var pref = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
		var lePrefs = fileContent.split("\n");
		
		var fullPref = false;
		for (var i=0; i < lePrefs.length; i++)
		{
			if (lePrefs[i].indexOf("SyncKolab.Configs") != -1)
				fullPref = true;		
		}
		
		if (fullPref)
		{
			if (!confirm(strBundle.getString("configReplaceAll")))
				return;
				
			for (var i=0; i < lePrefs.length; i++)
			{
				var cLine = lePrefs[i].trim();
				// skip comments
				if (cLine.indexOf("#") == 0)
					continue;
				if (cLine.length < 4)
					continue;
				
				var cPref = cLine.split('=');
				var name = cPref[0].trim();
				
				var value = cPref[1];
				for (var j=2; j < cPref.length; j++)
					value += "=" + cPref[j];
					
				if (value == "true" || value == "false")
					pref.setBoolPref(value == 'true');
				else
					pref.setCharPref(name, value);				
			}
		}
		else
		{
			var prefName = null;
			for (var i=0; i < lePrefs.length; i++)
			{
				var cLine = lePrefs[i].trim();
				if (cLine.indexOf("Configuration") == 0)
					prefName = cLine.split('=')[1].trim();
			}
			
			if (prefName == null)
			{
				alert(strBundle.getString("configInvalid"));
				return;
			}

			// get all available configurations
			var configs = new Array();
		
			try {
				var Config = pref.getCharPref("SyncKolab.Configs");
				configs = Config.split(';');
			} catch(ex) {}

			var haveConfig = false;			
			for (var i=0; i < configs.length; i++)
			{
				if (configs[i] == prefName)
				{
					if (!confirm(strBundle.getString("configOverwrite") + prefName))
						return;
					haveConfig = true;
					break;
				}
			}
			
			if (!haveConfig)
			{
				var Config = configs.join(";");
				Config += ";" + prefName;
				pref.setCharPref("SyncKolab.Configs", Config);
			}

			for (var i=0; i < lePrefs.length; i++)
			{
				var cLine = lePrefs[i].trim();
				// skip comments
				if (cLine.indexOf("#") == 0)
					continue;
				if (cLine.indexOf("Configuration") == 0)
					continue;
				if (cLine.length < 4)
					continue;
				
				var cPref = cLine.split('=');
				var name = cPref[0].trim();
				
				var value = cPref[1];
				for (var j=2; j < cPref.length; j++)
					value += "=" + cPref[j];
					
				if (value == "true" || value == "false")
					pref.setBoolPref(value == 'true');
				else
					pref.setCharPref(name, value);				
			}
			
		}
	}
	
	// reopen config dialog
	window.open('chrome://synckolab/content/synckolabPref.xul', '', 'chrome,resizable=1');
	this.close();	
}

/**
 * Save all Configurations (incl. global options)
 */
function saveAllConfig()
{
	var nsIFilePicker = Components.interfaces.nsIFilePicker;
	var fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
	fp.init(window, strBundle.getString("saveConfig"), nsIFilePicker.modeSave);
	fp.appendFilter(strBundle.getString("configFiles"),"*.config");
	fp.defaultString = "SyncKolab.config";
	fp.defaultExtension = "config";
	var res = fp.show();
	if (res == nsIFilePicker.returnOK || res == nsIFilePicker.returnReplace){
		var thefile = fp.file;

	 	// write basics
		var pref = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);

		// get all available configurations
		var configs = new Array();
	
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
			return;
		}

		// open the file
		if(!thefile.exists()) {
			thefile.create(thefile.NORMAL_FILE_TYPE, 0666);
		}
	 	var stream = Components.classes['@mozilla.org/network/file-output-stream;1'].createInstance(Components.interfaces.nsIFileOutputStream);
	 	stream.init(thefile, 2, 0x200, false); // open as "write only"

		var s = "# SyncKolab V0.6.0 Configuration File\n";
		stream.write(s, s.length);

		// generate the configuration in the tree control 	
		s = '';
		for (var i=0; i < configs.length; i++)
		{
			s += configs[i] + ';';
			writeConfig(configs[i], stream);
		}
		writeLine(stream, "SyncKolab.Configs", s);
		
		// char prefs:
		var fieldsArray = new Array(
			"closeWindow","autoSync","hiddenWindow"
			);
	
		for(var i=0 ; i < fieldsArray.length ; i++ ) {
			try
			{
				writeLine(stream, "SyncKolab." + fieldsArray[i], pref.getCharPref("SyncKolab." + fieldsArray[i]));
			}
			catch (exw) {} // can be ignored savely
		}	
		
		s = "\n\n";
		stream.write(s, s.length);
		stream.close();
	}
}

function writeLine (file, key, value)
{
	if (value == null || key == null)
		return;
	var s = key + "=" + value + "\n";
	file.write(s, s.length);
}
/**
 * Writes the configuration into a open file stream
 */
function writeConfig (config, file)
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
	
	writeLine(file, "SyncKolab."+config+".IncomingServer", act);
	
	// char prefs:
	var fieldsArray = new Array(
		"AddressBook","AddressBookFormat","calSyncTimeframe","taskSyncTimeframe",
		"ContactFolderPath","Calendar","CalendarFormat","Resolve",
		"CalendarFolderPath",
		"Tasks","TaskFormat","TaskFolderPath"
		);

	for(var i=0 ; i < fieldsArray.length ; i++ ) {
		try
		{
			writeLine(file, "SyncKolab."+config+"." + fieldsArray[i], pref.getCharPref("SyncKolab."+config+"." + fieldsArray[i]));
		}
		catch (exw) {} // can be ignored savely
	}	
	
	// bool prefs:
	var fieldsArray = new Array(
		"syncContacts","saveToContactImap",
		"saveToCalendarImap","syncCalendar",
		"saveToTaskImap","syncTasks"
		);

	for(var i=0 ; i < fieldsArray.length ; i++ ) {
		try
		{
			writeLine(file, "SyncKolab."+config+"." + fieldsArray[i], pref.getBoolPref("SyncKolab."+config+"." + fieldsArray[i])?'true':'false');
		}
		catch (exw) {} // can be ignored savely
	}	
	
}