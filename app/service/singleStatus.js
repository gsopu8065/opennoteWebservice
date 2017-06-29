
/**
 * Created by srujangopu on 6/4/17.
 */
var app = require('./../main.js');
var mongoDbConnection = require('./../database/connection.js');
var ObjectID = require('mongodb').ObjectID;
var _ = require('lodash');

module.exports = function (statusId, userId, res) {

    mongoDbConnection(function (databaseConnection) {

        databaseConnection.collection('status', function (error, collection) {
            collection.find({
                "parentId": statusId,
                "type": "commentText"
            }).sort({timeStamp: 1}).toArray(function (err, dbres) {
                collection.find({"_id": ObjectID(statusId)}).next(function (dbErr, doc) {
                    doc.replies = dbres;
                    var likeIndex = _.findIndex(doc.emotions.like, function(o) { return o == userId; });
                    var dislikeIndex = _.findIndex(doc.emotions.dislike, function(o) { return o == userId; });
                    if(likeIndex != -1){
                        doc.userstatusEmotion = 'like'
                    }
                    if(dislikeIndex != -1){
                        doc.userstatusEmotion = 'dislike'
                    }

                    doc.likeCount = doc.emotions.like.length;
                    doc.dislikeCount = doc.emotions.dislike.length
                    delete doc.emotions
                    res.jsonp(doc);
                });
            });
        });
    });
};
