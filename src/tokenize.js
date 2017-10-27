function isWhiteSpace(ch) {
    return (
        ch === ' ' ||
        ch === '\t' ||
        ch === '\r' ||
        ch === '\n');
}

function tokenize (cmd, envVars) {
    var result = [];
    var nextToken = null;
    var inWord = false;
    var quote = null;
    var varStart = 0;
    if (!envVars) envVars = {};

    function stopVarState() {
        if (varStart) {
            // If we are within a variable and hit a baslash,
            // we should end and resolve the varable first
            nextToken += envVars[cmd.substring(varStart, i)] || "";
            varStart = 0; // Takes us out from VAR state.
        }
    }

    for (var i=0, len = cmd.length; i < len; ++i) {
        var ch = cmd[i];
        if (!inWord) {
            if (isWhiteSpace(ch)) {
                continue;
            } else {
                inWord = true;
                nextToken = "";
            }
        } else {
            // in word.
            if (isWhiteSpace(ch)) {
                stopVarState();
                if (!quote) {
                    inWord = false;
                    result.push(nextToken);
                    nextToken = null;
                    continue;
                }
            }
        }
        // Non-white-space in word:
        if (quote && quote === ch) {
            // End-quote reached
            quote = null;
            inWord = false;
            stopVarState();
            result.push(nextToken);
            nextToken = null;
            continue;
        }
        if (!quote && (ch === '"' || ch === "'")) {
            // String begin
            stopVarState();
            quote = ch;
            continue;
        }
        if (ch === '\\' && i + 1 < len) {
            // Escape characted
            stopVarState();
            nextToken += cmd[++i];
            continue;
        }
        if (!quote && ch == '#') {
            // Ignore comments
            break;
        }
        if (ch == '$') {
            stopVarState();
            varStart = i + 1;
        }
        if (!varStart) {
            nextToken += ch;
        }
    }

    stopVarState();

    if (nextToken)
        result.push(nextToken);

    return result;
}

function surroundWithQuotes(str) {
    let result = "";
    for (let i=0, len = str.length; i < len; ++i) {
        const ch = str[i];
        if (ch === '"' || ch === '\\') result += "\\";
        result += ch;
    }
    return `"${result}"`;
}

module.exports = { tokenize, surroundWithQuotes };
