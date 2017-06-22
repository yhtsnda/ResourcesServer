var url = require('url');
var fs = require('fs');

function Transfer(dir){
	this.dir = dir;
	this.fileInfoCache = {};
	this.dataCache = {};
}

var p = Transfer.prototype;

p.clearCache = function(){
	this.fileInfoCache = {};
	this.dataCache = {};
}

p.transfer = function(req, res){
	var self = this;
	self.parseFileInfo(req).then(function(fileInfo){
		self.readFileData(fileInfo).then(function(buffer){
			var range = self.parseDataRange(req, fileInfo);
			console.log('transfer: range=', range);
			var size = range[1] - range[0];
			res.setHeader('Content-Range', 'bytes ' + range[0] + '-' + (range[1] - 1) + '/' + size);
			if(range[0] == 0 && range[1] == fileInfo.size) {
				res.writeHead(200, {
					"Content-Type": 'application/octet-stream',
					'Content-Length': size,
					'Content-Disposition': 'attachment; filename=' + encodeURIComponent(fileInfo.name)
				});
				res.end(buffer);
			} else {
				res.writeHead(206, 'Partial Content', {
					"Content-Type": 'application/octet-stream',
					'Content-Length': size,
					'Content-Disposition': 'attachment; filename=' + encodeURIComponent(fileInfo.name)
				});
				res.end(Buffer.from(buffer, range[0], size));
			}
		})
	}).catch(function(err){
		console.log('transfer error: ', err);
		res.writeHead(404);
		res.end();
	});
	
}

p.parseFileInfo = function(req){
	var self = this;
	return new Promise(function(resolve, reject){
		var fileInfo = self.fileInfoCache[req.url];
		if(fileInfo){
			resolve(fileInfo);
			return;	
		}
		var urlObj = url.parse(req.url);
		var filePath = self.dir + decodeURI(urlObj.pathname);
		var fileName = filePath.substring(filePath.lastIndexOf('/') + 1);
		fs.stat(filePath, function(err, stat){
			if(err){
				reject(err);
				return;
			}
			fileInfo = {};
			fileInfo.name = fileName;
			fileInfo.path = filePath;
			fileInfo.size = stat.size;
			self.fileInfoCache[req.url] = fileInfo;
			console.log("parseFileInfo: url=%s info=", req.url, fileInfo);
			resolve(fileInfo);
		});
	});
	
	
}

p.readFileData = function(fileInfo){
	var self = this;
	return new Promise(function(resolve, reject){
		var fileData = self.dataCache[fileInfo.path];
		if(fileData){
			console.log('readFileData: cache hit: path=%s', fileInfo.path);
			resolve(fileData);
			return;
		}
		console.log('readFileData: cache miss: path=%s', fileInfo.path);
		fs.readFile(fileInfo.path, function(err, buffer){
			if(err){
				reject(err);
				console.log('read file error: path=%s err=%o', fileInfo.path, err);
				return;
			}
			self.dataCache[fileInfo.path] = buffer;
			resolve(buffer);
		});
	});
}

p.parseDataRange = function(req, fileInfo){
	console.log('parseDataRange: ', req.headers.range);
	var range = req.headers.range;
	var s = 0;
	var e = fileInfo.size;
	if(typeof range != 'undefined') {
		var rangeMatch = range.match(/^bytes=([0-9]+)-([0-9]*)$/);
		if(rangeMatch && rangeMatch.length > 1){
			s = Number(rangeMatch[1]);
			if(rangeMatch.length > 2 && rangeMatch[2].length > 0){
				e = Number(rangeMatch[2]);
			}
		}
	}
	return [s, e];
}

module.exports = Transfer;
