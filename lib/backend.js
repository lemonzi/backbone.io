var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;

module.exports = Backend;

function Backend() {
    this.stack = [];
}

inherits(Backend, EventEmitter);

Backend.prototype.use = function() {
    var context = ['all'];
    var args = [].slice.call(arguments);

    var middleware = args.pop();
    if (args.length) {
        context = args;
    }

    this.stack.push({ context: context, middleware: middleware });
    return this;
};

Backend.prototype.handle = function(req, res, callback) {
    var self = this;
    var index = 0;

    var next = function(err) {
        var layer = self.stack[index++];

        // Reached the bottom of the middleware stack
        if (!layer) {
            if (err) return callback(err);

            // Don't respond by default
            return callback(null,null);
        }

        var layerIncludes = function(context) {
            return layer.context.indexOf(context) !== -1;
        };

        // Only call this layer's middleware if it applies for the
        // current context.
        if (layerIncludes(req.method) || layerIncludes('all')) {
            try {
                if (err) {
                    if (layer.middleware.length === 4) {
                        layer.middleware(err, req, res, next);
                    } else {
                        next(err);
                    }
                } else {
                    layer.middleware(req, res, next);
                }
            } catch (errr) {
                next(errr);
            }
        } else {
            next(err);
        }
    };

    next();
};