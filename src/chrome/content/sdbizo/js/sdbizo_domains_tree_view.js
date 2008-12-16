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

// partial implementation of nsITreeView (https://developer.mozilla.org/en/NsITreeView)
var domains_tree_view = {     
  domains: [], 
  rowCount : function(){this.domains.length},  
  getCellText : function(row,column){  
    if(row  < this.domains.length) return this.domains[row];         
  },  
  setTree: function(treebox){ this.treebox = treebox; },  
  isContainer: function(row){ return false; },  
  isSeparator: function(row){ return false; },  
  isSorted: function(){ return false; },  
  getLevel: function(row){ return 0; },  
  getImageSrc: function(row,col){ return null; },  
  getRowProperties: function(row,props){},  
  getCellProperties: function(row,col,props){},  
  getColumnProperties: function(colid,col,props){},
  
  containsDomain: function(domain_name) {
    for(var i = 0; i < this.domains.length;i++) {
      if(this.domains[i] == domain_name)return true; 
    }
    return false;
  },
  // added to refresh view
  setDomains : function(new_domains) {
    this.treebox.rowCountChanged(0, -this.domains.length);
    this.domains = new_domains;
    this.treebox.rowCountChanged(0, this.domains.length);      
  },
  addDomain : function(new_domain) {
    this.domains.splice(0, 0, new_domain)        
    this.treebox.rowCountChanged(0, 1);      
  },
  removeDomain : function(index) {
    this.domains.splice(index, 1);
    this.treebox.rowCountChanged(index, 1);      
  }
};