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

var prompts = Components.classes["@mozilla.org/embedcomp/prompt-service;1"].getService(Components.interfaces.nsIPromptService);

// execute actions by name
var SdbizoController = {
  actions : {},
  // register actions
  addAction : function(action) {
    this.actions[action.action] = action;
  },
  // handle exceptions
  onException : function(action, ex) {
    handleException(action,ex);
  },
  // execute registered actions by name
  execute : function(action_name) {
    sdbizo_log('Executing action['+action_name+']');
    var action = this.actions[action_name];
    if(action == null) {this.onException('action', 'UnknownAction');return;}
    // execute the action
    try {
      action.execute();
    }catch(ex) {this.onException(action_name, ex);}
  }
}

var sdbizo_log = function(msg) {
  var sdb_log = $('#sdb_log');
  sdb_log.val("<"+msg+">\n"+sdb_log.val());
}

var sdbizo = new Sdbizo();
var sdb = null;      

var lock_ui = function() {
  $('.loader').attr('hidden', false);
  $('button').attr('disabled', true);
}

var unlock_ui = function() {
  $('.loader').attr('hidden', true);
  $('button').attr('disabled', false);
  // keep the same state for some buttons
  $('#sdb_pref_save_button').attr('disabled', saveButtonDisabled);
  $('#sdb_domains_delete_button').attr('disabled', $('#sdb_pref_show_domain_delete:checked').length == 0);
  $('#sdb_results_next_button').attr('disabled', query_next == null || query_next.length == 0);
}


var handleError = function(action, results) {  
  sdbizo_log('Error msg['+results.error.msg+'], code['+results.error.code+']  with action['+action+'].');
  $('#sdb_error_flash').attr('hidden', false);
  updateLogGrippy();
}
var handleException = function(action, ex) {
  sdbizo_log('Exception['+ex+'] with action['+action+'].');
  $('#sdb_error_flash').attr('hidden', false);
  updateLogGrippy();
}

var updateLogGrippy = function() {
  log_grippy_collapsed = document.getElementById("sdb_log_splitter").collapsed; // get collapsed state
  if(log_grippy_collapsed) {
    $('sdb_log_grippy').click(); // open log
  }
}

var log_grippy_collapsed = null;
var closeError = function() {
  $('#sdb_error_flash').attr('hidden', true);
  if(log_grippy_collapsed) {
    $('sdb_log_grippy').click();// recollapse log if was previously collapsed
  }
}


var ensureDomainSelected = function(cur_index, error_msg) {
  if(cur_index == -1) {prompts.alert(window, "Warning", error_msg);}
  return cur_index;
}


var domainSelected = function(element) {  
  var selection = document.getElementById('sdb_domain_tree').currentIndex;
  if(selection == -1) return;
  $('.domainList').val(domains_tree_view.domains[selection]);
}


var savePrefs = function() {
  sdbizo.aws_access_key = $('#sdb_pref_access_key').val();
  sdbizo.aws_secret_key = $('#sdb_pref_secret_key').val();
  sdbizo.show_delete_domain_button = $('#sdb_pref_show_domain_delete:checked').length == 1;
  sdb = new SDB(sdbizo.aws_access_key, sdbizo.aws_secret_key);
  sdbizo.savePrefs();
  $('#sdb_pref_save_button').attr('disabled', true);
  saveButtonDisabled = true;
}

var saveButtonDisabled = true;
var enableSaveButton = function() {
  $('#sdb_pref_save_button').attr('disabled', false);
  saveButtonDisabled = false;
}

var toggleDeleteButton = function() {
  enableSaveButton();
  $('#sdb_domains_delete_button').attr('disabled', $('#sdb_pref_show_domain_delete:checked').length != 1);
  $('#sdb_domains_contextmenu_delete').attr('disabled', $('#sdb_pref_show_domain_delete:checked').length != 1);
}


