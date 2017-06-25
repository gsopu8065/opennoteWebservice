
/**
 * Created by srujangopu on 6/4/17.
 */
var app = require('./../main.js');
var mongoDbConnection = require('./../database/connection.js');
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

       /* var statusPromise = new Promise(function (resolve, reject) {
            repliesPromise.then(function (dbres, err) {
                databaseConnection.collection('status', function (error, collection) {
                    collection.find({"_id": ObjectID(statusId)}).next(function (dbErr, doc) {
                        doc.replies = dbres;
                        if (err || error || dbErr) {
                            return reject(err);
                        }
                        resolve(doc);
                    })
                });
            });
        });
*/

        repliesPromise.then(function (dbres, err) {
            databaseConnection.collection('users', function (error, collection) {
                //1) remove blocked status
                //2) update status emotions
                //3) and update view count (later)

                collection.find({_id: userId}).next(function (err, doc) {

                    if (doc != null) {

                        //1) remove blocked status
                        _.remove(dbres, function (eachStatus) {
                            return _.indexOf(doc.blocks, eachStatus.userId) != -1;
                        });

                        //2) update status emotions
                        var updatedStatus = _.map(dbres, function (eachStatus) {
                            var userStatus = _.find(doc.status, function (eachUserStatus) {
                                return eachUserStatus.statusId == eachStatus._id;
                            });
                            return _.extend({}, eachStatus, {userStatus: userStatus});
                        });
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
