const {ResolvablePromise} = require('./resolvable-promise');

class AsyncIterator {
    constructor() {
        this.promiseBuf = [new ResolvablePromise()];
        this.done = false;
    }

    push(val, done) {
        if (this.done) throw new RangeError("Iterator already done.");
        this.promiseBuf[this.promiseBuf.length-1].resolve(val);
        this.promiseBuf.push(new ResolvablePromise());
        if (done) this.done = true;
    }

    next() {
        if (this.done && this.promiseBuf.length === 0) return Promise.reject(
            new RangeError(
                'Stream already done.'
            )
        );
        if (this.promiseBuf.length === 0) return Promise.reject(
            new RangeError(
                'Cannot call next() before waiting for previous next to complete.'));

        const p = this.promiseBuf.shift();
        
        return p.then(value => ({
            value,
            done: this.done && this.promiseBuf.length === 0
        }));
    }
}

module.exports = { AsyncIterator };