var sdbizoLoad = function() {
  window.sizeToContent();
  $('#sdb_pref_access_key').val(sdbizo.aws_access_key);
  $('#sdb_pref_secret_key').val(sdbizo.aws_secret_key);
  $('#sdb_pref_show_domain_delete').attr('checked', sdbizo.show_delete_domain_button);
  $('#sdb_domains_delete_button').attr('disabled', !sdbizo.show_delete_domain_button);
  $('#sdb_domains_contextmenu_delete').attr('disabled', !sdbizo.show_delete_domain_button);
  document.getElementById('sdb_domain_tree').view = domains_tree_view;
  document.getElementById('sdb_results_tree').view = results_tree_view;
  
  sdb = new SDB(sdbizo.aws_access_key, sdbizo.aws_secret_key);
  if(sdbizo.aws_access_key == '' || sdbizo.aws_secret_key == '') return;
  SdbizoController.execute('reloadDomains');
}
  
var bytes_to_gb = function(bytes) { if(typeof bytes == 'number') return bytes/1073741824; return 0.00;}  


// action prototype
function SdbizoAction(action, execute) {
  this.action       = action;
  this.execute      = execute;
}

var reloadDomains = new SdbizoAction('reloadDomains', function() {
  var action = this.action; 
  lock_ui();  
  sdb.listDomains(function(results) {   
    try {
      if(results.error) { handleError(action, results); return;}      
      $('.domainList').each(function(i){this.removeAllItems();}) // clear domains
      for(var i = 0; i < results.domains.length; i++) {
        var dn = results.domains[i];
        $('.domainList').each(function(i){this.appendItem(dn,dn);}) // add domain
      }
      domains_tree_view.setDomains(results.domains);  
    }
    catch(ex) {handleException(action, ex);}
    finally {
      unlock_ui();
    }
  });  
  
});


var createDomain = new SdbizoAction('createDomain', function() {
  var action = this.action; 
  // ensure domain not empty
  var domain = $('#sdb_create_domain_input').val();
  if(domain.length == 0) {
    prompts.alert(window, "Warning", "Please enter the name of the domain to create."); 
    return;
  }
  lock_ui();  
  sdb.createDomain(domain, function(results) {
    try {
      if(results.error) { handleError(this.action, results); return;}
      if(domains_tree_view.containsDomain(domain)) return; // only append if new
      $('.domainList').each(function(i){this.insertItemAt(0,domain,domain);}) // add domain
      domains_tree_view.addDomain(domain);                 
    } 
    catch(ex) {handleException(this.action, ex);}
    finally {
      unlock_ui();
      $('#sdb_create_domain_input').val(''); //clear textbox      
    }    
  });
});


var deleteDomain = function(domain_name) {
  lock_ui();
  var deleted_index = document.getElementById('sdb_domain_tree').currentIndex;
  sdb.deleteDomain(domain_name, function(results) {
    try {
      domains_tree_view.removeDomain(deleted_index);
      $('.domainList').each(function(i){this.removeItemAt(deleted_index);}) // remove domain
    }
    catch(ex) {handleException(this.action, ex);}
    finally {
      unlock_ui();
    }    
  });
}

var confirmDeleteDomain = new SdbizoAction('confirmDeleteDomain', function() {
  var action = this.action; 
  var cur_index = document.getElementById('sdb_domain_tree').currentIndex;
  var selection = ensureDomainSelected(cur_index, "Please select a domain first");
  if(selection < 0) return;
        
  var domain_name = domains_tree_view.domains[selection];  
  window.openDialog("chrome://sdbizo/content/dialog_delete_domain.xul","sdbizo_delete_domain", "chrome", domain_name, deleteDomain);      
});



var query_next = null;
var query_max  = null;
var query_expr = null;
var query_wa   = null;

var queryDomain = new SdbizoAction('queryDomain', function() {
  var action = this.action; 
  var cur_index = document.getElementById('sdb_query_domain').selectedIndex;
  var selection = ensureDomainSelected(cur_index, "Please select a domain first");
  if(selection < 0) return;
  
  var domain_name = document.getElementById('sdb_query_domain').selectedItem.value;      
  var expr = $('#sdb_query_domain_expression').val();
  var max_items = parseInt($('#sdb_query_domain_max_items').val());
  var with_attributes = $('#sdb_checkbox_query_with_attributes:checked').length == 1;   
  
  // reset next token
  if(expr != query_expr || max_items != query_max || with_attributes != query_wa) {
    query_next = null;
  }    
  query_expr = expr;
  query_max  = max_items;
  query_wa   = with_attributes;
  
  lock_ui();  
  sdb.query(domain_name, expr, function(results) {
    try {
      if(results.error) { handleError(this.action, results); return;}
      results_tree_view.setResults(itemsToResults(domain_name, results));
      query_next = results.next_token;
      $('#sdb_results_next_button').attr('disabled', query_next.length == 0);
    }
    catch(ex) {handleException(this.action, ex);}
    finally {
      unlock_ui();
    }  
  }, max_items, with_attributes, query_next);
  
});

