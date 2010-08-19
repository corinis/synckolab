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

if(!com) var com={};
if(!com.synckolab) com.synckolab={};
if(!com.synckolab.settings) com.synckolab.settings={};

/**
 * These are the functions for the configuration.
 */
com.synckolab.settings = {
		// sub-fields of configuration array
		FIELD_NAME: 0,
		FIELD_TYPE: 1,

		// types of configuration fields
		FIELD_TYPE_BOOL: 0,
		FIELD_TYPE_CHAR: 1,
		FIELD_TYPE_INT: 2,
		
		CONFIG_FIELD_TYPES: new Array(),

		isCalendar: false,
		curConfig: null,

		// string bundle use: strBundle.getString("KEYNAME")
		strBundle: null,

		init: function() {
			// init field type array
			this.CONFIG_FIELD_TYPES["AddressBook"] = this.FIELD_TYPE_CHAR;
			this.CONFIG_FIELD_TYPES["AddressBookFormat"] = this.FIELD_TYPE_CHAR;
			this.CONFIG_FIELD_TYPES["calSyncTimeframe"] = this.FIELD_TYPE_INT;
			this.CONFIG_FIELD_TYPES["taskSyncTimeframe"] = this.FIELD_TYPE_INT;
			this.CONFIG_FIELD_TYPES["ContactFolderPath"] = this.FIELD_TYPE_CHAR;
			this.CONFIG_FIELD_TYPES["Calendar"] = this.FIELD_TYPE_CHAR;
			this.CONFIG_FIELD_TYPES["CalendarFormat"] = this.FIELD_TYPE_CHAR;
			this.CONFIG_FIELD_TYPES["CalendarFolderPath"] = this.FIELD_TYPE_CHAR;
			this.CONFIG_FIELD_TYPES["Resolve"] = this.FIELD_TYPE_CHAR;
			this.CONFIG_FIELD_TYPES["Tasks"] = this.FIELD_TYPE_CHAR;
			this.CONFIG_FIELD_TYPES["TaskFormat"] = this.FIELD_TYPE_CHAR;
			this.CONFIG_FIELD_TYPES["TaskFolderPath"] = this.FIELD_TYPE_CHAR;
			this.CONFIG_FIELD_TYPES["autoSync"] = this.FIELD_TYPE_INT;
			this.CONFIG_FIELD_TYPES["syncContacts"] = this.FIELD_TYPE_BOOL;
			this.CONFIG_FIELD_TYPES["syncTasks"] = this.FIELD_TYPE_BOOL;
			this.CONFIG_FIELD_TYPES["syncCalendar"] = this.FIELD_TYPE_BOOL;
			this.CONFIG_FIELD_TYPES["saveToContactImap"] = this.FIELD_TYPE_BOOL;
			this.CONFIG_FIELD_TYPES["saveToCalendarImap"] = this.FIELD_TYPE_BOOL;
			this.CONFIG_FIELD_TYPES["saveToTaskImap"] = this.FIELD_TYPE_BOOL;
			this.CONFIG_FIELD_TYPES["hiddenWindow"] = this.FIELD_TYPE_BOOL;
			this.CONFIG_FIELD_TYPES["IncomingServer"] = this.FIELD_TYPE_CHAR;
			this.CONFIG_FIELD_TYPES["ContactIncomingServer"] = this.FIELD_TYPE_CHAR;
			this.CONFIG_FIELD_TYPES["CalendarIncomingServer"] = this.FIELD_TYPE_CHAR;
			this.CONFIG_FIELD_TYPES["debugLevel"] = this.FIELD_TYPE_INT;

			this.strBundle = document.getElementById("synckolabBundle");
			this.isCalendar = com.synckolab.calendarTools.isCalendarAvailable();

			var sCurFolder = "";
			var rdf = Components.classes["@mozilla.org/rdf/rdf-service;1"].getService(Components.interfaces.nsIRDFService);

			var directory = rdf.GetResource("moz-abdirectory://").QueryInterface(Components.interfaces.nsIAbDirectory);
			var pref = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);

			// set the debug level
			try {
				com.synckolab.global.DEBUG_SYNCKOLAB_LEVEL = com.synckolab.global.LOG_ALL + pref.getIntPref("SyncKolab.debugLevel");
			} catch (ex) {
				com.synckolab.global.DEBUG_SYNCKOLAB_LEVEL = com.synckolab.global.LOG_ALL + com.synckolab.global.LOG_WARNING;
				com.synckolab.tools.logMessage("WARNING: Reading 'SyncKolab.debugLevel' failed: " + ex, com.synckolab.global.LOG_WARNING);
			}

			// get all available configurations
			var configs = new Array();
			var configStateLocked = false;

			try {
				var Config = pref.getCharPref("SyncKolab.Configs");
				configs = Config.split(';');
			} catch(ex) {
				com.synckolab.tools.logMessage("ERROR: Reading 'SyncKolab.Configs' failed: " + ex, com.synckolab.global.LOG_ERROR);
			}

			try {
				configStateLocked = pref.prefIsLocked("SyncKolab.Configs");
			} catch(ex) {
				com.synckolab.tools.logMessage("WARNING: failed to read state of SyncKolab.Configs: " + ex, com.synckolab.global.LOG_WARNING);
			}
			
			// in case we did not find anything - check if there are "old" configurations
			// and use them (like an importer)
			if (configs.length == 0)
			{
				var oldConfigs = new Array();
				try {
					var conConfig = pref.getCharPref("SyncKolab.AddressBookConfigs");
					oldConfigs = conConfig.split(';');
				} catch(ex) {
					com.synckolab.tools.logMessage("ERROR: Reading 'SyncKolab.AddressBookConfigs' failed: " + ex, com.synckolab.global.LOG_ERROR);
				}
				try {
					configStateLocked = pref.prefIsLocked("SyncKolab.AddressBookConfigs");
				} catch(ex) {
					com.synckolab.tools.logMessage("WARNING: failed to read state of SyncKolab.AddressBookConfigs: " + ex, com.synckolab.global.LOG_WARNING);
				}

				try {
					var calConfig = pref.getCharPref("SyncKolab.CalendarConfigs");
					oldConfigs = oldConfigs.concat(calConfig.split(';'));
				}
				catch(ex) {
					com.synckolab.tools.logMessage("ERROR: Reading 'SyncKolab.CalendarConfigs' failed: " + ex, com.synckolab.global.LOG_ERROR);
				}
				try {
					configStateLocked = pref.prefIsLocked("SyncKolab.CalendarConfigs");
				} catch(ex) {
					com.synckolab.tools.logMessage("WARNING: failed to read state of SyncKolab.CalendarConfigs: " + ex, com.synckolab.global.LOG_WARNING);
				}

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

			// set state of config-admin-buttons
			document.getElementById("newConfig").setAttribute("disabled", configStateLocked);
			document.getElementById("loadConfig").setAttribute("disabled", configStateLocked);
			document.getElementById("delConfig").setAttribute("disabled", configStateLocked);
			
			if (configs.length == 0)
			{
				this.addConfig();
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
			tCell.setAttribute("label", this.strBundle.getString("aboutSyncKolab"));
			tCell.setAttribute("value", "Welcome-Welcome");
			
			// generate the configuration in the tree control 	
			for (var i=0; i < configs.length; i++)
				this.generateConfigTree(configs[i]);

			this.curConfig = null;
				
			// now prefill all fields we have to prefill
			this.prefillFields();
				
			// now some global settings
			try {
				document.getElementById ("closeWnd").checked = pref.getBoolPref("SyncKolab.closeWindow");
			} catch (ex) {
				com.synckolab.tools.logMessage("WARNING: failed to read SyncKolab.closeWindow: " + ex, com.synckolab.global.LOG_WARNING);
			}
			// set the state
			try {
				document.getElementById("closeWnd").setAttribute("disabled", pref.prefIsLocked("SyncKolab.closeWindow"));
			} catch (ex) {
				com.synckolab.tools.logMessage("WARNING: failed to read state of SyncKolab.closeWindow: " + ex, com.synckolab.global.LOG_WARNING);
			}

			// set the default debug level
			var cfgDbgLevel = com.synckolab.global.LOG_WARNING;
			try {
				cfgDbgLevel = pref.getIntPref("SyncKolab.debugLevel");
			} catch (ex) {
				com.synckolab.tools.logMessage("WARNING: failed to read SyncKolab.debugLevel: " + ex, com.synckolab.global.LOG_WARNING);
			}
			
			var debugEle = document.getElementById("skDebugLevel");
			if (debugEle) {
				debugEle.setAttribute("value", cfgDbgLevel);
				var iCLabel = cfgDbgLevel;
				while (iCLabel > 3)
					iCLabel -= 4;
				
				var sCLabel = "skDebugLevel"+iCLabel;
				var cLabel = document.getElementById(sCLabel);
				// get the label
				if (cLabel != null)
					debugEle.setAttribute("label", cLabel.getAttribute("label"));
				else
					com.synckolab.tools.logMessage("WARNING: could not find Label " + sCLabel, com.synckolab.global.LOG_WARNING);

				// set the state
				try {
					debugEle.setAttribute("disabled", pref.prefIsLocked("SyncKolab.debugLevel"));
				} catch (ex) {
					com.synckolab.tools.logMessage("WARNING: failed to read state of SyncKolab.debugLevel: " + ex, com.synckolab.global.LOG_WARNING);
				}
			}

		},
		
		/**
		 * Generate the interface subtree for a new configuration 
		 * and adds it in the correct container (configTree)
		 */
		generateConfigTree: function (configuration)
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
			tCell.setAttribute("label", this.strBundle.getString("contacts"));
			tCell.setAttribute("value", configuration + "-Contact");

			// only display this part if the calendar is installed
			if (this.isCalendar)
			{
				tItem = document.createElement("treeitem");
				tChildren.appendChild(tItem);
				tRow = document.createElement("treerow");
				tItem.appendChild(tRow);
				tCell = document.createElement("treecell");
				tRow.appendChild(tCell);
				tItem.setAttribute("id", configuration + "-CalendarId");
				tCell.setAttribute("label", this.strBundle.getString("calendar"));
				tCell.setAttribute("value", configuration + "-Calendar");
			
				tItem = document.createElement("treeitem");
				tChildren.appendChild(tItem);
				tRow = document.createElement("treerow");
				tItem.appendChild(tRow);
				tCell = document.createElement("treecell");
				tRow.appendChild(tCell);
				tItem.setAttribute("id", configuration + "-TaskId");
				tCell.setAttribute("label", this.strBundle.getString("tasks"));
				tCell.setAttribute("value", configuration + "-Task");
			}	
		},

		setSyncPrefView: function(viewName)
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
					if (this.isCalendar)
						tabs.selectedPanel = document.getElementById("calTab");
					break;
				case "Task":
					if (this.isCalendar)
						tabs.selectedPanel = document.getElementById("taskTab");
					break;
				default:
			}
			// preselect the first item
			this.changeConfig(opts[0]);
		},


		prefillFields: function() {
		
		
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
				com.synckolab.tools.logMessage("Account found: " + account.rootMsgFolder.baseMessageURI, com.synckolab.global.LOG_DEBUG);		
				if (account.rootMsgFolder.baseMessageURI.toLowerCase().indexOf("imap") == -1)
				{
					com.synckolab.tools.logMessage("Account " + account.rootMsgFolder.baseMessageURI + " is not an imap account - skipping!", com.synckolab.global.LOG_INFO);
					continue;
				}
				var actchild = document.createElement("menuitem");
				actpopup.appendChild(actchild);
				actchild.setAttribute("label", account.prettyName);
				actchild.setAttribute("value", com.synckolab.tools.text.accountNameFix(account.prettyName));
				if (isFirst)
				{
					actchild.setAttribute("selected", "true");
					actList.setAttribute("label", account.prettyName);
					actList.setAttribute("value", com.synckolab.tools.text.accountNameFix(account.prettyName));
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
			if (this.isCalendar)
			{
				var calendars = com.synckolab.calendarTools.getCalendars();
		
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
					abchild.setAttribute("value", com.synckolab.tools.text.fixNameToMiniCharset(calendars[i].name));
					if (i == 0)
					{
						abchild.setAttribute("selected", "true");
						abList.setAttribute("label", calendars[i].name);
						abList.setAttribute("value", com.synckolab.tools.text.fixNameToMiniCharset(calendars[i].name));
					}
		
					abchild = document.createElement("menuitem");
					taskpopup.appendChild(abchild);
					abchild.setAttribute("label", calendars[i].name);
					abchild.setAttribute("value", com.synckolab.tools.text.fixNameToMiniCharset(calendars[i].name));
					if (i == 0)
					{
						abchild.setAttribute("selected", "true");
						taskList.setAttribute("label", calendars[i].name);
						taskList.setAttribute("value", com.synckolab.tools.text.fixNameToMiniCharset(calendars[i].name));
					}
				}
			}	
		},
		
		changeConfig: function (config)
		{
			
			// didnt change anything
			if (config == this.curConfig)
				return;
				
			if (this.curConfig != null)
				this.saveAllPrefs();
				
			this.curConfig = config;
		//	try
			{
				var pref = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
		
				var act = null;
				var actStateLocked = false;
		
				try
				{
					act = pref.getCharPref("SyncKolab."+config+".IncomingServer");
					actStateLocked = pref.prefIsLocked("SyncKolab."+config+".IncomingServer");
				}
				catch (ex)
				{
					com.synckolab.tools.logMessage("WARNING: Reading 'SyncKolab."+config+".IncomingServer' failed (trying old style): " + ex, com.synckolab.global.LOG_WARNING);
					// get the contact incoming (old style)
					try
					{
						act = pref.getCharPref("SyncKolab."+config+".ContactIncomingServer");
						actStateLocked = pref.prefIsLocked("SyncKolab."+config+".ContactIncomingServer");
					}
					catch (ex2) 
					{
						com.synckolab.tools.logMessage("WARNING: Reading 'SyncKolab."+config+".ContactIncomingServer' failed: " + ex2, com.synckolab.global.LOG_WARNING);
						try
						{
							act = pref.getCharPref("SyncKolab."+config+".CalendarIncomingServer");
							actStateLocked = pref.prefIsLocked("SyncKolab."+config+".CalendarIncomingServer");
						}
						catch (ex3) {
							com.synckolab.tools.logMessage("WARNING: Reading 'SyncKolab."+config+".CalendarIncomingServer' failed: " + ex3, com.synckolab.global.LOG_WARNING);
						}
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
				// set the state
				try {
					actList.setAttribute("disabled", actStateLocked);
				} catch (ex) {
					com.synckolab.tools.logMessage("WARNING: failed to set state of target-account: " + ex, com.synckolab.global.LOG_WARNING);
				}
				// default is 0
				document.getElementById ("syncInterval").setAttribute("value", 0);
				try
				{
					// update sync settings
					document.getElementById ("syncInterval").setAttribute("value", pref.getIntPref("SyncKolab."+config+".autoSync"));
				}
				catch (ex)
				{
					com.synckolab.tools.logMessage("WARNING: Reading 'SyncKolab."+config+".autoSync' failed: " + ex, com.synckolab.global.LOG_WARNING);
				}
				
				// check for autosync
				document.getElementById ("syncOnStart").checked = false;
				try
				{
					document.getElementById ("syncOnStart").checked = pref.getBoolPref("SyncKolab."+config+".syncOnStart");
				}
				catch (ex)
				{
					com.synckolab.tools.logMessage("WARNING: Reading 'SyncKolab."+config+".startOnSync' failed: " + ex, com.synckolab.global.LOG_WARNING);
				}

				// default do hide the window
				document.getElementById ("hiddenWnd").checked = true;
				try
				{		
					document.getElementById ("hiddenWnd").checked = pref.getBoolPref("SyncKolab."+config+".hiddenWindow");
				}
				catch (ex)
				{
					com.synckolab.tools.logMessage("WARNING: Reading 'SyncKolab."+config+".hiddenWindow' failed: " + ex, com.synckolab.global.LOG_WARNING);
				}
				// set the state
				try {
					document.getElementById("hiddenWnd").setAttribute("disabled", pref.prefIsLocked("SyncKolab."+config+".hiddenWindow"));
				} catch (ex) {
					com.synckolab.tools.logMessage("WARNING: failed to read state of SyncKolab."+config+".hiddenWindow: " + ex, com.synckolab.global.LOG_WARNING);
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
					com.synckolab.tools.logMessage("WARNING: Reading 'SyncKolab."+config+".Resolve' Setting to default failed: " + ex, com.synckolab.global.LOG_INFO);
					pref.setCharPref("SyncKolab."+config+".Resolve", "ask");
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
				// set the state
				try {
					actList.setAttribute("disabled", pref.prefIsLocked("SyncKolab."+config+".Resolve"));
				} catch (ex) {
					com.synckolab.tools.logMessage("WARNING: failed to read state of SyncKolab."+config+".Resolve: " + ex, com.synckolab.global.LOG_WARNING);
				}
		
				// update the folder selections
				// the address book
				var ab = null;
				try
				{
					ab = pref.getCharPref("SyncKolab."+config+".AddressBook");
				}
				catch (ex)
				{
					com.synckolab.tools.logMessage("WARNING: Reading 'SyncKolab."+config+".AddressBook' failed: " + ex, com.synckolab.global.LOG_WARNING);
				}
		
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
					// set the state of conURL
					try {
						actList.setAttribute("disabled", pref.prefIsLocked("SyncKolab."+config+".AddressBook"));
					} catch (ex) {
						com.synckolab.tools.logMessage("WARNING: failed to read state of SyncKolab."+config+".AddressBook: " + ex, com.synckolab.global.LOG_WARNING);
					}
				}
		
				var abFormat = null;
				try {
					abFormat = pref.getCharPref("SyncKolab."+config+".AddressBookFormat");
				} catch (ex) {
					com.synckolab.tools.logMessage("WARNING: Reading 'SyncKolab."+config+".AddressBookFormat' failed: " + ex, com.synckolab.global.LOG_WARNING);
				}
				
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
				// set the state of conFormat
				try {
					actList.setAttribute("disabled", pref.prefIsLocked("SyncKolab."+config+".AddressBookFormat"));
				} catch (ex) {
					com.synckolab.tools.logMessage("WARNING: failed to read state of SyncKolab."+config+".AddressBookFormat: " + ex, com.synckolab.global.LOG_WARNING);
				}
		
				document.getElementById ("saveToContactImap").checked = true;
				try {
					document.getElementById ("saveToContactImap").checked = pref.getBoolPref("SyncKolab."+config+".saveToContactImap");
				} catch (ex) {
					com.synckolab.tools.logMessage("WARNING: Reading 'SyncKolab."+config+".saveToContactImap' failed: " + ex, com.synckolab.global.LOG_WARNING);
				}
				// set the state
				try {
					document.getElementById("saveToContactImap").setAttribute("disabled", pref.prefIsLocked("SyncKolab."+config+".saveToContactImap"));
				} catch (ex) {
					com.synckolab.tools.logMessage("WARNING: failed to read state of SyncKolab."+config+".saveToContactImap: " + ex, com.synckolab.global.LOG_WARNING);
				}
		
				document.getElementById ("syncContacts").checked = false;
				try {
					document.getElementById ("syncContacts").checked = pref.getBoolPref("SyncKolab."+config+".syncContacts");
				} catch (ex) {
					com.synckolab.tools.logMessage("WARNING: Reading 'SyncKolab."+config+".syncContacts' failed: " + ex, com.synckolab.global.LOG_WARNING);
				}
				// set the state
				var syncContactsStateLocked = false;
				try {
					syncContactsStateLocked = pref.prefIsLocked("SyncKolab."+config+".syncContacts");
				} catch (ex) {
					com.synckolab.tools.logMessage("WARNING: failed to read state of SyncKolab."+config+".syncContacts: " + ex, com.synckolab.global.LOG_WARNING);
				}
				document.getElementById("syncContacts").setAttribute("disabled", syncContactsStateLocked);
		
				this.setControlStateContacts( document.getElementById("syncContacts").checked && (!syncContactsStateLocked) );
		
				var sCurFolder = null;
				try
				{
					sCurFolder = pref.getCharPref("SyncKolab."+config+".ContactFolderPath");
				} catch (ex) {
					com.synckolab.tools.logMessage("WARNING: Reading 'SyncKolab."+config+".ContactFolderPath' failed: " + ex, com.synckolab.global.LOG_WARNING);
				}
				
		
				this.updateFolder (act);
				this.updateFolder (act);
		
				if (sCurFolder != null)
				{
					var tree = document.getElementById ("conImapFolder");
					
					// make sure we have the correct folder in the view
					if (document.getElementById(sCurFolder) != null)
					{			
						var treei = tree.view.getIndexOfItem(document.getElementById(sCurFolder));
						if (treei < 0)
							alert("Problem with treeview - unable to select " + treei);
						else
						{
							tree.view.selection.select(treei); 
							if (tree.boxObject)
								tree.boxObject.scrollToRow(treei);
						}
					}
				}
				
				// same stuff for the calendarcontrols		
				if (this.isCalendar)
				{
					// the calendar			
					var ab = null;
					try
					{
						ab = pref.getCharPref("SyncKolab."+config+".Calendar");
					} catch (ex) {
						com.synckolab.tools.logMessage("WARNING: Reading 'SyncKolab."+config+".Calendar' failed: " + ex, com.synckolab.global.LOG_WARNING);
					}
					
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
					// set the state of calURL
					try {
						actList.setAttribute("disabled", pref.prefIsLocked("SyncKolab."+config+".Calendar"));
					} catch (ex) {
						com.synckolab.tools.logMessage("WARNING: failed to read state of SyncKolab."+config+".Calendar: " + ex, com.synckolab.global.LOG_WARNING);
					}
		
					var calFormat = null;
					try
					{
						calFormat = pref.getCharPref("SyncKolab."+config+".CalendarFormat");
					} catch (ex) {
						com.synckolab.tools.logMessage("WARNING: Reading 'SyncKolab."+config+".CalendarFormat' failed: " + ex, com.synckolab.global.LOG_WARNING);
					}
					
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
					// set the state of calFormat
					try {
						actList.setAttribute("disabled", pref.prefIsLocked("SyncKolab."+config+".CalendarFormat"));
					} catch (ex) {
						com.synckolab.tools.logMessage("WARNING: failed to read state of SyncKolab."+config+".CalendarFormat: " + ex, com.synckolab.global.LOG_WARNING);
					}
		
					// per default: sync last 6 monts (~180 days)
					document.getElementById ("calSyncTimeframe").setAttribute("value", 180);
					try
					{
						document.getElementById ("calSyncTimeframe").setAttribute("value", pref.getIntPref("SyncKolab."+config+".calSyncTimeframe"));
					}
					catch (ex) {
						com.synckolab.tools.logMessage("WARNING: Reading 'SyncKolab."+config+".calSyncTimeframe' failed: " + ex, com.synckolab.global.LOG_WARNING);
					}
					// set the state of calSyncTimeframe
					try {
						document.getElementById("calSyncTimeframe").setAttribute("disabled", pref.prefIsLocked("SyncKolab."+config+".calSyncTimeframe"));
					} catch (ex) {
						com.synckolab.tools.logMessage("WARNING: failed to read state of SyncKolab."+config+".calSyncTimeframe: " + ex, com.synckolab.global.LOG_WARNING);
					}
		
					document.getElementById ("saveToCalendarImap").checked = true;
					try
					{
						document.getElementById ("saveToCalendarImap").checked = pref.getBoolPref("SyncKolab."+config+".saveToCalendarImap");
					}
					catch (ex) {
						com.synckolab.tools.logMessage("WARNING: Reading 'SyncKolab."+config+".saveToCalendarImap' failed: " + ex, com.synckolab.global.LOG_WARNING);
					}
					
					document.getElementById ("syncCalendar").checked = false;
					try {
						document.getElementById ("syncCalendar").checked = pref.getBoolPref("SyncKolab."+config+".syncCalendar");
					} catch (ex) {
						com.synckolab.tools.logMessage("WARNING: Reading 'SyncKolab."+config+".syncCalendar' failed: " + ex, com.synckolab.global.LOG_WARNING);
					}
					// set the state of syncCalendar
					var syncCalendarStateLocked = false;
					try {
						syncCalendarStateLocked = pref.prefIsLocked("SyncKolab."+config+".syncCalendar");
					} catch (ex) {
						com.synckolab.tools.logMessage("WARNING: failed to read state of SyncKolab."+config+".syncCalendar: " + ex, com.synckolab.global.LOG_WARNING);
					}
					document.getElementById("syncCalendar").setAttribute("disabled", syncCalendarStateLocked);
		
					this.setControlStateCalendar( document.getElementById("syncCalendar").checked && (!syncCalendarStateLocked) );
		
					var sCurFolder = null;
					try
					{
						sCurFolder = pref.getCharPref("SyncKolab."+config+".CalendarFolderPath");
					} catch (ex) {
						com.synckolab.tools.logMessage("WARNING: Reading 'SyncKolab."+config+".CalendarFolderPath' failed: " + ex, com.synckolab.global.LOG_WARNING);
					}
					this.updateCalFolder (act);
					this.updateCalFolder (act);
					if (sCurFolder != null)
					{
						var tree= document.getElementById ("calImapFolder");
						// make sure we have the correct folder in the view
						if (document.getElementById(sCurFolder+"c") != null)
						{			
							var treei = tree.view.getIndexOfItem(document.getElementById(sCurFolder+"c"));
							if (treei < 0)
								alert("Problem with treeview - unable to select " + treei);
							else
							{
								tree.view.selection.select(treei); 
								if (tree.boxObject)
									tree.boxObject.scrollToRow(treei);
							}
						}
						// set the state of calImapFolder
						try {
							document.getElementById("calImapFolder").setAttribute("disabled", pref.prefIsLocked("SyncKolab."+config+".CalendarFolderPath"));
						} catch (ex) {
							com.synckolab.tools.logMessage("WARNING: failed to read state of SyncKolab."+config+".CalendarFolderPath: " + ex, com.synckolab.global.LOG_WARNING);
						}
					}
		
					// the tasks
					// the calendar			
					ab = null;
					try
					{
						ab = pref.getCharPref("SyncKolab."+config+".Tasks");
					} catch (ex) {
						com.synckolab.tools.logMessage("WARNING: Reading 'SyncKolab."+config+".Tasks' failed: " + ex, com.synckolab.global.LOG_WARNING);
					}
					
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
					// set the state of taskURL
					try {
						actList.setAttribute("disabled", pref.prefIsLocked("SyncKolab."+config+".Tasks"));
					} catch (ex) {
						com.synckolab.tools.logMessage("WARNING: failed to read state of SyncKolab."+config+".Tasks: " + ex, com.synckolab.global.LOG_WARNING);
					}
		
					calFormat = null;
					try
					{
						calFormat = pref.getCharPref("SyncKolab."+config+".TaskFormat");
					} catch (ex) {
						com.synckolab.tools.logMessage("WARNING: Reading 'SyncKolab."+config+".TaskFormat' failed: " + ex, com.synckolab.global.LOG_WARNING);
					}
					
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
					// set the state of taskFormat
					try {
						actList.setAttribute("disabled", pref.prefIsLocked("SyncKolab."+config+".TaskFormat"));
					} catch (ex) {
						com.synckolab.tools.logMessage("WARNING: failed to read state of SyncKolab."+config+".TaskFormat: " + ex, com.synckolab.global.LOG_WARNING);
					}
		
					// per default: sync last 6 monts (~180 days)
					document.getElementById ("taskSyncTimeframe").setAttribute("value", 180);
					try
					{
						document.getElementById ("taskSyncTimeframe").setAttribute("value", pref.getIntPref("SyncKolab."+config+".taskSyncTimeframe"));
					}
					catch (ex) {
						com.synckolab.tools.logMessage("WARNING: Reading 'SyncKolab."+config+".taskSyncTimeframe' failed: " + ex, com.synckolab.global.LOG_WARNING);
					}
					// set the state of taskSyncTimeframe
					try {
						document.getElementById("taskSyncTimeframe").setAttribute("disabled", pref.prefIsLocked("SyncKolab."+config+".taskSyncTimeframe"));
					} catch (ex) {
						com.synckolab.tools.logMessage("WARNING: failed to read state of SyncKolab."+config+".taskSyncTimeframe: " + ex, com.synckolab.global.LOG_WARNING);
					}
		
					document.getElementById ("saveToTaskImap").checked = true;
					try
					{
						document.getElementById ("saveToTaskImap").checked = pref.getBoolPref("SyncKolab."+config+".saveToTaskImap");
					}
					catch (ex) {
						com.synckolab.tools.logMessage("WARNING: Reading 'SyncKolab."+config+".saveToTaskImap' failed: " + ex, com.synckolab.global.LOG_WARNING);
					}
					// set the state of saveToTaskImap
					try {
						document.getElementById("saveToTaskImap").setAttribute("disabled", pref.prefIsLocked("SyncKolab."+config+".saveToTaskImap"));
					} catch (ex) {
						com.synckolab.tools.logMessage("WARNING: failed to read state of SyncKolab."+config+".saveToTaskImap: " + ex, com.synckolab.global.LOG_WARNING);
					}
		
					document.getElementById ("syncTasks").checked = false;
					try {
						document.getElementById ("syncTasks").checked = pref.getBoolPref("SyncKolab."+config+".syncTasks");
					} catch (ex) {
						com.synckolab.tools.logMessage("WARNING: Reading 'SyncKolab."+config+".syncTask' failed: " + ex, com.synckolab.global.LOG_WARNING);
					}
					// set the state of syncTasks
					var syncTasksStateLocked = false;
					try {
						syncTasksStateLocked = pref.prefIsLocked("SyncKolab."+config+".syncTasks");
					} catch (ex) {
						com.synckolab.tools.logMessage("WARNING: failed to read state of SyncKolab."+config+".syncTasks: " + ex, com.synckolab.global.LOG_WARNING);
					}
					document.getElementById("syncTasks").setAttribute("disabled", syncTasksStateLocked);
		
					this.setControlStateTasks( document.getElementById("syncTasks").checked && (!syncTasksStateLocked) );
		
					var sCurFolder = null;
					try
					{
						sCurFolder = pref.getCharPref("SyncKolab."+config+".TaskFolderPath");
					} catch (ex) {
						com.synckolab.tools.logMessage("WARNING: Reading 'SyncKolab."+config+".TaskFolderPath' failed: " + ex, com.synckolab.global.LOG_WARNING);
					}
					this.updateTaskFolder (act);
					this.updateTaskFolder (act);
					if (sCurFolder != null)
					{
						var tree= document.getElementById ("taskImapFolder");
						// make sure we have the correct folder in the view
						if (document.getElementById(sCurFolder+"t") != null)
						{			
							var treei = tree.view.getIndexOfItem(document.getElementById(sCurFolder+"t"));
							if (treei < 0) {
								alert("Problem with treeview - unable to select " + treei);
							}
							else
							{
								tree.view.selection.select(treei); 
								if (tree.boxObject)
									tree.boxObject.scrollToRow(treei);
							}
						}
						// set the state of taskImapFolder
						try {
							document.getElementById("taskImapFolder").setAttribute("disabled", pref.prefIsLocked("SyncKolab."+config+".TaskFolderPath"));
						} catch (ex) {
							com.synckolab.tools.logMessage("WARNING: failed to read state of SyncKolab."+config+".TaskFolderPath: " + ex, com.synckolab.global.LOG_WARNING);
						}
					}
				}
			}
		//	catch (ex)
			{}	
		},
		
		/**
		 * set all folders after an account change
		 */
		setFolders: function(act) {
			this.updateFolder(act);
			this.updateCalFolder(act);
			this.updateTaskFolder(act);
		},
		
		updateFolder: function (act) {
			// dynamically read this...
			var gAccountManager = Components.classes['@mozilla.org/messenger/account-manager;1'].getService(Components.interfaces.nsIMsgAccountManager);
			for (var i = 0; i < gAccountManager.allServers.Count(); i++)
			{
				try
				{
					var account = gAccountManager.allServers.GetElementAt(i).QueryInterface(Components.interfaces.nsIMsgIncomingServer);
					if (account.rootMsgFolder.baseMessageURI == act || com.synckolab.tools.text.accountNameFix(account.prettyName) == act)
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
						this.updateFolderElements (account.rootFolder, tChildren, "");
						return;			
						
					}
				}
				catch (ex)
				{
					
				}
			}
		},
		
		/**
		 * Delete all temp/cache - files/folders for this configuration
		 * @param config the config name
		 * @param type CALENDAR|TASK|CONTACT + FOLDER
		 */
		resetConfiguration: function(config, type)
		{
			var file = Components.classes["@mozilla.org/file/directory_service;1"].
			   getService(Components.interfaces.nsIProperties).
			   get("ProfD", Components.interfaces.nsIFile);
			file.append(config+".ab.hdb");
			if (file.exists())
				file.remove(true);
		
			file = Components.classes["@mozilla.org/file/directory_service;1"].
			   getService(Components.interfaces.nsIProperties).
			   get("ProfD", Components.interfaces.nsIFile);
			file.append(config+".cal.hdb");
			if (file.exists())
				file.remove(true);
		
			file = Components.classes["@mozilla.org/file/directory_service;1"].
			   getService(Components.interfaces.nsIProperties).
			   get("ProfD", Components.interfaces.nsIFile);
			file.append(config+".task.hdb");
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
			
			file.append("tasks");
			if (file.exists())
			{
				file.append(config);
				if (file.exists())
					file.remove (true);
			}
			
		},
		
		setFolder: function(uri)
		{
			if (this.curConfig == null)
			{
				return;
			}
			
			var pref = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
			pref.setCharPref("SyncKolab."+this.curConfig+".ContactFolderPath", uri);
			this.resetConfiguration(this.curConfig, "CONTACTFOLDER");
		},
		
		
		/**
		 * updates the folder tree
		 */
		updateFolderElements: function (msgFolder, root, appendChar)
		{
			var tItem = document.createElement("treeitem");
			var tRow = document.createElement("treerow");
			tItem.appendChild(tRow);
			var tCell = document.createElement("treecell");
			tRow.appendChild(tCell);
			tItem.setAttribute("id", msgFolder.URI + appendChar);
			tCell.setAttribute("label", msgFolder.prettyName);
			tCell.setAttribute("value", msgFolder.URI);
			root.appendChild(tItem);
			if (msgFolder.hasSubFolders )
			{
		
				tItem.setAttribute("container", "true");
				tItem.setAttribute("open", "true");
				var tChildren = document.createElement("treechildren");
				tItem.appendChild(tChildren);
				
				// tbird 3 uses subFolders enumerator instead of getsubfolders
				var subfolders = msgFolder.subFolders?msgFolder.subFolders:msgFolder.GetSubFolders ();
		
				// this block is only for tbird < 3
				try
				{
					if (subfolders.first)
						subfolders.first ();
				}
				catch (ex)
				{
					alert("NOTHING: " + msgFolder.prettyName);
					return;
				}
				
				while (subfolders != null)
				{
					var cur = null;
					// tbird < 3
					if (subfolders.currentItem)
						cur = subfolders.currentItem();
					else
						cur = subfolders.getNext();
					
					if (cur == null)
						break;
					
					cur = cur.QueryInterface(Components.interfaces.nsIMsgFolder);
					
					this.updateFolderElements (cur, tChildren, appendChar);
					
					// break condition tbird3
					if (subfolders.hasMoreElements && !subfolders.hasMoreElements())
						break;
					
					// tbird <3 break condition
					if (subfolders.isDone && subfolders.isDone())
						break;
					if (subfolders.next)
					{
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
		},
		
		setCalFolder: function(uri)
		{
			if (this.curConfig == null)
			{
				return;
			}
		
			var pref = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
			pref.setCharPref("SyncKolab."+this.curConfig+".CalendarFolderPath", uri);
			this.resetConfiguration(this.curConfig, "CALENDARFOLDER");
		},
		
		setTaskFolder: function(uri)
		{
			if (this.curConfig == null)
			{
				return;
			}
		
			var pref = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
			pref.setCharPref("SyncKolab."+this.curConfig+".TaskFolderPath", uri);
			this.resetConfiguration(this.curConfig, "TASKFOLDER");
		},
		
		updateCalFolder: function (act)
		{
			// dynamically read this...
			
			var gAccountManager = Components.classes['@mozilla.org/messenger/account-manager;1'].getService(Components.interfaces.nsIMsgAccountManager);
			for (var i = 0; i < gAccountManager.allServers.Count(); i++)
			{
				try
				{
					var account = gAccountManager.allServers.GetElementAt(i).QueryInterface(Components.interfaces.nsIMsgIncomingServer);
					if (account.rootMsgFolder.baseMessageURI == act || com.synckolab.tools.text.accountNameFix(account.prettyName) == act)
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
			
						this.updateFolderElements (account.rootFolder, tChildren, "c");
						return;			
						
					}
				}
				catch (ex) {
					com.synckolab.tools.logMessage("Error: " + ex, com.synckolab.global.LOG_ERROR);			
				}
			}
		},
		
		
		updateTaskFolder: function (act)
		{
			// dynamically read this...
			
			var gAccountManager = Components.classes['@mozilla.org/messenger/account-manager;1'].getService(Components.interfaces.nsIMsgAccountManager);
			for (var i = 0; i < gAccountManager.allServers.Count(); i++)
			{
				try
				{
					var account = gAccountManager.allServers.GetElementAt(i).QueryInterface(Components.interfaces.nsIMsgIncomingServer);
					if (account.rootMsgFolder.baseMessageURI == act || com.synckolab.tools.text.accountNameFix(account.prettyName) == act)
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
			
						this.updateFolderElements (account.rootFolder, tChildren, "t");
						return;			
						
					}
				}
				catch (ex) {
					com.synckolab.tools.logMessage("Error: " + ex, com.synckolab.global.LOG_ERROR);	
				}
			}
		},
		
		saveAllPrefs: function (configName) {
			if (this.curConfig == null && (!configName || configName == null))
				return;
			
			var config = this.curConfig;
			
			if (config == null)
				config = configName;
				
			var pref = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
			
			// server side configuration
			pref.setCharPref("SyncKolab."+config+".IncomingServer", document.getElementById ("ImapAcct").value);
			if (document.getElementById("DefaultResolve"))
				pref.setCharPref("SyncKolab."+config+".Resolve", document.getElementById ("DefaultResolve").value);
			else
				pref.setCharPref("SyncKolab."+config+".Resolve", "ask");
		
			if (document.getElementById("syncInterval") && parseInt(document.getElementById ("syncInterval").value) != 'NaN')
				pref.setIntPref("SyncKolab."+config+".autoSync", parseInt(document.getElementById ("syncInterval").value));
			else
				pref.setIntPref("SyncKolab."+config+".autoSync", 0);
			
			if (document.getElementById("hiddenWnd"))
				pref.setBoolPref("SyncKolab."+config+".hiddenWindow", document.getElementById ("hiddenWnd").checked);
			else
				pref.setBoolPref("SyncKolab."+config+".hiddenWindow", false);
			
			if(document.getElementById ("syncOnStart"))
				pref.setBoolPref("SyncKolab."+config+".syncOnStart", document.getElementById ("syncOnStart").checked);
			else
				pref.setBoolPref("SyncKolab."+config+".syncOnStart", false);

			pref.setCharPref("SyncKolab."+config+".AddressBook", document.getElementById ("conURL").value);
			pref.setCharPref("SyncKolab."+config+".AddressBookFormat", document.getElementById ("conFormat").value);
			pref.setBoolPref("SyncKolab."+config+".saveToContactImap", document.getElementById ("saveToContactImap").checked);
			pref.setBoolPref("SyncKolab."+config+".syncContacts", document.getElementById ("syncContacts").checked);
		
			// if we do not have a calendar, we can easily skip this
			if (this.isCalendar)
			{
				pref.setCharPref("SyncKolab."+config+".Calendar", document.getElementById ("calURL").value);
				pref.setCharPref("SyncKolab."+config+".CalendarFormat", document.getElementById ("calFormat").value);
				pref.setBoolPref("SyncKolab."+config+".saveToCalendarImap", document.getElementById ("saveToCalendarImap").checked);
				pref.setBoolPref("SyncKolab."+config+".syncCalendar", document.getElementById ("syncCalendar").checked);
				if (document.getElementById("calSyncTimeframe") != null && parseInt(document.getElementById("calSyncTimeframe").value) != 'NaN')
					pref.setIntPref("SyncKolab."+config+".calSyncTimeframe", parseInt(document.getElementById("calSyncTimeframe").value));
				else
					pref.setIntPref("SyncKolab."+config+".calSyncTimeframe", 180);
					
				pref.setCharPref("SyncKolab."+config+".Tasks", document.getElementById ("taskURL").value);
				pref.setCharPref("SyncKolab."+config+".TaskFormat", document.getElementById ("taskFormat").value);
				pref.setBoolPref("SyncKolab."+config+".saveToTaskImap", document.getElementById ("saveToTaskImap").checked);
				pref.setBoolPref("SyncKolab."+config+".syncTasks", document.getElementById ("syncTasks").checked);
				if (document.getElementById("taskSyncTimeframe") && parseInt(document.getElementById("taskSyncTimeframe").value) != 'NaN')
					pref.setIntPref("SyncKolab."+config+".taskSyncTimeframe", parseInt(document.getElementById("taskSyncTimeframe").value));
				else
					pref.setIntPref("SyncKolab."+config+".taskSyncTimeframe", 180);
			}
		},
		
		
		// called when closed (OK)
		savePrefs: function() {
			var pref = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
		
			try {
				if (document.getElementById ("closeWnd"))
					pref.setBoolPref("SyncKolab.closeWindow", document.getElementById ("closeWnd").checked);
				else
					pref.setBoolPref("SyncKolab.closeWindow", false);
				
				pref.setIntPref("SyncKolab.debugLevel", document.getElementById ("skDebugLevel").value);
				
			} catch ( ex ) {
				com.synckolab.tools.logMessage("Error: failed to set prefs value: " + ex, com.synckolab.global.LOG_ERROR);
			};
		
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
					if (cur.firstChild.firstChild.getAttribute("id") != "Welcome-Welcome" && cur.firstChild.firstChild.getAttribute("label") != this.strBundle.getString("aboutSyncKolab"))
						configs += cur.firstChild.firstChild.getAttribute("label") + ";";
				}
				cur = cur.nextSibling;
			}
			
			var pref = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
			pref.setCharPref("SyncKolab.Configs", configs);
			
			this.saveAllPrefs (this.curConfig);
					
		},
		
		addConfig: function()
		{
			window.open('chrome://synckolab/content/newWizard.xul', 'newWizard', 'chrome,resizable=0');
			// close the current window
			window.close();
		},
		
		delConfig: function()
		{
			var config = this.curConfig;
			if (confirm(this.strBundle.getFormattedString("configDelete", [config])))
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
							if (cur.firstChild.firstChild.getAttribute("id") != "Welcome-Welcome" && cur.firstChild.firstChild.getAttribute("label") != this.strBundle.getString("aboutSyncKolab"))
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
				this.curConfig = null;
		
				if (delNode != null)
				{
					try
					{
						ctree.removeChild(delNode);
					} catch (ex) {}
				}
			}
		},
		
		/**
		 * Enables/disables the controls on the page
		 */
		setControlStateContacts: function(active) 
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
		},
		
		/**
		 * Enables/disables the autosync on start
		 */
		setSyncOnStart: function(active) 
		{
			
		},
				
		/**
		 * Enables/disables the controls on the page
		 */
		setControlStateCalendar: function(active) 
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
		},
		
		/**
		 * Enables/disables the controls on the page
		 */
		setControlStateTasks: function(active) 
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
		},
		
		
		/**
		 * Save a single Configuration
		 */
		saveSingleConfig: function()
		{
			var configName = this.curConfig;
			var nsIFilePicker = Components.interfaces.nsIFilePicker;
			var fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
			fp.init(window, this.strBundle.getString("saveConfig"), nsIFilePicker.modeSave);
			fp.appendFilter(this.strBundle.getString("configFiles"),"*.config");
			fp.defaultString = configName + ".config";
			fp.defaultExtension = "config";
			var res = fp.show();
			if (res == nsIFilePicker.returnOK){
				var thefile = fp.file;
				// open the file
				thefile.create(thefile.NORMAL_FILE_TYPE, 0600);
			 	var stream = Components.classes['@mozilla.org/network/file-output-stream;1'].createInstance(Components.interfaces.nsIFileOutputStream);
			 	stream.init(thefile, 2, 0x200, false); // open as "write only"
		
				var s = "# SyncKolab V"+com.synckolab.config.version+" Configuration File\n";
				stream.write(s, s.length);
				writeLine(stream, "SyncKolab.Configs", configName+";");
				
				writeConfig(configName, stream);
				
				s = "\n\n";
				stream.write(s, s.length);
				stream.close();
			}
		},
		
		/**
		 * Load a configuration from a file
		 */
		loadConfig: function()
		{
			var nsIFilePicker = Components.interfaces.nsIFilePicker;
			var fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
			fp.init(window, this.strBundle.getString("loadConfig"), nsIFilePicker.modeOpen);
			fp.appendFilter(this.strBundle.getString("configFiles"),"*.config");
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
					if (!confirm(this.strBundle.getString("configReplaceAll")))
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
							pref.setBoolPref(value, 'true');
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
						alert(this.strBundle.getString("configInvalid"));
						return;
					}
		
					// get all available configurations
					var configs = new Array();
				
					try {
						var Config = pref.getCharPref("SyncKolab.Configs");
						configs = Config.split(';');
					} catch(ex) {
						com.synckolab.tools.logMessage("ERROR: Reading 'SyncKolab.Configs' failed: " + ex, com.synckolab.global.LOG_ERROR);
					}
		
					var haveConfig = false;			
					for (var i=0; i < configs.length; i++)
					{
						if (configs[i] == prefName)
						{
							if (!confirm(this.strBundle.getString("configOverwrite") + prefName))
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
							
						try {
							loadConfigItem(pref, name, value);
						}
						catch (ex) {
							com.synckolab.tools.logMessage("WARNING: Unable to set pref-value of '" + name + "':" + ex, com.synckolab.global.LOG_WARNING);
						}
					}
					
				}
			}
			
			// reopen config dialog
			window.open('chrome://synckolab/content/synckolabPref.xul', '', 'chrome,resizable=1');
			this.close();	
		},
		
		/**
		 * Save all Configurations (incl. global options)
		 */
		saveAllConfig: function()
		{
			var nsIFilePicker = Components.interfaces.nsIFilePicker;
			var fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
			fp.init(window, this.strBundle.getString("saveConfig"), nsIFilePicker.modeSave);
			fp.appendFilter(this.strBundle.getString("configFiles"),"*.config");
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
				} catch(ex) {
					com.synckolab.tools.logMessage("ERROR: Reading 'SyncKolab.Configs' failed: " + ex, com.synckolab.global.LOG_ERROR);
				}
			
				// in case we did not find anything - check if there are "old" configurations
				// and use them (like an importer)
				if (configs.length == 0)
				{
					var oldConfigs = new Array();
					try {
						var conConfig = pref.getCharPref("SyncKolab.AddressBookConfigs");
						oldConfigs = conConfig.split(';');
					} catch(ex) {
						com.synckolab.tools.logMessage("ERROR: Reading 'SyncKolab.AddressBookConfigs' failed: " + ex, com.synckolab.global.LOG_ERROR);
					}
					
					try {
						var calConfig = pref.getCharPref("SyncKolab.CalendarConfigs");
						oldConfigs = oldConfigs.concat(calConfig.split(';'));
					}
					catch(ex) {
						com.synckolab.tools.logMessage("ERROR: Reading 'SyncKolab.CalendarConfigs' failed: " + ex, com.synckolab.global.LOG_ERROR);
					}
					
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
					thefile.create(thefile.NORMAL_FILE_TYPE, 0600);
				}
			 	var stream = Components.classes['@mozilla.org/network/file-output-stream;1'].createInstance(Components.interfaces.nsIFileOutputStream);
			 	stream.init(thefile, 2, 0x200, false); // open as "write only"
		
				var s = "# SyncKolab V1.0.1 Configuration File\n";
				stream.write(s, s.length);
		
				// generate the configuration in the tree control 	
				s = '';
				for (var i=0; i < configs.length; i++)
				{
					s += configs[i] + ';';
					writeConfig(configs[i], stream);
				}
				writeLine(stream, "SyncKolab.Configs", s);
				
				// global prefs items:
				var fieldsArray = new Array(
					"debugLevel"
					);
			
				for(var i=0 ; i < fieldsArray.length ; i++ ) {
					try
					{
						writeConfigItem(stream, pref, "SyncKolab", fieldsArray[i]);
					}
					catch (exw) {
						com.synckolab.tools.logMessage("WARNING: Writing 'SyncKolab." + fieldsArray[i] + "' failed: " + exw, com.synckolab.global.LOG_WARNING);
					} // can be ignored savely
				}	
				
				s = "\n\n";
				stream.write(s, s.length);
				stream.close();
			}
		},
		
		loadConfigItem: function(config, paramName, paramValue)
		{
			var paramParts = new Array();
			paramParts = paramName.split('.');
			var keyName = "";
		
			if (paramParts.length > 0) {
				keyName = paramParts[ paramParts.length - 1 ];
			}
			else {
				keyName = paramName;
			}
		
			var keyType = this.CONFIG_FIELD_TYPES[keyName];
			switch (keyType)
			{
				case FIELD_TYPE_BOOL:
					config.setBoolPref(keyName, paramValue);
					break;
				case FIELD_TYPE_CHAR:
					config.setCharPref(keyName, paramValue);
					break;
				case FIELD_TYPE_INT:
					config.setIntPref(keyName, paramValue);
					break;
				default:
					com.synckolab.tools.logMessage("ERROR: Unknown field/type '" + keyName + "/" + keyType + "'", com.synckolab.global.LOG_ERROR);
					break;
			}
		},
		
		writeConfigItem: function(file, config, keyPrefix, keyName)
		{
			var keyValue = null;
			var keyType = this.CONFIG_FIELD_TYPES[keyName];
			switch (keyType)
			{
				case FIELD_TYPE_BOOL:
					keyValue = config.getBoolPref(keyPrefix+"."+keyName)?'true':'false';
					break;
				case FIELD_TYPE_CHAR:
					keyValue = config.getCharPref(keyPrefix+"."+keyName);
					break;
				case FIELD_TYPE_INT:
					keyValue = config.getIntPref(keyPrefix+"."+keyName);
					break;
				default:
					com.synckolab.tools.logMessage("ERROR: Unknown field/type '"+keyName+"/"+keyType+"'", com.synckolab.global.LOG_ERROR);
					break;
			}
			writeLine(file, keyPrefix+"."+keyName, keyValue);
		},
		
		writeLine: function (file, key, value)
		{
			if (value == null || key == null)
				return;
			var s = key + "=" + value + "\n";
			file.write(s, s.length);
		},
		/**
		 * Writes the configuration into a open file stream
		 */
		writeConfig: function (config, file)
		{
			var pref = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
				
			var act = null;
			try
			{
				act = pref.getCharPref("SyncKolab."+config+".IncomingServer");
			}
			catch (ex)
			{
				com.synckolab.tools.logMessage("WARNING: Reading 'SyncKolab."+config+".IncomingServer' failed (trying old style): " + ex, com.synckolab.global.LOG_WARNING);
				// get the contact incoming (old style)
				try
				{
					act = pref.getCharPref("SyncKolab."+config+".ContactIncomingServer");
				}
				catch (ex2) 
				{
					com.synckolab.tools.logMessage("WARNING: Reading 'SyncKolab."+config+".ContactIncomingServer' failed: " + ex2, com.synckolab.global.LOG_WARNING);
					try
					{
						act = pref.getCharPref("SyncKolab."+config+".CalendarIncomingServer");
					}
					catch (ex3) {
						com.synckolab.tools.logMessage("WARNING: Reading 'SyncKolab."+config+".CalendarIncomingServer' failed: " + ex3, com.synckolab.global.LOG_WARNING);
					}
				}
			}
			
			writeLine(file, "SyncKolab."+config+".IncomingServer", act);
			
			
			// prefs items (type will be looked up later):
			var fieldsArray = new Array(
				"AddressBook",
				"AddressBookFormat",
				"calSyncTimeframe",
				"taskSyncTimeframe",
				"ContactFolderPath",
				"Calendar",
				"CalendarFormat",
				"Resolve",
				"CalendarFolderPath",
				"Tasks",
				"TaskFormat",
				"TaskFolderPath",
				"autoSync",
				"syncContacts",
				"saveToContactImap",
				"saveToCalendarImap",
				"syncCalendar",
				"saveToTaskImap",
				"syncTasks",
				"hiddenWindow"
				);
		
			for(var i=0 ; i < fieldsArray.length ; i++ ) {
				try
				{
					writeConfigItem(file, pref, "SyncKolab."+config, fieldsArray[i]);
				}
				catch (exw) {
					com.synckolab.tools.logMessage("WARNING: Writing of configuration item 'SyncKolab."+config+"."+fieldsArray[i]+" failed" , com.synckolab.global.LOG_WARNING);
				} // can be ignored savely
			}	
		}
};