'use strict';

/* Services */

var servicesModule = angular.module('squishReportServices', ['ngResource']);
servicesModule.factory('Suite', function($resource, $routeParams) {
    return $resource('/get_doc', {}, {
        query: {
            method:'GET',
            params:{
                suite:    $routeParams.suite,
                job:      $routeParams.job,
                build:    $routeParams.build,
                tst_case: 'suite'
            },
            isObject:true
        }
    });
});