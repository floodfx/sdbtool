/*
 * Copyright 2010 Bizo, Inc (Donnie Flood [donnie@bizo.com])
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

var ResultType = {
  ITEM:0,
  ATTR_KEY:1,
  ATTR_VAL:2
}

function Result(domain, name, children, isExpanded, isVisible) {
  this.index = -1;
  this.domain = domain;
  this.name = name;  
  this.children = children; 
  if(!children) this.children = []; // default to empty
  this.parent = null;  
  this.parent_index = -1;
  this.isExpanded = isExpanded;
  this.isVisible = isVisible;  
  for(var i = 0; i < this.children.length; i++) {
  	this.children[i].parent = this; // set parent reference
  	this.children[i].parent_index = i; // for next sibling
  }
  
  this.hasNextSibling = function() {
  	if(parent == null) return -1; // return number or bool
  	return (parent_index != parent.children.length - 1);
  }
  
  this.type = function() {
    if(this.parent == null) return ResultType.ITEM;
    if(this.children.length == 0) return ResultType.ATTR_VAL;
    return ResultType.ATTR_KEY;
  }
}

var nameSorter = function(a,b){if(a.name < b.name) return -1;if(a.name > b.name)return 1; return 0;}

var itemsToResults = function(domain, results) {
  var new_items = [];
  for(var i = 0; i < results.items.length; i++) {
  	new_items.push(itemToResult(domain, results.items[i]));
  }
  return new_items;
}

var itemToResult = function(domain, item) {
  var children = [];
  for(var attr_name in item.attrs) {
    var vals = item.attrs[attr_name];
    var val_results = [];
    for(var j = 0; j < vals.length; j++) {
      val_results.push(new Result(domain, vals[j]))
    }
    children.push(new Result(domain, attr_name, val_results))
  } 
  return new Result(domain, item.name, children, false, true);
}


var results_tree_view = {     
  visibleData : [],  

  treeBox: null,
  selection: null,

  get rowCount()                     { return this.visibleData.length; },
  setTree: function(treeBox)         { this.treeBox = treeBox; },
  getCellText: function(idx, column) { 
    if(this.visibleData[idx].type() == column.index) {
      this.visibleData[idx].index = idx;
      return this.visibleData[idx].name; 	
    }
    return '';
  },
  isContainer: function(idx)         { return this.visibleData[idx].type() != ResultType.ATTR_VAL; },
  isContainerOpen: function(idx)     { return this.visibleData[idx].isExpanded; },
  isContainerEmpty: function(idx)    { return false; },
  isSeparator: function(idx)         { return false; },
  isSorted: function()               { return false; },
  isEditable: function(idx, column)  { return false; },

  getParentIndex: function(idx) {
    if (this.visibleData[idx].type() == ResultType.ITEM) return -1;
    if (this.visibleData[idx].type() == ResultType.ATTR_KEY) {
      for (var t = idx - 1; t >= 0 ; t--) {
      	if(this.visibleData[idx].type() == ResultType.ITEM) return t;
  	  }      
    }
    if (this.visibleData[idx].type() == ResultType.ATTR_VAL) {
  	  for (var t = idx - 1; t >= 0 ; t--) {
  	  	if(this.visibleData[idx].type() == ResultType.ATTR_KEY) return t;
  	  }      
  	}
  },
  
  getLevel: function(idx) {
	  return this.visibleData[idx].type()
  },
  
  hasNextSibling: function(idx, after) {
  	var ns = this.visibleData[idx].hasNextSibling();
  	if(typeof ns == 'boolean') return ns;
  	//else must be ResultType.ITEM
  	var thislevel = this.getLevel(idx);
  	for (var t = idx + 1; t < this.visibleData.length; t++) {
      if (this.getLevel(t) == thislevel) return true;
    }
  	return false;	
  },
  
  toggleOpenState: function(idx) {
    var item = this.visibleData[idx];
    if (!this.isContainer(idx)) return;

    if (item.isExpanded) {
      item.isExpanded = false;

      var thisLevel = this.getLevel(idx);
      var deletecount = 0;
      for (var t = idx + 1; t < this.visibleData.length; t++) {
        if (this.getLevel(t) > thisLevel) {
          deletecount++;
        }
        else {
          break;
        }
      }
      if (deletecount) {
        for(var i = idx+1; i < idx + deletecount;i++) {
          this.visibleData[i].isExpanded = false;
        }
        this.visibleData.splice(idx + 1, deletecount);
        this.treeBox.rowCountChanged(idx + 1, -deletecount);
      }
    }
    else {
      // need to fetch item
      if(item.children.length == 0) {        
        var get_dn = item.domain;
        var get_it = null;
        var get_names = [];
        if(item.type() == ResultType.ITEM) {
          get_it = item.name;
        } else if(item.type() == ResultType.ATTR_KEY) {
          get_it = item.parent.name;
          get_names.push(item.name);
        }
        getAttributes(get_dn, get_it, get_names);        
      } else {      
        item.isExpanded = true;
  
        var label = item.name;
        var toinsert = item.children;
        for (var i = 0; i < toinsert.length; i++) {
          this.visibleData.splice(idx + i + 1, 0, toinsert[i]);
        }
        this.treeBox.rowCountChanged(idx + 1, toinsert.length);
      }
    }
  },
  
  expandAll: function() {
    var current_index = 0;
    while(current_index < this.visibleData.length) {
      var item = this.visibleData[current_index];
      if(!item.isExpanded) {
        this.toggleOpenState(current_index);
      }
      current_index++;
    }
  },

  getImageSrc: function(idx, column) {},
  getProgressMode : function(idx,column) {},
  getCellValue: function(idx, column) {},
  cycleHeader: function(col, elem) {},
  selectionChanged: function() {},
  cycleCell: function(idx, column) {},
  performAction: function(action) {},
  performActionOnCell: function(action, index, column) {},
  getRowProperties: function(idx, column, prop) {},
  getCellProperties: function(idx, column, prop) {},
  getColumnProperties: function(column, element, prop) {},
  
  // write entire tree
  setResults : function(results) {
    this.treeBox.rowCountChanged(0, -this.visibleData.length);    
    
    // sort item attributes / values
    for(var i = 0; i < results.length; i++) {
      var item = results[i];
      for(var j = 0; j < item.children.length; j++) {
        var attr = item.children[j];
        attr.children = attr.children.sort(nameSorter);
      }
      item.children = item.children.sort(nameSorter);
    }
    
    this.visibleData = results;
    this.treeBox.rowCountChanged(0, this.visibleData.length);      
  },
  
  findItemIndex : function(item_name, item_type) {
    var type = item_type == null ? ResultType.ITEM : item_type;
    var index = -1;
    for(var i = 0; i < this.visibleData.length; i++) {
      var vis_item = this.visibleData[i];
      if(vis_item.type() != type) continue;
      if(vis_item.name == item_name) {
        index = i;
        break;
      }
    }
    return index;
  },
  
  removeItem : function(item_name, type, index) {
    var item_index = index;
    if(index == -1 || index == 0) { // don't trust 0    
      item_index = this.findItemIndex(item_name, type);
      if(item_index == -1) return;
    }
    // close item at index then delete
    var cur_item = this.visibleData[item_index];      
    if(cur_item.isExpanded) this.toggleOpenState(item_index);          
   
    // delete
    this.visibleData.splice(item_index, 1);
    this.treeBox.rowCountChanged(item_index, -1);
  
    // delete parent references to this child
    if(cur_item.parent != null) {
      cur_item.parent.children.splice(cur_item.parent_index, 1);
      if(cur_item.parent.children.length == 0) {
       // recurse if the only child 
        this.removeItem(cur_item.parent, cur_item.parent.type(), index-1);       
      }
    }
  },
  
  // set specific item in tree -- don't change/delete others
  setItem : function(item, index) {
    var item_index = index;
    // expand clicked but row not selected
    if(index == -1 || index == 0) { // can't trust tree control...
      item_index = this.findItemIndex(item.name);
      if(item_index == -1) return;
    }    
    // close item at index then delete
    var cur_item = this.visibleData[item_index];
    if(cur_item.isExpanded) this.toggleOpenState(item_index);
    // sort item attributes
    for(var j = 0; j < item.children.length; j++) {
      var attr = item.children[j];
      attr.children = attr.children.sort(nameSorter);
    }
    item.children = item.children.sort(nameSorter);
    
    // overwrite
    this.treeBox.rowCountChanged(item_index, -1);
    this.visibleData[item_index] = item;     
    this.treeBox.rowCountChanged(item_index, 1);   
    // auto expand names
    this.toggleOpenState(item_index);
  },
  
  // insert item at the top
  addItem : function(item) {        
    
    // sort item attributes
    for(var j = 0; j < item.children.length; j++) {
      var attr = item.children[j];
      attr.children = attr.children.sort(nameSorter);
    }
    item.children = item.children.sort(nameSorter);
    
    this.visibleData.splice(0, 0, item);
    this.treeBox.rowCountChanged(0, 1);  
    
    // auto expand names
    this.toggleOpenState(0);
  }
    
};
