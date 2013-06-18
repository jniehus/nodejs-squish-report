'use strict';

/* App Module */

angular.module('squishReport', ['squishReportServices']).
  config(['$routeProvider', function($routeProvider) {
  $routeProvider.
      when('/get_reports',
        { templateUrl: 'partials/reports.html',
          controller: GetReportsCtrl }).

      when('/report/:suite/:job/:build/suite',
        { templateUrl: 'partials/suite-list.html',
          controller: SuiteListCtrl }).

      when('/report/:suite/:job/:build/:tst_case',
        { templateUrl: 'partials/tst-case-detail.html',
          controller: TstCaseDetailCtrl }).

      otherwise({redirectTo: '/get_reports'});
}]);