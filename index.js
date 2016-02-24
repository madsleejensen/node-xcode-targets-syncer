"use strict"

const xcode = require("xcode");
const fs = require("fs");
const extend = require("extend");
const path = require("path");
const glob = require("glob");
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
        name: 'path',
        message: 'What project would you like to target?',
        choices: files
    }];

    // ask user to select a project file.
    inquirer.prompt(question, (projectsAnswer) => {

        var project = xcode.project(projectsAnswer.path);
        project.parse((error, data) => {

            var targets = project.pbxNativeTargetSection();
            var filtered = [];

            // filter out "_comment" targets from the list
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
                    message: 'Choose target to copy ' + chalk.bold.underline.yellow("from"),
                    choices: filtered
                },
                {
                    type: 'rawlist',
                    name: 'destination',
                    message: 'Choose a target to ' + chalk.bold.underline.yellow("override"),
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

                switch (answers.sync) {
                    case 'files':

                        var sources = new SourcesBuildPhaseSyncer(project, answers.source, answers.destination);
                        sources.syncFiles();

                        break;

                    case 'frameworks':

                        break;

                    case 'resources':

                        break;

                    case 'all':


                        break;
                }
                */

                var syncer = new SourcesBuildPhaseSyncer(project, answers.source, answers.destination);
                syncer.syncFiles();

                var backupDirectory = path.dirname(projectsAnswer.path);
                var backupFileName = path.basename(projectsAnswer.path) + '.orig';
                var backupFilePath = path.join(backupDirectory, backupFileName);

                fs.renameSync(projectsAnswer.path, backupFilePath);
                fs.writeFileSync(projectsAnswer.path, project.writeSync());
            });

        });
    });
});


class SourcesBuildPhaseSyncer {

    constructor(project, sourceTarget, overrideTarget) {
        this.project = project;
        this.sourceTarget = sourceTarget;
        this.overrideTarget = overrideTarget;

        this.buildFileSection = project.pbxBuildFileSection();
        this.buildFileReferenceSection = project.pbxSourcesBuildPhaseObj();
    }

    getSourcesBuildPhaseByTarget(target) {
        var targetKey = this.project.findTargetKey(target.name);
        var buildPhase = this.project.pbxSourcesBuildPhaseObj(targetKey);
        return buildPhase;
    }

    syncFiles() {
        var sourceBuildPhase = this.getSourcesBuildPhaseByTarget(this.sourceTarget);
        var overrideBuildPhase = this.getSourcesBuildPhaseByTarget(this.overrideTarget);

        // remove all build-files from the override-target
        overrideBuildPhase.files.forEach((file, index) => {
            delete this.buildFileSection[file.value];
            delete this.buildFileSection[file.value + '_comment'];
        });

        // reset override build phase files.
        overrideBuildPhase.files = [];

        // create new "build-files" for Beta
        sourceBuildPhase.files.forEach((file, index) => {
            var newID = this.project.generateUuid();
            var sourceBuildFile = this.buildFileSection[file.value];
            var newBuildPhaseFile = extend({}, file, {value: newID});

            // add file to build section (same file-ref but using a new id)
            this.buildFileSection[newID] = extend({}, sourceBuildFile);

            // add build-file reference to the destination build phase files.
            overrideBuildPhase.files.push(newBuildPhaseFile);
        });

        // @todo console.log diff's ... added / removed / modified. 
    }
}
