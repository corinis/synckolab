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
 * Contributor(s): Niko Berger <niko.berger@corinis.com>
 *				 Andreas Gungl <a.gungl@gmx.de>
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

if(!com) var com={};
if(!com.synckolab) com.synckolab={};
if(!com.synckolab.tools) com.synckolab.tools={};

com.synckolab.tools.kolab={
	/**
	 * return the name of the week day like it is expected
	 * by the Kolab 2 XML format
	 *
	 * @param index The index of the day in the week starting with 1 => Sunday
	 * @return a string with the name of the week day
	 */
	getXmlDayName: function(index) {
		var name = "sunday";
		switch (index)
		{
			case 1:
				name = "sunday";
				break;
			case 2:
				name = "monday";
				break;
			case 3:
				name = "tuesday";
				break;
			case 4:
				name = "wednesday";
				break;
			case 5:
				name = "thursday";
				break;
			case 6:
				name = "friday";
				break;
			case 7:
				name = "saturday";
				break;
		}
		return name;
	},


	/**
	 * return the index for name of the week day used by the Kolab 2 XML format
	 *
	 * @param name a string with the name of the week day
	 * @return The index of the day in the week starting with 1 => Sunday
	 */
	getDayIndex: function (name)
	{
		var index = 1;
		switch (name.toLowerCase())
		{
			case "sunday":
				index = 1;
				break;
			case "monday":
				index = 2;
				break;
			case "tuesday":
				index = 3;
				break;
			case "wednesday":
				index = 4;
				break;
			case "thursday":
				index = 5;
				break;
			case "friday":
				index = 6;
				break;
			case "saturday":
				index = 7;
				break;
		}
		return index;
	}
};