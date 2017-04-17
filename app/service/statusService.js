/**
 * Created by srujangopu on 6/14/16.
 */
var app = require('./../main.js');
var mongoDbConnection = require('./../database/connection.js');

/* {
 "status": "hello world4",
 "userid":"12345",
 "userName": "Jack",
 "isAnnonymous": true,
 "location":[-77.18621789486043,
 38.82741811639861]
 }*/
app.post('/saveStatus', function (req, res) {
    var status = req.body;
    status.type = "text";
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
 "emotion":"251"
 }
 */
app.post('/updateStatusEmotion', function (req, res) {

    mongoDbConnection(function (databaseConnection) {
        databaseConnection.collection('status', function (error, collection) {
            var increaseField = {};
            increaseField["emotions"+req.body.emotion] = 1;
            collection.update({_id: req.body.statusId}, { $inc: increaseField })
            res.send("sucess")
        });
    });

});

/*
{
"userId" : "123",
"blockUserId":"123"
}
 */
app.post('/blockUser', function (req, res) {
    databaseConnection.collection('users', function (error, collection) {
        collection.update({_id: req.body.userId}, {$addToSet: {blocks: {$each: req.body.blockUserId}}}, {upsert: true}, function (err, records) {
            res.send(records)
        })
    })
});

//?statusId=123
app.get('/getStatus', function (req, res) {
    mongoDbConnection(function (databaseConnection) {
        databaseConnection.collection('status', function (error, collection) {
            collection.find({_id: req.query.statusId}).next(function (err, doc) {
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
                    "location": {$geoWithin: {$centerSphere: [location, req.body.radius/ 3963.2]}}
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
                //remove blocked status and update view count
                res.jsonp(dbres);
            })
        });


    });

});


module.exports = app;
