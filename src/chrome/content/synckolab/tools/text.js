/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * Contributor(s):	Niko Berger <niko.berger@corinis.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

/**
 * Package: com.synckolab.tools.text
 * 
 * Text handling:
 * * fixToMiniCharset()
 * Text decoding/encoding: 
 * * base64.encode()/decode()
 * * utf8.encode()/decode()
 * * quoted.encode()/decode()
 * * URLDecode()
 */
"use strict";

if (!com)
	var com = {};
if (!com.synckolab)
	com.synckolab = {};
if (!com.synckolab.tools)
	com.synckolab.tools = {};

/**
 * Basic text stuff
 */
com.synckolab.tools.text = {
	nodeWithContent : function (nodeName, nodeValue, createNonExist) {
		if (!createNonExist && !this.checkExist(nodeValue)) {
			return "";
		}

		return "  <" + nodeName + ">" + (this.checkExist(nodeValue) ? this.encode4XML(nodeValue) : "") + "</" + nodeName + ">\n";
	},

	checkExist : function (value) {
		return value && value !== "";
	},

	trim : function (s) {
		return s.replace(/^\s+|\s+$/g, '');
	},

	/**
	 * remove possible problematic chars from a name
	 */
	fixNameToMiniCharset : function (name) {
		if(!name) {
			com.synckolab.global.consoleService.logStringMessage("undefined string " + new Error("s").stack);
		}
		var ret = "";
		// avoid double placeholders 
		var placeHolder = false;
		for ( var i = 0; i < name.length; i++) {
			switch (name.charAt(i)) {
			// character replaces... better this way
			case '\u00e4':
			case '\u00e1':
			case '\u00e0':
			case '\u00e2':
			case '\u00e3':
			case '\u00e5':
			case '\u00e6':
				placeHolder = false;
				ret += 'a';
				break;
			case '\u00c4':
			case '\u00c1':
			case '\u00c0':
			case '\u00c2':
			case '\u00c3':
			case '\u00c5':
			case '\u00c6':
				placeHolder = false;
				ret += 'A';
				break;
			case '\u00f6':
			case '\u00f3':
			case '\u00f2':
			case '\u00f4':
			case '\u00f5':
			case '\u00f8':
				placeHolder = false;
				ret += 'o';
				break;
			case '\u00d6':
			case '\u00d3':
			case '\u00d2':
			case '\u00d4':
			case '\u00d5':
			case '\u00D6':
				placeHolder = false;
				ret += 'O';
				break;
			case '\u00fc':
			case '\u00fa':
			case '\u00f9':
			case '\u00fb':
			case '\u0169':
			case '\u0171':
				placeHolder = false;
				ret += 'u';
				break;
			case '\u00dc':
			case '\u00da':
			case '\u00d9':
			case '\u00db':
			case '\u0168':
				placeHolder = false;
				ret += 'U';
				break;
			case '\u00c8':
			case '\u00c9':
			case '\u00ca':
			case '\u00cb':
				placeHolder = false;
				ret += 'E';
				break;
			case '\u00e8':
			case '\u00e9':
			case '\u00ea':
			case '\u00eb':
				placeHolder = false;
				ret += 'e';
				break;
			case '\u00ec':
			case '\u00ed':
			case '\u00ee':
			case '\u00ef':
				placeHolder = false;
				ret += 'i';
				break;
			case '\u00dd':
			case '\u00a5':
				placeHolder = false;
				ret += 'Y';
				break;
			case '\u00c7':
				placeHolder = false;
				ret += 'C';
				break;
			case '\u00e7':
				placeHolder = false;
				ret += 'c';
				break;
			case '\u00fd':
			case '\u00ff':
				placeHolder = false;
				ret += 'y';
				break;
			case '\u00df':
				placeHolder = false;
				ret += 's';
				break;
			case '\u00f1':
				placeHolder = false;
				ret += 'n';
				break;
			case '\u00b2':
				placeHolder = false;
				ret += '2';
				break;
			case '\u00b3':
				placeHolder = false;
				ret += '3';
				break;

			// chars which are no problem just stay
			case '_':
				// make sure to print it only once
				if(!placeHolder) {
					ret += name.charAt(i);
					placeHolder = true;
				}
				break;

			default:
				var c = name.charAt(i);
				if ((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9')) {
					placeHolder = false;
					ret += c;
				} else {
					if (!placeHolder) {
						ret += '_';
						placeHolder = true;
					}
				}
			}
		}
		return ret;
	},

	/**
	 *  ------ functions for date / string conversions ------------------------ 
	 */

	// takes: 2005-03-30T15:28:52Z or 2005-03-30 15:28:52
	string2DateTime : function (val) {
		// in case its a date without time
		if (val.indexOf(":") === -1) {
			return this.string2Date(val);
		}

		var s = val.replace('T', ' ');
		s = s.replace('Z', '');
		var both = s.split(' ');
		var cdate = both[0].split('-');
		var ctime = both[1].split(':');
		return new Date(cdate[0], cdate[1] - 1, cdate[2], ctime[0], ctime[1], ctime[2]);

	},

	// takes: 2005-03-30T15:28:52Z or 2005-03-30 15:28:52
	string2CalDateTime : function (val, useUTC) {
		// in case its a date without time fall back to string2CalDate()
		if (val.indexOf(":") === -1) {
			return this.string2CalDate(val);
		}

		var s = val.replace('T', ' ');
		s = s.replace('Z', '');
		var both = s.split(' ');
		var cdate = both[0].split('-');
		var ctime = both[1].split(':');
		var calDateTime = null;
		// lightning 0.9pre fix (uses createDateTime)
		if (typeof createDateTime !== 'undefined') {
			calDateTime = new createDateTime();
		} else if (typeof CalDateTime !== 'undefined') {
			calDateTime = new CalDateTime();
		} else {
			calDateTime = Components.classes["@mozilla.org/calendar/datetime;1"].createInstance(Components.interfaces.calIDateTime);
		}

		var jsDate = null;
		if (useUTC) {
			jsDate = new Date(Date.UTC(cdate[0], cdate[1] - 1, cdate[2], ctime[0], ctime[1], ctime[2]));
		} else {
			jsDate = new Date(cdate[0], cdate[1] - 1, cdate[2], ctime[0], ctime[1], ctime[2]);
		}
		calDateTime.jsDate = jsDate;
		return calDateTime;
	},

	// produces: 2005-03-30
	date2String : function (datetime, normal) {
		if (!datetime) {
			return '';
		}

		if (normal) {
			return datetime.getFullYear() + "-" + (datetime.getMonth() + 1 < 10 ? "0" : "") + (datetime.getMonth() + 1) + "-" + (datetime.getDate() < 10 ? "0" : "") + datetime.getDate();
		} else {
			return datetime.getUTCFullYear() + "-" + (datetime.getUTCMonth() + 1 < 10 ? "0" : "") + (datetime.getUTCMonth() + 1) + "-" + (datetime.getUTCDate() < 10 ? "0" : "") + datetime.getUTCDate();
		}
	},

	// produces 15:28:52
	time2String : function (datetime) {
		return (datetime.getUTCHours() < 10 ? "0" : "") + datetime.getUTCHours() + ":" + (datetime.getUTCMinutes() < 10 ? "0" : "") + datetime.getUTCMinutes() + ":" + (datetime.getUTCSeconds() < 10 ? "0" : "") + datetime.getUTCSeconds();
	},

	// produces: 2005-03-30T15:28:52Z for allday = false,
	// produces: 2005-03-30 for allday = true
	calDateTime2String : function (val, allday) {
		if (val === null) {
			return "";
		}

		var datetime = (val instanceof Date) ? val : val.jsDate;
		//alert("EVENT TIME: " + datetime);

		// make sure not to use UTC for all-day events
		var resultstring = this.date2String(datetime, allday);
		if (!allday) {
			resultstring += 'T';
			resultstring += this.time2String(datetime);
			resultstring += 'Z';
		}
		return resultstring;
	},

	// takes: 2005-03-30
	string2Date : function (val) {
		var s = val.replace('T', '');
		var cdate = s.split('-');
		return new Date(cdate[0], cdate[1] - 1, cdate[2]);
	},

	// takes: 2005-03-30
	string2CalDate : function (val) {
		var s = val.replace('T', '');
		var cdate = s.split('-');
		var calDateTime = null;

		// lightning 0.9pre fix (uses createDateTime)
		if (typeof createDateTime !== 'undefined') {
			calDateTime = new createDateTime();
		} else if (CalDateTime) {
			calDateTime = new CalDateTime();
		} else {
			calDateTime = Components.classes["@mozilla.org/calendar/datetime;1"].createInstance(Components.interfaces.calIDateTime);
		}

		calDateTime.jsDate = new Date(Date.UTC(cdate[0], cdate[1] - 1, cdate[2], 0, 0, 0));
		calDateTime.isDate = true;
		return calDateTime;
	},

	// Create a duration object for an alarm time
	createDuration : function (minutes) {
		var duration = Components.classes["@mozilla.org/calendar/duration;1"].createInstance(Components.interfaces.calIDuration);
		duration.inSeconds = minutes * 60;
		duration.normalize();
		if (minutes < 0) {
			duration.isNegative = true;
		}
		return duration;
	},

	getMonthString : function (month) {
		switch (month) {
		case 0:
			return "Jan";
		case 1:
			return "Feb";
		case 2:
			return "Mar";
		case 3:
			return "Apr";
		case 4:
			return "May";
		case 5:
			return "June";
		case 6:
			return "July";
		case 7:
			return "Aug";
		case 8:
			return "Sep";
		case 9:
			return "Oct";
		case 10:
			return "Nov";
		case 11:
			return "Dec";
		}
	},

	getDayString : function (day) {
		switch (day) {
		case 0:
			return "Sun";
		case 1:
			return "Mon";
		case 2:
			return "Tue";
		case 3:
			return "Wed";
		case 4:
			return "Thu";
		case 5:
			return "Fri";
		case 6:
			return "Sat";
		}
	},

	/**
	 * returns a 15 character hex id - random
	 */
	randomVcardId : function () {
		var hex = [];
		hex[0] = "0";
		hex[1] = "1";
		hex[2] = "2";
		hex[3] = "3";
		hex[4] = "4";
		hex[5] = "5";
		hex[5] = "6";
		hex[6] = "7";
		hex[7] = "8";
		hex[8] = "9";
		hex[9] = "A";
		hex[10] = "B";
		hex[11] = "C";
		hex[12] = "D";
		hex[13] = "E";
		hex[14] = "F";

		var cid = "";
		for (var i = 0; i < 16; i++) {
			cid = cid + hex[Math.round(Math.random() * 14)];
		}
		return cid;
	},

	/**
	 * takes care of newlines and amps
	 */
	encode4XML : function (s) {
		if (s === null) {
			return "";
		}
		
		if(!s) {
			com.synckolab.global.consoleService.logStringMessage("undefined string " + new Error("s").stack);
		}

		if (!s.replace) {
			return s;
		}

		s = s.replace(/(\r\n|\r)/g, '\n').replace(/&/g, "&amp;").replace(/</g, "&lt;");
		return s.replace(/>/g, "&gt;").replace(/\=/g, "&#61;");
	},

	decode4XML : function (s) {
		if (!s) {
			return "";
		}
		if (!s.replace) {
			return s;
		}
		// numeric replace
		var t = s.replace(/&#(\d+);/g, function (wholematch, parenmatch1) {
			return String.fromCharCode(+parenmatch1);
		});
		// same for hex
		t = t.replace(/&#x([0-9a-fA-F]+);/g, function (wholematch, parenmatch1) {
			return String.fromCharCode(parseInt(parenmatch1, 16));
		});

		// final
		return t.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
	},

	URLDecode : function (encoded) {
		// Replace + with ' '
		// Replace %xx with equivalent character
		// Put [ERROR] in output if %xx is invalid.
		var HEXCHARS = "0123456789ABCDEFabcdef";
		var plaintext = "";
		var i = 0;
		while (i < encoded.length) {
			var ch = encoded.charAt(i);
			if (ch === "+") {
				plaintext += " ";
				i++;
			} else if (ch === "%") {
				if (i < (encoded.length - 2) && HEXCHARS.indexOf(encoded.charAt(i + 1)) !== -1 && HEXCHARS.indexOf(encoded.charAt(i + 2)) !== -1) {
					plaintext += unescape(encoded.substr(i, 3));
					i += 3;
				} else {
					plaintext += "%[ERROR]";
					i++;
				}
			} else {
				plaintext += ch;
				i++;
			}
		} // while
		return plaintext;
	}
};

