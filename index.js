const async = require('async');
const createTidepoolClient = require('tidepool-platform-client');
const libre = require('./libre.js');
const moment = require('moment');
const program = require('commander');

const BLOCKSIZE = 1000;

function callbackNoop(err, response) {
    // ignore err and response
}

function callbackLogger(err, response) {
    if (program.verbose) {
        if (err != null) {
            console.warn(err);
        }
        if (response != null) {
            console.warn(response);
        }    
    }
}

function newDatasetInfo(deviceSerialNumber) {
    const now = new Date();
    const computerTime = moment(now).format("YYYY-MM-DDTHH:mm:ss");
    const time = moment(now).format("YYYY-MM-DDTHH:mm:ssZ");
    const timezone = "Europe/London";
    const timezoneOffset = now.getTimezoneOffset();
    return {
        client: {
            name: "com.tom-e-white.tidepool",
            version: "0.1.0",
        },
        deviceId: "AbbottFreeStyleLibre-" + deviceSerialNumber,
        deviceManufacturers: [
            "Abbott"
        ],
        deviceModel: "FreeStyle Libre",
        deviceSerialNumber: deviceSerialNumber,
        deviceTags: [
            "bgm",
            "cgm"
        ],
        computerTime: computerTime,
        conversionOffset: 0,
        time: time,
        timezone: timezone,
        timezoneOffset: timezoneOffset,
        timeProcessing: "utc-bootstrapping",
        type: "upload",
        version: "0.1.0"
    }
}

// Get the server time (no need to log in).
function printServerTime(tidepool) {
    tidepool.getTime(function(err, response) {
        callbackLogger(err, response);
        console.log(response.data.time);
    });
}

// Retrieve all the device data for a user between the given dates (may be undefined).
// The dates must be in ISO 8601 format.
function printDeviceDataForUser(tidepool, user, startDate, endDate) {
    tidepool.login(user, {}, function(err, response) {
        callbackLogger(err, response);
        const userId = response.userid;
        const options = {};
        if (startDate != null) {
            options.startDate = startDate;
        }
        if (endDate != null) {
            options.endDate = endDate;
        }
        tidepool.getDeviceDataForUser(userId, options, function(err2, response2) {
            callbackLogger(err2, response2);
            process.stdout.write(JSON.stringify(response2, null, 2) + '\n');
            tidepool.logout(callbackNoop);
            process.exit();
        });
    });
}

// Upload a batch of device data for a user.
function uploadDeviceDataForUser(tidepool, user, data, deviceSerialNumber) {
    tidepool.login(user, {}, function(err, response) {
        const userId = response.userid;
        const datasetInfo = newDatasetInfo(deviceSerialNumber);
        tidepool.createDatasetForUser(userId, datasetInfo, function(err2, response2) {
            callbackLogger(err2, response2);
            const datasetId = response2.data.id;

            // Upload one block of data at a time (like https://github.com/tidepool-org/uploader)
            const blocks = [];
            for (let i = 0; i < data.length; i += BLOCKSIZE) {
                blocks.push(data.slice(i, i + BLOCKSIZE));
            }
            async.mapSeries(blocks, function(block, callback) {
                console.log("Uploading block...");
                tidepool.addDataToDataset(datasetId, block, function(err3, response3) {
                    console.log("... done uploading block");
                    if (err3 != null) {
                        console.warn(err3);
                    }
                    callbackLogger(err3, response3);
                    callback(err3, response3);
                });
            }, function(err4, result) {
                callbackLogger(err4, result);
                if (err4 != null) {
                    console.warn(err4);
                } else {
                    tidepool.finalizeDataset(datasetId, function(err4, response4) {
                        tidepool.logout(callbackNoop);
                        process.exit();
                    });    
                }
            });
        });
    });
}

program
    .version('0.1.0')
    .option('-v, --verbose', 'run with verbose logging')
    .option('--host <url>', 'Tidepool API endpoint', 'https://api.tidepool.org')
    .option('--upload-api <url>', 'Tidepool upload API endpoint', 'https://uploads.tidepool.org')
    .option('--data-host <url>', 'Tidepool data API endpoint', 'https://api.tidepool.org')
    .option('--username <username>', 'Tidepool username')
    .option('--password <password>', 'Tidepool password')
    .option('--start-date <datetime>', 'only return entries after this date (date time string in ISO 8601 format)')
    .option('--end-date <datetime>', 'only return entries before this date (date time string in ISO 8601 format)')
    .option('--tsv <path>', 'TSV file exported from the FreeStyle Libre reader')
    .option('--device-serial-number <device-serial-number>', 'the FreeStyle Libre reader serial number')
    .parse(process.argv);

const command = program.args[0];
const user = program;

const tidepool = createTidepoolClient({
    host: program.host,
    uploadApi: program.uploadApi,
    dataHost: program.dataHost,
    log: {
      warn: function() {},
      info: function() {},
      debug: function() {}
    },
    metricsSource: 'com.tom-e-white.tidepool',
    metricsVersion: '0.1.0'
});

if (command === 'time') {
    printServerTime(tidepool);
} else if (command === 'show') {
    printDeviceDataForUser(tidepool, user, program.startDate, program.endDate);
} else if (command === 'parse') {
    const deviceId = "AbbottFreeStyleLibre-" + program.deviceSerialNumber;
    libre.parseLibreTsv(program.tsv, deviceId, function(readings) {
        process.stdout.write(JSON.stringify(readings, null, 2) + '\n');
    });
} else if (command === 'upload') {
    if (program.deviceSerialNumber == null) {
        console.warn("Please specify --device-serial-number");
    } else if (program.username == null) {
        console.warn("Please specify --username");
    } else if (program.password == null) {
        console.warn("Please specify --password");
    } else if (program.tsv == null) {
        console.warn("Please specify --tsv");
    } else {
        const deviceId = "AbbottFreeStyleLibre-" + program.deviceSerialNumber;
        libre.parseLibreTsv(program.tsv, deviceId, function(readings) {
            uploadDeviceDataForUser(tidepool, user, readings, program.deviceSerialNumber);
        });    
    }
} else {
    console.warn("Unrecognized command: " + command);
}
