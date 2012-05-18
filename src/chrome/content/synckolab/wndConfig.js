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
 * Contributor(s): Niko Berger <niko.berger(at)corinis.com>
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
"use strict";

if(!com) var com={};
if(!com.synckolab) com.synckolab={};

com.synckolab.settings = {
		// string bundle use: strBundle.getString("KEYNAME")
		strBundle: null,
		// account types
		baseTypes: ["contact", "calendar", "task"],
		// the current configuration
		config: null
};



com.synckolab.settings.savePrefs = function () {
	

	// get base info back from ui
	com.synckolab.tools.logMessage("Saving preferences.", com.synckolab.global.LOG_DEBUG);
	com.synckolab.settings.getBaseInfo();
	com.synckolab.tools.logMessage("Getting info.", com.synckolab.global.LOG_DEBUG);
	com.synckolab.settings.getInfo();
	
	com.synckolab.tools.logMessage("Write the configuration: " + com.synckolab.settings.config.toSource(), com.synckolab.global.LOG_DEBUG);
	// write the configuration
	com.synckolab.settings.writeConfiguration(com.synckolab.settings.config);
	com.synckolab.tools.logMessage("done saving.", com.synckolab.global.LOG_DEBUG);

	return true;
};

/**
 * write the configuration back. 
 * This will first read the current config and then write back the new configuration.
 * The current is required to be able to delete unwanted/uneeded keys.
 * @param conf the configuration to write
 * @return true if everything went ok
 */
com.synckolab.settings.writeConfiguration = function(config) {
	var orig = com.synckolab.config.loadConfiguration();
	// now we can start writing
	var pref = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
	
	com.synckolab.tools.setConfigValue(pref, "configVersion", com.synckolab.tools.CONFIG_TYPE_INT, config.version + 1);
	com.synckolab.tools.setConfigValue(pref, "debugLevel", com.synckolab.tools.CONFIG_TYPE_INT, config.debugLevel);
	com.synckolab.tools.setConfigValue(pref, "hideFolder", com.synckolab.tools.CONFIG_TYPE_BOOL, config.hideFolder);
	com.synckolab.tools.setConfigValue(pref, "hiddenWindow", com.synckolab.tools.CONFIG_TYPE_BOOL, config.hiddenWindow);
	com.synckolab.tools.setConfigValue(pref, "syncOnStart", com.synckolab.tools.CONFIG_TYPE_BOOL, config.syncOnStart);
	
	// check if an account has been removed
	var i,j,found;
	if (orig) {
		for(i = 0; i < orig.accounts.length; i++) {
			found = false;
			for(j = 0; config.accounts.length; j++) {
				if(orig.accounts[i].name === config.accounts[j].name) {
					found = true;
					break;
				}
			}
			if(!found) {
				pref.resetBranch("SyncKolab." + orig.accounts[i].name);
			}
		}
	}
	
	// now go through the existing ones
	var acctList = "";
	for(i = 0; i < config.accounts.length; i++) {
		// skip invalid account names
		if(!config.accounts[i] || !config.accounts[i].name || config.accounts[i].name.length < 3) {
			continue;
		}
		
		var origAcct = null;
		if(orig) {
			for(j = 0; orig.accounts.length; j++) {
				if(orig.accounts[j].name === config.accounts[i].name) {
					origAcct = orig.accounts[j];
					break;
				}
			}
		}
		
		// write per account
		com.synckolab.settings.writeAccountConfig(pref, config.accounts[i], origAcct);
		acctList += config.accounts[i].name + ";";
	}

	// write the acctList back
	com.synckolab.tools.setConfigValue(pref, "accounts.list", com.synckolab.tools.CONFIG_TYPE_CHAR, acctList);
	
	return true;
};

/**
 * read the account configuration into an object
 * @param acct the account object to read the configuration into (name has to be existent)
 */
