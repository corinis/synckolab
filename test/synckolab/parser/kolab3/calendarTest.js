// load synckolab libraries

load("src/chrome/content/synckolab/tools.js");
load("src/chrome/content/synckolab/tools/sha1.js");
load("src/chrome/content/synckolab/tools/kolab.js");
load("src/chrome/content/synckolab/tools/text.js");

load("src/chrome/content/synckolab/calendarTools.js");

load("test/lib/testOverride.js");

/*
test("kolab3 synckolab.addressbookTools.parseMessageContent", function(){
	equal(null, synckolab.addressbookTools.parseMessageContent(null), "parsing a null message");
	var testFiles = ["simple.vcf.mime","complex.vcf.mime"];
	
	var content, entry, jsonEntry;
	
	for(var i = 0; i < testFiles.length; i++) {
		var src = testFiles[i];
		
		content = readFile("test/synckolab/parser/kolab3/raw/"+src);
		content = synckolab.tools.stripMailHeader(content);
		entry = synckolab.addressbookTools.parseMessageContent(content);
		content = readFile("test/synckolab/parser/kolab3/json/"+src+".json");
		jsonEntry = JSON.parse(content);
		equal(synckolab.tools.equalsObject(entry, jsonEntry), true, src);
		
		// json -> kolab 3 xml
		
	}
});	
*/
	var testFiles = ["simple.ics.mime"];
	
	
	var content, entry, jsonEntry;
	
	for(var i = 0; i < testFiles.length; i++) {
		var src = testFiles[i];
		
		content = readFile("test/synckolab/parser/kolab3/raw/"+src);
		content = synckolab.tools.stripMailHeader(content);
		print(content);
		print("==== STARTING PARSE")
		entry = synckolab.calendarTools.message2json(content, false);
		print(JSON.stringify(entry, null, '  '))
		// json -> kolab 3 xml
		//content = synckolab.addressbookTools.card2Kolab3(entry);
		//print(content);
		/*
		content = readFile("test/synckolab/parser/kolab3/json/"+src+".json");
		jsonEntry = JSON.parse(content);
		equal(synckolab.tools.equalsObject(entry, jsonEntry), true, src);
		*/
	}



