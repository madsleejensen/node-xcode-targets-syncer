var xcode = require("xcode");
var fs = require("fs");
var extend = require("extend");
var path = require("path");

var filePath = 'test/TargetSync/TargetSync.xcodeproj/project.pbxproj';
var project = xcode.project(filePath);
project.parse(function(error, data) {

    function BuildPhaseSyncer() {
        var buildFileSection = project.pbxBuildFileSection();
        var buildFileReferenceSection = project.pbxFileReferenceSection();

        function getBuildPhaseByTargetName(targetName) {
            var key = project.findTargetKey(targetName);
            var buildPhase = project.pbxSourcesBuildPhaseObj(key);

            return buildPhase;
        }

        this.sync = function(sourceTargetName, destinationTargetName) {
            var sourceBuildPhase = getBuildPhaseByTargetName(sourceTargetName);
            var destinationBuildPhase = getBuildPhaseByTargetName(destinationTargetName);

            // remove all build-files from the destination-target
            destinationBuildPhase.files.forEach(function(file, index) {
                delete buildFileSection[file.value];
                delete buildFileSection[file.value + '_comment'];
            });

            // reset destination build phase files.
            destinationBuildPhase.files = [];

            // create new "build-files" for Beta
            sourceBuildPhase.files.forEach(function(file, index) {
                var newID = project.generateUuid();
                var buildFile = buildFileSection[file.value];
                var adjusted = extend({}, file, {value: newID});

                // add file to build section
                buildFileSection[newID] = buildFile;

                // add file to "beta" build phase
                destinationBuildPhase.files.push(adjusted);
            });
        };
    }

    var syncer = new BuildPhaseSyncer();
    syncer.sync('TargetSync', '"TargetSync Beta"');

    var backupDirectory = path.dirname(filePath);
    var backupFileName = path.basename(filePath) + '.orig';
    var backupFilePath = path.join(backupDirectory, backupFileName);

    fs.renameSync(filePath, backupFilePath);
    fs.writeFileSync(filePath, project.writeSync());
});
