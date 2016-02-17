const xcode = require("xcode");
const fs = require("fs");
const extend = require("extend");
const path = require("path");
const glob = require("glob");
const readline = require("readline");
const chalk = require("chalk");
const inquirer = require("inquirer");

function locateProjectsInPath(callback) {
    glob("**/*.pbxproj", {follow: true}, callback);
}

locateProjectsInPath((error, files) => {
    if (files.length == 0) {
        console.log("Unable to find any projects (*.pbxproj)");
        return;
    }

    var question = [{
        type: 'rawlist',
        name: 'project',
        message: 'What project would you like to target?',
        choices: files
    }];

    // ask user to select a project file.
    inquirer.prompt(question, (answers) => {

        var project = xcode.project(answers.project);
        project.parse((error, data) => {

            var targets = project.pbxNativeTargetSection();
            var filtered = [];

            Object.keys(targets).forEach((key, index) => {
                var target = targets[key];
                if (target.name) {
                    filtered.push(target);
                }
            });

            if (filtered.length < 2) {
                console.log('The selected project should have atleast two targets');
                return;
            }

            filtered = filtered.map(item => {
                return {
                    name: item.name,
                    value: item
                }
            });

            // ask user to select source / destination targets
            var questions = [
                {
                    type: 'rawlist',
                    name: 'source',
                    message: 'Choose target to copy from',
                    choices: filtered
                },
                {
                    type: 'rawlist',
                    name: 'destination',
                    message: 'Choose a target to override',
                    choices: function(answers) {
                        return filtered.filter(item => item.value !== answers.source);
                    }
                },
                {
                    type: 'rawlist',
                    name: 'sync',
                    message: 'What would you like to sync',
                    choices: [
                        {name: 'Source files', value: 'files'},
                        {name: 'Frameworks', value: 'frameworks'},
                        {name: 'Resources', value: 'resources'},
                        {name: 'Everything', value: 'all'}
                    ]
                }
            ];

            inquirer.prompt(questions, (answers) => {
                console.log(answers);
                /*
                var syncer = new BuildPhaseSyncer(project, answers.source, answers.destination);
                switch (answers.sync) {
                    case 'files':
                        syncer.syncFiles();
                        break;

                    case 'frameworks':
                        syncer.syncFrameworks();
                        break;

                    case 'resources':
                        syncer.syncResources();
                        break;

                    case 'all':
                        syncer.syncAll();
                        break;
                }
                */
            });

        });
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
