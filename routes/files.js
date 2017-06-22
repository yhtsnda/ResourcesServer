var express = require('express');
var router = express.Router();
var path = require("path");
var url = require('url');
var fs = require('fs');
var exec = require('child_process').exec;
var util = require('util');
var redis = require('redis');

//const ROOT_DIR = 'E:\\YiBin\\git\\web\\resources-server'; 
const ROOT_DIR = '/datadisk/ftp';
const RES_DIR = '/datadisk/ftp/resources';
const RECOMMEND_DIR = '/datadisk/ftp/recommend'
const CONFIG_FILE_PATH = '/datadisk/ftp/config.json'
const CACHE_ENABLED = false;

var list = {};
var discoverySite = 'http://www.baidu.com';
var activitySite = 'http://www.qq.com';
var onlineUsers = 1123;
var cache = {};
var Transfer = require('./transfer')
var transfer = new Transfer('/datadisk/ftp')

var client = redis.createClient();

router.use('/transfer', function(req, res, next){
	console.log("router transfer: url=%s ", req.url);
	transfer.transfer(req, res);
});

router.use('/disk', function(req, res, next) {
	if(!CACHE_ENABLED){
		getFile(ROOT_DIR, req, res, next);
		return;
	}
	client.get(req.url, function(err, cachedFileData){
		if(err){
			console.log("Client get %s: ", req.url, err);	
		}
		var cachedFileInfo = cache[req.url];
		if(cachedFileData && cachedFileInfo){
			console.log("Cache hit: ", req.url);
			res.writeHead(200, {
				"Content-Type": 'application/octet-stream',
				'Content-Length': cachedFileInfo.size,
				'Content-Disposition': 'attachment; filename=' + cachedFileInfo.fileName
			});
			res.end(cachedFileData);
			return;
		}
		getFile(ROOT_DIR, req, res, next);
	});
});

router.use('/recommend', function(req, res, next) {
	getFile(ROOT_DIR, req, res, next);
});

function getFile(dir, req, res, next){
	// TODO 断点续传
	// TODO 内存缓存或者redius
	var urlObj = url.parse(req.url);
	var filePath = decodeURI(urlObj.pathname);
	var fileName = filePath.substring(filePath.lastIndexOf('/') + 1);
	console.log("File Read: url=%s path=%s name=%s", req.url, filePath, fileName);
    getFileContnet(dir + filePath, function(error, data){
    	if(error){
			res.writeHead(404);
			res.end();
			console.log("File read error: url=%s path=%s", req.url, filePath);
			console.log(error);
			return;
		}
		// TODO async
		var fileSize = fs.statSync(dir + filePath).size;
		var fileName = encodeURIComponent(fileName);
		res.writeHead(200, {
			"Content-Type": 'application/octet-stream',
			'Content-Length': fs.statSync(dir + filePath).size,
			'Content-Disposition': 'attachment; filename=' + encodeURIComponent(fileName)
		});
		if(CACHE_ENABLED){
			client.set(req.url, data);
			cache[req.url] = {
				size: fileSize,
				fileName: fileName
				//content: data,
			};
		}
		res.end(data);
    });
}

router.get('/api/v1/update', function(req, res, next){
	cache = {};
	client.flushall();
	updateFileList(RES_DIR);
	updateFileList(RECOMMEND_DIR);
	updateConfig();
	res.writeHead(200);
	res.end("Updated All");
});

router.get('/api/v1/update/resources', function(req, res, next){
	cache = {};
	client.flushall();
	updateFileList(RES_DIR);
	res.writeHead(200);
	res.end("Resources Updated");
});

router.get('/api/v1/update/recommend', function(req, res, next){
	cache = {};
	client.flushall();
	updateFileList(RES_DIR);
	updateFileList(RECOMMEND_DIR);
	updateConfig();
	res.writeHead(200);
	res.end("Recommend Updated");
});


router.get('/api/v1/update/config', function(req, res, next){
	updateConfig();
	res.writeHead(200);
	res.end("Config Updated");
});


router.get('/discovery', function(req, res, next){
	res.redirect(discoverySite);
});

router.get('/activity', function(req, res, next){
	res.redirect(activitySite);
});

router.get('/api/v1/stat/users', function(req, res, next){
	res.writeHead(200, {"Content-Type": "application/json"});
	res.end(JSON.stringify({
		"users": onlineUsers
	}));
});

router.get('/api/v1/resources', function(req, res, next){
 	res.setHeader('Content-Type', 'application/json');
    res.end(list[RES_DIR]);
});

router.get('/api/v1/recommend', function(req, res, next){
 	res.setHeader('Content-Type', 'application/json');
    res.end(list[RECOMMEND_DIR]);
});

function getFileContnet(path, callback){
	fs.readFile(path, callback);
}

function updateConfig(){
	fs.readFile(CONFIG_FILE_PATH, function(err, data){
		if(err){
			console.log("CONFIG_FILE_PATH error: path=%s", CONFIG_FILE_PATH);
			console.log(error);
			return;
		}
		try{
			var config = JSON.parse(data);
			console.log("updateConfig: ", config);
			discoverySite = config["发现"];
			activitySite = config["活动"];
			onlineUsers = config["在线人数"];
		}catch(e){
			onsole.log("Parse Json error: ", data);
			console.log(e);
			return;
		}
	});
}

function updateFileList(dir){
	fs.readdir(dir, function(err, files){
	    if(err){
	        console.log(err);
	        return;
	    }
		var len = files.length;
		var l = {};
		for(var i = 0; i < len; i++){
			var stat = fs.statSync(dir + "/" + files[i]);
			if(stat.isFile()){
				l[files[i]] = {
					size: stat.size,
					name: stat.name,
					mtime: stat.mtime
				};
				if(files[i].endsWith(".apk")){
					readApkIcon(l, dir, files[i]);
				}
			}
		}
	    list[dir] = JSON.stringify({"files": l});
	    console.log("Update " + dir + ": " + list[dir]);
	});
}

function readApkIcon(l, dir, name){
	console.log("Read apk: name=%s", name);
	var cmd = util.format("java -jar /home/server/android/ApkIconUtil.jar /home/server/android/aapt %s %s", 
			dir + "/" + name, dir + "/icons/" + name + ".png");
	(function(cmd){
		exec(cmd , function(error, stdout, stderr) {
		  if(error){
			  console.log("Error on exec cmd: " + cmd);
			  console.log(error);
		  }
		});
	})(cmd);
}

updateFileList(RES_DIR);
updateFileList(RECOMMEND_DIR);
updateConfig();

module.exports = router;
