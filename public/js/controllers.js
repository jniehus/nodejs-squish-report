'use strict';

/* Controllers */

// private state variables
var __suite_filter   = null
  , __tstcase_filter = null;

// private methods
function __ctrlApplyFilter(elem, scope) {
    var show = true
      , passes = ["PASS", "LOG"]
      , elemType = elem.result || elem.type;

    switch(scope.filter) {
    case "passes":
        if (passes.indexOf(elemType) < 0) {
            show = false;
        }
        break;
    case "failures":
        if (passes.indexOf(elemType) >= 0) {
            show = false;
        }
        break;
    }
    return show;
}

function GetReportsCtrl($scope, $location, $http) {
    $scope.splitReport = function(report, idx) {
        return report.split(".")[idx];
    }

    $scope.getSuites = function (reports) {
        var i, suite
          , len = reports.length
          , suites = [];
        for (i = 0; i < len; ++i) {
            suite = $scope.splitReport(reports[i], 0);
            if (suites.indexOf(suite) < 0) {
                suites.push(suite);
            }
        }
        return suites;
    }

    $scope.updateJobs = function() {
        $scope.jobs = [];
        var i, job
          , reports = $scope.reports
          , len     = reports.length;
        for (i = 0; i < len; ++i) {
            if (reports[i].indexOf($scope.suite) >= 0) {
                job = $scope.splitReport(reports[i], 1);
                if ($scope.jobs.indexOf(job) < 0) {
                    $scope.jobs.push(job);
                }
            }
        }
    }

    $scope.applySuiteFilter = function(report) {
        var jobs = getJobs($scope.reports, $scope.suite)
    }

    $scope.applyBuildFilter = function(report) {
        var suite_job = $scope.suite + "." + $scope.job;
        return report.indexOf(suite_job) >= 0;
    }

    $scope.go = function(path) {
        if ($scope.suite && $scope.job && $scope.build) {
            $location.path("/report/" + $scope.suite + "/" + $scope.job + "/" + $scope.build + "/suite");
        }
        else {
            alert("You must select a suite, a job, and a build");
        }
    };

    $http({method: 'GET', url: '/get_reports'}).
        success(function(data, status, headers, config) {
            $scope.reports = data;
            $scope.suites  = $scope.getSuites(data);
            $scope.jobs = []; // init
        }).
        error(function(data, status, headers, config) {
            console.log("Couldn't retrieve report collections data!!!");
        });
}

function SuiteListCtrl($scope, $routeParams, Suite) {
    $scope.filter = __suite_filter || "failures";
    $scope.route_params = $routeParams;

    $scope.loadSuiteData = function() {
        $scope.suite = Suite.query();
    }

    $scope.newFilterValue = function(filter) {
        __suite_filter = filter;
    }

    $scope.applyFilter = function(elem) {
        return __ctrlApplyFilter(elem, $scope);
    }

    $scope.fancyDate = function(date_stamp) {
        return new Date(date_stamp).toUTCString();
    }

    $scope.duration = function(start, finish) {
        var start_date  = new Date(start)
          , finish_date = new Date(finish)
          , diff        = Math.abs(finish_date - start_date)
          , dur_min     = Math.floor( (diff/1000) / 60 );

        return dur_min + " minutes";
    }

    $scope.loadSuiteData();
}

function TstCaseDetailCtrl($scope, $routeParams, Suite) {
    $scope.filter        = __tstcase_filter || "failures";
    $scope.route_params  = $routeParams;

    $scope.loadTstCaseData = function() {
        $scope.tstCase = Suite.get({
            suite:    $routeParams.suite,
            job:      $routeParams.job,
            build:    $routeParams.build,
            tst_case: $routeParams.tst_case
        });
    }

    $scope.newFilterValue = function(filter) {
        __tstcase_filter = filter;
    }

    $scope.applyFilter = function(elem) {
        return __ctrlApplyFilter(elem, $scope);
    }

    $scope.loadTstCaseData();
}