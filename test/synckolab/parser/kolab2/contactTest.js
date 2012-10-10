// load synckolab libraries

load("src/chrome/content/synckolab/tools.js");
load("src/chrome/content/synckolab/tools/sha1.js");
load("src/chrome/content/synckolab/tools/kolab.js");
load("src/chrome/content/synckolab/tools/text.js");

load("src/chrome/content/synckolab/addressbookTools.js");

load("test/lib/testOverride.js");


test("skolab2 ynckolab.addressbookTools.parseMessageContent", function(){
	equal(null, synckolab.addressbookTools.parseMessageContent(null), "parsing a null message");
	var testFiles = ["contactMinimalTest", "contactFullTest", "list.test"];
	
	
	var content, entry, jsonEntry;
	
	for(var i = 0; i < testFiles.length; i++) {
		var src = testFiles[i];
		
		content = readFile("test/synckolab/parser/kolab2/raw/"+src+".xml");
		entry = synckolab.addressbookTools.parseMessageContent(content);
		content = readFile("test/synckolab/parser/kolab2/json/"+src+".json");
		jsonEntry = JSON.parse(content);
		equal(synckolab.tools.equalsObject(entry, jsonEntry), true, src + "\n" + JSON.stringify(entry, null, " "));
		
	}
	

});	



