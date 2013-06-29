/*
    This module dumps a Squish XML report to mongodb

    --- SquishReport
        * test[0]['$'].name = product_suite
        * test[0].prolog
            * [0]['$'].time
        * test[0].epilog
            * [0]['$'].time

    --- tests => SquishReport.test[0].test
*/

// node standard lib
var fs = require('fs');

// node packages
var db_store    = []
  , REPORT_DB   = "squish_reports"
  , MONGO_PORT  = null
  , xml2js      = require('xml2js')
  , MongoClient = require('mongodb').MongoClient
  , MServer     = require('mongodb').Server;


// helper methods and objects
var SuiteInfo = {
    name: "suite",
    info: {
        'test_cases': [],
        'summary': {
            'cases':             0,
            'tests':             0,
            'passes':            0,
            'fails':             0,
            'warnings':          0,
            'expected_fails':    0,
            'unexpected_passes': 0,
            'errors':            0,
            'fatals':            0
        }
    }
}

var TstCaseInfo = function(name, tests) {
    this.name = name  || null;
    this.info = tests || {};
};

function updateSuiteSummary(data, sum_obj) {
    switch(data['type']) {
    case "PASS":
        SuiteInfo.info['summary']['tests'] += 1;
        SuiteInfo.info['summary']['passes'] += 1;
        break;
    case "WARNING":
        SuiteInfo.info['summary']['warnings'] += 1;
        sum_obj['Warnings'] += 1;
        break;
    case "FAIL":
        SuiteInfo.info['summary']['tests'] += 1;
        SuiteInfo.info['summary']['fails'] += 1;
        sum_obj['Fails'] += 1;
        break;
    case "XFAIL":
        SuiteInfo.info['summary']['tests'] += 1;
        SuiteInfo.info['summary']['expected_fails'] += 1;
        sum_obj['Expected Fails'] += 1;
        break;
    case "XPASS":
        SuiteInfo.info['summary']['tests'] += 1;
        SuiteInfo.info['summary']['unexpected_passes'] += 1;
        sum_obj['Unexpected Passes'] += 1;
        break;
    case "ERROR":
        SuiteInfo.info['summary']['errors'] += 1;
        sum_obj['Errors'] += 1;
        break;
    case "FATAL":
        SuiteInfo.info['summary']['fatals'] += 1;
        sum_obj['Fatals'] += 1;
        break;
    }
}

function buildFaultSummary(sum_obj) {
    var summary = "";
    for (var k in sum_obj){
        if (sum_obj.hasOwnProperty(k)) {
             if (sum_obj[k] > 0) {
                summary += k + ": " + sum_obj[k] + " ";
             }
        }
    }
    return summary.trim();
}

function getTstCaseResult(sum_obj) {
    result = "PASS";

    if (sum_obj['Warnings'] > 0) {
        result = "WARNING";
    }

    if (sum_obj['Fails'] > 0) {
        result = "FAIL";
    }

    if (sum_obj['Errors'] > 0) {
        result = "ERROR";
    }

    if (sum_obj['Fatals'] > 0) {
        result = "FATAL";
    }

    return result;
}

function getReportVersion(xml_data) {
    return xml_data.SquishReport['$'].version;
}

function getTstCases(suite_data) {
    return suite_data.test;
}

function getName(xml_data) {
    return xml_data['$'].name;
}

function getTimeStamp(xml_data, time) {
    time = time || 'prolog';
    return xml_data[time][0]['$'].time;
}

function getResult(ver_data) {
    return ver_data['result'][0]['$'].type;
}

function getResultTime(ver_data) {
    return ver_data['result'][0]['$'].time;
}

function getDetails(detailed_data) {
    var i, detail
      , len = detailed_data.length
      , details = "";

    for (i = 0; i < len; ++i) {
        detail = detailed_data[i];
        if (typeof detail === 'string') {
            detail = detail.replace(/\r/g, "");
            details += detail.trim();
        }
        else if (typeof detail === 'object') {
            if (typeof detail['_'] !== 'undefined') {
                details += detail['_'].trim();
            }
        }
        else {
            console.log("WARNING: " + detail);
        }

        if (i !== (len - 1)) {
            details += " ";
        }
    }

    return details.trim();
}

