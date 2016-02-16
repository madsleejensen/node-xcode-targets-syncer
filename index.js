var xcode = require("xcode");
var fs = require("fs");
var extend = require("extend");
var path = require("path");

var filePath = 'data/TargetSync/TargetSync.xcodeproj/project.pbxproj';
var project = xcode.project(filePath);
project.parse(function(error, data) {
    var buildFileSection = project.pbxBuildFileSection();
        // addToPbxBuildFileSection  -- removeFromPbxBuildFileSection

    var buildFileReferenceSection = project.pbxFileReferenceSection();
        // addToPbxFileReferenceSection / removeFromPbxFileReferenceSection

    var targetKey = project.findTargetKey('TargetSync');
    var sourcesBuildPhase = project.pbxSourcesBuildPhaseObj(targetKey);

    var betaKey = project.findTargetKey('"TargetSync Beta"');
    var betaSourceBuildPhase = project.pbxSourcesBuildPhaseObj(betaKey);

    // remove all "build-files" from Beta.
    betaSourceBuildPhase.files.forEach(function(file, index) {
        delete buildFileSection[file.value];
        delete buildFileSection[file.value + '_comment'];
    });

    betaSourceBuildPhase.files = [];

    // create new "build-files" for Beta
    sourcesBuildPhase.files.forEach(function(file, index) {
        var newID = project.generateUuid();
        var buildFile = buildFileSection[file.value];
        var fileAdjusted = extend({}, file);
        fileAdjusted.value = newID;

        // add file to build section
        buildFileSection[newID] = buildFile;

        // add file to "beta" build phase
        betaSourceBuildPhase.files.push(fileAdjusted);
    });

    var backupDirectory = path.dirname(filePath);
    var backupFileName = path.basename(filePath) + '.orig';
    var backupFilePath = path.join(backupDirectory, backupFileName);

    fs.renameSync(filePath, backupFilePath);
    fs.writeFileSync(filePath, project.writeSync());
});
