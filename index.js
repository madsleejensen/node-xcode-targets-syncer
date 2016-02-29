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

                var sources = new SourcesBuildPhaseSyncer(project, answers.source, answers.destination);

                switch (answers.sync) {
                    case 'files':
                        sources.syncFiles();
                        break;

                    case 'frameworks':
                        sources.syncFrameworks();
                        break;

                    case 'resources':
                        sources.syncResources();
                        break;

                    case 'all':
                        sources.syncFiles();
                        sources.syncFrameworks();
                        sources.syncResources();
                        break;
                }

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

    getSourceTargetKey() {
        return this.project.findTargetKey(this.sourceTarget.name);
    }

    getOverrideTargetKey() {
        return this.project.findTargetKey(this.overrideTarget.name);
    }

    syncFiles() {
        var sourcePhase = this.project.pbxSourcesBuildPhaseObj( this.getSourceTargetKey() );
        var overridePhase = this.project.pbxSourcesBuildPhaseObj( this.getOverrideTargetKey() );

        this.syncPhases(sourcePhase, overridePhase);

        // @todo console.log diff's ... added / removed
    }

    syncFrameworks() {
        var sourcePhase = this.project.pbxFrameworksBuildPhaseObj( this.getSourceTargetKey() );
        var overridePhase = this.project.pbxFrameworksBuildPhaseObj( this.getOverrideTargetKey() );

        this.syncPhases(sourcePhase, overridePhase);
    }

    syncResources() {
        var sourcePhase = this.project.pbxResourcesBuildPhaseObj( this.getSourceTargetKey() );
        var overridePhase = this.project.pbxResourcesBuildPhaseObj( this.getOverrideTargetKey() );

        this.syncPhases(sourcePhase, overridePhase);
    }

    syncPhases(sourcePhase, overridePhase) {
        // remove all build-files from the override-target
        this.resetBuildPhaseFiles(overridePhase.files);

        // reset override build phase files.
        overridePhase.files = this.duplicatePhaseFiles(sourcePhase.files);
    }

    /**
     * Takes a collection of build-phase-files and remove them from the "build-section"
     */
    resetBuildPhaseFiles(buildPhaseFiles) {
        buildPhaseFiles.forEach(phaseFile => {
            // remove files from "build-file" section
            delete this.buildFileSection[phaseFile.value];
            delete this.buildFileSection[phaseFile.value + '_comment'];
        })
    }

    /**
     * Duplicates a phase-files collection, with all entries assigned new file-id's.
     */
    duplicatePhaseFiles(phaseFiles) {
        var newPhaseFiles = [];

        phaseFiles.forEach(phaseFile => {
            var newID = this.project.generateUuid();
            var buildFile = this.buildFileSection[phaseFile.value];

            // clone phase-file, but override the "id"
            var duplicatePhaseFile = extend({}, phaseFile, {value: newID});

            // add file to build section (same file-ref but using a new id)
            this.buildFileSection[newID] = extend({}, buildFile);

            // add build-file to phase file list.
            newPhaseFiles.push(duplicatePhaseFile);
        });

        return newPhaseFiles;
    }
}
