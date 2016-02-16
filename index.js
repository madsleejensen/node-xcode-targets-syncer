const xcode = require("xcode");
const fs = require("fs");
const extend = require("extend");
const path = require("path");
const glob = require("glob");
const readline = require("readline");
const chalk = require("chalk");

glob("**/*.pbxproj", {follow: true}, function(error, files) {
    if (files.length == 0) {
        console.log("Unable to find any projects (*.xcodeproj)");
        return;
    }

    console.log("Found the following xcode projects:");
    console.log("");

    files.forEach(function(file, index) {
        console.log("    [%d] %s", (index+1), file);
    });

    console.log("");

    var rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question('What project would you like to target? ', (answer) => {
        var index = parseInt(answer);
        if (index < 1 || index > files.length) {
            console.log('Invalid value');
        }
        else {
            var project = xcode.project(files[index-1]);
            project.parse((error, data) => {
                var targets = project.pbxNativeTargetSection();
                var filtered = [];

                Object.keys(targets).forEach((key, index) => {
                    var target = targets[key];
                    if (target.name) {
                        filtered.push(target);
                    }
                });

                console.log("");

                filtered.forEach((target, index) => {
                    console.log("    [%d] %s", (index+1), target.name);
                });

                console.log("");

                rl.question('Choose target to copy from: ', (answer) => {

                    rl.question('Choose a target to override: ', (answer) => {

                        console.log("    [1] Source files");
                        console.log("    [2] Frameworks");
                        console.log("    [3] Resources");
                        console.log("    [4] All");

                        rl.question('What would you like to sync: ', (answer) => {
                            
                        });
                    });

                });
            });
        }

        // rl.close();
    });
});

function sync(projectFilePath) {
  var project = xcode.project(projectFilePath);
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
                  var sourceBuildFile = buildFileSection[file.value];
                  var newBuildPhaseFile = extend({}, file, {value: newID});

                  // add file to build section (same file-ref but using a new id)
                  buildFileSection[newID] = extend({}, sourceBuildFile);

                  // add build-file reference to the destination build phase files.
                  destinationBuildPhase.files.push(newBuildPhaseFile);
              });
          };
      }

      var syncer = new BuildPhaseSyncer();
      syncer.sync('TargetSync', '"TargetSync Beta"');

      var backupDirectory = path.dirname(projectFilePath);
      var backupFileName = path.basename(projectFilePath) + '.orig';
      var backupFilePath = path.join(backupDirectory, backupFileName);

      fs.renameSync(projectFilePath, backupFilePath);
      fs.writeFileSync(projectFilePath, project.writeSync());
  });
}