function storeData() {
    var suite_name = SuiteInfo.info['suite_name']
      , job        = SuiteInfo.info['job']['name']
      , build      = SuiteInfo.info['job']['build_number']
      , coll       = suite_name + "." + job + ".build_" + build;

    var mongoClient = new MongoClient( new MServer('localhost', MONGO_PORT), {db:{strict:true}} );
    mongoClient.open(function(err, mongoClient) {
        if (err) throw err;

        var db = mongoClient.db(REPORT_DB);
        db.createCollection(coll, {w:1, strict:true}, function(err, collection) {
            if (err) throw err;
            collection.insert(db_store, {w:1}, function(err, result) {
                if (err) throw err;
                mongoClient.close();
            });
        });
    });
}


/** begin parsing report **/
// Entry point
exports.squish_xml2_mongo = function(report, job_meta_data, mongo_port) {
    MONGO_PORT = mongo_port;
    SuiteInfo.info['job'] = job_meta_data;

    // read report file
    fs.readFile(report, function (err, data) {
        if (err) throw err;
        parseReport(data);
    });
}

// convert report in to js object using xml2js
function parseReport(squish_xml) {
    xml2js.parseString(squish_xml, function (err, report) {
        if (err) throw err;
        parseSuite(report);
    });
}

function parseSuite(report) {
    var i, len, tst, tests, name, start, stop, num;
    var test_suite     = report.SquishReport.test[0];
    var suite_info     = SuiteInfo.info;
    var report_version = getReportVersion(report);
    if (report_version !== "2.1") {
        throw "Squish report version '" + report_version + "' not supported!";
    }

    suite_info['suite_name']        = getName(test_suite);
    suite_info['summary']['start']  = getTimeStamp(test_suite, 'prolog');
    suite_info['summary']['finish'] = getTimeStamp(test_suite, 'epilog');

    tests = getTstCases(test_suite);
    len = tests.length;
    for(i = 0; i < len; ++i) {
        tst = tests[i];
        num = i+1;
        parseTstCase(tst, (i+1));
    }

    SuiteInfo.info['summary']['cases'] = num;
    db_store.push(SuiteInfo);

    storeData();
}

function parseTstCase(tst_data, num) {
    var i, j, v_len, m_len, verifications, messages, sum_obj;
    var tst_summary = {};
    var tests = {'tests': []};
    tst_summary['number'] = num;
    tst_summary['name']   = getName(tst_data);
    tst_summary['start']  = getTimeStamp(tst_data, 'prolog');

    verifications = tst_data['verification'];
    v_len = (verifications ? verifications.length : 0);

    messages = tst_data['message'];
    m_len = (messages ? messages.length : 0);

    sum_obj = {
        'Warnings':          0,
        'Fails':             0,
        'Expected Fails':    0,
        'Unexpected Passes': 0,
        'Errors':            0,
        'Fatals':            0
    }

    for(i = 0; i < v_len; ++i) {
        parseVerification(tst_data['verification'][i], tests, sum_obj);
    }

    for(j = 0; j < m_len; ++j) {
        parseMessage(tst_data['message'][j], tests, sum_obj);
    }

    tests['tests'].sort(function(a, b){
        var dateA=new Date(a.time), dateB=new Date(b.time)
        return dateA-dateB //sort by date ascending
    });

    tst_summary['fault_summary'] = buildFaultSummary(sum_obj);
    tst_summary['result']        = getTstCaseResult(sum_obj);
    tst_case = new TstCaseInfo(tst_summary['name'], tests);

    SuiteInfo.info['test_cases'].push(tst_summary);
    db_store.push(tst_case);
}

function parseVerification(ver_data, tests, sum_obj) {
    var suite_name = SuiteInfo.info['suite_name'];
    var file = (ver_data['$'].file).split(suite_name)[1];
    var line = ver_data['$'].line;

    var file_line   = file + ": " + line;
    var description = ver_data['$'].name;
    var time        = getResultTime(ver_data);
    var type        = getResult(ver_data);
    var details     = getDetails(ver_data['result'][0].description);

    var verification_point = {
        "description":   description,
        "type":          type,
        "file_and_line": file_line,
        "details":       details,
        "time":          time
    }

    tests['tests'].push(verification_point);
    updateSuiteSummary(verification_point, sum_obj);
}

function parseMessage(msg_data, tests, sum_obj) {
    var suite_name = SuiteInfo.info['suite_name'];
    var file = (msg_data['$'].file).split(suite_name)[1];
    var line = msg_data['$'].line;

    var file_line  = file + ": " + line;
    var time       = msg_data['$'].time;
    var type       = msg_data['$'].type;
    var details    = getDetails(msg_data.description);

    var message_point = {
        "type":          type,
        "file_and_line": file_line,
        "details":       details,
        "time":          time
    }

    tests['tests'].push(message_point);
    updateSuiteSummary(message_point, sum_obj);
}