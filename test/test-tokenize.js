const {expect, assert} = require ('chai');
const {tokenize} = require ('../src/tokenize');

describe("tokenize", ()=>{
    it('should separate words into an array', ()=>{
        expect(tokenize(`one two three`)).to.deep.equal(["one", "two", "three"]);
    });
    it('should handle quotes', ()=>{
        expect(tokenize(`"one" "two" "three"`)).to.deep.equal(["one", "two", "three"]);
        expect(tokenize(`"one two" " three " "four "   " five" ""  `)).to.deep.equal([
            "one two",
            " three ",
            "four ",
            " five",
            ""]);
        expect(tokenize(`one 'two' [--watch 'two three four']`)).to.deep.equal([
            "one",
            "two",
            "[--watch",
            "two three four",
            "]"]);
    });
    it('should ignore comments', ()=> {
        expect(tokenize(`one two #three`)).to.deep.equal(["one", "two"]);
        expect(tokenize(`one #two three`)).to.deep.equal(["one"]);
        expect(tokenize(`#one two three`)).to.deep.equal([]);
        expect(tokenize(`# one`)).to.deep.equal([]);
        expect(tokenize(`  # one`)).to.deep.equal([]);
    });
});
