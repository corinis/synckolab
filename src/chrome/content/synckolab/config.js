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
 * Copyright (c) Kolab Systems 2012
 * Author: Niko Berger <berger(at)kolabsys.com>
 *
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
		version: "2.0.1",
		DEBUG_SYNCKOLAB: true,
		
		SWITCH_TIME: 20, //wait 20ms (enough so tbird wont get unresponsive)

		// set this to true to also print timing information
		PERFLOG_SYNCKOLAB: true,
		
		DEBUG_SYNCKOLAB_LEVEL: 15, // global.global.LOG_ALL + global.global.LOG_DEBUG

		//set this to true and on every error there will be a pause so you can check the logs
		PAUSE_ON_ERROR: false,
		
		// default version of configuration
		VERSION: -1,
		
		// definition of settings that are the same for each part (contact/calendar/task)
		baseSetting: {
			// the address book / calendar
			source: {type: com.synckolab.tools.CONFIG_TYPE_CHAR, def: null },
			// the imap folder path
			folderPath: {type: com.synckolab.tools.CONFIG_TYPE_CHAR, def: null },
			// true if the config is enabled
			enabled: {type: com.synckolab.tools.CONFIG_TYPE_BOOL, def: true },
			// save changes to imap (vs. read only)
			saveToImap: {type: com.synckolab.tools.CONFIG_TYPE_BOOL, def: true },
			// automatically sync every X minutes (0 = disable)
			syncInterval: {type: com.synckolab.tools.CONFIG_TYPE_INT, def: 0 },
			// format to use: xml|vcard
			format: {type: com.synckolab.tools.CONFIG_TYPE_CHAR, def: "xml" },
			// timeframe to sync in (don't sync entries with an older start-date)
			timeFrame: {type: com.synckolab.tools.CONFIG_TYPE_INT, def: 180}, 
			// enable the sync listener
			syncListener: {type: com.synckolab.tools.CONFIG_TYPE_BOOL, def: false },
			// what to do with conflicts
			defaultResolve: {type: com.synckolab.tools.CONFIG_TYPE_CHAR, def: "ask" }
		}
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
		
		triggerRunning: false,
		running: false,
		
		consoleService: Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService),
		rdf: Components.classes["@mozilla.org/rdf/rdf-service;1"].getService(Components.interfaces.nsIRDFService),
		ios: Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService),
		folderDatasource: Components.classes["@mozilla.org/rdf/datasource;1?name=mailnewsfolders"].createInstance(Components.interfaces.nsIRDFDataSource),
		messageService: Components.classes["@mozilla.org/messenger/messageservice;1?type=imap"].getService(Components.interfaces.nsIMsgMessageService) 
};

/**
 * Reads the configuration into an object. the object structure is:
 * config.accounts[NAME].[contact|calendar|task].CONFIGNAME
 * @param pref the preference service (optional)
 * @returns a configuration object
 */
com.synckolab.config.loadConfiguration = function(pref) {
	if(!pref) {
		pref = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
	}
	
	var config = {
		version: com.synckolab.tools.getConfigValue(pref, "configVersion", com.synckolab.tools.CONFIG_TYPE_INT, 0),
		debugLevel: com.synckolab.tools.getConfigValue(pref, "debugLevel", com.synckolab.tools.CONFIG_TYPE_INT, com.synckolab.global.LOG_WARNING),
		// hide folder
		hideFolder: com.synckolab.tools.getConfigValue(pref, "hideFolder", com.synckolab.tools.CONFIG_TYPE_BOOL, false),
		// hide the window while sync
		hiddenWindow: com.synckolab.tools.getConfigValue(pref, "hiddenWindow", com.synckolab.tools.CONFIG_TYPE_BOOL, false),
		// sync automatically once on start
		syncOnStart: com.synckolab.tools.getConfigValue(pref, "syncOnStart", com.synckolab.tools.CONFIG_TYPE_BOOL, false),
		accounts: []
	};
	
	var sAcct = com.synckolab.tools.getConfigValue(pref, "accounts.list");
	if (sAcct) {
		var sAccts = sAcct.split(';');
		for(var i = 0; i < sAccts.length; i++) {
			// skip empty configs
			if(sAccts[i].length <= 3) {
				continue;
			}
			var acct = {
					name: sAccts[i], // name = incomingServer
					contact: [],
					calendar: [],
					task: []
			};
			config.accounts.push(acct);
			
			com.synckolab.config.loadAccountConfig(pref, acct);
		}
	}
	
	return config;
};


