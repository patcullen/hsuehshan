
"use strict";

var sqlite3 = require('sqlite3').verbose(),
    fs = require('fs'),
    path = require('path'),
    parse = require('csv-parse'),
    xml2js = require('xml2js'),
    databaseName = 'hsuehshan.sql',
    dataDirectory = 'hsuehshan_data',
    vehicleDirectory = 'traffic',
    vehicleDetectorFilename = 'Traffic_Vehicle Detector_info.csv',
    deviceIds = null,
    db = new sqlite3.Database(databaseName)
    ;

// adapted from http://stackoverflow.com/users/716248/chjj on http://stackoverflow.com/questions/5827612/node-js-fs-readdir-recursive-directory-search
function walk(dir, done) {
  var results = [];
  fs.readdir(dir, function(err, list) {
    if (err) return done(err);
    var pending = list.length;
    if (!pending) return done(null, results);
    list.forEach(function(file) {
      file = path.resolve(dir, file);
      fs.stat(file, function(err, stat) {
        if (stat && stat.isDirectory()) {
          walk(file, function(err, res) {
            results = results.concat(res);
            if (!--pending) done(null, results);
          });
        } else {
          results.push(file);
          if (!--pending) done(null, results);
        }
      });
    });
  });
};

function createDatabase() {
  db.run('CREATE TABLE IF NOT EXISTS device (vdid TEXT, roadDir TEXT, roadNum TEXT, lng REAL, lat REAL, prev INT, next INT, prevDist INT, nextDist INT)');
  db.run('CREATE TABLE IF NOT EXISTS collection (rowid INT PRIMARY KEY, device INT, status SMALLINT, collectTime DATETIME, interval INT) WITHOUT ROWID');
  db.run('CREATE TABLE IF NOT EXISTS lane (rowid INT PRIMARY KEY, collection INT, num SMALLINT, speed SMALLINT, occupy SMALLINT, S SMALLINT, T SMALLINT, L SMALLINT) WITHOUT ROWID');
  console.log('Database created and tables defined.');
}

function dataDirectoryExists(cb) {
  fs.exists('../' + dataDirectory + '/', cb);
}

function importDetectorInfo(cb) {
  fs.readFile('../' + dataDirectory + '/' + vehicleDetectorFilename, 'utf8', function (err, data) {
    if (err) return console.log(err);
    parse(data, { delimiter: ',' }, function(err, output) {
      for (var i = 1; i < output.length - 1; i++)
        db.run('INSERT INTO device (vdid, roadDir, roadNum, lng, lat) VALUES (\''+output[i][0]+'\', \''+output[i][0][7]+'\', \''+output[i][0][6]+'\', '+output[i][2]+', '+output[i][1]+')');
      console.log(output.length + ' devices imported.');
      getDeviceList(function(devices) {
        var southern = calculateQueuePointers(devices, 'S', 'nfbVD-5N-0.178'),
          northern = calculateQueuePointers(devices, 'N', 'nfbVD-5N-TCIC-I-29.843');
        southern.forEach(function(o) {
          db.run('UPDATE device SET prev = '+o.prev+', next = '+o.next+', prevDist = '+o.prevDist+', nextDist = '+o.nextDist+' WHERE rowid = '+o.id);
        });
        northern.forEach(function(o) {
          db.run('UPDATE device SET prev = '+o.prev+', next = '+o.next+', prevDist = '+o.prevDist+', nextDist = '+o.nextDist+' WHERE rowid = '+o.id);
        });
        console.log('Queue pointers updated on devices.');
        createLocalDetectorMapping(cb);
      });
    });
  });
}

