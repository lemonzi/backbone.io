var fs = require('fs');
var path = require('path');
var socketio = require('socket.io');
var Backend = require('./backend');
var Sync = require('./sync');

exports.Backend = Backend;

exports.createBackend = function(methods) {
    return new Backend(methods);
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

var setupSync = exports.setup = function(io, backends, options) {
    options || (options = {});

    // Listen for backend syncs
    Object.keys(backends).forEach(function(backend) {

        io.of(backend).on('connection', function(socket) {
            var sync = new Sync(backend, socket, options);

            backend.methods.forEach(function(method) {
                socket.on(method, function(req, callback) {
                    req.method = method;
                    sync.handle(backends[backend], req, function(err, result) {
                        if (err || result) callback(err, result);
                    });
                });
            });

            socket.emit('init', options);

        });

        // Proxy events on the backend to the socket
        backend.methods.forEach(function(method) {
            var listener = function(data, channel) {
                if (channel)
                    io.of(backend).broadcast.to(channel)
                                  .emit(method, data);
                else
                    io.of(backend).emit(method, data);
            };
            backends[backend].on(method, listener);
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
