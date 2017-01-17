function isWhiteSpace(ch) {
    return (
        ch === ' ' ||
        ch === '\t' ||
        ch === '\r' ||
        ch === '\n');
}

function tokenize (cmd) {
    var result = [];
    var nextToken = null;
    var inWord = false;
    var quote = null;
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
            if (!quote && isWhiteSpace(ch)) {
                inWord = false;
                result.push(nextToken);
                nextToken = null;
                continue;
            }
        }
        // Non-white-space in word:
        if (quote && quote === ch) {
            // End-quote reached
            quote = null;
            inWord = false;
            result.push(nextToken);
            nextToken = null;
            continue;
        }
        if (!quote && (ch === '"' || ch === "'")) {
            // String begin
            quote = ch;
            continue;
        }
        if (ch === '\\' && i + 1 < len) {
            // Escape characted
            nextToken += cmd[++i];
            continue;
        }
        if (!quote && ch == '#') {
            // Ignore comments
            break;
        }
        nextToken += ch;
    }
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
