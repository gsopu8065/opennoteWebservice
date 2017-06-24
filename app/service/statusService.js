/**
 * Created by srujangopu on 6/14/16.
 */
var app = require('./../main.js');
var mongoDbConnection = require('./../database/connection.js');
var newsFeed = require('./newsFeedService.js');
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
    status.emotions = {};
    status.timeStamp = Math.floor(Date.now());

    var locationPromise = new Promise(function (resolve, reject) {
        geocoder.reverseGeocode(status.location[0],status.location[1], function ( err, data ) {
            /*_.forEach(data.results[0].address_components, function (address_component) {
                if (address_component.types[0] == "locality" || address_component.types[0] == "political")
                    status.city = address_component.short_name;
                if (address_component.types[0] == "administrative_area_level_1")
                    status.state = address_component.short_name;
            });*/
            status.city = _.find(data.results[0].address_components, function(o) {
                return _.indexOf(o.types, "administrative_area_level_1") != -1
            }).short_name || "";
            status.state = _.find(data.results[0].address_components, function(o) {
                return (_.indexOf(o.types, "locality") != -1) || (_.indexOf(o.types, "political") != -1)
            }).short_name || "";

            if (err) {
                reject(status)
            } else {
                resolve(status)
            }
        });
    });


    locationPromise.then(function (status1, err) {
        mongoDbConnection(function (databaseConnection) {
            databaseConnection.collection('status', function (error, collection) {
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
 "radius":3
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
                                newsFeed(req.body.location, req.body.radius, req.body.userId, res)
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
                                newsFeed(req.body.location, req.body.radius, req.body.userId, res)
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
 "radius":3
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
                            newsFeed(req.body.location, req.body.radius, req.body.userId, res)
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

//?statusId=123
app.get('/getStatus', function (req, res) {
    mongoDbConnection(function (databaseConnection) {
        databaseConnection.collection('status', function (error, collection) {

            var repliesPromise = new Promise(function (resolve, reject) {

                collection.find({
                    "parentId": req.query.statusId,
                    "type": "commentText"
                }).toArray(function (err, dbres) {
                    if (err) {
                        return reject(err);
                    }
                    resolve(dbres);
                });

            });

            repliesPromise.then(function (dbres, err) {
                collection.find({"_id": ObjectID(req.query.statusId)}).next(function (err, doc) {
                    doc.replies = dbres;
                    res.send(doc)
                })
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
    newsFeed(req.body.location, req.body.radius, req.body.userId, res)
});


module.exports = app;
