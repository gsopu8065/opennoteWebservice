/**
 * Created by srujangopu on 6/14/16.
 */
var app = require('./../main.js');
var mongoDbConnection = require('./../database/connection.js');
var newsFeed = require('./newsFeedService.js');
var singleStatus = require('./singleStatus.js');

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

    var locationPromise = new Promise(function (resolve, reject) {
        geocoder.reverseGeocode(status.location[0],status.location[1], function ( err, data ) {

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
                    "250": [],
                    "251": []
                };
                collection.insert(status1, function (err, records) {
                    newsFeed(req.body.location, req.body.radius, req.body.userId, res)
                })
            })
        });
    });
});

/*
 {
 "statusId" : "123",
 "userId": "12345",
 "emotion":"251",
 "location":[-77.18621789486043,
 38.82741811639861],
 "radius":3,
 "singleStatus":true
 }
 */
app.post('/updateStatusEmotion', function (req, res) {

    mongoDbConnection(function (databaseConnection) {

        //update emotion
        var statusPromise = new Promise(function (resolve, reject) {

            databaseConnection.collection('status', function (error, collection) {
                var increaseField = {};
                increaseField["emotions." + req.body.emotion] = 1;
                collection.update({"_id": ObjectID(req.body.statusId)},
                    {$inc: increaseField}
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
                                if(req.body.singleStatus){
                                    singleStatus(req.body.statusId, req.body.userId, res)
                                }
                                else {
                                    newsFeed(req.body.location, req.body.radius, req.body.userId, res)
                                }
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
                                if(req.body.singleStatus){
                                    singleStatus(req.body.statusId, req.body.userId, res)
                                }
                                else {
                                    newsFeed(req.body.location, req.body.radius, req.body.userId, res)
                                }
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
 "emotion":"251",
 "location":[-77.18621789486043,
 38.82741811639861],
 "radius":3,
 "singleStatus":true
 }
 */
app.post('/deleteStatusEmotion', function (req, res) {

    mongoDbConnection(function (databaseConnection) {

        //update emotion
        var statusPromise = new Promise(function (resolve, reject) {

            databaseConnection.collection('status', function (error, collection) {
                var increaseField = {};
                increaseField["emotions." + req.body.emotion] = -1;
                collection.update({"_id": ObjectID(req.body.statusId)},
                    {$inc: increaseField}
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
                            if(req.body.singleStatus){
                                singleStatus(req.body.statusId, req.body.userId, res)
                            }
                            else {
                                newsFeed(req.body.location, req.body.radius, req.body.userId, res)
                            }
                        }
                    })
            })
        })

    });
});


/*
 {
 "userId" : "123",
 "blockUserId":"123",
 "location":[-77.18621789486043,
 38.82741811639861],
 "radius":3
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
                    newsFeed(req.body.location, req.body.radius, req.body.userId, res)
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


module.exports = app;
