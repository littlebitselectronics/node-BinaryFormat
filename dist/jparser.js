'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _jDataView = require('jDataView');

var _jDataView2 = _interopRequireDefault(_jDataView);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function ClonedObject() {}

// Extend code from underscorejs (modified for fast inheritance using prototypes)
function inherit(obj) {
  var xObj = void 0;

  if ('create' in Object) {
    xObj = Object.create(obj);
  } else {
    ClonedObject.prototype = obj;
    xObj = new ClonedObject();
  }

  for (var i = 1; i < arguments.length; ++i) {
    var source = arguments[i];
    for (var prop in source) {
      if (source[prop] !== undefined) {
        xObj[prop] = source[prop];
      }
    }
  }

  return xObj;
}

var toInt = function toInt(val) {
  return val instanceof Function ? val.call(undefined) : val;
};

var jParser = function () {
  function jParser(view, structure) {
    _classCallCheck(this, jParser);

    var xView = view;

    if (!(xView instanceof _jDataView2.default)) {
      xView = new _jDataView2.default(view, undefined, undefined, true);
    }

    this.view = xView;
    this.view.seek(0);

    this._bitShift = 0;
    this.structure = inherit(jParser.prototype.structure, structure);
  }

  _createClass(jParser, [{
    key: 'seek',
    value: function seek(position, block) {
      var newPosition = toInt.call(this, position);

      if (block instanceof Function) {
        var oldPosition = this.view.tell();
        this.view.seek(newPosition);

        var result = block.call(this);
        this.view.seek(oldPosition);
        return result;
      }

      return this.view.seek(newPosition);
    }
  }, {
    key: 'tell',
    value: function tell() {
      return this.view.tell();
    }
  }, {
    key: 'skip',
    value: function skip(offset) {
      var newOffset = toInt.call(this, offset);
      this.view.seek(this.view.tell() + newOffset);
      return newOffset;
    }
  }]);

  return jParser;
}();

jParser.prototype.structure = {
  uint8: function uint8() {
    return this.view.getUint8();
  },
  uint16: function uint16() {
    return this.view.getUint16();
  },
  uint32: function uint32() {
    return this.view.getUint32();
  },
  int8: function int8() {
    return this.view.getInt8();
  },
  int16: function int16() {
    return this.view.getInt16();
  },
  int32: function int32() {
    return this.view.getInt32();
  },
  float32: function float32() {
    return this.view.getFloat32();
  },
  float64: function float64() {
    return this.view.getFloat64();
  },
  char: function char() {
    return this.view.getChar();
  },

  string: function string(length) {
    return this.view.getString(toInt.call(this, length));
  },

  array: function array(type, length) {
    length = toInt.call(this, length);
    var results = [];

    for (var i = 0; i < length; ++i) {
      results.push(this.parse(type));
    }

    return results;
  },

  if: function _if(predicate) {
    if (predicate instanceof Function ? predicate.call(this) : predicate) {
      return this.parse.apply(this, Array.prototype.slice.call(arguments, 1));
    }
  }
};

jParser.prototype.parse = function (structure) {
  if (typeof structure === 'number') {
    console.log('structure number', structure);
    console.log('this._bitShift', this._bitShift);

    var fieldValue = 0;
    var bitSize = structure;

    if (this._bitShift < 0) {
      var byteShift = this._bitShift >> 3; // Math.floor(_bitShift / 8)

      this.skip(byteShift);
      this._bitShift &= 7; // _bitShift + 8 * Math.floor(_bitShift / 8)
    }

    if (this._bitShift > 0 && bitSize >= 8 - this._bitShift) {
      fieldValue = this.view.getUint8() & ~(-1 << 8 - this._bitShift);
      bitSize -= 8 - this._bitShift;
      this._bitShift = 0;
    }

    while (bitSize >= 8) {
      fieldValue = this.view.getUint8() | fieldValue << 8;
      bitSize -= 8;
    }

    if (bitSize > 0) {
      fieldValue = this.view.getUint8() >>> 8 - (this._bitShift + bitSize) & ~(-1 << bitSize) | fieldValue << bitSize;
      this._bitShift += bitSize - 8; // passing negative value for next pass
    }

    return fieldValue;
  }

  // f, 1, 2 means f(1, 2)
  if (structure instanceof Function) {
    return structure.apply(this, Array.prototype.slice.call(arguments, 1));
  }

  // 'int32', ... is a shortcut for ['int32', ...]
  if (typeof structure === 'string') {
    structure = Array.prototype.slice.call(arguments);
  }

  // ['string', 256] means structure['string'](256)
  if (structure instanceof Array) {
    var key = structure[0];

    if (!(key in this.structure)) {
      throw new Error('Missing structure for "' + key + '"');
    }

    return this.parse.apply(this, [this.structure[key]].concat(structure.slice(1)));
  }

  // {key: val} means {key: parse(val)}
  if ((typeof structure === 'undefined' ? 'undefined' : _typeof(structure)) === 'object') {
    var output = {};
    var current = this.current;

    this.current = output;

    for (var _key in structure) {
      var value = this.parse(structure[_key]);
      // skipping undefined call results (useful for 'if' statement)
      if (value !== undefined) {
        output[_key] = value;
      }
    }

    this.current = current;

    return output;
  }

  throw new Error('Unknown structure type "' + structure + '"');
};

var all = void 0;
if (typeof self !== 'undefined') {
  all = self;
} else if (typeof window !== 'undefined') {
  all = window;
} else if (typeof global !== 'undefined') {
  all = global;
}

// Browser + Web Worker
all.jParser = jParser;

// NodeJS + NPM
if (typeof module !== 'undefined') {
  module.exports = jParser;
}