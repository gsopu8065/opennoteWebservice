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
                    "type": "text",
                    "condition": 1
                }).toArray(function (err, dbres) {
                    if (err) {
                        return reject(err);
                    }

                    //2) add user status
                    _.forEach(dbres, function(eachStatus) {
                        var likeIndex = _.findIndex(eachStatus.emotions.like, function(o) { return o == userId; });
                        var dislikeIndex = _.findIndex(eachStatus.emotions.dislike, function(o) { return o == userId; });
                        if(likeIndex != -1){
                            eachStatus.userstatusEmotion = 'like'
                        }
                        if(dislikeIndex != -1){
                            eachStatus.userstatusEmotion = 'dislike'
                        }

                        eachStatus.likeCount = eachStatus.emotions.like.length;
                        eachStatus.dislikeCount = eachStatus.emotions.dislike.length
                    });

                    return resolve(dbres)
                });
            });
        });

        statusPromise.then(function (dbres, err) {
            databaseConnection.collection('users', function (error, collection) {
                //1) remove blocked status
                //2) add user status
                //3) and update view count (later)

                collection.find({_id: userId}).next(function (err, doc) {

                    if (doc != null) {

                        //1) remove blocked status
                        _.remove(dbres, function (eachStatus) {
                            return _.indexOf(doc.blocks, eachStatus.userId) != -1;
                        });

                        //2) add user status
                        _.forEach(dbres, function(eachStatus) {
                            delete eachStatus.emotions
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