/**
 * read the account configuration into an object
 * @param acct the account object to read the configuration into (name has to be existent)
 */
com.synckolab.config.loadAccountConfig = function (pref, acct) {
	var sConf, sConfs, i;
	for(var type in acct) {
		// skip volatiles/non-arrays
		if(type !== "name" && acct[type].push) {
		
			sConf = com.synckolab.tools.getConfigValue(pref, "accounts." + acct.name+"." + type + ".list");
			sConfs = sConf.split(';');
			if(sConfs) {
				for(i = 0; i < sConfs.length; i++) {
					// skip empty configs
					if(sConfs[i].length <= 3) {
						continue;
					}
					var cConf = {
							name: sConfs[i]
					};
					acct[type].push(cConf);
					
					// read all the base settings
					for(var n in com.synckolab.config.baseSetting) {
						// skip unwanted prototypes (without type)
						if(com.synckolab.config.baseSetting[n].type  >= 0) {
							cConf[n] = com.synckolab.tools.getConfigValue(pref, "accounts." + acct.name+"." + type + ".configs." + cConf.name + "." + n, 
									com.synckolab.config.baseSetting[n].type, 
									com.synckolab.config.baseSetting[n].def);
						}
					}
				}
			}
		}
	}
};

/**
 * reads the configuration. 
 * This can also be used to refresh the configuration after a change.
 * It will read all thats necessary and also prepares the required objects like
 * <ul>
 * <li>sync db file
 * <li>the msgfolder
 * <li>the folder listener
 * </ul>
 */
com.synckolab.config.readConfiguration = function() {
	var i,j;
	var pref = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
	var curVersion = com.synckolab.tools.getConfigValue(pref, "configVersion", com.synckolab.tools.CONFIG_TYPE_INT, 0);
	com.synckolab.tools.logMessage("Checking configuration ("+com.synckolab.config.VERSION+" - "+curVersion+")", com.synckolab.global.LOG_DEBUG);

	if(curVersion === com.synckolab.config.VERSION) {
		// nothing changed and we have an active config
		return;
	} 

	// load the configuration (use existing pref service)
	var config = com.synckolab.config.loadConfiguration(pref);

	// set the debug level
	com.synckolab.config.DEBUG_SYNCKOLAB_LEVEL = com.synckolab.global.LOG_ALL + config.debugLevel;

	com.synckolab.tools.logMessage("Config Version has changed. ("+com.synckolab.config.VERSION+" - "+curVersion+") - LogLevel " + com.synckolab.config.DEBUG_SYNCKOLAB_LEVEL, com.synckolab.global.LOG_INFO);

	// remember the config version
	com.synckolab.config.VERSION = curVersion;
	
	com.synckolab.main.config = config;
	
	// hide folder
	com.synckolab.main.hideFolder = config.hideFolder;
	// create an object for each configuration
	com.synckolab.main.syncConfigs = [];
	// hide window
	com.synckolab.main.doHideWindow = config.hiddenWindow;

	
	// check for listener or autorun
	for (i=0; i < config.accounts.length; i++)
	{
		var account = config.accounts[i];
		// read the messagefolder and save the object in the config
		for(j = 0; j < account.contact.length; j++) {
			account.contact[j].serverKey = account.name;
			com.synckolab.config.prepareConfig(account.contact[j], "contact");
			if(account.contact[j].enabled) {
				com.synckolab.tools.logMessage("Adding contact account " + account.contact[j].name, com.synckolab.global.LOG_INFO);
				com.synckolab.main.syncConfigs.push(account.contact[j]);
			}
		}
		if(account.calendar) {
			for(j = 0; j < account.calendar.length; j++) {
				com.synckolab.tools.logMessage("checking calendar " + account.calendar[j].name, com.synckolab.global.LOG_INFO);
				account.calendar[j].serverKey = account.name;
				com.synckolab.config.prepareConfig(account.calendar[j], "calendar");
				com.synckolab.tools.logMessage("checking calendar " + account.calendar[j].name + " enabled? " + account.calendar[j].enabled, com.synckolab.global.LOG_INFO);
				if(account.calendar[j].enabled) {
					com.synckolab.tools.logMessage("Adding calendar account " + account.calendar[j].name, com.synckolab.global.LOG_INFO);
					com.synckolab.main.syncConfigs.push(account.calendar[j]);
				}
			}
		}
		if(account.task) {
			for(j = 0; j < account.task.length; j++) {
				com.synckolab.tools.logMessage("checking task " + account.calendar[j].name, com.synckolab.global.LOG_INFO);
				account.task[j].serverKey = account.name;
				com.synckolab.config.prepareConfig(account.task[j], "task");
				if(account.task[j].enabled) {
					com.synckolab.tools.logMessage("Adding task account " + account.task[j].name, com.synckolab.global.LOG_INFO);
					com.synckolab.main.syncConfigs.push(account.task[j]);
				}
		}
		}
	}
	
	var msgNotificationService = Components.classes["@mozilla.org/messenger/msgnotificationservice;1"].getService(Components.interfaces.nsIMsgFolderNotificationService);
	msgNotificationService.addListener(com.synckolab.config.folderListener, msgNotificationService.msgAdded | msgNotificationService.msgsDeleted | msgNotificationService.msgsMoveCopyCompleted);
	
};

