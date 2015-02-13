(function() {
    var connected = new Promise();

    Backbone.io = Backbone.IO = {
        connect: function() {
            var socket = io.connect.apply(io, arguments);
            connected.resolve(socket);
            return socket;
        }
    };

    var origSync = Backbone.sync;

    Backbone.sync = function(method, model, options) {
        var self = this;
        var backend = model.backend ||
                      (model.collection && model.collection.backend) ||
                      this.backend;

        options = _.clone(options) || {};

        var error = options.error || function() {};
        var success = options.success || function() {};

        if (backend) {
            // Don't pass these to server
            delete options.error;
            delete options.success;
            delete options.collection;

            // Use Socket.IO backend
            backend.ready(function() {
                var idAttribute = model.constructor.prototype.idAttribute;
                var req = _.extend(options, {
                    method: method,
                    id: model[idAttribute],
                    entity: model.entity ||
                            (model.collection && model.collection.entity) ||
                            self.entity,
                    timestamp: new Date().getTime()
                });

                var data;
                if (method == 'create') {
                    data = model.toJSON();
                    delete data[idAttribute];
                }
                else if (method == 'update') {
                    data = model.changedAttributes();
                    delete data[idAttribute];
                    if (_.isEmpty(data)) return;
                }

                backend.socket.emit('msg', req, data, function(err, resp) {
                    if (err) error(err);
                    else success(parse(resp));
                });
            });
        } else {
            // Call the original Backbone.sync
            return origSync(method, model, options);
        }
    };

    var safeAdd = Backbone.Collection.prototype.add,
        safeSet = Backbone.Model.prototype.set,
        safeRemove = Backbone.Collection.prototype.remove;

    var Mixins = {
        // Listen for backend notifications and update the
        // collection models accordingly.
        bindBackend: function() {
            var self = this;
            var idAttribute = this.model.prototype.idAttribute;

            this.backend.ready(function() {
                var event = self.backend.options.event;
                self.bind(event, function(meta, data) {
                    if (!meta.raw) data = parse(data);
                    var item = self.get(meta.id);
                    if (meta.method == 'create') {
                        var model = new Backbone.Model(data);
                        safeAdd.call(self,model);
                    } else if (meta.method == 'update') {
                        if (item) safeSet.call(item, data);
                    } else if (meta.method == 'delete') {
                        safeRemove.call(self,meta.id);
                    } else {
                        if (item) item.trigger(event+':'+meta.method, meta, data);
                    }
                });
            });
            return this;
        },
        autoSync: function() {
            var self = this;
            var idAttribute = this.model.prototype.idAttribute;
            this.add = function(models, options) {
                if (safeAdd.apply(self,arguments)) {
                    options || (options = {});
                    if(!_.isArray(models))
                        models = [models];
                    _.each(models,function(model) {
                        options.success = syncSet.bind(model);
                        var item = self.get(model[idAttribute]);
                        if (!item) return;
                        Backbone.sync('create',item,options);
                        item.set = syncSet;
                        item.save = function() {};
                    });
                }
            };
            this.remove = function(models, options) {
                if (safeRemove.apply(self,arguments)) {
                    if (!_.isArray(models))
                        models = [models];
                    _.each(models, function(model) {
                        var item = self.get(model[idAttribute]);
                        if (!item) return;
                        Backbone.sync('delete',item,options);
                        item.set = safeSet;
                        item.save = function() {};
                    });
                }
            };
            return this;
        },
        join: function(channel) {
            this.sync('join', channel);
        },
        leave: function(channel) {
            this.sync('leave', channel);
        }
    };

    Backbone.Collection = (function(Parent) {
        // Override the parent constructor
        var Child = function(models, options) {
            if (options && options.backend) {
                this.backend = options.backend;
            }
            if (options && options.entity) {
                this.entity = options.entity;
            }
            if (this.backend) {
                this.backend = buildBackend(this);
            }
            Parent.apply(this, arguments);
        };

        // Inherit everything else from the parent
        return inherits(Parent, Child, [Mixins]);
    })(Backbone.Collection);

    // Helpers
    // ---------------

    function parse(data) {
        if (typeof data === "number" || typeof data === "boolean")
            return data;
        else if (typeof data === "string") {
            var _data = parseFloat(data);
            if (isNaN(_data) && data !== "NaN") {
                _data = parseBool(data);
                if (_data === undefined) {
                    try {
                        data = JSON.parse(data);
                    } catch(e) {
                        return data;
                    }
                } else {
                    return _data;
                }
            } else {
                return _data;
            }
        }
        for (var key in data)
            data[key] = parse(data[key]);
        return data;
    }

    function parseBool(value)
    {
       if (typeof value === "string") {
        value = value.toLowerCase();
        if (value === "true" || value === "false")
            return value === "true";
       }
       return; // returns undefined
    }

    function inherits(Parent, Child, mixins) {
        var Func = function() {};
        Func.prototype = Parent.prototype;

        mixins || (mixins = []);
        _.each(mixins, function(mixin) {
            _.extend(Func.prototype, mixin);
        });

        Child.prototype = new Func();
        Child.prototype.constructor = Child;

        return _.extend(Child, Parent);
    }

    function buildBackend(collection) {
        var ready = new Promise();
        var options = collection.backend;
        var name, channel;

        if (typeof options === 'string') {
            name = options;
        } else {
            name = options.name;
        }

        var backend = {
            name: name,
            channel: channel,
            ready: function(callback) {
                ready.then(callback);
            }
        };

        connected.then(function(socket) {
            backend.socket = socket.of(backend.name);

            backend.socket.on('init',function(options) {
                backend.options = options;
                backend.socket.on('msg', function(meta, data) {

                    if (collection.entity && meta.entity != collection.entity)
                        return;

                    var event = backend.options.event;
                    collection.trigger(event, meta, data);
                    collection.trigger(event + ':' + meta.method, meta, data);
                });

                if (!ready.resolved) ready.resolve();
            });
        });

        return backend;
    }

    function syncSet(key, val, options) {
        options || (options = {});
        if (safeSet.apply(this,arguments) && key !== null && !options.local) {
            if (typeof key === 'object')
                options = val;
            Backbone.sync('update',this,options);
        }
    }

    // Minimalistic Promise implementation

    function Promise(context) {
        this.context = context || this;
        this.callbacks = [];
        this.resolved = undefined;
    }

    Promise.prototype.then = function(callback) {
        if (this.resolved !== undefined) {
            callback.apply(this.context, this.resolved);
        } else {
            this.callbacks.push(callback);
        }
    };

    Promise.prototype.resolve = function() {
        if (this.resolved) throw new Error('Promise already resolved');

        var self = this;
        this.resolved = arguments;

        _.each(this.callbacks, function(callback) {
            callback.apply(self.context, self.resolved);
        });
    };

})();