/**
 * UTF-8 en/decoder
 * Usage:
 *	result = com.synckolab.text.utf8.decode(String); / encode(String);
 */
com.synckolab.tools.text.utf8 = {
	decode : function (utftext) {
		var plaintext = "";
		var i = 0;
		var c, c1, c2, c3, c4;
		c = c1 = c2 = 0;

		while (i < utftext.length) {
			c = utftext.charCodeAt(i);
			if (c < 191) {
				plaintext += String.fromCharCode(c);
				i++;
			} else if (c < 224) {
				c2 = utftext.charCodeAt(i + 1);
				plaintext += String.fromCharCode(((c & 31) << 6) | (c2 & 63));
				i += 2;
			} else if (c < 240) {
				c2 = utftext.charCodeAt(i + 1);
				c3 = utftext.charCodeAt(i + 2);
				plaintext += String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
				i += 3;
			} else if (c < 248) {
				c2 = utftext.charCodeAt(i + 1);
				c3 = utftext.charCodeAt(i + 2);
				c4 = utftext.charCodeAt(i + 3);
				var codePoint = ((c & 7) << 18) | ((c2 & 63) << 12) | ((c3 & 63) << 6) | (c4 & 63);
				plaintext += String.fromCharCode(55296 | (codePoint >>> 10), 56320 | (codePoint & 1023));
				i += 4;
			}
		}
		return plaintext;
	},

	encode : function (str) {
		if (str === null) {
			return null;
		}
		var c, c2, i;
		// check for newline
		str = str.replace(/\r\n/g, "\n");
		var utftext = "";
		for ( var n = 0; n < str.length; n++) {
			// get the unicode
			c = str.charCodeAt(n);

			if (c >= 55296 && c < 57344) {
				// high or low surrogate
				var illegal = true;
				if (c < 56320) {
					// high surrogate
					if (i + 1 < str.length) {
						c2 = str.charCodeAt(i + 1);
						if (c2 >= 55296 && c2 < 57344) {
							// high or low surrogate
							++i;
							if (c2 >= 56320) {
								// low surrogate
								c = ((c & 1023) << 10) | (c2 & 1023);
								illegal = false;
							}
						}
					}
				}
				if (illegal) {
					c = 65533; // 0xFFFD "illegal character"
				}
			}

			// all chars from 0-127 => 1byte
			if (c < 128) {
				utftext += String.fromCharCode(c);
			}
			// all chars from 127 bis 2047 => 2byte
			else if (c < 2048) {
				utftext += String.fromCharCode((c >> 6) | 192);
				utftext += String.fromCharCode((c & 63) | 128);
			}
			// all chars from 2048 bis 66536 => 3byte
			else if (c < 65536) {
				utftext += String.fromCharCode((c >> 12) | 224);
				utftext += String.fromCharCode(((c >> 6) & 63) | 128);
				utftext += String.fromCharCode((c & 63) | 128);
			} else {
				utftext += String.fromCharCode((c >> 18) | 240);
				utftext += String.fromCharCode(((c >> 12) & 63) | 128);
				utftext += String.fromCharCode(((c >> 6) & 63) | 128);
				utftext += String.fromCharCode((c & 63) | 128);
			}
		}
		return utftext;
	}
};

