/*
 * Unit Test for SyncKolab Text Utils
 */
load("src/chrome/content/synckolab/tools/text.js");

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
	equal(synckolab.tools.text.fixNameToMiniCharset("hallo: Welt "), "hallo_Welt_", "test normal chars with colon")
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

test("synckolab.tools.text.string2DateTime", function() {
	// 2005-03-30T15:28:52Z or 2005-03-30 15:28:52 or: 20050303T152852Z
	equal(synckolab.tools.text.string2DateTime("2005-03-30T15:28:52Z", false, true).getTime(), 1112189332000, "datetime with - and T/Z (kolab2)");
	equal(synckolab.tools.text.string2DateTime("20050330T152852Z", false, true).getTime(), 1112189332000, "datetime with T/Z (kolab3)");
	equal(synckolab.tools.text.string2DateTime("2005-03-30T").getTime(), 1112133600000, "date with - (kolab2)");
	equal(synckolab.tools.text.string2DateTime("20050330T").getTime(), 1112133600000, "date (kolab3)");
	
	
	equal(synckolab.tools.text.string2DateTime("1980-01-22").getTime(), 317343600000, "date with - (kolab2)");
	equal(synckolab.tools.text.string2DateTime("1980-01-22").getMonth()+1, 1, "month with - (kolab2)");
	equal(synckolab.tools.text.string2DateTime("2005-03-30").getTime(), 1112133600000, "date with - (kolab2)");
	equal(synckolab.tools.text.string2DateTime("20050330").getTime(), 1112133600000, "date (kolab3)");
	equal(synckolab.tools.text.string2DateTime("2005").getTime(), 1104534000000, "only year");
});

test("synckolab.tools.text.calDateTime2String", function() {
	// 2005-03-30T15:28:52Z or 2005-03-30 15:28:52 or: 20050303T152852Z
	var cdate = new Date(1112196532000);
	equal(synckolab.tools.text.calDateTime2String(cdate, false, false), "2005-03-30T15:28:52Z", "datetime with - and T/Z (kolab2)");
	equal(synckolab.tools.text.calDateTime2String(cdate, false, true), "20050330T152852Z", "datetime with T/Z (kolab3)");
	equal(synckolab.tools.text.calDateTime2String(cdate, true, false), "2005-03-30", "date with - and T/Z (kolab2)");
	equal(synckolab.tools.text.calDateTime2String(cdate, true, true), "20050330", "date with T/Z (kolab3)");
});

test("synckolab.tools.text.getLongDateTime", function(){
	equal(synckolab.tools.text.getLongDateTime("20050330T152852Z"), "2005-03-30T15:28:52Z", "normalize datetime");
	equal(synckolab.tools.text.getLongDateTime("20050330"), "2005-03-30", "normalize date");
	equal(synckolab.tools.text.getLongDateTime("2005-03-30"), "2005-03-30", "normalize date");
	equal(synckolab.tools.text.getLongDateTime("20050330T152852ZEurope/Vienna"), "2005-03-30T15:28:52ZEurope/Vienna", "normalize datetime");
});

test("synckolab.tools.text.pad", function(){
	equal(synckolab.tools.text.pad(5, 2), "05", "single digit to two");
	equal(synckolab.tools.text.pad("5", 2), "05", "single character to two");
	equal(synckolab.tools.text.pad(15, 2), "15", "double digit");
	equal(synckolab.tools.text.pad(115, 2), "115", "triple digit");
	equal(synckolab.tools.text.pad(15, 4, 'X'), "XX15", "pad to four");
});


test("synckolab.tools.text.quoted.encode", function(){
	equal(synckolab.tools.text.quoted.encode("VCALENDAR"), "VCALENDAR", "sample quoted");
});