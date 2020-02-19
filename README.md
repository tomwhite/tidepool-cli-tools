
# Tidepool CLI tools

## Loading historical FreeStyle Libre data into Tidepool

Tidepool has an excellent tool for [uploading data from a FreeStyle Libre reader device](https://support.tidepool.org/hc/en-us/articles/360029685031-Uploading-your-Abbott-FreeStyle-Libre). You simple connect the reader to your machine with a USB cable and it will upload all the data stored in the reader.

I had old data that I had exported from my reader that predates my use of Tidepool, and I wanted to upload it to Tidepool. The tools in this repository make this possible. Even if you don't have this need, the tools here may be useful for querying your data in Tidepool.

__Note that the tools here have had minimal testing and therefore may not work for your data. Always test any commands that modify data on a non-production server first.__

### Installation

To run the tools in this repository you will need to install [Node.js](https://nodejs.org/).

Then install the dependencies with

```bash
npm install
```

### Basic usage

Test connectivity by running the `time` command. This does not require an account and just contacts the Tidepool API.

```bash
$ node index.js time
2020-02-20T11:41:30.736Z
```

Test that you can retrieve some user data from Tidepool. This does require an account, so you will need to supply your username and password on the command line.

This will print all the entries (in JSON format) since midnight:

```bash
node index.js --username <username> --password <password> --start-date $(date '+%Y-%m-%dT00:00:00.000Z') show
```

If you have `jq` installed (`brew install jq` on a Mac), then you can query the output. E.g. 

```bash
node index.js --username <username> --password <password> --start-date $(date '+%Y-%m-%dT00:00:00.000Z') show > out.json
cat out.json | jq '. | map(select(.type == ("cbg", "smbg"))) | length' # number of BG readings
cat out.json | jq '. | map(select(.type == ("upload")))' # uploads (useful for getting dataset IDs)
cat out.json | jq '. | map(select(.type == ("cbg")))[].time' | sort | sed -n '1p;$p' # find time of first and last CBG reading
```

### Connecting to a different Tidepool server

Rather than connecting to the main production Tidepool server, you can use a different API endpoint, such as a local development server, or https://int-api.tidepool.org.

```bash
node index.js time --host 'https://int-api.tidepool.org' --upload-api 'https://int-uploads.tidepool.org' --data-host 'https://int-api.tidepool.org'
2020-02-20T11:41:30.736Z
```

### FreeStyle Libre reader exports

Data can be exported from the FreeStyle Libre reader as a TSV (tab-separated values) file. I do this periodically as a backup, and since the reader only holds 90 days of readings.

The files inevitably have duplicates (since each export contains everything in the reader), so I use the following bash command to merge and dedupe all the TSV files.

```bash
tmp=(*.tsv)
head -2 "${tmp[0]}" > data/libre-merged.tsv
python dedupe.py *.tsv | sed '/^$/d' | sort -t $'\t' -k2 >> data/libre-merged.tsv
```

To find the first and last entry for each type of reading, use the following

`cbg` (Continuous BG)
```bash
cat data/libre-merged.tsv | awk -F $'\t' '{ if ($3 == 0) { print $2 } }' | sort | sed -n '1p;$p'
```

`smbg` (self-monitored BG)
```bash
cat data/libre-merged.tsv | awk -F $'\t' '{ if ($3 == 1) { print $2 } }' | sort | sed -n '1p;$p'
```

This can be useful to see the range of readings in the file, in case you need to restrict it to a given time range before uploading.

You can also split the file by reading type, e.g.

```bash
head -2 data/libre-merged.tsv > data/libre-merged-0.tsv
cat data/libre-merged.tsv | awk -F $'\t' '{ if ($3 == 0) { print } }' | sort -t $'\t' -k2 >> data/libre-merged-0.tsv
```

### Upload

The following command uploads the merged TSV file to Tidepool:

```bash
node index.js \
    --host 'https://int-api.tidepool.org' --upload-api 'https://int-uploads.tidepool.org' --data-host 'https://int-api.tidepool.org' \
    --username <username> --password <password> \
    --device-serial-number <device-serial-number> \
    --tsv <tsv> \
    upload
```

To check it worked, log into the Tidepool app on the web.

### Interacting with Tidepool using curl

You can do most things using the Javascript API to Tidepool, however occasionally you may need to call the REST API directly using curl.

The following is based on notes from https://support.tidepool.org/hc/en-us/articles/360019872811-Export-your-data/

First set a `HOST` environment variable:

```bash
HOST='int-api.tidepool.org'
```

Check the time:

```bash
curl -s -X GET "https://$HOST/v1/time" | python -m json.tool
```

Login:

```bash
EMAIL='...'
curl -v -X POST -u "$EMAIL" "https://$HOST/auth/login"
```

Type in your password, then set the `SESSION_TOKEN` and `USERID` environment variables (see https://support.tidepool.org/hc/en-us/articles/360019872811-Export-your-data/ for details).

```bash
SESSION_TOKEN='...'
USERID='...'
```

Download all data:

```bash
curl -s -X GET -H "x-tidepool-session-token: $SESSION_TOKEN" -H "Content-Type: application/json" "https://$HOST/data/$USERID" > data_download.json
```

All data after a given time:

```bash
curl -s -X GET -H "x-tidepool-session-token: $SESSION_TOKEN" -H "Content-Type: application/json" "https://$HOST/data/$USERID?startDate=2020-01-01T00:00:00.000Z" > data_download.json
```

Get the datasets for a given user. (Datasets are associated with uploads.)

```bash
curl -s -X GET -H "x-tidepool-session-token: $SESSION_TOKEN" -H "Content-Type: application/json" "https://$HOST/v1/users/$USERID/data_sets" | python -m json.tool
```

Delete the data associated with a given dataset. (This can be useful if you uploaded data using the CLI above, but want to delete it for some reason.)

Get the dataset ID from the previous command.

```bash
DATASETID='...'
curl -X DELETE -H "x-tidepool-session-token: $SESSION_TOKEN" -H "Content-Type: application/json" "https://$HOST/v1/datasets/$DATASETID"
```

Get the most recent record for a given device

```bash
DEVICEID='...'
curl -s -X GET -H "x-tidepool-session-token: $SESSION_TOKEN" -H "Content-Type: application/json" "https://$HOST/v1/users/$USERID/data_sets?deviceId=$DEVICEID&size=1" | python -m json.tool
```

### Running unit tests

```bash
npm test
```