var putAttributes = new SdbizoAction('putAttributes', function() {
  var action = this.action; 
  var cur_index = document.getElementById('sdb_put_attribute_domain').selectedIndex;
  var selection = ensureDomainSelected(cur_index, "Please select a domain first");
  if(selection < 0) return;
  
  var domain_name = document.getElementById('sdb_put_attribute_domain').selectedItem.value;    
  var item_name   = $('#sdb_results_put_attribute_item').val();
  var name        = $('#sdb_results_put_attribute_name').val();
  var values      = $('#sdb_results_put_attribute_values').val().split("\n");
  values = jQuery.grep(values, function(v){return (jQuery.trim(v) != "")});

  var replace     = $('#sdb_results_put_attribute_replace:checked').length == 1;      
  
  if(item_name.length == 0) {prompts.alert(window, "Warning", "Item name cannot be empty."); return;}
  if(name.length == 0) {prompts.alert(window, "Warning", "Attribute name cannot be empty."); return;}
  if(values.length == 0 || values[0].length == 0) {prompts.alert(window, "Warning", "Attribute value cannot be empty."); return;}
  
  lock_ui();
  sdb.putAttributes(domain_name, item_name, [{name:name,values:values,replace:replace}], function(results) {
    try {
      if(results.error) { handleError(this.action, results); return;}
      // merge new attrs with old attrs
      var attrs = {};
      attrs[name] = values;
      var item = {name:item_name,attrs:attrs}
      var pa_index = results_tree_view.findItemIndex(item_name, ResultType.ITEM);
      var pa_item = null;
      if(pa_index != -1) pa_item = results_tree_view.visibleData[pa_index];
      
      // merge new name, values with item if selected            
      if(pa_item != null && pa_item.name == item_name) { // might be new item
        for(var i = 0; i < pa_item.children.length; i++) {
          var child = pa_item.children[i];
          if(child.name != name) {
            item.attrs[child.name] = []; // reload              
          } else {continue;}
          for(var j = 0; j < child.children.length; j++) {
            var val = child.children[j];
            item.attrs[child.name].push(val.name);
          }
        }          
      }
      
      // merge into existing item or insert at top
      if(pa_index == -1) {
        results_tree_view.addItem(itemToResult(domain_name, item));
      } else {
        results_tree_view.setItem(itemToResult(domain_name, item), pa_index);
      }  
    }
    catch(ex) {handleException(this.action, ex);}
    finally {
      unlock_ui();
    }  
  });
});

var getAttributesPrompt = new SdbizoAction('getAttributesPrompt', function() {
  var action = this.action; 
  var cur_index = document.getElementById('sdb_query_domain').selectedIndex;
  var selection = ensureDomainSelected(cur_index, "Please select a domain first");
  if(selection < 0) return;
  
  var domain_name = document.getElementById('sdb_query_domain').selectedItem.value;    
  
  if(!selected_item) {prompts.alert(window, "Warning", "You must select an item."); return;} 
  
  var item_name   = selected_item.name;
  
  window.openDialog("chrome://sdbizo/content/dialog_get_attributes.xul", "sdbizo_get_attributes", "chrome", domain_name, item_name, getAttributes);
});

var getAttributes = function(domain_name, item_name, names) {     
  
  var ga_index = document.getElementById('sdb_results_tree').currentIndex;      
  lock_ui();
  sdb.getAttributes(domain_name, item_name, names, function(results) {
    try {
      if(results.error) { handleError(this.action, results); return;}
      var item = {attrs:results.attributes,name:item_name};
      results_tree_view.setItem(itemToResult(domain_name, item), ga_index);
    }
    catch(ex) {handleException(this.action, ex);}
    finally {
      unlock_ui();
    }  
  });  
}

