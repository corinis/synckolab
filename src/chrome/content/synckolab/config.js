if(!com) var com={};
if(!com.synckolab) com.synckolab={};

com.synckolab.config = {
		version: "1.5.1",
		
		// Global debug setting (on)
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
		
		isTbird3: true,

		// string bundle use: strBundle.getString("KEYNAME") (init in synckolab.js)
		strBundle: {},
		
		consoleService: Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService),
		rdf: Components.classes["@mozilla.org/rdf/rdf-service;1"].getService(Components.interfaces.nsIRDFService),
		ios: Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService),
		folderDatasource: Components.classes["@mozilla.org/rdf/datasource;1?name=mailnewsfolders"].createInstance(Components.interfaces.nsIRDFDataSource),
		messageService: Components.classes["@mozilla.org/messenger/messageservice;1?type=imap"].getService(Components.interfaces.nsIMsgMessageService) 
};
