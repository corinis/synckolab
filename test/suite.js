/**
 * SyncKolab Test suite
 */
load("test/lib/qunit-1.10.0.js");
load("test/lib/env.rhino.1.2.js");

console = {
		log: function(msg) {
			print(msg);
		},
		error: function(msg) {
			print("ERROR: " + msg);
		}

}
var testRuns = {
		fail: 0,
		pass: 0,
		start: new Date().getTime()
};

QUnit.init();
QUnit.config.blocking = false;
QUnit.config.autorun = true;
QUnit.config.updateRate = 0;
QUnit.log(function(details) {
	if(details.result) {
		testRuns.pass++
	} else {
		testRuns.fail++
	}
	if(!details.result) {
		print(details.result ? 'PASS' : 'FAIL', (details.module?details.module+" ":"") + details.name + ":", details.message, details.result?"":(" expected '" + details.expected + "' was '" + details.actual + "'"));
	}
});

// run the tests
load("test/synckolab/tools/textTest.js");
load("test/synckolab/tools/toolsTest.js");

load("test/synckolab/parser/kolab2/calendarTest.js");
load("test/synckolab/parser/kolab2/contactTest.js");
load("test/synckolab/parser/kolab3/calendarTest.js");
load("test/synckolab/parser/kolab3/contactTest.js");

print("========================")
print("Tests Run: " + (testRuns.fail+testRuns.pass));
print("   Passed Tests: " + testRuns.pass);
print("   Failed Tests: " + testRuns.fail);
print("   Time run    : " + Math.round((new Date().getTime()-testRuns.start)/100)/10 + "s");
print("=======================")
if(testRuns.fail == 0) {
	print("OK")
} else {
	print(" !!!! ERRRORS detected !!!!");
	print("   Failed Tests: " + testRuns.fail);
	print(" !!!! ERRRORS detected !!!!");
}