com.synckolab.config.checkIdProcessed = function(baseConfig, id) {
	for(var i = 0; i < baseConfig.recentProcessed.length; i++) {
		if(id === baseConfig.recentProcessed[i]) {
			baseConfig.recentProcessed.splice(i, 1);
			return true;
		}
	}
	// not yet processed - remember
	baseConfig.recentProcessed.push(id);
	return false;
};
/**
 * creates an empty config object
 */
com.synckolab.config.prepareConfig = function(baseConfig, confType) {
	// if we dont wnat to - dont initialize it
	if(!baseConfig.enabled) {
		com.synckolab.tools.logMessage("config " + baseConfig.name +"/"+confType + " is disabled!", com.synckolab.global.LOG_INFO);
		return;
	}
	// no folder - not enabled
	if(!baseConfig.folderPath || baseConfig.folderPath.length < 5) {
		com.synckolab.tools.logMessage("disabling " + baseConfig.name +"/"+confType + "- no folderpath found", com.synckolab.global.LOG_INFO);
		baseConfig.enabled = false;
		return;
	}
	
	// no source - not enabled
	if(!baseConfig.source) {
		com.synckolab.tools.logMessage("disabling " + baseConfig.name +"/"+confType + "- no source found", com.synckolab.global.LOG_INFO);
		baseConfig.enabled = false;
		return;
	}

	// keep a lookup of ALL messages in the folder for local trigger
	baseConfig.msgList = new com.synckolab.hashMap(); 

	// keep a list of all IDs recently processed - this avoids double checking
	baseConfig.recentProcessed = [];
	
	// add type
	baseConfig.type = confType;

	// trigger handler
	if(confType === "contact") {
		baseConfig.triggerParseAddMessage = com.synckolab.AddressBook.triggerParseAddMessage;
		baseConfig.triggerParseDeleteMessage = com.synckolab.AddressBook.triggerParseDeleteMessage;
		baseConfig.init = com.synckolab.AddressBook.init;
		baseConfig.syncClass = com.synckolab.AddressBook;
		// add some custom contact related stuff
		com.synckolab.AddressBook.readConfig(baseConfig);
	} else {
		// tasks and events are handled by calendar
		baseConfig.triggerParseAddMessage = com.synckolab.Calendar.triggerParseAddMessage;
		baseConfig.triggerParseDeleteMessage = com.synckolab.Calendar.triggerParseDeleteMessage;
		baseConfig.init = com.synckolab.Calendar.init;
		baseConfig.syncClass = com.synckolab.Calendar;
		// add some custom contact related stuff
		com.synckolab.Calendar.readConfig(baseConfig);
	}
	
	// get and set the message folder
	baseConfig.folder = com.synckolab.tools.getMsgFolder(baseConfig.serverKey, baseConfig.folderPath);
	// disable config if it doesnt exist
	if(!baseConfig.folder) {
		com.synckolab.tools.logMessage("disabling " + baseConfig.name +"/"+confType + " - baseFolder missing " + baseConfig.folderPath, com.synckolab.global.LOG_INFO);
		baseConfig.enabled = false;
		return;
	}

	baseConfig.folderMsgURI = baseConfig.folder.baseMessageURI;
	baseConfig.email = com.synckolab.tools.getAccountEMail(baseConfig.serverKey);
	baseConfig.mailname = com.synckolab.tools.getAccountName(baseConfig.serverKey);

	com.synckolab.tools.logMessage(baseConfig.name +"/"+confType + ": check listener for "+ baseConfig.folderMsgURI, com.synckolab.global.LOG_DEBUG);

	if(baseConfig.addListener) {
		com.synckolab.tools.logMessage("adding listener for "+ baseConfig.folderMsgURI, com.synckolab.global.LOG_DEBUG);
	}

	com.synckolab.tools.logMessage(baseConfig.name +"/"+confType + ": check sync on start", com.synckolab.global.LOG_DEBUG);

	baseConfig.startOnce = false;
	if(baseConfig.syncOnStart)
	{
		com.synckolab.tools.logMessage("Run on Startup for "+ baseConfig.name, com.synckolab.global.LOG_DEBUG);
		// run the config 
		com.synckolab.main.forceConfig = baseConfig;
		com.synckolab.main.sync("timer");
	}
	com.synckolab.tools.logMessage(baseConfig.name +"/"+confType + ": done ("+baseConfig.enabled+")", com.synckolab.global.LOG_DEBUG);

};

