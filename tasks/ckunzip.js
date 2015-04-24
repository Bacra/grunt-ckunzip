var path	= require('path');
var Zip		= require('jszip');
var fs		= require('fs');

function echo(a) {return a;}
function noop(){}

module.exports = function(grunt) {

	var _ = grunt.util._;

	function syncUtimes(file, stat) {
		try {
			var fd = fs.openSync(file, 'a');
			fs.futimesSync(fd, stat.atime, stat.mtime);
			fs.closeSync(fd);
		} catch(err) {
			grunt.log.error('sync utimes err %s %o', file, err);
		}
	}


	grunt.registerMultiTask('ckunzip', 'check before unzip', function() {
		// Collect the filepaths we need
		var options = this.options({
				checkExists	: false,
				checkCRC32	: true,
				router		: echo,
				check		: false
			});

		// Iterate over the srcFiles
		var filesWritten = false;
		var check = options.check;
		var router = options.router;

		// generate checker
		if (check === false) {
			check = noop;
		} else if (!_.isFunction(check)) {
			// check zip doos need expand
			check = function(file) {
				if (file.slice(-1) == '~') return false;

				var ostat = fs.statSync(file);
				var ckfile = file+'~';

				if (grunt.file.exists(ckfile)) {
					var ckstat = fs.statSync(ckfile);
					// ignore 1000ms
					if (Math.abs(ostat.mtime.getTime() - ckstat.mtime.getTime()) < 1000) return false;
				}

				syncUtimes(ckfile, ostat);
			}
		}


		// each all src
		this.files.forEach(function(files) {
			var dest = files.dest;

			files.src.forEach(function(src) {
				if (!grunt.file.isFile(src)) return;

				if (check(src) === false) {
					grunt.log.writeln('Ignore "' + src + '"');
					return;
				}

				var zip = new Zip(fs.readFileSync(src), {checkCRC32: options.checkCRC32});
				var zipFiles = zip.files;

				// filename each
				Object.getOwnPropertyNames(zipFiles).forEach(function(filename) {
					var fileObj = zipFiles[filename],
						content = fileObj.asNodeBuffer(),
						routedName = router(filename);

					// If there is a file path (allows for skipping)
					if (routedName) {
						// Determine the filepath
						var filepath = path.join(dest, routedName);
						filesWritten = true;

						// If the routedName ends in a `/`, treat it as a/an (empty) directory
						// DEV: We use `/` over path.sep since it is consistently `/` across all platforms
						if (routedName.slice(-1) === '/') {
							grunt.verbose.writeln('Creating directory: "' + filepath + '"');
							grunt.file.mkdir(filepath);
						} else {
							// Create the destination directory
							var fileDir = path.dirname(filepath);

							// Write out the content
							grunt.verbose.writeln('Writing file: "' + filepath + '"');
							grunt.file.mkdir(fileDir);
							fs.writeFileSync(filepath, content);
						}
					}
				});
			});
		});
		

		// Fail task if errors were logged.
		if (this.errorCount) { return false; }

		// Otherwise, print a success message.
		if (filesWritten) {
			grunt.log.writeln('success');
		} else {
			grunt.log.writeln('No files were found in source. ');
		}
	});
};
