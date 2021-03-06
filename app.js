var webApp = require('./server/webapp');
var NodePi = require('./index');
var Duinos = require('./duinos');
var Duino = require('./duino');
var Sockets = require('./sockets');
var UnixServer = require('./unixServer');
var UnixClient = require('./unixClient');
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
var unixServer = new UnixServer();
unixServer.listen(path, function (data) {
    var foundDuinos = parseDuinos(data);
    for (var i = 0; i < foundDuinos.length; i++) {
        var duino = foundDuinos[i];
        duinos.heartbeat(duino);
        sockets.send('all', duino.action, duino);
    }
    // duinos.heartbeat(duino);
    // sockets.send('all', duino.action, duino);
});

var clientPath = '/tmp/hidden';
var unixClient = new UnixClient();

app.listen(settings.port, settings.hostname, () => {
    console.log(`Server running at http://${settings.hostname}:${settings.port}/`);

    duinos.startListening();

    setTimeout(function () {
        unixClient.open(clientPath, function (client) {
            client.write('0000');
        });
    }, 2000);
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
    var msg = req.body.id + '5';
    unixClient.write(msg);
    res.end();
});

app.router.post('/lightsOff', function (req, res) {
    var msg = req.body.id + '6';
    unixClient.write(msg);
    res.end();
});

app.router.get('/lightsState', function (req, res) {
    var parsed = url.parse(req.url, true);
    var msg = parsed.query.id + '4';
    unixClient.write(msg);
    res.end();
});

app.router.get('/ping', function (req, res) {
    var parsed = url.parse(req.url, true);
    var msg = parsed.query.id + '1';
    unixClient.write(msg);
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

function parseDuinos(data) {
    var dataArray = [];
    for (var i = 0; i < data.length; i++) {
        dataArray.push(data[i]);
    }
    var parsedDuinos = [];
    var duinoLength = 4;
    var responses = dataArray.length / duinoLength;

    for (var i = 0; i < responses; i++) {
        var duino = readDuino(dataArray, i * duinoLength, duinoLength);
        parsedDuinos.push(duino);
    }
    return parsedDuinos;
}

function readDuino(data, index, length) {
    var id = data[index + 0];
    var action = data[index + 1];
    var type = data[index + 2];
    var extra = data[index + 3];

    var realType = duinos.getDuinoType(type);
    var realAction = duinos.getDuinoAction(action);
    var duino = new Duino(id, realType, realAction, extra);
    if (duino.id > 0 && duino.type != 'unknown') {
        // considered alive!
        duino.heartbeat = new Date();
    }

    return duino;
}