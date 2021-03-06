/**
 * Created by srujangopu on 6/14/16.
 */
var app = require('./../main.js');
var mongoDbConnection = require('./../database/connection.js');
var newsFeed = require('./newsFeedService.js');
var singleStatus = require('./singleStatus.js');
var singleStatusCount = require('./singleStatusCount.js');

var _ = require('lodash');
var geocoder = require('geocoder');

var ObjectID = require('mongodb').ObjectID;

/* {
 "status": "hello world4",
 "userId":"12345",
 "userName": "Jack",
 "isAnnonymous": true,
 "location":[-77.18621789486043,
 38.82741811639861],
 "type": "text|commentText",
 "parentId" : null | "commentstatusId | statusId",
 "statusGroupId" : null | "statusId",
 "radius":3
 }*/
app.post('/saveStatus', function (req, res) {
    var status = req.body;
    status.timeStamp = Math.floor(Date.now());
    status.condition = 1;

    if(req.body.type == 'text'){
        status.replyCount = 0;
    }

    var locationPromise = new Promise(function (resolve, reject) {
        geocoder.reverseGeocode(status.location[1],status.location[0], function ( err, data ) {

            if (err) {
                reject(status)
            }

            var stateModule = _.find(data.results[0].address_components, function(o) {
                return _.indexOf(o.types, "administrative_area_level_1") != -1
            });

            var cityModule = _.find(data.results[0].address_components, function(o) {
                return (_.indexOf(o.types, "locality") != -1) || (_.indexOf(o.types, "political") != -1)
            });

            if(cityModule != undefined){
                status.city = cityModule.short_name;
            }
            if(stateModule != undefined){
                status.state = stateModule.short_name;
            }
            resolve(status);
        });
    });


    locationPromise.then(function (status1, err) {
        mongoDbConnection(function (databaseConnection) {
            databaseConnection.collection('status', function (error, collection) {
                status1.emotions = {
                    "like": [],
                    "dislike": []
                };

                if(req.body.type == 'commentText'){
                    collection.update({ _id: ObjectID(req.body.statusGroupId)}, { $inc: {replyCount: 1}}, function (err, records) {
                        collection.insert(status1, function (err, records) {
                            singleStatus(req.body.statusGroupId, req.body.userId, res)
                        })
                    })
                }
                else{
                    collection.insert(status1, function (err, records) {
                        res.jsonp(records);
                    })
                }
            })
        });
    });
});

/* {
 "statusId":"statusId",
 "status": "hello world4",
 "userId":"12345"
 }*/
app.post('/editStatus', function (req, res) {
    mongoDbConnection(function (databaseConnection) {
        databaseConnection.collection('status', function (error, collection) {
            collection.update({ _id: ObjectID(req.body.statusId) },{$set: {"status" : req.body.status, "timeStamp" : Math.floor(Date.now())}}, function (err, records) {
                singleStatusCount(req.body.statusId, req.body.userId, res);
            })
        })
    });
});

/* {
 "statusId":"statusId",
 "userId":"12345"
 }*/
app.post('/deleteStatus', function (req, res) {
    mongoDbConnection(function (databaseConnection) {
        databaseConnection.collection('status', function (error, collection) {
            collection.update({ _id: ObjectID(req.body.statusId) },{$set: {"condition" : 0, "timeStamp" : Math.floor(Date.now())}}, function (err, records) {
                res.jsonp(records);
            })
        })
    });
});

/*
 {
 "statusId" : "123",
 "userId": "12345",
 "emotion":"251"
 }
 */
