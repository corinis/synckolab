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

synckolab.config = {
		version: "3.0.0",
		DEBUG_SYNCKOLAB: true,
		
		SWITCH_TIME: 20, //wait 20ms (enough so tbird wont get unresponsive)

		// set this to true to also print timing information
		PERFLOG_SYNCKOLAB: true,
		
		DEBUG_SYNCKOLAB_LEVEL: synckolab.global.LOG_ALL + synckolab.global.LOG_INFO,

		//set this to true and on every error there will be a pause so you can check the logs
		PAUSE_ON_ERROR: false
};


synckolab.global.consoleService = {
		logStringMessage: function(msg) {
			print(msg);
	}
};

synckolab.tools.parseXml = function(content) {
	return new DOMParser().parseFromString(content, "application/xml");
}

synckolab.tools.logMessage = function(msg, level) {
	if (!level) {
		print("NO LEVEL GIVEN: " + synckolab.tools.trace());
	}
	var infolvl = synckolab.config.DEBUG_SYNCKOLAB_LEVEL%4;
	var infostate = synckolab.config.DEBUG_SYNCKOLAB_LEVEL - infolvl;
	var clvl = level%4;
	var cstate = level - clvl;

	// check if we are talking about the same loglevel: ERROR|WARN|INFO|DEBUG
	if (clvl > infolvl) {
		return;
	}
	
	if (clvl === synckolab.global.LOG_ERROR) {
		print("" + msg + "\nStack Trace: " + this.trace());
	}
	
	print(msg);
}