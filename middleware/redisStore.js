module.exports = function() {

    var models = {};
    var id = 1;

    var crud = {

        create: function(req, res, next) {
            var model = req.model;
            model.id = id++;
            models[model.id] = model;
            res.end(model);
        },

        read: function(req, res, next) {
            if (req.model.id) {
                res.end(models[req.model.id]);
            } else {
                var values = [];
                for (var id in models) {
                    values.push(models[id]);
                }
                res.end(values);
            }
        },

        update: function(req, res, next) {
            models[req.model.id] = req.model;
            res.end(req.model);
        },

        delete: function(req, res, next) {
            delete models[req.model.id];
            res.end(req.model);
        }

    };

    return function(req, res, next) {

        if (!crud[req.method]) {
            return next(new Error('Unsuppored method ' + req.method));
        }

        crud[req.method](arguments);

    };

};