var domainMetadata = {};
var loadDomainMetadata = new SdbizoAction('loadDomainMetadata', function() {
  var action = this.action; 
  var cur_index = document.getElementById('sdb_domain_metadata_domain').selectedIndex;
  var selection = ensureDomainSelected(cur_index, "Please select a domain first");
  if(selection < 0) return;
  
  var unit_label = function() {
    if($('#sdb_domain_metadata_show_bytes_in_gb:checked').length == 1) {
      return 'GB';
    }
    return 'bytes';
  }
  
  var unit_size = function(bytes) {
    if($('#sdb_domain_metadata_show_bytes_in_gb:checked').length == 1) {
      return bytes_to_gb(bytes);
    }
    return bytes;
  }
  
  var setDomainMetadata = function() {
    $('#sdb_domain_metadata_item_count').val(domainMetadata.item_count);
    $('#sdb_domain_metadata_item_names_size_bytes').val(unit_size(domainMetadata.item_names_size_bytes));
    $('#sdb_domain_metadata_item_names_size_bytes_units').val(unit_label());
    $('#sdb_domain_metadata_attribute_name_count').value = domainMetadata.attribute_name_count;
    $('#sdb_domain_metadata_attribute_names_size_bytes').val(unit_size(domainMetadata.attribute_names_size_bytes));
    $('#sdb_domain_metadata_attribute_names_size_bytes_units').val(unit_label());
    $('#sdb_domain_metadata_attribute_value_count').value = domainMetadata.attribute_value_count;
    $('#sdb_domain_metadata_attribute_values_size_bytes').val(unit_size(domainMetadata.attribute_values_size_bytes));
    $('#sdb_domain_metadata_attribute_values_size_bytes_units').val(unit_label());
    var date = new Date();
    date.setTime(domainMetadata.timestamp*1000); // add extra digits
    $('#sdb_domain_metadata_updated_at').val(date.toString());
  }
  
  if(arguments.length == 0 || !arguments[0] || domainMetadata.timestamp == null) {   
    var domain_name = document.getElementById('sdb_domain_metadata_domain').selectedItem.value;   
    lock_ui();
    sdb.domainMetadata(domain_name, function(results) {
      try {
        if(results.error) { handleError(this.action, results); return;}
        domainMetadata = results;          
        setDomainMetadata();
      }
      catch(ex) {handleException(this.action, ex);}
      finally {
        unlock_ui();
      }  
    });
  }
  else {
    setDomainMetadata();
  }      
  
});


var selected_item = null;
var selected_key = null;
var selected_val = null;

var itemSelected = function() {
        
  var selection = document.getElementById('sdb_results_tree').currentIndex;
  
  if(selection == -1) {
    selected_item = selected_key = selected_val = null;
    return;
  }
  
  var selected_result = this.results_tree_view.visibleData[selection];
  switch(selected_result.type()) {
  case ResultType.ITEM:
    selected_item = selected_result;
    selected_key = null;
    selected_val = null;
    $('#sdb_results_contextmenu_get_attributes,#sdb_results_contextmenu_delete_item').attr('hidden', false);
    $('#sdb_results_contextmenu_delete_attribute,#sdb_results_contextmenu_delete_attribute_value').attr('hidden', true);
    break;
  case ResultType.ATTR_KEY:
    selected_item = selected_result.parent;
    selected_key = selected_result;
    selected_val = null;
    $('#sdb_results_contextmenu_get_attributes,#sdb_results_contextmenu_delete_item,#sdb_results_contextmenu_delete_attribute').attr('hidden', false);
    $('#sdb_results_contextmenu_delete_attribute_value').attr('hidden', true);        
    break;
  case ResultType.ATTR_VAL:
    selected_item = selected_result.parent.parent;
    selected_key = selected_result.parent;
    selected_val = selected_result;
    $('#sdb_results_contextmenu_get_attributes,#sdb_results_contextmenu_delete_item,#sdb_results_contextmenu_delete_attribute,#sdb_results_contextmenu_delete_attribute_value').attr('hidden', false);        
    break;         
  }      
  
  // update add/replace control with selections
  var emptyOrName = function(selected_thing) {return selected_thing == null ? '' : selected_thing.name;}
  $('#sdb_results_put_attribute_item').val(emptyOrName(selected_item));
  $('#sdb_results_put_attribute_name').val(emptyOrName(selected_key));
  $('#sdb_results_put_attribute_values').val(emptyOrName(selected_val));
  $('#sdb_results_put_attribute_replace').attr('checked', false); // reset
  
}

