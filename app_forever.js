var	forever = require('forever-monitor');
var argv = process.argv;
var restarts = 0;
var date = Date.parse(new Date);;

var server = new (forever.Monitor)('app.js', {
	'silent': false
	, 'options': argv.splice(2, argv.length)
	, 'uid': 'spacebrew_webservices_server'
	, 'pid': './data/'
	, 'outFile': './data/log/webservice_server_log_' + date + '.log'
});

server.on('exit', function () {
	console.log('[Exit] the spacebrew webservices server will no longer be restarted');
});

server.on('restart', function () {
	restarts += 1;
	console.log('[Restart] the spacebrew webservices server has been restarted ' + restarts + ' time');
});

server.start();