// credit: http://www.movable-type.co.uk/scripts/latlong.html
function meterDistance(p1, p2) {
  var R = 6371000;
  var φ1 = p1.lat * Math.PI / 180;
  var φ2 = p2.lat  * Math.PI / 180;
  var Δφ = (p2.lat-p1.lat)  * Math.PI / 180;
  var Δλ = (p2.lng-p1.lng)  * Math.PI / 180;
  var a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function calculateQueuePointers(devices, roadDir, startId) {
  var start = devices.filter(function(v) {
    return v.vdid == startId;
  })[0],
  pool = devices.filter(function(v) {
    return v.roadDir == roadDir && v.vdid != startId;
  }),
  sorted = [start];
  while (pool.length > 0) {
    var smallestDistance = 40075000,
      smallestIndex = 0;
    for (var i = 0; i < pool.length; i++) {
      var d = meterDistance(start, pool[i]);
      if (d < smallestDistance) {
        smallestDistance = d;
        smallestIndex = i;
      }
    }
    sorted.push(pool[smallestIndex]);
    pool.splice(smallestIndex, 1);
  }
  for (var i = 0; i < sorted.length; i++) {
    sorted[i].prev = (i > 0 ? sorted[i-1].id : null);
    sorted[i].prevDist = (i > 0 ? meterDistance(sorted[i-1], sorted[i]) : null);
    sorted[i].next = (i < sorted.length - 1 ? sorted[i+1].id : null);
    sorted[i].nextDist = (i < sorted.length - 1 ? meterDistance(sorted[i+1], sorted[i]) : null);
  }
  return sorted;
}

function createLocalDetectorMapping(cb) {
  db.all('SELECT rowid AS id, vdid FROM device', function(err, rows) {
    deviceIds = {};
    for (var i = 0; i < rows.length; i++)
      deviceIds[rows[i].vdid] = rows[i].id;
    cb();
  });
}

function importVehicleInfo(startDate, endDate) {
  var numCollections = 0, numLanes = 0,
  convertStupidLaneXML = function(xml) {
    var lane = {
      num: xml.$.vsrid,
      speed: xml.$.speed,
      occupy: xml.$.laneoccupy
    };
    for (var i = 0; i < xml.cars.length; i++)
      lane[xml.cars[i].$.carid] = xml.cars[i].$.volume;
    return lane;
  },
  insertCollections = function(info, interval, cb) {
    // note to self,.. ran into endless trouble using sqlite3 prepared statements. db.run() just works.
    info.forEach(function(o, j) {
      if (typeof deviceIds[o.$.vdid] == 'undefined') return;
      numCollections++;
      db.run('INSERT INTO collection VALUES ('+numCollections+','+deviceIds[o.$.vdid]+','+o.$.status+',\''+o.$.datacollecttime+'\','+interval+');');
      o.lane.forEach(function(poo, k) {
        var lane = convertStupidLaneXML(poo);
        db.run('INSERT INTO lane VALUES ('+numLanes+','+numCollections+', '+lane.num+', '+lane.speed+', '+lane.occupy+', '+lane.S+', '+lane.T+', '+lane.L+');');
        numLanes++;
      });
    });
    cb();
  };
  db.get('SELECT MAX(rowid)+1 num FROM collection', function(err, collectionMax) {
    numCollections = collectionMax.num | 0;
    db.get('SELECT MAX(rowid)+1 num FROM lane', function(err, laneMax) {
      numLanes = laneMax.num | 0;
      walk('../' + dataDirectory + '/' + vehicleDirectory, function(err, results) {
        if (err) return console.log(err);
        // filter results to just xml files that are in the specified date range
        results = results.filter(function(v) {
          var e = v.substr(v.lastIndexOf('/') + 1);
          return e.indexOf('.xml') != -1 && e.indexOf('_') == -1 && e > startDate && e < endDate;
        });
        console.log(numCollections + ':' + numLanes);
        var parser = new xml2js.Parser(), counter = 0,
            worker = function() {
              if (counter < results.length - 1) {
                counter++;
              } else {
                console.log('Finished import: Collections('+numCollections+'), Lanes('+numLanes+')');
                return;
              }
              console.log('Processing: ' +  counter + ' of ' + results.length + ' files.');
              console.log(results[counter]);
              fs.readFile(results[counter], function(err, data) {
                try {
                  parser.parseString(data, function (err, r) {
                    insertCollections(r.XML_Head.Infos[0].Info, r.XML_Head.$.interval, function() {
                      setTimeout(worker, 10);
                    });
                  });
                } catch (error) {
                  console.log('Error parsing whatever file we found in the directory. Just skip it.');
                  console.dir(error);
                }
              });
            }
        worker();
      });
    });
  });
}

function getDataLimits(callback) {
  db.all('SELECT substr(collectTime, 1, 10) date, SUM(L.S) / 155 activity FROM collection C INNER JOIN lane L ON (C.rowid = L.collection) GROUP BY substr(collectTime, 1, 10) ORDER BY collectTime', function(err, dates) {
    callback({
      dates: dates
    });
  });
};

function getTrafficForTime(time, callback) {
  db.all('SELECT C.device, L.num, L.speed, L.occupy, L.S, L.T, L.L FROM collection C INNER JOIN lane L ON (C.rowid = L.collection) WHERE substr(collectTime, 1, 16) = \''+time+'\'', function(err, data) {
    callback(data);
  });
};

function getAggregatedTrafficForTime(time, callback) {
  db.all('SELECT C.device device, COUNT(L.num) lanes, SUM(L.S) + SUM(L.T) + SUM(L.L) total, AVG(L.speed) speed FROM collection C INNER JOIN lane L ON (C.rowid = L.collection) WHERE substr(collectTime, 1, 16) = \''+time+'\' GROUP BY C.device', function(err, data) {
    callback(data);
  });
};

function getTimesForDay(date, callback) {
  db.all('SELECT DISTINCT substr(collectTime, 12, 5) time FROM collection WHERE substr(collectTime, 1, 10) = \'' + date + '\'', function(err, data) {
    callback(data.map(function(o) {
      return o.time;
    }));
  });
};

function getDeviceList(callback) {
  db.all("SELECT rowid AS id, * FROM device", function(err, data) {
    callback(data);
  });
};


// public functions

exports.aggregatedTrafficForTime = function(req, res) {
  getAggregatedTrafficForTime(req.query.time, function(data) {
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(data));
  });
};

