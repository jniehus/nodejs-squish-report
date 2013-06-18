/*
    Sample script for job
        1. collect meta data of job and put into object
        2. get latest build and install it
        3. run squish
        4. wait for squish to return and add value to job meta data
        5. take results and record them to MongoDB
*/

var MONGO_PORT = 34001
  , s2m        = require('./squish_xml2_mongo.js');

var job = {
    'name':                 "smoke_linux",
    'build_number':         "2",
    'test_runner_os':       "Ubuntu 13.04 x64",
    'Qt_version':           "QtDlls 4.7.1",
    'product_version':      "4.1",
    'change_list':          "CL75899",
    'builds_folder':        "/PTSoftware/Projects/ImageLab/Builds",
    'workspace':            "/workspace",
    'squish_runner_cmd':    "['squishrunner', 'suite_ImageLab']",
    'squish_runner_return': 0,
}

s2m.squish_xml2_mongo('results.xml', job, MONGO_PORT);