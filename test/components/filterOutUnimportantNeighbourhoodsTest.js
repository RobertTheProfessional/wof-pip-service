var tape = require('tape');
var event_stream = require('event-stream');

var filterOutUnimportantNeighbourhoods = require('../../src/components/filterOutUnimportantNeighbourhoods');

function test_stream(input, testedStream, callback) {
    var input_stream = event_stream.readArray(input);
    var destination_stream = event_stream.writeArray(callback);

    input_stream.pipe(testedStream).pipe(destination_stream);
}

tape('filterOutUnimportantNeighbourhoods', function(test) {
  test.test('non-neighbourhood placetype should return true', function(t) {
    var input = [
      {
        properties: { 'wof:placetype': 'locality', 'mz:tier_locality': 1 }
      },
      {
        properties: { 'wof:placetype': 'localadmin', 'mz:tier_locality': 2 }
      },
      {
        properties: { 'wof:placetype': 'region', 'mz:tier_locality': 3 }
      },
      {
        properties: { 'wof:placetype': 'county', 'mz:tier_locality': 7 }
      }
    ];
    var expected = input;

    var filter = filterOutUnimportantNeighbourhoods.create();

    test_stream(input, filter, function(err, actual) {
      t.deepEqual(actual, expected, 'should have returned true');
      t.end();
    });

  });

  test.test('neighbourhood placetype with non-6/7 mz:tier_locality should return false', function(t) {
    var input = [
      {
        properties: { 'wof:placetype': 'neighbourhood', 'mz:tier_locality': 1 }
      },
      {
        properties: { 'wof:placetype': 'neighbourhood', 'mz:tier_locality': 2 }
      },
      {
        properties: { 'wof:placetype': 'neighbourhood', 'mz:tier_locality': 3 }
      },
      {
        properties: { 'wof:placetype': 'neighbourhood', 'mz:tier_locality': 4 }
      },
      {
        properties: { 'wof:placetype': 'neighbourhood', 'mz:tier_locality': 5 }
      },
      {
        properties: { 'wof:placetype': 'neighbourhood', 'mz:tier_locality': 6 }
      },
      {
        properties: { 'wof:placetype': 'neighbourhood', 'mz:tier_locality': 7 }
      },
      {
        properties: { 'wof:placetype': 'neighbourhood', 'mz:tier_locality': 8 }
      }
    ];

    // only the placetype=neighbourhood and tier_locality=7 input should be returned
    var expected = [input[5], input[6]];

    var filter = filterOutUnimportantNeighbourhoods.create();

    test_stream(input, filter, function(err, actual) {
      t.deepEqual(actual, expected, 'should have returned true');
      t.end();
    });

  });

  test.test('neighbourhood placetype with undefined mz:tier_locality should return false', function(t) {
    var input = [
      {
        properties: { 'wof:placetype': 'neighbourhood', 'mz:is_funky': 0 }
      }
    ];

    var expected = [];

    var filter = filterOutUnimportantNeighbourhoods.create();

    test_stream(input, filter, function(err, actual) {
      t.deepEqual(actual, expected, 'should have returned true');
      t.end();
    });

  });

  test.test('neighbourhood placetype with 6 or 7 mz:tier_locality but mz:is_funky=1 should return false', function(t) {
    var input = [
      {
        properties: { 'wof:placetype': 'neighbourhood', 'mz:tier_locality': 6, 'mz:is_funky': 0 }
      },
      {
        properties: { 'wof:placetype': 'neighbourhood', 'mz:tier_locality': 7, 'mz:is_funky': 0 }
      },
      {
        properties: { 'wof:placetype': 'neighbourhood', 'mz:tier_locality': 6, 'mz:is_funky': 1 }
      },
      {
        properties: { 'wof:placetype': 'neighbourhood', 'mz:tier_locality': 7, 'mz:is_funky': 1 }
      },
      {
        properties: { 'wof:placetype': 'neighbourhood', 'mz:tier_locality': 6 }
      },
      {
        properties: { 'wof:placetype': 'neighbourhood', 'mz:tier_locality': 7 }
      }
    ];

    // only the placetype=neighbourhood ,tier_locality=7, and non-funky inputs should be returned
    var expected = [input[0], input[1], input[4], input[5]];

    var filter = filterOutUnimportantNeighbourhoods.create();

    test_stream(input, filter, function(err, actual) {
      t.deepEqual(actual, expected, 'should have returned true');
      t.end();
    });

  });

});