exports.trafficForTime = function(req, res) {
  getTrafficForTime(req.query.time, function(data) {
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(data));
  });
};

exports.timesForDay = function(req, res) {
  getTimesForDay(req.query.date, function(data) {
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(data));
  });
};

exports.trafficLimits = function(req, res) {
  getDataLimits(function(data) {
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(data));
  });
};

exports.trafficVehicleDetectors = function(req, res) {
  getDeviceList(function(data) {
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(data));
  });
};

exports.devices = function(req, res) {
  getDeviceList(function(data) {
    res.render('deviceList', {
      title: 'Traffic Vehicle Detectors',
      data: data
    });
  });
};

exports.map = function(req, res) {

  res.render('map', {
    title: 'Map'
  });

};

exports.setup = function(req, res) {
  var render = function(dataDirExists, numberOfDetectors) {
    res.render('setup', {
      title: 'Setup',
      dataDirExists: dataDirExists,
      numberOfDetectors: numberOfDetectors,
      startDate: '20150501',
      endDate: '20150504'
    });
  };
  dataDirectoryExists(function(dataDirExists) {
    fs.exists(databaseName, function(exists) {
      if (exists) {
        db.get('SELECT COUNT(vdid) num FROM device', function(err, numberOfDetectors) {
          render(dataDirExists, numberOfDetectors ? numberOfDetectors.num : 0);
        });
      } else {
        render(dataDirExists, 0);
      }
    });
  });
};

// http://hsuehshantunnel.devpost.com/details/resources
exports.importDetectors = function(req, res) {
  createDatabase();
  importDetectorInfo(function() {
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify({st:'ok'}));
  });
};

// http://hsuehshantunnel.devpost.com/details/resources
exports.importTraffic = function(req, res) {
  createLocalDetectorMapping(function() {
    importVehicleInfo(req.query.startDate, req.query.endDate);
  });
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify({st:'ok'}));
};