com.synckolab.settings.writeAccountConfig = function (pref, acct, orig) {
	var configs, i, j, k, found;
	for(var type in acct) {
		// skip volatiles/non-arrays
		if(type !== "name" && acct[type].push) {
			// clear old ones
			if(orig) {
				for(i=0; i < orig[type].length; i++) {
					found = false;
					for(j=0; j < acct[type].length; j++) {
						if(acct[type][j].name === orig[type][i].name) {
							found = true;
							break;
						}
					}
					// get rid of the deleted configuration branches
					if(!found) {
						try {
							com.synckolab.settings.resetConfiguration(acct.name, type, orig[type][i].name);
							pref.resetBranch("SyncKolab.accounts." + acct.name + "." + type + ".configs." + orig[type][i].name);
						} catch (ex) {
							
						}
					}
				}
			}
			
			configs = "";
			for(i=0; i < acct[type].length; i++) {
				if(!acct[type][i] || !acct[type][i].name || acct[type][i].name.length < 3) {
					continue;
				}

				com.synckolab.tools.logMessage("checking " + type + "- " + acct[type][i].name, com.synckolab.global.LOG_DEBUG);

				// if some values change - the cache needs to reset
				if(orig && orig[type]) {
					for(j=0; j < orig[type].length; j++) {
						if(acct[type][i].name === orig[type][j].name) {
							var resetTriggers = ["source", "folderPath", "format"];
							for(k=0; k < resetTriggers.length; k++) {
								var trigger = resetTriggers[k];
								if(acct[type][i][trigger] !== orig[type][j][trigger]) {
									com.synckolab.tools.logMessage("found change trigger - reset config", com.synckolab.global.LOG_DEBUG);
									com.synckolab.settings.resetConfiguration(acct.name, type, acct[type][i].name);
									com.synckolab.tools.logMessage("finished reset for " + acct.name + " " + type, com.synckolab.global.LOG_DEBUG);
									break;
								}
							}
							break;
						}
					}
				}
				
				// write all the base settings
				for(var n in com.synckolab.config.baseSetting) {
					// skip unwanted prototypes (without type)
					if(com.synckolab.config.baseSetting[n].type >= 0) {
						com.synckolab.tools.setConfigValue(pref, 
								"accounts." + acct.name+"." + type + ".configs." + acct[type][i].name + "." + n, 
								com.synckolab.config.baseSetting[n].type, 
								acct[type][i][n]);
					}
				}

				configs += acct[type][i].name + ";";
			}
			
			// write the configList back
			com.synckolab.tools.setConfigValue(pref, "accounts." + acct.name + "." + type + ".list", com.synckolab.tools.CONFIG_TYPE_CHAR, configs);
		}
	}
};

/**
 * Init function. This is called when the configuration dialog or wizard is started.
 * This will read the current configuration and the window elements.
 */
