const OptionsControllers = angular.module('aq.options.controllers', []);

OptionsControllers.controller('OptionsListCtrl', [
    '$scope', '$rootScope', '$location', '$modal', 'OptionsServices', '$translate', 'toastService',
    function ($scope, $rootScope, $location, $modal, OptionsServices, $translate, toastService) {
        $scope.limit            = 12;
        $scope.optionsList      = {};
        $scope.optionsList.data = [];
        $scope.lang                = $rootScope.languages.find((lang) => lang.defaultLanguage).code;

        $scope.addOptions = function () {
            const modalInstance = $modal.open({
                templateUrl : 'app/options/views/modals/options-new.html',
                controller  : 'nsNewOptionsControllerModal',
                windowClass : 'modal-large',
                resolve     : {
                    lang() {
                        return $scope.lang;
                    }
                }
            });

            modalInstance.result.then(function (isCreated) {
                $scope.getList();
            });
        };

        $scope.goToOptionsDetails = function (code) {
            $location.path(`/options/details/${code}`);
        };

        $scope.getList = function () {
            OptionsServices.list({
                PostBody : {
                    limit : $scope.limit
                }
            }, function (response) {
                $scope.optionsList.data = response.datas;
                $scope.$apply();
            }, function (error) {
                toastService.toast('danger', $translate.instant('global.standardError'));
            });
        };
    }
]);
OptionsControllers.controller('OptionsDetailCtrl', [
    '$scope', '$rootScope', '$location', '$routeParams', 'OptionsServices', 'toastService', '$translate',
    function ($scope, $rootScope, $location, $routeParams, OptionsServices, toastService, $translate) {
        $scope.isNew   = false;
        $scope.options = {
            data : {
                code : $routeParams.code
            }
        };
        $scope.save    = function (isQuit) {
            OptionsServices.set($scope.options.data, function (response) {
                $scope.options.data = response;
                toastService.toast('success', $translate.instant('global.saved'));
                if (isQuit) {
                    $location.path('/options');
                }
            }, function (error) {
                if (error && error.data && error.data.message) {
                    toastService.toast('danger', error.data.message);
                } else {
                    toastService.toast('danger', $translate.instant('global.standardError'));
                }
            });
        };

        $scope.remove = function(){
            OptionsServices.delete({action: $scope.options.data._id}, function (response) {
                toastService.toast('success', $translate.instant('global.deleted'));
                $location.path('/options');
            }, function (error) {
                if (error && error.data && error.data.message) {
                    toastService.toast('danger', error.data.message);
                } else {
                    toastService.toast('danger', $translate.instant('global.standardError'));
                }
            });
        }
    }
]);

OptionsControllers.controller('nsNewOptionsController', [
    '$scope', '$rootScope', '$location', 'OptionsServices', '$translate', 'toastService',
    function ($scope, $rootScope, $location, OptionsServices, $translate, toastService) {
        $scope.lang = $rootScope.languages.find((lang) => lang.defaultLanguage).code;

        if ($scope.isNew !== true) {
            OptionsServices.get({
                PostBody : {
                    filter : {
                        code : $scope.options.code
                    }
                }
            }, function (response) {
                $scope.options = response;
            }, function (error) {
                toastService.toast('danger', $translate.instant('global.standardError'));
            });
        }

        $scope.addValue = function () {
            if (typeof $scope.options.values === 'undefined') {
                $scope.options.values = [];
            }
            $scope.options.values.push({
                name      : {},
                mandatory : false,
                modifier  : {
                    price  : 0,
                    weight : 0
                }
            });
        };

        $scope.removeValue = function ($index) {
            if (typeof $scope.options.values === 'undefined') {
                $scope.options.values = [];
            }
            const index = $scope.options.values.findIndex((element, index) => index == $index);
            if (index > -1) {
                $scope.options.values.splice(index, 1);
            }
        };
    }
]);

OptionsControllers.controller('nsNewOptionsControllerModal', [
    '$scope', '$rootScope', '$location', '$modalInstance', 'OptionsServices', 'toastService', '$translate',
    function ($scope, $rootScope, $location, $modalInstance, OptionsServices, toastService, $translate) {
        $scope.isNew = true;

        $scope.cancel       = function (val) {
            $modalInstance.close(val);
        };
        $scope.options      = {};
        $scope.options.data = {
            code      : '',
            name      : {},
            type      : 'textfield', // default
            mandatory : true,
            values    : []
        };

        $scope.save = function (val) {
            OptionsServices.set($scope.options.data, function (response) {
                toastService.toast('success', $translate.instant('global.saved'));
                $modalInstance.close(response);
            }, function (error) {
                if (error && error.data && error.data.message) {
                    toastService.toast('danger', error.data.message);
                } else {
                    toastService.toast('danger', $translate.instant('global.standardError'));
                }
                console.error(error);
            });
        };
    }
]);

OptionsControllers.controller('nsListOptionsController', [
    '$scope', '$rootScope', '$location', 'OptionsServices', 'toastService', '$translate', "OptionsSetServices", 
    function ($scope, $rootScope, $location, OptionsServices, toastService, $translate, OptionsSetServices) {
        // controller of list
        if (typeof $scope.optionsList === 'undefined') {
            $scope.optionsList = [];
        }
        if (typeof $scope.limit === 'undefined') {
            $scope.limit = 12;
        }
        $scope.lang = $rootScope.languages.find((lang) => lang.defaultLanguage).code;

        $scope.clickItem = function (code) {
            if (typeof $scope.onClickItem !== 'undefined') {
                $scope.onClickItem(code);
            } else {
                console.log('clicked, but no callBack');
            }
        };

        $scope.loadOptionsSet = function(code){
            const index = $scope.optionsList.findIndex((element)=>element.code == code);
            if(index > -1){
                const id = $scope.optionsList[index]._id;
                OptionsSetServices.list({PostBody :{
                    limit: $scope.limit,
                    filter: {
                        options : id
                    }
                }}, function(response){
                    $scope.optionsList[index].optionsSet = response.datas;
                }, function (error) {
                    if (error && error.data && error.data.message) {
                        toastService.toast('danger', error.data.message);
                    } else {
                        toastService.toast('danger', $translate.instant('global.standardError'));
                    }
                    console.error(error);
                })
            }
        };

        $scope.getList = function () {
            OptionsServices.list({
                PostBody : {
                    limit : $scope.limit
                }
            }, function (response) {
                $scope.optionsList = response.datas;
            }, function (error) {
                toastService.toast('danger', $translate.instant('global.standardError'));
            });
        };

        $scope.getList(); // we get the list
    }
]);

OptionsControllers.controller('nsListOptionsControllerModal', [
    '$scope', '$rootScope', '$location', '$modalInstance',
    function ($scope, $rootScope, $location, $modalInstance) {
        $scope.optionsList = {
            data : []
        };

        $scope.onClick = function (code) {
            const index          = $scope.optionsList.data.findIndex((element) => element.code == code);
            const correctOptions = $scope.optionsList.data[index];
            $scope.save(correctOptions);
        };

        $scope.cancel = function () {
            $modalInstance.close(false);
        };
        $scope.save   = function (val) {
            $modalInstance.close(val);
        };
    }
]);