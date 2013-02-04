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
 * Copyright (c) Kolab Systems 2012
 * Author: Niko Berger <berger@kolabsys.com>
 * Contributor(s): 
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

if(!synckolab) var synckolab={};

synckolab.settings = {
		// string bundle use: strBundle.getString("KEYNAME")
		strBundle: null,
		// account types
		baseTypes: ["contact", "calendar", "task"],
		// the current configuration
		config: null,
		// time for callbacks so not to block the ui
		timer: Components.classes["@mozilla.org/timer;1"].createInstance(Components.interfaces.nsITimer),
		// milliseconds for async switch
		SWITCH_TIME: 200
};



synckolab.settings.savePrefs = function () {
	

	// get base info back from ui
	synckolab.tools.logMessage("Saving preferences.", synckolab.global.LOG_DEBUG);
	synckolab.settings.getBaseInfo();
	synckolab.tools.logMessage("Getting info.", synckolab.global.LOG_DEBUG);
	synckolab.settings.getInfo();
	
	synckolab.tools.logMessage("Write the configuration: " + synckolab.settings.config.toSource(), synckolab.global.LOG_DEBUG);
	// write the configuration
	synckolab.settings.writeConfiguration(synckolab.settings.config);
	synckolab.tools.logMessage("done saving.", synckolab.global.LOG_DEBUG);

	return true;
};

/**
 * write the configuration back. 
 * This will first read the current config and then write back the new configuration.
 * The current is required to be able to delete unwanted/uneeded keys.
 * @param conf the configuration to write
 * @return true if everything went ok
 */
synckolab.settings.writeConfiguration = function(config) {
	var orig = synckolab.config.loadConfiguration();
	// now we can start writing
	var pref = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
	
	synckolab.tools.setConfigValue(pref, "configVersion", synckolab.tools.CONFIG_TYPE_INT, config.version + 1);
	synckolab.tools.setConfigValue(pref, "debugLevel", synckolab.tools.CONFIG_TYPE_INT, config.debugLevel);
	synckolab.tools.setConfigValue(pref, "hideFolder", synckolab.tools.CONFIG_TYPE_BOOL, config.hideFolder);
	synckolab.tools.setConfigValue(pref, "closeWindow", synckolab.tools.CONFIG_TYPE_BOOL, config.closeWindow);
	synckolab.tools.setConfigValue(pref, "syncOnStart", synckolab.tools.CONFIG_TYPE_BOOL, config.syncOnStart);
	
	// check if an account has been removed
	var i,j,found;
	if (orig && orig.accounts) {
		for(i = 0; i < orig.accounts.length; i++) {
			found = false;
			for(j = 0; j < config.accounts.length; j++) {
				if(orig.accounts[i] && config.accounts[j] && orig.accounts[i].name === config.accounts[j].name) {
					found = true;
					break;
				}
			}
			if(!found) {
				synckolab.tools.logMessage("resetting " + orig.accounts[i].name, synckolab.global.LOG_DEBUG);
				pref.resetBranch("SyncKolab." + orig.accounts[i].name);
			}
		}
	}
	
	// now go through the existing ones
	var acctList = "";
	for(i = 0; i < config.accounts.length; i++) {
		// skip invalid account names
		if(!config.accounts[i] || !config.accounts[i].name || config.accounts[i].name.length === 0) {
			continue;
		}
		
		var origAcct = null;
		if(orig) {
			for(j = 0; j < orig.accounts.length; j++) {
				if(orig.accounts[j].name === config.accounts[i].name) {
					origAcct = orig.accounts[j];
					break;
				}
			}
		}
		
		// write per account
		synckolab.settings.writeAccountConfig(pref, config.accounts[i], origAcct);
		acctList += config.accounts[i].name + ";";
	}

	// write the acctList back
	synckolab.tools.setConfigValue(pref, "accounts.list", synckolab.tools.CONFIG_TYPE_CHAR, acctList);
	
	return true;
};

/**
 * read the account configuration into an object
 * @param acct the account object to read the configuration into (name has to be existent)
 */
synckolab.settings.writeAccountConfig = function (pref, acct, orig) {
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
							synckolab.settings.resetConfiguration(acct.name, type, orig[type][i].name);
							pref.resetBranch("SyncKolab.accounts." + acct.name + "." + type + ".configs." + orig[type][i].name);
						} catch (ex) {
							
						}
					}
				}
			}
			
			configs = "";
			for(i=0; i < acct[type].length; i++) {
				if(!acct[type][i] || !acct[type][i].name || acct[type][i].name.length === 0) {
					continue;
				}

				synckolab.tools.logMessage("checking " + type + "- " + acct[type][i].name, synckolab.global.LOG_DEBUG);

				// if some values change - the cache needs to reset
				if(orig && orig[type]) {
					for(j=0; j < orig[type].length; j++) {
						if(acct[type][i].name === orig[type][j].name) {
							var resetTriggers = ["source", "folderPath", "format"];
							for(k=0; k < resetTriggers.length; k++) {
								var trigger = resetTriggers[k];
								if(acct[type][i][trigger] !== orig[type][j][trigger]) {
									synckolab.tools.logMessage("found change trigger - reset config", synckolab.global.LOG_DEBUG);
									synckolab.settings.resetConfiguration(acct.name, type, acct[type][i].name);
									synckolab.tools.logMessage("finished reset for " + acct.name + " " + type, synckolab.global.LOG_DEBUG);
									break;
								}
							}
							break;
						}
					}
				}
				
				// write all the base settings
				for(var n in synckolab.config.baseSetting) {
					// skip unwanted prototypes (without type)
					if(synckolab.config.baseSetting[n].type >= 0) {
						synckolab.tools.setConfigValue(pref, 
								"accounts." + acct.name+"." + type + ".configs." + acct[type][i].name + "." + n, 
								synckolab.config.baseSetting[n].type, 
								acct[type][i][n]);
					}
				}

				configs += acct[type][i].name + ";";
			}
			
			// write the configList back
			synckolab.tools.setConfigValue(pref, "accounts." + acct.name + "." + type + ".list", synckolab.tools.CONFIG_TYPE_CHAR, configs);
		}
	}
};

