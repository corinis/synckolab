/* 
 ***** BEGIN LICENSE BLOCK ***** 
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
 * 
 ***** END LICENSE BLOCK ***** */
"use strict";

if(!com) var com={};
if(!com.synckolab) com.synckolab={};

com.synckolab.config = {
		version: "2.0.0",
		DEBUG_SYNCKOLAB: true,
		
		SWITCH_TIME: 20, //wait 20ms (enough so tbird wont get unresponsive)

		// set this to true to also print timing information
		PERFLOG_SYNCKOLAB: true,
		
		DEBUG_SYNCKOLAB_LEVEL: 15, // global.global.LOG_ALL + global.global.LOG_DEBUG

		//set this to true and on every error there will be a pause so you can check the logs
		PAUSE_ON_ERROR: false
	};

com.synckolab.global = {
		// log settings
		LOG_ERROR: 0,
		LOG_WARNING: 1,
		LOG_INFO: 2,
		LOG_DEBUG: 3,
		LOG_CAL: 4,
		LOG_AB: 8,
		LOG_ALL: 12,
		
		// pointer to the window
		wnd : null, 
		
		// string bundle use: strBundle.getString("KEYNAME") (init in synckolab.js)
		strBundle: {},
		
		consoleService: Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService),
		rdf: Components.classes["@mozilla.org/rdf/rdf-service;1"].getService(Components.interfaces.nsIRDFService),
		ios: Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService),
		folderDatasource: Components.classes["@mozilla.org/rdf/datasource;1?name=mailnewsfolders"].createInstance(Components.interfaces.nsIRDFDataSource),
		messageService: Components.classes["@mozilla.org/messenger/messageservice;1?type=imap"].getService(Components.interfaces.nsIMsgMessageService) 
};

/**
 * reads the configuration. 
 * This can also be used to refresh the configuration after a change.
 * It will read all thats necessary and also prepares teh required objects like
 * <ul>
 * <li>sync db file
 * <li>the msgfolder
 * <li>the folder listener
 * </ul>
 */
