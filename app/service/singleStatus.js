
/**
 * Created by srujangopu on 6/4/17.
 */
var app = require('./../main.js');
var mongoDbConnection = require('./../database/connection.js');
var ObjectID = require('mongodb').ObjectID;
var _ = require('lodash');

module.exports = function (statusId, userId, res) {

    mongoDbConnection(function (databaseConnection) {

        //first get replies of status
        var repliesPromise = new Promise(function (resolve, reject) {
            databaseConnection.collection('status', function (error, collection) {
                collection.find({
                    "parentId": statusId,
                    "type": "commentText"
                }).toArray(function (err, dbres) {
                    if (err || error) {
                        return reject(err);
                    }
                    collection.find({"_id": ObjectID(statusId)}).next(function (dbErr, doc) {
                        doc.replies = dbres;
                        if (err || error || dbErr) {
                            return reject(err);
                        }
                        resolve(doc);
                    });
                });
            });
        });

        repliesPromise.then(function (dbres, err) {
            databaseConnection.collection('users', function (error, collection) {
                //1) remove blocked status
                //2) update status emotions
                //3) and update view count (later)

                collection.find({_id: userId}).next(function (err, doc) {

                    if (doc != null) {

                        var userStatus = _.find(doc.status, function (eachUserStatus) {
                            return eachUserStatus.statusId == dbres._id;
                        });

                        var updatedStatus = dbres
                        if(userStatus){
                            updatedStatus = _.extend({}, dbres, {userStatus: userStatus});
                        }

                        res.jsonp(updatedStatus);
                    }
                    else {
                        res.jsonp(dbres);
                    }
                });
            })
        });

    });
};
