const { Map, fromJS } = require('immutable');

const util = require('./util.js');
const testData = require('./test_data.json');

test('basic character parsing', done => {
  util.parseCharacter(testData.CHARA, (a) => {
    let attrs = Map(a);
    expect(attrs.size).toBe(2);
    expect(attrs.get('a')).toBe('b');
    expect(attrs.get('c')).toBe('d e');
    done();
  }, (err) => null)
})

test('proper money management', () => {
  let ret = util.doPayment(fromJS({"characters": {"1": {"testa": {"money": 10000}}, "2": {"testb": {"money": 10000}}}}),
    {userID: "1", characterName: "testa"},
    {userID: "2", characterName: "testb"},
    5000)
  expect(ret.getIn(['characters', "1", "testa", 'money'])).toBe(5000);
  expect(ret.getIn(['characters', "2", "testb", 'money'])).toBe(15000);
})