com.synckolab.settings.init = function () {
	var i = 0, j;

	// load the string bundle for translation
	com.synckolab.settings.strBundle = document.getElementById("synckolabBundle");
	// check if calendar is available
	com.synckolab.settings.isCalendar = com.synckolab.calendarTools.isCalendarAvailable();
	// read the current configuration
	com.synckolab.settings.config = com.synckolab.config.loadConfiguration();

	// the format selection boxes:
	var abList = document.getElementById("contactFormat");
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

	abList = document.getElementById("calendarFormat");
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
	
	// the adress book list
	// fill the contact selection
	var cn = com.synckolab.addressbookTools.getABDirectory();
	var ABook = cn.getNext();

	// we only have ONE address book - means a fresh install - notify the user
	if(ABook === null) {
		alert(this.strBundle.getString("noAddressBook"));
		// close the window
		window.close();
	}

	this.fillAddressBook(cn, ABook);

	// the calendar
	// if we do not have a calendar, we can easily skip this
	if (com.synckolab.settings.isCalendar)
	{
		var calendars = com.synckolab.calendarTools.getCalendars();
		abList = document.getElementById("calendarURL");
		abpopup = document.createElement("menupopup");
		abList.appendChild(abpopup);

		var taskList = document.getElementById("taskURL");
		var taskpopup = document.createElement("menupopup");
		taskList.appendChild(taskpopup);

		// get the calendar manager to find the right files
		for (i = 0; i < calendars.length; i++ )
		{
			// only non-remote calendars - hey we are already doin remote sync here :)
			abchild = document.createElement("menuitem");
			abpopup.appendChild(abchild);
			abchild.setAttribute("label", calendars[i].name);
			abchild.setAttribute("value", com.synckolab.tools.text.fixNameToMiniCharset(calendars[i].name));
			if (i === 0)
			{
				abchild.setAttribute("selected", "true");
				abList.setAttribute("label", calendars[i].name);
				abList.setAttribute("value", com.synckolab.tools.text.fixNameToMiniCharset(calendars[i].name));
			}

			abchild = document.createElement("menuitem");
			taskpopup.appendChild(abchild);
			abchild.setAttribute("label", calendars[i].name);
			abchild.setAttribute("value", com.synckolab.tools.text.fixNameToMiniCharset(calendars[i].name));
			if (i === 0)
			{
				abchild.setAttribute("selected", "true");
				taskList.setAttribute("label", calendars[i].name);
				taskList.setAttribute("value", com.synckolab.tools.text.fixNameToMiniCharset(calendars[i].name));
			}
		}
	}
	
	// get the root tree element
	var tree = document.getElementById("configTree");

	var ctree = null;

	// the about
	var cnode = tree.firstChild;
	while (cnode !== null)
	{
		if (cnode.nodeName === "treechildren")
		{
			ctree = cnode;
			break;
		}
		cnode = cnode.nextSibling;
	}

	if (ctree === null) {
		return null;
	}

	var tItem = document.createElement("treeitem");
	tItem.setAttribute("container", "true");
	tItem.setAttribute("open", "true");
	ctree.appendChild(tItem);
	var tRow = document.createElement("treerow");
	tItem.appendChild(tRow);
	var tCell = document.createElement("treecell");
	tRow.appendChild(tCell);
	tItem.setAttribute("id", "Welcome-Welcome");
	tCell.setAttribute("label", this.strBundle.getString("aboutSyncKolab"));
	tCell.setAttribute("value", "Welcome-Welcome");

	// the account nodes
	var actList = document.getElementById("ImapAcct");
	var actpopup = document.createElement("menupopup");
	var gAccountManager = Components.classes['@mozilla.org/messenger/account-manager;1'].getService(Components.interfaces.nsIMsgAccountManager);
	
	for (i = 0; i < gAccountManager.allServers.Count(); i++)
	{
		var account = gAccountManager.allServers.GetElementAt(i).QueryInterface(Components.interfaces.nsIMsgIncomingServer);
		com.synckolab.tools.logMessage("Account found: " + account.rootMsgFolder.baseMessageURI, com.synckolab.global.LOG_DEBUG);		
		if (account.rootMsgFolder.baseMessageURI.toLowerCase().indexOf("imap") === -1)
		{
			com.synckolab.tools.logMessage("Account " + account.rootMsgFolder.baseMessageURI + " is not an imap account - skipping!", com.synckolab.global.LOG_INFO);
			continue;
		}
		
		var acctName = com.synckolab.tools.text.fixNameToMiniCharset(account.prettyName);
		
		tItem = document.createElement("treeitem");
		tItem.setAttribute("container", "true");
		tItem.setAttribute("open", "true");
		ctree.appendChild(tItem);
		tRow = document.createElement("treerow");
		tItem.appendChild(tRow);
		tCell = document.createElement("treecell");
		tRow.appendChild(tCell);
		tItem.setAttribute("id", "tab-Acct-" + acctName);
		tCell.setAttribute("label", account.prettyName);
		tCell.setAttribute("value", "tab-Acct-" + acctName);
		
		// now for the configurations
		var tChildren = document.createElement("treechildren");
		tItem.appendChild(tChildren);
		
		for (j = 0; j < com.synckolab.settings.baseTypes.length;j++) {
			
			// fill in the childs with the configs
			tItem = document.createElement("treeitem");
			tItem.setAttribute("container", "true");
			tItem.setAttribute("open", "true");
			tChildren.appendChild(tItem);
			tRow = document.createElement("treerow");
			tItem.appendChild(tRow);
			tCell = document.createElement("treecell");
			tRow.appendChild(tCell);
			tItem.setAttribute("id", "tab-"+com.synckolab.settings.baseTypes[j]+"-" + acctName);
			tCell.setAttribute("label", this.strBundle.getString(com.synckolab.settings.baseTypes[j]));
			tCell.setAttribute("value", "tab-"+com.synckolab.settings.baseTypes[j]+"-" + acctName);
			
		}
	}

	com.synckolab.settings.fillBaseInfo();
	com.synckolab.settings.repaintConfigTree();
};

/**
 * re-create the config tree,
 */
com.synckolab.settings.repaintConfigTree = function() {
	// remove all nodes under tab-account-[cal|con|task]
	var conf = com.synckolab.settings.config;

	com.synckolab.settings.batch = true;

	for(var i = 0; i < conf.accounts.length; i++) {
		var acctName = conf.accounts[i].name;
		for (var j = 0; j < com.synckolab.settings.baseTypes.length;j++) {
			var cType = com.synckolab.settings.baseTypes[j];
			var tItem = document.getElementById("tab-" + cType +"-" + acctName);
			// delete the treechildren if exist
			var cnode = tItem.firstChild;
			while (cnode !== null)
			{
				if (cnode.nodeName === "treechildren")
				{
					tItem.removeChild(cnode);
					break;
				}
				cnode = cnode.nextSibling;
			}
			
			// now re-create them
			var tChildren = document.createElement("treechildren");
			tItem.appendChild(tChildren);
			var configs = conf.accounts[i][cType];
			
			for(var k = 0; k < configs.length;k++) {
				var confName = configs[k].name;
				
				tItem = document.createElement("treeitem");
				//tItem.setAttribute("container", "true");
				//tItem.setAttribute("open", "true");
				tChildren.appendChild(tItem);
				var tRow = document.createElement("treerow");
				tItem.appendChild(tRow);
				var tCell = document.createElement("treecell");
				tRow.appendChild(tCell);
				tItem.setAttribute("id", "tab-"+cType+"-" + acctName + "-" + confName);
				tCell.setAttribute("label", confName);
				tCell.setAttribute("value", "tab-"+cType+"-" + acctName + "-" + confName);
			}
		}
	}

	com.synckolab.settings.batch = false;
};

