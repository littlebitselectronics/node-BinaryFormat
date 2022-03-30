import jDataView from 'jdataview'

function ClonedObject() {}

// Extend code from underscorejs (modified for fast inheritance using prototypes)
function inherit(obj) {
  let xObj

  if ('create' in Object) {
    xObj = Object.create(obj)
  } else {
    ClonedObject.prototype = obj
    xObj = new ClonedObject()
  }

  for (let i = 1; i < arguments.length; ++i) {
    const source = arguments[i]
    for (const prop in source) {
      if (source[prop] !== undefined) {
        xObj[prop] = source[prop]
      }
    }
  }

  return xObj
}

const toInt = val => (val instanceof Function ? val.call(this) : val)

class jParser {
  constructor(view, structure) {
    let xView = view

    if (!(xView instanceof jDataView)) {
      xView = new jDataView(view, undefined, undefined, true)
    }

    this.view = xView
    this.view.seek(0)

    this._bitShift = 0
    this.structure = inherit(jParser.prototype.structure, structure)
  }

  seek(position, block) {
    const newPosition = toInt.call(this, position)

    if (block instanceof Function) {
      const oldPosition = this.view.tell()
      this.view.seek(newPosition)

      const result = block.call(this)
      this.view.seek(oldPosition)
      return result
    }

    return this.view.seek(newPosition)
  }

  tell() { return this.view.tell() }

  skip(offset) {
    const newOffset = toInt.call(this, offset)
    this.view.seek(this.view.tell() + newOffset)
    return newOffset
  }
}

jParser.prototype.structure = {
  uint8:   function () { return this.view.getUint8() },
  uint16:  function () { return this.view.getUint16() },
  uint32:  function () { return this.view.getUint32() },
  int8:    function () { return this.view.getInt8() },
  int16:   function () { return this.view.getInt16() },
  int32:   function () { return this.view.getInt32() },
  float32: function () { return this.view.getFloat32() },
  float64: function () { return this.view.getFloat64() },
  char:    function () { return this.view.getChar() },

  string: function (length) {
    return this.view.getString(toInt.call(this, length))
  },

  array: function (type, length) {
    length = toInt.call(this, length)
    let results = []

    for (let i = 0; i < length; ++i) {
      results.push(this.parse(type))
    }

    return results
  },

  if: function (predicate) {
    if (predicate instanceof Function ? predicate.call(this) : predicate) {
      return this.parse.apply(this, Array.prototype.slice.call(arguments, 1))
    }
  },
};

jParser.prototype.parse = function (structure) {
  if (typeof structure === 'number') {
    let fieldValue = 0
    let bitSize = structure

    if (this._bitShift < 0) {
      const byteShift = this._bitShift >> 3 // Math.floor(_bitShift / 8)

      this.skip(byteShift)
      this._bitShift &= 7 // _bitShift + 8 * Math.floor(_bitShift / 8)
    }

    if (this._bitShift > 0 && bitSize >= 8 - this._bitShift) {
      fieldValue = this.view.getUint8() & ~(-1 << (8 - this._bitShift))
      bitSize -= 8 - this._bitShift
      this._bitShift = 0
    }

    while (bitSize >= 8) {
      fieldValue = this.view.getUint8() | (fieldValue << 8)
      bitSize -= 8
    }

    if (bitSize > 0) {
      fieldValue = ((this.view.getUint8() >>> (8 - (this._bitShift + bitSize))) & ~(-1 << bitSize)) | (fieldValue << bitSize)
      this._bitShift += bitSize - 8 // passing negative value for next pass
    }

    return fieldValue
  }

  // f, 1, 2 means f(1, 2)
  if (structure instanceof Function) {
    return structure.apply(this, Array.prototype.slice.call(arguments, 1))
  }

  // 'int32', ... is a shortcut for ['int32', ...]
  if (typeof structure === 'string') {
    structure = Array.prototype.slice.call(arguments)
  }

  // ['string', 256] means structure['string'](256)
  if (structure instanceof Array) {
    const key = structure[0]

    if (!(key in this.structure)) {
      throw new Error(`Missing structure for "${key}"`)
    }

    return this.parse.apply(this, [this.structure[key]].concat(structure.slice(1)))
  }

  // {key: val} means {key: parse(val)}
  if (typeof structure === 'object') {
    const output = {}
    const current = this.current

    this.current = output

    for (const key in structure) {
      const value = this.parse(structure[key])
      // skipping undefined call results (useful for 'if' statement)
      if (value !== undefined) {
        output[key] = value
      }
    }

    this.current = current

    return output
  }

  throw new Error(`Unknown structure type "${structure}"`)
}

let all
if (typeof self !== 'undefined') {
  all = self
} else if (typeof window !== 'undefined') {
  all = window
} else if (typeof global !== 'undefined') {
  all = global
}

// Browser + Web Worker
all.jParser = jParser

// NodeJS + NPM
if (typeof module !== 'undefined') {
  module.exports = jParser
}
