var args = process.argv.slice(2),
    exec = require('child_process').exec,
    fs = require('fs'),
    semver = require('semver'),
    promise = require('promise'),
    manifests = [{path: './package.json'}, {path: './bower.json'}],
    newVersion;

function updateVersions() {
    manifests.forEach(function (manifest) {
        manifest.data = require(manifest.path);
        manifest.oldVersion = manifest.data.version;
    });

    if (!args[0])
        return Promise.reject(manifests.map(function (manifest) {
            return [manifest.path, manifest.oldVersion];
        }));

    newVersion = semver.valid(args[0]) || semver.inc(manifests[0].data.version, args[0]);

    manifests.forEach(function (manifest) {
        manifest.data.version = newVersion;
    });

    return Promise.all(manifests.map(function (manifest) {
        return new Promise(function (resolve, reject) {
            fs.writeFile(manifest.path, JSON.stringify(manifest.data, null, 2), function (err) {
                if (err) return reject(err);
                resolve();
            });
        });
    }));
}

function cmd(command) {
    return new Promise(function (resolve, reject) {
        exec(command, function (err, stdout, stderr) {
            if (err) return reject(err);
            if (stderr) return reject(stderr);
            console.log(stdout);
            resolve(stdout);
        });
    });
}

function getBranch() {
    return cmd('git branch');
}

function status() {
    return cmd('git status -s');
}

function checkout(branch) {
    return cmd('git checkout ' + branch);
}

function commit(message) {
    return cmd('git commit -a -m ' + message);
}

function push() {
    return cmd('git push');
}

function merge(fromBranch) {
    return cmd('git merge ' + fromBranch);
}

function tag(tagName) {
    return cmd('git tag ' + tagName);
}

function pushTags() {
    return cmd('git push --tags');
}

status()
    .then(function (status) {
        return (status && status.length) ? Promise.reject('There are uncommitted changes.') : getBranch();
    })
    .then(function (branch) {
        if (branch !== '* master\n')
            return checkout('master');
    })
    .then(function () {
        return updateVersions();
    })
    .then(function () {
        return commit('v' + newVersion);
    })
    .then(function () {
        return push();
    })
    .then(function () {
        return checkout('release/beta');
    })
    .then(function () {
        return merge('master');
    })
    .then(function () {
        return push();
    })
    .then(function () {
        return checkout('release/production');
    })
    .then(function () {
        return merge('release/beta');
    })
    .then(function () {
        return push();
    })
    .then(function () {
        return tag('v' + newVersion);
    })
    .then(function () {
        return pushTags();
    })
    .then(function () {
        return checkout('master');
    })
    .catch(function (err) {
        console.error(err);
    });
