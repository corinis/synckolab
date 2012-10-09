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


