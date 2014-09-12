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

if(!synckolab) var synckolab={};

synckolab.config = {
		version: "3.1.7",
		DEBUG_SYNCKOLAB: true,
		
		SWITCH_TIME: 20, //wait 20ms (enough so tbird wont get unresponsive)

		// set this to true to also print timing information
		PERFLOG_SYNCKOLAB: true,
		
		DEBUG_SYNCKOLAB_LEVEL: 12, // global.global.LOG_ALL + global.global.LOG_ERROR

		//set this to true and on every error there will be a pause so you can check the logs
		PAUSE_ON_ERROR: false,
		
		// default version of configuration
		VERSION: -1,
		
		// definition of settings that are the same for each part (contact/calendar/task)
		baseSetting: {
			// the address book / calendar
			source: {type: synckolab.tools.CONFIG_TYPE_CHAR, def: null },
			// the imap folder path
			folderPath: {type: synckolab.tools.CONFIG_TYPE_CHAR, def: null },
			// true if the config is enabled
			enabled: {type: synckolab.tools.CONFIG_TYPE_BOOL, def: true },
			// save changes to imap (vs. read only)
			saveToImap: {type: synckolab.tools.CONFIG_TYPE_BOOL, def: true },
			// automatically sync every X minutes (0 = disable)
			//@deprecated syncInterval: {type: synckolab.tools.CONFIG_TYPE_INT, def: 0 },
			// format to use: xml|vcard
			format: {type: synckolab.tools.CONFIG_TYPE_CHAR, def: "xml-k3" },
			// timeframe to sync in (don't sync entries with an older start-date)
			timeFrame: {type: synckolab.tools.CONFIG_TYPE_INT, def: 180}, 
			// enable the sync listener
			syncListener: {type: synckolab.tools.CONFIG_TYPE_BOOL, def: false },
			// what to do with conflicts
			defaultResolve: {type: synckolab.tools.CONFIG_TYPE_CHAR, def: "ask" }
		}
	};

