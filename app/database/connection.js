var Db = require('mongodb').Db;
var Connection = require('mongodb').Connection;
var Server = require('mongodb').Server;
//the MongoDB connection
var connectionInstance;

module.exports = function(callback) {
    //if already we have a connection, don't connect to database again
    if (connectionInstance == undefined) {
        var db = new Db('opennote', new Server("ds157380.mlab.com", 57380, { auto_reconnect: true }));
        db.open(function(error, databaseConnection) {
            if (error) throw new Error(error);
            db.authenticate("srujanjack", "blueline1", function(err, res) {
                if(!err) {
                    console.log("Authenticated");
                } else {
                    console.log("Error in authentication.");
                    console.log(err);
                }
            });
            connectionInstance = databaseConnection;
            callback(databaseConnection);
        });
    }
    else {
        callback(connectionInstance);
    }
};