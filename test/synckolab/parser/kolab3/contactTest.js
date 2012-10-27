// load synckolab libraries

load("src/chrome/content/synckolab/tools.js");
load("src/chrome/content/synckolab/tools/sha1.js");
load("src/chrome/content/synckolab/tools/kolab.js");
load("src/chrome/content/synckolab/tools/text.js");

load("src/chrome/content/synckolab/addressbookTools.js");

load("test/lib/testOverride.js");


test("kolab3 synckolab.addressbookTools.parseMessageContent", function(){
	equal(null, synckolab.addressbookTools.parseMessageContent(null), "parsing a null message");
	var testFiles = ["contact.test3.mime", "contact.simple.mime","contact.complex.mime","contact.test.mime","contact.test2.mime", "list.test1.eml"];
	
	var content, entry, jsonEntry;
	
	for(var i = 0; i < testFiles.length; i++) {
		var src = testFiles[i];
		print("INFO: KOLAB 3 TESTING - CONTACT: " + src +"\n")
		content = readFile("test/synckolab/parser/kolab3/raw/"+src);
		content = synckolab.tools.parseMail(content);
		entry = synckolab.addressbookTools.parseMessageContent(content);
		content = readFile("test/synckolab/parser/kolab3/json/"+src+".json");
		jsonEntry = JSON.parse(content);
		equal(synckolab.tools.equalsObject(entry, jsonEntry), true, "Json object compare: " + src);
		
		// json -> kolab 3 xml
		if(entry.type === "maillist") {
			content = synckolab.addressbookTools.list2Kolab3(entry);
		} else {
			content = synckolab.addressbookTools.card2Kolab3(entry);
		}
		if(content.content) {
			content = content.content;
		}
		xmlcontent = readFile("test/synckolab/parser/kolab3/xml/"+src + ".xml");
		if (xmlcontent.replace(/[\n\r\t ]/g, "").length !== content.replace(/[\n\r\t ]/g, "").length) {
			equal(xmlcontent.replace(/[\n\r\t ]/g, ""), content.replace(/[\n\r\t ]/g, ""), src);
			var diff = diffString(xmlcontent, content);
			print("ERROR: DIFF FOUND:"+ xmlcontent.replace(/[\n\r\t ]/g, "").length + " vs. "+ content.replace(/[\n\r\t ]/g, "").length +"\n" + diff);
		}
	}
});	

/*
var testFiles = ["contact.complex.mime"];
for(var i = 0; i < testFiles.length; i++) {
	var src = testFiles[i];
	print("KOLAB 3 TESTING: " + src +"\n============")
	content = readFile("test/synckolab/parser/kolab3/raw/"+src);
	content = synckolab.tools.parseMail(content);
	entry = synckolab.addressbookTools.parseMessageContent(content);
	if(entry.isMailList) {
		print(entry.toSource());
	}
	content = readFile("test/synckolab/parser/kolab3/json/"+src+".json");
	jsonEntry = JSON.parse(content);
	
	// json -> kolab 3 xml
	if(entry.type === "maillist") {
		content = synckolab.addressbookTools.list2Kolab3(entry);
	} else {
		content = synckolab.addressbookTools.card2Kolab3(entry);
	}
	xmlcontent = readFile("test/synckolab/parser/kolab3/xml/"+src + ".xml");
	if (xmlcontent.replace(/[\n\r\t ]/g, "").length !== content.replace(/[\n\r\t ]/g, "").length) {
		equal(xmlcontent.replace(/[\n\r\t ]/g, ""), content.replace(/[\n\r\t ]/g, ""), src);
		var diff = diffString(xmlcontent, content);
		print("DIFF FOUND:"+ xmlcontent.replace(/[\n\r\t ]/g, "").length + " vs. "+ content.replace(/[\n\r\t ]/g, "").length +"\n" + diff);
	}
}

/*
	var testFiles = ["list.test1.eml"];
	
	
	var content, entry, jsonEntry;
	
	for(var i = 0; i < testFiles.length; i++) {
		var src = testFiles[i];
		
		content = readFile("test/synckolab/parser/kolab3/raw/"+src);
		content = synckolab.tools.parseMail(content);
		print(content);
		print("==== STARTING PARSE")
		entry = synckolab.addressbookTools.parseMessageContent(content);
		print(JSON.stringify(entry, null, '  '))
		// json -> kolab 3 xml
		if(entry.type === "maillist") {
			content = synckolab.addressbookTools.list2Kolab3(entry);
		} else {
			content = synckolab.addressbookTools.card2Kolab3(entry);
		}
		print("=== parsed XML");
		print(content);
		xmlcontent = readFile("test/synckolab/parser/kolab3/xml/"+src + ".xml");
		if (xmlcontent.replace(/[\n\r\t ]/g, "").length != content.replace(/[\n\r\t ]/g, "").length) {
			var diff = diffString(xmlcontent, content)
			print("DIFF FOUND:"+ xmlcontent.replace(/[\n\r\t ]/g, "").length + " vs. "+ content.replace(/[\n\r\t ]/g, "").length +"\n" + diff);
		}
	}


*/