synckolab.global = {
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
synckolab.config.loadConfiguration = function(pref) {
	// create a pref service if none is given already
	if(!pref) {
		pref = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
	}
	
	var config = {
		version: synckolab.tools.getConfigValue(pref, "configVersion", synckolab.tools.CONFIG_TYPE_INT, 0),
		// default: only errors - override: show debug
		debugLevel: synckolab.tools.getConfigValue(pref, "debugLevel", synckolab.tools.CONFIG_TYPE_INT, synckolab.global.LOG_ERROR),
		// hide folder
		hideFolder: synckolab.tools.getConfigValue(pref, "hideFolder", synckolab.tools.CONFIG_TYPE_BOOL, false),
		// close window when done
		closeWindow: synckolab.tools.getConfigValue(pref, "closeWindow", synckolab.tools.CONFIG_TYPE_BOOL, false),
		// sync automatically once on start
		syncOnStart: synckolab.tools.getConfigValue(pref, "syncOnStart", synckolab.tools.CONFIG_TYPE_BOOL, false),
		accounts: []
	};
	
	var sAcct = synckolab.tools.getConfigValue(pref, "accounts.list");
	if (sAcct) {
		var sAccts = sAcct.split(';');
		for(let i = 0; i < sAccts.length; i++) {
			// skip empty configs
			if(sAccts[i].length < 1) {
				continue;
			}
			var acct = {
					name: sAccts[i], // name = incomingServer
					contact: [],
					calendar: [],
					task: []
			};
			config.accounts.push(acct);
			
			synckolab.config.loadAccountConfig(pref, acct);
		}
	}
	
	return config;
};


/**
 * read the account configuration into an object
 * @param acct the account object to read the configuration into (name has to be existent)
 */
synckolab.config.loadAccountConfig = function (pref, acct) {
	var sConf, sConfs, i;
	for(var type in acct) {
		// skip volatiles/non-arrays
		if(type !== "name" && acct[type].push) {
		
			sConf = synckolab.tools.getConfigValue(pref, "accounts." + acct.name+"." + type + ".list");
			sConfs = sConf.split(';');
			if(sConfs) {
				for(i = 0; i < sConfs.length; i++) {
					// skip empty configs
					if(sConfs[i].length === 0) {
						continue;
					}
					var cConf = {
							name: sConfs[i]
					};
					acct[type].push(cConf);
					
					// read all the base settings
					for(var n in synckolab.config.baseSetting) {
						// skip unwanted prototypes (without type)
						if(synckolab.config.baseSetting[n].type  >= 0) {
							cConf[n] = synckolab.tools.getConfigValue(pref, "accounts." + acct.name+"." + type + ".configs." + cConf.name + "." + n, 
									synckolab.config.baseSetting[n].type, 
									synckolab.config.baseSetting[n].def);
						}
					}
					
					// Some fixes for old version
					if(cConf.format && cConf.format.toLowerCase() === "xml") {
						synckolab.tools.logMessage("Old config - autofixing xml->kolab2", synckolab.global.LOG_INFO);
						cConf.format = "xml-k2";
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
synckolab.config.readConfiguration = function() {
	var pref = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
	var curVersion = synckolab.tools.getConfigValue(pref, "configVersion", synckolab.tools.CONFIG_TYPE_INT, 0);
	synckolab.tools.logMessage("Checking configuration ("+synckolab.config.VERSION+" - "+curVersion+")", synckolab.global.LOG_DEBUG);

	if(curVersion === synckolab.config.VERSION) {
		// nothing changed and we have an active config
		return;
	} 

	// load the configuration (use existing pref service)
	var config = synckolab.config.loadConfiguration(pref);

	// set the debug level
	synckolab.config.DEBUG_SYNCKOLAB_LEVEL = synckolab.global.LOG_ALL + config.debugLevel;

	synckolab.tools.logMessage("Config Version has changed. ("+synckolab.config.VERSION+" - "+curVersion+") - LogLevel " + synckolab.config.DEBUG_SYNCKOLAB_LEVEL, synckolab.global.LOG_INFO);

	// remember the config version
	synckolab.config.VERSION = curVersion;
	
	synckolab.main.config = config;
	
	// hide folder
	synckolab.main.hideFolder = config.hideFolder;
	// create an object for each configuration
	synckolab.main.syncConfigs = [];
	// hide window
	synckolab.main.doHideWindow = config.hiddenWindow;

	
	// check for listener or autorun
	for(let account in fixIterator(config.accounts))
	{
		// read the messagefolder and save the object in the config
		for(let contact in fixIterator(account.contact)) {
			contact.serverKey = account.name;
			synckolab.config.prepareConfig(contact, "contact");
			if(contact.enabled) {
				synckolab.tools.logMessage("Adding contact account " + contact.name, synckolab.global.LOG_INFO);
				synckolab.main.syncConfigs.push(contact);
			}
		}
		if(account.calendar) {
			for(let calendar in fixIterator(account.calendar)) {
				synckolab.tools.logMessage("checking calendar " + calendar.name, synckolab.global.LOG_INFO);
				calendar.serverKey = account.name;
				synckolab.config.prepareConfig(calendar, "calendar");
				if(calendar) {
					synckolab.tools.logMessage("Adding calendar account " + calendar.name, synckolab.global.LOG_INFO);
					synckolab.main.syncConfigs.push(calendar);
				} else {
					synckolab.tools.logMessage(calendar.name + " is disabled", synckolab.global.LOG_INFO);
				}
			}
		}
		if(account.task) {
			for(let task in fixIterator(account.task)) {
				synckolab.tools.logMessage("checking task " + task.name, synckolab.global.LOG_INFO);
				task.serverKey = account.name;
				synckolab.config.prepareConfig(task, "task");
				if(task.enabled) {
					synckolab.tools.logMessage("Adding task account " + task.name, synckolab.global.LOG_INFO);
					synckolab.main.syncConfigs.push(task);
				}
		}
		}
	}
	
	var msgNotificationService = Components.classes["@mozilla.org/messenger/msgnotificationservice;1"].getService(Components.interfaces.nsIMsgFolderNotificationService);
	msgNotificationService.addListener(synckolab.config.folderListener, msgNotificationService.msgAdded | msgNotificationService.msgsDeleted | msgNotificationService.msgsMoveCopyCompleted);
	
};

/**
 * check each config if it is already processed. If so, remove fromconfig.
 * This only prevents double-processing within one loop.
 */
synckolab.config.checkIdProcessed = function(baseConfig, id) {
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
synckolab.config.prepareConfig = function(baseConfig, confType) {
	// if we dont wnat to - dont initialize it
	if(!baseConfig.enabled) {
		synckolab.tools.logMessage("config " + baseConfig.name +"/"+confType + " is disabled!", synckolab.global.LOG_INFO);
		return;
	}
	// no folder - not enabled
	if(!baseConfig.folderPath || baseConfig.folderPath.length < 1) {
		synckolab.tools.logMessage("disabling " + baseConfig.name +"/"+confType + "- no folderpath found", synckolab.global.LOG_INFO);
		baseConfig.enabled = false;
		return;
	}
	
	// no source - not enabled
	if(!baseConfig.source) {
		synckolab.tools.logMessage("disabling " + baseConfig.name +"/"+confType + "- no source found", synckolab.global.LOG_INFO);
		baseConfig.enabled = false;
		return;
	}

	// keep a lookup of ALL messages in the folder for local trigger
	baseConfig.msgList = new synckolab.hashMap(); 

	// keep a list of all IDs recently processed - this avoids double checking
	baseConfig.recentProcessed = [];
	
	// add type
	baseConfig.type = confType;

	// trigger handler
	if(confType === "contact") {
		baseConfig.triggerParseAddMessage = synckolab.AddressBook.triggerParseAddMessage;
		baseConfig.triggerParseDeleteMessage = synckolab.AddressBook.triggerParseDeleteMessage;
		baseConfig.init = synckolab.AddressBook.init;
		baseConfig.syncClass = synckolab.AddressBook;
		// add some custom contact related stuff
		synckolab.AddressBook.readConfig(baseConfig);
	} else {
		// tasks and events are handled by calendar
		baseConfig.triggerParseAddMessage = synckolab.Calendar.triggerParseAddMessage;
		baseConfig.triggerParseDeleteMessage = synckolab.Calendar.triggerParseDeleteMessage;
		baseConfig.init = synckolab.Calendar.init;
		baseConfig.syncClass = synckolab.Calendar;
		// add some custom contact related stuff
		synckolab.Calendar.readConfig(baseConfig);
	}
	
	// get and set the message folder
	baseConfig.folder = synckolab.tools.getMsgFolder(baseConfig.serverKey, baseConfig.folderPath);
	// disable config if it doesnt exist
	if(!baseConfig.folder) {
		synckolab.tools.logMessage("disabling " + baseConfig.name +"/"+confType + " - baseFolder missing " + baseConfig.folderPath, synckolab.global.LOG_INFO);
		baseConfig.enabled = false;
		return;
	}

	baseConfig.folderMsgURI = baseConfig.folder.baseMessageURI;
	baseConfig.email = synckolab.tools.getAccountEMail(baseConfig.serverKey);
	baseConfig.mailname = synckolab.tools.getAccountName(baseConfig.serverKey);

	synckolab.tools.logMessage(baseConfig.name +"/"+confType + ": check listener for "+ baseConfig.folderMsgURI, synckolab.global.LOG_DEBUG);

	if(baseConfig.addListener) {
		synckolab.tools.logMessage("adding listener for "+ baseConfig.folderMsgURI, synckolab.global.LOG_DEBUG);
	}

	synckolab.tools.logMessage(baseConfig.name +"/"+confType + ": check sync on start", synckolab.global.LOG_DEBUG);

	baseConfig.startOnce = false;
	if(baseConfig.syncOnStart)
	{
		synckolab.tools.logMessage("Run on Startup for "+ baseConfig.name, synckolab.global.LOG_DEBUG);
		// run the config 
		synckolab.main.forceConfig = baseConfig;
		synckolab.main.sync("timer");
	}
	synckolab.tools.logMessage(baseConfig.name +"/"+confType + ": done ("+baseConfig.enabled+")", synckolab.global.LOG_DEBUG);

};

synckolab.config.folderListener = {
	findConfig: function(folder) {
		// fixup folder: image:// vs. imap-message://
		folder = "imap-message" + folder.substring(4);
		
		// search through the configs
		for(let curConfig in fixIterator(synckolab.main.syncConfigs)) {
			if(curConfig) {
				synckolab.tools.logMessage("checking " + curConfig.folderMsgURI + " vs. " + folder, synckolab.global.LOG_DEBUG);
				
				if(curConfig.syncListener && curConfig.folderMsgURI === folder)
					return curConfig;
				
			}
		}
		
	},
	msgAdded: function(aMsg) {
		// make sure not to parse messages while a full sync is running
		if(synckolab.global.running || synckolab.global.triggerRunning) {
			return;
		}
		
		var msg = aMsg.QueryInterface(Components.interfaces.nsIMsgDBHdr);
		
		//nsIMsgDBHdr - check folder
		synckolab.tools.logMessage("ADDED to " + msg.folder.folderURL, synckolab.global.LOG_DEBUG);
		// lets see if we have this folde rin the list
		var curConfig = this.findConfig(msg.folder.folderURL);
		if(curConfig) {
			// check if this one hasnt been just added
			if(synckolab.config.checkIdProcessed(curConfig, msg.mime2DecodedSubject)) {
				synckolab.tools.logMessage("message recently processed - ignore", synckolab.global.LOG_DEBUG);
				return;
			}

			synckolab.tools.logMessage("Found configuration for folder... calling", synckolab.global.LOG_DEBUG);
			var content = {
					message: "imap-message" + msg.folder.folderURL.substring(4) +"#"+msg.messageKey,
					fileContent: "",
					// save the config used
					config: curConfig,
					nextFunc: curConfig.triggerParseAddMessage
			};
			synckolab.main.getMessageIntoContent(content);
		}
	},
	msgsClassified: function(aMsgs, aJunkProcessed, aTraitProcessed) {
		// ignore
	},
	msgsDeleted: function(aMsgs) {
		// make sure not to parse messages while a full sync is running
		if(synckolab.global.running || synckolab.global.triggerRunning) {
			return;
		}
		
		//nsiArray<nsIMsgDBHdr> - check folder
		synckolab.tools.logMessage("GOT DELETE...", synckolab.global.LOG_DEBUG);
		var e = aMsgs.enumerate();
		while(e.hasMoreElements()) {
			var msg = e.getNext().QueryInterface(Components.interfaces.nsIMsgDBHdr);
			synckolab.tools.logMessage("DELETED from " + msg.folder.folderURL, synckolab.global.LOG_DEBUG);
			var curConfig = this.findConfig(msg.folder.folderURL);
			if(curConfig) {
				// check if this one hasnt been just removed
				if(synckolab.config.checkIdProcessed(curConfig, msg.mime2DecodedSubject)) {
					synckolab.tools.logMessage("message recently processed - ignore", synckolab.global.LOG_DEBUG);
					return;
				}

				var content = {
						message: "imap-message" + msg.folder.folderURL.substring(4) +"#"+msg.messageKey,
						fileContent: "",
						// save the config used
						config: curConfig,
						nextFunc: curConfig.triggerParseDeleteMessage
				};
				synckolab.main.getMessageIntoContent(content);
			}
		}
	},
	/**
	 * this can be two things: move AWAY or INTO one of our folders
	 */
	msgsMoveCopyCompleted: function(aMove, aSrcMsgs, aDestFolder) {
		//nsiArray<nsIMsgDBHdr> - check folder
		synckolab.tools.logMessage("MOVE: " + aMove, synckolab.global.LOG_DEBUG);
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
		synckolab.tools.logMessage("EVENT", synckolab.global.LOG_DEBUG);
	}
};



