module.exports = function(options) {

    return function(req, res, next) {
        if (req.method == 'listen') {
            req.socket.join(req.channel);
        } else if (req.method !== 'read') {
            if (req.channel) {
                req.socket.broadcast.to(req.channel)
                      .emit(res.method, res);
            } else if (options.broadcast) {
                req.socket.broadcast.emit(res.method, res);
            }
        }
        next();
    };

};






socket.on('join', function(channel) {
    socket.join(channel);
});
socket.on('leave', function(channel) {
    socket.leave(channel);
});
socket.on('sync', function(req, callback) {
    sync.handle(backends[backend], req, function(err, result) {
        callback(err, result);
        if (err) return;
        if (req.method !== 'read') {
            if (req.channel) {
                req.socket.broadcast.to(req.channel || req.model.id)
                          .emit(req.method, result);
            } else if (options.broadcast) {
                req.socket.broadcast.emit(req.method, result);
            }
        }
    });
});