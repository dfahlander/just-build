function extend(obj, extension) {
    if (typeof extension !== 'object') return obj;
    Object.keys(extension).forEach(key => {
        obj[key] = extension[key];
    });
    return obj;
}

function clone (obj, extension) {
    let clone = {};
    Object.keys(obj).forEach(key => {
        clone[key] = obj[key];
    });
    if (extension) extend(clone, extension);
    return clone;
}

module.exports = {extend, clone};
