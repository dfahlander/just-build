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
    it('should accept string args', ()=>{
        const command = "node -p '(\"hello\")'";
        const [cmd, ...args] = tokenize(command);
        expect(cmd).to.equal('node');
        expect(args).to.deep.equal(['-p', '("hello")']);
        const {grepString, refinedArgs, useWatch} = refineArguments(args, false, command);
        expect(refinedArgs).to.deep.equal(["-p", '("hello")']);
    });
});
