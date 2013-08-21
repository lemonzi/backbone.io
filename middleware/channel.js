module.exports = function(options) {

    options = options || {};

    var broadcast = function(req, res) {
        var message = {
            method: req.method,
            id: req.id,
            channel: req.channel,
            backend: req.backend,
            entity: req.entity,
        };
        var broad = req.socket.broadcast;
        if (! (req.broadcast || options.broadcast)) {
            var channel = req.channel || (req.entity + ':' + req.id);
            broad = broad.to(channel);
        }
        broad.emit('msg', message, req.data);
    };

    var apiHandlers = {
        join: function(req, res) {
            var channel = req.channel || (req.entity+':'+req.id);
            req.socket.join(channel);
        },
        leave: function(req, res) {
            var channel = req.channel || (req.entity+':'+req.id);
            req.socket.leave(channel);
        },
        create: function(req,res) {
            apiHandlers.join(req,res);
            broadcast(req,res);
        },
        update: function(req,res) {
            apiHandlers.join(req,res);
            broadcast(req,res);
        },
        destroy: function(req,res) {
            apiHandlers.leave(req,res);
            broadcast(req,res);
        },
        read: function(req,res) {
            apiHandlers.join(req,res);
        }
    };

    return function(req, res, next) {
        if (apiHandlers[req.method]) apiHandlers[req.method](req,res);
        next();
    };

};