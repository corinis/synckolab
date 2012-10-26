/*
 * Unit Test for SyncKolab Utils
 */
load("src/chrome/content/synckolab/tools.js");
load("src/chrome/content/synckolab/tools/text.js");

load("test/lib/testOverride.js");

/**
 * Test on Node
 */
test("synckolab.Node", function(){
	// prepare and read an xml
	var content = readFile("test/synckolab/tools/data/domtest.xml");
	var doc = synckolab.tools.parseXml(content);
	var root = new synckolab.Node(doc.firstChild);
	
	equal(root.nodeName, "root", "dom name");
	
	var child = root.getChildNode("child");
	equal(child.nodeName, "child", "dom name (child)");
	equal(child.getFirstData(), "1", "child 1");
	child = child.getNextNode();
	equal(child.nodeName, "child", "dom name (child)");
	equal(child.getFirstData(), "2", "child 2");
	
});


/**
 * Test uuencoded message
 */
test("synckolab.tools.uudecode", function(){
	var message = readFile("test/synckolab/tools/data/uutest1.eml");
	message = synckolab.tools.stripMailHeader(message);
	equal(message.content.replace(/[\r\n]+/g, " "), ("BEGIN:VCARD " +
"VERSION:3.0 " +
"PRODID:-//kerio.com/Contacts//NONSGML v1.0//EN " +
"ADR;TYPE=HOME:;;Street 1\\nStreet 2;City;;zipcode;France " +
"EMAIL;TYPE=PREF:mail@mail.com " +
"TEL;TYPE=VOICE,HOME:+33 (0) 3 12 34 56 78 " +
"TEL;TYPE=CELL:+33 (0) 6 12 34 56 78 " +
"ORG:Company; " +
"NOTE:Notes with accent éèêà " +
"X-FILE-AS:Last Name, First Name\n" +
"N:Last Name;First Name;;;\n" +
"FN:First Name Last Name\n" +
"URL;TYPE=WORK:website.com\n" +
"BDAY;VALUE=DATE:20121010\n" +
"UID:bfcaf3d0-4c85-4c5c-94e2-ca5f9ea1d264\n" +
"END:VCARD").replace(/\n/g, " "), "uuencoded vcard");
});

/**
 * Test encoded message
 */
test("synckolab.tools.quoteddecode", function(){
	var message = readFile("test/synckolab/tools/data/quotedtest1.eml");
	message = synckolab.tools.stripMailHeader(message);
	equal(message.content.replace(/[ \r\n]+/g, ""), ("BEGIN:VCALENDAR" + 
"PRODID:-//Mozilla.org/NONSGML Mozilla Calendar V1.1//EN " + 
"VERSION:2.0 " + 
"BEGIN:VEVENT " + 
"CREATED:20121026T122145Z " + 
"LAST-MODIFIED:20121026T122205Z " + 
"DTSTAMP:20121026T122205Z " + 
"UID:19a700e7-c207-4e7c-a212-6831dbfbb0fc " + 
"SUMMARY:test " + 
"DTSTART;TZID=Europe/Rome:20121027T140000 " + 
"DTEND;TZID=Europe/Rome:20121027T150000 " + 
"END:VEVENT " + 
"END:VCALENDAR").replace(/[ \n]/g, ""), "quoted encoded vcard");
});

/*
var content = readFile("test/synckolab/tools/data/uutest1.eml");
print(synckolab.tools.stripMailHeader(content));
*/