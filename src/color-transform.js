const { Transform } = require('stream');
const clr = require('./console-colors');
const ERROR_COLOR = clr.RED;
const WARNING_COLOR = clr.YELLOW + clr.BOLD;
const STDERR_COLOR = clr.LIGHT_RED;

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
                    this.push(ERROR_COLOR+strChunk+clr.RESET, strEnc);
                } else if (/warning\s/i.test(strChunk)) {
                    this.push(WARNING_COLOR+strChunk+clr.RESET, strEnc);
                } else if (this.isStdErr) {
                    this.push(STDERR_COLOR+strChunk+clr.RESET, strEnc);
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
