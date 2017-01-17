
class ResolvablePromise extends Promise {
    constructor () {
        var res, rej;
        super((resolve, reject) => {
            res = resolve;
            rej = reject;
        });
        this.resolve = res.bind(null);
        this.reject = rej.bind(null);
    }

    static get [Symbol.species]() { return Promise; }
}

module.exports = { ResolvablePromise };