/**
 * fills the addressbook select box
 * @param cn the abook cn
 * @param ABook the address book to use
 */
com.synckolab.settings.fillAddressBook = function (cn, ABook) {
	var abList = document.getElementById("contactURL");
	// delete the childs of the list
	var cnode = abList.firstChild;
	while (cnode !== null)
	{
		if (cnode.nodeName === "menupopup")
		{
			abList.removeChild(cnode);
		}
		cnode = cnode.nextSibling;
	}

	var abpopup = document.createElement("menupopup");
	abList.appendChild(abpopup);

	var isFirst = true;
	while (ABook !== null)
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
			if (cn.hasMoreElements()) {
				ABook = cn.getNext();
			} else {
				break;
			}
		}
		catch (ex)
		{
			break;
		}
	}
};

/**
 * set all folders after an account change
 */
com.synckolab.settings.setFolders = function (act) {
	
	this.updateFolder(act, [{
		prefix: "contact",
		node: document.getElementById("contactImapFolder")
	},{
		prefix: "calendar",
		node: document.getElementById("calendarImapFolder")
	},{
		prefix: "tasks",
		node: document.getElementById("taskImapFolder")
	}]);
};

/**
 * update the folder based on the given account
 * @param act the account to search for
 * @param sets an array of prefix/node object for each element to fill
 */
com.synckolab.settings.updateFolder = function (act, sets) {
	// dynamically read this...
	var gAccountManager = Components.classes['@mozilla.org/messenger/account-manager;1'].getService(Components.interfaces.nsIMsgAccountManager);
	for (var i = 0; i < gAccountManager.allServers.Count(); i++)
	{
		try
		{
			var account = gAccountManager.allServers.GetElementAt(i).QueryInterface(Components.interfaces.nsIMsgIncomingServer);
			if (account.rootMsgFolder.baseMessageURI === act || com.synckolab.tools.text.fixNameToMiniCharset(account.prettyName) === act)
			{
				for(var j = 0; j < sets.length; j++) {
					var cfold = sets[j].node;
					// delete the treechildren if exist
					var cnode = cfold.firstChild;
					while (cnode !== null)
					{
						if (cnode.nodeName === "treechildren")
						{
							cfold.removeChild(cnode);
							break;
						}
						cnode = cnode.nextSibling;
					}
	
					// ok show some folders:
					var tChildren = document.createElement("treechildren");
					cfold.appendChild(tChildren);
					sets[j].node = tChildren;
				}
				com.synckolab.settings.updateFolderElements(account.rootFolder, sets, "");
				return;

			}
		}
		catch (ex)
		{

		}
	}
};

/**
 * updates the folder tree
 * @param msgFolder the current folder
 * @param root the current dom root
 */
