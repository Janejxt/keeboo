/**
 * Class for uploading files using xhr
 * 
 * o:{ }
 * 
 */
UploadHandlerXhr = function(o) {
	this._files = [];
	this._xhrs = [];
	// current loaded size in bytes for each file
	this._loaded = [];
	this._options = {
	    onUpload : function(id, name, xhr) {
	    },
	    endpoint : "service/file.php",
	    onProgress : function(id, name, loaded, total) {
	    },
	    paramsStore : {
		    getParams : function() {
			    return {};
		    }
	    },
	    forceMultipart : false,
	    paramsInBody : false,
	    inputName : "uploadFileName",
	    customHeaders : [],
	    onAutoRetry : function(id, name, response, xhr) {
	    },
	    onComplete : function(id, name, response, xhr) {
	    }
	};
	$.extend(this._options, o);
	/**
	 * Adds file to the queue Returns id to use with upload, cancel
	 */
	this.add = function(file) {
		if (!(file instanceof File)) {
			throw new Error('Passed obj in not a File (in qq.UploadHandlerXhr)');
		}
		return this._files.push(file) - 1;
	};

	this.getName = function(id) {
		var file = this._files[id];
		// fix missing name in Safari 4
		//NOTE: fixed missing name firefox 11.0a2 file.fileName is actually undefined
		return (file.fileName !== null && file.fileName !== undefined) ? file.fileName : file.name;
	};

	this.getSize = function(id) {
		var file = this._files[id];
		return file.fileSize != null ? file.fileSize : file.size;
	};
	/**
	 * Returns uploaded bytes for file identified by id
	 */
	this.getLoaded = function(id) {
		return this._loaded[id] || 0;
	};
	this.isValid = function(id) {
		return this._files[id] !== undefined;
	};
	this.reset = function() {
		// qq.UploadHandlerAbstract.prototype.reset.apply(this, arguments);
		this._files = [];
		this._xhrs = [];
		this._loaded = [];
	};
	/**
	 * Sends the file identified by id to the server
	 */
	this._upload = function(id) {
		var file = this._files[id], name = this.getName(id), size = this.getSize(id), self = this;
		var url = this._options.endpoint, protocol = "POST", xhr, formData, paramName, key, params;

		this._options.onUpload(id, this.getName(id), true);

		this._loaded[id] = 0;

		xhr = this._xhrs[id] = new XMLHttpRequest();

		if (xhr.upload!=undefined) {
			xhr.upload.onprogress = function(e) {
				if (e.lengthComputable) {
					self._loaded[id] = e.loaded;
					self._options.onProgress(id, name, e.loaded, e.total);
				}
			};
		};
		xhr.onreadystatechange = function() {
			if (xhr.readyState === 4) {
				self._onComplete(id, xhr);
			}
		};

		params = {};//this._options.paramsStore.getParams(id);
		//build query string
		var url = this._options.endpoint;
		if (!this._options.paramsInBody) {
			params[this._options.inputName] = name;
			url = this.obj2url(params, this._options.endpoint);
		}
		//$.log.debug("Requesting url=" + url);
		xhr.open(protocol, url, true);
		xhr.setRequestHeader("X-Requested-With", "XMLHttpRequest");
		xhr.setRequestHeader("X-File-Name", encodeURIComponent(name));
		xhr.setRequestHeader("Cache-Control", "no-cache");

		if (this._options.forceMultipart || this._options.paramsInBody) {
			formData = new FormData();
			//if (this._options.paramsInBody) {
				// qq.obj2FormData(params, formData);
			//}
			formData.append(this._options.inputName, file);
			file = formData;
		} else {
			xhr.setRequestHeader("Content-Type", "application/octet-stream");
			xhr.setRequestHeader("X-Mime-Type", file.type);
		}
		if (this._options.customHeaders != undefined) {
			for (key in this._options.customHeaders) {
				if (this._options.customHeaders.hasOwnProperty(key)) {
					xhr.setRequestHeader(key, this._options.customHeaders[key]);
				}
			}
		}
		//$.log.debug('Sending upload request for ' + id);
		xhr.send(file);
	};

	this.obj2url = function(obj, temp, prefixDone) {
		"use strict";
		var i, len, uristrings = [], prefix = '&', add = function(nextObj, i) {
			var nextTemp = temp ? (/\[\]$/.test(temp)) // prevent double-encoding
			? temp : temp + '[' + i + ']' : i;
			if ((nextTemp !== 'undefined') && (i !== 'undefined')) {
				uristrings.push((typeof nextObj === 'object') ? qq.obj2url(nextObj, nextTemp, true)
				        : (Object.prototype.toString.call(nextObj) === '[object Function]') ? encodeURIComponent(nextTemp) + '='
				                + encodeURIComponent(nextObj()) : encodeURIComponent(nextTemp) + '=' + encodeURIComponent(nextObj));
			}
		};

		if (!prefixDone && temp) {
			prefix = (/\?/.test(temp)) ? (/\?$/.test(temp)) ? '' : '&' : '?';
			uristrings.push(temp);
			uristrings.push(this.obj2url(obj));
		} else if ((Object.prototype.toString.call(obj) === '[object Array]') && (typeof obj !== 'undefined')) {
			// we wont use a for-in-loop on an array (performance)
			for (i = -1, len = obj.length; i < len; i += 1) {
				add(obj[i], i);
			}
		} else if ((typeof obj !== 'undefined') && (obj !== null) && (typeof obj === "object")) {
			// for anything else but a scalar, we will use for-in-loop
			for (i in obj) {
				if (obj.hasOwnProperty(i)) {
					add(obj[i], i);
				}
			}
		} else {
			uristrings.push(encodeURIComponent(temp) + '=' + encodeURIComponent(obj));
		}

		if (temp) {
			return uristrings.join(prefix);
		} else {
			return uristrings.join(prefix).replace(/^&/, '').replace(/%20/g, '+');
		}
	};

	this._onComplete = function(id, xhr) {
		"use strict";
		// the request was aborted/cancelled
		if (!this._files[id]) {
			return;
		}

		var name = this.getName(id);
		var size = this.getSize(id);
		var response; //the parsed JSON response from the server, or the empty object if parsing failed.

		this._options.onProgress(id, name, size, size);

		//$.log.debug("xhr - server response:" + xhr.responseText);

		try {
			if (typeof JSON.parse === "function") {
				response = JSON.parse(xhr.responseText);
			} else {
				response = eval("(" + xhr.responseText + ")");
			}
		} catch (error) {
			//$.debugDlg(error + "<br><br>" + xhr.responseText);
			console.log(error + "<br><br>" + xhr.responseText);
			response = {};
		}

		if (xhr.status !== 200 || !response.success && this._onAutoRetry != undefined) {
			if (this._options.onAutoRetry(id, name, response, xhr)) {
				return;
			}
		}

		this._options.onComplete(id, name, response, xhr);

		this._xhrs[id] = null;
		//		this._dequeue(id);
	};

	this._cancel = function(id) {
		this._options.onCancel(id, this.getName(id));

		this._files[id] = null;

		if (this._xhrs[id]) {
			this._xhrs[id].abort();
			this._xhrs[id] = null;
		}
	};
};