com.synckolab.config.folderListener = {
	findConfig: function(folder) {
		// fixup folder: image:// vs. imap-message://
		folder = "imap-message" + folder.substring(4);
		
		// search through the configs  
		for(var j = 0; j < com.synckolab.main.syncConfigs.length; j++) {
			if(com.synckolab.main.syncConfigs[j]) {
				var curConfig = com.synckolab.main.syncConfigs[j];
				com.synckolab.tools.logMessage("checking " + curConfig.folderMsgURI + " vs. " + folder, com.synckolab.global.LOG_DEBUG);

				if(curConfig.syncListener && curConfig.folderMsgURI === folder)
				{
					return curConfig;
				}
			}
		}
		
	},
	msgAdded: function(aMsg) {
		// make sure not to parse messages while a full sync is running
		if(com.synckolab.global.running || com.synckolab.global.triggerRunning) {
			return;
		}
		
		var msg = aMsg.QueryInterface(Components.interfaces.nsIMsgDBHdr);
		
		//nsIMsgDBHdr - check folder
		com.synckolab.tools.logMessage("ADDED to " + msg.folder.folderURL, com.synckolab.global.LOG_DEBUG);
		// lets see if we have this folde rin the list
		var curConfig = this.findConfig(msg.folder.folderURL);
		if(curConfig) {
			// check if this one hasnt been just added
			if(com.synckolab.config.checkIdProcessed(curConfig, msg.mime2DecodedSubject)) {
				com.synckolab.tools.logMessage("message recently processed - ignore", com.synckolab.global.LOG_DEBUG);
				return;
			}

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
		if(com.synckolab.global.running || com.synckolab.global.triggerRunning) {
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
				// check if this one hasnt been just removed
				if(com.synckolab.config.checkIdProcessed(curConfig, msg.mime2DecodedSubject)) {
					com.synckolab.tools.logMessage("message recently processed - ignore", com.synckolab.global.LOG_DEBUG);
					return;
				}

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
	/**
	 * this can be two things: move AWAY or INTO one of our folders
	 */
	msgsMoveCopyCompleted: function(aMove, aSrcMsgs, aDestFolder) {
		//nsiArray<nsIMsgDBHdr> - check folder
		com.synckolab.tools.logMessage("MOVE: " + aMove, com.synckolab.global.LOG_DEBUG);
		if(aMove) {
			this.msgsDeleted(aSrcMsgs);
		}
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



