import jDataView from 'jDataView'

import jParser from '~/src/jparser'

const buffer = jDataView.from(0x00, 0xff, 0xfe, 0xfd, 0xfc, 0xfa, 0x00, 0xba, 0x01)
const view = new jDataView(buffer, 1, undefined, true)
const parser = new jParser(view)

const chr = x => String.fromCharCode(x)

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