com.synckolab.config.readConfiguration = function() {
	com.synckolab.tools.logMessage("Checking configuration", com.synckolab.global.LOG_DEBUG);
	var pref = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
	var i;
	var configs = [];
	try {
		configs = pref.getCharPref("SyncKolab.Configs").split(';');
		configs.sort();
	} catch(ex2) {
		com.synckolab.tools.logMessage("ERROR: Reading 'SyncKolab.Configs' failed: " + ex2, com.synckolab.global.LOG_ERROR);
	}

	if (configs.length === 0)
	{
		com.synckolab.tools.logMessage("No Configuration found - please run setup.", com.synckolab.global.LOG_ERROR);
		return;
	}

	// check if we have an up-to-date config loaded
	if (com.synckolab.main.syncConfigs && com.synckolab.main.syncConfigs.length > 0)
	{
		if (com.synckolab.main.syncConfigs.length === configs.length) {

			// Check our previous configs against the current list of configs.
			var configChanged = false;
			for (i = 0; i < configs.length; i++) {
				// skip empty configs
				if(configs[i] === '') {
					continue;
				}
				
				var found = false;
				for(var j = 0; j < com.synckolab.main.syncConfigs.length; j++) {
					if(com.synckolab.main.syncConfigs[j]) {
						if (configs[i] === com.synckolab.main.syncConfigs[j].name) {
							found = true;
							break;
						}
					}
				}
				// the config name was not found
				if(!found) {
					com.synckolab.tools.logMessage("unable to find " + configs[i], com.synckolab.global.LOG_DEBUG);
					configChanged = true;
					break;
				}
			}

			// skip re-reading of config - nothing changed
			if(!configChanged) {
				return;
			}
		}
		com.synckolab.tools.logMessage("Config has changed - reloading.", com.synckolab.global.LOG_DEBUG);
	}

	// set the debug level
	com.synckolab.config.DEBUG_SYNCKOLAB_LEVEL = com.synckolab.global.LOG_ALL + com.synckolab.global.LOG_WARNING; // default: warn
	try {
		com.synckolab.config.DEBUG_SYNCKOLAB_LEVEL = com.synckolab.global.LOG_ALL + pref.getIntPref("SyncKolab.debugLevel");
	} catch (ex) {
		com.synckolab.tools.logMessage("WARNING: Reading 'SyncKolab.debugLevel' failed - setting default as WARNING: " + ex, com.synckolab.global.LOG_WARNING);
		pref.setIntPref("SyncKolab.debugLevel", com.synckolab.config.DEBUG_SYNCKOLAB_LEVEL);
	}
	
	com.synckolab.tools.logMessage("Reading configurations...", com.synckolab.global.LOG_DEBUG);

	// create an object for each configuration
	com.synckolab.main.syncConfigs = [];
	
	var curConfig = null;
	
	// check if we want to "hide" the configured folders
	try {
		com.synckolab.main.hideFolder = pref.getBoolPref("SyncKolab.hideFolder");
	} catch (hideEx) {
		// default: don't hide
		com.synckolab.main.hideFolder = false;
	}
	
	// fill the configs
	for (i=0; i < configs.length; i++)
	{
		// skip empty configs
		if (configs[i] === '') {
			continue;
		}
		
		curConfig = {};
		com.synckolab.main.syncConfigs[i] = curConfig;
		
		curConfig.syncTimer = 0;
		curConfig.name = configs[i];
		try
		{
			curConfig.autoRun = pref.getIntPref("SyncKolab."+configs[i]+".autoSync");
		}catch (ex3)
		{
			com.synckolab.tools.logMessage("WARNING: Reading 'SyncKolab."+configs[i]+".autoSync' failed: " + ex3, com.synckolab.global.LOG_WARNING);
			curConfig.autoRun = 0;
		}

		try
		{
			curConfig.autoHideWindow = pref.getBoolPref("SyncKolab."+configs[i]+".hiddenWindow");
		}catch (ex4)
		{
			com.synckolab.tools.logMessage("WARNING: Reading 'SyncKolab."+configs[i]+".hiddenWindow' failed: " + ex4, com.synckolab.global.LOG_WARNING);
			curConfig.autoHideWindow = false;
		}
		
		curConfig.serverKey = pref.getCharPref("SyncKolab." + curConfig.name + ".IncomingServer");

		curConfig.conflictResolve = "ask";
		try {
			curConfig.conflictResolve = pref.getCharPref("SyncKolab." + curConfig.name + ".Resolve");
		} catch (ignore) {
		}

		
		// read the messagefolder and save the object in the config
		
		// add the contact configuration info
		curConfig.contact = com.synckolab.config.createEmptyconfig(curConfig, "contact");
		com.synckolab.AddressBook.readConfig(curConfig.contact, pref);
		com.synckolab.config.fillMsgFolder(curConfig.contact);

		// add the calendar configuration info
		curConfig.cal = com.synckolab.config.createEmptyconfig(curConfig, "cal");
		com.synckolab.Calendar.readConfig(curConfig.cal, pref);
		com.synckolab.config.fillMsgFolder(curConfig.cal);

		// same for tasks
		curConfig.task = com.synckolab.config.createEmptyconfig(curConfig, "task");
		com.synckolab.Calendar.readConfig(curConfig.task, pref);
		com.synckolab.config.fillMsgFolder(curConfig.task);

		curConfig.startOnce = false;
		try
		{
			if(pref.getBoolPref("SyncKolab."+configs[i]+".syncOnStart") === true)
			{
				com.synckolab.tools.logMessage("Run on Startup for "+ curConfig.name, com.synckolab.global.LOG_DEBUG);
				// hide the window 
				com.synckolab.main.doHideWindow = curConfig.autoHideWindow;
				com.synckolab.main.forceConfig = curConfig.name;
				com.synckolab.main.sync("timer");
			}
		}catch (ex5)
		{
			com.synckolab.tools.logMessage("WARNING: Reading 'SyncKolab."+configs[i]+".syncOnStart' failed: " + ex5, com.synckolab.global.LOG_WARNING);
			curConfig.autoHideWindow = false;
		}
	}
	
	var msgNotificationService = Components.classes["@mozilla.org/messenger/msgnotificationservice;1"].getService(Components.interfaces.nsIMsgFolderNotificationService);
	msgNotificationService.addListener(com.synckolab.config.folderListener, msgNotificationService.msgAdded | msgNotificationService.msgsDeleted | msgNotificationService.msgsMoveCopyCompleted);
	
};

/**
 * creates an empty config object
 */
com.synckolab.config.createEmptyconfig = function(baseConfig, confType) {
	var c = {
		sync: false,
		useSyncListener: false,
		name: baseConfig.name,
		type: confType,
		serverKey: baseConfig.serverKey,
		conflictResolve: baseConfig.conflictResolve,
		hide: com.synckolab.main.hideFolder,
		addListener: false,
		triggerParseAddMessage: function(msg, config){},
		triggerParseDeleteMessage: function(msg, config) {}
	};
	
	if(confType === "contact") {
		c.triggerParseAddMessage = com.synckolab.AddressBook.triggerParseAddMessage;
		c.triggerParseDeleteMessage = com.synckolab.AddressBook.triggerParseDeleteMessage;
	} else {
		// tasks and events are handled by calendar
		c.triggerParseAddMessage = com.synckolab.Calendar.triggerParseAddMessage;
		c.triggerParseDeleteMessage = com.synckolab.Calendar.triggerParseDeleteMessage;
	}
	
	return c;
};

