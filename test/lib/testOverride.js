
synckolab.config = {
		version: "3.0.0",
		DEBUG_SYNCKOLAB: true,
		
		SWITCH_TIME: 20, //wait 20ms (enough so tbird wont get unresponsive)

		// set this to true to also print timing information
		PERFLOG_SYNCKOLAB: true,
		
		DEBUG_SYNCKOLAB_LEVEL: 15, // global.global.LOG_ALL + global.global.LOG_DEBUG

		//set this to true and on every error there will be a pause so you can check the logs
		PAUSE_ON_ERROR: false
};

synckolab.global = {
		// log settings
		LOG_ERROR: 0,
		LOG_WARNING: 1,
		LOG_INFO: 2,
		LOG_DEBUG: 3,
		LOG_CAL: 4,
		LOG_AB: 8,
		LOG_ALL: 12
};

synckolab.global= consoleService = {
		logStringMessage: function(msg) {
		print(msg);
	}
};

synckolab.tools.parseXml = function(content) {
	return new DOMParser().parseFromString(content, "application/xml");
}

synckolab.tools.logMessage = function (msg) {
	print(msg);
}