/**
 * UTF-16 en/decoder
 * Usage:
 *	result = com.synckolab.text.utf16.decode(String); / encode(String);
 */
com.synckolab.tools.text.utf16 = {
	decode : function (str) {
		var out, i, len, c;
		var char2, char3;

		out = "";
		len = str.length;
		i = 0;
		while (i < len) {
			c = str.charCodeAt(i++);
			switch (c >> 4) {
			case 0:
			case 1:
			case 2:
			case 3:
			case 4:
			case 5:
			case 6:
			case 7:
				// 0xxxxxxx
				out += str.charAt(i - 1);
				break;
			case 12:
			case 13:
				// 110x xxxx   10xx xxxx
				char2 = str.charCodeAt(i++);
				out += String.fromCharCode(((c & 0x1F) << 6) | (char2 & 0x3F));
				break;
			case 14:
				// 1110 xxxx  10xx xxxx  10xx xxxx
				char2 = str.charCodeAt(i++);
				char3 = str.charCodeAt(i++);
				out += String.fromCharCode(((c & 0x0F) << 12) | ((char2 & 0x3F) << 6) | ((char3 & 0x3F) << 0));
				break;
			}
		}

		return out;

	},

	encode : function (str) {
		var out, i, len, c;
		out = "";
		len = str.length;
		for (i = 0; i < len; i++) {
			c = str.charCodeAt(i);
			if ((c >= 0x0001) && (c <= 0x007F)) {
				out += str.charAt(i);
			} else if (c > 0x07FF) {
				out += String.fromCharCode(0xE0 | ((c >> 12) & 0x0F));
				out += String.fromCharCode(0x80 | ((c >> 6) & 0x3F));
				out += String.fromCharCode(0x80 | ((c >> 0) & 0x3F));
			} else {
				out += String.fromCharCode(0xC0 | ((c >> 6) & 0x1F));
				out += String.fromCharCode(0x80 | ((c >> 0) & 0x3F));
			}
		}
		return out;
	}
};
/**
 * QuotedPrintable en/decoder
 * Usage:
 *	result = com.synckolab.text.quoted.decode(String); / encode(String);
 */