com.synckolab.config.folderListener = {
	findConfig: function(folder) {
		// fixup folder: image:// vs. imap-message://
		folder = "imap-message" + folder.substring(4);
		
		// search through the configs  
		for(var j = 0; j < com.synckolab.main.syncConfigs.length; j++) {
			if(com.synckolab.main.syncConfigs[j]) {
				var curConfig = com.synckolab.main.syncConfigs[j];
				//com.synckolab.tools.logMessage("checking " + curConfig.contact.folderMsgURI + " vs. " + folder, com.synckolab.global.LOG_DEBUG);

				if(curConfig.contact && curConfig.contact.sync) {
					if(curConfig.contact.useSyncListener && curConfig.contact.folderMsgURI === folder)
					{
						return curConfig.contact;
					}
				}
				if(curConfig.cal && curConfig.cal.sync) {
					if(curConfig.cal.useSyncListener && curConfig.cal.folderMsgURI === folder) {
						return curConfig.cal;
					}
				}
				if(curConfig.task && curConfig.task.sync) {
					if(curConfig.task.useSyncListener && curConfig.task.folderMsgURI === folder) {
						return curConfig.task;
					}
				}
			}
		}
		
	},
	msgAdded: function(aMsg) {
		// make sure not to parse messages while a full sync is running
		if(com.synckolab.global.running) {
			return;
		}
		
		var msg = aMsg.QueryInterface(Components.interfaces.nsIMsgDBHdr);
		//nsIMsgDBHdr - check folder
		com.synckolab.tools.logMessage("ADDED to " + msg.folder.folderURL, com.synckolab.global.LOG_DEBUG);
		// lets see if we have this folde rin the list
		var curConfig = this.findConfig(msg.folder.folderURL);
		if(curConfig) {
			com.synckolab.tools.logMessage("Found configuration for folder... calling", com.synckolab.global.LOG_DEBUG);
			var content = {
					message: "imap-message" + msg.folder.folderURL.substring(4) +"#"+msg.messageKey,
					fileContent: "",
					// save the config used
					config: curConfig,
					nextFunc: curConfig.triggerParseAddMessage
			};
			com.synckolab.main.getMessageIntoContent(content);
		}
	},
	msgsClassified: function(aMsgs, aJunkProcessed, aTraitProcessed) {
		// ignore
	},
	msgsDeleted: function(aMsgs) {
		// make sure not to parse messages while a full sync is running
		if(com.synckolab.global.running) {
			return;
		}
		
		//nsiArray<nsIMsgDBHdr> - check folder
		com.synckolab.tools.logMessage("GOT DELETE...", com.synckolab.global.LOG_DEBUG);
		var e = aMsgs.enumerate();
		while(e.hasMoreElements()) {
			var msg = e.getNext().QueryInterface(Components.interfaces.nsIMsgDBHdr);
			com.synckolab.tools.logMessage("DELETED from " + msg.folder.folderURL, com.synckolab.global.LOG_DEBUG);
			var curConfig = this.findConfig(msg.folder.folderURL);
			if(curConfig) {
				var content = {
						message: "imap-message" + msg.folder.folderURL.substring(4) +"#"+msg.messageKey,
						fileContent: "",
						// save the config used
						config: curConfig,
						nextFunc: curConfig.triggerParseDeleteMessage
				};
				com.synckolab.main.getMessageIntoContent(content);
			}
		}
	},
	msgsMoveCopyCompleted: function(aMove, aSrcMsgs, aDestFolder) {
		//nsiArray<nsIMsgDBHdr> - check folder
		com.synckolab.tools.logMessage("COPY/MOVE", com.synckolab.global.LOG_DEBUG);
	},
	msgKeyChanged: function(aOldMsgKey, aNewMsgHdr) {
		// ignore
	},
	folderAdded: function(aFolder) {
		// ignore
	},
	folderDeleted: function(aFolder) {
		// ignore
	},
	folderMoveCopyCompleted: function(aMove, aSrcFolder, aDestFolder) {
		// ignore
	},
	folderRenamed: function(aOrigFolder, aNewFolder) {
		// ignore
	},
	itemEvent: function(aItem, aEvent, aData) {
		com.synckolab.tools.logMessage("EVENT", com.synckolab.global.LOG_DEBUG);
	}
};

/**
 * Helper function to init all the msg folder and everything thats
 * required to read/write messages.<br>
 * Make sure that serverKey and folderPath are already set correctly in the config object.
 * @param config the configuration object
 */
com.synckolab.config.fillMsgFolder = function(config) {
	// if we dont have it - dont initialize it
	if(!config.sync) {
		return;
	}

	// get and set the message folder
	config.folder = com.synckolab.tools.getMsgFolder(config.serverKey, config.folderPath);
	config.folderMsgURI = config.folder.baseMessageURI;
	config.email = com.synckolab.tools.getAccountEMail(config.serverKey);
	config.mailname = com.synckolab.tools.getAccountName(config.serverKey);

	com.synckolab.tools.logMessage("check listener for "+ config.folderMsgURI, com.synckolab.global.LOG_DEBUG);

	if(config.addListener) {
		com.synckolab.tools.logMessage("adding listener for "+ config.folderMsgURI, com.synckolab.global.LOG_DEBUG);
	}
};


