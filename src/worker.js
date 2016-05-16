/**
 * A worker processes intended to be launched by the `./master.js` module.
 * Loads one polygon layer into memory, builds a `PolygonLookup` for it, and
 * then returns intersection results for `search` queries.
 */

var logger = require( 'pelias-logger').get('admin-lookup:worker');
var PolygonLookup = require('polygon-lookup');

var readStream = require('./readStream');
var geos = require('../../../node-geos/lib');

var context = {
  adminLookup: null,// This worker's `PolygonLookup`.
  layer: '', // The name of this layer (eg, 'country', 'neighborhood').
  featureCollection: {
    features: []
  }
};

/**
 * Respond to messages from the parent process
 */
function messageHandler( msg ) {
  switch (msg.type) {
    case 'load'   : return handleLoadMsg(msg);
    case 'search' : return handleSearch(msg);
    case 'lookupById': return handleLookupById(msg);
    default       : logger.error('Unknown message:', msg);
  }
}

process.on( 'message', messageHandler );

function elapsedTime() {
  return ((Date.now() - context.startTime)/1000) + ' secs';
}

function handleLoadMsg(msg) {
  context.layer = msg.layer;
  process.title = context.layer;
  context.startTime = Date.now();

  readStream(msg.directory, msg.layer, function(features) {
    logger.info(features.length + ' ' + context.layer + ' record ids loaded in ' + elapsedTime());

    context.wktreader = new geos.WKTReader();
    context.geojsonreader = new geos.GeoJSONReader();

    context.geometries = features.map(function(feature) {
      return {
        type: feature.geometry.type,
        // a hack because node-geos does not support features
        // so hide the full feature in the geometry itself
        feature: feature,
        coordinates: feature.geometry.coordinates
      };
    });

    context.geos_geometries = context.geometries.map(function(geometry) {
      try {
        var geos_geom = context.geojsonreader.read(geometry);
        return geos_geom;
      } catch (e) {
        //console.log(JSON.stringify(geometry, null, 2));
        console.log("error with geometry");
        return undefined;
      }
    });

    context.strtree = new geos.STRtree();

    context.geos_geometries.forEach(function(geos_geometry) {
      if (geos_geometry) {
        context.strtree.insert(geos_geometry);
      }
    });
    context.strtree.build();

    logger.info(context.layer + ' finished building STRtree in ' + elapsedTime());

    // load countries up into an object keyed on id
    if ('country' === context.layer) {
      context.byId = features.reduce(function(cumulative, feature) {
        cumulative[feature.properties.Id] = feature.properties;
        return cumulative;
      }, {});
    }

    logger.info( 'Done loading ' + context.layer );
    logger.info(context.layer + ' finished loading ' + features.length + ' features in ' + elapsedTime());

    process.send( {type: 'loaded', layer: context.layer} );
  });
}

function handleSearch(msg) {
  process.send({
    layer: context.layer,
    type: 'results',
    id: msg.id,
    results: search( msg.coords )
  });
}

/**
 * Search `adminLookup` for `latLon`.
 */
function search( latLon ){
  var wkt = 'POINT( ' + latLon.longitude + ' ' + latLon.latitude + ')';
  console.log("about to search " + wkt);
  var point = context.wktreader.read(wkt);
  var polys = context.strtree.query(point);
  console.log("got results from query");

  return (polys[0] === undefined) ? {} : polys[0].feature.properties;
}

function handleLookupById(msg) {
  process.send({
    layer: context.layer,
    type: 'results',
    id: msg.id,
    results: lookupById(msg.countryId)
  });
}

// return a country layer or an empty object (country not found)
// only process if this is the country worker
function lookupById(id) {
  if ('country' === context.layer) {
    return context.byId[id] || {};
  }
}
