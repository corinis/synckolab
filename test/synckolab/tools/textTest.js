/*
 * Unit Test for SyncKolab Text Utils
 */

/**
 * Test on checkExist
 */
test("synckolab.tools.text.checkExist", function(){
	equal(synckolab.tools.text.checkExist(""), false, "empty does not exist");
	equal(synckolab.tools.text.checkExist(" "), false, "whitespace does not exist");
	equal(synckolab.tools.text.checkExist(null), false, "null does not exist");
	equal(synckolab.tools.text.checkExist("a"), true, "single char does exist");
	equal(synckolab.tools.text.checkExist(true), true, "true does exist");
	equal(synckolab.tools.text.checkExist(false), true, "false does exist");
	equal(synckolab.tools.text.checkExist(0), true, "0 does exist");
});

/**
 * Test on fixNameToMiniCharset (get rid of special chars)
 */
test("synckolab.tools.text.fixNameToMiniCharset", function() {
	equal(synckolab.tools.text.fixNameToMiniCharset("halloWelt"), "halloWelt", "test normal chars")
	equal(synckolab.tools.text.fixNameToMiniCharset("hallo Welt "), "hallo_Welt_", "test normal chars with space")
	equal(synckolab.tools.text.fixNameToMiniCharset("hallo     Welt "), "hallo_Welt_", "test normal chars with multi space")
	equal(synckolab.tools.text.fixNameToMiniCharset("häöüß!"), "haous_", "test german umlaut (lowercase)")
	equal(synckolab.tools.text.fixNameToMiniCharset("hÄÖÜ?"), "hAOU_", "test german umlaut (uppercase)")
	equal(synckolab.tools.text.fixNameToMiniCharset("hÁÀâ'   '"), "hAAa_", "test french accent on a")
});


test("synckolab.tools.text.utf8.decode", function() {
	equal(synckolab.tools.text.utf8.decode(synckolab.tools.text.quoted.decode("DTSTART;TZID=Europe/Berlin:20120711T200000")), "DTSTART;TZID=Europe/Berlin:20120711T200000", "utf8 check");
});

test("synckolab.tools.text.utf8.decode", function() {
	equal(synckolab.tools.text.quoted.decode(synckolab.tools.text.quoted.decode("DTSTART;TZID=3DEurope/Berlin:20120711T200000")), "DTSTART;TZID=Europe/Berlin:20120711T200000", "quoted test");
});