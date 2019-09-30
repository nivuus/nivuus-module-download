/*
 * Copyright 2019 Allanic.me ISC License License
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 * Created by mallanic <maxime@allanic.me> at 18/08/2019
 */

const Aria2 = require("aria2");
const $lodash = require('lodash');
const $fs = require('fs');
const $path = require('path');

const SessionPath = '/usr/share/aria2-session'
if (!$fs.existsSync(SessionPath))
    $fs.writeFileSync(SessionPath, '');

module.exports = {
    systemPackages: 'aria2',
    systemServices: `aria2c --enable-rpc --rpc-listen-all=true --rpc-allow-origin-all --save-session=${SessionPath} --input-file=${SessionPath} --allow-overwrite=true --save-session-interval=2`,
    translationPath: './translation',
    pages: {
        '/download': {
            title: '.TITLE',
            templateFile: './index.html',
            controller: function ($utils) {
                var downloadCtrl = this;
                const aria2 = new Aria2();



                try {
                    aria2.open()
                        .then(() => {
                            downloadCtrl.refresh();
                            setInterval(() => {
                                downloadCtrl.refresh();
                            }, 2000);
                            aria2.on('onDownloadComplete', onDownloadComplete);
                            aria2.on('onBtDownloadComplete', onDownloadComplete);
                        }, console.error);


                } catch (e) {
                    console.error(e);
                }

                function onDownloadComplete(events) {
                    async function t(guid) {
                        var files = await aria2.call('getFiles', guid);
                        $lodash.forEach(files, (file) => {
                            var fileName = $path.basename(file.path);
                            var outputFile;
                            var match;
                            // It's a TV Show
                            if (match = fileName.match(/^([^\/]+)[\s-]*[Ss][\.]?(\d{1,2})[\s\.]*[Ee][Pp]?[\.]?(\d{1,3}).*\.(avi|AVI|mkv|MKV|mp4|MP4)$/)) {
                                var name = $lodash.capitalize($lodash.trim(match[1].replace(/[\.\-\s]+/, ' ')));
                                var season = parseInt(match[2]);
                                var episode = parseInt(match[3]);
                                var extension = $lodash.toLower(match[4]);
                                outputFile = `/media/data/TV Shows/${name}/Saison ${season}/${name} S${$lodash.padStart(season, 2)}E${$lodash.padStart(episode, 3)}.${extension}`;
                                var directory = $path.dirname(outputFile);
                                if (!$fs.existsSync(directory))
                                    $fs.mkdirSync(directory, {
                                        recursive: true
                                    });
                            }
                            // It's a Movie
                            else if (match = fileName.match(/^(?:\[[^\]]+\])?\s*((?:(?![0-9]{4}).)*)([0-9]{4}).*\.(avi|AVI|mkv|MKV|mp4|MP4)$/)) {
                                var name = $lodash.capitalize($lodash.trim(match[1].replace(/[\.\-\s]+/, ' ')));
                                var year = match[2];
                                var extension = $lodash.toLower(match[3]);
                                outputFile = `/media/data/Movies/${name} (${year}).${extension}`;
                            }

                            else {
                                outputFile = "/media/data/Downloads/${fileName}";
                            }

                            console.log(file.path, outputFile);
                            console.log("aria2 onDownloadComplete", guid);
                            $fs.copyFile(file.path, outputFile, () => {});

                        });
                    }


                    $lodash.forEach(events, (event) => t(event.gid).then(console.log, console.error));
                }


                downloadCtrl.refresh = async function () {
                    var downloads = [];
                    var actives = await aria2.call('tellActive');
                    $lodash.forEach(actives, (active) => {
                        active.progress = parseInt(active.completedLength) / parseInt(active.totalLength) * 100;
                        downloads.push(active);
                    });

                    var waitings = await aria2.call('tellWaiting', 0, 254);
                    $lodash.forEach(waitings, (waiting) => {
                        downloads.push(waiting);
                    });

                    var stoppeds = await aria2.call('tellStopped', 0, 254);
                    $lodash.forEach(stoppeds, (stopped) => {
                        downloads.push(stopped);
                    });

                    downloadCtrl.downloads = downloads;
                };

                downloadCtrl.add = async (files) => {
                    console.log(files);
                    $lodash.forEach(files, async (file) => {
                        let base64String = $utils.arrayBufferToBase64(file);
                        await aria2.call('addTorrent', base64String, [], {
                            dir: '/media/data/Downloads'
                        });
                    });
                    downloadCtrl.refresh();
                };

                downloadCtrl.pause = async (file) => {
                    await aria2.call('pause', file.gid);
                    downloadCtrl.refresh();
                };

                downloadCtrl.play = async (file) => {
                    await aria2.call('unpause', file.gid);
                    downloadCtrl.refresh();
                };

                downloadCtrl.remove = async (file) => {
                    await aria2.call('remove', file.gid);
                    downloadCtrl.refresh();
                };
            }
        }
    }
};