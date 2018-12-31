'use strict';

var path = require('path');
var crypto = require('crypto');
var _ = require('grunt').util._;

var DEFAULT_OPTIONS = {
    algorithm: 'md5',
    baseDir: './',
    encoding: 'utf8',
    length: 16,
};

module.exports = function(grunt) {

    grunt.registerMultiTask('cacheBust', 'Bust static assets from the cache using content hashing', function() {
        var opts = this.options(DEFAULT_OPTIONS);
        if( opts.baseDir.substr(-1) !== '/' ) {
            opts.baseDir += '/';
        }

        var discoveryOpts = {
            cwd: path.resolve(opts.baseDir),
            filter: 'isFile'
        };

        // Generate an asset map
        var assetMap = grunt.file
            .expand(discoveryOpts, opts.assets)
            .sort()
            .reverse()
            .reduce(hashFile, {});

        grunt.verbose.writeln('Assets found:', JSON.stringify(assetMap, null, 2));

        // don't just split on the filename, if the filename = 'app.css' it will replace
        // all app.css references, even to files in other dirs
        // so replace this:
        // "{file}"
        // '{file}'
        // ({file}) (css url(...))
        // /{file} (css url(...))
        // ={file}> (unquoted html attribute)
        // ={file}\s (unquoted html attribute fonllowed by more attributes)
        // "{file}\s (first entry of img srcset)
        // \s{file}\s (other entries of img srcset)
        // files may contain a querystring, so all with ? as closing too
        var replaceEnclosedBy = [
            ['"', '"'],
            ["'", "'"],
            ['(', ')'],
            ['=', '>'],
            ['=', ' '],
            ['"', ' '],
            [' ', ' ']
        ];

       // Go through each source file and replace them with busted file if available
        var map = opts.queryString ? {} : assetMap;
        var files = getFilesToBeRenamed(this.files, map, opts.baseDir);
        files.forEach(replaceInFile);
        grunt.log.ok(files.length + ' file' + (files.length !== 1 ? 's ' : ' ') + 'busted.');

        function replaceInFile(filepath) {
            var markup = grunt.file.read(filepath);
            var baseDir = discoveryOpts.cwd + '/';
            var relativeFileDir = path.dirname(filepath).substr(baseDir.length);
            var fileDepth = 0;

            if (relativeFileDir !== '') {
                fileDepth = relativeFileDir.split('/').length;
            }

            var baseDirs = filepath.substr(baseDir.length).split('/');

            _.each(assetMap, function(hashed, original) {
                var replace = [
                    // abs path
                    ['/' + original, '/' + hashed],
                    // relative
                    [grunt.util.repeat(fileDepth, '../') + original, grunt.util.repeat(fileDepth, '../') + hashed],
                ];
                // find relative paths for shared dirs
                var originalDirParts = path.dirname(original).split('/');
                for (var i = 1; i <= fileDepth; i++) {
                    var fileDir = originalDirParts.slice(0, i).join('/');
                    var baseDir = baseDirs.slice(0, i).join('/');
                    if (fileDir === baseDir) {
                        var originalFilename = path.basename(original);
                        var hashedFilename = path.basename(hashed);
                        var dir = grunt.util.repeat(fileDepth - 1, '../') + originalDirParts.slice(i).join('/');
                        if (dir.substr(-1) !== '/') {
                            dir += '/';
                        }
                        replace.push([dir + originalFilename, dir + hashedFilename]);
                    }
                }
                //remove old query string
                    _.each(replace, function (r) {
                        var original = r[0];
                        _.each(replaceEnclosedBy, function (reb) {
                            markup = markup.split(new RegExp(reb[0] + original + "[\?]+[0-9A-Fa-f]+" + reb[1])).join(reb[0] + original + reb[1]);
                        });
                    });

                _.each(replace, function(r) {
                    var original = r[0];
                    var hashed = r[1];
                    _.each(replaceEnclosedBy, function(reb) {
                        markup = markup.split(reb[0] + original + reb[1]).join(reb[0] + hashed + reb[1]);
                    });
                });
            });

            grunt.file.write(filepath, markup);
        }

        function hashFile(obj, file) {
            var absPath = path.resolve(opts.baseDir, file);
            var hash = generateFileHash(grunt.file.read(absPath, {
                encoding: null
            }));
            var newFilename = addFileHash(file, hash);

            obj[file] = newFilename;

            return obj;
        }

        function generateFileHash(data) {
            return opts.hash || crypto.createHash(opts.algorithm).update(data, opts.encoding).digest('hex').substring(0, opts.length);
        }

        function addFileHash(str, hash) {
           return str + '?' + hash;
        }

        function getFilesToBeRenamed(files, assetMap, baseDir) {
            var originalConfig = files[0].orig;
            // check if fully specified filenames have been busted and replace with busted file
            var baseDirResolved = path.resolve(baseDir) + '/';
            var cwd = process.cwd() + '/';
            originalConfig.src = originalConfig.src.map(function(file) {
                if( assetMap ) {
                    var files = [file];
                    if(path.resolve(cwd + file).substr(0, baseDirResolved.length) === baseDirResolved) {
                        files.push(path.resolve(cwd + file).substr(baseDirResolved.length));
                    }
                    var result;
                    files.forEach(function(file2) {
                        var fileResolved = path.resolve(baseDirResolved + file2);
                        if (!result && fileResolved.substr(0, baseDirResolved.length) === baseDirResolved && (fileResolved.substr(baseDirResolved.length)) in assetMap) {
                            result = assetMap[fileResolved.substr(baseDirResolved.length)];
                            // if original file had baseDir at the start, make sure it's there now
                            var baseDirNormalized = path.normalize(baseDir);
                            if(path.normalize(file).substr(0, baseDirNormalized.length) === baseDirNormalized) {
                                result = baseDir + result;
                            }
                        }
                    });
                    if(result) {
                        return result;
                    }
                }
                return file;
            });

            return grunt.file
                .expand(originalConfig, originalConfig.src)
                .map(function(file) {

                    grunt.verbose.writeln('Busted:', file);
                    return path.resolve((originalConfig.cwd ? originalConfig.cwd + path.sep : '') + file);
                });
        }

    });

};