/**
 * Init function. This is called when the configuration dialog or wizard is started.
 * This will read the current configuration and the window elements.
 */
synckolab.settings.init = function () {
	var i = 0, j;
	
	synckolab.settings.checkOldConfig();

	// load the string bundle for translation
	synckolab.settings.strBundle = document.getElementById("synckolabBundle");
	// check if calendar is available
	synckolab.settings.isCalendar = synckolab.calendarTools.isCalendarAvailable();
	// read the current configuration
	synckolab.settings.config = synckolab.config.loadConfiguration();

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
	abchild.setAttribute("value", "xml-k2");

	abchild = document.createElement("menuitem");
	abpopup.appendChild(abchild);
	abchild.setAttribute("label", "Xml/Kolab3");
	abchild.setAttribute("value", "xml-k3");
	abchild.setAttribute("selected", "true");
	
	abList.setAttribute("label", "Xml/Kolab3");
	abList.setAttribute("value", "xml-k3");

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
	abchild.setAttribute("value", "xml-k2");

	abchild = document.createElement("menuitem");
	abpopup.appendChild(abchild);
	abchild.setAttribute("label", "Xml/Kolab3");
	abchild.setAttribute("value", "xml-k3");
	abchild.setAttribute("selected", "true");
	
	abList.setAttribute("label", "Xml/Kolab3");
	abList.setAttribute("value", "xml-k3");

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
	abchild.setAttribute("value", "xml-k2");

	abchild = document.createElement("menuitem");
	abpopup.appendChild(abchild);
	abchild.setAttribute("label", "Xml/Kolab3");
	abchild.setAttribute("value", "xml-k3");
	abchild.setAttribute("selected", "true");
	
	abList.setAttribute("label", "Xml/Kolab3");
	abList.setAttribute("value", "xml-k3");
	
	// the adress book list
	// fill the contact selection
	var cn = synckolab.addressbookTools.getABDirectory();
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
	if (synckolab.settings.isCalendar)
	{
		var calendars = synckolab.calendarTools.getCalendars();
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
			abchild.setAttribute("value", synckolab.tools.text.fixNameToMiniCharset(calendars[i].name));
			if (i === 0)
			{
				abchild.setAttribute("selected", "true");
				abList.setAttribute("label", calendars[i].name);
				abList.setAttribute("value", synckolab.tools.text.fixNameToMiniCharset(calendars[i].name));
			}

			abchild = document.createElement("menuitem");
			taskpopup.appendChild(abchild);
			abchild.setAttribute("label", calendars[i].name);
			abchild.setAttribute("value", synckolab.tools.text.fixNameToMiniCharset(calendars[i].name));
			if (i === 0)
			{
				abchild.setAttribute("selected", "true");
				taskList.setAttribute("label", calendars[i].name);
				taskList.setAttribute("value", synckolab.tools.text.fixNameToMiniCharset(calendars[i].name));
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
		synckolab.tools.logMessage("Account found: " + account.rootMsgFolder.baseMessageURI, synckolab.global.LOG_DEBUG);		
		if (account.rootMsgFolder.baseMessageURI.toLowerCase().indexOf("imap") === -1)
		{
			synckolab.tools.logMessage("Account " + account.rootMsgFolder.baseMessageURI + " is not an imap account - skipping!", synckolab.global.LOG_INFO);
			continue;
		}
		
		var acctName = synckolab.tools.text.fixNameToMiniCharset(account.prettyName);
		
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
		
		for (j = 0; j < synckolab.settings.baseTypes.length;j++) {
			
			// fill in the childs with the configs
			tItem = document.createElement("treeitem");
			tItem.setAttribute("container", "true");
			tItem.setAttribute("open", "true");
			tChildren.appendChild(tItem);
			tRow = document.createElement("treerow");
			tItem.appendChild(tRow);
			tCell = document.createElement("treecell");
			tRow.appendChild(tCell);
			tItem.setAttribute("id", "tab-"+synckolab.settings.baseTypes[j]+"-" + acctName);
			tCell.setAttribute("label", this.strBundle.getString(synckolab.settings.baseTypes[j]));
			tCell.setAttribute("value", "tab-"+synckolab.settings.baseTypes[j]+"-" + acctName);
			
		}
	}

	synckolab.settings.fillBaseInfo();
	synckolab.settings.repaintConfigTree();
};

/**
 * read the current configuration and see if its "old" style
 */
synckolab.settings.checkOldConfig = function() {
	var pref = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
	
	var configString = synckolab.tools.getConfigValue(pref, "Configs");
	// no configs - no old config
	if(!configString || configString.length === 0) {
		return;
	}
	/*
	if(!confirm( synckolab.global.strBundle.getString("config.convert"))) {
		pref.resetBranch("SyncKolab");
		return;
	}
	
	configs = configString.split(';');
	var curConfig = {
			version: synckolab.tools.getConfigValue(pref, "configVersion", synckolab.tools.CONFIG_TYPE_INT, 0),
			debugLevel: synckolab.tools.getConfigValue(pref, "debugLevel", synckolab.tools.CONFIG_TYPE_INT, synckolab.global.LOG_WARNING),
			// hide folder
			hideFolder: synckolab.tools.getConfigValue(pref, "hideFolder", synckolab.tools.CONFIG_TYPE_BOOL, false),
			// hide the window while sync
			closeWindow: synckolab.tools.getConfigValue(pref, "closeWindow", synckolab.tools.CONFIG_TYPE_BOOL, false),
			// sync automatically once on start
			syncOnStart: synckolab.tools.getConfigValue(pref, "syncOnStart", synckolab.tools.CONFIG_TYPE_BOOL, false),
			accounts: []
	};
	
	for(var i = 0; i < configs.length; i++) {
		var config = configs[i];
		var act = pref.getCharPref("SyncKolab."+config+".IncomingServer");
		if(!act) {
			continue;
		}
		
		act = synckolab.tools.text.fixNameToMiniCharset(act);
		
		var acct = null;
		var j;
		for(j = 0; j < curConfig.accounts.length; j++) {
			if(curConfig.accounts[j].name === act) {
				acct = curConfig.accounts[j];
			}
		}
		
		if(acct == null) {
			acct = {
				name: act,
				contact: [],
				calendar: [],
				task: []
			}
		}
		
		sConf = synckolab.tools.getConfigValue(pref, "accounts." + acct.name+"." + type + ".list");
	}
	
	*/
};

/**
 * re-create the config tree,
 */
synckolab.settings.repaintConfigTree = function() {
	// remove all nodes under tab-account-[cal|con|task]
	var conf = synckolab.settings.config;

	synckolab.settings.batch = true;
	
	// sorter for configuration names
	var configSorter = function(a,b) {
		
		var sa = a.name.toLowerCase();
		var sb = b.name.toLowerCase();
		if(sa === sb) {
			return 0;
		}
		return (sa < sb) ? -1 : 1;
	};

	for(var i = 0; i < conf.accounts.length; i++) {
		var acctName = conf.accounts[i].name;
		for (var j = 0; j < synckolab.settings.baseTypes.length;j++) {
			var cType = synckolab.settings.baseTypes[j];
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
			
			// sort configs
			configs.sort(configSorter);
			
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

	synckolab.settings.batch = false;
};

/**
 * fills the addressbook select box
 * @param cn the abook cn
 * @param ABook the address book to use
 */
synckolab.settings.fillAddressBook = function (cn, ABook) {
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
synckolab.settings.setFolders = function (act) {
	
	synckolab.settings.updateFolder(act, [{
		prefix: "contact",
		node: document.getElementById("contactImapFolder")
	},{
		prefix: "calendar",
		node: document.getElementById("calendarImapFolder")
	},{
		prefix: "task",
		node: document.getElementById("taskImapFolder")
	}]);
};

/**
 * update the folder based on the given account
 * @param act the account to search for
 * @param sets an array of prefix/node object for each element to fill
 */
synckolab.settings.updateFolder = function (act, sets) {
	// dynamically read this...
	var gAccountManager = Components.classes['@mozilla.org/messenger/account-manager;1'].getService(Components.interfaces.nsIMsgAccountManager);
	for (var i = 0; i < gAccountManager.allServers.Count(); i++)
	{
		try
		{
			var account = gAccountManager.allServers.GetElementAt(i).QueryInterface(Components.interfaces.nsIMsgIncomingServer);
			if (account.rootMsgFolder.baseMessageURI === act || synckolab.tools.text.fixNameToMiniCharset(account.prettyName) === act)
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
				synckolab.settings.updateFolderElements(account.rootFolder, sets, "");
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
synckolab.settings.updateFolderElements = function (msgFolder, origSets)
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
			synckolab.settings.updateFolderElements(folders[i], sets);
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
synckolab.settings.setSyncPrefView = function(viewName) {
	if (viewName.indexOf("-") === -1)
	{
		alert("Fatal ERROR - unable to get view - Please re-install synckolab and clean your configuration!");
		return;
	}
	
	// skip this if we update the tree
	if (synckolab.settings.batch) {
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
	synckolab.settings.getInfo();

	// remember the type
	synckolab.settings.activeType = opts[1];
	if(opts.length > 2) {
		if(synckolab.settings.activeAccount !== opts[2]) {
			synckolab.settings.activeAccount = opts[2];
			synckolab.settings.setFolders(synckolab.settings.activeAccount);
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
		synckolab.settings.fillAccountInfo(opts[2]);
		document.getElementById("loadConfig").setAttribute("disabled", false);
		break;
	case "contact":
		if(opts.length > 3) {
			tabs.selectedPanel = document.getElementById("contactTab");
			synckolab.settings.fillInfo("contact", opts[2],opts[3]);
			document.getElementById("delConfig").setAttribute("disabled", false);
		} else {
			document.getElementById("newConfig").setAttribute("disabled", false);
		}
		break;
	case "calendar":
		if (this.isCalendar && opts.length > 3) {
			tabs.selectedPanel = document.getElementById("calTab");
			synckolab.settings.fillInfo("calendar", opts[2],opts[3]);
			document.getElementById("delConfig").setAttribute("disabled", false);
		} else {
			document.getElementById("newConfig").setAttribute("disabled", false);
		}
		break;
	case "task":
		if (this.isCalendar && opts.length > 3) {
			tabs.selectedPanel = document.getElementById("taskTab");
			synckolab.settings.fillInfo("task", opts[2],opts[3]);
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
synckolab.settings.fillBaseInfo = function() {
	
	var conf = synckolab.settings.config;
	document.getElementById("hideFolder").checked = conf.hideFolder;
	document.getElementById("closeWindow").checked = conf.closeWindow;
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
			synckolab.tools.logMessage("WARNING: could not find Label " + sCLabel, synckolab.global.LOG_WARNING);
		}
	} else {
		conf.debugLevel = 12;
	}
	
	// set debug level
	synckolab.config.DEBUG_SYNCKOLAB_LEVEL = conf.debugLevel;
	
};

/**
 * Enables/disables the controls on the page
 */
synckolab.settings.setControlState = function (type, active) 
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
synckolab.settings.getAccount = function(config, name, create) {
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
synckolab.settings.getAccountIdx = function(config, name) {
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
synckolab.settings.getBaseInfo = function() {
	var conf = synckolab.settings.config;
	conf.hideFolder = document.getElementById("hideFolder").checked;
	conf.debugLevel = document.getElementById("debugLevel").value;
	conf.closeWindow = document.getElementById("closeWindow").checked;
	conf.syncOnStart = document.getElementById("syncOnStart").checked;
};


/**
 * Helper function that checks the globals for the currently active config.
 * It is based on Account+Type+Config name
 * @returns null if not found, otherwise the config sub-object
 */
synckolab.settings.getActiveConfig = function() {
	// nothing to save back
	if(!synckolab.settings.activeType || !synckolab.settings.activeAccount || !synckolab.settings.activeConfig) {
		return null;
	}
	
	// get the right tree in the configuration object
	var conf = synckolab.settings.config;
	var account = synckolab.settings.getAccount(conf, synckolab.settings.activeAccount, true);
	var config = null;
	for (var i=0; i < account[synckolab.settings.activeType].length; i++) {
		if(account[synckolab.settings.activeType][i].name === synckolab.settings.activeConfig) {
			config = account[synckolab.settings.activeType][i];
			break;
		}
	}
	
	if(config === null) {
		config = { name: synckolab.settings.activeConfig };
		account[synckolab.settings.activeType].push(config);
	}
	
	return config;
};

/**
 * set the configuration of the open contact/calendar/task info
 */
synckolab.settings.getInfo = function() {
	// nothing to save back
	if(!synckolab.settings.activeType || !synckolab.settings.activeAccount || !synckolab.settings.activeConfig) {
		return;
	}
	
	if(synckolab.settings.activeType !== "contact" && synckolab.settings.activeType !== "calendar" && synckolab.settings.activeType !== "task") {
		return;
	} 
		

	var config = synckolab.settings.getActiveConfig();
	
	// fill all fields
	var prefix = synckolab.settings.activeType;

	// the address book / calendar
	config.source = document.getElementById(prefix + "URL").value;
	// the imap folder path is done by setFolder via callback
	
	// true if the config is enabled
	config.enabled = document.getElementById(prefix + "Sync").checked;
	// save changes to imap (vs. read only)
	config.saveToImap = document.getElementById(prefix + "SaveToImap").checked;
	// automatically sync every X minutes (0 = disable)
	//@deprecated config.syncInterval = document.getElementById(prefix + "SyncInterval").value;
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
synckolab.settings.setFolder = function (uri) {
	var config = synckolab.settings.getActiveConfig();
	if (config === null)
	{
		return;
	}
	config.folderPath = uri;
};

synckolab.settings.fillAccountInfo = function(acctName) {
	
};

/**
 * fills the info in a config tab
 * @param type the type of configuration (contac|calendar|task)
 * @param acctName the account name
 * @param confName the configuration name
 */
synckolab.settings.fillInfo = function(type, acctName, confName) {
	synckolab.settings.activeType = type;
	synckolab.settings.activeAccount = acctName;
	synckolab.settings.activeConfig = confName;
	
	var config = synckolab.settings.getActiveConfig();
	var prefix = synckolab.settings.activeType;

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
	//@deprecated document.getElementById(prefix + "SyncInterval").value = config.syncInterval;
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
synckolab.settings.addConfig = function() {
	switch(synckolab.settings.activeType) {
		case "Acct":
			alert("Searching for existing kolab configurations.");
			break;
		case "contact":
		case "calendar":
		case "task":
			// make sure active config is NOT set (we are creating here)
			synckolab.settings.activeConfig = null;

			var retVals = { name: null };
			var res = window.openDialog("chrome://synckolab/content/wndNewConfigType.xul", 
					"newCfg", 
					"modal,width=360,height=200,resizable=0", retVals, synckolab.settings.activeType, synckolab.settings.config);
			if(retVals.name !== null && retVals.name.length > 2) {
				var acct = synckolab.settings.getAccount(synckolab.settings.config, synckolab.settings.activeAccount, true);
				// check the configs
				for(var i = 0; i < acct[synckolab.settings.activeType].length; i++) {
					// already go the configuration
					if(retVals.name === acct[synckolab.settings.activeType][i].name) {
						return;
					}
				}
				// create a base config object
				var cConf = {
						name: retVals.name
				};
				
				// read all the base settings
				for(var n in synckolab.config.baseSetting) {
					// skip unwanted prototypes (without type)
					if(synckolab.config.baseSetting[n].type >= 0) {
						cConf[n] = synckolab.config.baseSetting[n].def;
					}
				}
				
				acct[synckolab.settings.activeType].push(cConf);
				
				synckolab.tools.logMessage("New config: " + synckolab.settings.config.toSource(), synckolab.global.LOG_DEBUG);
				// repaint the tree and select the newly created node
				synckolab.settings.repaintConfigTree("tab-"+synckolab.settings.activeType+"-" + synckolab.settings.activeAccount + "-" + retVals.name);
			}
	}
};

/**
 * adds a new configuration to an account
 */
synckolab.settings.delConfig = function() {
	switch(synckolab.settings.activeType) {
		case "contact":
		case "calendar":
		case "task":
			if (confirm(this.strBundle.getFormattedString("configDelete", [synckolab.settings.activeConfig]))) {
				
				var acctIdx = synckolab.settings.getAccountIdx(synckolab.settings.config, synckolab.settings.activeAccount);
				var acct = synckolab.settings.config.accounts[acctIdx];
				
				// update the configs
				var configs = [];
				for(var i = 0; i < acct[synckolab.settings.activeType].length; i++) {
					// already go the configuration
					if(synckolab.settings.activeConfig !== acct[synckolab.settings.activeType][i].name) {
						configs.push(acct[synckolab.settings.activeType][i]);
					}
				}
				acct[synckolab.settings.activeType] = configs;
				
				synckolab.settings.activeConfig = null;
				synckolab.settings.activeType = null;
				
				// repaint the tree and select the parent 
				synckolab.settings.repaintConfigTree();
				// select root
				synckolab.settings.setSyncPrefView("Welcome-Welcome");

				return;
				
			}
	}
};

/**
 * Delete all temp/cache - files/folders for this configuration
 * @param config the config name
 * @param type CALENDAR|TASK|CONTACT + FOLDER
 */
synckolab.settings.resetConfiguration = function (account, type, config)
{
	synckolab.tools.logMessage("Resetting " + account + "!", synckolab.global.LOG_INFO);

	var file = synckolab.tools.getProfileFolder();
	file.append("synckolab." + synckolab.tools.text.fixNameToMiniCharset(account) + "." + type + "." + config + ".hdb");
	if (file.exists()) {
		file.remove(true);
	}

	file = synckolab.tools.getProfileFolder();
	file.append("synckolab");

	if (!file.exists()) {
		return;
	}

	file.append(synckolab.tools.text.fixNameToMiniCharset(account));
	if (file.exists())
	{
		file.append(type + "_" + config);
		if (file.exists()) {
			file.remove(true);
		}
	}
};

/**
 * start autoconfiguration on the current selected account
 */
synckolab.settings.autoConfigure = function() {
	// open status dialog (modal)
	var statusDlg = {
			wnd: window.openDialog("chrome://synckolab/content/wndAutoSetup.xul", "sksearchprogress", "chrome,width=450,height=200,resizable=no,alwaysRaised=yes,dependent=yes,modal=no")
	};
	
	// wait until loaded
	synckolab.settings.timer.initWithCallback({
		notify:
			function (){
			synckolab.settings.autoConfigureStart(statusDlg, synckolab.settings.activeAccount);
		}
	}, synckolab.settings.SWITCH_TIME, 0);
};

/**
 * Callback for autoconfigure
 * @param statusDlg the status dialog
 * @param acctName the account to configure
 * @private
 */
synckolab.settings.autoConfigureStart = function(statusDlg, acctName) {
	// remember each folder
	
	// some window elements for displaying the status
	statusDlg.meter = statusDlg.wnd.document.getElementById('total-progress');
	statusDlg.statusMsg = statusDlg.wnd.document.getElementById('current-action');
	statusDlg.itemList = statusDlg.wnd.document.getElementById('item-list');

	statusDlg.statusMsg.value ="Initializing " + acctName;
	statusDlg.meter.mode = "undetermined";
	statusDlg.folders = [];
	
	// get the richt account
	var gAccountManager = Components.classes['@mozilla.org/messenger/account-manager;1'].getService(Components.interfaces.nsIMsgAccountManager);
	for (var i = 0; i < gAccountManager.allServers.Count(); i++) {
		try
		{
			var account = gAccountManager.allServers.GetElementAt(i).QueryInterface(Components.interfaces.nsIMsgIncomingServer);
			if (account.rootMsgFolder.baseMessageURI === acctName || synckolab.tools.text.fixNameToMiniCharset(account.prettyName) === acctName)
			{
				// collect ALL folders before going throughthem
				synckolab.settings.collectFolder(account.rootFolder, statusDlg.folders);
				synckolab.tools.logMessage("collected " + statusDlg.folders.length + " folders...", synckolab.global.LOG_INFO);

				statusDlg.meter.mode = "determined";
				statusDlg.curFolderNum = 0;
				statusDlg.identifiedFolder = [];
				// start with the identification process
				synckolab.settings.identifyFolder(statusDlg);
				break;
			}
		}
		catch (ex)
		{

		}
	}
};

synckolab.settings.finishIdentification = function(statusDlg) {
	alert("folderinfo: " + statusDlg.identifiedFolder.toSource());
	
	statusDlg.meter.value = 100;
	statusDlg.statusMsg.value ="Finished";
	
	statusDlg.wnd.document.getElementById("ok-button").onclick = function(){
		if(statusDlg.identifiedFolder.length === 0) {
			if(confirm("No existing folders found. Do you want to create a default configuration?")) {
				synckolab.settings.autocreateNewConfig();
			}
			statusDlg.wnd.close();
			return;
		}
		
		var acctIdx = synckolab.settings.getAccountIdx(synckolab.settings.config, synckolab.settings.activeAccount);
		var acct = synckolab.settings.config.accounts[acctIdx];
		
		// add configuration
		for(var i = 0; i < statusDlg.identifiedFolder.length; i++) {
			// add a new config based on the id
			var curFolder = statusDlg.identifiedFolder[i];
			var name = curFolder.name;

			// create a base config object
			var cConf = {
					name: name
			};
			
			// read all the base settings
			for(var n in synckolab.config.baseSetting) {
				// skip unwanted prototypes (without type)
				if(synckolab.config.baseSetting[n].type >= 0) {
					cConf[n] = synckolab.config.baseSetting[n].def;
				}
			}

			// true if the config is enabled
			cConf.enabled = true;
			// save changes to imap (vs. read only)
			cConf.saveToImap = true;
			// format to use: xml|vcard
			switch(curFolder.kolab) {
				case 2:
					cConf.format = "xml-k2";
					break;
				case 1: 
					cConf.format = "vcard";
					break;
				default:
					cConf.format = "xml-k3";
			}
			// enable the sync listener
			cConf.syncListener = false;

			switch (curFolder.type) {
			case "CONTACT":
				// try to find a matching addresbook - if none exists create one
				var actualBook = synckolab.addressbookTools.findAB(name);
				
				// did not find one - lets create one
				if(actualBook === null) {
					try {
						var abManager = Components.classes["@mozilla.org/abmanager;1"].getService(Components.interfaces.nsIAbManager);
						abManager.newAddressBook(name, "moz-abmdbdirectory://", 2);
					} catch (ex) {
						try {	// postbox
							var addressbook = Components.classes["@mozilla.org/addressbook;1"].createInstance(Components.interfaces.nsIAddressBook);
							addressbook.newAddressBook(name, "", 2);
						} catch (ex2) {
						}
					}
					
					// update address book
					var cn = synckolab.addressbookTools.getABDirectory();
					var ABook = cn.getNext();
					this.fillAddressBook(cn, ABook);

					// search again
					actualBook = synckolab.addressbookTools.findAB(name);
				}
				
				if(actualBook === null) {
					alert("Unable to create an address book for your configuration. Please create it manually with the name: " + name);
					break;
				}

				// abook source
				cConf.source = actualBook.dirName;

				// the imap folder path 
				cConf.folderPath = curFolder.folder.URI;

				// we got a matching address book - create the configuration
				acct.contact.push(cConf);
				
				synckolab.tools.logMessage("New config: " + synckolab.settings.config.toSource(), synckolab.global.LOG_DEBUG);
				break;
			case "TASK":
				break;
			case "CALENDAR":
				break;
			}
			
			alert("Updated your configuration - please verify that all mappings are correct.");
		}
		synckolab.settings.repaintConfigTree();
		statusDlg.wnd.close();
	};
};

/**
 * simepl function that collects all existing folders
 * @param msgFolder the current folder
 * @param folders the object to save the folders in
 */
synckolab.settings.collectFolder = function(msgFolder, folders) {
	// make sure we talk about the right interface
	msgFolder = msgFolder.QueryInterface(Components.interfaces.nsIMsgFolder);
	
	// remember this folder
	folders.push(msgFolder);
	
	// check for subfolders and recurse into them
	try {
		if (msgFolder.hasSubFolders)
		{
			// tbird 3 uses subFolders enumerator instead of getsubfolders
			var subfolders = msgFolder.subFolders ? msgFolder.subFolders : msgFolder.GetSubFolders();
	
			// this block is only for tbird < 3
			try
			{
				if (subfolders.first) {
					subfolders.first();
				}
			}
			catch (sfex)
			{
				return;
			}
	
			while (subfolders !== null)
			{
				var curFolder = null;
				// tbird < 3
				if (subfolders.currentItem) {
					curFolder = subfolders.currentItem();
				} else {
					curFolder = subfolders.getNext();
				}
	
				if (curFolder === null) {
					break;
				}
	
				curFolder = curFolder.QueryInterface(Components.interfaces.nsIMsgFolder);
	
				// go deep
				synckolab.settings.collectFolder(curFolder, folders);
	
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
		}
	} catch (sfEx) {
		synckolab.tools.logMessage("Unable to retrieve subfolders in  " + msgFolder.prettyName + "(" + sfEx + ")", synckolab.global.LOG_INFO);
	}
	
};


/**
 * check the first few messages and try to identify them. If they are kolab messages, remember the folder
 * with the identified type.
 * 
 * @param msgFolder the folder to check
 * @param identifiedFolder the array that keeps the identified objects
 */
synckolab.settings.identifyFolder = function(statusDlg) {
	var MAX_CHECK = 10;
	
	// done
	if (statusDlg.curFolderNum >= statusDlg.folders.length) {
		synckolab.settings.finishIdentification(statusDlg);
		return;
	}
	
	// update progressmeter
	statusDlg.meter.setAttribute("value", Math.round((statusDlg.curFolderNum / statusDlg.folders.length)*100) + "%");

	var msgFolder = statusDlg.folders[statusDlg.curFolderNum++];
	
	statusDlg.currentFolder = {
			folder: msgFolder,
			name: msgFolder.prettyName,
			task: 0, 
			calendar: 0, 
			contact: 0,
			kolab1: 0,
			kolab2: 0,
			kolab3: 0,
			unknown: 0,
			// remember how many messages are still to check
			msgToCheck: MAX_CHECK
	};

	// we should have a folder at least
	if(!msgFolder) {
		synckolab.settings.identifyFolder(statusDlg);
		return;
	}
	
	statusDlg.statusMsg.value ="Checking " + msgFolder.prettyName;
	
	// go through the headers
	try {
		if (msgFolder.getMessages) {
			statusDlg.currentFolder.messages = msgFolder.getMessages(null);	 // dont need the msgWindow use null
		} else {
			statusDlg.currentFolder.messages = msgFolder.messages; // tbird 3 uses an enumerator property instead of a function
		}
	} catch (getMsgEx) {
		synckolab.tools.logMessage("Unable to retrieve messages... skipping " + msgFolder.prettyName, synckolab.global.LOG_INFO);
		synckolab.settings.identifyFolder(statusDlg);
		return;
	}
	
	// start reading the first X message:
	synckolab.settings.identifyMessage(statusDlg);
};

/**
 * start identificatio process: this will download the next message
 * @param statusDlg
 */
synckolab.settings.identifyMessage = function(statusDlg) {

	// finished checking - next folder
	if(statusDlg.currentFolder.msgToCheck === 0) {
		synckolab.settings.nextFolder(statusDlg);
		return;
	}
	
	var messages = statusDlg.currentFolder.messages;
	
	var cur = null;
	try
	{
		if (messages.hasMoreElements()) {
			cur = messages.getNext().QueryInterface(Components.interfaces.nsIMsgDBHdr);
		}
	}
	catch (ex)
	{
		synckolab.tools.logMessage("skipping read of messages - since there are none :)", synckolab.global.LOG_INFO);
	}

	//  reached last message - next Folder
	if(!cur) {
		synckolab.tools.logMessage("last message found... next Folder", synckolab.global.LOG_INFO);
		synckolab.settings.nextFolder(statusDlg);
		return;
	}

	// message tests
	if (cur.flags&0x200000)
	{
		synckolab.tools.logMessage("Message " + cur.mime2DecodedSubject + " has been DELETED on imap!", synckolab.global.LOG_INFO);
		
		// skip current and process next nessage
		synckolab.settings.identifyMessage(statusDlg);
		return;
	}
	
	if(!cur.mime2DecodedSubject || cur.mime2DecodedSubject.length < 3) {
		statusDlg.currentFolder.unknown++;
		synckolab.tools.logMessage("Message '" + cur.mime2DecodedSubject + "' has an invalid subject!", synckolab.global.LOG_INFO);
		// skip current and process next nessage	
		synckolab.settings.identifyMessage(statusDlg);
		return;
	}
	
	// check next message
	statusDlg.currentFolder.msgToCheck--;

	// read the current message (async)
	statusDlg.currentMessage = {
			message: statusDlg.currentFolder.folder.baseMessageURI +"#"+cur.messageKey,
			fileContent: ""
	};

	var aurl = {};
	synckolab.global.messageService.CopyMessage(
			statusDlg.currentMessage.message, 
			/* nsIStreamListener */
			{
					onDataAvailable: function (request, context, inputStream, offset, count){
						try
						{
							var sis=Components.classes["@mozilla.org/scriptableinputstream;1"].createInstance(Components.interfaces.nsIScriptableInputStream);
							sis.init(inputStream);
							statusDlg.currentMessage.fileContent += sis.read(count);
						}
						catch(ex)
						{
							alert("exception caught: "+ex.message+"\n");
						}
					},
					onStartRequest: function (request, context) {
					},
					onStopRequest: function (aRequest, aContext, aStatusCode) {
						// make sure we dont come into an endless loop here
						synckolab.settings.analyzeMessage(statusDlg);
					}
			}, false, null, null, aurl
	);
};
	
/**
 * analyze the filecontent based on the last copymessage call
 * @param statusDlg the status object
 * @private
 */
synckolab.settings.analyzeMessage = function(statusDlg) {
	// start analyzing
	var content = statusDlg.currentMessage.fileContent;
	// next
	if(!content) {
		synckolab.settings.identifyMessage(statusDlg);
		return;
	}

	var headerLen = content.length;
	
	// header should really be smaller than 5k
	if(headerLen > 5000) {
		headerLen = 5000;
	}
	content = content.substring(0, headerLen - 1).toLowerCase();

	// get the header (everything before the first \n\n)
	//content = content.substring(0, content.indexOf("\n\n")).toLowerCase();
	
	// kolab1 vcard checks:
	
	// kolab2/3 checks:
	var kolab3 = false;
	if(content.indexOf("x-kolab-mime-version: 3.0") !== -1) {
		kolab3 = true;
	}
	if(content.indexOf("application/vcard+xml") !== -1) {
		statusDlg.currentFolder.kolab3++;
		statusDlg.currentFolder.contact++;
	} else if(content.indexOf("application/i-cal+xml") !== -1) {
		if(kolab3) { statusDlg.currentFolder.kolab3++; } 
		else { statusDlg.currentFolder.kolab2++;}
		statusDlg.currentFolder.task++;
	} else if(content.indexOf("application/x-vnd.kolab.distribution-list") !== -1) {
		if(kolab3) { statusDlg.currentFolder.kolab3++; } 
		else { statusDlg.currentFolder.kolab2++;}
		statusDlg.currentFolder.contact++;
	} else if(content.indexOf("application/x-vnd.kolab.event") !== -1) {
		if(kolab3) { statusDlg.currentFolder.kolab3++; } 
		else { statusDlg.currentFolder.kolab2++;}
		statusDlg.currentFolder.calendar++;
	} else if(content.indexOf("application/x-vnd.kolab.contact") !== -1) {
		if(kolab3) { statusDlg.currentFolder.kolab3++; } 
		else { statusDlg.currentFolder.kolab2++;}
		statusDlg.currentFolder.contact++;
	} else if(content.indexOf("application/x-vnd.kolab.task") !== -1) {
		if(kolab3) { statusDlg.currentFolder.kolab3++; } 
		else { statusDlg.currentFolder.kolab2++;}
		statusDlg.currentFolder.task++;
	} else if(content.indexOf("application/x-vnd.kolab.distribution-list") !== -1) {
		if(kolab3) { statusDlg.currentFolder.kolab3++; } 
		else { statusDlg.currentFolder.kolab2++;}
		statusDlg.currentFolder.contact++;
	} else if(content.indexOf("text/x-vcard") !== -1) {
		statusDlg.currentFolder.kolab1++;
		statusDlg.currentFolder.contact++;
	} else if(content.indexOf("text/x-ical") !== -1 || content.indexOf("text/calendar") !== -1) {
		statusDlg.currentFolder.kolab1++;
		statusDlg.currentFolder.calendar++;
	} else if(content.indexOf("text/todo") !== -1) {
		statusDlg.currentFolder.kolab1++;
		statusDlg.currentFolder.task++;
	} else {
		statusDlg.currentFolder.unknown++;
		// if unknown - we only need to check less 
		statusDlg.currentFolder.msgToCheck--;
	}

	
	//next message
	synckolab.settings.identifyMessage(statusDlg);
};


/**
 * after parsing one folder - go deep
 * @param msgFolder
 * @param identifiedFolder
 * @param statusDlg
 */
synckolab.settings.nextFolder = function(statusDlg) {
	
	// analyse current folder stats
	var cur = statusDlg.currentFolder;
	if(cur.msgToCheck < 3) {
		synckolab.tools.logMessage("stats: " + cur.toSource(), synckolab.global.LOG_INFO)
	}

	if(cur.unknown < 2) {
		// kolab3 wins
		if(cur.kolab3 > 0) {
			cur.kolab = 3;
		} else if(cur.kolab2 > 0) {
			cur.kolab = 2;
		} else if(cur.kolab1 > 0) {
			cur.kolab = 1;
		}
		
		// add if we have identified at least one type
		if(cur.contact > 0 && cur.contact > cur.calendar && cur.contact > cur.task) {
			cur.type = "CONTACT";
			statusDlg.identifiedFolder.push(cur);
		} else if(cur.calendar > 0 && cur.calendar > cur.task) {
			cur.type = "CALENDAR";
			statusDlg.identifiedFolder.push(cur);
		} else if(cur.task > 0) {
			cur.type = "TASK";
			statusDlg.identifiedFolder.push(cur);
		}
		
		if(cur.kolab > 0) {
			// add a new line since we think we know whats going on
			var doc = statusDlg.wnd.document;
			
			var curItemInList = doc.createElement("treerow");
			var curItemInListId = doc.createElement("treecell");
			var curItemInListStatus = doc.createElement("treecell");
			var curItemInListContent = doc.createElement("treecell");
			curItemInListId.setAttribute("label", cur.name);
			curItemInListStatus.setAttribute("label", cur.type);
			curItemInListContent.setAttribute("label", "kolab" + cur.kolab);
			
			curItemInList.appendChild(curItemInListId);
			curItemInList.appendChild(curItemInListStatus);
			curItemInList.appendChild(curItemInListContent);
			
			var curListItem = doc.createElement("treeitem");
			curListItem.appendChild(curItemInList);
			statusDlg.itemList.appendChild(curListItem);
		}
	}

	// next folder
	synckolab.settings.identifyFolder(statusDlg);
};

/**
 * create a new configuration basedon the current addressbook/cal installed.
 * Create folders in imap and set them as default.
 */
synckolab.settings.autocreateNewConfig = function() {
	var acct = synckolab.settings.getAccount(synckolab.settings.config, synckolab.settings.activeAccount, true);
};