com.synckolab.settings.updateFolderElements = function (msgFolder, origSets)
{
	var j, tItem, tRow, tCell, tChildren;
	var sets = [];
	for(j = 0; j < origSets.length; j++) {
		sets.push({
			prefix: origSets[j].prefix,
			node: origSets[j].node
		});
	}
	
	for(j = 0; j < sets.length; j++) {
		tItem = document.createElement("treeitem");
		tRow = document.createElement("treerow");
		tItem.appendChild(tRow);
		tCell = document.createElement("treecell");
		tRow.appendChild(tCell);
		tItem.setAttribute("id", sets[j].prefix + msgFolder.URI);
		tCell.setAttribute("label", msgFolder.prettyName);
		tCell.setAttribute("value", msgFolder.URI);
		sets[j].node.appendChild(tItem);
		sets[j].node = tItem;
	}
	
	if (msgFolder.hasSubFolders )
	{
		for(j = 0; j < sets.length; j++) {
			sets[j].node.setAttribute("container", "true");
			sets[j].node.setAttribute("open", "true");
			tChildren = document.createElement("treechildren");
			sets[j].node.appendChild(tChildren);
			sets[j].node = tChildren;
		}
		// tbird 3 uses subFolders enumerator instead of getsubfolders
		var subfolders = msgFolder.subFolders ? msgFolder.subFolders : msgFolder.GetSubFolders();

		// this block is only for tbird < 3
		try
		{
			if (subfolders.first) {
				subfolders.first();
			}
		}
		catch (ex)
		{
			alert("NOTHING: " + msgFolder.prettyName);
			return;
		}

		var folders = [];
		
		while (subfolders !== null)
		{
			var cur = null;
			// tbird < 3
			if (subfolders.currentItem) {
				cur = subfolders.currentItem();
			} else {
				cur = subfolders.getNext();
			}

			if (cur === null) {
				break;
			}

			cur = cur.QueryInterface(Components.interfaces.nsIMsgFolder);
			folders.push(cur);

			// break condition tbird3
			if (subfolders.hasMoreElements && !subfolders.hasMoreElements()) {
				break;
			}

			// tbird <3 break condition
			if (subfolders.isDone && subfolders.isDone()) {
				break;
			}
			if (subfolders.next)
			{
				try
				{
					subfolders.next();
				}
				catch (exi1)
				{
					break;
				}
			}

		}
		folders.sort(function(a,b) {
			
			var sa = a.prettyName.toLowerCase();
			var sb = b.prettyName.toLowerCase();
			if(sa === sb) {
				return 0;
			}
			return (sa < sb) ? -1 : 1;
		});
		for(var i = 0; i < folders.length; i++) {
			com.synckolab.settings.updateFolderElements(folders[i], sets);
		}

	}
};

/**
 * adapts the current configuration based on the selected tree item.
 * The rule is: 
 * <ul>
 *  <li>tab-Welcome: shows the welcome screen</li>
 *  <li>tab-Acct-$acctname: show the account configuration (will be automatically shown per configured imap account)</li>
 *  <li>tab-[Contact|Calendar|Task]-$acctname-$configName: show the configuration for the given account/configuration combo</li>
 * </ul>
 * @param viewname the item selected
 */
com.synckolab.settings.setSyncPrefView = function(viewName) {
	if (viewName.indexOf("-") === -1)
	{
		alert("Fatal ERROR - unable to get view - Pleasere install!");
		return;
	}
	
	// skip this if we update the tree
	if (com.synckolab.settings.batch) {
		return;
	}

	// default: disable new and delete buttons
	document.getElementById("newConfig").setAttribute("disabled", true);
	document.getElementById("delConfig").setAttribute("disabled", true);
	document.getElementById("loadConfig").setAttribute("disabled", true);
	
	var opts = viewName.split("-");
	// display the correct view
	var tabs = document.getElementById("tabs");

	// save changes if contact/cal or task was open before
	com.synckolab.settings.getInfo();

	// remember the type
	com.synckolab.settings.activeType = opts[1];
	if(opts.length > 2) {
		if(com.synckolab.settings.activeAccount !== opts[2]) {
			com.synckolab.settings.activeAccount = opts[2];
			com.synckolab.settings.setFolders(com.synckolab.settings.activeAccount);
		}
	}
	switch (opts[1])
	{
	// on welcome we return - no change config
	case "Welcome":
		tabs.selectedPanel = document.getElementById("welcome");
		return;
	case "Acct":
		tabs.selectedPanel = document.getElementById("accountTab");
		com.synckolab.settings.fillAccountInfo(opts[2]);
		document.getElementById("loadConfig").setAttribute("disabled", false);
		break;
	case "contact":
		if(opts.length > 3) {
			tabs.selectedPanel = document.getElementById("contactTab");
			com.synckolab.settings.fillInfo("contact", opts[2],opts[3]);
			document.getElementById("delConfig").setAttribute("disabled", false);
		} else {
			document.getElementById("newConfig").setAttribute("disabled", false);
		}
		break;
	case "calendar":
		if (this.isCalendar && opts.length > 3) {
			tabs.selectedPanel = document.getElementById("calTab");
			com.synckolab.settings.fillInfo("calendar", opts[2],opts[3]);
			document.getElementById("delConfig").setAttribute("disabled", false);
		} else {
			document.getElementById("newConfig").setAttribute("disabled", false);
		}
		break;
	case "task":
		if (this.isCalendar && opts.length > 3) {
			tabs.selectedPanel = document.getElementById("taskTab");
			com.synckolab.settings.fillInfo("task", opts[2],opts[3]);
			document.getElementById("delConfig").setAttribute("disabled", false);
		} else {
			document.getElementById("newConfig").setAttribute("disabled", false);
		}
		break;
	default:
	}
};

