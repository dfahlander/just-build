const {expect, assert} = require ('chai');
const {tokenize} = require ('../src/tokenize');
const {refineArguments} = require ('../src/execute');

describe("refineArguments", ()=>{
    it('should ignore optional watch argument if not watch mode', ()=>{
        var command = "one two [--watch 'Hello']";
        var {grepString, refinedArgs, useWatch} = refineArguments(tokenize(command), true, command);
        expect(grepString).to.equal("Hello");
        expect(refinedArgs).to.deep.equal(["one", "two", "--watch"]);
        expect(useWatch).to.be.true;
    });
    it('should use optional watch argument if watch mode', ()=>{
        var command = "one two [--watch 'Hello']";
        var {grepString, refinedArgs, useWatch} = refineArguments(tokenize(command), false, command);
        expect(refinedArgs).to.deep.equal(["one", "two"]);
        expect(useWatch).to.be.false;        
    });
});
