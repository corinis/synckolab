SyncKolab
=========

Important Note: SyncKolab relies on a lot of Thunderbird internals in order to work. This means that on every version upgrade of Thunderbird, there is quite a chance that it will break. 
Please use [bugzilla](http://bugzilla.mozdev.org/enter_bug.cgi?product=synckolab) to report such an issue (after checking if it hasn't been reported already). 

SyncKolab is a Thunderbird extension allowing to synchronize your contacts, calendar items and events using IMAP.

For more information please refer to [the main page](http://www.gargan.org/en/Mozilla_Extensions/SyncKolab/)

You can always checkout the current [nightly](http://www.gargan.org/extensions/synckolab-NIGHTLY.xpi) if you run into major problems (like having no configuration options available) - since they are most often fixed there.

Make sure to read http://www.gargan.org/en/Mozilla_Extensions/SyncKolab/FAQ/

Bugs
====

For Bugs please check out Mozdev Bugzilla:
* [New Bug](http://bugzilla.mozdev.org/enter_bug.cgi?product=synckolab)
* [All Bugs](http://bugzilla.mozdev.org/buglist.cgi?product=synckolab)
* [Open Bugs](http://bugzilla.mozdev.org/buglist.cgi?bug_status=UNCONFIRMED&bug_status=NEW&bug_status=ASSIGNED&bug_status=REOPENED&emailtype1=substring&emailassigned_to1=1&emailtype2=substring&emailreporter2=1&bugidtype=include&chfieldto=Now&product=synckolab&short_desc_type=allwordssubstr&long_desc_type=allwordssubstr&bug_file_loc_type=allwordssubstr&field0-0-0=noop&type0-0-0=noop&cmdtype=doit&order=Bug+Number)


Building
========

If you want to help out you can use [ant](https://ant.apache.org/) to build a packe once you checked out the code (just run 'ant' in the folder and it will create an xpi file).

You can also run all tests using 'ant test'