/**
 * fills the base info dialog from the current active config
 */
com.synckolab.settings.fillBaseInfo = function() {
	
	var conf = com.synckolab.settings.config;
	document.getElementById("hideFolder").checked = conf.hideFolder;
	document.getElementById("hiddenWnd").checked = conf.hiddenWindow;
	document.getElementById("syncOnStart").checked = conf.syncOnStart;
	
	if (conf.debugLevel) {
		var debugEle = document.getElementById("debugLevel");
		debugEle.setAttribute("value", conf.debugLevel);
		var iCLabel = conf.debugLevel;
		while (iCLabel > 3) {
			iCLabel -= 4;
		}

		var sCLabel = "skDebugLevel"+iCLabel;
		var cLabel = document.getElementById(sCLabel);
		// get the label
		if (cLabel !== null) {
			debugEle.setAttribute("label", cLabel.getAttribute("label"));
		} else {
			com.synckolab.tools.logMessage("WARNING: could not find Label " + sCLabel, com.synckolab.global.LOG_WARNING);
		}
	}
	
};

/**
 * Enables/disables the controls on the page
 */
com.synckolab.settings.setControlState = function (type, active) 
{
	var fieldsArray = [
			"URL",
			"ImapFolder",
			"Format",
			"SyncListenerImap",
			"SaveToImap"
	];
	for(var i=0 ; i < fieldsArray.length ; i++ ) {
		if(fieldsArray[i] !== '') {
			document.getElementById(type + fieldsArray[i]).disabled = !active;
		}
	}
};

/**
 * gets the account object from the given configuration.
 * @param config the config object to search in
 * @param name the name of the account to find
 * @param create set to true to create the account object if it doesnt exist
 * @returns the account object and possibly null if create is false
 */
com.synckolab.settings.getAccount = function(config, name, create) {
	for(var i = 0; i < config.accounts.length; i++) {
		if(config.accounts[i].name === name) {
			return config.accounts[i];
		}
	}
	if(create) {
		var acct = {
				name: name,
				contact: [],
				calendar: [],
				task: []
		};
		config.accounts.push(acct);
		return acct;
	}
	return null;
};

/**
 * gets the account object from the given configuration.
 * @param config the config object to search in
 * @param name the name of the account to find
 * @param create set to true to create the account object if it doesnt exist
 * @returns the account object and possibly null if create is false
 */
com.synckolab.settings.getAccountIdx = function(config, name) {
	for(var i = 0; i < config.accounts.length; i++) {
		if(config.accounts[i].name === name) {
			return i;
		}
	}
	return null;
};

/**
 * set the base information from the ui in the current conig object
 */
com.synckolab.settings.getBaseInfo = function() {
	var conf = com.synckolab.settings.config;
	conf.hideFolder = document.getElementById("hideFolder").checked;
	conf.debugLevel = document.getElementById("debugLevel").value;
	conf.hiddenWindow = document.getElementById("hiddenWnd").checked;
	conf.syncOnStart = document.getElementById("syncOnStart").checked;
};


/**
 * Helper function that checks the globals for the currently active config.
 * It is based on Account+Type+Config name
 * @returns null if not found, otherwise the config sub-object
 */
com.synckolab.settings.getActiveConfig = function() {
	// nothing to save back
	if(!com.synckolab.settings.activeType || !com.synckolab.settings.activeAccount || !com.synckolab.settings.activeConfig) {
		return null;
	}
	
	// get the right tree in the configuration object
	var conf = com.synckolab.settings.config;
	var account = com.synckolab.settings.getAccount(conf, com.synckolab.settings.activeAccount, true);
	var config = null;
	for (var i=0; i < account[com.synckolab.settings.activeType].length; i++) {
		if(account[com.synckolab.settings.activeType][i].name === com.synckolab.settings.activeConfig) {
			config = account[com.synckolab.settings.activeType][i];
			break;
		}
	}
	
	if(config === null) {
		config = { name: com.synckolab.settings.activeConfig };
		account[com.synckolab.settings.activeType].push(config);
	}
	
	return config;
};

/**
 * set the configuration of the open contact/calendar/task info
 */
