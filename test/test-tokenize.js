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

    it('should expand variables', ()=> {
        expect(tokenize('$version', {})).to.deep.equal([]);
        expect(tokenize('$version', {version: "1.2.3"})).to.deep.equal(["1.2.3"]);
        expect(tokenize('prefix$version', {})).to.deep.equal(['prefix']);
        expect(tokenize('prefix$version', {version: "1.2.3"})).to.deep.equal(['prefix1.2.3']);
        expect(tokenize('$a $b c', {a: 1, b: "B"}))
            .to.deep.equal(["1", "B", "c"]);
        expect(tokenize('"$a $b c"', {a: 1, b: "B"}))
            .to.deep.equal(["1 B c"]);
        expect(tokenize('"$a$b\\c"', {a: 1, b: "B"}))
            .to.deep.equal(["1Bc"]);
        
    });
});
