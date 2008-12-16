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

/**
 * Amazon SimpleDB Javascript Library
 *  This won't work in a normal browser context because of security constraints.  
 *  However, it will work with Firefox plugins which is its intended use.  
 *
 * NOTE: 
 * Requires JQuery (tested with 1.2.6)
 * and related js code (sha1.js)
 * 
 */
function SDB(access_key, secret_key, version) {

  /****  PRIVATE VARIABLES ****/
  var aws_access_key = access_key;
  var aws_secret_key = secret_key;
  var sdb_base_url = "http://sdb.amazonaws.com";
  var sdb_version = isEmpty(version) ? "2007-11-07" : version;
  
  /****  PRIVATE FUNCTIONS ****/
  /**
   * Check if given value is null, undefined or lenth == 0
   */
  function isEmpty(check_me) {
    return (check_me == null || check_me == "undefined" || check_me.length == 0);
  }
  /**
   * Validation helper method.
   */
  function checkArgument(boolean_or_function, error_msg) {
    switch(typeof boolean_or_function) {
      case 'function': if(!boolean_or_function()) throw error_msg;break;
      case 'boolean':  if(!boolean_or_function)   throw error_msg;break;      
    }
  }
  /**
   * Build Compliant SDB Request URL including calculation of the Signature
   */
  function buildRequestUrl(action, params) {
    params["Action"]           = action;
    params["Timestamp"]        = AwsUtil.dateTimeFormat();
    params["AWSAccessKeyId"]   = aws_access_key;
    params["Version"]          = sdb_version;
    params["SignatureVersion"] = 1;
    params["Signature"]        = AwsUtil.generateSignature(params, aws_secret_key);    
    var encoded_params = [];
    for(var key in params) {
      encoded_params.push(key + "=" + encodeURIComponent(params[key]));
    }
    var req_url = sdb_base_url + "?" + encoded_params.join("&");
    return req_url;
  }
  
  /** 
   * Processes request metadata elements into the result
   */
  function parseMetadata(data, text_status) {
    var result = {meta:{req_id:$("RequestId", data).text(),box_usage:parseFloat($("BoxUsage", data).text())}};
    return result;
  }  
  
  /**
   * make ajax request and handle errors if present
   */
  function ajaxRequest(url, callback) {    
    var type = 'GET';
    var error_callback = callback; // default to callback
    if(arguments.length > 2) {
      for(var i = 2; i < arguments.length;i++) {
        if(typeof arguments[i] == 'string') type = arguments[i];
        else if(typeof arguments[i] == 'function') error_callback = arguments[i];
      }
    }
    // use jquery to make request
    $.ajax({type:type, url:url, 
      success:function(data, text_status) {
        callback(parseMetadata(data, text_status), data);
      },
      error:function(xhr, text_status, error) {     
        var result = parseMetadata(xhr.responseXML, text_status);              
        result.error = {msg:$("Message", xhr.responseXML).text(),code:$("Code", xhr.responseXML).text()}
        error_callback(result, xhr.responseXML); 
      },
      dataType:"xml" });
  }
  
  // SDB param validation
  checkArgument(!isEmpty(access_key), "Access Key Missing");
  checkArgument(!isEmpty(secret_key), "Secret Key Missing");
  
  /****  PUBLIC API FUNCTIONS ****/
    
  /**
   * ListDomains - Get SDB domains.
   * @param max_domains (optional) - integer between 1 and 100
   * @param next_token (optional) - string used for paging results
   * @return a JS Object with the following keys:
       * domains - domain names as an Array of Strings
       * next_token - the next_token string used for paging
       * meta - an JS Object with the following keys 
         * req_id - a unique id for the request as a string
         * box_usage - a number that show amount of system resources used in operation
   * @throws Exception if the request failed
   */ 
  this.listDomains = function() {
    var action = "ListDomains";
    var max_domains, next_token, callback = null;
    // handle param optionality (not really a word but neither is truthiness and look at Colbert!)
    for(var i = 0; i < arguments.length; i++) {
      var arg = arguments[i];
      switch(typeof arg) {
        case "string": next_token = arg;break;
        case "number": max_domains = arg;break;
        case "function": callback = arg;break;
      }
    }
    // validate params    
    var params = {};
    checkArgument(typeof callback == "function", action+" requires a callback");
    if(!isEmpty(max_domains)) { 
      params["MaxNumberOfDomains"] = max_domains;
      checkArgument(0 < params["MaxNumberOfDomains"] && params["MaxNumberOfDomains"] <= 100, "Max domains between 1 to 100");
    }
    if(!isEmpty(next_token)) params["NextToken"] = next_token;    

    ajaxRequest(buildRequestUrl(action, params), function(result, data) {
      if(result.error != null) callback(result);// just return the error
      var domains = [];
      $("DomainName", data).each(function(i) {
        domains.push($(this).text()) ;
      });
      result.domains = domains;
      result.next_token = $("NextToken", data).text();
      callback(result);
    });        
  }
  
  
  /**
   * Private - Encapsulate common functionality between CreateDomain and DeleteDomain
   */
  function domainLifecycleClosure(action, domain_name, callback) {
    // validate params
    checkArgument(!isEmpty(domain_name), action+" requires a domain_name");
    checkArgument(typeof callback == "function", action+" requires a callback");
    
    // use jquery to make request
    ajaxRequest(buildRequestUrl(action, {"DomainName":domain_name}), function(result, data) {
      callback(result);// no processing necessary      
    });       
  }
  
  /**
   * CreateDomain - Create a new Domain (has no effect if domain already exists - e.g. idempotent).
   * @param domain_name (required) - the name of the Domain to create
   * @return a JS Object with the following keys:
   *    * meta - an JS Object with the following keys 
   *      * req_id - a unique id for the request as a string
   *      * box_usage - a number that show amount of system resources used in operation
   * @throws Exception if the request failed
   */ 
  this.createDomain = function(domain_name, callback) {
    domainLifecycleClosure("CreateDomain", domain_name, callback);    
  }
  
  
  /**
   * DeleteDomain - Delete an existing Domain (has no effect if domain already deleted - e.g. idempotent).
   * @param domain_name (required) - the name of the Domain to delete
   * @return a JS Object with the following keys:
   *    * meta - an JS Object with the following keys 
   *      * req_id - a unique id for the request as a string
   *      * box_usage - a number that show amount of system resources used in operation
   * @throws Exception if the request failed
   */ 
  this.deleteDomain = function(domain_name, callback) {
    domainLifecycleClosure("DeleteDomain", domain_name, callback); 
  }
  
  /**
   * DomainMetadaa -Returns information about the domain, including when the domain was created, 
   * the number of items and attributes, and the size of attribute names and values.
   * @param domain_name (require) - the domain for which meta data is requested
   * @return a JS Object with the following keys:
   *    * timestamp - The date and time the metadata was last updated. 
   *    * item_count - The number of all items in the domain.
   *    * attribute_value_count - The number of all attribute name/value pairs in the domain.
   *    * attribute_name_count - The number of unique attribute names in the domain.
   *    * item_names_size_bytes - The total size of all item names in the domain, in bytes.
   *    * attribute_values_size_bytes - The total size of all attribute values, in bytes.
   *    * attribute_names_size_bytes - The total size of all unique attribute names, in bytes. 
   *    * meta - an JS Object with the following keys 
   *      * req_id - a unique id for the request as a string
   *      * box_usage - a number that show amount of system resources used in operation
   * @throws Exception if the request failed
   */
  this.domainMetadata = function(domain_name, callback) {
    var action = "DomainMetadata";
    // validate params
    checkArgument(!isEmpty(domain_name), action+" requires a domain_name");
    checkArgument(typeof callback == "function", action+" requires a callback");
        
    // use jquery to make request
    ajaxRequest(buildRequestUrl(action, {"DomainName":domain_name}), function(result, data) {    
      if(result.error != null) callback(result);// just return the error
      result.creation_date_time = $("CreationDateTime", data).text();
      result.item_count = parseInt($("ItemCount", data).text());
      result.item_names_size_bytes = parseInt($("ItemNamesSizeBytes", data).text());
      result.attribute_name_count = parseInt($("AttributeNameCount", data).text());
      result.attribute_names_size_bytes = parseInt($("AttributeNamesSizeBytes", data).text());
      result.attribute_value_count = parseInt($("AttributeValueCount", data).text());
      result.attribute_values_size_bytes = parseInt($("AttributeValuesSizeBytes", data).text());
      result.timestamp = $("Timestamp", data).text();      
      callback(result);
    });   
    
  }
  
  
  /**
   * PutAttributes - Creates or replaces attributes in an item in a domain, optionally replacing existing values.
   * @param domain_name (required) - the domain of the item to add attributes to
   * @param item_name (required) - the item to add the attributes to
   * @param attributes (required) - the attributes to add to the item -- this is an Array
   *   of JS Objects with the following format:
   *     *  {name:<string>, value:<string>, replace:<boolean>}
   * @return a JS Object with the following keys:
   *    * meta - an JS Object with the following keys 
   *      * req_id - a unique id for the request as a string
   *      * box_usage - a number that show amount of system resources used in operation
   * @throws Exception if the request failed
   */
  this.putAttributes = function(domain_name, item_name, attributes, callback) {
    var action = "PutAttributes";
    var params = {"DomainName":domain_name, "ItemName":item_name};
        
    // validate params (and build why we are at it)
    checkArgument(!isEmpty(domain_name), action+" requires a domain_name");
    checkArgument(!isEmpty(item_name), action+" requires a item_name");
    checkArgument(!isEmpty(attributes), action+" requires attributes");
    checkArgument(typeof callback == "function", action+" requires a callback");
    var attr_number = 1;
    for(var i = 0; i < attributes.length; i++) {
      var attr = attributes[i]
      checkArgument(typeof attr == 'object', action+" attributes["+i+"] appears to be invalid. Should be an object form of {name:'a', value:'b', replace:true}");
      checkArgument(typeof attr.name == 'string', action+" attributes["+i+"].name appears to be invalid. Should be a string.");
      checkArgument(typeof attr.values == 'object' , action+" attributes["+i+"].value appears to be invalid. Should be an array.");
      for(var j = 0; j < attr.values.length; j++) {
      params["Attribute."+attr_number+".Name"] = attr.name;      
      params["Attribute."+attr_number+".Value"] = attr.values[j];
      if(attr.replace) {
        checkArgument(typeof attr.replace == 'boolean', action+" attributes["+i+"].replace appears to be invalid. Should be a boolean.");
        params["Attribute."+attr_number+".Replace"] = attr.replace;
      }      
      attr_number++;
      }
    }
        
    // use jquery to make request
    ajaxRequest(buildRequestUrl(action, params), function(result, data) {    
      callback(result);      
    });           
  }
  
  
  /**
   * DeleteAttributes - Delete attributes of an item in a domain deleting the whole item if all attributes are deleted.
   * @param domain_name (required) - the domain of the item to delete attributes from
   * @param item_name (required) - the item to delete the attributes from
   * @param attributes (optional) - the attributes to delete to the item -- this is an Array
   *   of JS Objects with the following format:
   *     *  {name:<string>, value:<string>}
   * @return a JS Object with the following keys:
   *    * meta - an JS Object with the following keys 
   *      * req_id - a unique id for the request as a string
   *      * box_usage - a number that show amount of system resources used in operation
   * @throws Exception if the request failed
   */
  this.deleteAttributes = function(domain_name, item_name, attributes, callback) {
    var action = "DeleteAttributes";
    var params = {"DomainName":domain_name, "ItemName":item_name};
        
    // validate params (and build why we are at it)
    checkArgument(!isEmpty(domain_name), action+" requires a domain_name");
    checkArgument(!isEmpty(item_name), action+" requires a item_name");
    checkArgument(typeof callback == "function", action+" requires a callback");
    if(!isEmpty(attributes)) {
      for(var i = 0; i < attributes.length; i++) {        
        var attr = attributes[i];
        checkArgument(typeof attr == 'object', action+" attributes["+i+"] appears to be invalid. Should be an object form of {name:'a', value:'b'} (value is optional)");
        checkArgument(typeof attr.name == 'string', action+" attributes["+i+"].name appears to be invalid. Should be a string.");
        params["Attribute."+i+".Name"] = attr.name;
        if(!isEmpty(attr.value)) {
          checkArgument(typeof attr.value == 'string', action+" attributes["+i+"].value appears to be invalid. Should be a string.");               
          params["Attribute."+i+".Value"] = attr.value;              
        }
      }
    }
          
    // use jquery to make request
    ajaxRequest(buildRequestUrl(action, params), function(result, data) {    
      callback(result);
    });   
    
  }
  
  
  /**
   * GetAttributes - Returns all of the attributes associated with the item. Optionally, the attributes returned 
   *   can be limited to one or more specified attribute name parameters
   * @param domain_name (required) - the domain of the item to get attributes from
   * @param item_name (required) - the item to get the attributes from
   * @param attribute_names (optional) - the attribute_names to limit to the results
   * @return a JS Object with the following keys:
   *    * attributes - an Array of JS Objects with the fillowing keys
   *      * name - a String name of the attribute
   *      * values - an Array of Strings with the attribute values
   *    * meta - a JS Object with the following keys 
   *      * req_id - a unique id for the request as a string
   *      * box_usage - a number that show amount of system resources used in operation
   * @throws Exception if the request failed
   */
  this.getAttributes = function(domain_name, item_name, attribute_names, callback) {
    var action = "GetAttributes";
    var params = {"DomainName":domain_name, "ItemName":item_name};
        
    // validate params (and build why we are at it)
    checkArgument(!isEmpty(domain_name), action+" requires a domain_name");
    checkArgument(!isEmpty(item_name), action+" requires a item_name");
    checkArgument(typeof callback == "function", action+" requires a callback");
    if(!isEmpty(attribute_names)) {
      for(var i = 0; i < attribute_names.length; i++) {
        var attr_name = attribute_names[i]
        checkArgument(typeof attr_name == 'string', action+" attributes["+i+"] appears to be invalid. Should be a string.");      
        if(isEmpty(attr_name)) continue;
        params["AttributeName."+i] = attr_name;              
      }
    }
    // use jquery to make request
    ajaxRequest(buildRequestUrl(action, params), function(result, data) {    
      if(result.error != null) callback(result);// just return the error
      // parse attributes
      var attributes = {};
      $("Attribute", data).each(function(i) {
        var name = $("Name", $(this)).text();
        var value = $("Value", $(this)).text();
        if(attributes[name] == null) {
          attributes[name] = [];
        }
        attributes[name].push(value);
      });
      result.attributes = attributes;
      callback(result);
    });   
    
  }
  
  /**
   * Query - returns Set of Items that match the given query expression.
   * @param domain (required) - the name of the domain being queried
   * @param query_expr (required) - the expression used to query the domain
   * @param callback (required) - the function to pass the results to
   * @param max_items (optional) - integer limiting the number of items returned
   * @param next_token (optional) - string used to page through results
   * @param with_attributes (optional) - boolean specifying the results should include attributes
   * @param attribute_names (optional) - array of names of attributes to include -- passing this 
   *                                     automatically assumes with_attributes = true
   * @return a JS Object with the following keys:
   *    * items - a JS Object who's keys are the item names.
   *             if with_attributes is true the values of the items JS Object are also
   *              JS Objects with the following format:
   *        * name - a String name of the attribute
   *        * values - an Array of Strings with the attribute values
   *    * next_token - the next_token string used for paging
   *    * meta - an JS Object with the following keys 
   *      * req_id - a unique id for the request as a string
   *      * box_usage - a number that show amount of system resources used in operation
   * @throws Exception if the request failed
   */ 
  this.query = function(domain, query_expr, callback) {
    var action = "Query";
    var max_items, next_token, with_attributes, attribute_names = null;
    // handle param optionality (not really a word but neither is truthiness and look at Colbert!)
    for(var i = 3; i < arguments.length; i++) {
      var arg = arguments[i];
      switch(typeof arg) {
        case "string": next_token = arg;break;
        case "number": max_items = arg;break;
        case "boolean": with_attributes = arg;break;
        case "object": attribute_names = arg;break;
      }
    }    
    // validate params    
    var params = {};
    checkArgument(!isEmpty(domain), action+" requires a domain");
    params["DomainName"] = domain;
    checkArgument(typeof callback == "function", action+" requires a callback");
    if(!isEmpty(max_items)) { 
      params["MaxNumberOfItems"] = max_items+""; // need a string
      checkArgument(0 < params["MaxNumberOfItems"] && params["MaxNumberOfItems"] <= 250, "Max items between 1 to 250");
    }
    if(!isEmpty(next_token)) params["NextToken"] = next_token; 
    if(!isEmpty(query_expr)) params["QueryExpression"] = query_expr;                                      
    
    // check if query with attributes
    if((!isEmpty(with_attributes) && with_attributes) || (!isEmpty(attribute_names))) {
      action = "QueryWithAttributes";
      if(!isEmpty(attribute_names)) {
        for(var i = 0; i < attribute_names.length; i++) {
          params["AttributeName."+(i+1)] = attribute_names[i];
        }
      }
    }

    // use jquery to make request    
    ajaxRequest(buildRequestUrl(action, params), function(result, data) {    
      if(result.error != null) callback(result);// just return the error
      var items = [];
      if(action == "Query") {
        $("ItemName", data).each(function(i) {
          items.push({name:$(this).text()}) ;
        });
      } 
      // query with attrs
      else {
        $("Item", data).each(function(i) {
          var item = {attrs:{},name:$("Name:first", $(this)).text()};
          $("Attribute", $(this)).each(function(i) {
            var name = $("Name", $(this)).text();
            var val  = $("Value", $(this)).text();
            if(item.attrs[name] == null) {
              item.attrs[name] = [];
            }
            item.attrs[name].push(val);
          });
          items.push(item);
        });
      }
      result.items = items;
      result.next_token = $("NextToken", data).text();
      callback(result);
    });        
  }
  
}