com.synckolab.settings.getInfo = function() {
	// nothing to save back
	if(!com.synckolab.settings.activeType || !com.synckolab.settings.activeAccount || !com.synckolab.settings.activeConfig) {
		return;
	}
	
	if(com.synckolab.settings.activeType !== "contact" && com.synckolab.settings.activeType !== "calendar" && com.synckolab.settings.activeType !== "task") {
		return;
	} 
		

	var config = com.synckolab.settings.getActiveConfig();
	
	// fill all fields
	var prefix = com.synckolab.settings.activeType;

	// the address book / calendar
	config.source = document.getElementById(prefix + "URL").value;
	// the imap folder path is done by setFolder via callback
	
	// true if the config is enabled
	config.enabled = document.getElementById(prefix + "Sync").checked;
	// save changes to imap (vs. read only)
	config.saveToImap = document.getElementById(prefix + "SaveToImap").checked;
	// automatically sync every X minutes (0 = disable)
	config.syncInterval = document.getElementById(prefix + "SyncInterval").value;
	// format to use: xml|vcard
	config.format = document.getElementById(prefix + "Format").value;
	if(prefix !== "contact") {
		// timeframe to sync in (don't sync entries with an older start-date)
		config.timeFrame = document.getElementById(prefix + "SyncTimeframe").value;
	}
	// what to do with conflicts
	config.defaultResolve = document.getElementById(prefix + "DefaultResolve").value;
	// enable the sync listener
	config.syncListener = document.getElementById(prefix + "SyncListenerImap").checked;
};

/**
 * function for the folder listing. once a folder is selected this is called and sets the new folder in
 * the active config. 
 */
com.synckolab.settings.setFolder = function (uri) {
	var config = com.synckolab.settings.getActiveConfig();
	if (config === null)
	{
		return;
	}
	config.folderPath = uri;
};

com.synckolab.settings.fillAccountInfo = function(acctName) {
	
};

/**
 * fills the info in a config tab
 * @param type the type of configuration (contac|calendar|task)
 * @param acctName the account name
 * @param confName the configuration name
 */
com.synckolab.settings.fillInfo = function(type, acctName, confName) {
	com.synckolab.settings.activeType = type;
	com.synckolab.settings.activeAccount = acctName;
	com.synckolab.settings.activeConfig = confName;
	
	var config = com.synckolab.settings.getActiveConfig();
	var prefix = com.synckolab.settings.activeType;

	var sCurFolder = config.folderPath;
	if (sCurFolder !== null && sCurFolder !== "")
	{
		var tree = document.getElementById(prefix + "ImapFolder");

		// make sure we have the correct folder in the view
		if (document.getElementById(prefix + sCurFolder) !== null)
		{
			var treei = tree.view.getIndexOfItem(document.getElementById(prefix + sCurFolder));
			if (treei < 0) {
				alert("Problem with treeview - unable to select " + treei);
			} else
			{
				tree.view.selection.select(treei); 
				if (tree.boxObject) {
					tree.boxObject.scrollToRow(treei);
				}
			}
		}
	}
	

	// the address book / calendar
	var actList = document.getElementById(prefix + "URL");
	var cur = actList.firstChild.firstChild;
	while (cur !== null)
	{
		if (cur.getAttribute("value") === config.source)
		{
			actList.selectedItem = cur;
			actList.setAttribute("label", cur.getAttribute("label"));
			actList.setAttribute("value", cur.getAttribute("value"));
			break;
		}
		cur = cur.nextSibling;
	}
	
	// true if the config is enabled
	document.getElementById(prefix + "Sync").checked = config.enabled;
	// save changes to imap (vs. read only)
	document.getElementById(prefix + "SaveToImap").checked = config.saveToImap;
	// automatically sync every X minutes (0 = disable)
	document.getElementById(prefix + "SyncInterval").value = config.syncInterval;
	// format to use: xml|vcard
	actList = document.getElementById(prefix + "Format");
	cur = actList.firstChild.firstChild;
	while (cur !== null)
	{
		if (cur.getAttribute("value") === config.format)
		{
			actList.selectedItem = cur;
			actList.setAttribute("label", cur.getAttribute("label"));
			actList.setAttribute("value", cur.getAttribute("value"));
			break;
		}
		cur = cur.nextSibling;
	}

	
	if(prefix !== "contact") {
		// timeframe to sync in (don't sync entries with an older start-date)
		document.getElementById(prefix + "SyncTimeframe").value = config.timeFrame;
	}
	// what to do with conflicts
	actList = document.getElementById(prefix + "DefaultResolve");
	cur = actList.firstChild.firstChild;
	while (cur !== null)
	{
		if (cur.getAttribute("value") === config.defaultResolve)
		{
			actList.selectedItem = cur;
			actList.setAttribute("label", cur.getAttribute("label"));
			actList.setAttribute("value", cur.getAttribute("value"));
			break;
		}
		cur = cur.nextSibling;
	}

	// enable the sync listener
	document.getElementById(prefix + "SyncListenerImap").checked = config.syncListener;

	
};


