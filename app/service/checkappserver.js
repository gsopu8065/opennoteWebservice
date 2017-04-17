/**
 * Created by srujangopu on 6/14/16.
 */
var app = require('./../main.js');
var firebase = require('firebase-admin');
var mongoDbConnection = require('./../database/connection.js');

app.get('/hello', function (req, res) {

    var db = firebase.database();
    var ref = db.ref("status/sample");
    ref.once("value", function(snapshot) {
        console.log(snapshot.val());
        mongoDbConnection(function (databaseConnection) {
            databaseConnection.collection('status', function (error, collection) {

                collection.find({}).next(function (err, doc) {
                    res.send({"fire base status":snapshot.val(),
                        "mongodb status" : doc
                    })
                })
            });
        });
    });

});

module.exports = app;
