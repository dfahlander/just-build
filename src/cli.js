const {main} = require ('./index');
const clr = require ('./console-colors');

require('events').EventEmitter.prototype._maxListeners = 100;

main(process.argv).then(()=>{
    process.exit(0);
}).catch(err => {
    console.error(`${clr.RED}${err}${clr.RESET}`);
    process.exit(1);
});
