/*
 * Copyright 2008 Bizo, Inc (Donnie Flood [donnie@bizo.com])
 *  
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this 
 * file except in compliance with the License. You may obtain a copy of the License at 
 * 
 * http://www.apache.org/licenses/LICENSE-2.0 
 * 
 * Unless required by applicable law or agreed to in writing, software distributed under 
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF 
 * ANY KIND, either express or implied. See the License for the specific language governing 
 * permissions and limitations under the License.
 * 
 */

function Sdbizo() { 
  
  this.aws_access_key = '';
  this.aws_secret_key = '';
  this.show_delete_domain_button = false;
  
  var prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch );
  
  this.store_pref = function(pref_key, pref_object) {
    switch(typeof pref_object) {
      case 'string':
        prefs.setCharPref(pref_key, pref_object);
        break;
      case 'number':
        prefs.setIntPref(pref_key, pref_object);
        break;
      case 'boolean':
        prefs.setBoolPref(pref_key, pref_object);
        break;
    }
  }
  
  this.read_pref = function(pref_key, expected_type, default_value) {
    if(prefs.prefHasUserValue(pref_key) && prefs.getPrefType(pref_key) == expected_type) {
      switch(expected_type) {
        case prefs.PREF_STRING:
          return prefs.getCharPref(pref_key);
          break;
        case prefs.PREF_INT:
          return prefs.getIntPref(pref_key);
          break;
        case prefs.PREF_BOOL:
          return prefs.getBoolPref(pref_key);
          break;
      }
      return default_value
    }
  }
  
  this.savePrefs = function() {
    this.store_pref("sdbizo.aws_access_key", this.aws_access_key);
    this.store_pref("sdbizo.aws_secret_key", this.aws_secret_key);
    this.store_pref("sdbizo.show_delete_domain_button", this.show_delete_domain_button);
  }
  
  //init
  this.aws_access_key = this.read_pref("sdbizo.aws_access_key", prefs.PREF_STRING, '');
  this.aws_secret_key = this.read_pref("sdbizo.aws_secret_key", prefs.PREF_STRING, '');
  this.show_delete_domain_button = this.read_pref("sdbizo.show_delete_domain_button", prefs.PREF_BOOL, false);
  
}
 