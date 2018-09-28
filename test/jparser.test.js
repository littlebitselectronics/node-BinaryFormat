import jDataView from 'jDataView'

import jParser from '~/src/jparser'

const buffer = jDataView.from(0x00, 0xff, 0xfe, 0xfd, 0xfc, 0xfa, 0x00, 0xba, 0x01)

const view = new jDataView(buffer, 1, undefined, true)

const parser = new jParser(view)

const chr = x => String.fromCharCode(x)

// describe('Writing', () => {
//   const tempBuffer = new Buffer(128)
//   const tempView = new jDataView(tempBuffer, 1, undefined, true)
//   const tempParser = new jParser(tempView)

//   const testStruct = {
//     type:      2,
//     subType:   6,
//     id:        8,
//     numInputs: 2,
//     snaps:     6,
//   }

//   const input = {
//     type:      2,
//     subType:   8,
//     id:        60,
//     numInputs: 1,
//     snaps:     18,
//   }

//   test('Write object', () => {
//     tempParser.seek(0)
//     tempParser.parse(testStruct, input)
//     expect(tempBuffer.slice(1,4)).toEqual([136, 60, 82])
//   })
// })

/** Sanity-check endianness, because it's not sorking IRL. */
describe('Endianness', () => {
  describe('Behavior definition', () => {
    const tempBuffer = Buffer.from([0xDE, 0xAD, 0xBE, 0xEF])

    test('Little Endian', () => {
      const bigEndian = new jDataView(tempBuffer, undefined, undefined, false)
      const beParser = new jParser(bigEndian)

      beParser.seek(0)
      expect(beParser.parse('uint8')).toBe(0xDE)

      beParser.seek(0)
      expect(beParser.parse('uint16')).toBe(0xDEAD)

      beParser.seek(0)
      expect(beParser.parse('uint32')).toBe(0xDEADBEEF)
    })

    test('YUUUGE Endian', () => {
      const littleEndianView = new jDataView(tempBuffer, undefined, undefined, true)
      const leParser = new jParser(littleEndianView)

      leParser.seek(0)
      expect(leParser.parse('uint8')).toBe(0xDE)

      leParser.seek(0)
      expect(leParser.parse('uint16')).toBe(0xADDE)

      leParser.seek(0)
      expect(leParser.parse('uint32')).toBe(0xEFBEADDE)
    })
  })

  describe('Bits vs Endianness', () => {
    const tempBuffer = Buffer.from([0xE0, 0xFF, 0xFF, 0x3F])
    const littleEndianView = new jDataView(tempBuffer, undefined, undefined, true)
    const leParser = new jParser(littleEndianView)

    test('Simple test', () => {
      const structs = {
        ReducedBitInfo: {
          snapMap: 32,
        },
      }

      leParser.seek(0)
      const result = leParser.parse(structs)

      console.log(JSON.stringify(result, null, 2))
      console.log(result.ReducedBitInfo.snapMap.toString(16))

      expect(result).toEqual({ ReducedBitInfo: { snapMap: 0x3FFFFFE0 } })
    })
  })
})

/** Check built-in values. */
describe('Values', () => {
  test('uint', () => {
    parser.seek(0)

    expect(parser.parse('uint8')).toBe(255)
    expect(parser.parse('uint16')).toBe(65022)
    expect(parser.parse('uint32')).toBe(3120626428)
  })

  test('int', () => {
    parser.seek(0)

    expect(parser.parse('int8')).toBe(-1)
    expect(parser.parse('int16')).toBe(-514)
    expect(parser.parse('int32')).toBe(-1174340868)
  })

  test('float', () => {
    parser.seek(0)
    expect(parser.parse('float32')).toBe(-1.055058432344064e+37)

    parser.seek(0)
    expect(parser.parse('float64')).toBe(2.426842827241402e-300)
  })

  test('string', () => {
    parser.seek(5)

    expect(parser.parse('char')).toBe(chr(0x00))
    expect(parser.parse(['string', 2])).toBe(chr(0xba) + chr(0x01))
  })

  test('array', () => {
    parser.seek(0)
    expect(parser.parse(['array', 'uint8', 8])).toEqual([0xff, 0xfe, 0xfd, 0xfc, 0xfa, 0x00, 0xba, 0x01])

    parser.seek(0)
    expect(parser.parse(['array', 'int32', 2])).toEqual([-50462977, 28967162])
  })

  test('object', () => {
    parser.seek(0)

    expect(parser.parse({
      a: 'int32',
      b: 'int8',
      c: ['array', 'uint8', 2]
    })).toEqual({
      a: -50462977,
      b: -6,
      c: [0, 186]
    })
  })

  test('bitfield', () => {
    parser.seek(6)

    expect(parser.parse({
      first5: 5,
      next5: function () {
        return this.parse(5)
      },
      last6: {
        first3: 3,
        last3: 3
      }
    })).toEqual({
      first5: 0x17,
      next5: 0x08,
      last6: {
        first3: 0,
        last3: 1
      }
    })
  })
})

describe('Utils', () => {
  test('seek', () => {
    parser.seek(5)
    expect(parser.tell()).toBe(5)

    parser.seek(parser.tell() - 2)
    expect(parser.tell()).toBe(3)

    parser.seek(5, () => {
      expect(parser.tell()).toBe(5)
      parser.seek(0)
      expect(parser.tell()).toBe(0)
    })

    expect(parser.tell()).toBe(3)
  })
})