app.post('/updateStatusEmotion', function (req, res) {

    mongoDbConnection(function (databaseConnection) {

        //update emotion
        var statusPromise = new Promise(function (resolve, reject) {
            databaseConnection.collection('status', function (error, collection) {


                collection.update(
                    {"_id": ObjectID(req.body.statusId)},
                    { $pull: { "emotions.like": req.body.userId, "emotions.dislike": req.body.userId } },
                    { multi: true },
                    function(error1, res){
                        var increaseField = {};
                        increaseField["emotions." + req.body.emotion] = req.body.userId;

                        var v1 = "emotions."+req.body.emotion;
                        collection.update({"_id": ObjectID(req.body.statusId)},
                            { $addToSet: increaseField }
                            ,{upsert: true}, function (err, records) {
                                if (err) {
                                    reject(err)
                                } else {
                                    resolve(records)
                                }
                            });
                    }
                );

            });
        });

        //update user
        statusPromise.then(function (dbres, err) {
            databaseConnection.collection('users', function (error, collection) {

                collection.find({
                    _id: req.body.userId,
                    status: {$elemMatch: {statusId: req.body.statusId}}
                }).next(function (err, doc) {

                    if (doc == undefined) {
                        collection.update({_id: req.body.userId}, {
                            $addToSet: {
                                status: {
                                    statusId: req.body.statusId,
                                    emotion: req.body.emotion
                                }
                            }
                        }, {upsert: true}, function (err, records) {
                            if (err) {
                                console.log(err)
                                res.status(505)
                                    .send('Error in processing');
                            }
                            else {
                                singleStatusCount(req.body.statusId, req.body.userId, res);
                            }
                        })
                    }
                    else {
                        collection.update({_id: req.body.userId, status: {$elemMatch: {statusId: req.body.statusId}}}, {
                            $set: {
                                "status.$": {
                                    statusId: req.body.statusId,
                                    emotion: req.body.emotion
                                }
                            }
                        }, function (err, records) {
                            if (err) {
                                console.log(err)
                                res.status(505)
                                    .send('Error in processing');
                            }
                            else {
                                singleStatusCount(req.body.statusId, req.body.userId, res);
                            }
                        })
                    }

                });
            })
        })

    });

});


/*
 {
 "statusId" : "123",
 "userId": "12345",
 "emotion":"251"
 }
 */
app.post('/deleteStatusEmotion', function (req, res) {

    mongoDbConnection(function (databaseConnection) {

        //update emotion
        var statusPromise = new Promise(function (resolve, reject) {

            databaseConnection.collection('status', function (error, collection) {

                var increaseField = {};
                increaseField["emotions." + req.body.emotion] = req.body.userId;
                collection.update({"_id": ObjectID(req.body.statusId)},
                    {$pull: increaseField},
                    { multi: true }
                    , function (err, records) {
                        if (err) {
                            reject(err)
                        } else {
                            resolve(records)
                        }
                    })


            });
        });

        //update user
        statusPromise.then(function (dbres, err) {
            databaseConnection.collection('users', function (error, collection) {

                collection.update({_id: req.body.userId},
                    {$pull: {status: {statusId: req.body.statusId}}}
                    , function (err, records) {
                        if (err) {
                            console.log(err)
                            res.status(505)
                                .send('Error in processing');
                        }
                        else {
                            singleStatusCount(req.body.statusId, req.body.userId, res);
                        }
                    })
            })
        })

    });
});


/*
 {
 "userId" : "123",
 "blockUserId":"123"
 }
 */
app.post('/blockUser', function (req, res) {

    mongoDbConnection(function (databaseConnection) {
        databaseConnection.collection('users', function (error, collection) {
            collection.update({_id: req.body.userId}, {
                $addToSet: {
                    blocks: req.body.blockUserId
                }
            }, {upsert: true}, function (err, records) {
                if (err) {
                    console.log(err)
                    res.status(505).send('Error in processing');
                } else {
                    res.jsonp("Sucess");
                }
            })
        })
    })
});

//?statusId=123&userId=1234
app.get('/getStatus', function (req, res) {
    singleStatus(req.query.statusId, req.query.userId, res)
});

/*{
 "location":[-77.18621789486043,
 38.82741811639861],
 "radius":3,
 "userId":"1234"
 }*/
app.post('/newsFeed', function (req, res) {
    newsFeed(req.body.location, req.body.radius, req.body.userId, res)
});


/*{
 "statusId":"123456"
 "reportType":[1 to 3],
 "userId":"1234"
 }*/
app.post('/reportIssue', function (req, res) {
    mongoDbConnection(function (databaseConnection) {
        databaseConnection.collection('report', function (error, collection) {
            collection.insert(req.body, function (err, records) {
                res.jsonp("Sucess");
            })
        })
    })
});


module.exports = app;