var showAbout = new SdbizoAction('showAbout', function()  {
  window.openDialog("chrome://sdbizo/content/sdbizo_about.xul", "sdbizo_about", "chrome");
});

var deleteItemPrompt = new SdbizoAction('deleteItemPrompt', function()  {
  var action = this.action; 
  var cur_index = document.getElementById('sdb_query_domain').selectedIndex;
  var selection = ensureDomainSelected(cur_index, "Please select a domain first");
  if(selection < 0) return;
  
  var domain_name = document.getElementById('sdb_query_domain').selectedItem.value; 
  
  if(!selected_item) {prompts.alert(window, "Warning", "You must select an item."); return;} 
  
  var item_name   = selected_item.name;

  var ok_to_delete_item = prompts.confirm(window, "Confirm Item Deletion?", "Are you sure you want to delete this item?");
  if(!ok_to_delete_item) return;
  
  deleteAttributes(domain_name, item_name, []);
});

var deleteAttributePrompt = new SdbizoAction('deleteAttributePrompt', function()  {
  var action = this.action; 
  var cur_index = document.getElementById('sdb_query_domain').selectedIndex;
  var selection = ensureDomainSelected(cur_index, "Please select a domain first");
  if(selection < 0) return;
  
  var domain_name = document.getElementById('sdb_query_domain').selectedItem.value; 
  
  if(!selected_item) {prompts.alert(window, "Warning", "You must select an item."); return;} 
  
  var item_name   = selected_item.name;
  var attr_key   = selected_key.name;

  var ok_to_delete_attr = prompts.confirm(window, "Confirm Attribute Deletion?", "Are you sure you want to delete this attribute (and potentially the item)?");
  if(!ok_to_delete_attr) return;
  
  deleteAttributes(domain_name, item_name, [{name:attr_key}]);
});

var deleteAttributeValuePrompt = new SdbizoAction('deleteAttributeValuePrompt', function()  {
  var action = this.action; 
  var cur_index = document.getElementById('sdb_query_domain').selectedIndex;
  var selection = ensureDomainSelected(cur_index, "Please select a domain first");
  if(selection < 0) return;
  
  var domain_name = document.getElementById('sdb_query_domain').selectedItem.value; 
  
  if(!selected_item) {prompts.alert(window, "Warning", "You must select an item."); return;} 
  
  var item_name   = selected_item.name;
  var attr_key   = selected_key.name;
  var attr_val   = selected_val.name;

  var ok_to_delete_attr = prompts.confirm(window, "Confirm Attribute Deletion?", "Are you sure you want to delete this attribute value (and potentially the attribute and item)?");
  if(!ok_to_delete_attr) return;
  
  deleteAttributes(domain_name, item_name, [{name:attr_key, value:attr_val}]);
});

var deleteAttributes = function(domain_name, item_name, attributes) {
  var da_index = document.getElementById('sdb_results_tree').currentIndex;      
  
  lock_ui();
  sdb.deleteAttributes(domain_name, item_name, attributes, function(results) {
    try {
      if(results.error) { handleError(this.action, results); return;}
      var item_type = ResultType.ITEM;
      if(attributes.length > 0) {
        if(attributes[0].value) {
          item_type = ResultType.ATTR_VAL;
        } else if(attributes[0].name) {
          item_type = ResultType.ATTR_KEY;
        }
      }
      results_tree_view.removeItem(item_name, item_type, da_index);
    }
    catch(ex) {handleException(this.action, ex);}
    finally {
      unlock_ui();
    }  
  });  
}



// add actions to controller
SdbizoController.addAction(reloadDomains);
SdbizoController.addAction(loadDomainMetadata);
SdbizoController.addAction(queryDomain);
SdbizoController.addAction(confirmDeleteDomain);
SdbizoController.addAction(createDomain);
SdbizoController.addAction(getAttributesPrompt);
SdbizoController.addAction(deleteItemPrompt);
SdbizoController.addAction(deleteAttributePrompt);
SdbizoController.addAction(deleteAttributeValuePrompt);
SdbizoController.addAction(putAttributes);
SdbizoController.addAction(showAbout);
