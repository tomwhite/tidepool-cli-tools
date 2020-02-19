const csv = require('csv-parser');
const fs = require('fs');
const moment = require('moment');

function createReading(dt, type, subType, value, units, deviceId) {
    // TODO: it is not clear what timezone the Libre timestamps are in
    const deviceTime = dt.format("YYYY-MM-DDTHH:mm:ss");
    const time = dt.format("YYYY-MM-DDTHH:mm:ssZ");
    const timezoneOffset = dt.toDate().getTimezoneOffset();
    const reading = {
        type: type,
        value: value,
        units: units,
        conversionOffset: 0,
        deviceTime: deviceTime,
        time: time,
        timezoneOffset: timezoneOffset,
        deviceId: deviceId
    };
    if (subType != null) {
        reading.subType = subType;
    }
    return reading;
}

function parseLibreLine(line, deviceId) {
    const time = moment(line.Time.replace(/\//g, '-'));
    const units = "mmol/L";
    let value = null;
    let type = null;
    let subType = null;
    switch (line['Record Type']) {
        // Values for type and subType below are consistent with those in https://github.com/tidepool-org/uploader for FreeStyle Libre
        case '0':
            value = parseFloat(line['Historic Glucose (mmol/L)']);
            type = "cbg";
            // no subType
            break;
        case '1':
            value = parseFloat(line['Scan Glucose (mmol/L)']);
            type = "smbg";
            subType = "scanned";
            break;
        case '2':
            value = parseFloat(line['Strip Glucose (mmol/L)']);
            type = "smbg";
            // absence of subType means "meter" in this case
            break;
        default:
            // unsupported record type: skip
            return null;
    }
    return createReading(time, type, subType, value, units, deviceId);
}

// Parse a TSV file from a FreeStyle Libre
function parseLibreTsv(tsv, deviceId, callback) {
    const readings = [];
    fs.createReadStream(tsv)
        .pipe(csv({
            separator: '\t',
            skipLines: 1 // name of device owner
        }))
        .on('data', (line) => {
            const reading = parseLibreLine(line, deviceId);
            if (reading != null) {
                readings.push(reading);
            }
        })
        .on('end', () => {
            callback(readings);
        });
}

exports.parseLibreLine = parseLibreLine;
exports.parseLibreTsv = parseLibreTsv;
