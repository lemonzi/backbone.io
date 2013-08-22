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
    options.staticPath || (options.staticPath = '/backbone.io.js');

    // Create the socket.io engine
    var io = socketio.listen(server);
    if (options.static)
        io.static.add(options.staticPath, { file: __dirname + '/browser.js' });

    // Setup the backends
    setupSync(io, backends, options);

    return io;
};

var setupSync = exports.setup = function(io, backends, options) {
    options || (options = {});

    // Listen for backend syncs
    Object.keys(backends).forEach(function(name) {

        var backend = backends[name];
        backend.name = name;
        backend.send = function(meta, data, options) {
            options || (options = {});
            var sock = io.of(this.name);
            if (!options.broadcast) {
                if (options.channel)
                    sock = sock.in(options.channel);
                else
                    sock = sock.in(meta.entity+':'+meta.id);
            }
            if (options.volatile)
                sock = sock.volatile;
            sock.emit('msg', meta, data);
        };

        io.of(name).on('connection', function(socket) {
            // Pass messages through the middleware stack and answer back
            var sync = new Sync(name, socket, options);
            socket.on('msg', function(meta, data, callback) {
                meta.data = data;
                sync.handle(backend, meta, function(err, result) {
                    if (err) console.log(err);
                    if (err || result) callback(err, result);
                });
            });
            // Proxy the connection to the backend for external init/end routines
            backend.emit('connection', socket);
            socket.on('disconnect', backend.emit.bind(backend,socket));
        });

    });

    return io;
};

// Load built-in middleware from disk
exports.middleware = {};

fs.readdirSync(path.dirname(__dirname) + '/middleware')
  .forEach(function(filename) {
    var name = path.basename(filename, '.js');
    exports.middleware.__defineGetter__(name, function() {
        return require('../middleware/' + name);
    });
});
