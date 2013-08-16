module.exports = function(options) {

    options = options || {};

    var broadcast = function(req, res) {
        var method = req.method;
        var message = {
            id: req.id,
            channel: req.channel,
            backend: req.backend,
            entity: req.entity,
            model: req.model
        };
        if (req.broadcast || options.broadcast) {
            req.socket.broadcast.emit('msg', method, message);
        } else {
            var channel = req.channel || (req.entity + ':' + req.id);
            req.socket.broadcast.to(channel).emit('msg', method, message);
        }
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