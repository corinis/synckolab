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
		
		isTbird3: true,
		
		// string bundle use: strBundle.getString("KEYNAME") (init in synckolab.js)
		strBundle: {},
		
		consoleService: Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService),
		rdf: Components.classes["@mozilla.org/rdf/rdf-service;1"].getService(Components.interfaces.nsIRDFService),
		ios: Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService),
		folderDatasource: Components.classes["@mozilla.org/rdf/datasource;1?name=mailnewsfolders"].createInstance(Components.interfaces.nsIRDFDataSource),
		messageService: Components.classes["@mozilla.org/messenger/messageservice;1?type=imap"].getService(Components.interfaces.nsIMsgMessageService) 
	};
