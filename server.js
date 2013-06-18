/*
    --- Squish Report Services ---

    Database report structure:

    db. squish_reports
        coll: product
            coll: job type
                coll: job num
                    docs: parsed data

    image_lab
        regression_win_7
            build 1
                data...
            build 2
                data...
        regression_osx
            build 1
                data...
            build 2
                data...
        smoke_win_xp
            build 3343
                data...
*/

var SERVER_PORT = 34000
  , MONGO_PORT  = 34001
  , REPORT_DB   = "squish_reports"
  , _           = require('lodash')
  , express     = require('express')
  , server      = express()
  , Db          = require('mongodb').Db
  , MongoClient = require('mongodb').MongoClient
  , MServer     = require('mongodb').Server;

/* --- server def --- */
// let angular.js do most of the magic
server.configure(function(){
    server.use(express.static(__dirname + '/public'));
});

// get db squish_report collections
server.get("/get_reports", function(req, res) {
    res.setHeader('Content-Type', 'text/plain');
    var db = new Db(REPORT_DB, new MServer('localhost', MONGO_PORT), { w: 'majority' });
    db.open(function(err, db) {
        if (err) throw err;
        db.collectionNames({namesOnly:true}, function(err, items) {
            var cull_items = _.filter(items, function(coll) {
                return coll !== REPORT_DB + ".system.indexes";
            });

            // get rid of the REPORT_DB prefix
            cull_items = _.map(cull_items, function(coll) {
                var tmp_coll_arr = coll.split(".")
                tmp_coll_arr.shift();
                return tmp_coll_arr.join(".");
            });

            res.send(JSON.stringify(cull_items));
            db.close();
        });
    });
});

// get specific tst_case or suite summary
server.get("/get_doc", function(req, res) {
    var suite    = req.query.suite
      , job      = req.query.job
      , build    = req.query.build
      , coll     = suite + "." + job + "." + build
      , tst_case = req.query.tst_case;

    var mongoClient = new MongoClient( new MServer('localhost', MONGO_PORT), {db:{strict:true}} );
    mongoClient.open(function(err, mongoClient) {
        if (err) throw err;
        var db         = mongoClient.db(REPORT_DB)
          , collection = db.collection(coll);
        collection.findOne( { name: tst_case }, function(err, item) {
            if (err) throw err;
            res.send(JSON.stringify(item.info));
            mongoClient.close();
        });
    });
});

// start our server on specific port
server.listen(SERVER_PORT);
console.log('Listening on port ' + SERVER_PORT);