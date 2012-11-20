// load synckolab libraries

load("src/chrome/content/synckolab/tools.js");
load("src/chrome/content/synckolab/tools/sha1.js");
load("src/chrome/content/synckolab/tools/kolab.js");
load("src/chrome/content/synckolab/tools/text.js");

load("src/chrome/content/synckolab/calendarTools.js");

load("test/lib/testOverride.js");


test("kolab2 synckolab.calendarTest", function(){
	equal(null, synckolab.calendarTools.message2json(null), "parsing a null message");
	var testFiles = [{name:"event-recurr",task:false},{name:"task-alarm",task:true},{name:"task-due",task:true},{name:"task-progress",task:true},{name:"task-recurr",task:true}
	];
	
	var content, entry, jsonEntry;
	synckolab.config.DEBUG_SYNCKOLAB_LEVEL = synckolab.global.LOG_ALL + synckolab.global.LOG_DEBUG;
	
	for(var i = 0; i < testFiles.length; i++) {
		var src = testFiles[i];
		print("INFO: KOLAB 2 TESTING - EVENT: " + src.name +"\n");
		
		content = readFile("test/synckolab/parser/kolab2/raw/"+src.name + ".eml");
		
		content = synckolab.tools.parseMail(content);
		entry = synckolab.calendarTools.message2json(content, src.task);
		content = readFile("test/synckolab/parser/kolab2/json/"+src.name+".json");
		jsonEntry = JSON.parse(content);
		equal(synckolab.tools.equalsObject(entry, jsonEntry), true, "Json compare: " + src.name);
		
		// json -> kolab 2 xml
		content = synckolab.calendarTools.json2xml(entry, src.task);
		// if multipart
		if(content.content) {
			content = content.content;
		}
		
		xmlcontent = readFile("test/synckolab/parser/kolab2/xml/"+src.name + ".xml");
		if (xmlcontent.replace(/[\n\r\t ]/g, "").length !== content.replace(/[\n\r\t ]/g, "").length) {
			equal(xmlcontent.replace(/[\n\r\t ]/g, ""), content.replace(/[\n\r\t ]/g, ""), "XML differs" + src.name);
			var diff = diffString(xmlcontent, content);
			print("ERROR: DIFF FOUND:"+ xmlcontent.replace(/[\n\r\t ]/g, "").length + " vs. "+ content.replace(/[\n\r\t ]/g, "").length +"\n" + diff);
		} else {
			ok(src.name);
		}
		
	}
});	

/*
	var testFiles = [{name:"task-alarm", task:true}];
	
	
	var content, entry, jsonEntry;
	
	for(var i = 0; i < testFiles.length; i++) {
		var src = testFiles[i];
		
		content = readFile("test/synckolab/parser/kolab2/raw/"+src.name + ".eml");
		content = synckolab.tools.parseMail(content);
		print(content);
		print("==== STARTING PARSE")
		entry = synckolab.calendarTools.message2json(content, src.task);
		print("json entry: " + JSON.stringify(entry, null, '  '))
		// json -> kolab 2 xml
		content = synckolab.calendarTools.json2xml(entry, src.task);
		print(content);
		
		content = readFile("test/synckolab/parser/kolab2/json/"+src.name+".json");
		jsonEntry = JSON.parse(content);
//		equal(synckolab.tools.equalsObject(entry, jsonEntry), true, src);
	}
*/