/**
 * Collection of Methods for Signature Generation
 */
var AwsUtil = {
  dateTimeFormat : function(date) {
    if(date == null) date = new Date(); // assume now
    var yyyymmdd = [date.getUTCFullYear(), 
               this.pad(date.getUTCMonth()+1), // month index starts at 0
               this.pad(date.getUTCDate())].join('-');
    var hhmmss = [this.pad(date.getUTCHours()), this.pad(date.getUTCMinutes()), this.pad(date.getUTCSeconds())].join(':');
    return yyyymmdd+'T'+hhmmss+'.000Z';    
  },
  pad : function(to_pad, max_length, pad_with) {
    if(max_length == null) max_length = 2;
    if(pad_with == null)   pad_with = 0;
    var res = to_pad.toString();
    while(res.length < max_length) res = pad_with + res;
    return res;
  },
  sortLowerCase : function(s1, s2) {
    return (s1 == s2) ? 0 : (s1.toLowerCase() > s2.toLowerCase() ? 1 : -1);
  },
  generateSignature : function(params, aws_secret_key) {
    var to_sign = '';
    var param_keys = [];
    for(var key in params) param_keys.push(key); // get keys to sort by
    param_keys.sort(this.sortLowerCase);
    for(var i = 0; i < param_keys.length; i++) {
      var k = param_keys[i];
      var v = params[k];
      to_sign += k+v;
    }
    return b64_hmac_sha1(aws_secret_key, to_sign); // uses sha1.js
  }
}
