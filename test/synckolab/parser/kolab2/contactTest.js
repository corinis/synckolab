// load synckolab libraries

load("src/chrome/content/synckolab/tools.js");
load("src/chrome/content/synckolab/tools/sha1.js");
load("src/chrome/content/synckolab/tools/kolab.js");
load("src/chrome/content/synckolab/tools/text.js");

load("src/chrome/content/synckolab/addressbookTools.js");

load("test/lib/testOverride.js");


test("skolab2 ynckolab.addressbookTools.parseMessageContent", function(){
	equal(null, synckolab.addressbookTools.parseMessageContent(null), "parsing a null message");
	
	var testFiles = ["test-image", "testcontact", "contactMinimalTest", "contactFullTest", "list.test", "list.test2"];
	var content, entry, jsonEntry;
	
	for(var i = 0; i < testFiles.length; i++) {
		var src = testFiles[i];
		print("INFO: KOLAB 2 TESTING CONTACT: " + src +"\n");
		
		content = readFile("test/synckolab/parser/kolab2/raw/"+src+".eml");
		content = synckolab.tools.parseMail(content);
		
		entry = synckolab.addressbookTools.parseMessageContent(content);
		
		content = readFile("test/synckolab/parser/kolab2/json/"+src+".json");
		jsonEntry = JSON.parse(content);
		equal(synckolab.tools.equalsObject(entry, jsonEntry, {UUID:true}), true, src + "\n" + JSON.stringify(entry, null, " "));
		// json -> kolab 2 xml
		/*
		if(entry.type === "maillist") {
			content = synckolab.addressbookTools.list2Xml(entry);
		} else {
			content = synckolab.addressbookTools.card2Xml(entry);
		}
		xmlcontent = readFile("test/synckolab/parser/kolab2/xml/"+src + ".xml");
		if (xmlcontent.replace(/[\n\r\t ]/g, "").length !== content.replace(/[\n\r\t ]/g, "").length) {
			equal(xmlcontent.replace(/[\n\r\t ]/g, ""), content.replace(/[\n\r\t ]/g, ""), src);
			var diff = diffString(xmlcontent, content);
			print("DIFF FOUND:"+ xmlcontent.replace(/[\n\r\t ]/g, "").length + " vs. "+ content.replace(/[\n\r\t ]/g, "").length +"\n" + diff);
		}
		*/

	}
	

});	

/*

var testFiles = ["contactMinimalTest"]; //, "contactMinimalTest", "contactFullTest", "list.test", "list.test2"];
var content, entry, jsonEntry;

for(var i = 0; i < testFiles.length; i++) {
	var src = testFiles[i];
	
	content = readFile("test/synckolab/parser/kolab2/raw/"+src+".eml");
	content = content.replace (/\#\$\#/g, "");
	print("CONTENT: " + content + "\n\n");
	content = synckolab.tools.parseMail(content);
	print(" PRSED CONTENT: " + content)
	entry = synckolab.addressbookTools.parseMessageContent(content);
	print(JSON.stringify(entry, null, " "));
	content = readFile("test/synckolab/parser/kolab2/json/"+src+".json");
	jsonEntry = JSON.parse(content);
}
//*/
