module.exports = function(options) {

    return function(req, res, next) {
        if (req.method == 'listen') {
            req.socket.join(req.channel);
        } else if (req.method !== 'read') {
            if (req.channel) {
                req.socket.broadcast.to(req.channel)
                      .emit('synced', req.method);
            } else if (options.broadcast) {
                req.socket.broadcast.emit('synced', req.method);
            }
        }
        next();
    };

};
