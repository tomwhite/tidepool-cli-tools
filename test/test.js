const assert = require('assert');
const libre = require('../libre.js')

const deviceId = "AbbottFreeStyleLibre-JCMY846-K1284";

describe('parseLibreLine', function() {
    it('should return historical cbg reading', function() {
        assert.deepEqual(libre.parseLibreLine({
            Time: '2019/11/05 18:48',
            'Record Type': '0',
            'Historic Glucose (mmol/L)': 4.2
        }, deviceId), {
            type: "cbg",
            value: 4.2,
            units: 'mmol/L',
            conversionOffset: 0,
            deviceTime: "2019-11-05T18:48:00",
            time: "2019-11-05T18:48:00+00:00",
            timezoneOffset: 0,
            deviceId: deviceId
        });
    });
});

describe('parseLibreLine', function() {
    it('should return scanned smbg reading', function() {
        assert.deepEqual(libre.parseLibreLine({
            Time: '2019/11/05 18:48',
            'Record Type': '1',
            'Scan Glucose (mmol/L)': 4.2
        }, deviceId), {
            type: "smbg",
            subType: "scanned",
            value: 4.2,
            units: 'mmol/L',
            conversionOffset: 0,
            deviceTime: "2019-11-05T18:48:00",
            time: "2019-11-05T18:48:00+00:00",
            timezoneOffset: 0,
            deviceId: deviceId
        });
    });
});

describe('parseLibreLine', function() {
    it('should return (manual) smbg reading', function() {
        assert.deepEqual(libre.parseLibreLine({
            Time: '2019/11/05 18:48',
            'Record Type': '2',
            'Strip Glucose (mmol/L)': 4.2
        }, deviceId), {
            type: "smbg",
            value: 4.2,
            units: 'mmol/L',
            conversionOffset: 0,
            deviceTime: "2019-11-05T18:48:00",
            time: "2019-11-05T18:48:00+00:00",
            timezoneOffset: 0,
            deviceId: deviceId
        });
    });
});

describe('parseLibreLine', function() {
    it('should return null for unknown record type', function() {
        assert.equal(libre.parseLibreLine({
            Time: '2019/11/05 18:48',
            'Record Type': '6'
        }, deviceId), null);
    });
});

describe('parseLibreTsv', function() {
    it('should successfully parse tsv records', function(done) {
        libre.parseLibreTsv('test/libre-2018-09-12T1904-head.tsv', deviceId, function(readings) {
            assert.equal(readings.length, 8); // should ignore 9th record (type '6')
            assert.deepEqual(readings[0], {
                type: 'cbg',
                value: 6.4,
                units: 'mmol/L',
                conversionOffset: 0,
                deviceTime: '2018-06-19T13:18:00',
                time: '2018-06-19T13:18:00+01:00',
                timezoneOffset: -60,
                deviceId: deviceId
            });
            done();
        });
    });
});