com.synckolab.tools.text.quoted = {

	encode : function (s) {
		var SKIP = 202;
		var NOSKIP = 'A';
		var QpEncodeMap = [SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, NOSKIP, SKIP, SKIP, NOSKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, NOSKIP, SKIP, SKIP, SKIP, SKIP, NOSKIP, NOSKIP, NOSKIP, NOSKIP,
				NOSKIP, NOSKIP, NOSKIP, NOSKIP, NOSKIP, NOSKIP, NOSKIP, NOSKIP, NOSKIP, NOSKIP, NOSKIP, NOSKIP, NOSKIP, NOSKIP, NOSKIP, NOSKIP, NOSKIP, NOSKIP, NOSKIP, SKIP, SKIP, NOSKIP, NOSKIP, SKIP, NOSKIP, NOSKIP, NOSKIP, NOSKIP, NOSKIP, NOSKIP, NOSKIP, NOSKIP, NOSKIP, NOSKIP, NOSKIP, NOSKIP,
				NOSKIP, NOSKIP, NOSKIP, NOSKIP, NOSKIP, NOSKIP, NOSKIP, NOSKIP, NOSKIP, NOSKIP, NOSKIP, NOSKIP, NOSKIP, NOSKIP, SKIP, SKIP, SKIP, SKIP, NOSKIP, SKIP, NOSKIP, NOSKIP, NOSKIP, NOSKIP, NOSKIP, NOSKIP, NOSKIP, NOSKIP, NOSKIP, NOSKIP, NOSKIP, NOSKIP, NOSKIP, NOSKIP, NOSKIP, NOSKIP,
				NOSKIP, NOSKIP, NOSKIP, NOSKIP, NOSKIP, NOSKIP, NOSKIP, NOSKIP, NOSKIP, NOSKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP,
				SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP,
				SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP, SKIP,
				SKIP, SKIP, SKIP, SKIP, SKIP];

		// sometime we just do not want a new message :)
		if (s === null) {
			return null;
		}

		var fresult = "";
		var cur = 0;

		for (cur = 0; cur < s.length; cur++) {
			var mid = s.charCodeAt(cur);
			if (QpEncodeMap[mid] === SKIP) {
				//add the hex value for the char...
				fresult += "=";
				fresult += mid.toString(16).toUpperCase();
			} else {
				//just add the char...
				fresult += s.charAt(cur);
			}
		}
		return fresult;
	},

	decode : function (s) {
		s = s.replace(/\=[\r\n]+/g, "");
		// very bad - double =3D3D
		s = s.replace("=3D3D", "=3D");

		// in order to avoid problematic decoding prepare the string
		// known problems might arise with:
		// TYPE=CELL
		// TYPE=FAX
		s = s.replace("TYPE=CELL", "TYPE=3DCELL");
		s = s.replace("TYPE=FAX", "TYPE=3DFAX");
		s = s.replace("=FALSE", "=3DFALSE");
		s = s.replace("=ACCEPTED", "=3DACCEPTED");

		return s.replace(/\=[0-9A-F]{2}/gi, function (v) {
			return String.fromCharCode(parseInt(v.substr(1), 16));
		});
	}
};