/**
 * adds a new configuration to an account
 */
com.synckolab.settings.addConfig = function() {
	switch(com.synckolab.settings.activeType) {
		case "contact":
		case "calendar":
		case "task":
			// make sure active config is NOT set (we are creating here)
			com.synckolab.settings.activeConfig = null;

			var retVals = { name: null };
			var res = window.openDialog("chrome://synckolab/content/wndNewConfigType.xul", 
					"newCfg", 
					"modal,width=330,height=180,resizable=0", retVals, com.synckolab.settings.activeType, com.synckolab.settings.config);
			if(retVals.name !== null && retVals.name.length > 2) {
				var acct = com.synckolab.settings.getAccount(com.synckolab.settings.config, com.synckolab.settings.activeAccount, true);
				// check the configs
				for(var i = 0; i < acct[com.synckolab.settings.activeType].length; i++) {
					// already go the configuration
					if(retVals.name === acct[com.synckolab.settings.activeType][i].name) {
						return;
					}
				}
				// create a base config object
				var cConf = {
						name: retVals.name
				};
				
				// read all the base settings
				for(var n in com.synckolab.config.baseSetting) {
					// skip unwanted prototypes (without type)
					if(com.synckolab.config.baseSetting[n].type >= 0) {
						cConf[n] = com.synckolab.config.baseSetting[n].def;
					}
				}
				
				acct[com.synckolab.settings.activeType].push(cConf);
				
				com.synckolab.tools.logMessage("New config: " + com.synckolab.settings.config.toSource(), com.synckolab.global.LOG_DEBUG);
				// repaint the tree and select the newly created node
				com.synckolab.settings.repaintConfigTree("tab-"+com.synckolab.settings.activeType+"-" + com.synckolab.settings.activeAccount + "-" + retVals.name);
			}
	}
};

/**
 * adds a new configuration to an account
 */
com.synckolab.settings.delConfig = function() {
	switch(com.synckolab.settings.activeType) {
		case "contact":
		case "calendar":
		case "task":
			if (confirm(this.strBundle.getFormattedString("configDelete", [com.synckolab.settings.activeConfig]))) {
				
				var acctIdx = com.synckolab.settings.getAccountIdx(com.synckolab.settings.config, com.synckolab.settings.activeAccount);
				var acct = com.synckolab.settings.config.accounts[acctIdx];
				
				// update the configs
				var configs = [];
				for(var i = 0; i < acct[com.synckolab.settings.activeType].length; i++) {
					// already go the configuration
					if(com.synckolab.settings.activeConfig !== acct[com.synckolab.settings.activeType][i].name) {
						configs.push(acct[com.synckolab.settings.activeType][i]);
					}
				}
				acct[com.synckolab.settings.activeType] = configs;
				
				com.synckolab.settings.activeConfig = null;
				com.synckolab.settings.activeType = null;
				
				// repaint the tree and select the parent 
				com.synckolab.settings.repaintConfigTree();
				// select root
				com.synckolab.settings.setSyncPrefView("Welcome-Welcome");

				return;
				
			}
	}
};

/**
 * Delete all temp/cache - files/folders for this configuration
 * @param config the config name
 * @param type CALENDAR|TASK|CONTACT + FOLDER
 */
com.synckolab.settings.resetConfiguration = function (account, type, config)
{
	com.synckolab.tools.logMessage("Resetting " + account + "!", com.synckolab.global.LOG_INFO);

	var file = Components.classes["@mozilla.org/file/directory_service;1"].getService(Components.interfaces.nsIProperties).get("ProfD", Components.interfaces.nsIFile);
	file.append("synckolab." + com.synckolab.tools.text.fixNameToMiniCharset(account) + "." + type + "." + config + ".hdb");
	if (file.exists()) {
		file.remove(true);
	}

	file = Components.classes["@mozilla.org/file/directory_service;1"].getService(Components.interfaces.nsIProperties).get("ProfD", Components.interfaces.nsIFile);
	file.append("synckolab");

	if (!file.exists()) {
		return;
	}

	file.append(com.synckolab.tools.text.fixNameToMiniCharset(account));
	if (file.exists())
	{
		file.append(type + "_" + config);
		if (file.exists()) {
			file.remove(true);
		}
	}
};