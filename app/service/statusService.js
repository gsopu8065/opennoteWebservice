/**
 * Created by srujangopu on 6/14/16.
 */
var app = require('./../main.js');
var mongoDbConnection = require('./../database/connection.js');
var _ = require('lodash');

var ObjectID = require('mongodb').ObjectID

/* {
 "status": "hello world4",
 "userId":"12345",
 "userName": "Jack",
 "isAnnonymous": true,
 "location":[-77.18621789486043,
 38.82741811639861],
 "type": "text|commentText",
 "parentId" : null | "commentstatusId | statusId",
 "statusGroupId" : null | "statusId"
 }*/
app.post('/saveStatus', function (req, res) {
    var status = req.body;
    status.emotions = {
        "201": 0,
        "202": 0
    };
    status.timeStamp = Math.floor(Date.now());

    mongoDbConnection(function (databaseConnection) {
        databaseConnection.collection('status', function (error, collection) {
            collection.insert(status, function (err, records) {
                res.send(records)
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
                                res.send("success")
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
                                res.send("success")
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
                            res.send("success")
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
                    res.send("success")
                }
            })
        })
    })
});

//?statusId=123
app.get('/getStatus', function (req, res) {
    mongoDbConnection(function (databaseConnection) {
        databaseConnection.collection('status', function (error, collection) {
            collection.find({"_id": ObjectID(req.query.statusId)}).next(function (err, doc) {
                res.send(doc)
            })
        });
    });
});

/*{
 "location":[-77.18621789486043,
 38.82741811639861],
 "radius":3,
 "userId":"1234"
 }*/
app.post('/newsFeed', function (req, res) {
    var location = req.body.location;
    mongoDbConnection(function (databaseConnection) {
        var statusPromise = new Promise(function (resolve, reject) {
            databaseConnection.collection('status', function (error, collection) {
                collection.ensureIndex({"location": "2d"});
                collection.find({
                    "location": {$geoWithin: {$centerSphere: [location, req.body.radius / 3963.2]}}
                }).toArray(function (err, dbres) {
                    if (err) {
                        return reject(err);
                    }
                    resolve(dbres);
                });
            });
        });

        statusPromise.then(function (dbres, err) {
            databaseConnection.collection('users', function (error, collection) {
                //1) remove blocked status
                //2) update status emotions
                //3) and update view count (later)

                collection.find({_id: req.body.userId}).next(function (err, doc) {

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

});


module.exports = app;