/**
 * Base 64 decoder
 * Usage:
 *	result = com.synckolab.text.base64.decode(String); / encode(String);
 */
com.synckolab.tools.text.base64 = {
	base64 : ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', '0', '1', '2',
			'3', '4', '5', '6', '7', '8', '9', '*', '/'],

	encode : function (string) {
		var binary = '';
		var result = '';
		var i, j, k;
		for (i = 0; i < string.length; i++) {
			binary += String("00000000" + string.charCodeAt(i).toString(2)).substring(string.charCodeAt(i).toString(2).length);
		}
		for (i = 0; i < binary.length; i += 6) {
			var number = 0;
			var counter = 0;
			for (j = 0; j < binary.substring(i, i + 6).length; j++) {
				for (k = 32; k >= 1; k -= (k / 2)) {
					if (binary.substring(i, i + 6).charAt(counter++) === "1") {
						number += k;
					}
				}
			}
			result += this.base64[number];
		}
		return result;
	},

	decode : function (string) {
		var binary = '';
		var result = '';
		var i, j, k;
		for (i = 0; i < string.length; i++) {
			for (j = 0; j < this.base64.length; j++) {
				if (string.charAt(i) === this.base64[j]) {
					binary += String("000000" + j.toString(2)).substring(j.toString(2).length);
				}
			}
		}
		for (i = 0; i < binary.length; i += 8) {
			var number = 0;
			var counter = 0;
			for (j = 0; j < binary.substring(i, i + 8).length; j++) {
				for (k = 128; k >= 1; k -= (k / 2)) {
					if (binary.substring(i, i + 8).charAt(counter++) === "1") {
						number += k;
					}
				}
			}
			result += String.fromCharCode(number);
		}
		return result;
	}
};
