var fs = require('fs');
var path = require('path');
var socketio = require('socket.io');
var Backend = require('./backend');
var Sync = require('./sync');

exports.Backend = Backend;

exports.createBackend = function() {
    return new Backend();
};

exports.listen = function(server, backends, options) {
    // Configure default options
    options || (options = {});
    options.event || (options.event = 'backend');
    options.staticPath || (options.staticPath = '/backbone.io.js');

    var io = socketio.listen(server);

    // Serve client-side code
    io.static.add(options.staticPath, { file: __dirname + '/browser.js' });
    setupSync(io, backends, options);

    return io;
};

var setupSync = exports.setupSync = function(io, backends, options) {
    options || (options = {});

    // Listen for backend syncs
    Object.keys(backends).forEach(function(backend) {

        io.of(backend).on('connection', function(socket) {
            var sync = new Sync(backend, socket, options);
            socket.on('message', function(method, req, callback) {
                req.method = method;
                sync.handle(backends[backend], req, callback);
            });
        });

        // Proxy events on the backend to the socket
        var events = { 'created': 'create', 'updated': 'update', 'deleted': 'delete' };
        Object.keys(events).forEach(function(event) {
            var listener = function(model) {
                io.of(backend).emit('synced', events[event], model);
            };
            backends[backend].on(event, listener);
        });

    });

    return io;
};

exports.middleware = {};

fs.readdirSync(path.dirname(__dirname) + '/middleware')
  .forEach(function(filename) {
    var name = path.basename(filename, '.js');
    exports.middleware.__defineGetter__(name, function() {
        return require('../middleware/' + name);
    });
});
