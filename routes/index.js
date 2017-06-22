var express = require('express');
var fs = require('fs');
var router = express.Router();


router.get('/splash/update', function(req, res, next){
	fs.createReadStream('/datadisk/ftp/splash.jpg').pipe(fs.createWriteStream('/home/server/resources-server/public/splash/splash.jpg'));
	res.writeHead(200);
	res.end('Updated');
});

module.exports = router;
