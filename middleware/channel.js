


if (req.method !== 'read') {
    if (channel) {
        socket.broadcast.to(channel)
              .emit('synced', req.method, result);
    } else {
        socket.broadcast.emit('synced', req.method, result);
    }
}


if (req.method == 'listen') {
    if (req.channel) {
        socket.set('channel', req.channel, function() {
            socket.join(channel);
        });
});
