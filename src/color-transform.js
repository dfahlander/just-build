const { Transform } = require('stream');
const { clc } = require ('../bundledExternals/bundle');

class ColorTransform extends Transform {
    constructor (isStdErr) {
        super({});
        this.isStdErr = isStdErr;
    }

    _transform(chunk, encoding, callback) {
        try {
            if (chunk && chunk.toString) {
                const [strChunk, strEnc] =
                    typeof chunk === 'string' ?
                        [chunk, encoding] :
                        [chunk.toString("utf-8"), "utf-8"];
                if (/error\s/i.test(strChunk)) {
                    this.push(clc.red(strChunk), strEnc);
                } else if (/warning\s/i.test(strChunk) || this.isStdErr) {
                    this.push(clc.yellow.bold(strChunk), strEnc);
                } else {
                    this.push(chunk, encoding);
                }
            } else {
                this.push(chunk, encoding);
            }
        } catch(err) {
            this.push(chunk, encoding);
        }
        callback();
    }
}

module.exports = { ColorTransform };
