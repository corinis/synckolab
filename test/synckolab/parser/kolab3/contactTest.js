// load synckolab libraries

load("src/chrome/content/synckolab/tools.js");
load("src/chrome/content/synckolab/tools/sha1.js");
load("src/chrome/content/synckolab/tools/kolab.js");
load("src/chrome/content/synckolab/tools/text.js");

load("src/chrome/content/synckolab/addressbookTools.js");

load("test/lib/testOverride.js");


test("synckolab.addressbookTools.parseMessageContent", function(){
	equal(null, synckolab.addressbookTools.parseMessageContent(null), "parsing a null message");
});	

	var testFiles = ["testcontact", "testContactMinimalFromXML"];
	
	
	var content, entry, jsonEntry;
	
	for(var i = 0; i < testFiles.length; i++) {
		var src = testFiles[i];
		
		content = readFile("test/synckolab/parser/kolab3/raw/"+src+".xml");
		entry = synckolab.addressbookTools.parseMessageContent(content);
		print(JSON.stringify(entry, null, '  '))
		content = readFile("test/synckolab/parser/kolab3/json/"+src+".json");
		jsonEntry = JSON.parse(content);
		equal(synckolab.tools.equalsObject(entry, jsonEntry), true, src);
	}



