const { Observable } = require ('../../bundledExternals/bundle');

class Subject extends Observable {
    constructor () {
        super (observer => {
            this.observers.push(observer);
            this.buffer.forEach(msg => observer[msg.method](msg.value));
        });
        this.observers = [];
        this.buffer = [];
    }

    _emit(method, value) {
        this.buffer.push({method, value});
        this.observers.forEach(o => o[method](value));
    }

    next (value) {
        this._emit("next", value);
    }

    error (err) {
        this._emit("error", err);
    }

    complete(result) {
        this._emit("complete", result);
    }
}

module.exports = {Subject};
