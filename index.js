import fs from 'fs';
import delay from 'delay';

/* PRIVATE */

/*
  /proc/diskstats

  https://www.kernel.org/doc/Documentation/iostats.txt

  Each set of stats only applies to the indicated device; if you want
  system-wide stats you'll have to find all the devices and sum them all up.

  Field  1 -- # of reads completed
      This is the total number of reads completed successfully.
  Field  2 -- # of reads merged, field 6 -- # of writes merged
      Reads and writes which are adjacent to each other may be merged for
      efficiency.  Thus two 4K reads may become one 8K read before it is
      ultimately handed to the disk, and so it will be counted (and queued)
      as only one I/O.  This field lets you know how often this was done.
  Field  3 -- # of sectors read
      This is the total number of sectors read successfully.
  Field  4 -- # of milliseconds spent reading
      This is the total number of milliseconds spent by all reads (as
      measured from __make_request() to end_that_request_last()).
  Field  5 -- # of writes completed
      This is the total number of writes completed successfully.
  Field  6 -- # of writes merged
      See the description of field 2.
  Field  7 -- # of sectors written
      This is the total number of sectors written successfully.
  Field  8 -- # of milliseconds spent writing
      This is the total number of milliseconds spent by all writes (as
      measured from __make_request() to end_that_request_last()).
  Field  9 -- # of I/Os currently in progress
      The only field that should go to zero. Incremented as requests are
      given to appropriate struct request_queue and decremented as they finish.
  Field 10 -- # of milliseconds spent doing I/Os
      This field increases so long as field 9 is nonzero.
  Field 11 -- weighted # of milliseconds spent doing I/Os
      This field is incremented at each I/O start, I/O completion, I/O
      merge, or read of these stats by the number of I/Os in progress
      (field 9) times the number of milliseconds spent doing I/O since the
      last update of this field.  This can provide an easy measure of both
      I/O completion time and the backlog that may be accumulating.
*/

// @NOTE: sourced from `https://github.com/soldair/node-procfs-stats/blob/feca2a940805b31f9e7d5c0bd07c4e3f8d3d5303/index.js#L228`
const _parseProcDiskstats = () => {
  var diskstats = fs.readFileSync('/proc/diskstats');
  var lines = diskstats.toString().trim().split('\n');
  var data = {};

  lines.forEach(function (line) {
    var values = line.trim().split(/\s+/);
    data[values[2]] = {
      deviceNumber: values[0],
      deviceNumberMinor: values[1],
      readsCompleted: values[3],
      readsMerged: values[4],
      sectorsRead: values[5],
      msReading: values[6],
      writesCompleted: values[7],
      writesMerged: values[8],
      sectorsWritten: values[9],
      msWriting: values[10],
      iosPending: values[11],
      msIo: values[12],
      msWeightedIo: values[13],
    };
  });

  return data;
};

const _bytesTo = (bytes, units) => {
  const KiB = 1024;
  const MiB = 1024 * KiB;
  const GiB = 1024 * MiB;

  const converted = {
    bytes,
    KiB: bytes /= KiB,
    MiB: bytes /= MiB,
    GiB: bytes /= GiB
  }[units];

  //NOTE: the variable named `bytes` may not actually contain a number
  //representing the number of bytes. its done this way to only have to use one
  //variable.
  return converted || console.log(`'[disk-stats] Error: Unknown units "${units}", use one of: "bytes" (default), "KiB", "MiB" or "GiB"';`);
}

/* PUBLIC */

// @NOTE: get sector size in bytes: `sudo hdparm -I /dev/sda | grep Physical`
// @NOTE: get sector size in bytes: `cat /sys/block/sda/queue/physical_block_size`
export const usageRead = opts => {
  // Defaults
  opts.sectorSizeBytes = opts.sectorSizeBytes || 512;
  opts.sampleMs = opts.sampleMs || 1000;
  opts.device =  opts.device || 'sda';
  opts.units =  opts.units || 'bytes';

  let time;
  let delta1;
  let delta0 = _parseProcDiskstats()[opts.device].sectorsRead;
  time = process.hrtime();
  return new Promise(async resolve => {
    await delay(opts.sampleMs);

    delta1 = _parseProcDiskstats()[opts.device].sectorsRead;

    const diff = process.hrtime(time);
    const diffSeconds = diff[0] + diff[1] * 1e-9;

    const totalBytes = (delta1 - delta0) * opts.sectorSizeBytes;
    const totalBytesPerSecond = totalBytes / (diffSeconds * diffSeconds);
    const converted = _bytesTo(totalBytesPerSecond, opts.units);

    return resolve(converted);
  });
};

export const usageWrite = opts => {
  opts.sectorSizeBytes = opts.sectorSizeBytes || 512;
  opts.sampleMs = opts.sampleMs || 1000;
  opts.device =  opts.device || 'sda';
  opts.units =  opts.units || 'bytes';

  let time;
  let delta1;
  let delta0 = _parseProcDiskstats()[opts.device].sectorsWritten;
  time = process.hrtime();
  return new Promise(async resolve => {
    await delay(opts.sampleMs);
    delta1 = _parseProcDiskstats()[opts.device].sectorsWritten;

    const diff = process.hrtime(time);
    const diffSeconds = diff[0] + diff[1] * 1e-9;

    const totalBytes = (delta1 - delta0) * opts.sectorSizeBytes;
    const totalBytesPerSecond = totalBytes / (diffSeconds * diffSeconds);
    const converted = _bytesTo(totalBytesPerSecond, opts.units);

    return resolve(converted);
  });
};

export const raw = () => {
  return _parseProcDiskstats();
};

export default {
  usageRead,
  usageWrite,
  raw
}