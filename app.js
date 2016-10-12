var webApp = require('./server/webapp');
var NodePi = require('./index');
var Duinos = require('./duinos');
var Duino = require('./duino');
var Sockets = require('./sockets');
var UnixSocket = require('./unixSocket');
var url = require('url');
var net = require('net');

var app = webApp.createWebApp();
var settings = {
    port: 3000,
    hostname: '0.0.0.0'
};

var nodePi = new NodePi();
var sockets = new Sockets(app.server);
var duinos = new Duinos();

var path = '/tmp/responses';
var unixServer = new UnixSocket();
unixServer.listen(path, function (data) {
    var duino = parseDuino(data);
    duinos.heartbeat(duino);
    sockets.send('all', duino.action, duino);
});

function parseDuino(data) {
    var dataArray = [];
    for (var i = 0; i < data.length; i++) {
        dataArray.push(data[i]);
    }
    var id = dataArray[0];
    var action = dataArray[1];
    var type = dataArray[2];
    var extra = dataArray[3];

    var realType = duinos.getDuinoType(type);
    var realAction = duinos.getDuinoAction(action);
    var duino = new Duino(id, realType, realAction, extra);
    if (duino.id > 0 && duino.type != 'unknown') {
        // considered alive!
        duino.heartbeat = new Date();
    }

    return duino;
}

app.listen(settings.port, settings.hostname, () => {
    console.log(`Server running at http://${settings.hostname}:${settings.port}/`);
});

duinos.startListening();

var socketPath = '/tmp/hidden';
const client = net.connect(socketPath, () => {
    //'connect' listener
    console.log('connected to server!');
});

client.on('data', (data) => {
    console.log(data.toString());
});

client.on('end', () => {
    console.log('disconnected from server');
});

app.router.get('/hi', function (req, res) {
    res.end('you got hi!');
});

app.router.get('/duinos', function (req, res, next) {
    req.url = '/html/duinos.html';
    next();
});

app.router.get('/os', function (req, res, next) {
    req.url = '/html/os.html';
    next();
});

app.router.get('/net', function (req, res, next) {
    req.url = '/html/net.html';
    next();
});

app.router.get('/osInfo', function (req, res) {
    var promDate = nodePi.osInfo();
    res.end(JSON.stringify(promDate));
});

app.router.get('/networkInfo', function (req, res) {
    var networkInfo = nodePi.network();
    res.end(JSON.stringify(networkInfo));
});

app.router.post('/lightsOn', function (req, res) {
    var promise = duinos.lightsOn(req.body.id);
    promise.then(function (data) { }).catch(function (err) {
        console.log(`oops! ${err}`);
    });

    res.end();
});

app.router.post('/lightsOff', function (req, res) {
    var promise = duinos.lightsOff(req.body.id);
    promise.then(function (data) { }).catch(function (err) {
        console.log(`oops! ${err}`);
    });

    res.end();
});

app.router.get('/lightsState', function (req, res) {
    var parsed = url.parse(req.url, true);
    var promise = duinos.lightsState(parsed.query.id);
    promise.then(function (data) { }).catch(function (err) {
        console.log(`oops! ${err}`);
    });

    res.end();
});

app.router.get('/ping', function (req, res) {
    var parsed = url.parse(req.url, true);
    client.write(`${parsed.id}${1}`)
    // var promise = duinos.ping(parsed.query.id);
    // promise.then(function (data) { }).catch(function (err) {
    //     console.log(`oops! ${err}`);
    // });

    res.end();
});

app.router.get('/duinosState', function (req, res) {
    res.end(JSON.stringify(duinos.duinos));
});

app.router.post('/shutdown', function (req, res) {
    nodePi.halt();
    res.end('shutting down');
});

app.router.post('/reboot', function (req, res) {
    nodePi.reboot();
    res.end('rebooting');
});

sockets.stream(1000, 'all', 'uptime', function () {
    return nodePi.osInfo().uptime;
});