/**
 * Created by srujangopu on 6/4/17.
 */
var app = require('./../main.js');
var mongoDbConnection = require('./../database/connection.js');
var _ = require('lodash');

module.exports = function (location, radius, userId, res) {

    mongoDbConnection(function (databaseConnection) {
        var statusPromise = new Promise(function (resolve, reject) {
            databaseConnection.collection('status', function (error, collection) {
                collection.ensureIndex({"location": "2d"});
                collection.find({
                    "location": {$geoWithin: {$centerSphere: [location, radius / 3963.2]}},
                    "type": "text"
                }).sort({timeStamp: -1}).toArray(function (err, dbres) {
                    if (err) {
                        return reject(err);
                    }
                    return resolve(dbres)
                });
            });
        });

        statusPromise.then(function (dbres, err) {
            databaseConnection.collection('users', function (error, collection) {
                //1) remove blocked status
                //2) and update view count (later)

                collection.find({_id: userId}).next(function (err, doc) {

                    if (doc != null) {

                        //1) remove blocked status
                        _.remove(dbres, function (eachStatus) {
                            return _.indexOf(doc.blocks, eachStatus.userId) != -1;
                        });

                        res.jsonp(dbres);
                    }
                    else {
                        res.jsonp(dbres);
                    }
                });
            })
        });


    });
};